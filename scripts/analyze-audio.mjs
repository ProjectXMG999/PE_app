import fs from 'fs';
import path from 'path';
import getDuration from 'mp3-duration';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const audioDir = path.join(projectRoot, 'public/audio');

// Paragraph data from source files
const audioData = {
  'intro-welcome.mp3': {
    paragraphs: [
      'Witaj w Language Performance.',
      'To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening. Zaprojektowaliśmy ją tak, żeby prowadzić Cię krok po kroku — jak trener na siłowni albo dobry plan treningowy.',
      'Naszym celem jest prosta rzecz: chcemy nauczyć Cię tych słów, które dadzą Ci najwięcej mówienia w najkrótszym czasie. Dlatego słownictwo nie jest tutaj przypadkowe. Jest ułożone od najważniejszych słów do coraz bardziej precyzyjnych. Najpierw uczysz się tego, co naprawdę pozwala przetrwać, dogadać się, zareagować i powiedzieć coś o sobie.',
      'Masz tutaj dwa główne tryby.',
      'Pierwszy to Słuchaj. To tryb audio. Możesz uczyć się w drodze, na spacerze, w samochodzie albo wtedy, kiedy nie chcesz patrzeć w ekran. Osłuchujesz się ze słowami, zdaniami i rytmem języka.',
      'Drugi to Aktywuj. To tryb treningowy. Tutaj słowo przestaje być tylko znane. Zaczynasz je przypominać sobie, mówić na głos, łączyć w frazy i budować z nim zdania.',
      'W treningu spotkasz cztery ćwiczenia: Słowo w Akcji, Moje Zdanie, Jedno Słowo, Trzy Dziedziny i Drabina Zdania. Każde z nich robi coś innego. Najpierw uczysz mózg, że słowo działa. Potem tworzysz własne zdanie. Potem przenosisz słowo do różnych sytuacji. A na końcu uczysz się rozwijać wypowiedź.',
      'Będziesz też przechodzić przez poziomy. Level 1 to survival — zaczynasz sobie radzić. Level 2 to codzienna komunikacja. Level 3 to językowa wolność. Level 4 to angielski, który robi wrażenie.',
      'Nie musisz robić wszystkiego idealnie. Masz robić małe kroki. Słuchać. Aktywować. Mówić na głos. Wracać. I widzieć progres.',
      'Zaczynamy. Wybierz paczkę i zrób pierwszy trening.'
    ]
  },
  'intro-story.mp3': {
    paragraphs: [
      'Cześć!',
      'Za chwilę rozpoczniesz trening słownictwa, ale zanim to zrobisz, chciałbym opowiedzieć Ci krótką historię. To historia o tym, dlaczego stworzyliśmy ten system i dlaczego wierzę, że może całkowicie zmienić sposób, w jaki uczysz się języka.',
      'Przez wiele lat uczyłem języka angielskiego i obserwowałem tysiące uczniów. Widziałem ludzi bardzo ambitnych, którzy poświęcali nauce mnóstwo czasu. Kupowali książki, robili fiszki, oglądali filmy, zapisywali słówka w zeszytach. Naprawdę się starali.',
      'A mimo to po kilku miesiącach często mówili dokładnie to samo.',
      '„Znam wiele słów, ale kiedy przychodzi rozmowa… wszystko znika."',
      'To bardzo ciekawe, prawda?',
      'Problemem nie jest nawet brak motywacji. Problem polega na tym, że większość ludzi przez lata uczy się języka tak, jakby zbierała informacje, a nie trenowała umiejętność. Wyobraź sobie osobę, która chce nauczyć się jeździć na nartach. Czy wystarczy przeczytać książkę o narciarstwie? Oczywiście, że nie. Trzeba wsiąść na narty i zacząć jechać.',
      'Z językiem jest dokładnie tak samo. Możesz znać definicję słowa, ale dopóki nie użyjesz go w swoim życiu, Twój mózg traktuje je jak ciekawostkę, a nie jak narzędzie.',
      'I właśnie dlatego stworzyliśmy Language Performance Training.',
      'Chcemy, żebyś zaczął ze słów robić wreszcie użytek. Bo dopiero wtedy język naprawdę staje się Twój.',
      'Zadaliśmy sobie pytanie badawcze. „Gdybyśmy sami mieli dziś uczyć się angielskiego od zera… którego słowa nauczylibyśmy się jako pierwszego? A którego jako setnego? A którego jako tysięcznego?"',
      'Brzmi trochę dziwnie. Ale właśnie od tego wszystko się zaczęło.',
      'Przez setki godzin analizowaliśmy język angielski. Nie tylko pojedyncze słowa, ale również sytuacje, w których ludzie naprawdę ich używają. Zastanawialiśmy się, które słownictwo daje największy zwrot z czasu poświęconego na naukę. Jak połączyć słowa w logiczne grupy. Jak ułożyć je w takiej kolejności, aby każde kolejne budowało na poprzednim.',
      'Efektem tej pracy nie jest zwykła lista słówek. To mapa języka.',
      'Podzieliliśmy angielski na ponad trzysta paczek słownictwa i zaprojektowaliśmy drogę, która prowadzi od najprostszych rozmów aż do swobodnej komunikacji.',
      'Dzięki temu nie musisz codziennie zastanawiać się, czego uczyć się dalej. Nie musisz zgadywać, które słowa są naprawdę ważne. Nie musisz układać własnego planu.',
      'My wykonaliśmy tę pracę za Ciebie. Ty masz po prostu zrobić kolejny krok.',
      'Jest jeszcze jedna rzecz, o której bardzo chciałbym, żebyś pamiętał. Nie szukamy perfekcji. Szanujemy regularność.',
      'Mózg uwielbia częsty kontakt z językiem. Właśnie dlatego zachęcam Cię do krótkich, ale codziennych treningów.'
    ]
  }
};

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

function estimateTimings(paragraphs, totalDurationSeconds) {
  const avgWordsPerMinute = 150;
  const avgWordsPerSecond = avgWordsPerMinute / 60;

  const wordCounts = paragraphs.map(p => countWords(p));
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  const timings = [];
  let currentTime = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const wordCount = wordCounts[i];
    const duration = wordCount / avgWordsPerSecond;

    timings.push({
      index: i,
      startTime: Math.round(currentTime * 1000) / 1000,
      endTime: Math.round((currentTime + duration) * 1000) / 1000,
      words: wordCount
    });

    currentTime += duration;
  }

  return timings;
}

async function analyzeAudio() {
  const results = {};

  for (const [filename, data] of Object.entries(audioData)) {
    const filePath = path.join(audioDir, filename);

    try {
      const duration = await getDuration(fs.createReadStream(filePath));
      const timings = estimateTimings(data.paragraphs, duration);

      results[filename] = {
        duration: Math.round(duration * 100) / 100,
        paragraphs: data.paragraphs,
        timings: timings
      };

      console.log(`✓ ${filename} (${duration.toFixed(1)}s, ${data.paragraphs.length} paragraphs)`);
    } catch (error) {
      console.error(`✗ Error analyzing ${filename}:`, error.message);
    }
  }

  const outputPath = path.join(projectRoot, 'src/data/audioTimings.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Saved to ${outputPath}`);

  return results;
}

analyzeAudio().catch(console.error);
