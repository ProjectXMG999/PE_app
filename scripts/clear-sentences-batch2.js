import fs from 'fs';

for (let i = 29; i <= 56; i++) {
  const num = String(i).padStart(3, '0');
  const packPath = `src/data/packs/t1-p${num}.json`;

  if (!fs.existsSync(packPath)) {
    continue;
  }

  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));

  pack.words.forEach(word => {
    word.sentenceEn = null;
    word.sentencePl = null;
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`Cleared ${packPath}`);
}

console.log('Done clearing sentences for batch 2');
