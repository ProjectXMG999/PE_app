import fs from 'fs';
import path from 'path';
import { fixes } from './final-fix-dictionary.js';

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, 'audio-output');

let totalFixed = 0;
let filesDeleted = 0;
let filesNotPresent = 0;
const deletedList = [];

for (const [wordId, change] of Object.entries(fixes)) {
  const packId = wordId.split('-').slice(0, 2).join('-');
  const packPath = `src/data/packs/${packId}.json`;
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  const word = pack.words.find(w => w.id === wordId);
  if (!word) {
    console.log(`WARN: ${wordId} not found in ${packId}`);
    continue;
  }

  const audioToDelete = [];

  if (change.polish !== undefined) {
    word.polish = change.polish;
    audioToDelete.push(word.audioWordPl || `${wordId}-word-pl.mp3`);
  }
  if (change.sentenceEn !== undefined) {
    word.sentenceEn = change.sentenceEn;
    audioToDelete.push(word.audioSentence || `${wordId}-sentence.mp3`);
  }
  if (change.sentencePl !== undefined) {
    word.sentencePl = change.sentencePl;
    audioToDelete.push(word.audioSentencePl || `${wordId}-sentence-pl.mp3`);
  }

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  totalFixed++;

  for (const file of audioToDelete) {
    const filePath = path.join(AUDIO_DIR, packId, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      filesDeleted++;
      deletedList.push(`${packId}/${file}`);
    } else {
      filesNotPresent++;
    }
  }
}

console.log(`Fixed ${totalFixed} words (dictionary size: ${Object.keys(fixes).length})`);
console.log(`Deleted ${filesDeleted} stale audio files (already generated with old text)`);
console.log(`${filesNotPresent} audio files were not present yet (not generated, nothing to delete)`);
console.log('\nDeleted files:');
deletedList.forEach(f => console.log('  ' + f));
