import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'
import { awaitAudioUnlock, getAudioContext } from '../audio/audioUnlock'

const EN_BASE = 0.70
const PL_BASE = 1.0

// enRate/plRate are multipliers: 1.0 = default speed, 0.5 = half, 1.5 = faster
export function useAudio(packId: string | null, enRate = 1.0, plRate = 1.0) {
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  // Web Audio API playback — no HTMLAudioElement gesture requirement on iOS Safari
  // ctx.state=running (from unlockAudioGlobally gesture) is sufficient for all plays
  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise(async (resolve) => {
      const filename = url.split('file=')[1] || url.split('/').pop() || 'unknown'

      // Ensure AudioContext is running before attempting playback
      await awaitAudioUnlock()

      const ctx = getAudioContext()
      if (!ctx) {
        console.error('[audio] no AudioContext — audio unlock not called')
        resolve('error')
        return
      }

      console.log('[audio] play() filename=', filename, 'rate=', rate)

      let resolved = false
      let currentSource: AudioBufferSourceNode | null = null

      const done = (result: 'ok' | 'timeout' | 'error' = 'ok') => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        try { currentSource?.stop() } catch {}
        currentSource = null
        resolve(result)
      }

      resolveCurrentRef.current = () => done('ok')
      const timeoutId = setTimeout(() => done('timeout'), 10000)

      try {
        // Fetch audio (HTTP cache warmed by preloadNext)
        const response = await fetch(url, { mode: 'same-origin' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()

        if (resolved) return

        // Decode compressed audio to raw PCM buffer
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

        if (resolved) return

        // Create one-shot source node — no gesture required, only ctx.state=running
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.playbackRate.value = rate
        source.connect(ctx.destination)
        currentSource = source

        source.onended = () => {
          console.log('[audio] onended', filename)
          done('ok')
        }

        console.log('[audio] Web Audio start filename=', filename, 'rate=', rate, 'ctx.state=', ctx.state)
        source.start(0)

      } catch (e: any) {
        console.error('[audio] play() error:', e.name, e.message, 'filename:', filename)
        done('error')
      }
    })
  }, [])

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
