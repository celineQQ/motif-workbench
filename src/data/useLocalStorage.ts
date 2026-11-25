import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initialValue : JSON.parse(stored) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage can be unavailable in private contexts. */ }
  }, [key, value])

  return [value, setValue]
}
