// ============================================
// AUTH SYNC HOOK
// ============================================
// Syncs Clerk session token with the API client

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthToken } from '@/api/client'

/**
 * Hook that syncs the Clerk session token with the API client.
 * Returns isReady: true once the token has been set.
 */
export function useAuthSync() {
  const { getToken, isSignedIn } = useAuth()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null)
      setIsReady(false)
      return
    }

    // Get initial token
    const syncToken = async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
        setIsReady(true)
      } catch (error) {
        console.error('Failed to get auth token:', error)
        setAuthToken(null)
        setIsReady(false)
      }
    }

    syncToken()

    // Refresh token periodically (every 50 seconds, as Clerk tokens expire in ~60s)
    const interval = setInterval(syncToken, 50000)

    return () => clearInterval(interval)
  }, [getToken, isSignedIn])

  return { isReady }
}

