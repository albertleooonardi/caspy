"""Public candy PNGs must be real-sized, nonblank and free of embedded prompts."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from PIL import Image,PngImagePlugin

WORKER=Path(__file__).with_name('normalize_candy_image.py')

class CandyImageTests(unittest.TestCase):
    def test_removes_private_prompt_and_image_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            source,target=Path(folder)/'source.png',Path(folder)/'public.png'
            image=Image.new('RGB',(512,512),(240,220,255));image.paste((70,30,90),(100,100,400,400))
            info=PngImagePlugin.PngInfo();info.add_text('prompt','private source text')
            image.save(source,pnginfo=info)
            subprocess.run([sys.executable,str(WORKER),str(source),str(target)],check=True,capture_output=True)
            with Image.open(target) as saved:
                self.assertEqual(saved.size,(512,512));self.assertEqual(saved.mode,'RGB');self.assertEqual(saved.info,{})
    def test_blank_or_wrong_size_image_is_not_published(self):
        for size in [(512,512),(16,16)]:
            with self.subTest(size=size),tempfile.TemporaryDirectory() as folder:
                source,target=Path(folder)/'source.png',Path(folder)/'public.png'
                Image.new('RGB',size,(100,100,100)).save(source)
                result=subprocess.run([sys.executable,str(WORKER),str(source),str(target)],capture_output=True)
                self.assertNotEqual(result.returncode,0);self.assertFalse(target.exists())

if __name__=='__main__': unittest.main()
