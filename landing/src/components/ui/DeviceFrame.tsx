import './DeviceFrame.css'

interface Props {
  /** Path under /shots, without extension — e.g. "dzisiaj-mobile". */
  name: string
  /** Alt text. Describe what the screen SHOWS, not that it's a screenshot. */
  alt: string
  /** Intrinsic pixel size of the @1x image; reserves space so nothing shifts. */
  width: number
  height: number
  variant?: 'phone' | 'plain'
  /** The hero shot must not lazy-load — it's the LCP element. */
  priority?: boolean
  className?: string
}

/**
 * A real screenshot of the app, in a restrained CSS device frame.
 *
 * The landing shipped with zero images — one 480-byte favicon and not a single
 * <img> in the source — so nothing on it ever showed the thing being sold.
 * These shots are generated from the running app by scripts/shots.mjs; when the
 * product changes, re-run it rather than editing anything here.
 *
 * The frame is deliberately abstract: a rounded rectangle, a hairline, a
 * shadow. No drawn iPhone bezel, notch or home indicator — those are somebody
 * else's industrial design, they date fast, and they read as clip-art.
 */
export function DeviceFrame({
  name,
  alt,
  width,
  height,
  variant = 'phone',
  priority = false,
  className,
}: Props) {
  return (
    <div className={`device device--${variant}${className ? ` ${className}` : ''}`}>
      <div className="device__screen">
        <img
          src={`/shots/${name}.webp`}
          srcSet={`/shots/${name}.webp 1x, /shots/${name}@2x.webp 2x`}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          // Tells the browser to start the LCP image ahead of everything below
          // the fold, rather than letting it queue behind the lazy shots.
          //
          // Spelled lowercase and spread: React 18's DOM layer doesn't know the
          // camelCase `fetchPriority` prop and warns about it, then drops it.
          // Lowercase unknown attributes are passed straight through, which is
          // all the browser needs. (React 19 supports the camelCase form.)
          {...(priority ? { fetchpriority: 'high' } : {})}
        />
      </div>
    </div>
  )
}
