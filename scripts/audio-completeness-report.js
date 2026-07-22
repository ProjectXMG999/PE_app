import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PACK_DIR = path.join(ROOT, 'src/data/packs');
const AUDIO_DIR = path.join(ROOT, 'audio-output');

const targetPacks = [];
for (let i = 1; i <= 866; i++) {
  const num = String(i).padStart(3, '0');
  const p = path.join(PACK_DIR, `t1-p${num}.json`);
  if (!fs.existsSync(p)) continue;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pack.level === 1) targetPacks.push(pack);
}
['t1-p678', 't1-p694'].forEach(id => {
  const p = path.join(PACK_DIR, `${id}.json`);
  if (fs.existsSync(p)) {
    const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (!targetPacks.find(x => x.id === id)) targetPacks.push(pack);
  }
});

let fullyComplete = 0, partial = 0, empty = 0;
let totalExpected = 0, totalPresent = 0;
const partialList = [];
const emptyList = [];

for (const pack of targetPacks) {
  const packAudioDir = path.join(AUDIO_DIR, pack.id);
  const expectedFiles = [];
  pack.words.forEach(w => {
    expectedFiles.push(w.audioWord);
    expectedFiles.push(w.audioWordPl || `${w.id}-word-pl.mp3`);
    if (w.sentenceEn) expectedFiles.push(w.audioSentence);
    if (w.sentencePl) expectedFiles.push(w.audioSentencePl || `${w.id}-sentence-pl.mp3`);
  });
  const expectedCount = expectedFiles.length;
  let presentCount = 0;
  if (fs.existsSync(packAudioDir)) {
    for (const f of expectedFiles) {
      if (fs.existsSync(path.join(packAudioDir, f))) presentCount++;
    }
  }
  totalExpected += expectedCount;
  totalPresent += presentCount;

  if (presentCount === expectedCount) {
    fullyComplete++;
  } else if (presentCount === 0) {
    empty++;
    emptyList.push(pack.id);
  } else {
    partial++;
    partialList.push(`${pack.id} (${pack.name}): ${presentCount}/${expectedCount}`);
  }
}

console.log('=== AUDIO COMPLETENESS REPORT ===\n');
console.log(`Total Level-1 packs: ${targetPacks.length}`);
console.log(`Fully complete: ${fullyComplete}`);
console.log(`Partial: ${partial}`);
console.log(`Empty (no audio at all): ${empty}`);
console.log(`\nTotal audio files expected: ${totalExpected}`);
console.log(`Total audio files present: ${totalPresent} (${(100*totalPresent/totalExpected).toFixed(1)}%)`);
console.log(`Missing: ${totalExpected - totalPresent}`);

if (partialList.length) {
  console.log('\n--- Partial packs ---');
  partialList.forEach(p => console.log(p));
}
if (emptyList.length) {
  console.log('\n--- Empty packs (never started) ---');
  emptyList.forEach(p => console.log(p));
}
