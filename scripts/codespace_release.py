"""Start this exact reviewed release inside its Codespace. No keepalive loop.

The process can stop with Codespaces idle timeout/quota. It is a demo, not an
always-on production service. Never starts Anvil or publishes Bifrost's port.
"""
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]


def main():
    if os.environ.get('CODESPACES')!='true': raise RuntimeError('Run only in the selected Codespace.')
    commit=sys.argv[1] if len(sys.argv)==2 else ''
    actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if not re.fullmatch(r'[0-9a-f]{40}',commit) or commit!=actual: raise RuntimeError('Release source does not match the requested commit.')
    if not (ROOT/'.env').is_file(): raise RuntimeError('Configure the private backend environment first.')
    from bifrost_setup import environment
    env=environment(ROOT)
    if not env.get('CASPY_NFT_CONFIG_JSON') and not (ROOT/'data/nft-sepolia.json').is_file():
        raise RuntimeError('Save the confirmed Base Sepolia contract configuration first.')
    pidfile=ROOT/'data/cloud-preview.pid'
    if pidfile.exists():
        pid=int(pidfile.read_text())
        proc=Path(f'/proc/{pid}/cmdline')
        if proc.is_file():
            command=proc.read_bytes()
            if b'scripts/cloud_start.py' not in command and b'scripts/shell/run-cloud-preview.sh' not in command:
                raise RuntimeError('Saved PID belongs to a different process; refusing to stop it.')
            os.kill(pid,signal.SIGTERM)
            for _ in range(35):
                if not proc.exists(): break
                time.sleep(1)
            else: raise RuntimeError('Existing preview has not stopped; inspect it before retrying.')
    probe=socket.socket();probe.settimeout(1)
    try:
        if probe.connect_ex(('127.0.0.1',8000))==0: raise RuntimeError('Port 8000 is occupied; no duplicate service was started.')
    finally: probe.close()
    folder=ROOT/'data';folder.mkdir(exist_ok=True)
    logpath=folder/'cloud-preview.log'
    fd=os.open(logpath,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
    runtime_env={key:value for key,value in os.environ.items() if key not in ('GH_TOKEN','GITHUB_TOKEN','CODESPACES_TOKEN')}
    with os.fdopen(fd,'ab') as log:
        child=subprocess.Popen(['bash',str(ROOT/'scripts/shell/run-cloud-preview.sh')],cwd=ROOT,
            env={**runtime_env,'CASPY_RELEASE_SHA':commit},stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    pidfile.write_text(str(child.pid));pidfile.chmod(0o600)
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(600):
        if child.poll() is not None: raise RuntimeError('Preview exited. Inspect private data/cloud-preview.log in the Codespace.')
        try:
            with opener.open('http://127.0.0.1:8000/health',timeout=2) as response: health=json.load(response)
            if health.get('status')=='ok' and health.get('chain_id')==84532 and health.get('commit')==commit:
                print('Codespaces Base Sepolia backend ready for commit '+commit);return
        except (OSError,ValueError): pass
        time.sleep(1)
    raise RuntimeError('Preview readiness timed out. Inspect its private log; no public port should be enabled yet.')


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Preview setup failed (details hidden).',file=sys.stderr)
        sys.exit(1)
