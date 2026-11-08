"""Win-only, finite candy issuance and immutable FLUX artwork jobs.
No model has access to signing or trading. Image generation happens only after
an authenticated winner explicitly requests their one earned image.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from bifrost_setup import environment
from candy_rules import MODEL, normalized, score_prompt
from candy_art import STYLE_VERSION, candy_prompt
from local_flux import LocalSchnell
from space_schnell import SpaceSchnell
from runtime_config import public_origin
from platform_store import Fault, redact

ROOT=Path(__file__).resolve().parents[1]


class HostedFlux:
    model='black-forest-labs/FLUX.1-dev'
    provider='fal-ai'
    local=False
    @property
    def configured(self):
        return bool(environment(ROOT).get('HF_TOKEN'))

    def render(self,prompt,seed,target):
        env=environment(ROOT)
        python=ROOT/'.venv/bin/python'
        if not python.exists(): raise RuntimeError('configuration')
        try:
            result=subprocess.run([str(python),str(ROOT/'scripts/flux_worker.py')],
                input=json.dumps({'prompt':prompt,'seed':seed,'output':str(target)}),
                env={**os.environ,'HF_TOKEN':env.get('HF_TOKEN','')},capture_output=True,text=True,timeout=200)
        except subprocess.TimeoutExpired:
            raise RuntimeError('uncertain') from None
        try: report=json.loads(result.stdout)
        except ValueError: raise RuntimeError('provider') from None
        if result.returncode or not report.get('ok'): raise RuntimeError(report.get('kind','provider'))
        return report


class CandyStore:
    def __init__(self,platform,nft,root=None,renderer=None):
        self.platform,self.nft=platform,nft
        self.origin=public_origin(environment(ROOT))
        self.database_assets=environment(ROOT).get('CASPY_ASSET_STORAGE')=='postgres'
        self.root=Path(root or ROOT/'data/candy-assets');self.root.mkdir(parents=True,exist_ok=True)
        backend=environment(ROOT).get('CASPY_IMAGE_BACKEND','local-schnell')
        if backend not in ('local-schnell','hf-dev','hf-space-schnell'): raise ValueError('Choose CASPY_IMAGE_BACKEND=local-schnell, hf-space-schnell or hf-dev.')
        self.renderer=renderer or {'local-schnell':LocalSchnell,'hf-dev':HostedFlux,'hf-space-schnell':SpaceSchnell}[backend]()
        info=nft.call('info')
        self.cap=info['max_supply']
        self.multiple_rewards=info.get('version',2)>=3
        self.namespace=f"{nft.config['chain_id']}:{nft.config['contract'].lower()}:{nft.config['deployment_block_hash']}"
        self.pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='caspy-flux')
        self.progress_lock=threading.Lock()
        self.job_progress={}
        self.budget=max(1,min(1000,int(environment(ROOT).get('CASPY_FLUX_DAILY_LIMIT','10'))))
        with platform.db() as db:
            if self.database_assets:
                db.execute('CREATE TABLE IF NOT EXISTS candy_blobs(digest TEXT PRIMARY KEY,kind TEXT NOT NULL,content BYTEA NOT NULL)')
                if platform.database.postgres:
                    db.execute('ALTER TABLE candy_blobs ENABLE ROW LEVEL SECURITY')
                    db.execute('REVOKE ALL ON candy_blobs FROM anon, authenticated')
            db.executescript('''
            CREATE TABLE IF NOT EXISTS candy_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,namespace TEXT NOT NULL,
                wallet TEXT NOT NULL,prompt TEXT NOT NULL,prompt_hash TEXT NOT NULL,normalized TEXT NOT NULL,
                assessment TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,
                image_hash TEXT,metadata_hash TEXT,uri TEXT,seed INTEGER NOT NULL,created INTEGER NOT NULL,error TEXT,
                token_id TEXT);
            CREATE TABLE IF NOT EXISTS candy_attempts(job_id TEXT NOT NULL,created INTEGER NOT NULL);
            ''')
            if platform.database.postgres:
                # v2 keeps the wallet gate below; v3 keeps only the heist PK.
                # Preserve every existing job, grade and artwork commitment.
                db.execute('ALTER TABLE candy_jobs DROP CONSTRAINT IF EXISTS candy_jobs_namespace_wallet_key')
            # Never silently repeat a possibly billed request after a crash/restart.
            db.execute("UPDATE candy_jobs SET state='uncertain',error='A prior image request was interrupted. Retry explicitly; hosted requests may use provider credits again.' WHERE state='generating' AND namespace=?",(self.namespace,))

    def close(self): self.pool.shutdown(wait=True)

    def ensure_win(self,game,user,wallet):
        if game['status']!='won': return None
        ev=(game.get('evaluations') or [{}])[-1]
        if ev.get('verdict')!='YIELD' or ev.get('exploit_flag') or ev.get('category')=='exploit_attempt' or ev.get('confidence',0)<.8:
            raise Fault(409,'This heist has no eligible winning verdict.')
        prompt=redact(game['messages'][(ev['turn']-1)*2]['text']).strip()
        with self.platform.db() as db:
            existing=db.execute('SELECT * FROM candy_jobs WHERE id=?',(game['id'],)).fetchone()
            if existing:
                if existing['user_id']!=user['id'] or existing['namespace']!=self.namespace: raise Fault(403,'Candy belongs to another account or season.')
                return self.public(existing)
            if not self.multiple_rewards and db.execute('SELECT id FROM candy_jobs WHERE namespace=? AND wallet=?', (self.namespace,wallet.lower())).fetchone():
                raise Fault(409,'This legacy contract permits one candy per wallet. Multiple rewards require the new v3 season.')
            count=db.execute('SELECT count(*) FROM candy_jobs WHERE namespace=?',(self.namespace,)).fetchone()[0]
            if count>=self.cap: raise Fault(409,'This finite candy season is fully reserved. No image call or mint is made.')
            previous=[row[0] for row in db.execute('SELECT normalized FROM candy_jobs WHERE namespace=?',(self.namespace,))]
            assessment=score_prompt(prompt,ev.get('candy_scores'),previous)
            assessment.update({'judge_model':ev.get('judge_served'),'judge_rubric':ev.get('rubric_version')})
            digest=hashlib.sha256(prompt.encode()).hexdigest()
            seed=int.from_bytes(hashlib.sha256((self.namespace+'|'+digest).encode()).digest()[:4],'big') & 0x7fffffff
            try:
                db.execute('INSERT INTO candy_jobs(id,user_id,namespace,wallet,prompt,prompt_hash,normalized,assessment,state,seed,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    (game['id'],user['id'],self.namespace,wallet.lower(),prompt,digest,normalized(prompt),json.dumps(assessment),'earned',seed,int(time.time())))
            except Exception as error:
                if isinstance(error,self.platform.integrity_error): raise Fault(409,'This winning heist already has a candy reward. Refresh its saved status.') from None
                raise
            return self.public(db.execute('SELECT * FROM candy_jobs WHERE id=?',(game['id'],)).fetchone())

    def row(self,ident,user=None):
        with self.platform.db() as db: row=db.execute('SELECT * FROM candy_jobs WHERE id=? AND namespace=?',(ident,self.namespace)).fetchone()
        if not row or (user and row['user_id']!=user['id']): raise Fault(404,'Earned candy not found.')
        return row

    def public(self,row):
        assessment=json.loads(row['assessment'])
        state='needs_configuration' if row['state']=='earned' and not self.renderer.configured else row['state']
        with self.progress_lock: progress=dict(self.job_progress.get(row['id'],{}))
        generator={}
        if row['metadata_hash']:
            try: generator=json.loads(self.blob(row['metadata_hash'],'json')).get('generator',{})
            except (Fault,ValueError,KeyError): pass
        return {'session_id':row['id'],'state':state,'assessment':assessment,'attempts':row['attempts'],
                'image_url':f"/api/candy/images/{row['image_hash']}.png" if row['image_hash'] else None,
                'metadata_uri':row['uri'],'prompt_hash':'0x'+row['prompt_hash'],'error':row['error'],
                'generator_model':generator.get('model',getattr(self.renderer,'model',MODEL)),'generator_provider':generator.get('provider',getattr(self.renderer,'provider','unknown')),'generation_local':generator.get('provider')=='local-mlx' if generator else getattr(self.renderer,'local',False),'seed':row['seed'],'minted':bool(row['token_id']),'token_id':row['token_id'],
                'generation_phase':progress.get('phase','queued') if state=='generating' else state,'generation_started_at':progress.get('started_at')}

    def progress(self,ident,phase):
        with self.progress_lock:
            self.job_progress[ident]={'phase':phase,'started_at':self.job_progress.get(ident,{}).get('started_at',int(time.time()))}

    def generation_local(self,row=None):
        if row and row['metadata_hash']:
            try: return json.loads(self.blob(row['metadata_hash'],'json'))['generator']['provider']=='local-mlx'
            except (Fault,ValueError,KeyError): pass
        return getattr(self.renderer,'local',False)

    def generator_model(self,row=None):
        if row and row['metadata_hash']:
            try: return json.loads(self.blob(row['metadata_hash'],'json'))['generator']['model']
            except (Fault,ValueError,KeyError): pass
        return getattr(self.renderer,'model',MODEL)

    def config(self):
        with self.platform.db() as db:
            reserved=db.execute('SELECT count(*) FROM candy_jobs WHERE namespace=?',(self.namespace,)).fetchone()[0]
            used=db.execute('SELECT count(*) FROM candy_attempts WHERE created>=?',(int(time.time())//86400*86400,)).fetchone()[0]
        return {'enabled':True,'model':self.generator_model(),'provider':getattr(self.renderer,'provider','unknown'),'generation_local':getattr(self.renderer,'local',False),'configured':self.renderer.configured,'max_supply':self.cap,
                'reserved':reserved,'remaining':max(0,self.cap-reserved),'daily_image_limit':self.budget,'image_requests_today':used,
                'grades':[{'label':'C','minimum':0},{'label':'B','minimum':60},{'label':'A','minimum':75},{'label':'S','minimum':90}],
                'market':self.nft.config['market'],'contract':self.nft.config['contract']}

    def generate(self,ident,user,accept,retry=False):
        if accept is not True: raise Fault(400,'Confirm generating artwork from the redacted winning prompt.')
        row=self.row(ident,user)
        if row['state'] in ('ready','generating'): return self.public(row)
        if not self.renderer.configured:
            raise Fault(503,'Prepare local Schnell with bash scripts/shell/setup-flux.sh, then restart Caspy.' if getattr(self.renderer,'local',False) else 'Hosted FLUX requires HF_TOKEN and provider credits.')
        if row['state'] in ('failed','uncertain') and retry is not True: raise Fault(409,'Explicitly confirm a retry; local retries use compute and hosted retries may incur another charge.')
        with self.platform.db() as db:
            # Re-read under the transaction lock to prevent duplicate calls.
            row=db.execute('SELECT * FROM candy_jobs WHERE id=?',(ident,)).fetchone()
            if row['state'] in ('ready','generating'): return self.public(row)
            if row['attempts']>=3: raise Fault(429,'Image retry limit reached. No rerolls or further provider calls are allowed.')
            used=db.execute('SELECT count(*) FROM candy_attempts WHERE created>=?',(int(time.time())//86400*86400,)).fetchone()[0]
            if used>=self.budget: raise Fault(429,'The daily image-generation budget is exhausted. Your earned grade is saved.')
            db.execute("UPDATE candy_jobs SET state='generating',attempts=attempts+1,error=NULL WHERE id=?",(ident,))
            db.execute('INSERT INTO candy_attempts VALUES (?,?)',(ident,int(time.time())))
        self.progress(ident,'queued')
        self.pool.submit(self._run,ident)
        return self.public(self.row(ident,user))

    def _run(self,ident):
        row=self.row(ident);assessment=json.loads(row['assessment'])
        art_prompt=candy_prompt(row['prompt'],assessment['grade_label'])
        try:
            fd,name=tempfile.mkstemp(dir=self.root,suffix='.png');os.close(fd);target=Path(name)
            try:
                self.progress(ident,'connecting')
                render_progress=getattr(self.renderer,'render_with_progress',None)
                generated=render_progress(art_prompt,row['seed'],target,lambda phase:self.progress(ident,phase)) if render_progress else self.renderer.render(art_prompt,row['seed'],target)
                self.progress(ident,'saving')
                data=target.read_bytes()
                if not data.startswith(b'\x89PNG\r\n\x1a\n') or not 100<=len(data)<=15_000_000: raise RuntimeError('invalid_image')
                image_hash=hashlib.sha256(data).hexdigest()
                self._write(self.root/(image_hash+'.png'),data)
                manifest={'name':f"Caspy {assessment['grade_label']} Candy · {row['prompt_hash'][:8]}",
                    'description':'AI-generated candy earned by persuading Caspy. Grade is prompt-assessed, not randomly drawn. The source prompt is delivered only to the verified NFT owner.',
                    'image':f'{self.origin}/api/candy/images/{image_hash}.png','ai_generated':True,
                    'generator':{'model':generated.get('model',MODEL),'provider':generated.get('provider','unknown'),'seed':row['seed'],**{key:generated.get(key) for key in ('steps','guidance_scale','width','height','runtime','safety_checker','quantization_bits','checkpoint','revision','prompt_processing','content_controls')},'art_style':STYLE_VERSION},
                    'source_prompt_sha256':row['prompt_hash'],'image_sha256':image_hash,'art_prompt_sha256':hashlib.sha256(art_prompt.encode()).hexdigest(),
                    'assessment':assessment,'attributes':[{'trait_type':'Grade','value':assessment['grade_label']},{'trait_type':'Prompt score','value':assessment['score']},{'trait_type':'Collection cap','value':self.cap}]}
                raw=json.dumps(manifest,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
                metadata_hash=hashlib.sha256(raw).hexdigest();self._write(self.root/(metadata_hash+'.json'),raw)
                uri=f'{self.origin}/api/candy/metadata/{metadata_hash}.json'
                with self.platform.db() as db: db.execute("UPDATE candy_jobs SET state='ready',image_hash=?,metadata_hash=?,uri=?,error=NULL WHERE id=?",(image_hash,metadata_hash,uri,ident))
            finally: target.unlink(missing_ok=True)
        except Exception as error:
            uncertain=str(error) in ('uncertain','space_timeout')
            safe='The image request was interrupted; retrying may use provider credits again.' if uncertain else 'The provider could not return an acceptable candy image. Check configuration, credits and safety filters. Your grade has not changed.'
            safe={
                'authentication':'Hugging Face rejected HF_TOKEN. Check the server-side token; your earned grade is saved.',
                'permission':'Hugging Face denied access. Check Inference Providers permission and model/provider access; your earned grade is saved.',
                'billing':'Hugging Face requires provider credits or billing before it can generate this image. Your earned grade is saved.',
                'rate_limit':'The image provider is rate-limiting requests. Try again later; your earned grade is saved.',
                'local_configuration':'Local Schnell is not prepared. Run bash scripts/shell/setup-flux.sh and restart Caspy. Your grade is saved.',
                'local_timeout':'Local generation exceeded 20 minutes on this Mac. Your grade is saved; close other apps before an explicit retry.',
                'local_generation':'Local Schnell could not finish. Check available memory and the local model setup. Your grade is saved.',
                'configuration':'The hosted image client is not configured. Check HF_TOKEN and install scripts/requirements-candy.txt.',
                'space_quota':'The free image Space is out of quota or denied this request. Your grade is saved. Retry later; no paid fallback was used.',
                'space_unavailable':'The free image Space is unavailable or its API changed. Your grade is saved. No paid fallback was used.',
                'space_timeout':'The free image Space did not finish within the request window. It may still be processing. Your grade is saved; check status before explicitly retrying.',
            }.get(str(error),safe)
            with self.platform.db() as db: db.execute('UPDATE candy_jobs SET state=?,error=? WHERE id=?',('uncertain' if uncertain else 'failed',safe,ident))
        finally:
            with self.progress_lock: self.job_progress.pop(ident,None)

    def _write(self,path,data):
        if self.database_assets:
            digest,kind=path.stem,path.suffix.removeprefix('.')
            if hashlib.sha256(data).hexdigest()!=digest: raise RuntimeError('immutable_asset')
            with self.platform.db() as db:
                db.execute('INSERT OR IGNORE INTO candy_blobs(digest,kind,content) VALUES (?,?,?)',(digest,kind,data))
                row=db.execute('SELECT kind,content FROM candy_blobs WHERE digest=?',(digest,)).fetchone()
                if row['kind']!=kind or bytes(row['content'])!=data: raise RuntimeError('immutable_asset')
            return
        if path.exists():
            if path.read_bytes()!=data: raise RuntimeError('immutable_asset')
            return
        fd,name=tempfile.mkstemp(dir=path.parent)
        try:
            with os.fdopen(fd,'wb') as target: target.write(data)
            os.replace(name,path)
        finally:
            if os.path.exists(name): os.unlink(name)

    def blob(self,digest,kind):
        if not re.fullmatch(r'[0-9a-f]{64}',digest) or kind not in ('png','json'): raise Fault(404,'Candy asset not found.')
        path=self.root/(digest+'.'+kind)
        if self.database_assets:
            with self.platform.db() as db: row=db.execute('SELECT content FROM candy_blobs WHERE digest=? AND kind=?',(digest,kind)).fetchone()
            if not row: raise Fault(404,'Candy asset not found.')
            data=bytes(row['content'])
        else:
            if not path.is_file(): raise Fault(404,'Candy asset not found.')
            data=path.read_bytes()
        if hashlib.sha256(data).hexdigest()!=digest: raise Fault(503,'Candy content integrity check failed.')
        return data

    def ready(self,ident,user=None):
        row=self.row(ident,user)
        if row['state']!='ready': raise Fault(409,'Generate the earned candy image before minting.')
        self.blob(row['image_hash'],'png');self.blob(row['metadata_hash'],'json')
        return row

    def commitments(self,ident):
        row=self.ready(ident)
        score=json.loads(row['assessment'])
        return {'grade':score['grade'],'score':score['score'],'prompt_hash':'0x'+row['prompt_hash'],
                'image_hash':'0x'+row['image_hash'],'metadata_hash':'0x'+row['metadata_hash'],'uri':row['uri']}

    def mark_minted(self,ident,token_id):
        with self.platform.db() as db: db.execute('UPDATE candy_jobs SET token_id=? WHERE id=? AND namespace=?',(str(token_id),ident,self.namespace))

    def decorate_token(self,token):
        digest=token['metadata_hash'].removeprefix('0x')
        try:
            manifest=json.loads(self.blob(digest,'json'))
            return {**token,'name':manifest['name'],'image_url':'/api/candy/images/'+token['image_hash'].removeprefix('0x')+'.png','assessment':manifest['assessment'],'generator':manifest['generator']}
        except Fault:
            return {**token,'name':'Candy metadata unavailable','image_url':None,'assessment':None}

    def owned_prompt(self,token_id,wallet):
        token=self.nft.call('token',token_id=token_id)
        owns=token['owner'].lower()==wallet.lower() or bool(token.get('listing') and token['listing']['seller'].lower()==wallet.lower())
        if not owns: raise Fault(403,'Only the verified current owner or escrow seller can access this prompt.')
        with self.platform.db() as db: row=db.execute('SELECT prompt,prompt_hash FROM candy_jobs WHERE namespace=? AND metadata_hash=?',(self.namespace,token['metadata_hash'].removeprefix('0x'))).fetchone()
        if not row: raise Fault(404,'The committed source prompt is unavailable.')
        return {'prompt':row['prompt'],'prompt_hash':'0x'+row['prompt_hash'],'license':token['prompt_license'],
                'notice':'The prompt is visible to its creator and verified NFT owner. Delivered copies cannot be recalled; ownership of the NFT does not itself transfer copyright.'}
