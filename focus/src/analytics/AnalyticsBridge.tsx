// ============================================
// ANALYTICS BRIDGE
// ============================================
//
// Renders nothing. Lives inside both <ClerkProvider> and <BrowserRouter>
// so it can:
//
//   1. capture a $pageview on every client-side route change (autocapture
//      only fires on full loads, so SPA navigations need this).
//   2. identify() the PostHog person with the Clerk user id — the SAME id
//      the worker uses as distinctId — and reset() on sign-out so a shared
//      browser doesn't bleed one person's session into another's.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { analyticsEnabled, posthog } from './posthog'

export function AnalyticsBridge() {
  const enabled = analyticsEnabled()
  const location = useLocation()
  const { isLoaded, isSignedIn, user } = useUser()

  // Pageview on every route change (including the first).
  useEffect(() => {
    if (!enabled) return
    posthog.capture('$pageview')
  }, [enabled, location.pathname, location.search])

  // Tie the browser session to the Clerk user.
  useEffect(() => {
    if (!enabled || !isLoaded) return

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      })
    } else {
      posthog.reset()
    }
  }, [enabled, isLoaded, isSignedIn, user])

  return null
}
