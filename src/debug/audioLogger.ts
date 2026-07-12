// Simple ring buffer for capturing [audio], [action], [seq] console logs
// Used by debug overlay to display logs on iOS without Safari Inspector

const MAX_LOGS = 80
const logs: string[] = []
let listeners: Set<() => void> = new Set()

export function pushLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  logs.unshift(`${ts} ${msg}`)
  if (logs.length > MAX_LOGS) logs.pop()
  listeners.forEach(fn => fn())
}

export function getLogs() {
  return [...logs]
}

export function subscribeToLogs(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
