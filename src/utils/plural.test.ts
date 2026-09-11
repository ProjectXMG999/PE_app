import { describe, expect, it } from 'vitest'
import { plural, plWords, plMinutes, plDays, plTimes, plPacks } from './plural'

describe('plural', () => {
  it('uses the singular only for exactly 1', () => {
    expect(plMinutes(1)).toBe('minuta')
    expect(plMinutes(0)).toBe('minut')
  })

  it('uses the 2-4 form — the case every n === 1 ternary got wrong', () => {
    // This is the bug the Postęp page shipped: "przez 3 minut".
    expect(plMinutes(2)).toBe('minuty')
    expect(plMinutes(3)).toBe('minuty')
    expect(plMinutes(4)).toBe('minuty')
    expect(plWords(2)).toBe('słowa')
    expect(plWords(4)).toBe('słowa')
  })

  it('sends the teens to the many-form despite their last digit', () => {
    expect(plMinutes(12)).toBe('minut')
    expect(plMinutes(13)).toBe('minut')
    expect(plMinutes(14)).toBe('minut')
    expect(plWords(112)).toBe('słów')
  })

  it('reads the last digit above the teens', () => {
    expect(plMinutes(22)).toBe('minuty')
    expect(plMinutes(25)).toBe('minut')
    expect(plWords(104)).toBe('słowa')
    expect(plPacks(102)).toBe('paczki')
  })

  it('covers the real figures from the Postęp page', () => {
    expect(`35 ${plWords(35)}`).toBe('35 słów')
    expect(`3 ${plMinutes(3)}`).toBe('3 minuty')
    expect(`672 ${plMinutes(672)}`).toBe('672 minuty')
    expect(`91 ${plDays(91)}`).toBe('91 dni')
    expect(`1 ${plDays(1)}`).toBe('1 dzień')
    expect(`0 ${plTimes(0)}`).toBe('0 razy')
    expect(`1 ${plTimes(1)}`).toBe('1 raz')
  })

  it('ignores sign and fraction', () => {
    expect(plural(-3, 'a', 'b', 'c')).toBe('b')
    expect(plural(3.7, 'a', 'b', 'c')).toBe('b')
  })
})
