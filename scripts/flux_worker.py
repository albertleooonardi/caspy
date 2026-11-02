#!/usr/bin/env python3
"""One FLUX.1-dev hosted image call. Credentials stay in the server process env.
JSON stdin: {prompt, seed, output}. JSON stdout contains safe status only.
"""
import json
import os
from pathlib import Path
import sys


def main():
    try:
        from huggingface_hub import InferenceClient
        from PIL import Image,ImageStat
        request=json.load(sys.stdin)
        token=os.environ.get('HF_TOKEN')
        if not token: raise RuntimeError('configuration')
        client=InferenceClient(provider='fal-ai',api_key=token,timeout=180)
        image=client.text_to_image(request['prompt'],model='black-forest-labs/FLUX.1-dev',
            width=1024,height=1024,num_inference_steps=28,guidance_scale=3.5,seed=request['seed'],
            extra_body={'enable_safety_checker':True,'output_format':'png','num_images':1})
        if image.width!=1024 or image.height!=1024: raise RuntimeError('invalid_image')
        stats=ImageStat.Stat(image.convert('RGB'))
        if max(stats.mean)<3 and max(stats.stddev)<1: raise RuntimeError('blocked')
        # Do not retain EXIF or provider metadata containing private prompts.
        clean=Image.new('RGB',image.size);clean.paste(image.convert('RGB'))
        clean.save(Path(request['output']),format='PNG')
        print(json.dumps({'ok':True,'model':'black-forest-labs/FLUX.1-dev','provider':'fal-ai','safety_checker':True}))
    except Exception as error:
        kind='configuration' if isinstance(error,ImportError) or str(error)=='configuration' else 'blocked' if str(error)=='blocked' else 'provider'
        print(json.dumps({'ok':False,'kind':kind}));sys.exit(1)


if __name__=='__main__': main()
