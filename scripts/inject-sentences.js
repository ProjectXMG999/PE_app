import fs from 'fs';
import path from 'path';

const sentencesData = JSON.parse(fs.readFileSync(
  'C:\\Users\\MACIEJ~1\\AppData\\Local\\Temp\\claude\\c--Users-MaciejGrabarczyk-Desktop-an-PE-app\\f55d3ead-c000-4115-9ee5-7ab21bc41e05\\scratchpad\\sentences.json',
  'utf-8'
));

const sentenceMap = {};
sentencesData.sentences.forEach(s => {
  sentenceMap[s.wordId] = { sentenceEn: s.sentenceEn, sentencePl: s.sentencePl };
});

console.log(`Loaded ${Object.keys(sentenceMap).length} sentences`);

for (let i = 1; i <= 28; i++) {
  const num = String(i).padStart(3, '0');
  const packPath = `src/data/packs/t1-p${num}.json`;

  if (!fs.existsSync(packPath)) {
    console.log(`Skip: ${packPath} does not exist`);
    continue;
  }

  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  let updated = 0;

  pack.words.forEach(word => {
    if (sentenceMap[word.id]) {
      word.sentenceEn = sentenceMap[word.id].sentenceEn;
      word.sentencePl = sentenceMap[word.id].sentencePl;
      updated++;
    }
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`Updated ${packPath}: ${updated} words`);
}

console.log('Done injecting sentences');
