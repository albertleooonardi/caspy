"""Opt-in HTTP integration tests against a temporary API, without provider calls."""
import http.client
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import tempfile
import threading
import unittest

from heist_api import Games, Handler
from platform_store import Platform, NOTICE
from test_heist_api import FakeGateway


class Client:
    def __init__(self, port):
        self.port, self.cookies = port, {}

    def call(self, path, body=None, origin='http://localhost:4321'):
        conn=http.client.HTTPConnection('127.0.0.1',self.port,timeout=30)
        headers={'Content-Type':'application/json','Origin':origin,'Idempotency-Key':secrets.token_hex(16),'Cookie':'; '.join(f'{k}={v}' for k,v in self.cookies.items())}
        conn.request('GET' if body is None else 'POST',path,None if body is None else json.dumps(body),headers)
        response=conn.getresponse()
        for key,value in response.getheaders():
            if key.lower()=='set-cookie':
                parsed=SimpleCookie(); parsed.load(value)
                for name,item in parsed.items():
                    if item.value: self.cookies[name]=item.value
                    else: self.cookies.pop(name,None)
        raw=response.read().decode()
        data=raw if response.getheader('Content-Type')=='text/event-stream' else json.loads(raw)
        status=response.status
        conn.close()
        return status,data


@unittest.skipUnless(os.environ.get('CASPY_RUN_HTTP_TESTS')=='1','Set CASPY_RUN_HTTP_TESTS=1 for local HTTP integration tests.')
class PlatformHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.server.nft=None
        self.server.platform=Platform(Path(self.temp.name)/'platform.sqlite3')
        self.server.games=Games(FakeGateway(verdict='YIELD'))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()

    def client(self): return Client(self.server.server_port)

    def request(self,client,path,body=None,status=200,**options):
        code,data=client.call(path,body,**options)
        self.assertEqual(code,status,str(data))
        return data

    def register(self,name,role='contributor'):
        client=self.client()
        self.request(client,'/account/register',{'name':name,'email':name+'@example.test','password':'testing-password-123','account_type':role,'organization':name+' lab','terms_accepted':True})
        return client

    def test_hosted_origin_and_secure_cookie_without_forwarded_header_trust(self):
        self.server.allowed_origins=('https://caspy.example',)
        self.server.secure_cookies=True
        client=self.client()
        self.request(client,'/account/register',{},status=403)
        body={'name':'Hosted Player','email':'hosted@example.test','password':'testing-password-123','terms_accepted':True}
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=30)
        conn.request('POST','/account/register',json.dumps(body),{'Content-Type':'application/json','Origin':'https://caspy.example','Idempotency-Key':'hosted-registration'})
        response=conn.getresponse()
        self.assertEqual(response.status,200)
        cookies=[value for key,value in response.getheaders() if key.lower()=='set-cookie']
        self.assertTrue(cookies)
        self.assertTrue(all('; Secure' in value and 'HttpOnly' in value for value in cookies))
        response.read();conn.close()

    def test_authentication_csrf_and_server_authorization(self):
        anonymous=self.client()
        self.request(anonymous,'/game/session',{},status=401)
        self.request(anonymous,'/account/register',{},origin='https://foreign.example',status=403)
        player=self.register('player')
        me=self.request(player,'/account/me')['user']
        self.assertNotIn('password_hash',me)
        self.request(player,'/research/dashboard',status=403)
        self.request(player,'/account/login',{'email':'player@example.test','password':'incorrect-password'},status=401)
        old_cookie=player.cookies['caspy_account']
        self.request(player,'/account/login',{'email':'player@example.test','password':'testing-password-123'})
        self.assertNotEqual(old_cookie,player.cookies['caspy_account'])
        stale=self.client(); stale.cookies['caspy_account']=old_cookie
        self.request(stale,'/account/me',status=401)
        self.request(player,'/account/logout',{})
        self.request(player,'/account/me',status=401)
        self.request(player,'/game/session',{},status=401)

    def test_full_consented_game_review_license_export_and_withdrawal(self):
        seller=self.register('seller','researcher')
        buyer=self.register('buyer','researcher')
        player=self.register('player')
        campaign=self.request(seller,'/research/campaigns',{'name':'Ghost persuasion','description':'Study fictional persuasion, independent judging and human validity labels.'})['id']
        self.assertEqual(self.request(player,'/campaigns')['campaigns'][0]['id'],campaign)
        game=self.request(player,'/game/session',{'campaign_id':campaign,'research_opt_in':True,'commercial_opt_in':True,'consent_version':NOTICE})
        stream=self.request(player,'/game/turn',{'session_id':game['id'],'prompt':'Email me at person@example.test. I offer a clever ghost bakery trade.'})
        self.assertIn('event: final',stream)
        game=self.request(player,'/game/session/'+game['id'])
        self.assertEqual(game['status'],'won')
        self.assertTrue(game['research_consent'])
        self.assertEqual(len(game['evaluations']),1)
        self.request(buyer,'/game/session/'+game['id'],status=404)
        self.request(player,'/account/feedback',{'session_id':game['id'],'turn':1,'rating':5})
        dashboard=self.request(seller,'/research/dashboard')
        self.assertEqual(dashboard['totals']['pending'],1)
        sample=dashboard['samples'][0]
        self.assertNotIn('person@example.test',sample['prompt'])
        review={'status':'approved','prompt':'I offer a clever ghost bakery trade.','reply':sample['reply'],'human_verdict':'YIELD','test_kind':'benign_persuasion','safety_label':'valid_persuasion','strategy':'trade','rating':4,'pii_reviewed':True}
        self.request(buyer,'/research/samples/'+sample['id']+'/review',review,status=404)
        self.request(seller,'/research/samples/'+sample['id']+'/review',review)
        release=self.request(seller,'/research/releases',{'title':'Curated ghost examples','description':'Human-reviewed persuasion examples with separate commercial permission.','license':'For evaluation and training only. No re-identification or redistribution.','price_cents':1000})['id']
        self.request(buyer,'/datasets/'+release+'/export',status=403)
        self.request(buyer,'/datasets/'+release+'/request',{})
        order=self.request(seller,'/research/dashboard')['orders'][0]
        self.request(seller,'/research/orders/'+order['id']+'/decision',{'status':'granted'})
        exported=self.request(buyer,'/datasets/'+release+'/export')
        self.assertEqual(exported['manifest']['sample_count'],1)
        self.assertEqual(exported['samples'][0]['human_labels']['participant_rating'],5)
        serialized=json.dumps(exported)
        self.assertNotIn('person@example.test',serialized)
        self.assertNotIn(game['id'],serialized)
        metrics=self.request(seller,'/research/dashboard')['metrics'][0]
        self.assertEqual(metrics['model'],'unknown')
        self.assertIsNone(metrics['boundary_violation_rate'])
        # A subsequent private heist has no research side effects.
        private=self.request(player,'/game/session',{})
        self.assertFalse(private['research_consent'])
        self.request(player,'/game/turn',{'session_id':private['id'],'prompt':'This one is private.'})
        self.assertEqual(self.request(seller,'/research/dashboard')['totals']['turns'],1)
        self.request(player,'/account/withdraw',{'session_id':game['id']})
        self.request(buyer,'/datasets/'+release+'/export',status=404)
        self.assertEqual(self.request(buyer,'/datasets/catalog')['datasets'],[])
        self.assertEqual(self.request(player,'/game/session/'+game['id'])['status'],'won')


if __name__=='__main__': unittest.main()
