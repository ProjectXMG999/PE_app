import { useEffect } from 'react'
import { ScrollTrigger } from './lib/gsap'
import { Navbar } from './components/sections/Navbar'
import { Hero } from './components/sections/Hero'
import { MapSection } from './components/sections/MapSection'
import { WhyOrderSection } from './components/sections/WhyOrderSection'
import { RecognitionVsUseSection } from './components/sections/RecognitionVsUseSection'
import { WhyStillNotSpeakingSection } from './components/sections/WhyStillNotSpeakingSection'
import { TwoTrainingModesSection } from './components/sections/TwoTrainingModesSection'
import { SeeYourProgressSection } from './components/sections/SeeYourProgressSection'
import { HowWeKnowSection } from './components/sections/HowWeKnowSection'
import { DreamOutcomeSection } from './components/sections/DreamOutcomeSection'
import { ScientificFoundationSection } from './components/sections/ScientificFoundationSection'
import { BehindProgressSection } from './components/sections/BehindProgressSection'
import { OfferSection } from './components/sections/OfferSection'
import { Footer } from './components/sections/Footer'
import { ToastHost } from './components/shared/ToastHost'

export function App() {
  // Every section creates its own ScrollTrigger in its own effect; each one
  // caches start/end positions against the document height at that instant.
  // Because pinned sections (MapSection, SeeYourProgressSection) grow the
  // document as they mount, triggers created before them end up stale. One
  // refresh after the full tree has painted recalculates every trigger
  // against the final layout.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    // Google Fonts load async (font-display: swap) and can still reflow
    // text height after the first refresh above — refresh again once they
    // land so trigger positions match the final, post-swap layout.
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MapSection />
        <WhyOrderSection />
        <RecognitionVsUseSection />
        <WhyStillNotSpeakingSection />
        <TwoTrainingModesSection />
        <SeeYourProgressSection />
        <HowWeKnowSection />
        <DreamOutcomeSection />
        <ScientificFoundationSection />
        <BehindProgressSection />
        <OfferSection />
      </main>
      <Footer />
      <ToastHost />
    </>
  )
}
