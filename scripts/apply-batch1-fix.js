import fs from 'fs';
import { rewrites } from './batch1-fix-dictionary.js';

let totalUpdated = 0;
const packIds = new Set(Object.keys(rewrites).map(id => id.split('-').slice(0, 2).join('-')));

for (const packId of packIds) {
  const packPath = `src/data/packs/${packId}.json`;
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
  console.log(`${packId}: ${updated} words fixed`);
}

console.log(`\nTotal fixed: ${totalUpdated} (dictionary size: ${Object.keys(rewrites).length})`);
