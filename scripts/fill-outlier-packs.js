import fs from 'fs';

// t1-p678 (Kraje) and t1-p694 (Biznes) duplicate the exact word sets of
// t1-p085/t1-p087 and t1-p103/t1-p104 respectively. Reuse those already
// rubric-checked sentences by matching on the English word text.
const sentencesByEnglish = {
  // Kraje (from t1-p085 / t1-p087)
  'england': { en: "I've never been to England.", pl: 'Nigdy nie byłem w Anglii.' },
  'english': { en: 'My teacher is English.', pl: 'Moja nauczycielka jest Angielką.' },
  'united kingdom': { en: 'The United Kingdom has four nations.', pl: 'Zjednoczone Królestwo ma cztery narody.' },
  'great britain': { en: 'Great Britain is an island.', pl: 'Wielka Brytania jest wyspą.' },
  'british': { en: 'My colleague is British.', pl: 'Moja koleżanka jest Brytyjką.' },
  'china': { en: 'China has a huge population.', pl: 'Chiny mają ogromną populację.' },
  'chinese': { en: 'My neighbor is Chinese.', pl: 'Moja sąsiadka jest Chinką.' },
  'france': { en: "We're flying to France in June.", pl: 'Lecimy do Francji w czerwcu.' },
  'french': { en: 'My friend is French.', pl: 'Moja przyjaciółka jest Francuzką.' },
  'country': { en: 'Which country are you from?', pl: 'Z jakiego kraju jesteś?' },
  'poland': { en: 'Poland is in central Europe.', pl: 'Polska leży w środkowej Europie.' },
  'pole': { en: "She's a proud Pole.", pl: 'Ona jest dumną Polką.' },
  'india': { en: 'Spices from India are amazing.', pl: 'Przyprawy z Indii są niesamowite.' },
  'indian': { en: 'My colleague is Indian.', pl: 'Moja koleżanka jest Hinduską.' },
  'german': { en: 'His wife is German.', pl: 'Jego żona jest Niemką.' },

  // Biznes (from t1-p103 / t1-p104)
  'company': { en: 'I started my own company.', pl: 'Założyłem własną firmę.' },
  'client': { en: 'The client called this morning.', pl: 'Klient dzwonił dziś rano.' },
  'plan': { en: "What's the plan for today?", pl: 'Jaki jest plan na dziś?' },
  'product': { en: 'This product sells really well.', pl: 'Ten produkt bardzo dobrze się sprzedaje.' },
  'bill': { en: 'Can we get the bill?', pl: 'Możemy prosić o rachunek?' },
  'chance': { en: 'Give me one more chance.', pl: 'Daj mi jeszcze jedną szansę.' },
  'deal': { en: 'We made a good deal.', pl: 'Zrobiliśmy dobry interes.' },
  'result': { en: 'The results were surprising.', pl: 'Wyniki były zaskakujące.' },
  'sale': { en: "Everything's on sale today.", pl: 'Wszystko jest dziś na wyprzedaży.' },
  'discount': { en: 'Can I get a discount?', pl: 'Mogę dostać zniżkę?' },
  'end': { en: 'How does the story end?', pl: 'Jak kończy się ta historia?' },
  'happen': { en: 'What happened here?', pl: 'Co się tutaj wydarzyło?' },
  'mean': { en: 'What do you mean by that?', pl: 'Co masz na myśli?' },
  'must': { en: 'You must try this cake.', pl: 'Musisz spróbować tego ciasta.' },
  'offer': { en: 'They offered me the job.', pl: 'Zaoferowali mi tę pracę.' },
};

['t1-p678', 't1-p694'].forEach(packId => {
  const packPath = `src/data/packs/${packId}.json`;
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  let updated = 0;
  let missed = [];

  pack.words.forEach(word => {
    const key = word.english.toLowerCase();
    if (sentencesByEnglish[key]) {
      word.sentenceEn = sentencesByEnglish[key].en;
      word.sentencePl = sentencesByEnglish[key].pl;
      updated++;
    } else {
      missed.push(word.english);
    }
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`${packId}: ${updated}/${pack.words.length} words filled${missed.length ? ', MISSED: ' + missed.join(', ') : ''}`);
});
