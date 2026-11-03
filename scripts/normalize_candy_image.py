"""Validate a local generated PNG and remove embedded prompt/EXIF metadata."""
import sys
from PIL import Image,ImageStat

def main():
    with Image.open(sys.argv[1]) as image:
        if image.size!=(512,512): raise ValueError('invalid_image')
        clean=Image.new('RGB',image.size);clean.paste(image.convert('RGB'))
        stats=ImageStat.Stat(clean)
        if max(stats.mean)<3 or max(stats.stddev)<2: raise ValueError('invalid_image')
        clean.save(sys.argv[2],format='PNG')

if __name__=='__main__': main()
