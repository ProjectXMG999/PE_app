import { useEffect, useState } from 'react'

// TEMP: locating the "big black strip" below the nav in the installed iOS PWA.
// Draws where several notions of "the bottom" actually land, plus numbers.
// Remove after the screenshot.
export function ViewportProbe() {
  const [lines, setLines] = useState<string[]>(['…'])

  useEffect(() => {
    function measure() {
      const de = document.documentElement
      const shell = document.querySelector('.appshell') as HTMLElement | null
      const main = document.querySelector('.appshell__main') as HTMLElement | null
      const nav = document.querySelector('.bottomnav') as HTMLElement | null
      const sr = shell?.getBoundingClientRect()
      const nr = nav?.getBoundingClientRect()

      const probe = document.createElement('div')
      probe.style.cssText =
        'position:fixed;top:0;left:0;visibility:hidden;height:env(safe-area-inset-bottom);width:env(safe-area-inset-top)'
      document.body.appendChild(probe)
      const sab = probe.offsetHeight
      probe.remove()

      const vv = window.visualViewport
      setLines([
        `innerH ${window.innerHeight}  deClientH ${de.clientHeight}  vv ${vv ? Math.round(vv.height) : '-'}`,
        `screen ${screen.height}  availH ${screen.availHeight}  dpr ${window.devicePixelRatio}`,
        `safe-bottom ${sab}px   standalone ${String((navigator as unknown as { standalone?: boolean }).standalone)}`,
        `appshell rect bottom ${sr ? Math.round(sr.bottom) : '-'}  height ${sr ? Math.round(sr.height) : '-'}`,
        `main scrollTop ${main ? Math.round(main.scrollTop) : '-'}  scrollH ${main ? Math.round(main.scrollHeight) : '-'}  clientH ${main ? Math.round(main.clientHeight) : '-'}`,
        `bottomnav rect top ${nr ? Math.round(nr.top) : '-'}  bottom ${nr ? Math.round(nr.bottom) : '-'}`,
        `innerH - navBottom = ${nr ? Math.round(window.innerHeight - nr.bottom) : '-'}`,
      ])
    }
    measure()
    const t1 = setTimeout(measure, 500)
    const t2 = setTimeout(measure, 1500)
    const main = document.querySelector('.appshell__main')
    main?.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      main?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <>
      {/* Edge markers. Each is a full-width bar at a different notion of "bottom". */}
      {/* position:fixed bottom:0 — where fixed elements think the bottom is */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 3, background: '#ff00ff', zIndex: 99998, pointerEvents: 'none' }} />
      {/* 100dvh bottom */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 'calc(100dvh - 3px)', height: 3, background: '#00e5ff', zIndex: 99998, pointerEvents: 'none' }} />
      {/* 100vh bottom */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 'calc(100vh - 3px)', height: 3, background: '#ffd400', zIndex: 99998, pointerEvents: 'none' }} />
      {/* top of the safe-area-inset-bottom zone */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', height: 2, background: '#00ff6a', zIndex: 99998, pointerEvents: 'none' }} />

      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 2px)',
          left: 4,
          right: 4,
          zIndex: 100000,
          background: '#000',
          color: '#00ff6a',
          font: '10px/1.4 ui-monospace, monospace',
          padding: '5px 7px',
          borderRadius: 5,
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
        }}
      >
        {'magenta=fixed bottom:0  cyan=100dvh  yellow=100vh  green=safe-area top\n'}
        {lines.join('\n')}
      </div>
    </>
  )
}
