#!/usr/bin/env python3
"""Initialize, check, run, and smoke-test Caspy's local Bifrost gateway.

Uses Python's standard library. Never prints credentials or provider error bodies.
"""

import argparse
import json
import math
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ("vk-caspy", "vk-judge")
# Explicit text-only allowlist; verify project eligibility before switching.
# Google free-tier pricing checked 7 November 2026. Never enable billing here.
GEMINI_AGENT_MODELS = {
    'vk-caspy': ('gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'),
    'vk-judge': ('gemini-3.6-flash', 'gemini-2.5-flash'),
}
GEMINI_FREE_MODELS = {model for models in GEMINI_AGENT_MODELS.values() for model in models}
VERDICT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "verdict": {"type": "string", "enum": ["YIELD", "NO_YIELD"]},
        "confidence": {"type": "number"},
        "category": {"type": "string", "enum": [
            "emotional", "logic", "roleplay", "trade", "humor", "other", "exploit_attempt"
        ]},
        "exploit_flag": {"type": "boolean"},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "confidence", "category", "exploit_flag", "reason"],
}


class SetupError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SetupError(message)


def read_env(path):
    """Read single-line dotenv assignments as data, never as shell code."""
    result = {}
    if not path.exists():
        return result
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)=(.*)", line)
        require(match, f"Invalid dotenv assignment on line {number} (value hidden).")
        try:
            values = shlex.split(match[2], comments=True)
        except ValueError:
            raise SetupError(f"Invalid dotenv quoting on line {number} (value hidden).") from None
        require(len(values) <= 1, f"Quote the dotenv value on line {number}.")
        result[match[1]] = values[0] if values else ""
    return result


def environment(root):
    env = read_env(root / ".env")
    env.update({key: value for key, value in os.environ.items() if value})
    if not env.get("BIFROST_SETUP_TOKEN") and env.get("BIFROST_TOKENS"):
        env["BIFROST_SETUP_TOKEN"] = env["BIFROST_TOKENS"]
    return env


def private_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w") as output:
            output.write(content)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def initialize(root, update_config=False):
    path = root / ".env"
    text = path.read_text() if path.exists() else (root / ".env.example").read_text()
    existing, env = read_env(path), environment(root)
    defaults = {
        "BIFROST_TRANSPORT_VERSION": "v2.4.0",
        "BIFROST_SETUP_TOKEN": secrets.token_urlsafe(32),
        "BIFROST_ADMIN_USERNAME": "admin",
        "BIFROST_ADMIN_PASSWORD": secrets.token_urlsafe(32),
        "BIFROST_CASPY_VK": "sk-bf-" + secrets.token_urlsafe(32),
        "BIFROST_JUDGE_VK": "sk-bf-" + secrets.token_urlsafe(32),
    }
    for key, default in defaults.items():
        if existing.get(key):
            continue
        # Persist the canonical setup token when migrating BIFROST_TOKENS.
        if env.get(key) and key != "BIFROST_SETUP_TOKEN":
            continue
        line = f"{key}={shlex.quote(env.get(key) or default)}"
        pattern = rf"(?m)^[ \t]*(?:export[ \t]+)?{key}=.*$"
        if re.search(pattern, text):
            text = re.sub(pattern, lambda _: line, text)
        else:
            text = text.rstrip() + "\n" + line + "\n"
    private_write(path, text)
    print("Gateway credentials ready in .env (values hidden; permissions 0600).")

    target = root / "data/config.json"
    if target.exists() and not update_config:
        print("Existing data/config.json preserved. Use init --update-config to back up and replace it.")
        return
    config = json.loads((root / "bifrost.config.example.json").read_text())
    if target.exists():
        backup = target.with_name(f"config.{secrets.token_hex(6)}.backup.json")
        private_write(backup, target.read_text())
        print(f"Existing configuration backed up to data/{backup.name}; existing database state preserved.")
    private_write(target, json.dumps(config, indent=2) + "\n")
    print("Wrote data/config.json with actor/judge routing and budget ownership.")


def resolve(value, env):
    if isinstance(value, str) and value.startswith("env."):
        key = value[4:]
        require(env.get(key), f"Missing {key}. Set it in .env or the process environment.")
        return env[key]
    return value


def reasoning_options(provider):
    return {'effort':'minimal'} if provider=='gemini' else {'enabled':False}


def load_config(root):
    path = root / "data/config.json"
    require(path.exists(), "Missing data/config.json. Run: python3 scripts/bifrost_setup.py init")
    return json.loads(path.read_text())


def configure_gemini(root):
    env=environment(root)
    require(env.get('GEMINI_API_KEY'), 'Missing GEMINI_API_KEY (server-side only).')
    require(env.get('CASPY_GEMINI_FREE_TIER_CONFIRMED')=='true',
            'Confirm a Gemini free-tier project without billing using CASPY_GEMINI_FREE_TIER_CONFIRMED=true.')
    config=load_config(root)
    config.setdefault('providers',{})['gemini']={
        'keys':[{'name':'caspy-gemini-key','value':'env.GEMINI_API_KEY','weight':1,'models':sorted(GEMINI_FREE_MODELS)}],
        'network_config':{'default_request_timeout_in_seconds':60,'max_retries':0},
    }
    gov=config['governance']
    for key in gov['virtual_keys']:
        if key['id'] in GEMINI_AGENT_MODELS:
            key['provider_configs']=[{'provider':'gemini','allowed_models':list(GEMINI_AGENT_MODELS[key['id']]),'key_ids':['*']}]
    for rule in gov['routing_rules']:
        if rule.get('scope')=='virtual_key' and rule.get('scope_id') in GEMINI_AGENT_MODELS:
            primary,fallback=GEMINI_AGENT_MODELS[rule['scope_id']]
            rule['targets']=[{'provider':'gemini','model':primary,'weight':1}]
            rule['fallbacks']=['gemini/'+fallback]
    for model in gov['model_configs']:
        if model.get('scope','global')=='global' and model.get('model_name')=='*' and model.get('provider')=='openrouter':
            # Keep stable row IDs/budget ownership when switching the provider.
            model['provider']='gemini'
    validate(config,env)
    target=root/'data/config.json'
    backup=target.with_name('config.before-gemini.'+secrets.token_hex(6)+'.json')
    private_write(backup,target.read_text())
    private_write(target,json.dumps(config,indent=2)+'\n')
    print('Gemini text routes configured; previous configuration backed up. Credentials hidden; billing unchanged.')


def route(config, key_id):
    rules = [rule for rule in config["governance"].get("routing_rules", [])
             if rule.get("scope") == "virtual_key" and rule.get("scope_id") == key_id
             and rule.get("enabled", True)]
    require(len(rules) == 1, f"Expected one enabled route for {key_id}.")
    rule = rules[0]
    require(rule.get("cel_expression") == "true", f"{key_id} route must cover every request.")
    require(len(rule.get("targets", [])) == 1, f"Expected one primary target for {key_id}.")
    target = rule["targets"][0]
    require(target.get("weight") == 1, f"Primary routing weight must be 1 for {key_id}.")
    models = [(target["provider"], target["model"])]
    for fallback in rule.get("fallbacks", []):
        require(isinstance(fallback, str) and "/" in fallback, "Use provider/model fallback strings.")
        models.append(tuple(fallback.split("/", 1)))
    require(len(models) >= 2, f"Missing fallback for {key_id}.")
    return models


def validate(config, env):
    client = config.get("client", {})
    require(client.get("enforce_auth_on_inference") is True, "Inference authentication must be enabled.")
    require("*" not in client.get("allowed_origins", []), "Use explicit dashboard origins.")
    gov = config.get("governance", {})
    auth = gov.get("auth_config", {})
    require(auth.get("is_enabled") is True, "Dashboard authentication must be enabled.")
    require(not auth.get("disable_auth_on_inference"), "Remove the inference auth bypass.")
    for field in ["admin_username", "admin_password"]:
        require(resolve(auth.get(field), env), f"Missing dashboard {field}.")
    require(env.get("BIFROST_SETUP_TOKEN"), "Missing BIFROST_SETUP_TOKEN. Run the initializer.")
    keys = {key["id"]: key for key in gov.get("virtual_keys", [])}
    teams = {team["id"] for team in gov.get("teams", [])}
    rate_limits = {limit["id"]: limit for limit in gov.get("rate_limits", [])}
    budgets = gov.get("budgets", [])
    active_providers={provider for key_id in AGENTS for provider,_ in route(config,key_id)}
    for provider in active_providers:
        global_configs = {row['id'] for row in gov.get('model_configs', [])
                          if row.get('scope','global')=='global' and row.get('model_name')=='*' and row.get('provider','openrouter')==provider}
        global_windows={budget['reset_duration'] for budget in budgets if budget.get('model_config_id') in global_configs}
        require({'1h','1d'} <= global_windows, 'Shared global model limits need both hourly and daily budgets for '+provider+'.')
    for budget in budgets:
        owners = [field for field in ["team_id", "virtual_key_id", "provider_config_id",
                  "customer_id", "model_config_id"] if budget.get(field) is not None]
        require(len(owners) == 1, f"Budget {budget['id']} must have exactly one owner.")
        require(budget.get("max_limit", 0) > 0, f"Budget {budget['id']} must be positive.")
    tokens, agent_models = [], []
    for key_id in AGENTS:
        key = keys.get(key_id)
        require(key and key.get("is_active", True), f"Missing active virtual key {key_id}.")
        require(key.get("team_id") in teams, f"{key_id} needs a shared budget team.")
        require(not key.get("allow_all_providers"), f"{key_id} must restrict providers.")
        token = resolve(key.get("value"), env)
        require(isinstance(token, str) and token.startswith("sk-bf-") and len(token) >= 32,
                f"{key_id} needs a secret token starting sk-bf- (at least 32 characters).")
        tokens.append(token)
        require(any(b.get("virtual_key_id") == key_id for b in budgets), f"{key_id} needs its own budget.")
        limit = rate_limits.get(key.get("rate_limit_id"), {})
        require(limit.get("request_max_limit", 0) > 0, f"{key_id} needs a request rate limit.")
        providers = {p["provider"]: p for p in key.get("provider_configs", [])}
        def model_allowed(provider,model):
            if provider=='openrouter': return isinstance(model,str) and model.endswith(':free')
            if provider=='gemini':
                require(env.get('CASPY_GEMINI_FREE_TIER_CONFIRMED')=='true', 'Missing Gemini free-tier confirmation; do not enable billing automatically.')
                return model in GEMINI_FREE_MODELS
            return False
        for provider, allowed in providers.items():
            require(all(model_allowed(provider,model) for model in allowed.get('allowed_models',[])),
                    f'{key_id}: only explicit free OpenRouter models or approved free-tier Gemini text models are allowed.')
        models = route(config, key_id)
        for provider, model in models:
            require(model_allowed(provider,model), f'{key_id}: primary and fallback routes must use free OpenRouter models or approved free-tier Gemini text models.')
            allowed = providers.get(provider, {})
            require(model in allowed.get("allowed_models", []) and "*" not in allowed["allowed_models"],
                    f"{key_id}: route model must be explicitly allowed for {provider}.")
            require(allowed.get("key_ids"), f"{key_id}: missing key selection for {provider}.")
            provider_keys = config.get("providers", {}).get(provider, {}).get("keys", [])
            require(provider_keys, f"Missing provider keys for {provider}.")
            for provider_key in provider_keys:
                require(resolve(provider_key.get("value"), env), f"Missing credential for {provider}.")
        agent_models.append({model for _, model in models})
    require(keys[AGENTS[0]]["team_id"] == keys[AGENTS[1]]["team_id"], "Actor and judge must share team caps.")
    require(tokens[0] != tokens[1], "Actor and judge credentials must be different.")
    require(agent_models[0].isdisjoint(agent_models[1]), "Actor and judge must use different models, including fallbacks.")


def check(root):
    config, env = load_config(root), environment(root)
    validate(config, env)
    print("Configuration OK: admin/inference auth, scoped keys, owned budgets, rate limits, and distinct agent routes.")
    return config, env


def validate_verdict(value):
    require(isinstance(value, dict) and set(value) == set(VERDICT_SCHEMA["required"]), "Invalid judge fields.")
    for name in ["verdict", "category"]:
        require(value[name] in VERDICT_SCHEMA["properties"][name]["enum"], f"Invalid judge {name}.")
    confidence = value["confidence"]
    require(type(confidence) in (int, float) and math.isfinite(confidence) and 0 <= confidence <= 1,
            "Invalid judge confidence.")
    require(type(value["exploit_flag"]) is bool, "Invalid judge exploit_flag.")
    require(isinstance(value["reason"], str) and len(value["reason"]) <= 200, "Invalid judge reason.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def smoke(root, inference=False):
    config, env = check(root)
    # Keep bearer credentials on loopback; bypass proxies and refuse redirects.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def send(path, body=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["x-bf-vk"] = token
        req = urllib.request.Request("http://127.0.0.1:8080" + path,
                                     data=None if body is None else json.dumps(body).encode(), headers=headers)
        return opener.open(req, timeout=90)

    with send("/health") as response:
        require(json.load(response).get("status") == "ok", "Gateway health check failed.")
    actor = route(config, AGENTS[0])[0]
    probe = {"model": "/".join(actor), "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 1}
    try:
        with send("/v1/chat/completions", probe):
            pass
    except urllib.error.HTTPError as error:
        require(error.code in (401, 403), f"Anonymous probe returned unexpected HTTP {error.code} (body hidden).")
    else:
        raise SetupError("Unauthenticated inference was accepted. Check the running gateway's auth settings.")
    print("Gateway health OK; anonymous inference rejected.")
    if not inference:
        print("Use smoke --inference for two configured free-tier text calls (actor stream + strict JSON judge).")
        return
    keys = {key["id"]: key for key in config["governance"]["virtual_keys"]}
    probe.update(stream=True, max_tokens=1024, temperature=0.8, reasoning=reasoning_options(actor[0]),
                 messages=[{"role": "system", "content": "You are Caspy, a cute ghost guarding candy. Reply in one short sentence. No tools."},
                           {"role": "user", "content": "Hello Caspy!"}])
    content, done = "", False
    with send("/v1/chat/completions", probe, resolve(keys[AGENTS[0]]["value"], env)) as response:
        for raw in response:
            line = raw.decode("utf-8").strip()
            if line == "data: [DONE]":
                done = True
                break
            if line.startswith("data: "):
                chunk = json.loads(line[6:])
                require("error" not in chunk, "Actor stream returned an error (details hidden).")
                for choice in chunk.get("choices", []):
                    content += choice.get("delta", {}).get("content") or ""
    require(done and content.strip(), "Actor stream was empty or incomplete.")
    print("Actor streaming OK.")
    judge = route(config, AGENTS[1])[0]
    body = {
        "model": "/".join(judge), "temperature": 0, "max_tokens": 1024,
        "reasoning": reasoning_options(judge[0]),
        "messages": [{"role": "system", "content": "Connectivity test only. Return NO_YIELD, confidence 1, category other, exploit_flag false, reason 'smoke test'. No tools."},
                     {"role": "user", "content": "Return the test verdict as JSON."}],
        "response_format": {"type": "json_schema", "json_schema": {
            "name": "caspy_verdict", "strict": True, "schema": VERDICT_SCHEMA
        }},
    }
    with send("/v1/chat/completions", body, resolve(keys[AGENTS[1]]["value"], env)) as response:
        result = json.load(response)
    validate_verdict(json.loads(result["choices"][0]["message"]["content"]))
    print("Judge strict JSON OK. This test does not finalize a game or authorize a mint.")


def main(argv=None, root=ROOT):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Generate missing credentials and local config")
    init.add_argument("--update-config", action="store_true", help="Back up and replace existing config with the template")
    commands.add_parser("check", help="Validate local setup without network or provider calls")
    commands.add_parser('use-gemini',help='Configure distinct free-tier Gemini actor/judge text routes; preserve database/auth/budgets.')
    commands.add_parser("run", help="Validate and start Bifrost on 127.0.0.1:8080")
    test = commands.add_parser("smoke", help="Check a gateway you have already started")
    test.add_argument("--inference", action="store_true", help="Also test actor and judge using the configured free-tier text provider")
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            initialize(root, args.update_config)
        elif args.command == "check":
            check(root)
        elif args.command == 'use-gemini':
            configure_gemini(root)
        elif args.command == "smoke":
            smoke(root, args.inference)
        else:
            _, env = check(root)
            binary = shutil.which("bifrost", path=env.get("PATH"))
            require(binary, "Bifrost executable not found. Install @maximhq/bifrost first.")
            os.chdir(root)
            os.execve(binary, [binary, "--app-dir", str(root / "data"), "--host", "127.0.0.1",
                              "--port", "8080", "--log-style", "json", "--log-level", "info"], env)
    except SetupError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except urllib.error.HTTPError as error:
        print(f"Error: gateway returned HTTP {error.code} (body hidden).", file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print("Error: could not read configuration or gateway response (details hidden). Check local files and gateway availability.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
