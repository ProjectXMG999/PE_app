import { useEffect, useRef } from 'react'

interface MediaSessionOpts {
  enabled: boolean
  title: string
  artist: string
  album: string
  playing: boolean
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
}

// Lock-screen / notification transport for the autoplay sequence.
//
// Platform reality check:
// - Android Chrome: full support — metadata, artwork, play/pause/next/prev,
//   and the explicit playbackState hint keeps the notification "playing"
//   during the silent gaps between clips.
// - iOS Safari/PWA: metadata is best-effort. useAudio.stop() clears el.src
//   between cards (required to silence iOS reliably), which tears down the
//   Now Playing session on every card change — accepted trade-off.
export function useMediaSession(opts: MediaSessionOpts): void {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

  // Handlers mirrored into refs so the once-registered action handlers stay fresh
  const handlersRef = useRef({ onPlay: opts.onPlay, onPause: opts.onPause, onNext: opts.onNext, onPrev: opts.onPrev })
  handlersRef.current = { onPlay: opts.onPlay, onPause: opts.onPause, onNext: opts.onNext, onPrev: opts.onPrev }

  const { enabled, title, artist, album, playing } = opts

  // Action handlers — registered once per enable
  useEffect(() => {
    if (!supported || !enabled) return
    const ms = navigator.mediaSession
    const actions: [MediaSessionAction, () => void][] = [
      ['play', () => handlersRef.current.onPlay()],
      ['pause', () => handlersRef.current.onPause()],
      ['nexttrack', () => handlersRef.current.onNext()],
      ['previoustrack', () => handlersRef.current.onPrev()],
    ]
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        // Safari throws on unsupported actions — skip
      }
    }
    return () => {
      for (const [action] of actions) {
        try { ms.setActionHandler(action, null) } catch { /* noop */ }
      }
      ms.metadata = null
    }
  }, [supported, enabled])

  // Metadata — per current word
  useEffect(() => {
    if (!supported || !enabled) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      })
    } catch {
      // MediaMetadata constructor missing on very old browsers
    }
  }, [supported, enabled, title, artist, album])

  // Explicit state hint — overrides the browser's inferred state, which would
  // flip to "paused" during every silent gap between clips
  useEffect(() => {
    if (!supported || !enabled) return
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    } catch { /* noop */ }
    return () => {
      try { navigator.mediaSession.playbackState = 'none' } catch { /* noop */ }
    }
  }, [supported, enabled, playing])
}
