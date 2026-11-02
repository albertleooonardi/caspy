import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chapters, chapterAt, timestamp, walkthroughDuration } from './walkthrough';

test('chapter boundaries and seek labels stay consistent for the complete film', () => {
  assert.equal(walkthroughDuration,100);
  assert.equal(chapters.length,10);
  assert.equal(new Set(chapters.map(chapter => chapter.id)).size,10);
  for (const [index,chapter] of chapters.entries()) {
    assert.ok(chapter.seconds >= 6);
    assert.equal(chapterAt(chapter.start),index);
    assert.equal(chapterAt(chapter.end-.001),index);
    assert.equal(chapter.end,chapters[index+1]?.start ?? walkthroughDuration);
    assert.ok(['/play','/register','/account','/research','/rules'].includes(chapter.href));
  }
  assert.equal(chapterAt(-1),0);
  assert.equal(chapterAt(Number.NaN),0);
  assert.equal(chapterAt(100),9);
  assert.equal(chapterAt(999),9);
  assert.equal(timestamp(100),'1:40');
  assert.equal(timestamp(8),'0:08');
});

test('published instruction captions match every shared chapter boundary', () => {
  const vtt=readFileSync(new URL('../../public/videos/caspy-showcase.en.vtt',import.meta.url),'utf8');
  assert.ok(vtt.startsWith('WEBVTT'));
  const cues=[...vtt.matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g)];
  const seconds=(value: string) => { const [hours,minutes,rest]=value.split(':'); return Number(hours)*3600+Number(minutes)*60+Number(rest); };
  assert.equal(cues.length,chapters.length);
  for (const [index,cue] of cues.entries()) {
    assert.equal(seconds(cue[1]),chapters[index].start);
    assert.equal(seconds(cue[2]),chapters[index].end);
    assert.ok(vtt.includes(chapters[index].label));
  }
});
