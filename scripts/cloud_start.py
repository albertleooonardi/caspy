"""Container supervisor: private Bifrost and the public Caspy API.

One replica required. Game snapshots/artwork persist in private PostgreSQL.
Does not deploy contracts, fund accounts, copy local data or enable paid AI.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

from bifrost_setup import ROOT, environment, private_write, check
from database import database_url
from runtime_config import server_settings


def prepare(env):
    settings = server_settings(env)
    if not settings['production'] or env.get('CASPY_NFT_ENABLED') != 'true':
        raise ValueError('Cloud startup requires production mode and full NFT gameplay.')
    if env.get('CASPY_IMAGE_BACKEND') not in ('hf-space-schnell', 'hf-dev'):
        raise ValueError('Choose a cloud-compatible image backend.')
    database_url(env)
    for name in ('BIFROST_SETUP_TOKEN', 'BIFROST_ADMIN_PASSWORD', 'BIFROST_CASPY_VK', 'BIFROST_JUDGE_VK', 'OPEN_ROUTER_API_KEY', 'CASPY_NFT_SIGNER_PRIVATE_KEY'):
        if not env.get(name): raise ValueError('Missing server environment variable: ' + name)
    data=ROOT/'data'
    data.mkdir(parents=True,exist_ok=True)
    target=Path(env.get('CASPY_NFT_CONFIG',str(data/'nft-sepolia.json')))
    if env.get('CASPY_NFT_CONFIG_JSON'):
        config=json.loads(env['CASPY_NFT_CONFIG_JSON'])
        if config.get('chain_id')!=84532: raise ValueError('Only Base Sepolia is supported for the public preview.')
        private_write(target,json.dumps(config))
    if not target.is_file(): raise ValueError('Supply confirmed CASPY_NFT_CONFIG_JSON for Base Sepolia.')
    config=json.loads(target.read_text())
    if config.get('chain_id')!=84532: raise ValueError('Do not expose the local Anvil configuration.')
    if not (data/'config.json').exists():
        private_write(data/'config.json',(ROOT/'bifrost.config.example.json').read_text())
    check(ROOT)


def main():
    env=environment(ROOT)
    prepare(env)
    subprocess.run([sys.executable,str(ROOT/'scripts/check_supabase.py')],env=env,check=True)
    children=[]
    stopping=False
    def stop(*_):
        nonlocal stopping
        stopping=True
        for child in children:
            if child.poll() is None: child.terminate()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        children.append(subprocess.Popen(['bifrost','--app-dir',str(ROOT/'data'),'--host','127.0.0.1','--port','8080','--log-style','json','--log-level','warn'],env=env))
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(120):
            if stopping or children[0].poll() is not None: raise RuntimeError('Gateway stopped during startup.')
            try:
                with opener.open('http://127.0.0.1:8080/health',timeout=1) as response:
                    if json.load(response).get('status')=='ok': break
            except (OSError,ValueError): pass
            time.sleep(1)
        else: raise RuntimeError('Gateway readiness timed out.')
        children.append(subprocess.Popen([sys.executable,str(ROOT/'scripts/heist_api.py')],env=env))
        while not stopping:
            if any(child.poll() is not None for child in children): raise RuntimeError('A required service exited.')
            time.sleep(1)
    finally:
        stop()
        for child in children:
            try: child.wait(timeout=30)
            except subprocess.TimeoutExpired: child.kill();child.wait()


if __name__=='__main__':
    try: main()
    except Exception as error:
        # Provider/DB errors can contain credentials; do not echo their bodies.
        print(str(error) if isinstance(error,ValueError) and not isinstance(error,json.JSONDecodeError) else 'Cloud startup failed. Check required variables, Supabase and confirmed testnet configuration; details hidden.',file=sys.stderr)
        sys.exit(1)
