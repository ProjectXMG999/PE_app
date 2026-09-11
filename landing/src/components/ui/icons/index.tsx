/**
 * The icon set. One stroke weight, one grid, one colour source.
 *
 * These replace the emoji the sections used to render at font-size: 32px
 * (🎧 ⚡ 🔥 ✓ …). Emoji are the loudest cheapness signal a page can carry:
 * they're drawn by the OS, so the same section looked materially different on
 * macOS, Windows and Android, and their full-colour glyphs fought the
 * restrained violet palette everywhere they appeared.
 *
 * Rules: 24×24 viewBox, `stroke="currentColor"`, stroke-width 1.5, no fills,
 * round caps and joins. Colour comes from the parent's `color` — never a hard
 * -coded value — so an icon inherits the tint of whatever it sits in.
 */
interface IconProps {
  /** Rendered size in px. The 24-unit grid scales cleanly to 16/20/24/32. */
  size?: number
  className?: string
}

function Svg({ size = 24, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Słuchaj — screen-free listening mode. */
export function IconHeadphones(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M20 14h-2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1z" />
    </Svg>
  )
}

/** Trenuj — active recall on the phone. */
export function IconBolt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" />
    </Svg>
  )
}

/** Confirmation — feature lists, guarantees. */
export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  )
}

/** The route as a whole — "where am I on the map". */
export function IconCompass(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Svg>
  )
}

/** The ordered curriculum — 864 packs in one line. */
export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7z" />
      <path d="M9 4v13M15 7v12.5" />
    </Svg>
  )
}

/** Streak. */
export function IconFlame(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 22a6 6 0 0 0 6-6c0-4-3-5.5-3.5-9.5C13 8 12 9.5 11 10.5 10 9 9.5 7 9.5 5.5 7.5 7.5 6 11 6 16a6 6 0 0 0 6 6z" />
      <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5c0-1.6-1.3-2.4-1.7-4-1 1.2-1.8 2-2.4 2.9a2.5 2.5 0 0 0 1.6 3.6z" />
    </Svg>
  )
}

/** Points. */
export function IconDiamond(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 3 12l9 9 9-9z" />
      <path d="M7.5 12h9" />
    </Svg>
  )
}

/** Guarantee / trust. */
export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </Svg>
  )
}

/** Cancel anytime / no lock-in. */
export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.7-6" />
      <path d="M20 4v4.5h-4.5" />
    </Svg>
  )
}

/** Secure payment. */
export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

/** Progress over time — the counter section. */
export function IconTrend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 17.5 9.5 11l4 4L21 7.5" />
      <path d="M21 12.5v-5h-5" />
    </Svg>
  )
}

/** Time / minutes per session. */
export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}
