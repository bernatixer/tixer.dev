# tixer.dev

Personal site at `tixer.dev` and the **Focus** task app at `focus.tixer.dev`. One repo, three deployable pieces, two hosting providers.

## Repository layout

```
web/        Landing page    → tixer.dev          (GitHub Pages, serves /docs)
focus/      Focus app       → focus.tixer.dev    (Cloudflare Pages)
worker/     API + D1        → /api/*             (Cloudflare Workers)
docs/       Built output of web/ — committed; what GitHub Pages serves
```

The three pieces are independent — no shared bundle, no shared runtime, no shared auth. They only share this repo and the `tixer.dev` apex domain.

## Design language

Neo-brutalism + retro-computer print/dither. High-contrast cyber-minimalism with neon yellow (`--acid` = `#BFFF00`). Monospace typography for chrome and labels (JetBrains Mono); Space Grotesk for body. Sharp edges, bold silhouettes, halftone/dithered illustrations.

Inspiration: factory.ai, ryo.lu, aibodh.com, nof1.ai, gensyn.ai, vercel.com/font, usefaction.com, bfl.ai, patterncraft.fun, zed.dev, ampcode.com, initialcommit.co

Design tokens, theme palette, and the theme hook live as **byte-identical copies** in both `web/` and `focus/`:

- `*/src/styles/shared.css`
- `*/src/styles/theme.ts`
- `*/src/hooks/useTheme.tsx`

This duplication is **intentional** — both apps stay independently deployable with zero coupling. If you change a token, change it in both places.

## Tech stack

- **React 18 + Vite** for both `web/` and `focus/`
- **Cloudflare Workers + Hono + D1** for the API
- **Clerk** for auth (in Focus only; landing page is anonymous)
- **z.ai / GLM-4.5-flash** for the AI task parser
- **TanStack Query** for client cache + mutations
- **pnpm** as the package manager
- **No monorepo tooling** — each subdir has its own `package.json` and `pnpm-lock.yaml`

## Focus — feature summary

Personal kanban board with five columns (Inbox / To Do / Doing / Blocked / Done) plus the **Weekly Goals** card at the top — a bono-loto-style strip that gamifies recurring + ad-hoc weekly objectives. Goals come in two flavours:

- **Simple** — one-shot, click to toggle done
- **Counter** — target N, click cell to +1, fills as a thermometer

Recurring goals re-materialize every Monday with progress reset. When all cells are green, the strip shows a "WEEK CLEARED" trophy chip.

Other Focus features: tag editor, AI task parsing (⌘+Enter on the new task input), milestones per task, blocked-by dependencies (free-text or task reference), priorities, due dates, multiple task types (task / book / video / article / movie), aging indicators, PWA support, light/dark theme toggle.

## Development

Each app runs independently. Open three terminals if you need all of them.

```bash
# Landing page — http://localhost:3000
cd web && pnpm install && pnpm dev

# Focus app — http://localhost:3000
cd focus && pnpm install && pnpm dev

# Worker API — http://localhost:5555
cd worker && pnpm install && pnpm dev
```

Note: both `web` and `focus` default to port 3000, so don't run them simultaneously.

### Focus env

`focus/.env`:

```
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_API_URL=http://localhost:5555/api    # optional, defaults to this
VITE_MOCK_GOALS=1                          # optional, defaults to 1 in dev
```

`VITE_MOCK_GOALS=1` swaps the Weekly Goals API for a localStorage-backed mock so the UI is playable without the worker. Defaults to on in dev, off in production.

### Worker env

Set via `wrangler secret put …` for prod, or `.dev.vars` for local:

```
CLERK_PEM_PUBLISHABLE_KEY=...
CLERK_ISSUER_URL=...                       # optional
ZAI_API_KEY=...
```

D1 binding `DB` → database `focus` (id in `wrangler.toml`).

### D1 schema

The whole schema lives in `worker/schema.sql`. All statements are idempotent (`CREATE TABLE IF NOT EXISTS`).

```bash
cd worker
pnpm db:apply:local    # apply to local dev D1
pnpm db:apply:remote   # apply to production D1 — CI also does this on every deploy
```

This repo has **no incremental migrations system** — `schema.sql` is the single source of truth for desired state. `ALTER` statements have to be run manually if you ever need them.

## Deploy

| Piece | Trigger | Workflow |
|---|---|---|
| `worker/**` push to `main` | auto | `.github/workflows/deploy-worker.yml` |
| `focus/**` push to `main` | auto | `.github/workflows/deploy-focus.yml` |
| `web/**` change | **manual** — build locally, commit `docs/` | (no CI) |

### Worker deploy flow

`typecheck → apply D1 schema → wrangler deploy`. Schema apply runs before deploy, so a broken migration blocks the worker from shipping against a stale schema.

### Focus deploy flow

`pnpm build` (with Vite + the production `VITE_*` env from GitHub secrets) → `wrangler pages deploy` to the `focus-tixer-dev` Cloudflare Pages project.

### Landing page deploy

```bash
cd web
pnpm build      # outputs to ../docs/
git add docs && git commit -m "Rebuild landing"
git push
```

GitHub Pages serves whatever is in `/docs` on `main`. `docs/CNAME` and `/CNAME` both point at `tixer.dev`.

## License

See `LICENSE`.
