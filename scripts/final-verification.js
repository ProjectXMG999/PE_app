import fs from 'fs';

let totalWords = 0;
let withSentence = 0;
let doublePunct = 0;
let missingPunct = 0;
let fallbackRemaining = 0;
let unmatchedBrackets = 0;
let whitespaceIssues = 0;
const issues = [];

for (let i = 1; i <= 866; i++) {
  const num = String(i).padStart(3, '0');
  const p = `src/data/packs/t1-p${num}.json`;
  if (!fs.existsSync(p)) continue;
  const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pack.level !== 1) continue;

  pack.words.forEach(w => {
    totalWords++;
    if (!w.sentenceEn) return;
    withSentence++;

    [w.sentenceEn, w.sentencePl].forEach((s, idx) => {
      const lang = idx === 0 ? 'EN' : 'PL';
      if (/[.!?][.!?]$/.test(s)) { doublePunct++; issues.push(`DOUBLE-PUNCT ${w.id} ${lang}: "${s}"`); }
      if (!/[.!?]$/.test(s)) { missingPunct++; issues.push(`MISSING-PUNCT ${w.id} ${lang}: "${s}"`); }
      if (/^\s|\s$/.test(s)) { whitespaceIssues++; issues.push(`WHITESPACE ${w.id} ${lang}: "${s}"`); }
      const opens = (s.match(/[([{]/g) || []).length;
      const closes = (s.match(/[)\]}]/g) || []).length;
      if (opens !== closes) { unmatchedBrackets++; issues.push(`BRACKETS ${w.id} ${lang}: "${s}"`); }
    });

    if (/^(i use |używam )/i.test(w.sentenceEn) || /^(i use |używam )/i.test(w.sentencePl)) {
      fallbackRemaining++;
      issues.push(`FALLBACK-REMAINS ${w.id}: "${w.sentenceEn}"`);
    }
  });
}

console.log('=== FINAL VERIFICATION REPORT ===\n');
console.log(`Total level-1 words: ${totalWords}`);
console.log(`Words with sentences: ${withSentence} (${totalWords - withSentence} missing)`);
console.log(`Double terminal punctuation: ${doublePunct}`);
console.log(`Missing terminal punctuation: ${missingPunct}`);
console.log(`Whitespace issues: ${whitespaceIssues}`);
console.log(`Unmatched brackets: ${unmatchedBrackets}`);
console.log(`Remaining "I use X" fallback: ${fallbackRemaining}`);

// Check t1-p111 / t1-p112 are properly nulled
['t1-p111', 't1-p112'].forEach(id => {
  const pack = JSON.parse(fs.readFileSync(`src/data/packs/${id}.json`, 'utf-8'));
  const populated = pack.words.filter(w => w.sentenceEn !== null).length;
  console.log(`${id} (level ${pack.level}): ${populated}/${pack.words.length} still populated (should be 0)`);
});

if (issues.length) {
  console.log('\n--- Issues ---');
  issues.forEach(i => console.log(i));
} else {
  console.log('\n✓ Zero issues found.');
}
