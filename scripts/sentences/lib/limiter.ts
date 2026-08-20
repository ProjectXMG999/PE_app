// Simple concurrency-bounded task queue (same pattern as generate-audio.ts).
export function createLimiter(concurrency: number) {
  let running = 0
  const queue: (() => void)[] = []

  function next() {
    if (running < concurrency && queue.length > 0) {
      running++
      queue.shift()!()
    }
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            running--
            next()
          })
      })
      next()
    })
  }
}
