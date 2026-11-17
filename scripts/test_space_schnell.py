import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image, PngImagePlugin
from space_schnell import SpaceSchnell, ORIGIN


class SpaceSchnellTests(unittest.TestCase):
    def run_fixture(self, image_url=ORIGIN+'/gradio_api/file=/tmp/candy.png', seed=42, kind='complete', linger=False, token='', detail=None, wrap=lambda opener: opener):
        raw = io.BytesIO()
        image = Image.new('RGB', (512,512), (245,220,250))
        image.paste((80,30,100), (100,100,400,400))
        metadata = PngImagePlugin.PngInfo(); metadata.add_text('prompt','must be removed')
        image.save(raw, 'PNG', pnginfo=metadata)
        values = [json.dumps({'event_id':'fixture123'}).encode(),
                  f'event: {kind}\ndata: {json.dumps(detail if kind=="error" else [{"url":image_url},seed])}\n\n'.encode(), raw.getvalue()]
        calls = []
        class EventStream(io.BytesIO):
            def read(self,*args): raise AssertionError('Must consume events, not wait for EOF')
        class Opener:
            def open(self, request, **options):
                calls.append(request)
                value=values.pop(0)
                return EventStream(value+b'event: error\ndata: null\n\n') if linger and len(calls)==2 else io.BytesIO(value)
        with tempfile.TemporaryDirectory() as folder, patch('space_schnell.urllib.request.build_opener',return_value=wrap(Opener())):
            target=Path(folder)/'image.png'
            report=SpaceSchnell(token=token).render('Fictional sugar moon',42,target)
            with Image.open(target) as result:
                self.assertEqual(result.size,(512,512)); self.assertEqual(result.info,{})
        return calls,report

    def test_fixed_seed_official_endpoint_no_credentials_and_clean_image(self):
        calls,report=self.run_fixture()
        self.assertEqual(json.loads(calls[0].data)['data'],['Fictional sugar moon',42,False,512,512,4])
        self.assertTrue(all(request.full_url.startswith(ORIGIN+'/') for request in calls))
        self.assertTrue(all(not request.has_header('Authorization') for request in calls))
        self.assertEqual(report['provider'],'huggingface-zerogpu-space')
        self.assertFalse(report['safety_checker'])

    def test_account_token_is_sent_only_to_the_official_space(self):
        calls,_=self.run_fixture(token='hf_'+'a'*34)
        self.assertEqual(len(calls),3)
        self.assertTrue(all(request.full_url.startswith(ORIGIN+'/') for request in calls))
        self.assertTrue(all(request.get_header('Authorization')=='Bearer hf_'+'a'*34 for request in calls))

    def test_malformed_token_is_never_sent_and_disables_the_adapter(self):
        with patch('space_schnell.urllib.request.build_opener') as build, patch('sys.stderr',io.StringIO()):
            renderer=SpaceSchnell(token='hf_bad\r\nX-Injected: 1')
            self.assertFalse(renderer.configured)
            with self.assertRaisesRegex(RuntimeError,'authentication'):
                renderer.render('Fictional test candy',42,Path('unused.png'))
            self.assertEqual(build.return_value.open.call_count,0)

    def test_surrounding_whitespace_in_the_token_is_ignored(self):
        renderer=SpaceSchnell(token=' hf_'+'a'*34+'\n')
        self.assertTrue(renderer.configured)
        self.assertEqual(renderer.token,'hf_'+'a'*34)
        self.assertTrue(SpaceSchnell(token='').configured)

    def test_rejected_token_falls_back_to_one_anonymous_request(self):
        import urllib.error
        calls,report,rejected=None,None,[]
        original=self.run_fixture
        def reject_account(opener):
            inner=opener.open
            def open(request,**options):
                if request.has_header('Authorization'):
                    rejected.append(request)
                    raise urllib.error.HTTPError(ORIGIN,401,'Unauthorized',{},None)
                return inner(request,**options)
            opener.open=open
            return opener
        with patch('sys.stderr',io.StringIO()):
            calls,report=original(token='hf_'+'a'*34,wrap=reject_account)
        self.assertEqual(len(rejected),1)
        self.assertEqual(len(calls),3)
        self.assertTrue(all(not request.has_header('Authorization') for request in calls))
        self.assertIn('anonymous quota',report['prompt_processing'])

    def test_http_refusals_are_classified(self):
        import urllib.error
        for token,code,kind,count in (('',429,'space_quota',1),('',401,'space_denied',1),('',403,'space_denied',1),('hf_'+'a'*34,403,'space_denied',1),('hf_'+'a'*34,401,'space_denied',2),('',500,'space_unavailable',1)):
            with self.subTest(token=bool(token),code=code), patch('space_schnell.urllib.request.build_opener') as build, patch('sys.stderr',io.StringIO()):
                build.return_value.open.side_effect=urllib.error.HTTPError(ORIGIN,code,'Refused',{},None)
                with self.assertRaisesRegex(RuntimeError,kind):
                    SpaceSchnell(token=token).render('Fictional test candy',42,Path('unused.png'))
                self.assertEqual(build.return_value.open.call_count,count)

    def test_auth_failure_after_submission_does_not_create_another_job(self):
        import urllib.error
        for fail_at in (2,3):
            calls=[]
            def reject_later(opener):
                original=opener.open
                def open(request,**options):
                    calls.append(request)
                    if len(calls)==fail_at:
                        raise urllib.error.HTTPError(ORIGIN,401,'Unauthorized',{},None)
                    return original(request,**options)
                opener.open=open
                return opener
            with self.subTest(phase=fail_at), self.assertRaisesRegex(RuntimeError,'space_denied'):
                self.run_fixture(token='hf_'+'a'*34,wrap=reject_later)
            self.assertEqual(sum(request.get_method()=='POST' for request in calls),1)
            self.assertEqual(len(calls),fail_at)

    def test_untrusted_download_and_seed_changes_are_rejected(self):
        for url in ('https://attacker.example/file.png',ORIGIN+'@attacker.example/file.png',ORIGIN+'/unexpected.png'):
            with self.subTest(url=url), self.assertRaisesRegex(RuntimeError,'invalid_image'): self.run_fixture(image_url=url)
        with self.assertRaisesRegex(RuntimeError,'space_unavailable'): self.run_fixture(seed=43)

    def test_quota_error_never_silently_retries_or_falls_back(self):
        for detail in (None,{'error':'You have exceeded your GPU quota (60s requested vs. 0s left).'}):
            with self.subTest(detail=detail), self.assertRaisesRegex(RuntimeError,'space_quota'): self.run_fixture(kind='error',detail=detail)

    def test_error_event_with_another_reason_is_not_a_quota_refusal(self):
        with self.assertRaisesRegex(RuntimeError,'space_unavailable'): self.run_fixture(kind='error',detail={'error':'CUDA out of memory'})

    def test_completed_event_is_used_without_waiting_for_connection_close(self):
        calls,report=self.run_fixture(linger=True)
        self.assertEqual(len(calls),3)
        self.assertEqual(report['steps'],4)

    def test_network_timeout_remains_uncertain_not_a_silent_new_request(self):
        import urllib.error
        with patch('space_schnell.urllib.request.build_opener') as build:
            build.return_value.open.side_effect=urllib.error.URLError(TimeoutError())
            with self.assertRaisesRegex(RuntimeError,'space_timeout'):
                SpaceSchnell(token='').render('Fictional test candy',42,Path('unused.png'))
            self.assertEqual(build.return_value.open.call_count,1)
