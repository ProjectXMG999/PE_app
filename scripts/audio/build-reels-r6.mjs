// Round 6 reels: English, grouped by voice (4 voices x {baseline, carrier}
// = 8 reels of 25 words each). Uses the silencedetect-based measurement
// fixed for round 5 (see build-reels-r5.mjs's comments for the full
// diagnosis) — no arithmetic summing of individual clip durations.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import mp3Duration from 'mp3-duration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const DIR = path.join(ROOT, 'audio-output/_ab-sample-r6')
const fullManifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf-8')).filter(m => m.baselineFile && m.carrierFile)
const VOICES = [...new Set(fullManifest.map((m) => m.voice))]

const GAP_SEC = 0.5

function duration(file) {
  return new Promise((resolve, reject) => { mp3Duration(file, (err, sec) => (err ? reject(err) : resolve(sec))) })
}

async function concatSilence(files, outPath) {
  const listPath = outPath + '.txt'
  const silencePath = path.join(DIR, '_silence.mp3')
  if (!fs.existsSync(silencePath)) {
    await new Promise((res, rej) => {
      ffmpeg().input('anullsrc=r=44100:cl=mono').inputFormat('lavfi').duration(GAP_SEC).output(silencePath).on('end', res).on('error', rej).run()
    })
  }
  const lines = []
  files.forEach((f, i) => { lines.push(`file '${f}'`); if (i < files.length - 1) lines.push(`file '${silencePath}'`) })
  fs.writeFileSync(listPath, lines.join('\n'))
  await new Promise((resolve, reject) => {
    ffmpeg().input(listPath).inputOptions(['-f concat', '-safe 0']).outputOptions(['-c copy']).output(outPath)
      .on('end', () => { fs.unlinkSync(listPath); resolve() }).on('error', reject).run()
  })
}

const SILENCE_NOISE_DB = '-40dB'
const SILENCE_MIN_DURATION = 0.3
const MERGE_GAP_THRESHOLD = 0.2

function detectSilencePeriods(file) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    ffmpeg(file)
      .audioFilters(`silencedetect=noise=${SILENCE_NOISE_DB}:d=${SILENCE_MIN_DURATION}`)
      .format('null')
      .output('-')
      .on('stderr', (line) => { stderr += line + '\n' })
      .on('end', () => {
        const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]))
        const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]))
        const periods = starts.map((s, i) => ({ start: s, end: ends[i] })).filter((p) => p.end !== undefined)
        const merged = []
        for (const p of periods) {
          const prev = merged[merged.length - 1]
          if (prev && p.start - prev.end < MERGE_GAP_THRESHOLD) prev.end = p.end
          else merged.push({ ...p })
        }
        resolve(merged)
      })
      .on('error', reject)
      .run()
  })
}

async function buildReel(manifest, fileKey, outPath) {
  const files = manifest.map((m) => path.join(DIR, m[fileKey]))
  await concatSilence(files, outPath)

  // A single mp3-duration call per reel has only its usual ~25ms error —
  // negligible now that per-word positions come from silencedetect, not
  // from summing many such measurements (that's what compounded in round 5).
  const totalDuration = await duration(outPath)
  const gaps = await detectSilencePeriods(outPath)
  const expectedGaps = manifest.length - 1
  if (gaps.length !== expectedGaps) {
    console.warn(`  ⚠ detected ${gaps.length} silence gaps, expected ${expectedGaps} — falling back to arithmetic timestamps (less accurate, verify by ear).`)
    let t = 0
    const timestamps = []
    for (const m of manifest) {
      const d = await duration(path.join(DIR, m[fileKey]))
      timestamps.push({ id: m.id, text: m.text, start: t, end: t + d })
      t += d + GAP_SEC
    }
    return { timestamps, totalDuration: t }
  }

  const timestamps = manifest.map((m, i) => ({
    id: m.id,
    text: m.text,
    start: i === 0 ? 0 : gaps[i - 1].end,
    end: i === manifest.length - 1 ? totalDuration : gaps[i].start,
  }))
  return { timestamps, totalDuration }
}

async function main() {
  const out = {}
  for (const voice of VOICES) {
    const voiceManifest = fullManifest.filter((m) => m.voice === voice)
    const slug = voice.replace(/[^a-zA-Z]/g, '').toLowerCase()
    for (const [tag, fileKey] of [['baseline', 'baselineFile'], ['carrier', 'carrierFile']]) {
      console.log(`Building reel ${voice}/${tag} (${voiceManifest.length} words)...`)
      const outPath = path.join(DIR, `reel__${slug}__${tag}.mp3`)
      const { timestamps, totalDuration } = await buildReel(voiceManifest, fileKey, outPath)
      out[`${slug}_${tag}`] = { voice, file: path.basename(outPath), timestamps, totalDuration }
      console.log(`  -> ${path.basename(outPath)} (${timestamps.length} words, ${totalDuration.toFixed(1)}s)`)
    }
  }
  fs.writeFileSync(path.join(DIR, 'reels.json'), JSON.stringify(out, null, 2))
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
