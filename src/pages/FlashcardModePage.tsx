import { type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { usePackageData } from '../hooks/usePackageData'
import { ModeScreen, ModeBlock, ModeCard, ModeFact, ModeLabel, ModeNote } from '../components/mode/ModeScreen'
import { CardsGlyph, SpeechGlyph } from '../components/mode/glyphs'
import { getPackNumber, plWords } from '../utils/packVisuals'
import { LEVEL_COLORS } from '../data/levels'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'
import './FlashcardModePage.css'
import { useAppNavigate } from '../navigation/navigation'
import { unlockAudioGlobally } from '../audio/audioUnlock'
import { warmCurtainSound } from '../services/sfx'

const allPacks = packagesIndex as PackMeta[]

type FlashcardMode = 'word-flash' | 'active-sentence'

interface ModeDef {
  id: FlashcardMode
  glyph: ReactNode
  /** The mode's own colour — the two trainings must not read as one block. */
  color: string
  name: string
  tagline: string
  desc: string
  cta: string
}

const MODES: ModeDef[] = [
  {
    id: 'word-flash',
    glyph: <CardsGlyph />,
    color: 'var(--accent)',
    name: 'Word Flash',
    tagline: 'Szybki przegląd słów',
    desc: 'Widzisz polskie słowo, próbujesz przypomnieć sobie angielskie i dopiero potem odsłaniasz odpowiedź. Rozgrzewka dla pamięci.',
    cta: 'Zacznij fiszki',
  },
  {
    id: 'active-sentence',
    glyph: <SpeechGlyph />,
    color: 'var(--accent-pink)',
    name: 'Active Sentence',
    tagline: 'Całe zdania na głos',
    desc: 'Widzisz polskie zdanie i budujesz angielską odpowiedź, zanim ją odsłonisz. Trudniej — i tu zaczyna się prawdziwe mówienie.',
    cta: 'Zacznij mówić',
  },
]

/** Polish plural for "zdanie": 1 → zdanie, 2–4 → zdania, else → zdań. */
function plSentences(n: number): string {
  const last = n % 10
  const last2 = n % 100
  if (n === 1) return 'zdanie'
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return 'zdania'
  return 'zdań'
}

export function FlashcardModePage() {
  const { packageId } = useParams<{ packageId: string }>()
  const navigate = useAppNavigate()

  const meta = allPacks.find(p => p.id === packageId)
  const { pack } = usePackageData(packageId ?? null)

  const wordCount = pack?.words.length ?? meta?.wordCount ?? 0
  // Only counted once the pack body is loaded — until then the card says
  // nothing rather than guessing at a number it doesn't have.
  const sentenceCount = pack?.words.filter(w => w.sentencePl || w.sentenceEn).length ?? null
  const packNum = packageId ? getPackNumber(packageId) : null

  const cardMeta = (id: FlashcardMode): ReactNode => {
    if (id === 'word-flash') {
      return (
        <>
          {wordCount > 0 && <span><em>{wordCount}</em> {plWords(wordCount)}</span>}
          <span>we własnym tempie</span>
        </>
      )
    }
    if (sentenceCount === null) return <span>we własnym tempie</span>
    // The session still runs on a sentence-less pack — it just shows the words
    // themselves, so say that instead of promising sentences that aren't there.
    if (sentenceCount === 0) return <span>Ten pakiet nie ma jeszcze zdań — zobaczysz same słowa</span>
    return (
      <>
        <span><em>{sentenceCount}</em> {plSentences(sentenceCount)}</span>
        <span>mówisz na głos</span>
      </>
    )
  }

  return (
    <ModeScreen
      tone="train"
      kicker={<>Trenuj{packNum ? ` · pakiet #${packNum}` : ''}</>}
      title={meta?.name ?? packageId ?? 'Pakiet'}
      facts={
        <>
          {meta?.level ? (
            <ModeFact color={LEVEL_COLORS[meta.level]}>Poziom {meta.level}</ModeFact>
          ) : null}
          {meta?.volume ? <ModeFact>{meta.volume}</ModeFact> : null}
          {wordCount > 0 && <ModeFact>{wordCount} {plWords(wordCount)}</ModeFact>}
        </>
      }
      lead="W obu trybach ćwiczysz te same słowa. Różnica jest w tym, ile musisz powiedzieć z głowy, zanim odsłonisz odpowiedź."
    >
      <ModeBlock glass>
        <ModeLabel aside="Od łatwiejszego">Tryb treningu</ModeLabel>
        <div className="modescreen__cards">
          {MODES.map((m, i) => (
            <ModeCard
              key={m.id}
              glyph={m.glyph}
              color={m.color}
              cta={m.cta}
              name={m.name}
              tagline={m.tagline}
              desc={m.desc}
              meta={cardMeta(m.id)}
              detail={
                <span className="fc-mode__effort" aria-label={i === 0 ? 'Wysiłek: 1 z 2' : 'Wysiłek: 2 z 2'}>
                  <span className="fc-mode__effort-label">Wysiłek</span>
                  <span className="fc-mode__effort-dots" aria-hidden="true">
                    <i className="is-on" />
                    <i className={i === 1 ? 'is-on' : ''} />
                  </span>
                </span>
              }
              // Unlocked here, synchronously inside the gesture, exactly as the
              // Słuchaj and Dzisiaj launchers do. Without it these two modes
              // reached their session with no audio context at all, so the
              // curtain that opens them was the only silent one in the app.
              onClick={() => {
                unlockAudioGlobally()
                // The curtain's noise bed, built at idle instead of in the
                // frames it animates — see warmCurtainSound.
                warmCurtainSound()
                navigate(`/pakiet/${packageId}/${m.id}`)
              }}
            />
          ))}
        </div>
      </ModeBlock>

      <ModeBlock>
        <ModeNote label="Jak działa tryb Trenuj?">
          Aktywny trening z ekranem. Przypominasz sobie angielskie słowa, mówisz je na głos
          i budujesz z nimi zdania — tak przechodzisz od rozpoznawania słów do ich używania.
        </ModeNote>
      </ModeBlock>
    </ModeScreen>
  )
}
