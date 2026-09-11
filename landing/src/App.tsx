import { AmbientBackground } from './components/ambient/AmbientBackground'
import { Navbar } from './components/sections/Navbar'
import { Hero } from './components/sections/Hero'
import { MapSection } from './components/sections/MapSection'
import { WhyOrderSection } from './components/sections/WhyOrderSection'
import { RecognitionVsUseSection } from './components/sections/RecognitionVsUseSection'
import { TwoTrainingModesSection } from './components/sections/TwoTrainingModesSection'
import { SeeYourProgressSection } from './components/sections/SeeYourProgressSection'
import { ProofSection } from './components/sections/ProofSection'
import { OfferSection } from './components/sections/OfferSection'
import { Footer } from './components/sections/Footer'

/**
 * Eight sections, alternating tinted / untinted so the page has a rhythm.
 *
 * It used to be thirteen, nine of which were the same shape — an eyebrow, a
 * title, and a column of 17px prose — differentiated only by the colour of one
 * punch line. Merged since: "Znasz więcej angielskiego" absorbed "Dlaczego
 * wciąż nie mówisz" (one argument, told twice), "Skąd wiemy" absorbed the
 * Scientific Foundation and Behind Progress walls of text as expandable detail,
 * and "Dream outcome" became the lead-in to the offer it was already arguing for.
 */
export function App() {
  return (
    <>
      <AmbientBackground />
      <Navbar />
      <main>
        <Hero />
        <MapSection />
        <WhyOrderSection />
        <RecognitionVsUseSection />
        <TwoTrainingModesSection />
        <SeeYourProgressSection />
        <ProofSection />
        <OfferSection />
      </main>
      <Footer />
    </>
  )
}
