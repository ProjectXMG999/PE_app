import mp3Duration from 'mp3-duration'

/** A valid clip should run at least ~150ms even for the shortest word ("Be").
 * Below that it's almost certainly an empty/corrupt generation. */
const MIN_SECONDS = 0.15

export function checkDuration(filePath: string): Promise<{ ok: boolean; seconds: number }> {
  return new Promise((resolve) => {
    mp3Duration(filePath, (err: Error | null, seconds: number) => {
      if (err || !seconds) return resolve({ ok: false, seconds: 0 })
      resolve({ ok: seconds >= MIN_SECONDS, seconds })
    })
  })
}
