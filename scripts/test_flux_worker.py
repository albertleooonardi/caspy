"""Test the hosted adapter with a fake client. No provider request is made."""
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image
import huggingface_hub
import flux_worker

class FluxAdapterTests(unittest.TestCase):
    def test_fixed_model_safe_settings_and_clean_output(self):
        calls={}
        class Client:
            def __init__(self,**kwargs): calls['init']=kwargs
            def text_to_image(self,prompt,**kwargs):
                calls['prompt']=prompt;calls['generation']=kwargs
                image=Image.new('RGB',(1024,1024),(150,60,90));image.info['private_prompt']='must not survive'
                return image
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'art.png';stream=io.StringIO()
            with patch.dict(os.environ,{'HF_TOKEN':'test-only-dummy'}),patch.object(huggingface_hub,'InferenceClient',Client),patch('sys.stdin',io.StringIO(json.dumps({'prompt':'A sugar moon candy','seed':123,'output':str(output)}))),patch('sys.stdout',stream): flux_worker.main()
            self.assertTrue(json.loads(stream.getvalue())['ok'])
            self.assertEqual(calls['init']['provider'],'fal-ai')
            self.assertEqual(calls['generation']['model'],'black-forest-labs/FLUX.1-dev')
            self.assertTrue(calls['generation']['extra_body']['enable_safety_checker'])
            self.assertEqual(calls['generation']['seed'],123)
            with Image.open(output) as saved: self.assertNotIn('private_prompt',saved.info)
            self.assertNotIn('test-only-dummy',stream.getvalue())
    def test_black_safety_result_is_not_saved(self):
        class Client:
            def __init__(self,**kwargs): pass
            def text_to_image(self,*args,**kwargs): return Image.new('RGB',(1024,1024))
        with tempfile.TemporaryDirectory() as temp:
            output=Path(temp)/'art.png';stream=io.StringIO()
            with patch.dict(os.environ,{'HF_TOKEN':'test-only-dummy'}),patch.object(huggingface_hub,'InferenceClient',Client),patch('sys.stdin',io.StringIO(json.dumps({'prompt':'Test','seed':1,'output':str(output)}))),patch('sys.stdout',stream),self.assertRaises(SystemExit): flux_worker.main()
            self.assertFalse(output.exists());self.assertEqual(json.loads(stream.getvalue())['kind'],'blocked')

if __name__=='__main__': unittest.main()
