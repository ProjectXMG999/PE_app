import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PACK_DIR = path.join(ROOT, 'src/data/packs');

function csvEscape(s) {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const rows = [['packId', 'packName', 'category', 'wordId', 'english', 'polish', 'sentenceEn', 'sentencePl']];

for (let i = 1; i <= 866; i++) {
  const num = String(i).padStart(3, '0');
  const p = path.join(PACK_DIR, `t1-p${num}.json`);
  if (!fs.existsSync(p)) continue;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pack.level !== 1) continue;
  pack.words.forEach(w => {
    rows.push([pack.id, pack.name, pack.category, w.id, w.english, w.polish, w.sentenceEn, w.sentencePl]);
  });
}
const csv = rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
const outPath = path.join(ROOT, 'level1-sentences-review.csv');
// BOM for correct Polish diacritics display in Excel
fs.writeFileSync(outPath, '﻿' + csv, 'utf-8');
console.log(`Exported ${rows.length - 1} words to ${outPath}`);
