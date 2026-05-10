// ============================================
// AUTH SYNC HOOK
// ============================================
//
// Wires Clerk into the API client. Two responsibilities:
//
// 1. Register a token *provider* with the API client. The client calls
//    it on every request, so a stale cached token can never reach the
//    wire — Clerk's own `getToken()` is responsible for caching and
//    refreshing the JWT.
//
// 2. Warm Clerk's token cache when the tab regains visibility, so the
//    first request after a long background pause doesn't have to wait
//    for a network round-trip to Clerk.

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setTokenProvider } from '@/api/client'

export function useAuthSync() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      setTokenProvider(null)
      setIsReady(false)
      return
    }

    // Per-request resolution: Clerk returns a fresh JWT automatically
    // when the cached one is near expiry.
    setTokenProvider(() => getToken())

    // Warm the cache once on mount so the first request after sign-in
    // doesn't pay the round-trip latency.
    let cancelled = false
    getToken()
      .then(() => {
        if (!cancelled) setIsReady(true)
      })
      .catch((err) => {
        console.error('Failed to warm auth token cache:', err)
        if (!cancelled) setIsReady(true) // still mark ready — requests will surface their own errors
      })

    // Refresh when the tab becomes visible again. Browsers throttle or
    // pause timers in background tabs and pause them entirely while the
    // OS sleeps; visibilitychange fires reliably when the user returns.
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        getToken().catch(() => {
          // swallow — next outgoing request will retry through the provider
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisible)
      setTokenProvider(null)
    }
  }, [getToken, isSignedIn, isLoaded])

  return { isReady }
}
