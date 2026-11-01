#!/usr/bin/env python3
"""Compose a music-only Caspy Halloween soundtrack. No speech inputs are read.

Usage: python3 scripts/mix_caspy_halloween.py path/to/scenes.json output-directory
All source audio is local. Uses the Python standard library only.
"""
import array
import json
import math
from pathlib import Path
import random
import sys
import wave

RATE = 44100
DURATION = 56
COUNT = RATE * DURATION
TAU = math.tau


def write_wav(path, data, channels):
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(RATE)
        samples = array.array('h', (round(max(-0.97, min(0.97, x)) * 32767) for x in data))
        if sys.byteorder != 'little':
            samples.byteswap()
        output.writeframes(samples.tobytes())


def main():
    scenes = json.loads(Path(sys.argv[1]).read_text())
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    music = array.array('f', [0]) * COUNT
    chords = [(50, 53, 57), (46, 50, 53), (43, 46, 50), (45, 49, 52)]

    def tone(start, seconds, midi, amplitude, kind):
        freq = 440 * 2 ** ((midi - 69) / 12)
        first = int(start * RATE)
        for i in range(min(int(seconds * RATE), COUNT - first)):
            t = i / RATE
            phase = TAU * freq * t
            if kind == 'bell':
                value = (math.sin(phase) * math.exp(-5.0 * t)
                         + .30 * math.sin(phase * 2.005) * math.exp(-8 * t)
                         + .10 * math.sin(phase * 3.01) * math.exp(-12 * t))
                value *= min(1, t / .005)
            else:
                envelope = min(1, t / .15, (seconds - t) / .28)
                value = (.72 * math.sin(phase) + .17 * math.sin(2 * phase)
                         + .06 * math.sin(3 * phase)) * max(0, envelope)
                value *= .91 + .09 * math.sin(TAU * 3.8 * t)
            music[first + i] += value * amplitude

    # A D-minor / B-flat / G-minor / A cadence, repeated once per eight-second chapter.
    for bar in range(28):
        chord = chords[bar % 4]
        for note in chord:
            tone(bar * 2, 2.04, note + 12, .031, 'organ')
        tone(bar * 2, 1.8, chord[0] - 12, .042, 'organ')
        for beat, degree in enumerate([0, 2, 1, 2]):
            tone(bar * 2 + beat * .5, 1.15, chord[degree] + 24, .075, 'bell')
        if bar % 4 == 0:
            tone(bar * 2 + .05, 1.45, chord[0] + 36, .033, 'bell')
    print('Composed original celesta, organ, and bass layers.', flush=True)

    rng = random.Random(20261101)
    low = 0.0
    for i in range(COUNT):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low += .035 * (noise - low)
        wind = low * (.008 + .018 * (0.5 + 0.5 * math.sin(TAU * t / 8)) ** 3)
        beat = t % .5
        shaker = (noise - low) * .007 * math.exp(-32 * beat)
        music[i] += wind + shaker

    # Soft scene-entry bells and bubble pops accent the bouncy typography.
    for chapter in range(7):
        for delay, pitch in [(0.3, 81), (0.65, 86), (1.1, 89)]:
            tone(chapter * 8 + delay, .4, pitch, .025, 'bell')
    left, right = array.array('f'), array.array('f')
    for i in range(COUNT):
        t = i / RATE
        fade = max(0, min(1, t / .7, (DURATION - t) / 1.5))
        pan = .10 * math.sin(TAU * t / 12)
        value = music[i] * fade
        left.append(value * (1 - pan))
        right.append(value * (1 + pan))
    peak = max(max(abs(x) for x in left), max(abs(x) for x in right))
    rms = math.sqrt(sum(l*l + r*r for l,r in zip(left,right)) / (COUNT*2))
    master = min(.70 / peak, 10 ** (-22 / 20) / rms)
    interleaved = array.array('f')
    for l, r in zip(left, right):
        interleaved.extend((l * master, r * master))
    write_wav(output / 'soundtrack.wav', interleaved, 2)
    report = {
        'duration_seconds': DURATION, 'sample_rate': RATE, 'channels': 2,
        'speech_tracks': 0, 'speech_inputs_read': 0,
        'music': 'Original D-minor celesta, organ, bass, wind, and transition chimes',
        'peak_dbfs': round(20 * math.log10(peak * master), 2),
        'rms_dbfs': round(20 * math.log10(rms * master), 2),
        'fade_in_seconds': .7, 'fade_out_seconds': 1.5,
    }
    (output / 'audio-qa.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
