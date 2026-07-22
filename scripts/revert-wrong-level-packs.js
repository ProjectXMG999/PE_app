import fs from 'fs';

['t1-p111', 't1-p112'].forEach(id => {
  const packPath = `src/data/packs/${id}.json`;
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));

  if (pack.level !== 2) {
    throw new Error(`${id} expected level 2, got ${pack.level} — aborting to avoid wrong revert`);
  }

  pack.words.forEach(word => {
    word.sentenceEn = null;
    word.sentencePl = null;
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`Reverted ${packPath} (level ${pack.level}, ${pack.words.length} words nulled)`);
});
