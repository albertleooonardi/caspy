"""CI deployment to the user-selected Codespace using a scoped GH_TOKEN.

Only the reviewed main commit is checked out. Existing private .env/data stay
untracked. Credentials are read by gh; no token is placed in command arguments.
"""
import json
import os
import re
import shlex
import subprocess
import sys


def main():
    name=os.environ.get('CASPY_CODESPACE_NAME','')
    commit=os.environ.get('RELEASE_SHA','')
    repo=os.environ.get('GITHUB_REPOSITORY','albertleooonardi/caspy')
    if not re.fullmatch(r'[a-zA-Z0-9-]+',name) or not re.fullmatch(r'[0-9a-f]{40}',commit):
        raise RuntimeError('Configure a valid Codespace name and exact release SHA.')
    info=json.loads(subprocess.check_output(['gh','api','/user/codespaces/'+name],text=True))
    if info['repository']['full_name']!=repo: raise RuntimeError('Codespace belongs to a different repository.')
    folder='/workspaces/'+repo.split('/')[1]
    command='set -eu; cd '+shlex.quote(folder)+'; '
    command+='test -z "$(git status --porcelain --untracked-files=no)"; '
    command+='git fetch --no-tags origin '+shlex.quote(commit)+'; git checkout --detach '+shlex.quote(commit)+'; '
    command+='python3 scripts/codespace_release.py '+shlex.quote(commit)
    subprocess.run(['gh','codespace','ssh','--codespace',name,'--',command],check=True)


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Codespace release failed; inspect its source, authorization and private log.',file=sys.stderr)
        sys.exit(1)
