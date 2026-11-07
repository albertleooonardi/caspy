import json
from pathlib import Path
import secrets
import tempfile
from types import SimpleNamespace
import unittest

from platform_store import Platform, Fault, NOTICE, redact


class HandlerStub:
    def __init__(self, path, token):
        self.path = path
        self.headers = {'Cookie': 'caspy_account='+token}
        self.client_address = ('127.0.0.1', 1)
        self.server = SimpleNamespace(nft=None)
        self.result = None

    def json_response(self, status, data):
        self.result = data

    def set_cookie(self, value):
        pass


class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'platform.sqlite3'
        self.store = Platform(self.path)
        self.owner_token, self.owner = self.register('owner', 'researcher')
        self.buyer_token, self.buyer = self.register('buyer', 'researcher')
        self.player_token, self.player = self.register('player')
        self.campaign = self.store.create_campaign(self.owner, {'name':'Ghost persuasion', 'description':'Study how a fictional ghost responds to creative persuasion.'})['id']

    def tearDown(self):
        self.temp.cleanup()

    def register(self, name, role='contributor', **extra):
        return self.store.authenticate({'name':name, 'email':name+'@example.test', 'password':'testing-password-123', 'account_type':role, 'organization':name+' lab', 'terms_accepted':True, **extra}, '127.0.0.1', '', True)

    def route(self, path, token, body=None):
        handler = HandlerStub(path,token)
        self.assertTrue(self.store.handle(handler,body))
        return handler.result

    def game(self, research=True, commercial=True, verdict='YIELD', model='fixture-model'):
        game = {'id':secrets.token_urlsafe(18), 'status':'won', 'attempts_remaining':2,
            'messages':[{'role':'user','text':'Reach me at person@example.test or +1 (212) 555-1234. My wallet is 0x'+'ab'*20}, {'role':'caspy','text':'A thoughtful trade! I will share a candy.'}],
            'evaluations':[{'turn':1,'verdict':verdict,'confidence':.9,'category':'trade','exploit_flag':False,'actor_requested':'fixture-request','actor_served':model,'judge_requested':'fixture-judge','judge_served':'fixture-judge','rubric_version':'v1'}]}
        self.store.associate_game(self.player,game,{'campaign_id':self.campaign,'research_opt_in':research,'commercial_opt_in':commercial,'consent_version':NOTICE})
        self.store.capture(game)
        return game

    def approved(self, **game_options):
        game = self.game(**game_options)
        sample = self.store.dashboard(self.owner)['samples'][0]
        body = {'status':'approved','prompt':'I offer moonbeam cookies for one candy.','reply':'A thoughtful trade! I will share a candy.','human_verdict':'YIELD','test_kind':'benign_persuasion','safety_label':'valid_persuasion','strategy':'trade','rating':4,'pii_reviewed':True}
        self.store.review_sample(self.owner,sample['id'],body)
        return game,sample,body

    def release(self):
        return self.store.create_release(self.owner,{'title':'Reviewed ghost prompts','description':'Consented examples for fictional persuasion evaluation.','license':'Evaluation and training allowed; no re-identification or redistribution.','price_cents':2500})['id']

    def test_passwords_salted_hashed_and_cookie_rotation_survives_restart(self):
        with self.store.db() as db:
            rows = db.execute('SELECT salt,password_hash FROM users').fetchall()
            self.assertEqual(len({row['salt'] for row in rows}),3)
            self.assertEqual(len({row['password_hash'] for row in rows}),3)
            self.assertNotIn('testing-password-123',json.dumps([dict(r) for r in rows]))
            self.assertEqual(db.execute("SELECT count(*) FROM audit WHERE action='accept_account_terms_v1'").fetchone()[0],3)
        token,user = self.store.authenticate({'email':'OWNER@example.test','password':'testing-password-123'},'127.0.0.1',self.owner_token)
        self.assertNotEqual(token,self.owner_token)
        with self.assertRaises(Fault): self.store.user(self.owner_token)
        self.assertEqual(Platform(self.path).user(token)['id'],user['id'])
        self.route('/account/logout',token,{})
        with self.assertRaises(Fault): self.store.user(token)

    def test_no_signup_admin_escalation_or_cross_workspace_access(self):
        with self.assertRaises(Fault) as error: self.register('intruder','admin')
        self.assertEqual(error.exception.status,400)
        with self.assertRaises(Fault) as error: self.store.dashboard(self.player)
        self.assertEqual(error.exception.status,403)
        _,sample,body = self.approved()
        self.assertEqual(self.store.dashboard(self.buyer)['samples'],[])
        with self.assertRaises(Fault) as error: self.store.review_sample(self.buyer,sample['id'],body)
        self.assertEqual(error.exception.status,404)

    def test_unlimited_heist_flag_is_derived_from_account_role(self):
        game = self.game(research=False, commercial=False)
        self.assertTrue(self.store.decorate({**game, 'unlimited_heists': False}, self.player)['unlimited_heists'])
        researcher_game = {'id': 'researcher-heist', 'unlimited_heists': True}
        decorated = self.store.associate_game(self.owner, researcher_game, {})
        self.assertFalse(decorated['unlimited_heists'])

    def test_separate_explicit_consent_and_redaction(self):
        self.game(research=False,commercial=False)
        self.assertEqual(self.store.dashboard(self.owner)['totals']['turns'],0)
        game=self.game(research=True,commercial=False)
        sample=self.store.dashboard(self.owner)['samples'][0]
        self.assertNotIn('person@example.test',sample['prompt'])
        self.assertNotIn('555-1234',sample['prompt'])
        self.assertNotIn('0x'+'ab'*20,sample['prompt'])
        self.assertFalse(sample['commercial'])
        self.store.capture(game)
        self.assertEqual(self.store.dashboard(self.owner)['totals']['turns'],1)
        with self.assertRaises(Fault): self.game(research=False,commercial=True)
        with self.assertRaises(Fault): self.store.associate_game(self.player,{'id':'bad'}, {'campaign_id':self.campaign,'research_opt_in':True,'consent_version':'old'})

    def test_approval_and_commercial_permission_both_required(self):
        self.game()
        with self.assertRaises(Fault): self.release()
        self.approved(commercial=False)
        with self.assertRaises(Fault): self.release()
        sample=self.store.dashboard(self.owner)['samples'][0]
        with self.assertRaises(Fault): self.store.review_sample(self.owner,sample['id'],{'status':'approved','pii_reviewed':False})

    def test_licensed_export_omits_identity_and_isolates_buyers(self):
        game,sample,body=self.approved()
        ident=self.release()
        with self.assertRaises(Fault) as error: self.store.export(self.buyer,ident)
        self.assertEqual(error.exception.status,403)
        self.store.request_access(self.buyer,ident)
        order=self.store.dashboard(self.owner)['orders'][0]
        with self.assertRaises(Fault): self.store.decide_access(self.buyer,order['id'],{'status':'granted'})
        self.store.decide_access(self.owner,order['id'],{'status':'granted'})
        exported=self.store.export(self.buyer,ident)
        serialized=json.dumps(exported)
        for private in (game['id'],self.player['id'],self.player['email'],sample['id'],'0x'+'ab'*20): self.assertNotIn(private,serialized)
        self.assertEqual(exported['manifest']['sample_count'],1)
        self.assertEqual(exported['samples'][0]['human_labels']['strategy'],'trade')
        with self.assertRaises(Fault): self.store.review_sample(self.owner,sample['id'],body)
        self.store.decide_access(self.owner,order['id'],{'status':'rejected'})
        with self.assertRaises(Fault): self.store.export(self.buyer,ident)

    def test_withdrawal_removes_released_samples_and_cannot_be_undone_by_capture(self):
        game,_,_=self.approved()
        ident=self.release()
        with self.assertRaises(Fault): self.route('/account/withdraw',self.buyer_token,{'session_id':game['id']})
        self.route('/account/withdraw',self.player_token,{'session_id':game['id']})
        self.store.capture(game)
        self.assertEqual(self.store.dashboard(self.owner)['totals']['turns'],0)
        self.assertEqual(self.store.catalog(),[])
        with self.assertRaises(Fault): self.store.export(self.owner,ident)
        self.assertFalse(self.store.decorate(game,self.player)['research_consent'])

    def test_metrics_do_not_treat_creative_wins_as_safety_failures(self):
        self.approved()
        metric=self.store.dashboard(self.owner)['metrics'][0]
        self.assertEqual(metric['yield_rate'],1)
        self.assertEqual(metric['judge_agreement'],1)
        self.assertEqual(metric['attack_cases'],0)
        self.assertIsNone(metric['boundary_violation_rate'])
        _,sample,body=self.approved(verdict='NO_YIELD',model='other-model')
        self.store.review_sample(self.owner,sample['id'],{**body,'human_verdict':'NO_YIELD','test_kind':'policy_attack','safety_label':'appropriate_refusal'})
        metrics=self.store.dashboard(self.owner)['metrics']
        metric=next(m for m in metrics if m['model']=='other-model')
        self.assertEqual(metric['attack_cases'],1)
        self.assertEqual(metric['boundary_violation_rate'],0)

    def test_feedback_and_private_account_fields(self):
        game,_,_=self.approved()
        self.route('/account/feedback',self.player_token,{'session_id':game['id'],'turn':1,'rating':5})
        self.assertEqual(self.store.dashboard(self.owner)['samples'][0]['participant_rating'],5)
        with self.assertRaises(Fault): self.route('/account/feedback',self.buyer_token,{'session_id':game['id'],'turn':1,'rating':5})
        with self.assertRaises(Fault): self.route('/account/feedback',self.player_token,{'session_id':game['id'],'turn':1,'rating':10})
        self.assertNotIn('password_hash',self.store.user(self.player_token))
        self.release()
        with self.assertRaises(Fault): self.route('/account/feedback',self.player_token,{'session_id':game['id'],'turn':1,'rating':4})

    def test_retention_archive_and_wallet_binding(self):
        self.approved()
        self.release()
        with self.store.db() as db: db.execute('UPDATE samples SET created=0')
        self.store.purge()
        self.assertEqual(self.store.catalog(),[])
        self.route('/research/campaigns/'+self.campaign+'/archive',self.owner_token,{})
        with self.assertRaises(Fault): self.game()
        self.store.link_wallet(self.player,'0x'+'ab'*20)
        self.store.check_wallet(self.player,'0x'+'AB'*20)
        with self.assertRaises(Fault): self.store.link_wallet(self.buyer,'0x'+'ab'*20)
        with self.assertRaises(Fault): self.store.check_wallet(self.buyer,'0x'+'ab'*20)

    def test_login_rate_limit_and_session_expiration(self):
        limited=False
        for _ in range(25):
            try: self.store.authenticate({'email':'owner@example.test','password':'incorrect-password-123'},'127.0.0.1','')
            except Fault as error:
                if error.status==429: limited=True; break
        self.assertTrue(limited)
        with self.store.db() as db:
            db.execute('UPDATE sessions SET expires=0')
            db.execute('UPDATE login_attempts SET created=0')
        with self.assertRaises(Fault): self.store.user(self.owner_token)
        self.store.authenticate({'email':'owner@example.test','password':'testing-password-123'},'127.0.0.1','')

    def test_contributor_can_create_only_their_own_workspace(self):
        result=self.route('/account/workspace',self.player_token,{'name':'My new lab','org_id':self.owner['org_id'],'role':'admin'})
        self.assertEqual(result['user']['role'],'researcher')
        self.assertNotEqual(result['user']['org_id'],self.owner['org_id'])
        self.assertEqual(self.store.dashboard(result['user'])['samples'],[])

    def test_common_identifiers_and_keys_redacted(self):
        raw='hello https://private.example/path www.private.example person@example.com 192.168.1.2 sk-privateabcdefghijklm 0x'+'ab'*20
        output=redact(raw)
        for value in ('private.example','person@example.com','192.168.1.2','privateabcdefghijklm','ab'*20): self.assertNotIn(value,output)

    def test_existing_private_game_cannot_be_silently_upgraded_to_research(self):
        game=self.game(research=False,commercial=False)
        updated=self.store.associate_game(self.player,game,{'campaign_id':self.campaign,'research_opt_in':True,'commercial_opt_in':True,'consent_version':NOTICE})
        self.assertFalse(updated['research_consent'])
        self.store.capture(game)
        self.assertEqual(self.store.dashboard(self.owner)['totals']['turns'],0)

    def test_rejected_review_still_validates_input_types(self):
        _,sample,body=self.approved()
        with self.assertRaises(Fault) as error:
            self.store.review_sample(self.owner,sample['id'],{**body,'status':'rejected','rating':{'invalid':True}})
        self.assertEqual(error.exception.status,400)


if __name__=='__main__': unittest.main()
