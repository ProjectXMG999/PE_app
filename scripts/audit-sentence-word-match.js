import fs from 'fs';

// Heuristic: does the sentenceEn plausibly relate to the target English word?
// We check whether a normalized form of the word (or its stem, stripping common
// suffixes) appears as a substring in the sentence. This won't catch every subtle
// case, but it will flag clear structural mismatches (leftover positional-offset
// bugs, copy-paste errors, wrong-pack contamination).
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

function wordAppearsIn(word, sentence) {
  const w = normalize(word);
  const s = normalize(sentence);
  if (!w || !s) return false;
  // Multi-word phrases (e.g. "toilet paper"): check the whole phrase or its first significant word.
  const parts = w.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (part.length < 2) continue; // skip single-letter tokens like "a"
    // stem: strip trailing s/es/ed/ing to catch simple inflections
    const stem = part.replace(/(ing|ed|es|s)$/,'');
    const re = new RegExp('\\b' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (re.test(s)) return true;
  }
  return false;
}

const flagged = [];
let totalChecked = 0;

for (let i = 1; i <= 866; i++) {
  const num = String(i).padStart(3, '0');
  const p = `src/data/packs/t1-p${num}.json`;
  if (!fs.existsSync(p)) continue;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pack.level !== 1) continue;

  pack.words.forEach(w => {
    if (!w.sentenceEn) return;
    totalChecked++;
    if (!wordAppearsIn(w.english, w.sentenceEn)) {
      flagged.push({
        packId: pack.id,
        packName: pack.name,
        wordId: w.id,
        english: w.english,
        polish: w.polish,
        sentenceEn: w.sentenceEn,
        sentencePl: w.sentencePl,
      });
    }
  });
}

console.log(`Checked ${totalChecked} words with sentences.`);
console.log(`Flagged (word not found in sentence, needs manual review): ${flagged.length}\n`);

const outPath = 'C:/Users/MACIEJ~1/AppData/Local/Temp/claude/c--Users-MaciejGrabarczyk-Desktop-an-PE-app/f55d3ead-c000-4115-9ee5-7ab21bc41e05/scratchpad/flagged_mismatches.json';
fs.writeFileSync(outPath, JSON.stringify(flagged, null, 2));

flagged.forEach(f => {
  console.log(`${f.wordId} [${f.packName}] "${f.english}"/"${f.polish}" -> EN: "${f.sentenceEn}" | PL: "${f.sentencePl}"`);
});
