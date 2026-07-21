// Generate audio for all 4 training exercises using Piotr (PL voice)
// Uses the exact fullDescription text from TrainingPage, split into paragraphs
// Output: public/audio/exercise-{id}.mp3

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/audio')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'
const PIOTR_VOICE_ID = 'o2xdfKUpc1Bwq7RchZuW'

// Strip markdown formatting for clean TTS input
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // bold
    .replace(/\*(.*?)\*/g, '$1')       // italic
    .replace(/^-\s+/gm, '')            // list dashes
    .trim()
}

// Split fullDescription into non-empty paragraphs
function toParagraphs(fullDescription: string): string[] {
  return fullDescription
    .split('\n')
    .map(l => stripMarkdown(l))
    .filter(l => l.trim().length > 0)
}

const EXERCISES: { id: string; fullDescription: string }[] = [
  {
    id: 'word-in-action',
    fullDescription: `
Od lęku do ciekawości

W prawdziwym języku bardzo rzadko używamy samotnych słów. Mówimy pakietami. Mówimy zdaniami. Dlatego kiedy uczysz się słowa samotnie — na fiszce, na kartce, w zeszycie, na liście słówek albo nawet na kartce przyklejonej do ściany — możesz zacząć je kojarzyć. I to jest dobry pierwszy krok.

Tylko że kojarzyć słowo to jeszcze nie to samo, co nim mówić.

Twój mózg jeszcze nie czuje, że bezpiecznie użyje tego słowa w rozmowie. Twój mózg nie lubi nieprzetestowanych rzeczy. A pojedyncze słowo jest właśnie czymś nieprzetestowanym. W efekcie Ty też nie czujesz się pewnie i masz wrażenie, że słowa uciekają z pamięci.

Twój mózg lubi rzeczy oswojone, takie, które zadziałały w przeszłości.

Jak wykonujesz Słowo w Akcji?

W aplikacji wchodzisz w daną paczkę i klikasz: Aktywuj. Najpierw wybierasz tryb Szybki Przegląd Słów. Widzisz polskie słowo, na przykład wierzyć. Przypominasz sobie: wierzyć to believe.

I teraz zadajesz sobie pytanie: co mogę już powiedzieć z tym słowem na głos?

Zrób to w trzech krokach: zobacz polskie słowo, przypomnij sobie angielskie znaczenie i zbuduj pięć krótkich fraz.

wierz mi — believe me. wierz w siebie — believe in yourself. wierzę ci — I believe you. wierzę w ten pomysł — I believe in this idea. wierzę, że to jest możliwe — I believe it is possible.

Czujesz różnicę?

Uczysz swój mózg, że potrafisz to słowo użyć. Że to słowo działa. Zapamiętaj: jak coś jest znane i przetestowane, twój mózg przestaje się tego bać.

Rezultat

Tu nie chodzi o perfekcję. Chodzi o pierwszy bezpieczny kontakt ze słowem w mowie. Słowo przestaje być samotną informacją na kartce, a staje się częścią Ciebie i Twojego języka.
    `,
  },
  {
    id: 'personal-sentence',
    fullDescription: `
Język, który dotyka Twojego świata

W Słowie w Akcji zobaczyłeś, że słowo nie musi być samotne.

W Moim Zdaniu bierzesz słowo i tworzysz z niego zdanie, które — co kluczowe — naprawdę mogłoby wyjść z Twoich ust.

Dlaczego to działa?

Twój mózg lepiej zapamiętuje język, kiedy zdanie ma sytuację, emocję, odbiorcę i sens. Kiedy możesz poczuć gdzie, do kogo i po co mógłbyś je powiedzieć.

To ćwiczenie powstało z bardzo prostej obserwacji: w klasycznej edukacji uczniowie często uczą się przykładów, które są poprawne, ale emocjonalnie puste.

Tom has a red pen — Tomek ma czerwony długopis. Anna likes apples — Ania lubi jabłka. Prawdopodobieństwo użycia w Twoim życiu: jeden procent.

Mózg nie ma powodu, żeby traktować je jako coś ważnego. I za chwilę je zapomnisz.

Jak wykonujesz ćwiczenie Moje Zdanie?

W aplikacji wchodzisz w daną paczkę i klikasz: Aktywuj. Wybierasz tryb Szybki Przegląd Słów. Widzisz polskie słowo, na przykład czuć, czyli feel.

Zadajesz sobie trzy pytania: Co mógłbym powiedzieć o sobie z tym słowem? Co mógłbym powiedzieć do bliskiej osoby? Co mógłbym powiedzieć w pracy, w domu albo w trakcie zwykłego dnia?

I teraz działamy. Na głos.

Czuję, że potrzebuję chwili dla siebie — I feel that I need a moment for myself. Czuję, że robię postęp — I feel that I am making progress. Czuję, że coś jest nie tak — I feel that something is wrong. Czuję się lepiej, kiedy jesteś obok — I feel better when you are next to me.

Rezultat

Twój mózg nie uczy się mówienia tylko przez patrzenie. Twój mózg uczy się mówienia przez — to niezbyt zaskakujące — mówienie. Przez głos. Przez powtórzenie. Przez poczucie: to zdanie mogłoby być moje.

Język zaczyna wchodzić głębiej, kiedy nie jest tylko informacją, ale częścią Twojego doświadczenia. Słowo nie zostaje w aplikacji. Ono wychodzi z aplikacji do Twojego świata.
    `,
  },
  {
    id: 'three-domains',
    fullDescription: `
Słowo, które pracuje wszędzie

W poprzednim ćwiczeniu zobaczyłeś, że słowo lepiej zapamiętuje się wtedy, kiedy staje się Twoim zdaniem.

Teraz idziemy krok dalej, bo w prawdziwym życiu nie używasz języka tylko w jednej sytuacji.

Dopóki rozmowa wygląda podobnie, wszystko jest w porządku. Ale kiedy sytuacja się zmienia, mózg nagle się zacina. Znasz słowo, ale nie wiesz, jak użyć go w nowej rozmowie.

Jak pracuje pamięć?

Pamięć działa lepiej, kiedy ma więcej haczyków, które pomagają przywołać informację.

Weźmy słowo wybierać, czyli choose. Jeśli słowo choose jest połączone tylko z jednym zdaniem, mózg ma jedną drogę dostępu. Ale jeśli choose pojawia się w trzech obszarach — w domu, w pracy i w codziennych sytuacjach — mózg ma trzy drogi dostępu.

Budujesz bogatszą sieć skojarzeń, a im więcej sensownych połączeń, tym łatwiej później użyć słowa w rozmowie.

Jak wykonujesz ćwiczenie?

W aplikacji wchodzisz w daną paczkę i klikasz: Aktywuj. Wybierasz tryb Szybki Przegląd Słów. Widzisz słowo: wybierać, czyli choose.

I teraz wyobrażasz sobie siebie mówiącego trzy zdania w trzech miejscach. Do kogoś, z kim mieszkasz, do kogoś, z kim pracujesz, i do znajomego.

Dom: Ja dziś wybieram film — I choose the movie tonight. Praca: Wybierzmy jedną rzecz i na dzisiaj koniec — Let's choose one thing and call it a day. Znajomi: Ty wybierasz restaurację tym razem — You choose the restaurant this time.

Czujesz różnicę?

To samo słowo, ale trzy różne sytuacje. To samo choose, ale raz jesteś w domu, raz w pracy, raz rozmawiasz ze znajomym.

Rezultat

To ćwiczenie działa, bo uczy Twój mózg przenoszenia słowa między kontekstami. A rozmowa właśnie na tym polega. Nie na recytowaniu jednego przykładu z podręcznika, tylko na tym, że potrafisz przenieść słowo tam, gdzie akurat go potrzebujesz.

To jest językowa wolność.

Słowo, które działa tylko w jednym zdaniu, jest jeszcze kruche. Słowo, które działa w trzech sytuacjach, zaczyna być Twoje.
    `,
  },
  {
    id: 'sentence-ladder',
    fullDescription: `
Od małego zdania do pełnej wypowiedzi

W poprzednim ćwiczeniu zobaczyłeś, że jedno słowo może działać w różnych sytuacjach.

Teraz zrobimy coś jeszcze ważniejszego: pokażemy Twojemu mózgowi, że z jednego prostego słowa można zbudować dłuższą, niż myślisz, wypowiedź.

Dlaczego to jest problem?

Wiele osób uczących się języka angielskiego zatrzymuje się na bardzo krótkich zdaniach. Kiedy trzeba dodać powód, szczegół, emocję albo kontekst — nagle pojawia się blokada.

To dlatego, że mózg nie jest przyzwyczajony do tej szybkości lub intensywności. Tak jak na siłowni, dokładasz ciężar stopniowo.

Jak uczy się prawidłowo?

Mózg lepiej uczy się, kiedy zadanie jest trochę trudniejsze niż poprzednie, ale nadal możliwe do wykonania. Lubi kiedy dostaje jasny sygnał progresu i konkretną informację: umiem zrobić następny krok.

W języku działa to podobnie: najpierw proste zdanie, potem szczegół, potem powód, emocja albo kontekst.

Dlatego powstała Drabina Zdania.

Jak wykonujesz ćwiczenie?

W aplikacji wchodzisz w daną paczkę i klikasz: Aktywuj. Wybierasz tryb Szybki Przegląd Słów. Widzisz słowo: szalony, czyli crazy.

I teraz budujesz drabinę, poziom po poziomie.

Poziom pierwszy, prosty: On jest szalony — He is crazy.

Poziom drugi, normalny: On jest szalony, ale podoba mi się to — This is crazy, but I like it.

Poziom trzeci, rozwinięty: To jest szalone, ale podoba mi się, bo czasami potrzebuję w życiu czegoś nowego — This is crazy, but I like it because sometimes I need something new in life.

Najpierw mówisz coś prostego. Potem dodajesz szczegół. Potem dodajesz powód. Twój mózg widzi progres. Nie skaczesz od razu na głęboką wodę. Wchodzisz po szczeblach.

Rezultat

To ćwiczenie działa, bo uczy nie tylko pamięci słowa, ale też rozbudowywania myśli. A w prawdziwej rozmowie bardzo często nie wygrywa ten, kto zna najtrudniejsze słowo. Wygrywa ten, kto potrafi prostymi słowami powiedzieć trochę więcej.

Drabina Zdania daje Ci dokładnie tę umiejętność.

Słowo przestaje być punktem. Zaczyna być początkiem wypowiedzi.
    `,
  },
]

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function generateParagraph(text: string, index: number, total: number): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${PIOTR_VOICE_ID}`,
        {
          method: 'POST',
          headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: MODEL_ID,
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
          }),
        }
      )
      if (response.status === 429) { await sleep(5000 * (attempt + 1)); continue }
      if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`)
      process.stdout.write(`\r  [${index + 1}/${total}] OK`)
      return Buffer.from(await response.arrayBuffer())
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(2000 * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

function addXingHeader(buf: Buffer): Buffer {
  let pos = 0
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const id3size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    pos = 10 + id3size
  }
  const firstFramePos = pos
  const h = (buf[pos] << 24) | (buf[pos+1] << 16) | (buf[pos+2] << 8) | buf[pos+3]
  const bitrateIdx = (h >> 12) & 0xF, srIdx = (h >> 10) & 0x3, padding = (h >> 9) & 0x1, channelMode = (h >> 6) & 0x3
  const bitrates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]
  const sampleRates = [44100, 48000, 32000]
  const bitrate = bitrates[bitrateIdx] * 1000, sampleRate = sampleRates[srIdx]
  let frameCount = 0, p = pos
  while (p < buf.length - 4) {
    if (buf[p] === 0xFF && (buf[p+1] & 0xE0) === 0xE0) {
      const fh = (buf[p] << 24) | (buf[p+1] << 16) | (buf[p+2] << 8) | buf[p+3]
      const bi = (fh >> 12) & 0xF, si = (fh >> 10) & 0x3, pad = (fh >> 9) & 0x1
      if (bi > 0 && bi < 15 && si < 3) {
        frameCount++; p += Math.floor(144 * bitrates[bi] * 1000 / sampleRates[si]) + pad; continue
      }
    }
    p++
  }
  const frameSize = Math.floor(144 * bitrate / sampleRate) + padding
  const xingFrame = Buffer.alloc(frameSize, 0)
  xingFrame[0] = buf[firstFramePos]; xingFrame[1] = buf[firstFramePos+1]
  xingFrame[2] = buf[firstFramePos+2]; xingFrame[3] = buf[firstFramePos+3]
  const xo = 4 + (channelMode === 3 ? 17 : 32)
  xingFrame[xo] = 0x58; xingFrame[xo+1] = 0x69; xingFrame[xo+2] = 0x6E; xingFrame[xo+3] = 0x67
  xingFrame[xo+7] = 0x01
  xingFrame[xo+8] = (frameCount >> 24) & 0xFF; xingFrame[xo+9] = (frameCount >> 16) & 0xFF
  xingFrame[xo+10] = (frameCount >> 8) & 0xFF; xingFrame[xo+11] = frameCount & 0xFF
  const dur = (frameCount * 1152 / sampleRate).toFixed(1)
  process.stdout.write(` → ${dur}s`)
  return Buffer.concat([buf.slice(0, firstFramePos), xingFrame, buf.slice(firstFramePos)])
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const ex of EXERCISES) {
    const paragraphs = toParagraphs(ex.fullDescription)
    console.log(`\nGenerating exercise-${ex.id} (${paragraphs.length} paragraphs)...`)
    const chunks: Buffer[] = []
    for (let i = 0; i < paragraphs.length; i++) {
      chunks.push(await generateParagraph(paragraphs[i], i, paragraphs.length))
      await sleep(300)
    }
    const withXing = addXingHeader(Buffer.concat(chunks))
    const outPath = path.join(OUT_DIR, `exercise-${ex.id}.mp3`)
    fs.writeFileSync(outPath, withXing)
    console.log(`\n  Saved: ${outPath} (${(withXing.length / 1024).toFixed(1)} KB)`)
  }
  console.log('\nAll done!')
}

main().catch(console.error)
