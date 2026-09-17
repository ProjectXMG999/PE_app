'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight, Award, BookOpen, Brain, Check, ChevronDown, ChevronUp,
  Flame, Grid2X2, Layers3, Lock, Map, Play, RotateCcw, Search, Sparkles,
  Target, UserRound, X, Zap,
} from 'lucide-react'

const packs = [
  { id: 'daily', title: 'Codzienna rozmowa', subtitle: 'Słowa, które robią różnicę', words: '48 słów', status: 'mastered', tone: 'gold', icon: '✦' },
  { id: 'travel', title: 'W podróży', subtitle: 'Lotnisko · hotel · miasto', words: '36 słów', status: 'completed', tone: 'mint', icon: '↗' },
  { id: 'people', title: 'Ludzie i relacje', subtitle: 'Poznaj, opowiedz, zapytaj', words: '42 słowa', status: 'fading', tone: 'peach', icon: '○' },
  { id: 'work', title: 'Praca i ambicje', subtitle: 'Rozmowy, które otwierają drzwi', words: '64 słowa', status: 'frontier', tone: 'violet', icon: '↗' },
  { id: 'world', title: 'Świat po angielsku', subtitle: 'Opinie · media · kultura', words: '72 słowa', status: 'locked', tone: 'slate', icon: '◌' },
]
const statusLabels = { mastered: 'Utrwalone', completed: 'Poznane', fading: 'Wraca dziś', frontier: 'Następny krok', locked: 'Zablokowane' }

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="icon-button">{children}</button>
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<'today' | 'map'>('today')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [lens, setLens] = useState<'all' | 'review' | 'new'>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [started, setStarted] = useState(false)
  const visiblePacks = useMemo(() => packs.filter((pack) => {
    const matchesQuery = `${pack.title} ${pack.subtitle}`.toLowerCase().includes(query.toLowerCase())
    const matchesLens = lens === 'all' || (lens === 'review' && pack.status === 'fading') || (lens === 'new' && pack.status === 'frontier')
    return matchesQuery && matchesLens
  }), [lens, query])

  if (activeTab === 'today') return <TodayScreen onOpenMap={() => setActiveTab('map')} />

  return <main className="app-shell">
    <div className="ambient-grid" aria-hidden="true" />
    <div className="content-frame">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><Sparkles size={15} /></div><span>lingua</span></div>
        <div className="topbar-context"><span className="streak-dot" /> 7 dni z rzędu</div>
        <div className="topbar-actions">
          {searchOpen && <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="search-input" placeholder="Szukaj" aria-label="Szukaj pakietu" />}
          <IconButton label={searchOpen ? 'Zamknij wyszukiwanie' : 'Szukaj'} onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery('') }}>{searchOpen ? <X size={18} /> : <Search size={18} />}</IconButton>
          <button type="button" className="avatar" aria-label="Otwórz profil"><UserRound size={17} /></button>
        </div>
      </header>

      <section className="app-overview" aria-labelledby="page-title">
        <div><span className="section-kicker">PAKIETY</span><h1 id="page-title">Twoja mapa nauki</h1><p>Wiesz już, dokąd chcesz dojść?</p></div>
        <div className="coverage-compact"><strong>18%</strong><span>pokrycia</span></div>
      </section>

      <section className="progress-module" aria-label="Twój postęp">
        <div className="progress-module-head"><div><span className="muted-label">DZISIAJ</span><strong>12 z 20 słów</strong></div><span className="progress-percent">60%</span></div>
        <div className="progress-track"><span style={{ width: '60%' }} /></div>
        <div className="progress-module-foot"><span>Jeszcze 8 minut do celu</span><span>11 413 słów w pamięci</span></div>
      </section>

      <section className="next-card" aria-labelledby="next-title">
        <div className="next-kicker"><span><Zap size={13} /> SUGEROWANE DLA CIEBIE</span><span className="match-pill">98%</span></div>
        <div className="next-main"><div className="pack-symbol violet-symbol"><Target size={21} /></div><div><h2 id="next-title">W podróży</h2><p>36 słów <i>·</i> A2/B1 <i>·</i> 8 min</p></div><button className="play-button" type="button" aria-label="Rozpocznij pakiet W podróży" onClick={() => setStarted(true)}><Play size={16} fill="currentColor" /></button></div>
        <div className="reason-line"><Brain size={15} /><span>{started ? 'Dodano do Twojej dzisiejszej sesji.' : 'Uzupełnia lukę w słowach używanych w mieście.'}</span></div>
        {expanded && <div className="why-detail">Na podstawie Twoich odpowiedzi i tempa zanikania pamięci ten pakiet da Ci największy zwrot z 8 minut.</div>}
        <button type="button" className="details-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Zwiń szczegóły' : 'Dlaczego ten pakiet?'} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
      </section>

      <div className="section-heading"><div><span className="section-kicker">BIBLIOTEKA</span><h2>Pakiety dla Ciebie</h2></div><div className="view-toggle" role="group" aria-label="Widok pakietów"><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')} type="button"><Map size={15} /> Mapa</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} type="button"><Layers3 size={15} /> Lista</button></div></div>
      <div className="lens-row" role="group" aria-label="Filtruj pakiety"><button className={lens === 'all' ? 'active' : ''} onClick={() => setLens('all')} type="button">Wszystkie <span>864</span></button><button className={lens === 'review' ? 'active' : ''} onClick={() => setLens('review')} type="button"><RotateCcw size={13} /> Do powtórki <span>3</span></button><button className={lens === 'new' ? 'active' : ''} onClick={() => setLens('new')} type="button"><Sparkles size={13} /> Nowe</button></div>
      {view === 'map' ? <section className="map-route" aria-label="Mapa pakietów"><div className="route-line" aria-hidden="true" /><div className="route-caption"><span>ODKRYTE</span><span>NASTĘPNE ODKRYCIE</span></div>{visiblePacks.map((pack, index) => <PackNode key={pack.id} pack={pack} index={index} />)}<div className="far-horizon"><Lock size={15} /><span>864 pakiety czekają<br /><strong>dalej na Twojej mapie</strong></span></div></section> : <section className="list-view" aria-label="Lista pakietów">{visiblePacks.map((pack, index) => <PackNode key={pack.id} pack={pack} index={index} />)}</section>}

      <section className="memory-section"><div className="section-heading compact"><div><span className="section-kicker">INTELIGENTNA POWTÓRKA</span><h2>Wraca do Ciebie</h2></div><button className="text-button" type="button">Wszystkie <ArrowRight size={15} /></button></div><div className="memory-card"><div className="memory-icon"><Flame size={18} /></div><div><strong>3 pakiety bledną</strong><p>Krótka powtórka dziś utrzyma je na dłużej.</p></div><button type="button" className="memory-cta" onClick={() => setLens('review')}>Zacznij <ArrowRight size={15} /></button></div></section>
    </div>
    <nav className="bottom-nav" aria-label="Główna nawigacja"><button type="button" onClick={() => setActiveTab('today')}><BookOpen size={19} /><span>Dzisiaj</span></button><button type="button" className="selected"><Grid2X2 size={19} /><span>Mapa</span></button><button type="button"><Award size={19} /><span>Postęp</span></button><button type="button"><UserRound size={19} /><span>Profil</span></button></nav>
  </main>
}

function TodayScreen({ onOpenMap }: { onOpenMap: () => void }) {
  const [mode, setMode] = useState<'train' | 'listen'>('train')
  const [sessionStarted, setSessionStarted] = useState(false)
  return <main className="today-shell">
    <header className="today-topbar"><div className="today-logo">PE</div><div className="today-stats"><span>🔥 0 dni</span><span>◆ 9 693</span><span>❄ 1</span></div><span className="today-version">1.0.0+3059483</span><button className="today-icon" aria-label="Profil"><UserRound size={21} /></button><button className="today-icon" aria-label="Motyw">☼</button></header>
    <div className="today-content revolution-layout">
      <div className="today-welcome"><div><span className="today-eyebrow">PONIEDZIAŁEK, 12 SIERPNIA</span><h1>Dzisiaj</h1><p>Jedna dobra sesja. Nic więcej.</p></div><div className="day-score"><strong>0</strong><span>MIN</span></div></div>
      <div className="today-level-row"><span className="today-level-pill"><b /> Everyday English</span><button>Poziom A2 <ArrowRight size={16} /></button></div>
      <section className="focus-stage"><div className="focus-stage-kicker"><span>DAILY FOCUS</span><span className="focus-live"><i /> GOTOWE</span></div><div className="focus-stage-center"><div className="focus-orbit"><div className="focus-core"><span>0</span><small>MINUT</small></div></div><div><h2>Zacznij od<br /><em>jednej sesji</em></h2><p>15 minut, które pracują na Twoją pamięć.</p></div></div><div className="focus-stage-bottom"><div><span>CEL DNIA</span><strong>0 <small>/ 15 min</small></strong></div><button className={sessionStarted ? 'session-button started' : 'session-button'} onClick={() => setSessionStarted(true)}>{sessionStarted ? <><Check size={17} /> Sesja rozpoczęta</> : <><Play size={17} fill="currentColor" /> Rozpocznij sesję</>}</button></div></section>
      <div className="today-rail"><span>PRIORYTET NA DZIŚ</span><strong>Powtórka</strong><em>7 słów · około 1 minuty</em><button>Otwórz <ArrowRight size={15} /></button></div>
      <section className="word-moment"><div className="word-index">01 <span>/ 07</span></div><div><span className="today-label">SŁOWO NA DZIŚ</span><h2>deliberate</h2><p>celowy · przemyślany</p></div><button aria-label="Odtwórz wymowę">◖</button></section>
      <div className="mode-switch" role="group" aria-label="Tryb nauki"><button className={mode === 'listen' ? 'active' : ''} onClick={() => setMode('listen')}>▪ Słuchaj</button><button className={mode === 'train' ? 'active' : ''} onClick={() => setMode('train')}>⚡ Trenuj</button><button aria-label="Informacje">ⓘ</button></div>
      <div className="today-section-heading"><span className="today-label">SYGNAŁ PAMIĘCI</span><button>Pełny postęp <ArrowRight size={15} /></button></div>
      <section className="today-progress"><div className="progress-copy"><span>SŁOWA W PAMIĘCI</span><strong>486 <small>/ 10 000</small></strong></div><div className="progress-value">5%</div><div className="goal-track"><span style={{ width: '5%' }} /></div><p>+12 słów w tym tygodniu</p><div className="memory-pulse" aria-label="Stan pamięci"><span /><span /><span /><span /><span /><span /><span /></div></section>
      <section className="training-card"><div><span className="today-label">NASTĘPNY RUCH</span><h2>Działania</h2><p>Everyday English · 1 minuta</p></div><button aria-label="Rozpocznij trening"><Zap size={18} /> <span>Trenuj</span> <ArrowRight size={17} /></button></section>
    </div>
    <nav className="bottom-nav today-nav"><button className="selected"><BookOpen size={21} /><span>Dzisiaj</span></button><button type="button" onClick={onOpenMap}><Grid2X2 size={21} /><span>Mapa</span></button><button><Award size={21} /><span>Trening</span></button><button><ActivityIcon /><span>Postęp</span></button><button><SettingsIcon /><span>Ustawienia</span></button></nav>
  </main>
}
function ActivityIcon() { return <span className="nav-glyph">⌁</span> }
function SettingsIcon() { return <span className="nav-glyph">⚙</span> }

function PackNode({ pack, index }: { pack: typeof packs[number]; index: number }) {
  const status = pack.status
  return <article className={`pack-node ${status} ${pack.tone}`} style={{ '--node-index': index } as React.CSSProperties}><div className="node-marker" aria-hidden="true">{status === 'locked' ? <Lock size={14} /> : status === 'mastered' ? <Check size={16} /> : <span>{pack.icon}</span>}</div><div className="pack-card"><div className="pack-card-top"><span className="status-label">{statusLabels[status]}</span><span className="pack-words">{pack.words}</span></div><h3>{pack.title}</h3><p>{pack.subtitle}</p>{status === 'fading' && <div className="mini-progress"><span style={{ width: '62%' }} /></div>}{status === 'frontier' && <button type="button" className="small-start">Odkryj <ArrowRight size={14} /></button>}</div></article>
}
