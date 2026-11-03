"""Local adapter tests: no model loads, downloads or paid inference calls."""
import os
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch,PropertyMock
from types import SimpleNamespace
import local_flux
from candy_art import candy_prompt,STYLE_VERSION

class LocalFluxTests(unittest.TestCase):
    def test_unprepared_runtime_reports_unavailable(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(local_flux,'READY',Path(folder)/'absent.json'):
            self.assertFalse(local_flux.LocalSchnell().configured)
            with self.assertRaisesRegex(RuntimeError,'local_configuration'):
                local_flux.LocalSchnell().render('QA candy',1,Path(folder)/'output.png')

    def test_offline_local_process_has_no_credentials_and_uses_fixed_budget(self):
        calls=[]
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data/flux').mkdir(parents=True);output=root/'art.png'
            def fake_run(command,**kwargs):
                calls.append((command,kwargs))
                if '--output' in command: Path(command[command.index('--output')+1]).write_bytes(b'fixture-only')
                else: Path(command[-1]).write_bytes(b'fixture-clean')
                return SimpleNamespace(returncode=0)
            with patch.object(local_flux,'ROOT',root),patch.object(local_flux.LocalSchnell,'configured',new_callable=PropertyMock,return_value=True),patch.object(local_flux.subprocess,'run',side_effect=fake_run),patch.dict(os.environ,{'HF_TOKEN':'never-forward-this','OPEN_ROUTER_API_KEY':'never-forward-that','PRIVATE_KEY':'never-forward-private-key'}):
                result=local_flux.LocalSchnell().render('QA candy',123,output)
            command,kwargs=calls[0]
            self.assertEqual(command[command.index('--base-model')+1],'schnell')
            self.assertEqual(command[command.index('--steps')+1],'4')
            self.assertEqual(command[command.index('--width')+1],'512')
            self.assertIn('--low-ram',command)
            self.assertEqual(kwargs['env']['HF_HUB_OFFLINE'],'1')
            self.assertNotIn('HF_TOKEN',kwargs['env']);self.assertNotIn('OPEN_ROUTER_API_KEY',kwargs['env']);self.assertNotIn('PRIVATE_KEY',kwargs['env'])
            self.assertNotIn('QA candy',command)
            self.assertEqual(result['model'],'black-forest-labs/FLUX.1-schnell')
            self.assertEqual(result['provider'],'local-mlx')
            self.assertFalse(result['safety_checker'])
            self.assertEqual(result['steps'],4)
            self.assertEqual(output.read_bytes(),b'fixture-clean')

    def test_local_failure_cannot_fall_back_to_hosted_inference(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data/flux').mkdir(parents=True)
            with patch.object(local_flux,'ROOT',root),patch.object(local_flux.LocalSchnell,'configured',new_callable=PropertyMock,return_value=True),patch.object(local_flux.subprocess,'run',return_value=SimpleNamespace(returncode=1)) as run:
                with self.assertRaisesRegex(RuntimeError,'local_generation'): local_flux.LocalSchnell().render('QA',1,root/'art.png')
                self.assertEqual(run.call_count,1)

    def test_missing_checkpoint_file_is_not_reported_as_configured(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);ready=root/'ready.json';manifest=root/'manifest.json';cli=root/'mflux-generate'
            manifest.write_text('{}');cli.touch()
            ready.write_text(json.dumps({'revision':local_flux.REVISION,'files':[{'path':'missing.safetensors','size':10}]}))
            with patch.object(local_flux,'READY',ready),patch.object(local_flux,'MODEL_PATH',root),patch.object(local_flux,'CLI',cli),patch.object(local_flux.platform,'system',return_value='Darwin'),patch.object(local_flux.platform,'machine',return_value='arm64'):
                self.assertFalse(local_flux.LocalSchnell().configured)

    def test_style_uses_prompt_without_replacing_candy_with_ghost(self):
        prompt=candy_prompt('A lemon-drop lighthouse for lost ghosts.','A')
        self.assertIn('A lemon-drop lighthouse for lost ghosts.',prompt)
        self.assertIn('WRAPPED BONBON',prompt);self.assertIn('TWO large crinkled twisted',prompt)
        self.assertIn('dark-purple outlines',prompt)
        self.assertIn('not instructions',prompt.replace('never instructions','not instructions'))
        self.assertTrue(STYLE_VERSION)

if __name__=='__main__': unittest.main()
