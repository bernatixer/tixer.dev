// ============================================
// POSTHOG REVERSE PROXY (Cloudflare Pages Function)
// ============================================
//
// Content/ad blockers block requests to eu.i.posthog.com (we saw every
// `/e/` ingestion request fail with ERR_BLOCKED_BY_CONTENT_BLOCKER). The
// fix is first-party: the client SDK points api_host at "/ingest" on our
// own domain, and this function forwards to PostHog. Blockers match on the
// third-party host, so first-party requests get through.
//
// Routing mirrors PostHog's reverse-proxy guidance:
//   /ingest/static/*  -> eu-assets.i.posthog.com  (recorder.js, array.js …)
//   /ingest/*         -> eu.i.posthog.com         (events, flags, replay)
//
// Paired with focus/src/analytics/posthog.ts (api_host: '/ingest').

const API_HOST = 'eu.i.posthog.com'
const ASSET_HOST = 'eu-assets.i.posthog.com'

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/ingest/, '')
  const host = path.startsWith('/static/') ? ASSET_HOST : API_HOST

  const target = new URL(url)
  target.hostname = host
  target.port = ''
  target.protocol = 'https:'
  target.pathname = path

  const headers = new Headers(request.headers)
  headers.set('host', host)

  return fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })
}
