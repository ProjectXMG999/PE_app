import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'
import { awaitAudioUnlock, getAudioContext } from '../audio/audioUnlock'

const EN_BASE = 0.70
const PL_BASE = 1.0

// enRate/plRate are multipliers: 1.0 = default speed, 0.5 = half, 1.5 = faster
export function useAudio(packId: string | null, enRate = 1.0, plRate = 1.0) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  // Create fresh audio element for each play
  const createAudioElement = useCallback(() => {
    if (typeof document === 'undefined') return null
    const el = document.createElement('audio')
    el.crossOrigin = 'anonymous'
    el.style.display = 'none'
    // Don't append to DOM — keep it in memory only
    console.log('[audio] createAudioElement() fresh element')
    return el
  }, [])

  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise(async (resolve) => {
      const filename = url.split('file=')[1] || url.split('/').pop() || 'unknown'

      // Wait for AudioContext to be running (handles iOS suspend between packs)
      await awaitAudioUnlock()

      const audio = createAudioElement()
      if (!audio) {
        console.error('[audio] createAudioElement failed')
        resolve('error')
        return
      }

      console.log('[audio] play() filename=', filename, 'rate=', rate, 'url=', url)

      let resolved = false
      const done = (result: 'ok' | 'timeout' | 'error' = 'ok') => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        // Detach ALL handlers FIRST — iOS Safari fires onerror (code=4) when src is cleared,
        // which interrupts AVAudioSession → NotAllowedError on the next audio.play()
        audio.onended = null
        audio.onerror = null
        audio.oncanplaythrough = null
        audio.onloadedmetadata = null
        audio.onloadeddata = null
        try {
          audio.pause()
          audio.removeAttribute('src')
        } catch {}
        resolve(result)
      }

      resolveCurrentRef.current = () => done('ok')
      const timeoutId = setTimeout(() => done('timeout'), 10000)

      let playStarted = false
      const tryPlay = async (evt?: string) => {
        console.log('[audio] tryPlay via', evt, 'rs=', audio.readyState, 'started=', playStarted, 'filename=', filename)
        if (playStarted) return
        playStarted = true
        audio.oncanplaythrough = null
        audio.onloadedmetadata = null
        audio.onloadeddata = null

        // Resume AudioContext immediately before play() — iOS Safari suspends ctx
        // during the async gap (network fetch + decode), so we must re-check here
        const audioCtx = getAudioContext()
        if (audioCtx && audioCtx.state !== 'running') {
          console.log('[audio] ctx suspended before play, resuming, state=', audioCtx.state)
          await audioCtx.resume().catch(() => {})
          console.log('[audio] ctx resumed, state=', audioCtx.state)
        }

        console.log('[audio] calling play() from', evt, 'ctx.state=', audioCtx?.state)
        audio.play()
          .then(() => {
            console.log('[audio] play() SUCCEEDED from', evt)
          })
          .catch(e => {
            console.error('[audio] play() rejected from', evt, '— error:', e.name, e.message, 'filename:', filename)
            console.error('[audio] play() stack:', new Error().stack)
            done('error')
          })
      }

      audio.onended = () => {
        console.log('[audio] onended')
        done('ok')
      }
      audio.onerror = () => {
        console.error('[audio] onerror code=', audio.error?.code, 'message=', audio.error?.message, 'networkState=', audio.networkState, 'readyState=', audio.readyState, 'filename=', filename, 'src=', audio.src)
        done('error')
      }
      audio.oncanplaythrough = () => tryPlay('canplaythrough')
      audio.onloadedmetadata = () => {
        audio.playbackRate = rate
        tryPlay('loadedmetadata')
      }
      audio.onloadeddata = () => {
        console.log('[audio] loadeddata rs=', audio.readyState, 'filename=', filename)
        if (audio.readyState >= 2) tryPlay('loadeddata')
      }

      console.log('[audio] setting src =', url, 'audio.src before=', audio.src)
      audio.src = url
      console.log('[audio] audio.src after=', audio.src)
      // Setting src on a fresh element automatically triggers load algorithm — no need to call load() explicitly
    })
  }, [createAudioElement])

  const playWord = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWord), EN_BASE * enRate)
  }, [packId, play, enRate])

  const playSentence = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId) return Promise.resolve('ok' as const)
    // EN sentence files are generated at 0.75 speed in ElevenLabs — play at 1.0 so
    // the waveform's own tempo is the only slowdown applied.
    return play(getAudioUrl(packId, word.audioSentence), enRate)
  }, [packId, play, enRate])

  const playWordPl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioWordPl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioWordPl), PL_BASE * plRate)
  }, [packId, play, plRate])

  const playSentencePl = useCallback((word: Word): Promise<'ok' | 'timeout' | 'error'> => {
    if (!packId || !word.audioSentencePl) return Promise.resolve('ok' as const)
    return play(getAudioUrl(packId, word.audioSentencePl), PL_BASE * plRate)
  }, [packId, play, plRate])

  const stop = useCallback(() => {
    console.log('[audio] stop() called')
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    // Note: we don't reuse audio elements anymore, so nothing to cleanup here
  }, [])

  const preloadNext = useCallback((words: Word[], currentIndex: number) => {
    if (!packId) return
    const toPreload = [currentIndex + 1, currentIndex + 2]
    const schedule = 'requestIdleCallback' in window
      ? (fn: () => void) => requestIdleCallback(fn)
      : (fn: () => void) => setTimeout(fn, 100)
    schedule(() => {
      toPreload.forEach(i => {
        if (i < words.length) {
          const w = words[i]
          preloadAudio(getAudioUrl(packId, w.audioWord))
          preloadAudio(getAudioUrl(packId, w.audioSentence))
          if (w.audioWordPl) preloadAudio(getAudioUrl(packId, w.audioWordPl))
          if (w.audioSentencePl) preloadAudio(getAudioUrl(packId, w.audioSentencePl))
        }
      })
    })
  }, [packId])

  return { playWord, playSentence, playWordPl, playSentencePl, stop, preloadNext }
}
