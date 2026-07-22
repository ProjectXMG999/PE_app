import { useState } from 'react'
import { AudioModal } from '../shared/AudioModal'
import audioTimings from '../../data/audioTimings.json'
import './AboutAppSection.css'

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


export function AboutAppSection() {
  const [isPlayingWelcome, setIsPlayingWelcome] = useState(false)
  const [isPlayingStory, setIsPlayingStory] = useState(false)

  return (
    <div className="about-app">
      <div className="about-app__content">
        <h3 className="about-app__title">O Language Performance</h3>

        <div className="about-app__section">
          <h4 className="about-app__subtitle">Witaj w aplikacji</h4>
          <p className="about-app__description">
            Language Performance to trening słownictwa zaprojektowany jak plan treningowy na siłowni — krok po kroku, od najważniejszych słów do swobodnej komunikacji.
          </p>
          <button className="about-app__btn" onClick={() => setIsPlayingWelcome(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Słuchaj intro
            <span className="about-app__btn-duration">2 min</span>
          </button>
        </div>

        <div className="about-app__section">
          <h4 className="about-app__subtitle">Historia powstawania systemu</h4>
          <p className="about-app__description">
            Dowiedz się, dlaczego stworzyliśmy ten system i jak różni się od tradycyjnych metod nauki języka.
          </p>
          <button className="about-app__btn" onClick={() => setIsPlayingStory(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            Słuchaj historii
            <span className="about-app__btn-duration">5 min</span>
          </button>
        </div>

        <div className="about-app__section">
          <h4 className="about-app__subtitle">Poziomy angielskiego</h4>
          <div className="about-app__levels">
            <div className="about-app__level">
              <span className="about-app__level-badge" style={{ background: '#eab308' }}>L1</span>
              <div>
                <h5>Survival English</h5>
                <p>~1000 słów • Przetrwasz wszędzie</p>
              </div>
            </div>
            <div className="about-app__level">
              <span className="about-app__level-badge" style={{ background: '#f97316' }}>L2</span>
              <div>
                <h5>Everyday English</h5>
                <p>~3000 słów • Dogadasz się wszędzie</p>
              </div>
            </div>
            <div className="about-app__level">
              <span className="about-app__level-badge" style={{ background: '#22c55e' }}>L3</span>
              <div>
                <h5>Freedom English</h5>
                <p>~6000 słów • Mówisz to co chcesz</p>
              </div>
            </div>
            <div className="about-app__level">
              <span className="about-app__level-badge" style={{ background: '#3b82f6' }}>L4</span>
              <div>
                <h5>World-Class English</h5>
                <p>~10 000 słów • Język który robi wrażenie</p>
              </div>
            </div>
          </div>
        </div>

        <div className="about-app__section">
          <h4 className="about-app__subtitle">Cztery ćwiczenia treningowe</h4>
          <div className="about-app__exercises">
            <div className="about-app__exercise">
              <span>🎯</span>
              <div>
                <h5>Słowo w Akcji</h5>
                <p>Zrób pierwsze frazy ze słowem</p>
              </div>
            </div>
            <div className="about-app__exercise">
              <span>💬</span>
              <div>
                <h5>Moje Zdanie</h5>
                <p>Zamień słowo w zdanie z Twojego życia</p>
              </div>
            </div>
            <div className="about-app__exercise">
              <span>🌍</span>
              <div>
                <h5>Jedno Słowo, Trzy Dziedziny</h5>
                <p>Użyj słowa w domu, pracy i codzienności</p>
              </div>
            </div>
            <div className="about-app__exercise">
              <span>📈</span>
              <div>
                <h5>Drabina Zdania</h5>
                <p>Rozwiń krótkie zdanie w wypowiedź</p>
              </div>
            </div>
          </div>
        </div>

        <div className="about-app__section about-app__section--last">
          <h4 className="about-app__subtitle">Zapamiętaj</h4>
          <p className="about-app__highlight">
            Nie szukamy perfekcji. Szanujemy regularność. Małe kroki, codziennie — to klucz.
          </p>
        </div>
      </div>

      {isPlayingWelcome && (
        <AudioModal
          title="Witaj w Language Performance"
          label="Intro"
          duration="2 min"
          src="/audio/intro-welcome.mp3"
          paragraphs={WELCOME_PARAGRAPHS}
          timings={audioTimings['intro-welcome.mp3'].timings}
          onClose={() => setIsPlayingWelcome(false)}
        />
      )}

      {isPlayingStory && (
        <AudioModal
          title="Historia Language Performance"
          label="Historia systemu"
          duration="5 min"
          src="/audio/intro-story.mp3"
          paragraphs={STORY_PARAGRAPHS}
          timings={audioTimings['intro-story.mp3'].timings}
          onClose={() => setIsPlayingStory(false)}
        />
      )}
    </div>
  )
}
