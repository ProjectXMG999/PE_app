# Progress — brand assets

Everything visual about the brand comes out of one command:

```bash
npm run generate-brand
```

It writes `public/brand/`, the install icons in `public/icons/`, and
`src/components/brand/wordmark.generated.ts` (which the app draws from). Change
the geometry in `scripts/generate-brand.mjs` and re-run — the favicon, the
home-screen icon and the logo in the top bar cannot drift apart, because they
are the same numbers.

## What ships

| File | Use |
| --- | --- |
| `brand/progress-logo.svg` | Full lockup, for dark backgrounds |
| `brand/progress-logo-light.svg` | Full lockup, for light backgrounds |
| `brand/progress-logo-mono-white.svg` / `-black.svg` | One colour — print, embroidery, a partner's page, anywhere the gradient can't go |
| `brand/progress-wordmark.svg` / `-light.svg` | Logotype alone |
| `brand/progress-mark.svg` / `-white.svg` | The bare P, trimmed to its ink |
| `brand/progress-icon.svg` | The P on its tile |
| `brand/og-image.png` | 1200×630 social card |
| `icons/*` | PWA install icons, Apple touch icon, favicons |

## The logotype

"Progress" is Plus Jakarta Sans ExtraBold, tracked −3.5%, **converted to
outlines**. Outlines rather than a font reference for two reasons: the logotype
then renders identically on every device (set as live text it came out as San
Francisco on iOS, Roboto on Android — a different brand shape per phone), and
nothing has to load before it appears.

Plus Jakarta Sans is licensed **SIL Open Font License 1.1**, which explicitly
permits commercial use, modification and use in logos, with no attribution
required in the product. Source: <https://github.com/tokotype/PlusJakartaSans>.

`wordmark.json` holds those outlines. It was produced once, from the TTF, by a
script kept out of the repo (it needs `opentype.js`, which nothing else here
uses). To regenerate it for a different word or weight:

```js
// npm i opentype.js, then, per DISTINCT glyph only — calling getPath() twice
// on the same glyph object corrupts the second result (a literal NaN control
// point, which silently truncates the path when a renderer parses it).
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const glyphs = [...WORD].map((ch) => font.charToGlyph(ch))  // not stringToGlyphs:
// that runs the full shaper, and PJS's ccmp lookup is one opentype.js refuses.
```

Letters are stored at the origin with an `x` offset each, so a repeated letter
is one outline placed twice.

## The mark

A geometric P at one stroke weight: a capped stem and a bowl arc of identical
width, meeting on the stem's centre line so the join disappears. The bowl's
start and end angles are solved from the geometry rather than typed in, so the
letter stays true if the proportions move.

The weight is 22.5% of cap height — heavier than the logotype's 20.8% — because
the mark has to hold at 16px, where the word never appears.

## Rules

- Never re-colour the mark to suit a background. It keeps its purple in both
  themes; only the logotype follows the text colour. Where the gradient can't
  go, use a mono lockup.
- `apple-touch-icon.png` is deliberately square and opaque. iOS applies its own
  mask, and a pre-rounded icon with transparent corners gets black wedges
  outside the squircle.
- The maskable icon bleeds its background past the edge on purpose — Android
  crops it to a circle, a squircle or a rounded square depending on the phone.
