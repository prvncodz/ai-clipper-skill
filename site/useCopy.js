import { useEffect, useRef, useState } from 'react'

export function useCopy(text) {
  const [status, setStatus] = useState('idle')
  const attempt = useRef(0)
  const resetTimer = useRef(null)

  useEffect(() => () => {
    attempt.current += 1
    clearTimeout(resetTimer.current)
  }, [])

  async function copy() {
    const currentAttempt = ++attempt.current
    clearTimeout(resetTimer.current)
    setStatus('idle')

    let result = 'copied'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      result = 'error'
    }

    if (currentAttempt !== attempt.current) return
    setStatus(result)
    resetTimer.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return { copy, status }
}
