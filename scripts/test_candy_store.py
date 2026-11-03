"""Explicit fixture artwork only: no HF token, network calls or FLUX inference."""
import hashlib
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from candy_rules import score_prompt, validate_candy_verdict
from candy_store import CandyStore
from platform_store import Platform, Fault

class FixtureRenderer:
    configured=True
    calls=0
    def render(self,prompt,seed,target):
        from PIL import Image
        self.calls+=1
        Image.new('RGB',(1024,1024),(84,41,110)).save(target,'PNG')
        return {'model':'test-fixture','provider':'test-only'}

class FakeNFT:
    config={'chain_id':31337,'contract':'0x'+'11'*20,'deployment_block_hash':'0x'+'22'*32,'market':'0x'+'33'*20}
    def call(self,action,**kwargs): return {'max_supply':2,'minted':0}

def winner(ident='one',prompt='Trade one sugar moon for a map to the ghost bakery.'):
    return {'id':ident,'status':'won','messages':[{'role':'user','text':prompt},{'role':'caspy','text':'A deal!'}],
        'evaluations':[{'turn':1,'verdict':'YIELD','confidence':.95,'exploit_flag':False,'category':'persuasion','candy_scores':{'creativity':18,'coherence':18,'specificity':18}}]}

class CandyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        self.platform=Platform(self.root/'platform.db');self.renderer=FixtureRenderer()
        self.candy=CandyStore(self.platform,FakeNFT(),self.root/'assets',self.renderer)
        self.user={'id':'owner'}
    def tearDown(self): self.candy.close();self.tmp.cleanup()
    def earn(self): return self.candy.ensure_win(winner(),self.user,'wallet-one')
    def generated(self):
        self.earn();self.candy.generate('one',self.user,True)
        for _ in range(100):
            row=self.candy.row('one')
            if row['state']!='generating': break
            time.sleep(.01)
        self.assertEqual(row['state'],'ready');return row
    def test_no_loss_entitlement_or_provider_call(self):
        game=winner();game['status']='lost'
        self.assertIsNone(self.candy.ensure_win(game,self.user,'one'))
        with self.assertRaises(Fault): self.candy.generate('one',self.user,True)
        self.assertEqual(self.renderer.calls,0)
    def test_recorded_nonrandom_grade_and_duplicate_novelty(self):
        a=self.earn()['assessment'];self.assertEqual(a['score'],94);self.assertEqual(a['grade_label'],'S')
        b=self.candy.ensure_win(winner('two'),self.user,'wallet-two')['assessment'];self.assertEqual(b['components']['novelty'],0);self.assertEqual(b['score'],54)
        self.assertEqual(self.earn()['assessment'],a)
        with self.assertRaises(Fault): self.candy.ensure_win(winner('third'),self.user,'wallet-three')
    def test_rejects_missing_scores_or_exploits(self):
        game=winner();game['evaluations'][0]['candy_scores']={}
        with self.assertRaises(ValueError): self.candy.ensure_win(game,self.user,'one')
        game=winner();game['evaluations'][0]['exploit_flag']=True
        with self.assertRaises(Fault): self.candy.ensure_win(game,self.user,'one')
    def test_generation_is_idempotent_and_content_is_committed(self):
        row=self.generated();before=dict(row)
        self.candy.generate('one',self.user,True);self.assertEqual(self.renderer.calls,1)
        metadata=json.loads(self.candy.blob(row['metadata_hash'],'json'))
        self.assertEqual(metadata['generator']['model'],'test-fixture')
        self.assertNotIn(row['prompt'],json.dumps(metadata))
        self.assertEqual(metadata['source_prompt_sha256'],hashlib.sha256(row['prompt'].encode()).hexdigest())
        commitments=self.candy.commitments('one');self.assertEqual(commitments['score'],94)
        (self.root/'assets'/(row['image_hash']+'.png')).write_bytes(b'tampered')
        with self.assertRaises(Fault): self.candy.commitments('one')
        self.assertEqual(self.candy.row('one')['assessment'],before['assessment'])
    def test_consent_owner_and_configuration(self):
        self.earn()
        with self.assertRaises(Fault): self.candy.generate('one',self.user,False)
        with self.assertRaises(Fault): self.candy.generate('one',{'id':'another'},True)
        self.renderer.configured=False
        self.assertEqual(self.candy.public(self.candy.row('one'))['state'],'needs_configuration')
        with self.assertRaises(Fault): self.candy.generate('one',self.user,True)
        self.assertEqual(self.renderer.calls,0)

    def test_billing_failure_preserves_grade_and_creates_no_artwork(self):
        assessment=self.earn()['assessment']
        with patch.object(self.renderer,'render',side_effect=RuntimeError('billing')) as render:
            self.candy.generate('one',self.user,True)
            self.candy.pool.shutdown(wait=True)
            render.assert_called_once()
        row=self.candy.row('one')
        self.assertEqual(row['state'],'failed')
        self.assertIn('provider credits or billing',row['error'])
        self.assertEqual(json.loads(row['assessment']),assessment)
        self.assertEqual(row['attempts'],1)
        self.assertIsNone(row['image_hash'])
        self.assertIsNone(row['metadata_hash'])
    def test_interruption_explicit_retry_and_budget(self):
        self.earn()
        with self.platform.db() as db: db.execute("UPDATE candy_jobs SET state='uncertain' WHERE id='one'")
        with self.assertRaises(Fault): self.candy.generate('one',self.user,True)
        self.candy.budget=1
        with self.platform.db() as db: db.execute('INSERT INTO candy_attempts VALUES (?,?)',('old',int(time.time())))
        with self.assertRaises(Fault): self.candy.generate('one',self.user,True,True)
        self.assertEqual(self.renderer.calls,0)
    def test_source_access_follows_chain_owner_and_escrow_seller(self):
        row=self.generated()
        token={'owner':'buyer','metadata_hash':'0x'+row['metadata_hash'],'prompt_license':'Terms','listing':None}
        with patch.object(self.candy.nft,'call',return_value=token):
            with self.assertRaises(Fault): self.candy.owned_prompt('1','seller')
            self.assertEqual(self.candy.owned_prompt('1','buyer')['prompt'],row['prompt'])
        token['listing']={'seller':'seller'}
        with patch.object(self.candy.nft,'call',return_value=token): self.assertEqual(self.candy.owned_prompt('1','seller')['prompt'],row['prompt'])
    def test_redaction_before_generation_and_hash(self):
        self.candy.ensure_win(winner(prompt='Share a candy with friend@example.com at 0x'+'ab'*20),self.user,'one')
        row=self.candy.row('one');self.assertNotIn('friend@example.com',row['prompt']);self.assertNotIn('0x'+'ab'*20,row['prompt'])

if __name__=='__main__': unittest.main()
