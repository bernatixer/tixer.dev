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
// Bundle the session recorder (rrweb) and other extensions INTO our app.
// Otherwise posthog-js lazy-loads them from `/static/posthog-recorder.js`,
// and content blockers match that filename and kill replays — even when
// proxied first-party. With this import + disable_external_dependency_loading
// below, no "posthog"-named script URL is ever requested.
import 'posthog-js/dist/all-external-dependencies'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com'

let started = false

export function initAnalytics(): boolean {
  if (started || !KEY) return false
  started = true

  posthog.init(KEY, {
    // In production, route through our first-party reverse proxy so
    // content/ad blockers can't drop events (see functions/ingest/). In
    // dev there's no Pages Function, so hit PostHog directly. ui_host keeps
    // "open in PostHog" deep-links pointing at the real app.
    api_host: import.meta.env.PROD ? '/ingest' : HOST,
    ui_host: HOST,
    // Use the bundled extensions imported above instead of fetching them
    // at runtime — keeps the blockable `posthog-recorder.js` request from
    // ever being made.
    disable_external_dependency_loading: true,
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
