#!/usr/bin/env python3
"""Download only the pinned ~9 GiB pre-quantized Schnell model, never full weights."""
import json
import shutil
from local_flux import CHECKPOINT,REVISION,MODEL_PATH,READY,ROOT

def main():
    from huggingface_hub import snapshot_download
    MODEL_PATH.mkdir(parents=True,exist_ok=True)
    if READY.exists():
        try:
            saved=json.loads(READY.read_text())
            valid=saved.get('revision')==REVISION and saved.get('files') and all((MODEL_PATH/item['path']).is_file() and (MODEL_PATH/item['path']).stat().st_size==item['size'] for item in saved['files'])
            if valid:
                print('Local Schnell model is already prepared.');return
        except (OSError,ValueError,KeyError): pass
    if shutil.disk_usage(ROOT).free<12*1024**3: raise SystemExit('At least 12 GiB free space is required for the local checkpoint.')
    print('Downloading the pinned 4-bit FLUX.1-schnell checkpoint (~9 GiB). No inference credits are used.',flush=True)
    snapshot_download(repo_id=CHECKPOINT,revision=REVISION,local_dir=MODEL_PATH,
                      cache_dir=ROOT/'data/flux/hf',max_workers=2,
                      allow_patterns=['*.json','*.safetensors'])
    files=[{'path':str(path.relative_to(MODEL_PATH)),'size':path.stat().st_size} for path in MODEL_PATH.rglob('*') if path.is_file() and '.cache' not in path.parts]
    temporary=READY.with_suffix('.tmp')
    temporary.write_text(json.dumps({'model':CHECKPOINT,'revision':REVISION,'quantization_bits':4,'files':files},indent=2)+'\n')
    temporary.replace(READY)
    print('Local Schnell is prepared. Prompts will be processed offline on this Mac.')

if __name__=='__main__': main()
