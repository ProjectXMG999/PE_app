import { useCallback, useMemo, useRef } from 'react'
import { PackMeta } from '../../../types/vocabulary'
import { PackMemory, PackRelation } from '../../../utils/packMemory'
import './Minimap.css'

interface Props {
  packs: PackMeta[]
  memory: Map<string, PackMemory>
  /** Catalogue slice the neighbourhood is currently showing. */
  from: number
  to: number
  /** Move the neighbourhood window to this catalogue index. */
  onSeek: (index: number) => void
}

/** Number of buckets the 864 packs are summarised into. */
const BUCKETS = 72

type Bucket = { relation: PackRelation; share: number }

/**
 * The whole 864-pack route as one slim strip, with a window showing which slice
 * the neighbourhood above is displaying.
 *
 * This is the half of the map the neighbourhood gives up: scale. You cannot read
 * individual packs here and you are not meant to — what it answers is "how far
 * along the whole thing am I", which is the promise the product makes on its
 * landing page ("10 000 słów. 4 poziomy. Jedna mapa.").
 *
 * Summarised into buckets rather than drawn per pack: 864 one-pixel slivers is
 * moiré on a phone, and the shape of progress is the only signal that survives
 * at this size anyway.
 */
export function Minimap({ packs, memory, from, to, onSeek }: Props) {
  const railRef = useRef<HTMLDivElement>(null)

  const buckets = useMemo<Bucket[]>(() => {
    const size = Math.ceil(packs.length / BUCKETS)
    const out: Bucket[] = []
    for (let b = 0; b < BUCKETS; b++) {
      const start = b * size
      const end = Math.min(packs.length, start + size)
      if (start >= end) break
      let held = 0, fading = 0, active = 0
      for (let i = start; i < end; i++) {
        const rel = memory.get(packs[i].id)?.relation
        if (rel === 'held') held++
        else if (rel === 'fading') fading++
        else if (rel === 'active') active++
      }
      const n = end - start
      // A bucket takes the colour of whatever is most present in it; fading wins
      // ties because it's the state that needs acting on.
      const relation: PackRelation =
        fading > 0 && fading >= held ? 'fading'
        : held > n / 2 ? 'held'
        : held + active > 0 ? 'active'
        : 'ahead'
      out.push({ relation, share: (held + fading) / n })
    }
    return out
  }, [packs, memory])

  const seekFromEvent = useCallback((clientX: number) => {
    const rail = railRef.current
    if (!rail) return
    const rect = rail.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(Math.round(t * (packs.length - 1)))
  }, [onSeek, packs.length])

  const windowLeft = (from / packs.length) * 100
  const windowWidth = ((to - from) / packs.length) * 100

  return (
    <div
      className="minimap"
      ref={railRef}
      onPointerDown={e => {
        // Seek first: pointer capture is a nicety for dragging past the rail's
        // edge, and it throws for synthetic events (and some assistive input),
        // which must not cost the user their tap.
        seekFromEvent(e.clientX)
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* optional */ }
      }}
      onPointerMove={e => { if (e.buttons === 1) seekFromEvent(e.clientX) }}
      role="slider"
      tabIndex={0}
      aria-label="Cała trasa — przewiń mapę"
      aria-valuemin={1}
      aria-valuemax={packs.length}
      aria-valuenow={from + Math.round((to - from) / 2)}
      onKeyDown={e => {
        const step = e.shiftKey ? 100 : 24
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, from - step)) }
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(packs.length - 1, from + step)) }
      }}
    >
      <div className="minimap__rail" aria-hidden="true">
        {buckets.map((b, i) => (
          <span
            key={i}
            className={`minimap__tick minimap__tick--${b.relation}`}
            style={{ ['--share' as string]: b.share }}
          />
        ))}
      </div>
      <span
        className="minimap__window"
        style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }}
        aria-hidden="true"
      />
    </div>
  )
}
