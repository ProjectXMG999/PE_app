import { describe, it, expect } from 'vitest'
import { sessionAccent } from './sessionRoutes'
import { LEVEL_COLORS } from '../data/levels'
import packagesIndex from '../data/packages-index.json'
import { PackMeta } from '../types/vocabulary'

const first = (packagesIndex as PackMeta[])[0]

describe('sessionAccent', () => {
  it('claims the two pack-less sessions in their own colours', () => {
    expect(sessionAccent('/powtorka')).toBe('var(--live)')
    expect(sessionAccent('/inteligentny')).toBe('var(--accent)')
  })

  it('gives a pack-scoped session its level colour', () => {
    // The same colour PackSessionOpener passes to the curtain, so the ground
    // held up before the page mounts is the one the page then paints.
    for (const mode of ['word-flash', 'active-sentence', 'fiszki', 'listen']) {
      expect(sessionAccent(`/pakiet/${first.id}/${mode}`)).toBe(LEVEL_COLORS[first.level])
    }
  })

  it('does not claim the mode choosers', () => {
    // Both are ordinary pages under a pack — they open no curtain, so a ground
    // in front of them would be an opaque screen nothing lifts.
    expect(sessionAccent(`/pakiet/${first.id}/start`)).toBeNull()
    expect(sessionAccent(`/pakiet/${first.id}/fiszki-start`)).toBeNull()
  })

  it('does not claim pages outside a session', () => {
    for (const p of ['/dzis', '/pakiety', '/pakiet/' + first.id, '/trening', '/trening/x', '/postęp', '/ustawienia', '/konto', '/logowanie']) {
      expect(sessionAccent(p)).toBeNull()
    }
  })

  it('still opens a curtain for a pack it has never heard of', () => {
    // The session page is what reports the error, and it reports it UNDER the
    // curtain — so the ground has to be there for it to lift.
    expect(sessionAccent('/pakiet/nie-ma-takiego/word-flash')).toBe('var(--accent)')
  })

  it('reads a percent-encoded path, and ignores query and hash', () => {
    expect(sessionAccent('/inteligentny?x=1#y')).toBe('var(--accent)')
    expect(sessionAccent('/post%C4%99p')).toBeNull()
  })
})
