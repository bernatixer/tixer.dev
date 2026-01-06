// ============================================
// AUTH SYNC HOOK
// ============================================
// Syncs Clerk session token with the API client

import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthToken } from '@/api/client'

/**
 * Hook that syncs the Clerk session token with the API client.
 * Should be used in a component that wraps authenticated content.
 */
export function useAuthSync() {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null)
      return
    }

    // Get initial token
    const syncToken = async () => {
      try {
        const token = await getToken()
        setAuthToken(token)
      } catch (error) {
        console.error('Failed to get auth token:', error)
        setAuthToken(null)
      }
    }

    syncToken()

    // Refresh token periodically (every 50 seconds, as Clerk tokens expire in ~60s)
    const interval = setInterval(syncToken, 50000)

    return () => clearInterval(interval)
  }, [getToken, isSignedIn])
}

