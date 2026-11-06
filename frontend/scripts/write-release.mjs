import { writeFile } from 'node:fs/promises';
const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RELEASE_SHA || process.env.GITHUB_SHA || '';
await writeFile(new URL('../dist/release.json',import.meta.url),JSON.stringify({commit:/^[0-9a-f]{40}$/.test(commit)?commit:null}));
