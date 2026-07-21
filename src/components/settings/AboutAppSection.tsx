import { useState } from 'react'
import './AboutAppSection.css'

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
          <button
            className="about-app__btn"
            onClick={() => setIsPlayingWelcome(true)}
          >
            🎧 Słuchaj intro (2 min)
          </button>
        </div>

        <div className="about-app__section">
          <h4 className="about-app__subtitle">Historia systemu</h4>
          <p className="about-app__description">
            Dowiedz się, dlaczego stworzyliśmy ten system i jak różni się od tradycyjnych metod nauki języka. Opowiadamy o badaniach, философии i podejściu do nauki, które faktycznie działa.
          </p>
          <button
            className="about-app__btn"
            onClick={() => setIsPlayingStory(true)}
          >
            🎧 Słuchaj historii (5 min)
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

      {/* Audio modals */}
      {isPlayingWelcome && (
        <div className="about-app__audio-overlay" onClick={() => setIsPlayingWelcome(false)}>
          <div className="about-app__audio-modal" onClick={e => e.stopPropagation()}>
            <button
              className="about-app__audio-close"
              onClick={() => setIsPlayingWelcome(false)}
            >
              ✕
            </button>
            <h3>Witaj w Language Performance</h3>
            <audio
              controls
              autoPlay
              className="about-app__audio"
              onEnded={() => setIsPlayingWelcome(false)}
            >
              <source src="/audio/intro-welcome.mp3" type="audio/mpeg" />
              Twoja przeglądarka nie obsługuje odtwarzania audio.
            </audio>
          </div>
        </div>
      )}

      {isPlayingStory && (
        <div className="about-app__audio-overlay" onClick={() => setIsPlayingStory(false)}>
          <div className="about-app__audio-modal" onClick={e => e.stopPropagation()}>
            <button
              className="about-app__audio-close"
              onClick={() => setIsPlayingStory(false)}
            >
              ✕
            </button>
            <h3>Historia Language Performance</h3>
            <audio
              controls
              autoPlay
              className="about-app__audio"
              onEnded={() => setIsPlayingStory(false)}
            >
              <source src="/audio/intro-story.mp3" type="audio/mpeg" />
              Twoja przeglądarka nie obsługuje odtwarzania audio.
            </audio>
          </div>
        </div>
      )}
    </div>
  )
}
