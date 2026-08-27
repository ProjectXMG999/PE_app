import type { CheckpointRecord } from './types.js'

// Each pack is generated as an independent, stateless API request (see
// lib/batching.ts) — the model has zero visibility into what it already
// wrote for any OTHER pack. The prompt's anti-repetition guidance only ever
// covers the ~13 words inside one request, so across a run of hundreds of
// packs the model falls back on the same small set of "safe" vivid props
// (coffee, keys, dog, phone, fridge...) over and over. Measured on a live
// run: "coffee" showed up in 10% of generated words once the prompt started
// requiring an emotional/concrete detail per sentence.
//
// This tracker closes that loop from the orchestrator side: every generated
// word is folded into a running frequency count, and overusedWords() feeds
// the current "avoid these" list into the next batch's prompt. Because
// batches are dispatched through a concurrency limiter (see lib/limiter.ts)
// and each batch reads the tracker fresh right before its API call, later
// batches see everything completed so far — including from earlier in the
// same run — so this self-corrects as generation proceeds, not just across
// separate invocations.
//
// A record's own target word never counts toward its overuse tally (see
// addRecord) — otherwise legitimate uses (word="Cat") would dilute the
// signal that should catch the decorative pattern this was built for:
// "cat"/"dog" as a default filler character for words that have nothing to
// do with pets (e.g. word="Twenty-three" -> "My cat hid twenty-three
// socks.").
//
// Revision 2: candidate1 is now a dedicated "modern/2026 brand grounding"
// slot for EVERY word (see lib/prompt.ts), not an occasional aside. With
// only ~20 safe, globally-recognizable, neutral brand names to rotate
// through thousands of words, each one will legitimately recur far more
// than this tracker's 2%-of-run threshold — that recurrence is now by
// design, not the same failure mode as "coffee." Brand/app names are
// tracked separately (brandCounts) purely for reporting and are excluded
// from overusedWords() entirely.

// Deliberately broad: function words, pronouns, articles, modal/aux verbs,
// and common general-purpose verbs/adverbs that are structurally frequent
// in short natural sentences (please, need, want, today, let's...) and are
// NOT the "same vivid prop reused everywhere" problem this exists to catch.
// Excluding them keeps the tracker focused on concrete nouns/props.
const STOPWORDS = new Set(
  `a an the this that these those i you he she it we they me him her us them my your his its our their mine yours
   hers ours theirs myself yourself himself herself itself ourselves yourselves themselves
   am is are was were be been being have has had do does did will would shall should can could may might must
   not no yes and or but so if then than because while when where what who whom whose which how why
   in on at by for with about against between into through during before after above below to from up down
   out off over under again further once here there all any both each few more most other some such
   only own same too very just now today tomorrow yesterday please thanks sorry okay ok well really actually
   maybe probably definitely totally literally basically already still yet again always never sometimes often
   let lets want wants wanted need needs needed like likes liked get gets got getting go goes going went come
   comes came know knows knew think thinks thought call calls called try tries tried help helps helped find
   finds found bring brings brought take takes took make makes made say says said tell tells told ask asks
   asked give gives gave leave leaves left stay stays stayed wait waits waited hope hopes hoped feel feels felt
   love loves loved miss misses missed forgot remember remembers remembered new good bad little bit lot`
    .split(/\s+/)
    .filter(Boolean)
)

// Recognizable modern brands/apps/tech the prompt explicitly tells the
// model to reach for in candidate1. Keep in sync with the illustrative list
// in lib/prompt.ts's "WSPÓŁCZESNOŚĆ / 2026" slot description — this doesn't
// need to be exhaustive, just cover the common ones so they don't pollute
// the "unintentional prop repetition" signal.
const BRAND_WORDS = new Set(
  `netflix spotify uber instagram whatsapp tiktok zoom google maps amazon iphone macbook samsung youtube
   starbucks ikea nike airbnb toyota porsche paypal venmo android tesla facebook twitter linkedin pinterest`
    .split(/\s+/)
    .filter(Boolean)
)

function extractContentWords(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? []
  return new Set(tokens.filter((t) => t.length > 2 && !STOPWORDS.has(t.replace(/'.*$/, ''))))
}

export class RepetitionTracker {
  private counts = new Map<string, number>()
  private brandCounts = new Map<string, number>()
  private totalWords = 0

  seed(records: CheckpointRecord[]): void {
    for (const r of records) this.addRecord(r)
  }

  addRecord(r: Pick<CheckpointRecord, 'candidate1En' | 'candidate2En' | 'candidate3En' | 'english'>): void {
    this.totalWords++
    const text = [r.candidate1En, r.candidate2En, r.candidate3En].join(' ')
    // A word's own vocabulary tokens don't count toward "overuse" — a "Cat"
    // or "Dog" record legitimately using "cat"/"dog" shouldn't dilute the
    // signal that would otherwise catch "cat"/"dog" being reused as a
    // decorative default character for unrelated words (e.g. "Twenty-three"
    // -> "My cat hid twenty-three socks.").
    const ownTokens = new Set((r.english.toLowerCase().match(/[a-z']+/g) ?? []).filter((t) => t.length > 2))
    for (const word of extractContentWords(text)) {
      if (ownTokens.has(word)) continue
      if (BRAND_WORDS.has(word)) {
        this.brandCounts.set(word, (this.brandCounts.get(word) ?? 0) + 1)
        continue
      }
      this.counts.set(word, (this.counts.get(word) ?? 0) + 1)
    }
  }

  // For reporting only (e.g. a run summary) — brand frequency is expected
  // and intentionally excluded from overusedWords()/the "avoid" prompt line.
  brandFrequency(): Map<string, number> {
    return new Map(this.brandCounts)
  }

  // A word only counts as "overused" once there's enough data to trust the
  // ratio (minWords) and it appears in a meaningfully large share of all
  // generated words so far — not just a couple of coincidental hits.
  overusedWords(minWords = 40, ratio = 0.02, limit = 20): string[] {
    if (this.totalWords < minWords) return []
    return [...this.counts.entries()]
      .filter(([, count]) => count / this.totalWords >= ratio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word)
  }
}
