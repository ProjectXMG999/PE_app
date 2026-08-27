import { useEffect, useState } from 'react'

// TEMP: one-deploy diagnostic for the installed-iOS-PWA bottom gap. Reports
// what iOS actually gives us for the viewport / safe area, plus where the
// fixed .bottomnav element really ends. Remove after the screenshot.
export function ViewportProbe() {
  const [lines, setLines] = useState<string[]>(['measuring…'])

  useEffect(() => {
    function measure() {
      const de = document.documentElement
      const nav = document.querySelector('.bottomnav') as HTMLElement | null
      const r = nav?.getBoundingClientRect()
      const cs = nav ? getComputedStyle(nav) : null

      const probe = document.createElement('div')
      probe.style.cssText =
        'position:fixed;top:0;left:0;visibility:hidden;height:env(safe-area-inset-bottom);width:env(safe-area-inset-top)'
      document.body.appendChild(probe)
      const safeBottom = probe.offsetHeight
      const safeTop = probe.offsetWidth
      probe.remove()

      const vv = window.visualViewport
      const iH = window.innerHeight

      setLines([
        `innerH ${iH}  deClientH ${de.clientHeight}  scrollH ${de.scrollHeight}`,
        `visualVP ${vv ? Math.round(vv.height) : '-'}  screen ${screen.height}  dpr ${window.devicePixelRatio}`,
        `safe-bottom ${safeBottom}px   safe-top ${safeTop}px`,
        `nav.standalone ${String((navigator as unknown as { standalone?: boolean }).standalone)}  ` +
          `dm:standalone ${matchMedia('(display-mode: standalone)').matches}`,
        r
          ? `bottomnav rect: top ${Math.round(r.top)}  bottom ${Math.round(r.bottom)}  h ${Math.round(r.height)}`
          : 'bottomnav: NOT MOUNTED',
        cs ? `bottomnav css: bottom ${cs.bottom}  h ${cs.height}  pb ${cs.paddingBottom}` : '',
        r ? `GAP innerH - rect.bottom = ${Math.round(iH - r.bottom)}px` : '',
      ].filter(Boolean))
    }

    measure()
    const t1 = setTimeout(measure, 500)
    const t2 = setTimeout(measure, 1500)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  return (
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
        boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
      }}
    >
      {lines.join('\n')}
    </div>
  )
}
