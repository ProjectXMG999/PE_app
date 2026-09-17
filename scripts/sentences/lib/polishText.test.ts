import { describe, expect, it } from 'vitest'
import { cleanPolishTranslation, normalizePolishForAudio } from './polishText'

describe('cleanPolishTranslation', () => {
  it.each([
    ['Miasto (małe I średnie)', 'Miasto (małe i średnie)'],
    ['I tak I tak; w każdym razie', 'I tak i tak; w każdym razie'],
    ['Zatrzymywać kogoś (I nie pozwolić mu odejść)', 'Zatrzymywać kogoś (i nie pozwolić mu odejść)'],
    ['I kręci mnie to; I super', 'I kręci mnie to; i super'],
    ['Oszukiwać (np. W grze); ściągać (np. Na teście)', 'Oszukiwać (np. w grze); ściągać (np. na teście)'],
    ['Przez (np. Berlin)', 'Przez (np. Berlin)'],
    ['Dyrektor ds. Sprzedaży (skrót)', 'Dyrektor ds. sprzedaży (skrót)'],
    ['Lic. Nauk ścisłych', 'Lic. nauk ścisłych'],
    ['Domowy; kryty (wew. Budynku)', 'Domowy; kryty (wew. budynku)'],
    ['Śledzić; Iść za kimś', 'Śledzić; iść za kimś'],
    ['Muszę Iść (skrót)', 'Muszę iść (skrót)'],
    ['Cel (Moim celem jest)', 'Cel (moim celem jest)'],
    ['Jej (komu? Czemu?)', 'Jej (komu? czemu?)'],
    ['Fuj! Ohydne!', 'Fuj! Ohydne!'],
    ['Austriaczka, Austriak', 'Austriaczka, Austriak'],
    ['Zgadzam się (skrócone "Yes, I agree")', 'Zgadzam się (skrócone "Yes, I agree")'],
    ['Przed ( o czasie)', 'Przed (o czasie)'],
    ['Dostosowywać  (np. Do konkretnej osoby)', 'Dostosowywać (np. do konkretnej osoby)'],
    ['Przed (kimś,czymś); naprzeciw', 'Przed (kimś, czymś); naprzeciw'],
    ['Weryfikacja;potwierdzenie', 'Weryfikacja; potwierdzenie'],
    ['Leżący u podstaw; nadrzędny,; główny', 'Leżący u podstaw; nadrzędny; główny'],
    ['Wąchać;', 'Wąchać'],
    ['Luksusowo/ git', 'Luksusowo/git'],
    ['Programista 24/7', 'Programista 24/7'],
    ['Odbić się (np ceny, gdy znowu idą w górę)', 'Odbić się (np. ceny, gdy znowu idą w górę)'],
    ['Bośnia I hercegowina', 'Bośnia i Hercegowina'],
    ['Lek. Med.', 'Lek. med.'],
    ['Wiad.', 'Wiad.'],
    ['Móc; umieć; potrafić', 'Móc; umieć; potrafić'],
  ])('%s', (input, expected) => {
    expect(cleanPolishTranslation(input)).toBe(expected)
  })
})

describe('normalizePolishForAudio', () => {
  it('keeps the first meaning without notes', () => {
    expect(normalizePolishForAudio('Móc; umieć; potrafić')).toBe('Móc')
    expect(normalizePolishForAudio('Miasto (małe i średnie)')).toBe('Miasto')
  })

  it('reads a slash between Polish words as "lub"', () => {
    expect(normalizePolishForAudio('Zmienić imię/nazwę')).toBe('Zmienić imię lub nazwę')
  })
})
