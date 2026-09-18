import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import mp3Duration from 'mp3-duration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const DIR = path.join(ROOT, 'audio-output/_ab-sample-r5')
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf-8')).filter(m => m.baselineFile && m.carrierFile)

const GAP_SEC = 0.5 // requested from anullsrc — NOT what ends up in the file, see below

function duration(file) {
  return new Promise((resolve, reject) => { mp3Duration(file, (err, sec) => (err ? reject(err) : resolve(sec))) })
}

// ffmpeg's own reported duration — ground truth, unlike mp3-duration (see
// note below), used only for the final reel's total length.
function realDuration(file) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    ffmpeg(file).on('stderr', (l) => { stderr += l + '\n' }).on('error', (e) => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
      if (m) resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]))
      else reject(e)
    }).output('-').format('null').run()
  })
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

// BUG FIX (round 5 feedback: "coraz bardziej ucięte" — words later in the
// list increasingly clipped). Root cause, found by cross-checking against
// ffmpeg's own duration reports: the `mp3-duration` npm package (used
// everywhere in this pipeline to measure clip lengths) over-counts every
// file by ~25ms — almost exactly each file's LAME encoder priming delay
// (ffmpeg reports it as `start: 0.025`, i.e. pre-roll to skip, but
// mp3-duration counts it as audio). Summing ~57 such measurements
// (29 words + 28 gaps) compounds that into roughly a second of drift by
// the end of the list, which is exactly the "increasingly clipped" pattern.
// Arithmetic prediction is fundamentally unreliable here regardless of
// which value is fed into it — so timestamps are now measured EMPIRICALLY
// from the actual built file via silence detection, not predicted by
// summing individual clip durations at all.
const SILENCE_NOISE_DB = '-40dB'
const SILENCE_MIN_DURATION = 0.3 // our inserted gap is >=0.5s; no real word's own internal pause should sustain this long
const MERGE_GAP_THRESHOLD = 0.2 // merge two detected silence periods this close together (handles a word's own brief internal dip being picked up as a spurious extra period)

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
        // merge near-adjacent periods (a word's own brief internal dip mistaken for a second gap)
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

async function buildReel(fileKey, tag) {
  const files = manifest.map((m) => path.join(DIR, m[fileKey]))
  const outPath = path.join(DIR, `reel__pl__${tag}.mp3`)
  await concatSilence(files, outPath)

  const totalDuration = await realDuration(outPath)
  const gaps = await detectSilencePeriods(outPath)
  const expectedGaps = manifest.length - 1
  if (gaps.length !== expectedGaps) {
    console.warn(`  ⚠ ${tag}: detected ${gaps.length} silence gaps, expected ${expectedGaps} — falling back to arithmetic timestamps for this reel (less accurate, verify by ear).`)
    let t = 0
    const timestamps = []
    for (const m of manifest) {
      const d = await duration(path.join(DIR, m[fileKey]))
      timestamps.push({ id: m.id, text: m.text, voice: m.voice, start: t, end: t + d })
      t += d + GAP_SEC
    }
    return { outPath, timestamps, totalDuration: t }
  }

  const timestamps = manifest.map((m, i) => ({
    id: m.id,
    text: m.text,
    voice: m.voice,
    start: i === 0 ? 0 : gaps[i - 1].end,
    end: i === manifest.length - 1 ? totalDuration : gaps[i].start,
  }))
  return { outPath, timestamps, totalDuration }
}

async function main() {
  const out = {}
  for (const [tag, fileKey] of [['baseline', 'baselineFile'], ['carrier', 'carrierFile']]) {
    console.log(`Building reel pl/${tag}...`)
    const { outPath, timestamps, totalDuration } = await buildReel(fileKey, tag)
    out[tag] = { file: path.basename(outPath), timestamps, totalDuration }
    console.log(`  -> ${path.basename(outPath)} (${timestamps.length} words, ${totalDuration.toFixed(1)}s)`)
  }
  fs.writeFileSync(path.join(DIR, 'reels.json'), JSON.stringify(out, null, 2))
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
