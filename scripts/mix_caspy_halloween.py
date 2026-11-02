#!/usr/bin/env python3
"""Original Halloween score + synthesized wordless ghost choir. No speech input.
Usage: python3 scripts/mix_caspy_halloween.py storyboard.json output-directory
"""
import array
import json
import math
from pathlib import Path
import random
import sys
import wave

RATE = 44100
TAU = math.tau


def main():
    scenes = json.loads(Path(sys.argv[1]).read_text())
    duration = sum(scene['seconds'] for scene in scenes)
    count = RATE * duration
    output = Path(sys.argv[2]); output.mkdir(parents=True, exist_ok=True)
    music = array.array('f', [0]) * count
    chords = [(50,53,57),(46,50,53),(43,46,50),(45,49,52)]

    def tone(start, seconds, midi, amplitude, kind):
        frequency = 440 * 2 ** ((midi-69)/12)
        first = int(start*RATE)
        for i in range(max(0,min(int(seconds*RATE), count-first))):
            t = i/RATE
            phase = TAU * frequency * t
            if kind == 'bell':
                value = (math.sin(phase)*math.exp(-5*t) + .28*math.sin(phase*2.005)*math.exp(-8*t) + .09*math.sin(phase*3.01)*math.exp(-12*t)) * min(1,t/.005)
            elif kind == 'choir':
                # A vowel-like harmonic pad, with slow breath and pitch movement.
                # Synthesized oscillators only: no narrator, lyrics or speech files.
                phase += .06*math.sin(TAU*4.2*t)+.16*math.sin(TAU*.35*t)
                envelope = max(0,min(1,t/.8,(seconds-t)/1.1))
                value = (.55*math.sin(phase)+.28*math.sin(phase*2)+.12*math.sin(phase*3)+.05*math.sin(phase*5))*envelope
                value *= .68+.32*math.sin(math.pi*min(1,t/seconds))
            else:
                envelope = max(0,min(1,t/.12,(seconds-t)/.3))
                value = (.70*math.sin(phase)+.18*math.sin(phase*2)+.07*math.sin(phase*3))*envelope
            music[first+i] += value*amplitude

    for bar in range(math.ceil(duration/2)):
        chord = chords[bar%4]
        for note in chord: tone(bar*2,2.08,note+12,.024,'organ')
        tone(bar*2,1.8,chord[0]-12,.040,'organ')
        for beat,degree in enumerate([0,2,1,2]): tone(bar*2+beat*.5,1.05,chord[degree]+24,.065,'bell')
        if bar%2 == 0:
            tone(bar*2,4.2,chord[0]+12,.055,'choir')
            tone(bar*2+.06,4.0,chord[1]+12,.030,'choir')
    print('Composed bells, organ, bass and wordless ghost choir.',flush=True)

    rng = random.Random(20261102)
    starts=[]; elapsed=0
    for scene in scenes: starts.append(elapsed); elapsed+=scene['seconds']
    low=0.0
    for i in range(count):
        t=i/RATE; noise=rng.uniform(-1,1); low+=.025*(noise-low)
        wind=low*(.012+.030*(.5+.5*math.sin(TAU*t/10))**3)
        shaker=(noise-low)*.006*math.exp(-35*(t%.5))
        music[i]+=wind+shaker
    for start in starts:
        for delay,note in [(.28,81),(.50,86),(1.05,89)]: tone(start+delay,.38,note,.024,'bell')
        if start>0:
            first=int((start-.40)*RATE)
            for n in range(int(.40*RATE)):
                t=n/RATE; envelope=(t/.4)**2*(1-t/.4)
                music[first+n]+=rng.uniform(-1,1)*envelope*.11
    # A tiny stereo echo softens the choir and leaves the typography in front.
    left,right=array.array('f'),array.array('f'); delay=int(RATE*.11)
    for i,value in enumerate(music):
        t=i/RATE; fade=max(0,min(1,t/1.2,(duration-t)/2.0)); pan=.15*math.sin(TAU*t/13)
        echo=music[i-delay]*.17 if i>=delay else 0
        left.append((value*(1-pan)+echo)*fade)
        right.append((value*(1+pan)+echo*.8)*fade)
    peak=max(max(map(abs,left)),max(map(abs,right)))
    rms=math.sqrt(sum(l*l+r*r for l,r in zip(left,right))/(count*2))
    master=min(.78/peak,10**(-20.5/20)/rms)
    pcm=array.array('h')
    for l,r in zip(left,right): pcm.extend((round(l*master*32767),round(r*master*32767)))
    if sys.byteorder!='little': pcm.byteswap()
    with wave.open(str(output/'soundtrack.wav'),'wb') as target:
        target.setnchannels(2);target.setsampwidth(2);target.setframerate(RATE);target.writeframes(pcm.tobytes())
    report={'duration_seconds':duration,'sample_rate':RATE,'channels':2,'speech_tracks':0,'speech_inputs_read':0,'wordless_choir':'Synthesized vowel-like oscillators; no spoken words', 'peak_dbfs':round(20*math.log10(peak*master),2),'rms_dbfs':round(20*math.log10(rms*master),2),'clipped_samples':sum(abs(x)>=32767 for x in pcm),'chapter_starts':starts,'seed':20261102}
    (output/'audio-qa.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)


if __name__=='__main__': main()
