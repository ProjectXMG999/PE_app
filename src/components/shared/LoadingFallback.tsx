import { useLocation } from 'react-router-dom'
import { sessionAccent } from '../../navigation/sessionRoutes'
// The ground below is the curtain's own, so it comes from the curtain's
// stylesheet rather than a copy of it. Imported here, from a module in the
// main bundle, because that is the point: this renders while the page that
// owns those styles is still being fetched.
import '../flashcard/SessionOpener.css'

/**
 * The "something is on its way" placeholder.
 *
 * Lives in its own module rather than inside App so the route guard can use it
 * too — App imports RequireEntitlement, so RequireEntitlement importing back
 * out of App would be a cycle.
 *
 * On a study route it is not a placeholder at all: it is the first frame of the
 * curtain. Both of the waits this covers — the page chunk arriving, and the
 * entitlement gate resolving — sit between the tap and the session page
 * mounting, i.e. in front of a curtain that cannot exist yet, and a spinner
 * there is the blank screen the curtain was written to replace. Painting the
 * ground and the wash in the accent the page is about to use makes the
 * hand-over invisible: the curtain is already up, and its title cascades in the
 * moment the page can say what it is.
 */
export function LoadingFallback() {
  const { pathname } = useLocation()
  const accent = sessionAccent(pathname)

  if (accent) {
    return (
      <div
        className="sessionopener sessionopener--ground"
        style={{ ['--so-accent' as string]: accent }}
        aria-hidden="true"
      />
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div className="spinner" />
    </div>
  )
}
