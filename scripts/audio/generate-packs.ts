// Production audio generation pipeline. Sentences: unchanged plain TTS
// (they already sound natural, they have context). Words (Etap 2, per
// docs/voicelab.md, confirmed by A/B listening rounds 5-6 for both
// languages — carrier v4 beats baseline for PL and, on the final check,
// for EN too): generated inside a fixed carrier phrase ("The word is
// {word}." / "Słowo: {word}.") via /with-timestamps, cut from the word's
// precise alignment start to the clip's TRUE end (no estimated end at
// all — see cutClipFromStart in ffmpegPost.ts for why), then only genuine
// trailing silence trimmed. 429-type-aware retry, resumable JSONL
// checkpoint, and a correct `sentenceAudio` write-back (only set true for
// a word whose EN+PL sentence clips were actually confirmed in THIS run —
// see scripts/audio/lib/checkpoint.ts).
//
// Word tasks are always in scope regardless of the blob audit (the point
// of this run is to replace every word clip generated under the old
// bare-word method with the new carrier-v4 one) — the checkpoint's text
// hash also naturally invalidates old word-kind entries, since carrier
// words are hashed on the raw word text (no forced trailing period) while
// the old bare-word entries were hashed on `word + "."`. Sentence tasks
// keep the remote-skip: their method hasn't changed, so a sentence clip
// already in the Netlify `audio` blob store (per the last
// `npm run audio:audit-blobs` report) is skipped unless --force.
//
// Usage:
//   npm run audio:generate -- --level=1              # a whole level
//   npm run audio:generate -- --packs=t1-p001,t1-p002
//   npm run audio:generate -- --limit=20              # small default sample
//   npm run audio:generate -- --ids-file=audio-output/_reports/ids-1-4000.json
//   npm run audio:generate -- --all --force

import fs from 'fs'
import path from 'path'
import { loadConfig, createLimiter, PACK_DIR, AUDIO_OUT_DIR } from './lib/config.js'
import { SENTENCE_SETTINGS_EN, SENTENCE_SETTINGS_PL, CARRIER_SETTINGS, PL_VOICES, EN_VOICES } from './lib/voicePresets.js'
import { ttsPlain, ttsWithTimestamps } from './lib/elevenLabsClient.js'
import { postProcessClip, cutClipFromStart, trimTrailingSilence } from './lib/ffmpegPost.js'
import { CARRIER_TEMPLATES, extractWordStart } from './lib/carrierPhrase.js'
import { checkDuration } from './lib/validate.js'
import { Checkpoint, textHash } from './lib/checkpoint.js'
import { ClipTask, Pack } from './lib/types.js'

function main() {
  const config = loadConfig()
  console.log(`Config: concurrency=${config.concurrency} force=${config.force} dryRun=${config.dryRun}`)

  let missingRemote: Set<string> | null = null
  if (config.blobAuditPath && fs.existsSync(config.blobAuditPath)) {
    const report = JSON.parse(fs.readFileSync(config.blobAuditPath, 'utf-8')) as { missing: string[] }
    missingRemote = new Set(report.missing)
    console.log(`Loaded blob audit: ${missingRemote.size} clips missing remotely (others will be skipped unless --force).`)
  } else {
    console.log('No blob audit found — will not skip anything already remote. Run npm run audio:audit-blobs first to avoid re-paying for existing clips.')
  }

  const allFiles = fs.readdirSync(PACK_DIR).filter((f) => f.endsWith('.json'))
  let packFiles = allFiles
  if (config.packIds) packFiles = packFiles.filter((f) => config.packIds!.has(f.replace('.json', '')))
  if (config.level !== undefined) {
    packFiles = packFiles.filter((f) => {
      const p = JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf-8')) as Pack & { level: number }
      return p.level === config.level
    })
  }
  // Order by true Lp/browse position (packages-index.json), not filename —
  // pack id numbers don't track true order (e.g. "Kraje" is id t1-p678 but
  // sits at true position 84). This matters for --limit and any range like
  // "first 4000 words" to mean what it says.
  const indexOrder = new Map<string, number>(
    (JSON.parse(fs.readFileSync(path.join(PACK_DIR, '../packages-index.json'), 'utf-8')) as { id: string }[]).map((e, i) => [e.id, i])
  )
  packFiles.sort((a, b) => (indexOrder.get(a.replace('.json', '')) ?? 1e9) - (indexOrder.get(b.replace('.json', '')) ?? 1e9))
  if (Number.isFinite(config.limit)) {
    // limit by WORDS, not packs — trim the pack list down to roughly that many words
    let words = 0
    const limited: string[] = []
    for (const f of packFiles) {
      const p = JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf-8')) as Pack
      if (words >= config.limit) break
      limited.push(f)
      words += p.words.length
    }
    packFiles = limited
  }
  console.log(`Packs in scope: ${packFiles.length}`)

  const checkpoint = new Checkpoint(config.checkpointPath)
  const limit = createLimiter(config.concurrency)
  const tasks: ClipTask[] = []
  let wordIndex = 0

  const packsData: { file: string; pack: Pack }[] = packFiles.map((f) => ({ file: f, pack: JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf-8')) }))

  for (const { pack } of packsData) {
    for (const w of pack.words) {
      if (config.wordIds && !config.wordIds.has(w.id)) { wordIndex++; continue }
      const plVoice = PL_VOICES[wordIndex % PL_VOICES.length]
      const enVoice = EN_VOICES[wordIndex % EN_VOICES.length]
      wordIndex++

      // Raw word text (no forced period) — carrier templates add their own
      // punctuation, and extractWordStart needs an exact substring match
      // against the carrier phrase actually sent to the API.
      tasks.push({ kind: 'en-word', packId: pack.id, wordId: w.id, text: w.english, voiceId: enVoice.id, voiceName: enVoice.name, outFile: w.audioWord })
      tasks.push({ kind: 'pl-word', packId: pack.id, wordId: w.id, text: w.polishAudio ?? w.polish, voiceId: plVoice.id, voiceName: plVoice.name, outFile: w.audioWordPl ?? `${w.id}-word-pl.mp3` })
      if (w.sentenceEn) tasks.push({ kind: 'en-sentence', packId: pack.id, wordId: w.id, text: w.sentenceEn, voiceId: enVoice.id, voiceName: enVoice.name, outFile: w.audioSentence })
      if (w.sentencePl) tasks.push({ kind: 'pl-sentence', packId: pack.id, wordId: w.id, text: w.sentencePl, voiceId: plVoice.id, voiceName: plVoice.name, outFile: w.audioSentencePl ?? `${w.id}-sentence-pl.mp3` })
    }
  }

  // Word clips are always in scope: this run's whole point is to replace
  // every existing word clip (old bare-word method) with carrier v4, so
  // "already present remotely" must not skip them. Sentence clips keep the
  // remote-skip — their method is unchanged, no need to re-pay for them.
  let scoped = tasks
  if (missingRemote && !config.force) {
    scoped = tasks.filter((t) => t.kind === 'en-word' || t.kind === 'pl-word' || missingRemote!.has(`${t.packId}/${t.outFile}`))
  }
  console.log(`Total possible clips: ${tasks.length} | in scope after remote-skip filter: ${scoped.length}`)

  if (config.dryRun) {
    console.log('Dry run — not generating. Sample of scoped tasks:')
    scoped.slice(0, 10).forEach((t) => console.log(`  [${t.kind}] ${t.packId}/${t.outFile} (${t.voiceName}): "${t.text.slice(0, 40)}"`))
    return
  }

  let done = 0, generated = 0, skippedLocal = 0, failed = 0
  const sentenceOkThisRun = new Map<string, { en?: boolean; pl?: boolean }>()

  const settingsFor = (kind: ClipTask['kind']) => (kind === 'en-sentence' ? SENTENCE_SETTINGS_EN : SENTENCE_SETTINGS_PL)

  // Carrier v4 word generation: /with-timestamps inside a fixed carrier
  // phrase, cut from the word's precise alignment start to the clip's true
  // end, trim only genuine trailing silence. Caller (below) already
  // decided this needs (re)generating — unlike ttsPlain, this always
  // overwrites outPath rather than skipping on file-existence alone, since
  // outPath may hold a stale clip from the old bare-word method.
  async function generateCarrierWord(t: ClipTask, outPath: string): Promise<void> {
    const lang = t.kind === 'en-word' ? 'en' : 'pl'
    const carrierText = CARRIER_TEMPLATES[lang](t.text)
    const { buffer, alignment } = await ttsWithTimestamps(carrierText, t.voiceId, CARRIER_SETTINGS, `${t.kind} ${t.wordId}`)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    const rawPath = outPath + '.raw.mp3'
    const cutPath = outPath + '.cut.mp3'
    fs.writeFileSync(rawPath, buffer)
    try {
      const startSec = extractWordStart(carrierText, t.text, alignment)
      await cutClipFromStart(rawPath, cutPath, startSec)
      await trimTrailingSilence(cutPath, outPath)
      // Rare edge case found in production (~0.3% of words): for a
      // persistently quiet articulation, stop_periods=1 silenceremove can
      // misjudge nearly the whole clip as trailing silence and strip it to
      // a near-empty stream (which then makes ffmpeg's loudnorm/fade steps
      // below fail outright on an unplayable file). Guard against it by
      // comparing durations and falling back to the untrimmed cut — a
      // slightly longer tail beats a missing word.
      const cutSeconds = (await checkDuration(cutPath)).seconds
      const trimmedSeconds = (await checkDuration(outPath)).seconds
      if (trimmedSeconds < 0.15 || trimmedSeconds < cutSeconds * 0.3) {
        fs.copyFileSync(cutPath, outPath)
      }
      await postProcessClip(outPath, { trimSilence: false, fadeOutMs: 60 })
    } finally {
      for (const f of [rawPath, cutPath]) if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  }

  const run = async () => {
    await Promise.all(scoped.map((t) => limit(async () => {
      const hash = textHash(t.text)
      const outPath = path.join(AUDIO_OUT_DIR, t.packId, t.outFile)
      const isWord = t.kind === 'en-word' || t.kind === 'pl-word'
      try {
        if (checkpoint.has(t.wordId, t.kind, hash) && fs.existsSync(outPath)) {
          // Words hash on raw word text (no forced period) — a checkpoint
          // entry from the old bare-word run was hashed on `word + "."`,
          // so it naturally misses here and falls through to regeneration.
          // A word entry recorded by THIS carrier pipeline, on a resumed
          // run, correctly matches and skips — otherwise every resume
          // would re-pay quota for words already done.
          skippedLocal++
        } else if (isWord) {
          await generateCarrierWord(t, outPath)
          const { ok, seconds } = await checkDuration(outPath)
          if (!ok) throw new Error(`suspiciously short output (${seconds.toFixed(2)}s)`)
          generated++
          checkpoint.append({ wordId: t.wordId, kind: t.kind, outFile: t.outFile, textHash: hash, ok: true, ts: new Date().toISOString() })
        } else {
          const result = await ttsPlain(t.text, t.voiceId, settingsFor(t.kind), outPath, `${t.kind} ${t.wordId}`)
          if (result === 'generated') {
            // Sentences carried the OLD default (bidirectional silenceremove
            // at -40dB/0.08s) — the exact setting already proven to eat into
            // real trailing sound, not just dead air, which is why carrier-
            // phrase word generation moved off it (see cutClipFromStart /
            // trimTrailingSilence in ffmpegPost.ts). A full sentence from
            // context already has clean edges from the model — skip the
            // destructive trim, keep only the gentle fades.
            await postProcessClip(outPath, { trimSilence: false, fadeOutMs: 60 })
            const { ok, seconds } = await checkDuration(outPath)
            if (!ok) throw new Error(`suspiciously short output (${seconds.toFixed(2)}s)`)
            generated++
          } else {
            skippedLocal++
          }
          checkpoint.append({ wordId: t.wordId, kind: t.kind, outFile: t.outFile, textHash: hash, ok: true, ts: new Date().toISOString() })
        }
        if (t.kind === 'en-sentence' || t.kind === 'pl-sentence') {
          const rec = sentenceOkThisRun.get(t.wordId) ?? {}
          if (t.kind === 'en-sentence') rec.en = true; else rec.pl = true
          sentenceOkThisRun.set(t.wordId, rec)
        }
      } catch (e) {
        failed++
        console.error(`\nFailed [${t.kind}] ${t.wordId}: ${(e as Error).message}`)
      } finally {
        done++
        process.stdout.write(`\r[${done}/${scoped.length}] generated=${generated} skipped=${skippedLocal} failed=${failed}`)
      }
    })))
  }

  run().then(() => {
    console.log(`\n\nDone. Generated: ${generated}, skipped (already up to date): ${skippedLocal}, failed: ${failed}`)

    // Write back audioWordPl/audioSentencePl filenames + sentenceAudio flag, scoped to touched packs only.
    let flaggedTrue = 0
    for (const { file, pack } of packsData) {
      let changed = false
      for (const w of pack.words as (typeof pack.words[number] & { sentenceAudio?: boolean })[]) {
        if (!w.audioWordPl) { w.audioWordPl = `${w.id}-word-pl.mp3`; changed = true }
        if (w.sentencePl && !w.audioSentencePl) { w.audioSentencePl = `${w.id}-sentence-pl.mp3`; changed = true }
        const needsEn = !!w.sentenceEn, needsPl = !!w.sentencePl
        const rec = sentenceOkThisRun.get(w.id)
        const enOk = !needsEn || rec?.en
        const plOk = !needsPl || rec?.pl
        const shouldBeTrue = (needsEn || needsPl) && enOk && plOk
        if (shouldBeTrue && !w.sentenceAudio) { w.sentenceAudio = true; changed = true; flaggedTrue++ }
      }
      if (changed) fs.writeFileSync(path.join(PACK_DIR, file), JSON.stringify(pack, null, 2) + '\n')
    }
    console.log(`sentenceAudio newly set true: ${flaggedTrue}`)
    console.log('Next: npm run upload-audio-blobs, then npm run upload-pack-blobs (pack files changed too).')
  })
}

main()
