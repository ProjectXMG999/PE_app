/**
 * The "something is on its way" placeholder.
 *
 * Lives in its own module rather than inside App so the route guard can use it
 * too — App imports RequireEntitlement, so RequireEntitlement importing back
 * out of App would be a cycle.
 */
export function LoadingFallback() {
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
