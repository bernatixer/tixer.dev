// ============================================
// POSTHOG CLIENT (client-side)
// ============================================
//
// Browser-side analytics + session replay. Pairs with the server-side
// `posthog-node` events emitted by the worker — both key off the Clerk
// user id (see AnalyticsBridge.identify), so a person's backend events
// and frontend sessions stitch together into one timeline.
//
// Privacy: replays mask ALL text and inputs. Task titles, notes and goal
// text never leave the browser as readable content — we record layout and
// interactions only.

import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'

let started = false

export function initAnalytics(): boolean {
  if (started || !KEY) return false
  started = true

  posthog.init(KEY, {
    api_host: HOST,
    // Only create person profiles once we've identified a signed-in user,
    // so anonymous noise doesn't inflate the person count.
    person_profiles: 'identified_only',
    autocapture: true,
    // SPA: we capture $pageview ourselves on route change (see
    // AnalyticsBridge) so client-side navigations are counted.
    capture_pageview: false,
    capture_pageleave: true,
    // ---- Session replay, fully masked ----
    disable_session_recording: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
  })

  return true
}

export const analyticsEnabled = (): boolean => Boolean(KEY)

export { posthog }
