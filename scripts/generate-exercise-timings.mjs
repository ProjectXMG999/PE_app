import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

function descToParagraphs(text) {
  return text
    .split('\n')
    .map(l => l.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/^-\s+/, '').trim())
    .filter(l => l.length > 0);
}

function estimateTimings(paragraphs) {
  const avgWordsPerMinute = 150;
  const avgWordsPerSecond = avgWordsPerMinute / 60;

  const wordCounts = paragraphs.map(p => countWords(p));
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

// Training exercises descriptions
const exercises = {
  'exercise-word-in-action.mp3': {
    title: 'Słowo w Akcji',
    description: `
Od lęku do ciekawości

W prawdziwym języku bardzo **rzadko używamy samotnych słów**. Mówimy pakietami. Mówimy zdaniami. Dlatego kiedy uczysz się słowa samotnie — na fiszce, na kartce, w zeszycie, na liście słówek albo nawet na kartce przyklejonej do ściany — możesz zacząć je kojarzyć. I to jest dobry pierwszy krok.

**Tylko że kojarzyć słowo to jeszcze nie to samo, co nim mówić.**

Twój mózg jeszcze nie czuje, że bezpiecznie użyje tego słowa w rozmowie. Twój mózg nie lubi nieprzetestowanych rzeczy. A pojedyncze słowo jest właśnie czymś nieprzetestowanym. W efekcie Ty też nie czujesz się pewnie i masz wrażenie, że słowa uciekają z pamięci.

Twój mózg lubi rzeczy oswojone, takie, które zadziałały w przeszłości.

Jak wykonujesz Słowo w Akcji?

W aplikacji wchodzisz w daną paczkę i klikasz: **Trenuj**. Najpierw wybierasz tryb Szybki Przegląd Słów. Widzisz polskie słowo, na przykład **wierzyć**. Przypominasz sobie: wierzyć to **believe**.

I teraz zadajesz sobie pytanie: **co mogę już powiedzieć z tym słowem na głos?**

Zrób to w trzech krokach: zobacz polskie słowo, przypomnij sobie angielskie znaczenie i zbuduj pięć krótkich fraz.

- **wierz mi** — believe me
- **wierz w siebie** — believe in yourself
- **wierzę ci** — I believe you
- **wierzę w ten pomysł** — I believe in this idea
- **wierzę, że to jest możliwe** — I believe it is possible

**Czujesz różnicę?**

Uczysz swój mózg, że potrafisz to słowo użyć. Że to słowo działa. Zapamiętaj: **jak coś jest znane i przetestowane, twój mózg przestaje się tego bać.**

Rezultat

Tu nie chodzi o perfekcję. Chodzi o **pierwszy bezpieczny kontakt ze słowem w mowie.** Słowo przestaje być samotną informacją na kartce, a staje się częścią Ciebie i Twojego języka.
    `
  },
  'exercise-personal-sentence.mp3': {
    title: 'Moje Zdanie',
    description: `
Język, który dotyka Twojego świata

W Słowie w Akcji zobaczyłeś, że słowo nie musi być samotne.

W **Moim Zdaniu** bierzesz słowo i tworzysz z niego zdanie, które — co kluczowe — **naprawdę mogłoby wyjść z Twoich ust.**

Dlaczego to działa?

Twój mózg lepiej zapamiętuje język, kiedy zdanie ma **sytuację, emocję, odbiorcę i sens**. Kiedy możesz poczuć gdzie, do kogo i po co mógłbyś je powiedzieć. W kognitywistyce mówi się o tym **embodied cognition** — język nie jest oderwany od doświadczenia.

To ćwiczenie powstało z bardzo prostej obserwacji: w klasycznej edukacji uczniowie często uczą się przykładów, które są **poprawne, ale emocjonalnie puste**.

- *Tom has a red pen.* — Tomek ma czerwony długopis.
- *Anna likes apples.* — Ania lubi jabłka.

**Prawdopodobieństwo użycia w Twoim życiu: 1%.**

Mózg nie ma powodu, żeby traktować je jako coś ważnego. I za chwilę je zapomnisz.

Jak wykonujesz ćwiczenie Moje Zdanie?

W aplikacji wchodzisz w daną paczkę i klikasz: **Trenuj**. Wybierasz tryb Szybki Przegląd Słów. Widzisz polskie słowo, na przykład **czuć**, czyli **feel**.

Zadajesz sobie **trzy pytania**:

- **Co mógłbym powiedzieć o sobie** z tym słowem?
- **Co mógłbym powiedzieć do bliskiej osoby?**
- **Co mógłbym powiedzieć w pracy, w domu albo w trakcie zwykłego dnia?**

I teraz działamy. **Na głos.**

- **Czuję, że potrzebuję chwili dla siebie.** — I feel that I need a moment for myself.
- **Czuję, że robię postęp.** — I feel that I am making progress.
- **Czuję, że coś jest nie tak.** — I feel that something is wrong.
- **Czuję się lepiej, kiedy jesteś obok.** — I feel better when you are next to me.

Rezultat

**Twój mózg nie uczy się mówienia tylko przez patrzenie.** Twój mózg uczy się mówienia przez — to niezbyt zaskakujące — **mówienie**. Przez głos. Przez powtórzenie. Przez poczucie: *to zdanie mogłoby być moje*.

**Język zaczyna wchodzić głębiej, kiedy nie jest tylko informacją, ale częścią Twojego doświadczenia.** Słowo nie zostaje w aplikacji. Ono wychodzi z aplikacji do Twojego świata.
    `
  },
  'exercise-three-domains.mp3': {
    title: 'Jedno Słowo, Trzy Dziedziny',
    description: `
Słowo, które pracuje wszędzie

W poprzednim ćwiczeniu zobaczyłeś, że słowo lepiej zapamiętuje się wtedy, kiedy staje się Twoim zdaniem.

**Teraz idziemy krok dalej**, bo w prawdziwym życiu nie używasz języka tylko w jednej sytuacji.

Dopóki rozmowa wygląda podobnie, wszystko jest w porządku. **Ale kiedy sytuacja się zmienia, mózg nagle się zacina.** Znasz słowo, ale nie wiesz, jak użyć go w nowej rozmowie.

Jak pracuje pamięć?

Pamięć działa lepiej, kiedy ma więcej **"haczyków"**, które pomagają przywołać informację.

Weźmy słowo **wybierać**, czyli **choose**. Jeśli słowo *choose* jest połączone tylko z jednym zdaniem, mózg ma **jedną drogę dostępu**. Ale jeśli *choose* pojawia się w **trzech obszarach** — w domu, w pracy i w codziennych sytuacjach — mózg ma **trzy drogi dostępu**.

W kognitywistyce mówimy tu o **retrieval cues**, czyli wskazówkach przywoływania. **Budujesz bogatszą sieć skojarzeń**, a im więcej sensownych połączeń, tym łatwiej później użyć słowa w rozmowie.

Jak wykonujesz ćwiczenie?

W aplikacji wchodzisz w daną paczkę i klikasz: **Trenuj**. Wybierasz tryb Szybki Przegląd Słów. Widzisz słowo: **wybierać**, czyli **choose**.

I teraz wyobrażasz sobie siebie mówiącego **trzy zdania w trzech miejscach**. Do kogoś, z kim mieszkasz, do kogoś, z kim pracujesz, i do znajomego.

- **Dom:** Ja dziś wybieram film. — *I choose the movie tonight.*
- **Praca:** Wybierzmy jedną rzecz i na dzisiaj koniec. — *Let's choose one thing and call it a day.*
- **Znajomi:** Ty wybierasz restaurację tym razem. — *You choose the restaurant this time.*

**Czujesz różnicę?**

To samo słowo, ale trzy różne sytuacje. To samo *choose*, ale raz jesteś w domu, raz w pracy, raz rozmawiasz ze znajomym.

Rezultat

**To ćwiczenie działa, bo uczy Twój mózg przenoszenia słowa między kontekstami.** A rozmowa właśnie na tym polega. Nie na recytowaniu jednego przykładu z podręcznika, tylko na tym, że potrafisz przenieść słowo tam, gdzie akurat go potrzebujesz.

**To jest językowa wolność.**

Słowo, które działa tylko w jednym zdaniu, jest jeszcze kruche. Słowo, które działa w trzech sytuacjach, zaczyna być Twoje.
    `
  },
  'exercise-sentence-ladder.mp3': {
    title: 'Drabina Zdania',
    description: `
Od małego zdania do pełnej wypowiedzi

W poprzednim ćwiczeniu zobaczyłeś, że jedno słowo może działać w różnych sytuacjach.

**Teraz zrobimy coś jeszcze ważniejszego:** pokażemy Twojemu mózgowi, że z jednego prostego słowa można zbudować **dłuższą, niż myślisz, wypowiedź.**

Dlaczego to jest problem?

Wiele osób uczących się języka angielskiego **zatrzymuje się na bardzo krótkich zdaniach.** Kiedy trzeba dodać powód, szczegół, emocję albo kontekst — **nagle pojawia się blokada.**

To dlatego, że mózg nie jest przyzwyczajony do tej szybkości lub intensywności. Tak jak na siłowni, dokładasz ciężar **stopniowo.**

Jak uczy się prawidłowo?

Mózg lepiej uczy się, kiedy zadanie jest **trochę trudniejsze niż poprzednie, ale nadal możliwe do wykonania**. Lubi kiedy dostaje **jasny sygnał progresu** i konkretną informację: *"umiem zrobić następny krok"*.

W języku działa to podobnie:

- Najpierw proste zdanie
- Potem szczegół
- Potem powód, emocja albo kontekst

**Dlatego powstała Drabina Zdania.**

Jak wykonujesz ćwiczenie?

W aplikacji wchodzisz w daną paczkę i klikasz: **Trenuj**. Wybierasz tryb Szybki Przegląd Słów. Widzisz słowo: **szalony**, czyli **crazy**.

I teraz **budujesz drabinę**, poziom po poziomie:

**Poziom 1 (Prosty):**
- On jest szalony. — *He is crazy.*

**Poziom 2 (Normalny):**
- On jest szalony, ale podoba mi się to. — *This is crazy, but I like it.*

**Poziom 3 (Rozwinięty):**
- To jest szalone, ale podoba mi się, bo czasami potrzebuję w życiu czegoś nowego. — *This is crazy, but I like it because sometimes I need something new in life.*

**Najpierw mówisz coś prostego. Potem dodajesz szczegół. Potem dodajesz powód.** Twój mózg widzi progres. **Nie skaczesz od razu na głęboką wodę. Wchodzisz po szczeblach.**

Rezultat

**To ćwiczenie działa, bo uczy nie tylko pamięci słowa, ale też rozbudowywania myśli.** A w prawdziwej rozmowie **bardzo często nie wygrywa ten, kto zna najtrudniejsze słowo. Wygrywa ten, kto potrafi prostymi słowami powiedzieć trochę więcej.**

**Drabina Zdania daje Ci dokładnie tę umiejętność.**

Słowo przestaje być punktem. **Zaczyna być początkiem wypowiedzi.**
    `
  }
};

// Generate timings for all exercises
const audioTimingsPath = path.join(__dirname, '../src/data/audioTimings.json');
const existingTimings = JSON.parse(fs.readFileSync(audioTimingsPath, 'utf8'));

for (const [filename, exerciseData] of Object.entries(exercises)) {
  const paragraphs = descToParagraphs(exerciseData.description);
  const timings = estimateTimings(paragraphs);

  existingTimings[filename] = {
    duration: 120,
    paragraphs: paragraphs,
    timings: timings
  };

  console.log(`✓ ${filename}: ${paragraphs.length} paragraphs`);
}

fs.writeFileSync(audioTimingsPath, JSON.stringify(existingTimings, null, 2));
console.log(`\n✓ Updated ${audioTimingsPath}`);
