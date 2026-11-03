"""Offline FLUX.1-schnell adapter for Apple Silicon. Never falls back to paid APIs."""
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
MODEL='black-forest-labs/FLUX.1-schnell'
CHECKPOINT='mflux-community/flux-1-schnell-mflux-q4'
REVISION='df1dada0a0e25bb8df6e1f7e4664959bf9ab86ce'
MODEL_PATH=ROOT/'data/flux/model'
READY=ROOT/'data/flux/ready.json'
CLI=ROOT/'.venv-flux/bin/mflux-generate'

class LocalSchnell:
    model=MODEL
    provider='local-mlx'
    local=True
    @property
    def configured(self):
        try:
            ready=json.loads(READY.read_text())
            complete=bool(ready.get('files')) and all((MODEL_PATH/item['path']).is_file() and (MODEL_PATH/item['path']).stat().st_size==item['size'] for item in ready['files'])
            return platform.system()=='Darwin' and platform.machine()=='arm64' and CLI.is_file() and ready.get('revision')==REVISION and (MODEL_PATH/'manifest.json').is_file() and complete
        except (OSError,ValueError,KeyError,TypeError): return False

    def render(self,prompt,seed,target):
        if not self.configured: raise RuntimeError('local_configuration')
        # Neither the prompt nor credentials are passed to a remote image API.
        env={**os.environ,'HF_HOME':str(ROOT/'data/flux/hf'),'HF_HUB_OFFLINE':'1',
             'TRANSFORMERS_OFFLINE':'1','HF_HUB_DISABLE_TELEMETRY':'1','DO_NOT_TRACK':'1',
             'MFLUX_CACHE_DIR':str(ROOT/'data/flux/cache')}
        for key in list(env):
            if any(word in key.upper() for word in ('TOKEN','PASSWORD','KEY','SECRET','CREDENTIAL')): env.pop(key)
        with tempfile.TemporaryDirectory(dir=ROOT/'data/flux') as folder:
            source=Path(folder)/'prompt.txt';source.write_text(prompt)
            generated=Path(folder)/'candy.png'
            command=[str(CLI),'--model',str(MODEL_PATH),'--base-model','schnell','--steps','4',
                     '--width','512','--height','512','--seed',str(seed),'--prompt-file',str(source),
                     '--output',str(generated),'--low-ram','--mlx-cache-limit-gb','0.5']
            try: result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=1200)
            except subprocess.TimeoutExpired: raise RuntimeError('local_timeout') from None
            if result.returncode or not generated.is_file():
                # QA logging is opt-in and used only with the fixed fictional sample.
                # Production jobs never persist provider/worker error bodies.
                if os.environ.get('CASPY_LOCAL_QA_LOG')=='1':
                    log=ROOT/'data/qa/local-schnell-worker-error.log'
                    log.write_text((getattr(result,'stderr','')+'\n'+getattr(result,'stdout',''))[-20000:])
                    log.chmod(0o600)
                raise RuntimeError('local_generation')
            # Strip model prompt metadata before storing the public image.
            cleaned=subprocess.run([str(CLI.parent/'python'),str(ROOT/'scripts/normalize_candy_image.py'),str(generated),str(target)],
                                   env=env,capture_output=True,text=True,timeout=30)
            if cleaned.returncode or not Path(target).is_file(): raise RuntimeError('invalid_image')
        return {'ok':True,'model':self.model,'provider':self.provider,'steps':4,'width':512,'height':512,
                'guidance_scale':None,'quantization_bits':4,'checkpoint':CHECKPOINT,'revision':REVISION,
                'safety_checker':False,'content_controls':'win gate and candy-only art direction; no local image safety classifier','runtime':'mflux-0.24.0',
                'prompt_processing':'local-offline'}
