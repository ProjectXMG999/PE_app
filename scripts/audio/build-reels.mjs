// Concatenates round-3's 200 individual clips into 6 "reel" files
// (3 categories x {baseline, carrier}), each word separated by ~500ms of
// silence, and records each word's start/end time within the reel — so the
// listening page can offer 100 individual seek buttons while only needing
// 6 uploaded audio assets instead of 200.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import mp3Duration from 'mp3-duration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const DIR = path.join(ROOT, 'audio-output/_ab-sample-r3')
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf-8'))

const GAP_SEC = 0.5

function duration(file) {
  return new Promise((resolve, reject) => {
    mp3Duration(file, (err, sec) => (err ? reject(err) : resolve(sec)))
  })
}

function concatSilence(files, outPath) {
  // Build a silence-padded concat list via the concat demuxer with a generated
  // silent spacer track reused between each clip.
  return new Promise(async (resolve, reject) => {
    const listPath = outPath + '.txt'
    const silencePath = path.join(DIR, '_silence.mp3')
    if (!fs.existsSync(silencePath)) {
      await new Promise((res, rej) => {
        ffmpeg().input('anullsrc=r=44100:cl=mono').inputFormat('lavfi').duration(GAP_SEC).output(silencePath).on('end', res).on('error', rej).run()
      })
    }
    const lines = []
    files.forEach((f, i) => {
      lines.push(`file '${f}'`)
      if (i < files.length - 1) lines.push(`file '${silencePath}'`)
    })
    fs.writeFileSync(listPath, lines.join('\n'))
    ffmpeg().input(listPath).inputOptions(['-f concat', '-safe 0']).outputOptions(['-c copy']).output(outPath)
      .on('end', () => { fs.unlinkSync(listPath); resolve() })
      .on('error', reject)
      .run()
  })
}

async function buildReel(category, variantKey, fileKey) {
  const items = manifest.filter((m) => m.category === category && m[fileKey])
  const files = items.map((m) => path.join(DIR, m[fileKey]))
  const outPath = path.join(DIR, `reel__${category}__${variantKey}.mp3`)
  await concatSilence(files, outPath)

  const timestamps = []
  let t = 0
  for (const m of items) {
    const d = await duration(path.join(DIR, m[fileKey]))
    timestamps.push({ id: m.id, wordId: m.wordId, lang: m.lang, text: m.text, voice: m.voice, start: t, end: t + d })
    t += d + GAP_SEC
  }
  return { outPath, timestamps, totalDuration: t }
}

async function main() {
  const categories = ['short', 'skroty', 'slang']
  const out = {}
  for (const cat of categories) {
    for (const [variantKey, fileKey] of [['baseline', 'baselineFile'], ['carrier', 'carrierFile']]) {
      console.log(`Building reel ${cat}/${variantKey}...`)
      const { outPath, timestamps, totalDuration } = await buildReel(cat, variantKey, fileKey)
      out[`${cat}_${variantKey}`] = { file: path.basename(outPath), timestamps, totalDuration }
      console.log(`  -> ${path.basename(outPath)} (${timestamps.length} words, ${totalDuration.toFixed(1)}s)`)
    }
  }
  fs.writeFileSync(path.join(DIR, 'reels.json'), JSON.stringify(out, null, 2))
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
