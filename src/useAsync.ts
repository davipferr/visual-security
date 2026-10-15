import { useEffect, useState, type DependencyList } from 'react'

/** Re-runs `run` when `deps` change and keeps the latest result (stale results are dropped). */
export function useAsync<T>(run: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let live = true
    run().then((v) => live && setValue(() => v))
    return () => {
      live = false
    }
  }, deps)
  return value
}
