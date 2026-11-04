#!/usr/bin/env python3
"""One offline visual QA sample. This never creates a game win, voucher or NFT."""
import hashlib
import json
from pathlib import Path
import time
from candy_art import candy_prompt,STYLE_VERSION
from local_flux import LocalSchnell,ROOT

def main():
    folder=ROOT/'data/qa';folder.mkdir(parents=True,exist_ok=True)
    output=folder/f'caspy-schnell-candy-{STYLE_VERSION}.png'
    if output.exists():
        print('The current local QA sample already exists: '+str(output.relative_to(ROOT)));return
    renderer=LocalSchnell()
    if not renderer.configured: raise SystemExit('Local model is not ready. Run bash scripts/shell/setup-flux.sh first.')
    source='A lemon-drop lighthouse guides three lost ghosts home. Its warm sugar windows glow above a sea of moonbeam cookies.'
    started=time.monotonic()
    print('Rendering one local Caspy-style candy QA sample. This may take several minutes on an 8 GB Mac.',flush=True)
    try:
        report=renderer.render(candy_prompt(source,'A'),21873,output)
        report.update({'purpose':'non-mintable visual QA sample, not a game reward','art_style':STYLE_VERSION,
                       'elapsed_seconds':round(time.monotonic()-started,2),'image_sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
    except RuntimeError as error:
        code=str(error) if str(error) in ('local_configuration','local_generation','local_timeout','invalid_image') else 'local_generation'
        report={'ok':False,'kind':code,'elapsed_seconds':round(time.monotonic()-started,2),'purpose':'visual QA only'}
    (folder/f'local-schnell-qa-{STYLE_VERSION}.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    if not report.get('ok'): raise SystemExit(1)
    print('Preview: '+str(output.relative_to(ROOT)))

if __name__=='__main__': main()
