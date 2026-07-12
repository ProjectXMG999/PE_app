import { useCallback, useRef } from 'react'
import { getAudioUrl, preloadAudio } from '../services/audioService'
import { Word } from '../types/vocabulary'
import { getAudioContext, awaitAudioUnlock } from '../audio/audioUnlock'

const EN_BASE = 0.70
const PL_BASE = 1.0

// enRate/plRate are multipliers: 1.0 = default speed, 0.5 = half, 1.5 = faster
export function useAudio(packId: string | null, enRate = 1.0, plRate = 1.0) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  // Resolver for the currently pending play() promise — lets stop() unblock awaits
  const resolveCurrentRef = useRef<(() => void) | null>(null)

  const play = useCallback((url: string, rate = 1.0): Promise<'ok' | 'timeout' | 'error'> => {
    return new Promise((resolve) => {
      const ctx = getAudioContext()
      const filename = url.split('file=')[1] || url.split('/').pop() || 'unknown'
      const useWebAudio = ctx && ctx.state === 'running'

      console.log('[audio] play() path=', useWebAudio ? 'webAudio' : 'htmlAudio', 'ctx=', ctx?.state ?? 'null', 'filename=', filename)

      // Stop previous audio — kills both HTML and WebAudio
      if (audioRef.current) {
        const prev = audioRef.current
        audioRef.current = null
        console.log('[audio] play() killing prev htmlAudio, paused=', prev.paused)
        prev.pause()
        prev.currentTime = 0
        prev.src = ''
        prev.load()
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.stop()
          sourceRef.current.disconnect()
        } catch {}
        sourceRef.current = null
      }

      let resolved = false
      let useWebAudioActual = useWebAudio
      const done = (result: 'ok' | 'timeout' | 'error' = 'ok') => {
        if (resolved) return
        resolved = true
        clearTimeout(timeoutId)
        resolveCurrentRef.current = null
        if (audioRef.current && useWebAudioActual) audioRef.current = null
        if (sourceRef.current && useWebAudioActual) sourceRef.current = null
        resolve(result)
      }

      resolveCurrentRef.current = () => done('ok')
      const timeoutId = setTimeout(() => done('timeout'), 10000)

      if (useWebAudio && ctx) {
        // WebAudio path: fetch → decode → BufferSourceNode
        awaitAudioUnlock().then(() => {
          if (resolved) return
          fetch(url)
            .then(r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              return r.arrayBuffer()
            })
            .then(ab => {
              if (resolved) return
              console.log('[audio] fetch done, decoding arrayBuffer size=', ab.byteLength)
              return ctx.decodeAudioData(ab)
            })
            .then(decoded => {
              if (resolved || !decoded) return
              console.log('[audio] decodeAudioData done, duration=', decoded.duration.toFixed(2))
              const source = ctx.createBufferSource()
              source.buffer = decoded
              source.playbackRate.value = rate

              // Create gain node (required on some iOS Safari versions)
              const gain = ctx.createGain()
              gain.gain.value = 1.0
              source.connect(gain)
              gain.connect(ctx.destination)

              sourceRef.current = source
              let ended = false
              source.onended = () => {
                if (ended) return
                ended = true
                console.log('[audio] source.onended fired, duration=', decoded.duration.toFixed(2))
                done('ok')
              }
              console.log('[audio] source.start() rate=', rate, 'ctx.currentTime=', ctx.currentTime.toFixed(2))
              try {
                source.start()
                console.log('[audio] source.start() succeeded, ctx.currentTime=', ctx.currentTime.toFixed(2))
                // Fallback: if onended doesn't fire in reasonable time, complete anyway
                const fallbackTimer = setTimeout(() => {
                  if (!ended && !resolved) {
                    console.log('[audio] source onended timeout — assuming done')
                    ended = true
                    done('ok')
                  }
                }, decoded.duration * 1000 + 1000)
                source.onended = () => {
                  clearTimeout(fallbackTimer)
                  if (ended) return
                  ended = true
                  console.log('[audio] source.onended fired')
                  done('ok')
                }
              } catch (e) {
                console.error('[audio] source.start() threw:', e)
                done('error')
              }
            })
            .catch(e => {
              if (resolved) return
              console.error('[audio] WebAudio error:', e.name, e.message, 'url:', filename)
              console.error('[audio] WebAudio stack:', new Error().stack)
              done('error')
            })
        })
      } else {
        // HTMLAudioElement fallback path
        const audio = new Audio()
        audio.preload = 'auto'
        audioRef.current = audio

        let playStarted = false
        const tryPlay = (evt?: string) => {
          console.log('[audio] tryPlay via', evt, 'rs=', audio.readyState, 'started=', playStarted, 'filename=', filename)
          if (playStarted) return
          if (audioRef.current !== audio) return
          playStarted = true
          audio.oncanplaythrough = null
          audio.onloadedmetadata = null
          audio.onloadeddata = null
          console.log('[audio] calling play() from', evt)
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

        audio.onended = () => done('ok')
        audio.onerror = () => {
          console.error('[audio] onerror', audio.error?.code, audio.error?.message, 'filename:', filename)
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

        audio.src = url
        audio.load()
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
    console.log('[audio] stop() called, resolveRef=', !!resolveCurrentRef.current, 'audioRef=', !!audioRef.current, 'sourceRef=', !!sourceRef.current)
    if (resolveCurrentRef.current) {
      resolveCurrentRef.current()
      resolveCurrentRef.current = null
    }
    if (audioRef.current) {
      const el = audioRef.current
      audioRef.current = null
      console.log('[audio] stop() killing htmlAudio, paused=', el.paused)
      el.pause()
      el.currentTime = 0
      el.src = ''
      el.load()
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
        sourceRef.current.disconnect()
      } catch {}
      sourceRef.current = null
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
