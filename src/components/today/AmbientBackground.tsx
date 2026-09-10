import './AmbientBackground.css'

/**
 * Decorative atmosphere behind every page. Deliberately still and quiet:
 *   1. a single soft wash of light from the top edge;
 *   2. a fine film grain — the texture that reads as "material", not a flat fill;
 *   3. a gentle floor vignette (::after) so content lifts off the ground.
 *
 * No motion, no colour blobs — the restraint is the point.
 */
export function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__wash" />
      <div className="ambient__grain" />
    </div>
  )
}
