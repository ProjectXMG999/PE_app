import fs from 'fs';

const out = [];
for (let i = 2; i <= 28; i++) {
  const num = String(i).padStart(3, '0');
  const p = `src/data/packs/t1-p${num}.json`;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  pack.words.forEach(w => {
    out.push({ packId: pack.id, packName: pack.name, category: pack.category, wordId: w.id, english: w.english, polish: w.polish });
  });
}
const outPath = 'C:/Users/MACIEJ~1/AppData/Local/Temp/claude/c--Users-MaciejGrabarczyk-Desktop-an-PE-app/f55d3ead-c000-4115-9ee5-7ab21bc41e05/scratchpad/batch1_real_words.json';
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Total words:', out.length);
