// Isolation test reels: baseline (as-is) vs baseline+post-processing only
// (no stability/speed change), for all 28 round-1/round-2 words, to see
// whether the ffmpeg chain itself is what makes clips sound worse than
// plain baseline.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import mp3Duration from 'mp3-duration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const DIR = path.join(ROOT, 'audio-output/_ab-sample')
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

// Pull id/text/voice/lang from the two ab-sample scripts' known word lists.
const WORDS = [
  { id: 'be', lang: 'en', text: 'Be', voice: 'Adam (US)' },
  { id: 'can', lang: 'en', text: 'Can', voice: 'Samantha (US)' },
  { id: 'have-to', lang: 'en', text: 'Have to', voice: 'William (UK)' },
  { id: 'hairdresser', lang: 'en', text: 'Hairdresser', voice: 'Tamsin (UK)' },
  { id: 'cook', lang: 'en', text: 'Cook', voice: 'Adam (US)' },
  { id: 'city', lang: 'en', text: 'City', voice: 'Samantha (US)' },
  { id: 'byc', lang: 'pl', text: 'Być', voice: 'Piotr' },
  { id: 'moc', lang: 'pl', text: 'Móc', voice: 'Magdalena' },
  { id: 'musisz', lang: 'pl', text: 'Musisz', voice: 'Pawel' },
  { id: 'fryzjer', lang: 'pl', text: 'Fryzjer', voice: 'Violetta' },
  { id: 'kucharz', lang: 'pl', text: 'Kucharz', voice: 'Piotr' },
  { id: 'miasto', lang: 'pl', text: 'Miasto', voice: 'Magdalena' },
  { id: 't1p860001', lang: 'pl', text: 'Umyślnie', voice: 'Piotr', suffix: '-r2' },
  { id: 't1p363009', lang: 'pl', text: 'Obcy', voice: 'Magdalena', suffix: '-r2' },
  { id: 't1p435012', lang: 'en', text: 'Misunderstanding', voice: 'William (UK)', suffix: '-r2' },
  { id: 't1p552013', lang: 'pl', text: 'Zmaganie się z czymś', voice: 'Violetta', suffix: '-r2' },
  { id: 't1p503013', lang: 'pl', text: 'Dokładnie', voice: 'Piotr', suffix: '-r2' },
  { id: 't1p776007', lang: 'en', text: 'Cut sb out', voice: 'Samantha (US)', suffix: '-r2' },
  { id: 't1p115008', lang: 'en', text: 'Skillful', voice: 'William (UK)', suffix: '-r2' },
  { id: 't1p746010', lang: 'en', text: 'Puzzled', voice: 'Tamsin (UK)', suffix: '-r2' },
  { id: 't1p669004', lang: 'pl', text: 'Cofać się', voice: 'Piotr', suffix: '-r2' },
  { id: 't1p124007', lang: 'en', text: 'Dawg', voice: 'Samantha (US)', suffix: '-r2' },
  { id: 't1p545008', lang: 'pl', text: 'Łaknienie', voice: 'Pawel', suffix: '-r2' },
  { id: 't1p543001', lang: 'pl', text: 'Kawaler', voice: 'Violetta', suffix: '-r2' },
  { id: 't1p352003', lang: 'en', text: 'Aftermath', voice: 'Adam (US)', suffix: '-r2' },
  { id: 't1p252014', lang: 'en', text: 'Maid', voice: 'Samantha (US)', suffix: '-r2' },
  { id: 't1p383007', lang: 'en', text: 'Let out', voice: 'William (UK)', suffix: '-r2' },
  { id: 't1p243007', lang: 'en', text: 'Park', voice: 'Tamsin (UK)', suffix: '-r2' },
]

async function buildReel(variant) {
  const files = WORDS.map((w) => path.join(DIR, `${w.id}__baseline${w.suffix || ''}${variant === 'postproc' ? '-postproc' : ''}.mp3`))
  for (const f of files) if (!fs.existsSync(f)) throw new Error(`missing ${f}`)
  const outPath = path.join(DIR, `reel__isolation__${variant}.mp3`)
  await concatSilence(files, outPath)
  const timestamps = []
  let t = 0
  for (let i = 0; i < WORDS.length; i++) {
    const d = await duration(files[i])
    timestamps.push({ ...WORDS[i], start: t, end: t + d })
    t += d + GAP_SEC
  }
  return { file: path.basename(outPath), timestamps, totalDuration: t }
}

async function main() {
  const out = {}
  out.baseline = await buildReel('baseline')
  console.log('baseline reel:', out.baseline.file, out.baseline.totalDuration.toFixed(1) + 's')
  out.postproc = await buildReel('postproc')
  console.log('postproc reel:', out.postproc.file, out.postproc.totalDuration.toFixed(1) + 's')
  fs.writeFileSync(path.join(DIR, 'isolation-reels.json'), JSON.stringify(out, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
