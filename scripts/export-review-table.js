import fs from 'fs';

const lines = [];
for (let i = 1; i <= 866; i++) {
  const num = String(i).padStart(3, '0');
  const p = `src/data/packs/t1-p${num}.json`;
  if (!fs.existsSync(p)) continue;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pack.level !== 1) continue;
  lines.push(`\n### ${pack.id} — ${pack.name} (${pack.category})`);
  pack.words.forEach(w => {
    lines.push(`${w.id} | EN: ${w.english} | PL: ${w.polish} | SentEN: ${w.sentenceEn} | SentPL: ${w.sentencePl}`);
  });
}
// also outlier packs already included since level check covers them

const outPath = 'C:/Users/MACIEJ~1/AppData/Local/Temp/claude/c--Users-MaciejGrabarczyk-Desktop-an-PE-app/f55d3ead-c000-4115-9ee5-7ab21bc41e05/scratchpad/review_table.txt';
fs.writeFileSync(outPath, lines.join('\n'));
console.log('Total lines:', lines.length);
