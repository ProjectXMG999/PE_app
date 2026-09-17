// Post-processing chain per docs/voicelab.md Etap 1: trim leading/trailing
// silence the model tends to add on isolated words, normalize loudness
// across 8 voices/thousands of clips (2-pass EBU R128), and a short fade to
// avoid clicks. No system ffmpeg is installed on this machine, so we use
// ffmpeg-static's bundled binary via fluent-ffmpeg.
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import mp3Duration from 'mp3-duration'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

const FADE_MS = 20
const SILENCE_THRESHOLD_DB = '-40dB'
const SILENCE_MIN_DURATION = 0.08 // seconds; avoid clipping soft plosive onsets

/** In-place post-process: trim silence, 2-pass loudness normalize, fade in/out. */
export async function postProcessClip(filePath: string): Promise<void> {
  const tmp1 = filePath + '.trim.mp3'
  const tmp2 = filePath + '.norm.mp3'
  try {
    await run(filePath, tmp1, (c) => {
      c.audioFilters([
        `silenceremove=start_periods=1:start_duration=${SILENCE_MIN_DURATION}:start_threshold=${SILENCE_THRESHOLD_DB}:detection=peak`,
        `areverse`,
        `silenceremove=start_periods=1:start_duration=${SILENCE_MIN_DURATION}:start_threshold=${SILENCE_THRESHOLD_DB}:detection=peak`,
        `areverse`,
      ])
    })
    // Measure loudness (pass 1), then apply corrected normalization (pass 2) — single-pass
    // loudnorm "pumps" volume and isn't safe for offline batch files. Falls back to
    // single-pass loudnorm if the measured values are unusable (e.g. a very short/
    // near-silent clip measuring at -inf LUFS, which loudnorm's 2-pass mode rejects).
    try {
      const measured = await measureLoudness(tmp1)
      if (!Number.isFinite(Number(measured.input_i)) || !Number.isFinite(Number(measured.input_tp))) throw new Error('non-finite measured loudness')
      await run(tmp1, tmp2, (c) => {
        c.audioFilters([
          `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`,
        ])
      })
    } catch {
      await run(tmp1, tmp2, (c) => { c.audioFilters(['loudnorm=I=-16:TP=-1.5:LRA=11']) })
    }
    const durationSec = await getDuration(tmp2)
    const fadeOutStart = Math.max(0, durationSec - FADE_MS / 1000)
    await run(tmp2, filePath, (c) => {
      c.audioFilters([`afade=t=in:d=${FADE_MS / 1000}`, `afade=t=out:st=${fadeOutStart}:d=${FADE_MS / 1000}`])
    })
  } finally {
    for (const t of [tmp1, tmp2]) if (fs.existsSync(t)) fs.unlinkSync(t)
  }
}

function run(input: string, output: string, configure: (c: ffmpeg.FfmpegCommand) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input).output(output)
    configure(cmd)
    cmd.on('end', () => resolve()).on('error', reject).run()
  })
}

// No ffprobe-static installed (ffmpeg-static bundles only ffmpeg, not
// ffprobe) — mp3-duration reads MP3 frame headers directly, no binary needed.
function getDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    mp3Duration(file, (err: Error | null, seconds: number) => {
      if (err) return reject(err)
      resolve(seconds ?? 0)
    })
  })
}

interface LoudnormMeasurement { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string }

function measureLoudness(file: string): Promise<LoudnormMeasurement> {
  return new Promise((resolve, reject) => {
    let stderr = ''
    ffmpeg(file)
      .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json')
      .format('null')
      .output('-')
      .on('stderr', (line) => { stderr += line + '\n' })
      .on('end', () => {
        const match = stderr.match(/\{[\s\S]*?\}/)
        if (!match) return reject(new Error('loudnorm measurement: no JSON in ffmpeg output'))
        try { resolve(JSON.parse(match[0])) } catch (e) { reject(e) }
      })
      .on('error', reject)
      .run()
  })
}
