import copy
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import bifrost_setup as gateway


class GatewaySetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in [".env.example", "bifrost.config.example.json"]:
            shutil.copyfile(gateway.ROOT / name, self.root / name)
        self.original = (
            "# Keep my provider settings\n"
            "export GROQ_API_KEY='groq-test-value'\n"
            "OPEN_ROUTER_API_KEY=router-test-value\n"
            "BIFROST_TOKENS='legacy-setup-value'\n"
        )
        (self.root / ".env").write_text(self.original)
        self.env_patch = patch.dict(os.environ, {}, clear=True)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        self.output = io.StringIO()
        self.stdout_patch = patch("sys.stdout", self.output)
        self.stdout_patch.start()
        self.addCleanup(self.stdout_patch.stop)
        gateway.initialize(self.root)
        self.config = gateway.load_config(self.root)
        self.env = gateway.environment(self.root)

    def test_init_preserves_provider_keys_and_migrates_legacy_token_without_disclosure(self):
        contents = (self.root / ".env").read_text()
        self.assertTrue(contents.startswith(self.original))
        self.assertEqual(self.env["BIFROST_SETUP_TOKEN"], "legacy-setup-value")
        self.assertNotEqual(self.env["BIFROST_CASPY_VK"], self.env["BIFROST_JUDGE_VK"])
        for name in ["BIFROST_CASPY_VK", "BIFROST_JUDGE_VK"]:
            self.assertTrue(self.env[name].startswith("sk-bf-"))
        for secret in ["legacy-setup-value", "groq-test-value", self.env["BIFROST_ADMIN_PASSWORD"]]:
            self.assertNotIn(secret, self.output.getvalue())
        self.assertEqual((self.root / ".env").stat().st_mode & 0o777, 0o600)
        gateway.validate(self.config, self.env)

    def test_gemini_switch_preserves_auth_databases_budgets_and_distinct_models(self):
        before=copy.deepcopy(self.config)
        with patch.dict(os.environ,{'GEMINI_API_KEY':'gemini-test-credential','CASPY_GEMINI_FREE_TIER_CONFIRMED':'true'}):
            gateway.configure_gemini(self.root)
            config=gateway.load_config(self.root)
            env=gateway.environment(self.root)
            gateway.validate(config,env)
        for store in ('config_store','logs_store'): self.assertEqual(config[store],before[store])
        self.assertEqual(config['governance']['auth_config'],before['governance']['auth_config'])
        new_budgets = {row['id']: row for row in config['governance']['budgets']}
        for row in before['governance']['budgets']:
            self.assertEqual(new_budgets[row['id']], row)
        self.assertEqual(gateway.route(config, 'vk-caspy'), [
            ('gemini', 'gemini-3.5-flash-lite'),
            ('openrouter', 'nvidia/nemotron-3.5-lightning:free'),
        ])
        self.assertEqual(gateway.route(config, 'vk-judge'), [
            ('gemini', 'gemini-3.6-flash'), ('gemini', 'gemini-2.5-flash'),
        ])
        self.assertNotIn('openrouter', {
            row['provider'] for row in config['governance']['virtual_keys'][1]['provider_configs']
        })
        self.assertEqual(
            {row['reset_duration'] for row in new_budgets.values()
             if row.get('model_config_id') == 'caspy-global-openrouter-fallback'}, {'1h', '1d'}
        )
        self.assertEqual(config['providers']['gemini']['keys'][0]['value'],'env.GEMINI_API_KEY')
        self.assertTrue(list((self.root/'data').glob('config.before-gemini.*.json')))
        self.assertNotIn('gemini-test-credential',json.dumps(config)+self.output.getvalue())

    def test_gemini_requires_free_project_confirmation_and_rejects_unapproved_models(self):
        with patch.dict(os.environ,{'GEMINI_API_KEY':'gemini-test-credential'}):
            with self.assertRaisesRegex(gateway.SetupError,'free-tier project'):
                gateway.configure_gemini(self.root)
        self.assertEqual(gateway.load_config(self.root),self.config)
        with patch.dict(os.environ,{'GEMINI_API_KEY':'gemini-test-credential','CASPY_GEMINI_FREE_TIER_CONFIRMED':'true'}):
            gateway.configure_gemini(self.root)
            config=gateway.load_config(self.root);env=gateway.environment(self.root)
            config['governance']['virtual_keys'][0]['provider_configs'][0]['allowed_models'].append('imagen-4.0-generate-001')
            with self.assertRaisesRegex(gateway.SetupError,'approved free-tier Gemini text'):
                gateway.validate(config,env)

    def test_repeated_init_preserves_credentials_and_custom_config(self):
        env_before = (self.root / ".env").read_bytes()
        target = self.root / "data/config.json"
        target.write_text('{"custom": true}')
        gateway.initialize(self.root)
        self.assertEqual((self.root / ".env").read_bytes(), env_before)
        self.assertEqual(json.loads(target.read_text()), {"custom": True})

    def test_explicit_update_backs_up_config_and_preserves_existing_state(self):
        target = self.root / "data/config.json"
        before = target.read_bytes()
        state = self.root / "data/caspy-bifrost.db"
        state.write_bytes(b"existing database placeholder")
        gateway.initialize(self.root, update_config=True)
        backups = list(target.parent.glob("config.*.backup.json"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), before)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        self.assertEqual(state.read_bytes(), b"existing database placeholder")
        self.assertEqual(self.config["config_store"]["type"], "postgres")
        self.assertEqual(self.config["logs_store"]["type"], "postgres")
        self.assertNotIn("path", self.config["config_store"]["config"])

    def test_process_environment_overrides_file_without_rewriting_provider_key(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "process-value"}):
            self.assertEqual(gateway.environment(self.root)["GROQ_API_KEY"], "process-value")
        self.assertEqual(gateway.read_env(self.root / ".env")["GROQ_API_KEY"], "groq-test-value")

    def test_dotenv_values_are_data_not_executed(self):
        path = self.root / "literal.env"
        marker = self.root / "must-not-exist"
        path.write_text(f"SECRET='$(touch {marker})' # comment\nEMPTY=\n")
        self.assertEqual(gateway.read_env(path)["SECRET"], f"$(touch {marker})")
        self.assertFalse(marker.exists())

    def test_unsafe_configurations_are_rejected(self):
        mutations = [
            (lambda c: c["client"].update(enforce_auth_on_inference=False), "authentication"),
            (lambda c: c["client"].update(allowed_origins=["*"]), "origins"),
            (lambda c: c["governance"]["budgets"][2].pop("virtual_key_id"), "exactly one owner"),
            (lambda c: c["governance"]["budgets"].pop(1), "hourly and daily"),
            (lambda c: c["governance"]["virtual_keys"][0]["provider_configs"][0].update(allowed_models=["*"]), "free OpenRouter"),
            (lambda c: c["governance"]["virtual_keys"][0]["provider_configs"][0].update(key_ids=[]), "key selection"),
            (lambda c: c["governance"]["virtual_keys"][0].update(is_active=False), "active virtual key"),
            (lambda c: c["governance"]["routing_rules"][0].update(fallbacks=[]), "Missing fallback"),
            (lambda c: c["governance"]["routing_rules"][0].update(cel_expression="false"), "every request"),
            (lambda c: c["governance"]["virtual_keys"][1].update(value="env.BIFROST_CASPY_VK"), "must be different"),
        ]
        for mutate, message in mutations:
            with self.subTest(message=message):
                config = copy.deepcopy(self.config)
                mutate(config)
                with self.assertRaisesRegex(gateway.SetupError, message):
                    gateway.validate(config, self.env)

    def test_missing_provider_credential_reports_only_variable_name(self):
        self.env.pop("OPEN_ROUTER_API_KEY")
        with self.assertRaisesRegex(gateway.SetupError, "Missing OPEN_ROUTER_API_KEY"):
            gateway.validate(self.config, self.env)

    def test_same_actor_and_judge_model_is_rejected_even_on_fallback(self):
        gov = self.config["governance"]
        actor_model = gov["routing_rules"][0]["targets"][0]["model"]
        gov["routing_rules"][1]["fallbacks"] = ["openrouter/" + actor_model]
        gov["virtual_keys"][1]["provider_configs"][0]["allowed_models"].append(actor_model)
        with self.assertRaisesRegex(gateway.SetupError, "different models"):
            gateway.validate(self.config, self.env)

    def test_paid_routes_and_paid_allowlist_entries_are_rejected(self):
        for field in ["targets", "fallbacks", "allowlist"]:
            with self.subTest(field=field):
                config = copy.deepcopy(self.config)
                if field == "targets":
                    config["governance"]["routing_rules"][0]["targets"][0]["model"] = "openai/gpt-4o"
                elif field == "fallbacks":
                    config["governance"]["routing_rules"][0]["fallbacks"] = ["openrouter/openai/gpt-4o"]
                else:
                    config["governance"]["virtual_keys"][0]["provider_configs"][0]["allowed_models"].append("openai/gpt-4o")
                with self.assertRaisesRegex(gateway.SetupError, "free OpenRouter"):
                    gateway.validate(config, self.env)

    def test_run_uses_absolute_app_directory_and_loopback_without_starting_gateway(self):
        with patch.object(gateway.shutil, "which", return_value="/test/bifrost"), \
             patch.object(gateway.os, "chdir") as chdir, \
             patch.object(gateway.os, "execve") as execute:
            self.assertEqual(gateway.main(["run"], root=self.root), 0)
        chdir.assert_called_once_with(self.root)
        binary, args, env = execute.call_args.args
        self.assertEqual(binary, "/test/bifrost")
        self.assertEqual(args[args.index("--app-dir") + 1], str(self.root / "data"))
        self.assertEqual(args[args.index("--host") + 1], "127.0.0.1")
        self.assertEqual(env["BIFROST_SETUP_TOKEN"], "legacy-setup-value")

    def test_smoke_checks_stream_and_schema_using_different_bearer_tokens(self):
        verdict = {"verdict": "NO_YIELD", "confidence": 1, "category": "other",
                   "exploit_flag": False, "reason": "smoke test"}
        judge = {"choices": [{"message": {"content": json.dumps(verdict)}}]}
        actor = b'data: {"choices":[{"delta":{"content":"Boo!"}}]}\n\ndata: [DONE]\n\n'
        denied = urllib.error.HTTPError("http://127.0.0.1:8080/v1/chat/completions", 401,
                                        "Unauthorized", {}, None)
        with patch.object(gateway.urllib.request, "build_opener") as build:
            opener = build.return_value
            opener.open.side_effect = [io.BytesIO(b'{"status":"ok"}'), denied,
                                       io.BytesIO(actor), io.BytesIO(json.dumps(judge).encode())]
            gateway.smoke(self.root, inference=True)
        requests = [call.args[0] for call in opener.open.call_args_list]
        self.assertIsNone(requests[1].get_header("X-bf-vk"))
        self.assertEqual(requests[2].get_header("X-bf-vk"), self.env["BIFROST_CASPY_VK"])
        self.assertEqual(requests[3].get_header("X-bf-vk"), self.env["BIFROST_JUDGE_VK"])
        self.assertTrue(json.loads(requests[2].data)["stream"])
        self.assertTrue(json.loads(requests[3].data)["response_format"]["json_schema"]["strict"])
        self.assertIn("Judge strict JSON OK", self.output.getvalue())

    def test_smoke_rejects_anonymous_access_before_authenticated_calls(self):
        with patch.object(gateway.urllib.request, "build_opener") as build:
            build.return_value.open.side_effect = [io.BytesIO(b'{"status":"ok"}'), io.BytesIO(b'{}')]
            with self.assertRaisesRegex(gateway.SetupError, "Unauthenticated inference"):
                gateway.smoke(self.root, inference=True)
            self.assertEqual(build.return_value.open.call_count, 2)

    def test_cloud_startup_applies_gemini_routes_once_when_confirmed(self):
        self.assertEqual(gateway.route(self.config, 'vk-judge')[0][0], 'openrouter')
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'gemini-test-credential', 'CASPY_GEMINI_FREE_TIER_CONFIRMED': 'true'}):
            summary = gateway.ensure_gemini_routes(self.root)
            backups = sorted(self.root.glob('data/config.before-gemini.*.json'))
            again = gateway.ensure_gemini_routes(self.root)
        config = gateway.load_config(self.root)
        self.assertEqual(gateway.route(config, 'vk-judge')[0], ('gemini', 'gemini-3.6-flash'))
        self.assertEqual(gateway.route(config, 'vk-caspy')[0], ('gemini', 'gemini-3.5-flash-lite'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(sorted(self.root.glob('data/config.before-gemini.*.json')), backups)
        self.assertIn('judge gemini/gemini-3.6-flash', summary)
        self.assertIn('actor fallback openrouter/nvidia/nemotron-3.5-lightning:free', summary)
        self.assertEqual(summary, again)
        self.assertNotIn('gemini-test-credential', self.output.getvalue() + summary)

    def test_gemini_route_starts_without_openrouter_credential(self):
        (self.root / '.env').write_text(
            (self.root / '.env').read_text().replace('OPEN_ROUTER_API_KEY=router-test-value\n', '')
        )
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'fixture', 'CASPY_GEMINI_FREE_TIER_CONFIRMED': 'true'}):
            gateway.configure_gemini(self.root)
            config, env = gateway.check(self.root)
        self.assertFalse(env.get('OPEN_ROUTER_API_KEY'))
        self.assertEqual(gateway.route(config, 'vk-caspy'), [
            ('gemini', 'gemini-3.5-flash-lite'), ('gemini', 'gemini-3.1-flash-lite'),
        ])

    def test_cloud_startup_keeps_and_reports_routes_without_gemini_confirmation(self):
        for extra, warned in [({}, False), ({'GEMINI_API_KEY': 'gemini-test-credential'}, True)]:
            with self.subTest(extra=extra), patch.dict(os.environ, extra):
                self.output.truncate(0); self.output.seek(0)
                summary = gateway.ensure_gemini_routes(self.root)
                self.assertEqual(gateway.route(gateway.load_config(self.root), 'vk-judge')[0][0], 'openrouter')
                self.assertIn('judge openrouter/', summary)
                self.assertEqual('CASPY_GEMINI_FREE_TIER_CONFIRMED' in self.output.getvalue(), warned)
                self.assertNotIn('gemini-test-credential', self.output.getvalue() + summary)

    def test_judge_validation_rejects_coercion_extra_fields_and_nonfinite_confidence(self):
        valid = {"verdict": "NO_YIELD", "confidence": 1, "category": "other",
                 "exploit_flag": False, "reason": "smoke test"}
        for change in [{"confidence": True}, {"confidence": float("nan")}, {"confidence": 1.1},
                       {"confidence": "0.9"}, {"exploit_flag": "false"}, {"reason": "x" * 201},
                       {"verdict": "win"}, {"mint": True}]:
            with self.subTest(change=change), self.assertRaises(gateway.SetupError):
                gateway.validate_verdict({**valid, **change})

    def test_judge_validation_rejects_category_that_contradicts_exploit_flag(self):
        valid = {"verdict": "YIELD", "confidence": 0.97, "category": "trade",
                 "exploit_flag": False, "reason": "fixture"}
        gateway.validate_verdict(valid)
        gateway.validate_verdict({**valid, "verdict": "NO_YIELD", "category": "exploit_attempt", "exploit_flag": True})
        # A flagged exploit may keep its tactic label for research; it can never win.
        gateway.validate_verdict({**valid, "verdict": "NO_YIELD", "exploit_flag": True})
        with self.assertRaisesRegex(gateway.SetupError, "contradicts"):
            gateway.validate_verdict({**valid, "category": "exploit_attempt"})


if __name__ == "__main__":
    unittest.main()
