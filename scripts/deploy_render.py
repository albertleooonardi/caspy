"""CI-only exact-commit Render deployment; never prints credentials/error bodies."""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit


def main():
    token=os.environ.get('RENDER_API_KEY','')
    service=os.environ.get('RENDER_SERVICE_ID','')
    commit=os.environ.get('RELEASE_SHA','')
    backend=os.environ.get('CASPY_BACKEND_URL','').rstrip('/')
    if not token or not re.fullmatch(r'srv-[a-zA-Z0-9]+',service) or not re.fullmatch(r'[0-9a-f]{40}',commit):
        raise RuntimeError('Configure protected Render credentials, service ID and release commit.')
    url=urlsplit(backend)
    if url.scheme!='https' or not url.hostname or url.path or url.username or url.password or url.query or url.fragment:
        raise RuntimeError('Configure the HTTPS backend origin.')
    def api(path,body=None):
        request=urllib.request.Request('https://api.render.com/v1/services/'+service+path,
            data=None if body is None else json.dumps(body).encode(),
            headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        with urllib.request.urlopen(request,timeout=30) as response: return json.load(response)
    deployment=api('/deploys',{'commitId':commit,'clearCache':'do_not_clear'})
    ident=deployment.get('deploy',deployment).get('id','')
    if not re.fullmatch(r'dep-[a-zA-Z0-9]+',ident): raise RuntimeError('Render did not return a deployment ID.')
    print('Render accepted deployment '+ident)
    deadline=time.monotonic()+1800
    previous=None
    while time.monotonic()<deadline:
        deployment=api('/deploys/'+ident);deployment=deployment.get('deploy',deployment)
        state=deployment.get('status')
        if state!=previous: print('Render status: '+str(state));previous=state
        if state=='live': break
        if state in ('build_failed','update_failed','pre_deploy_failed','canceled','deactivated'):
            raise RuntimeError('Render deployment failed; inspect its build/runtime logs.')
        time.sleep(10)
    else: raise RuntimeError('Timed out waiting for Render to become live.')
    with urllib.request.urlopen(backend+'/health',timeout=90) as response: health=json.load(response)
    if health.get('status')!='ok' or health.get('chain_id')!=84532 or health.get('commit')!=commit:
        raise RuntimeError('Live backend does not match the tested Base Sepolia release.')
    print('Confirmed the exact backend commit and Base Sepolia readiness.')


if __name__=='__main__':
    try: main()
    except urllib.error.HTTPError as error:
        print('Deployment API returned HTTP '+str(error.code)+' (body hidden).',file=sys.stderr);sys.exit(1)
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Deployment check failed (details hidden).',file=sys.stderr);sys.exit(1)
