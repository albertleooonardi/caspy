import storyboard from './walkthrough.json';
let elapsed = 0;
export const chapters = storyboard.map(scene => {
  const chapter = { ...scene, start: elapsed, end: elapsed + scene.seconds };
  elapsed += scene.seconds;
  return chapter;
});
export const walkthroughDuration = elapsed;
export function chapterAt(seconds: number) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return chapters.reduce((current, chapter, index) => time >= chapter.start ? index : current, 0);
}
export function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
