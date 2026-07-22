import fs from 'fs';
import { rewrites } from './fallback-rewrite-dictionary.js';

const packIds = new Set(Object.keys(rewrites).map(id => id.split('-').slice(0, 2).join('-')));

let totalUpdated = 0;
let totalMissing = 0;
const missing = [];

for (const packId of packIds) {
  const packPath = `src/data/packs/${packId}.json`;
  if (!fs.existsSync(packPath)) {
    console.log(`WARN: ${packPath} does not exist`);
    continue;
  }
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  let updated = 0;

  pack.words.forEach(word => {
    if (rewrites[word.id]) {
      word.sentenceEn = rewrites[word.id].en;
      word.sentencePl = rewrites[word.id].pl;
      updated++;
    }
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  totalUpdated += updated;
  console.log(`${packId}: ${updated} words rewritten`);
}

// Verify every dictionary entry was actually applied
for (const wordId of Object.keys(rewrites)) {
  const packId = wordId.split('-').slice(0, 2).join('-');
  const packPath = `src/data/packs/${packId}.json`;
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  const word = pack.words.find(w => w.id === wordId);
  if (!word || word.sentenceEn !== rewrites[wordId].en) {
    missing.push(wordId);
    totalMissing++;
  }
}

console.log(`\nTotal rewritten: ${totalUpdated}`);
console.log(`Dictionary size: ${Object.keys(rewrites).length}`);
console.log(`Verification failures: ${totalMissing}`);
if (missing.length) console.log('Missing/mismatched:', missing);
