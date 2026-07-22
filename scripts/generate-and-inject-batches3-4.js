import fs from 'fs';

const sentenceDictionary = {
  // Pronouns & basic
  'he': { en: 'He is here.', pl: 'On jest tutaj.' },
  'i': { en: 'I am here.', pl: 'Jestem tutaj.' },
  'it': { en: 'It is here.', pl: 'To jest tutaj.' },
  'she': { en: 'She is here.', pl: 'Ona jest tutaj.' },
  'they': { en: 'They are here.', pl: 'Oni są tutaj.' },
  'we': { en: 'We are here.', pl: 'My jesteśmy tutaj.' },
  'you': { en: 'You are here.', pl: 'Ty jesteś tutaj.' },
  'me': { en: 'Call me.', pl: 'Zadzwoń do mnie.' },
  'him': { en: 'I know him.', pl: 'Znam go.' },
  'her': { en: 'I know her.', pl: 'Znam ją.' },
  'us': { en: 'Come with us.', pl: 'Chodź z nami.' },
  'them': { en: 'I know them.', pl: 'Znam ich.' },
  'my': { en: 'My book is here.', pl: 'Moja książka jest tutaj.' },
  'his': { en: 'His house is big.', pl: 'Jego dom jest duży.' },
  'her': { en: 'Her name is Mary.', pl: 'Jej imię to Maria.' },
  'their': { en: 'Their car is red.', pl: 'Ich samochód jest czerwony.' },
  'this': { en: 'This is good.', pl: 'To jest dobre.' },
  'that': { en: 'That is good.', pl: 'Tamto jest dobre.' },
  'these': { en: 'These are good.', pl: 'Te są dobre.' },
  'those': { en: 'Those are good.', pl: 'Tamte są dobre.' },

  // Kitchen items
  'cup': { en: 'A cup of tea.', pl: 'Filiżanka herbaty.' },
  'mug': { en: 'A hot mug.', pl: 'Gorący kubek.' },
  'fridge': { en: 'The fridge is cold.', pl: 'Lodówka jest zimna.' },
  'stove': { en: 'The stove is hot.', pl: 'Kuchenka jest gorąca.' },
  'sink': { en: 'Wash at the sink.', pl: 'Umyj się w zlewie.' },
  'counter': { en: 'Put it on the counter.', pl: 'Połóż to na blacie.' },
  'freezer': { en: 'The freezer is icy.', pl: 'Zamrażarka jest lodowata.' },
  'dishwasher': { en: 'Use the dishwasher.', pl: 'Używaj zmywarki.' },
  'microwave': { en: 'Heat in the microwave.', pl: 'Podgrzej w mikrofalach.' },
  'blender': { en: 'Use a blender.', pl: 'Używaj blendera.' },

  // Time expressions
  'ago': { en: 'Two days ago.', pl: 'Dwa dni temu.' },
  'before': { en: 'Before noon.', pl: 'Przed południem.' },
  'after': { en: 'After dinner.', pl: 'Po obiedzie.' },
  'during': { en: 'During the day.', pl: 'Podczas dnia.' },
  'while': { en: 'While you sleep.', pl: 'Gdy śpisz.' },
  'until': { en: 'Until tomorrow.', pl: 'Aż do jutra.' },
  'since': { en: 'Since morning.', pl: 'Od rana.' },
  'between': { en: 'Between you and me.', pl: 'Między tobie a mną.' },
  'among': { en: 'Among us.', pl: 'Wśród nas.' },
  'within': { en: 'Within the hour.', pl: 'W ciągu godziny.' },

  // Verbs (extended)
  'go': { en: 'Let\'s go.', pl: 'Chodźmy.' },
  'come': { en: 'Come here.', pl: 'Chodź tutaj.' },
  'see': { en: 'I see.', pl: 'Widzę.' },
  'look': { en: 'Look at this.', pl: 'Spójrz na to.' },
  'watch': { en: 'Watch the movie.', pl: 'Oglądaj film.' },
  'listen': { en: 'Listen to me.', pl: 'Słuchaj mnie.' },
  'hear': { en: 'I hear you.', pl: 'Cię słyszę.' },
  'sit': { en: 'Sit down.', pl: 'Usiądź.' },
  'stand': { en: 'Stand up.', pl: 'Wstań.' },
  'run': { en: 'Run fast.', pl: 'Biegnij szybko.' },
  'walk': { en: 'Walk slowly.', pl: 'Idź powoli.' },
  'swim': { en: 'Swim in the pool.', pl: 'Pływaj w basenie.' },
  'fly': { en: 'Fly a kite.', pl: 'Puszczaj latawiec.' },
  'climb': { en: 'Climb the stairs.', pl: 'Wchodź po schodach.' },
  'jump': { en: 'Jump high.', pl: 'Skocz wysoko.' },
  'fall': { en: 'Don\'t fall.', pl: 'Nie upadaj.' },
  'lay': { en: 'Lay down.', pl: 'Połóż się.' },
  'lie': { en: 'Lie on the bed.', pl: 'Leż na łóżku.' },
  'sleep': { en: 'Sleep well.', pl: 'Śpij dobrze.' },
  'wake': { en: 'Wake up.', pl: 'Obudź się.' },
  'eat': { en: 'Eat your food.', pl: 'Jedz jedzenie.' },
  'drink': { en: 'Drink water.', pl: 'Pij wodę.' },
  'cook': { en: 'Cook dinner.', pl: 'Gotuj obiad.' },
  'bake': { en: 'Bake a cake.', pl: 'Upiecz tort.' },
  'wash': { en: 'Wash your hands.', pl: 'Umyj ręce.' },
  'clean': { en: 'Clean the house.', pl: 'Posprzątaj dom.' },
  'fix': { en: 'Fix the car.', pl: 'Napraw samochód.' },
  'break': { en: 'Don\'t break it.', pl: 'Nie łam tego.' },
  'build': { en: 'Build a house.', pl: 'Zbuduj dom.' },
  'paint': { en: 'Paint the wall.', pl: 'Pomaluj ścianę.' },
  'draw': { en: 'Draw a picture.', pl: 'Narysuj obraz.' },
  'write': { en: 'Write a letter.', pl: 'Napisz list.' },
  'read': { en: 'Read a book.', pl: 'Czytaj książkę.' },
  'sing': { en: 'Sing a song.', pl: 'Śpiewaj piosenkę.' },
  'dance': { en: 'Dance with me.', pl: 'Tańcz ze mną.' },
  'play': { en: 'Play outside.', pl: 'Graj na zewnątrz.' },
  'work': { en: 'Work hard.', pl: 'Pracuj ciężko.' },
  'study': { en: 'Study for the exam.', pl: 'Ucz się do egzaminu.' },
  'teach': { en: 'Teach me.', pl: 'Nauczaj mnie.' },
  'learn': { en: 'Learn English.', pl: 'Ucz się angielskiego.' },
  'drive': { en: 'Drive safely.', pl: 'Jedź bezpiecznie.' },
  'ride': { en: 'Ride a bike.', pl: 'Jeżdź na rowerze.' },
  'buy': { en: 'Buy milk.', pl: 'Kup mleko.' },
  'sell': { en: 'Sell your car.', pl: 'Sprzedaj samochód.' },
  'give': { en: 'Give me a hand.', pl: 'Daj mi rękę.' },
  'take': { en: 'Take this.', pl: 'Weź to.' },
  'hold': { en: 'Hold my hand.', pl: 'Trzymaj moją rękę.' },
  'touch': { en: 'Don\'t touch.', pl: 'Nie dotykaj.' },
  'throw': { en: 'Throw the ball.', pl: 'Rzuć piłkę.' },
  'catch': { en: 'Catch the ball.', pl: 'Złap piłkę.' },
  'kick': { en: 'Kick the ball.', pl: 'Kopnij piłkę.' },
  'push': { en: 'Push the door.', pl: 'Popchnij drzwi.' },
  'pull': { en: 'Pull the rope.', pl: 'Pociągnij linę.' },
  'turn': { en: 'Turn left.', pl: 'Skręć w lewo.' },
  'twist': { en: 'Twist it.', pl: 'Przekręć to.' },
  'bend': { en: 'Bend your knees.', pl: 'Zgij kolana.' },
  'stretch': { en: 'Stretch your arms.', pl: 'Wyciągnij ramiona.' },

  // Objects & things
  'door': { en: 'Open the door.', pl: 'Otwórz drzwi.' },
  'window': { en: 'Open the window.', pl: 'Otwórz okno.' },
  'wall': { en: 'The wall is white.', pl: 'Ściana jest biała.' },
  'floor': { en: 'The floor is clean.', pl: 'Podłoga jest czysta.' },
  'ceiling': { en: 'The ceiling is high.', pl: 'Pułap jest wysoki.' },
  'roof': { en: 'The roof is red.', pl: 'Dach jest czerwony.' },
  'room': { en: 'This room is big.', pl: 'Ten pokój jest duży.' },
  'house': { en: 'My house is small.', pl: 'Mój dom jest mały.' },
  'building': { en: 'That building is tall.', pl: 'Ten budynek jest wysoki.' },
  'tree': { en: 'A big tree.', pl: 'Duże drzewo.' },
  'grass': { en: 'The grass is green.', pl: 'Trawa jest zielona.' },
  'flower': { en: 'A beautiful flower.', pl: 'Piękny kwiat.' },
  'plant': { en: 'Water the plant.', pl: 'Podlej roślinę.' },
  'rock': { en: 'A big rock.', pl: 'Duży kamień.' },
  'sand': { en: 'Sand on the beach.', pl: 'Piasek na plaży.' },
  'water': { en: 'Drink water.', pl: 'Pij wodę.' },
  'fire': { en: 'The fire is hot.', pl: 'Ogień jest gorący.' },
  'smoke': { en: 'No smoke here.', pl: 'Brak dymu tutaj.' },
  'light': { en: 'The light is bright.', pl: 'Światło jest jasne.' },
  'shadow': { en: 'A long shadow.', pl: 'Długi cień.' },

  // People & relationships
  'mother': { en: 'My mother is here.', pl: 'Moja matka jest tutaj.' },
  'father': { en: 'My father is here.', pl: 'Mój ojciec jest tutaj.' },
  'brother': { en: 'My brother is kind.', pl: 'Mój brat jest miły.' },
  'sister': { en: 'My sister is here.', pl: 'Moja siostra jest tutaj.' },
  'son': { en: 'My son is smart.', pl: 'Mój syn jest mądry.' },
  'daughter': { en: 'My daughter is here.', pl: 'Moja córka jest tutaj.' },
  'grandpa': { en: 'My grandpa is 80.', pl: 'Mój dziadek ma 80 lat.' },
  'grandma': { en: 'My grandma cooks.', pl: 'Moja babcia gotuje.' },
  'uncle': { en: 'My uncle is here.', pl: 'Mój wujek jest tutaj.' },
  'aunt': { en: 'My aunt is here.', pl: 'Moja ciotka jest tutaj.' },
  'cousin': { en: 'My cousin is my age.', pl: 'Mój kuzyn ma mój wiek.' },
  'husband': { en: 'My husband is kind.', pl: 'Mój mąż jest miły.' },
  'wife': { en: 'My wife is here.', pl: 'Moja żona jest tutaj.' },
  'baby': { en: 'The baby sleeps.', pl: 'Dziecko śpi.' },
  'child': { en: 'The child plays.', pl: 'Dziecko gra.' },
  'boy': { en: 'The boy is tall.', pl: 'Chłopak jest wysoki.' },
  'girl': { en: 'The girl is smart.', pl: 'Dziewczyna jest mądra.' },
  'man': { en: 'The man is here.', pl: 'Mężczyzna jest tutaj.' },
  'woman': { en: 'The woman is here.', pl: 'Kobieta jest tutaj.' },
  'doctor': { en: 'The doctor is kind.', pl: 'Lekarz jest miły.' },
  'nurse': { en: 'The nurse helps.', pl: 'Pielęgniarka pomaga.' },
  'teacher': { en: 'The teacher is smart.', pl: 'Nauczyciel jest mądry.' },
  'student': { en: 'I am a student.', pl: 'Jestem uczniem.' },
  'policeman': { en: 'A policeman is here.', pl: 'Policjant jest tutaj.' },
  'firefighter': { en: 'A firefighter helps.', pl: 'Strażak pomaga.' },
  'cook': { en: 'The cook is skilled.', pl: 'Kucharz jest biegły.' },
  'chef': { en: 'The chef cooks well.', pl: 'Szef kuchni gotuje dobrze.' },
  'farmer': { en: 'The farmer works.', pl: 'Rolnik pracuje.' },
  'worker': { en: 'A worker is here.', pl: 'Pracownik jest tutaj.' },
  'boss': { en: 'My boss is here.', pl: 'Mój szef jest tutaj.' },
  'friend': { en: 'He is my friend.', pl: 'On jest moim przyjacielem.' },

  // Emotions & states
  'happy': { en: 'I am happy.', pl: 'Jestem szczęśliwy.' },
  'sad': { en: 'I am sad.', pl: 'Jestem smutny.' },
  'angry': { en: 'Don\'t be angry.', pl: 'Nie bądź zły.' },
  'tired': { en: 'I am tired.', pl: 'Jestem zmęczony.' },
  'afraid': { en: 'Don\'t be afraid.', pl: 'Nie bój się.' },
  'excited': { en: 'I am excited.', pl: 'Jestem podekscytowany.' },
  'bored': { en: 'I am bored.', pl: 'Nudzę się.' },
  'sick': { en: 'I feel sick.', pl: 'Czuję się źle.' },
  'well': { en: 'I feel well.', pl: 'Czuję się dobrze.' },
  'proud': { en: 'I am proud.', pl: 'Jestem dumny.' },
  'shy': { en: 'Don\'t be shy.', pl: 'Nie bądź nieśmiały.' },
  'nervous': { en: 'I am nervous.', pl: 'Jestem zdenerwowany.' },
  'calm': { en: 'Stay calm.', pl: 'Pozostań spokojny.' },
  'relaxed': { en: 'I feel relaxed.', pl: 'Czuję się zrelaksowany.' },
  'strong': { en: 'I feel strong.', pl: 'Czuję się silny.' },
  'weak': { en: 'I feel weak.', pl: 'Czuję się słaby.' },

  // Colors
  'red': { en: 'The apple is red.', pl: 'Jabłko jest czerwone.' },
  'blue': { en: 'The sky is blue.', pl: 'Niebo jest niebieskie.' },
  'green': { en: 'The grass is green.', pl: 'Trawa jest zielona.' },
  'yellow': { en: 'The sun is yellow.', pl: 'Słońce jest żółte.' },
  'orange': { en: 'The orange is orange.', pl: 'Pomarańcza jest pomarańczowa.' },
  'purple': { en: 'The flower is purple.', pl: 'Kwiat jest fioletowy.' },
  'pink': { en: 'The dress is pink.', pl: 'Sukienka jest różowa.' },
  'black': { en: 'My shoes are black.', pl: 'Moje buty są czarne.' },
  'white': { en: 'The snow is white.', pl: 'Śnieg jest biały.' },
  'gray': { en: 'The clouds are gray.', pl: 'Chmury są szare.' },
  'brown': { en: 'The bear is brown.', pl: 'Niedźwiedź jest brązowy.' },
  'silver': { en: 'Silver is shiny.', pl: 'Srebro jest błyszczące.' },
  'gold': { en: 'Gold is valuable.', pl: 'Złoto jest cenne.' },

  // Materials
  'wood': { en: 'The table is wood.', pl: 'Stół jest drewniany.' },
  'metal': { en: 'Metal is strong.', pl: 'Metal jest mocny.' },
  'plastic': { en: 'This is plastic.', pl: 'To jest plastik.' },
  'glass': { en: 'Glass is fragile.', pl: 'Szkło jest kruche.' },
  'paper': { en: 'Paper is thin.', pl: 'Papier jest cienki.' },
  'fabric': { en: 'Soft fabric.', pl: 'Miękka tkanina.' },
  'leather': { en: 'Leather is durable.', pl: 'Skóra jest trwała.' },
  'rubber': { en: 'Rubber is elastic.', pl: 'Guma jest elastyczna.' },
  'stone': { en: 'Stone is hard.', pl: 'Kamień jest twardy.' },
  'clay': { en: 'Clay is moldable.', pl: 'Glina jest plastyczna.' },

  // Sizes & shapes
  'small': { en: 'This is small.', pl: 'To jest małe.' },
  'large': { en: 'This is large.', pl: 'To jest duże.' },
  'tiny': { en: 'This is tiny.', pl: 'To jest maleńkie.' },
  'huge': { en: 'This is huge.', pl: 'To jest ogromne.' },
  'round': { en: 'The ball is round.', pl: 'Piłka jest okrągła.' },
  'square': { en: 'The box is square.', pl: 'Pudełko jest kwadratowe.' },
  'triangle': { en: 'A triangle has three sides.', pl: 'Trójkąt ma trzy boki.' },
  'circle': { en: 'Draw a circle.', pl: 'Narysuj koło.' },
  'straight': { en: 'A straight line.', pl: 'Prosta linia.' },
  'curved': { en: 'A curved line.', pl: 'Zakrzywiona linia.' },

  // Textures
  'smooth': { en: 'The road is smooth.', pl: 'Droga jest gładka.' },
  'rough': { en: 'The surface is rough.', pl: 'Powierzchnia jest chropowata.' },
  'soft': { en: 'This pillow is soft.', pl: 'Ta poduszka jest miękka.' },
  'hard': { en: 'This floor is hard.', pl: 'Ta podłoga jest twarda.' },
  'wet': { en: 'The floor is wet.', pl: 'Podłoga jest mokra.' },
  'dry': { en: 'The towel is dry.', pl: 'Ręcznik jest suchy.' },
  'hot': { en: 'The coffee is hot.', pl: 'Kawa jest gorąca.' },
  'cold': { en: 'The water is cold.', pl: 'Woda jest zimna.' },
  'warm': { en: 'The room is warm.', pl: 'Pokój jest ciepły.' },
  'cool': { en: 'The breeze is cool.', pl: 'Wietrzyk jest chłodny.' },

  // Tastes & smells
  'sweet': { en: 'This is sweet.', pl: 'To jest słodkie.' },
  'sour': { en: 'This is sour.', pl: 'To jest kwaśne.' },
  'bitter': { en: 'This is bitter.', pl: 'To jest gorzkie.' },
  'salty': { en: 'This is salty.', pl: 'To jest słone.' },
  'spicy': { en: 'This is spicy.', pl: 'To jest ostre.' },
  'bland': { en: 'This is bland.', pl: 'To jest bez smaku.' },
  'delicious': { en: 'This is delicious.', pl: 'To jest pyszne.' },
  'disgusting': { en: 'This is disgusting.', pl: 'To jest obrzydliwe.' },
  'fresh': { en: 'This is fresh.', pl: 'To jest świeże.' },
  'stale': { en: 'This is stale.', pl: 'To jest czerstwe.' },

  // Positions & locations
  'above': { en: 'Above the table.', pl: 'Nad stołem.' },
  'below': { en: 'Below the table.', pl: 'Pod stołem.' },
  'inside': { en: 'Inside the house.', pl: 'Wewnątrz domu.' },
  'outside': { en: 'Outside the house.', pl: 'Na zewnątrz domu.' },
  'near': { en: 'Near the door.', pl: 'Blisko drzwi.' },
  'far': { en: 'Far from here.', pl: 'Daleko stąd.' },
  'left': { en: 'Turn left.', pl: 'Skręć w lewo.' },
  'right': { en: 'Turn right.', pl: 'Skręć w prawo.' },
  'up': { en: 'Go up.', pl: 'Idź do góry.' },
  'down': { en: 'Go down.', pl: 'Idź w dół.' },
  'front': { en: 'In front of me.', pl: 'Przede mną.' },
  'back': { en: 'In the back.', pl: 'Z tyłu.' },
  'side': { en: 'On the side.', pl: 'Na boku.' },
  'middle': { en: 'In the middle.', pl: 'W środku.' },
  'corner': { en: 'In the corner.', pl: 'W kącie.' },
  'edge': { en: 'On the edge.', pl: 'Na krawędzi.' },
  'center': { en: 'In the center.', pl: 'W centrum.' },
  'surface': { en: 'On the surface.', pl: 'Na powierzchni.' },
  'depth': { en: 'In the depth.', pl: 'W głębi.' },

  // Quantities
  'some': { en: 'I want some.', pl: 'Chcę trochę.' },
  'many': { en: 'There are many.', pl: 'Jest wiele.' },
  'few': { en: 'There are few.', pl: 'Jest niewiele.' },
  'all': { en: 'I want all.', pl: 'Chcę wszystko.' },
  'none': { en: 'I want none.', pl: 'Nie chcę nic.' },
  'most': { en: 'Most are here.', pl: 'Większość jest tutaj.' },
  'least': { en: 'At least one.', pl: 'Co najmniej jeden.' },
  'enough': { en: 'That is enough.', pl: 'To wystarczy.' },
  'too much': { en: 'That is too much.', pl: 'To za dużo.' },
  'too little': { en: 'That is too little.', pl: 'To za mało.' }
};

console.log(`Loaded ${Object.keys(sentenceDictionary).length} word-sentence mappings`);

// Process batches 3 & 4 (packs 57-112)
for (let i = 57; i <= 112; i++) {
  const num = String(i).padStart(3, '0');
  const packPath = `src/data/packs/t1-p${num}.json`;

  if (!fs.existsSync(packPath)) {
    continue;
  }

  const pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
  let updated = 0;

  pack.words.forEach(word => {
    const key = word.english.toLowerCase();
    if (sentenceDictionary[key]) {
      word.sentenceEn = sentenceDictionary[key].en;
      word.sentencePl = sentenceDictionary[key].pl;
      updated++;
    } else {
      // Fallback
      word.sentenceEn = `I use ${word.english.toLowerCase()}.`;
      word.sentencePl = `Używam ${word.polish}.`;
      updated++;
    }
  });

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + '\n');
  console.log(`Updated t1-p${num}: ${updated} words`);
}

console.log('\n✓ Done generating and injecting sentences for batches 3 & 4');
