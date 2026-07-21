// Generate intro-welcome.mp3 and intro-story.mp3 using Piotr (PL voice)
// Output: public/audio/intro-welcome.mp3, public/audio/intro-story.mp3

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public/audio')
const API_KEY = process.env.ELEVENLABS_API_KEY || ''
const MODEL_ID = 'eleven_multilingual_v2'
const PIOTR_VOICE_ID = 'o2xdfKUpc1Bwq7RchZuW'

const WELCOME_PARAGRAPHS = [
  'Witaj w Language Performance.',
  'To nie jest zwykła aplikacja do klikania słówek. To jest Twój językowy trening. Zaprojektowaliśmy ją tak, żeby prowadzić Cię krok po kroku — jak trener na siłowni albo dobry plan treningowy.',
  'Naszym celem jest prosta rzecz: chcemy nauczyć Cię tych słów, które dadzą Ci najwięcej mówienia w najkrótszym czasie. Dlatego słownictwo nie jest tutaj przypadkowe. Jest ułożone od najważniejszych słów do coraz bardziej precyzyjnych. Najpierw uczysz się tego, co naprawdę pozwala przetrwać, dogadać się, zareagować i powiedzieć coś o sobie.',
  'Masz tutaj dwa główne tryby.',
  'Pierwszy to Słuchaj. To tryb audio. Możesz uczyć się w drodze, na spacerze, w samochodzie albo wtedy, kiedy nie chcesz patrzeć w ekran. Osłuchujesz się ze słowami, zdaniami i rytmem języka.',
  'Drugi to Aktywuj. To tryb treningowy. Tutaj słowo przestaje być tylko znane. Zaczynasz je przypominać sobie, mówić na głos, łączyć w frazy i budować z nim zdania.',
  'W treningu spotkasz cztery ćwiczenia: Słowo w Akcji, Moje Zdanie, Jedno Słowo, Trzy Dziedziny i Drabina Zdania. Każde z nich robi coś innego. Najpierw uczysz mózg, że słowo działa. Potem tworzysz własne zdanie. Potem przenosisz słowo do różnych sytuacji. A na końcu uczysz się rozwijać wypowiedź.',
  'Będziesz też przechodzić przez poziomy. Level 1 to survival — zaczynasz sobie radzić. Level 2 to codzienna komunikacja. Level 3 to językowa wolność. Level 4 to angielski, który robi wrażenie.',
  'Nie musisz robić wszystkiego idealnie. Masz robić małe kroki. Słuchać. Aktywować. Mówić na głos. Wracać. I widzieć progres.',
  'Zaczynamy. Wybierz paczkę i zrób pierwszy trening.',
]

const STORY_PARAGRAPHS = [
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
  'Mózg uwielbia częsty kontakt z językiem. Właśnie dlatego zachęcam Cię do krótkich, ale codziennych treningów.',
]

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY env var not set')
  process.exit(1)
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

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
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`ElevenLabs ${response.status}: ${err.slice(0, 200)}`)
      }
      process.stdout.write(`\r  [${index + 1}/${total}] OK`)
      return Buffer.from(await response.arrayBuffer())
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(2000 * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

async function generateFile(paragraphs: string[], outputPath: string, label: string) {
  console.log(`\nGenerating ${label} (${paragraphs.length} paragraphs)...`)
  const chunks: Buffer[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    chunks.push(await generateParagraph(paragraphs[i], i, paragraphs.length))
    await sleep(300)
  }
  const combined = Buffer.concat(chunks)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, combined)
  const kb = (combined.length / 1024).toFixed(1)
  console.log(`\n  Saved: ${outputPath} (${kb} KB)`)
}

async function main() {
  await generateFile(WELCOME_PARAGRAPHS, path.join(OUT_DIR, 'intro-welcome.mp3'), 'intro-welcome')
  await generateFile(STORY_PARAGRAPHS, path.join(OUT_DIR, 'intro-story.mp3'), 'intro-story')
  console.log('\nDone!')
}

main().catch(console.error)
