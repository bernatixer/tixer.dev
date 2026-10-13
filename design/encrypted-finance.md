# Focus Finance — design and implementation plan

2026-10-12. Based on main 5d03de0. Implementation branch: feature/encrypted-finance.

## Design

A low-maintenance rulebook and occasional observed-balance check-in. No transactions, market feeds, external AI, or provider assumptions. Keep Focus's English UI, themes, mono labels, thin card borders, allocation bars and acid-green accents from origin/financials. Reuse presentational styling, not its bank/transaction architecture.

Four boundaries: pure validated TypeScript model/calculations; browser crypto and in-memory lifecycle; authenticated opaque storage; React UI. One vault per Clerk user. The worker never interprets financial values. No existing tables or financials-branch data are removed.

Finance has a dedicated HTML entry at /finance.html. The Focus link performs full navigation, suppresses capture before leaving and excludes its link from autocapture. Finance imports no PostHog module or board query cache. A bootstrap guard reroutes /finance and /money before importing the board. Pagehide locks; persisted pageshow reloads to a locked document. Returning to Focus starts a new document. This boundary limits analytics; it is not a same-origin security sandbox. No service worker runtime cache for vault API, no financial values in storage or URLs. Clerk remains solely authentication.

AES-256-GCM payload under a random 256-bit key. Independent AES-GCM wraps under Argon2id-derived password key and 256-bit random recovery secret. hash-wasm is the narrowly required crypto dependency, bundled locally; native Web Crypto does not implement Argon2id. Argon2id uses a fixed bounded profile (64 MiB, 3 passes, parallelism 1), 16-byte salt, 32-byte output. Reject unknown/oversized envelopes before derivation. New 96-bit random nonce for every encryption, 128-bit tags, version/id/purpose-bound authenticated context. No device fallback to weaker derivation. Export includes ciphertext/wraps, never secrets. Recovery acknowledgement required before create; import decrypts and validates before an explicit replacement. No plaintext persistence.

Clear unlocked references on lock, timeout, pagehide, logout/account switch, and departure. Async operations carry an epoch so late decryption/save responses cannot restore unlocked state. Automatic lock discards unsaved edits; explicit lock/departure warns; conflicts preserve edits while unlocked. No guaranteed JavaScript memory erasure. Rollback of valid old ciphertext cannot be fully detected without trusted external state. Old backups remain decryptable with old credentials.

D1 adds an idempotent financial_vaults table: user primary key, opaque vault id, envelope JSON, revision, updated_at and deleted flag. Create is insert-if-absent or conditional tombstone replacement; update and delete atomically compare owner + vault id + expected revision. Delete clears ciphertext and retains a monotonic revision tombstone, preventing delete/recreate ABA even when restoring an old vault ID. GET 404 alone means absent; 401/network/5xx never permit creating over unreadable data. Strict Clerk session claims and allowlisted authorized party on finance requests. No financial routes pass through worker analytics hooks. Bound streamed request size and serialized ciphertext to a modest 512 KiB envelope (up to 256 KiB plaintext).

Money inputs are integer hundredths of the chosen currency (explicit v1 two-decimal currency convention); locale decimal separators accepted without ambiguous grouping. Plan data includes annualised income with regular payment count plus extra payments, recurring essentials/discretionary costs, irregular annual costs, cash and disjoint earmarks, portfolio totals, fixed-rate debts and dated observations. Monthly estimates are distinct from cash today. Reserve uses selected months of essential outgoings plus required debt commitments. No default cash-to-FIRE allocation. Ordered structured allocations replenish reserve, provision planned spending, optionally repay debt, retain cash, invest. Manual choice and suggested investment remain distinct; show capacity shortfalls.

Deterministic monthly FIRE uses annual real return net of fees, monthly factor (1+r)^(1/12), end-month contributions, today's purchasing power, taxes excluded, separate retirement spending and withdrawal assumption. Dates map to calendar months; dated scenario costs draw their own earmark once, then reduce contributions, then available unearmarked cash, then explicitly model investment withdrawals, with uncovered costs surfaced. Required debt payments end at the supported amortisation date; non-amortising/variable schedules are flagged. Reference target crossing is not lifetime sustainability; remaining obligations are shown separately. Missing observations remain missing; no inferred performance.

## UI feedback iteration

Keep the liked observed balance cards, reserve/budget panels and allocation bar. Share the actual Focus header, theme control and icon switch within `focus/`: **FOCUS / todo** and **FOCUS / finance**. The switch uses native document navigation; the board alone supplies its analytics-suppression callback. This preserves the analytics-free finance bundle and existing vault teardown.

Reduce Finance to Overview, Plan and FIRE. Check-in is an action; vault settings/lock/account live in the header. Plan uses expandable income/spending, accounts and policy sections instead of nested tabs. Primary actions adopt Focus's square outlined acid buttons. FIRE puts the chart/results first, with editable assumptions and methodology beneath disclosures. Compare a lower/base/higher real return (default base ±2 percentage points, adjustable temporary view range), with identical funding/debt/cost accounting and no probabilities.

Add an Overview income card: current annualised pay, monthly equivalent, recorded check-in income changes and a separate editable real-growth forecast. New financial schema v2 adds the growth assumption and annualised income observations; strict v1 migration leaves old income observations unknown, then the next successful encrypted revision save stores v2. No Worker/D1 migration or crypto-envelope change is required. Income forecasts do not automatically increase FIRE contributions.

Implement header/navigation and charts, thread encrypted model changes through validation/migration/check-in, add focused calculation/migration/form regression checks, then verify real browser network/storage boundaries, mobile rendering and production bundles.

## Implementation and checks

1. Pure model and input validation; allocation, debt, observations and deterministic projection. Node assert/node:test suite covers accounting invariants, deficits, edge rates, dates, temporary costs and remaining obligations. Document exact implemented formulas.
2. Envelope validator and real browser-compatible crypto; round trips, wrong secret, tampering, recovery/passphrase rotation, fresh-context backup restoration, KDF bounds and unsupported schema. Browser crypto is never mocked.
3. D1 handlers/auth and non-destructive schema. Real SQLite/D1-backed tests cover isolation, stale writes/deletes, creation races and failure status; no production database operations.
4. Dedicated finance entry, analytics suppression at Focus departure, setup wizard, overview, editable plan, check-in, FIRE scenarios and vault settings. Use existing React/Clerk/theme, separate explicit finance fetches and no plaintext query cache.
5. Build/typecheck, browser creation/unlock/check-in/recovery/conflicts, mobile/keyboard review. Intercept and inspect actual browser outbound requests and browser storage with distinctive synthetic values, including direct load, Focus entrance, departure/back/forward and previous analytics initialization. Report exact limitations if real Clerk testing needs credentials.
6. Final review, documentation, local commit if useful. No push, deployment, remote D1 command or legacy cleanup.

Research: https://bogleheads.es/guia and all nine main linked chapters (investing, index funds, philosophy, allocation, equities, bonds, vehicles, written plan, independence); https://github.com/Daninet/hash-wasm; https://www.rfc-editor.org/rfc/rfc9106.html; https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt; https://clerk.com/docs/guides/sessions/manual-jwt-verification.
# UI simplification — October 2026

Keep the existing Focus header, encrypted storage boundary and financial calculations. Remove the footer, campaign headings, generated written policy and duplicate FIRE table. Existing policy notes remain in encrypted backups for compatibility; they are no longer edited or rendered.

Completed plans autosave after 800 ms of valid edits. Saves remain serialized and revision checked. Acknowledging an older draft must preserve newer edits; failures and conflicts pause autosave and keep a visible retry/export path. Invalid native inputs must also block autosave, even when the model still contains the preceding valid value. Lock and departure cancel pending work and clear the unlocked UI.

Check-in becomes a native modal drawer: existing balances, one observation date, optional contribution totals and confirmation that baseline settings are current. Finishing records one snapshot; settings remain in Plan. Charts use a bounded height, a return comparison slider, and pointer/keyboard inspection of monthly values. Debt links open the same Plan accounts used by the projection.

## Compact controls and tab switching

Reuse Focus's StyledSelect and MiniCalendar, retaining accessible keyboard operation and native finance validation. Put allocation amounts within the bar labels, move currency to Vault settings, collapse optional baseline/account details, and size fields to their content. Keep stored money precision and all existing rules, observations and calculations; round overview summaries only. Reduce the return comparison spread to ±10 points.

A browser-tab switch now keeps the key only in the existing page's memory until the configured inactivity deadline. Deadline checks on resume precede new activity; page departure/reload/auth changes still lock. No persisted unlocked state, cross-tab key transport or backend change. Test lifecycle deadlines, calendar/select integration, validation/autosave, encrypted network boundaries and Todo regression; inspect desktop/mobile rendering.

## Everyday finance UI

Use European amounts (dot grouping, comma decimals, currency after the amount) and readable day-first dates throughout Finance. Keep exact integer money and ISO dates in encrypted storage. An allocation ring and adjacent amount/percentage rows explain the actual suggested distribution; a separate monthly table starts with take-home pay. Emergency savings show months covered against the chosen target and cash split into money for emergencies, planned purchases and money available. Keep incomplete balances, deficits and manual-investment shortfalls explicit.

Income and spending use a short section chooser. Existing expenses, accounts and rules become compact rows that expand for editing; retain invalid drafts when switching sections and reveal them when validation fails. Reuse Focus controls and icons. Replace financial jargon, explain portfolio composition separately from new contributions, and remove routine loan-payoff commentary from Overview. The review interval only identifies older balances, without scheduled notifications or required check-ins. No changes to encryption, schema, calculations, authentication or analytics boundaries. Blank balances keep their existing meaning after the user's clarification.

## Remove income forecasting and tighten rows

Remove the separate income forecast/history UI, future-pay input and unused projection helper. Keep current income in the monthly breakdown and Plan, and preserve existing encrypted v2 fields for backup compatibility. New check-ins no longer collect income history. Move the allocation ring above the detailed cards and show an empty ring when there is no allocation, without invented percentages. Remove the navigation divider; put muted descriptions beside row names and allow natural wrapping on small screens. Verify calculations and schema compatibility, encrypted check-ins, ring states and desktop/mobile layout.

## Balance-tracking MVP

Remove FIRE, income projections and surplus-allocation rules from navigation, setup, editors, Overview and the calculation runtime. Keep accounts, income/spending, current loan commitments, observed savings portions, optional portfolio composition, check-ins and encrypted vault settings. Setup ends after income/spending and accounts. Move review cadence to settings; remove age/horizon and reserve-target assumptions from the active UI. The MVP budget must ignore retired scenario costs and contribution settings. Retain validated v2 fields inside encrypted saves/exports for compatibility; do not clear old data. Keep data-loss protection, raw-input validation, autosave and privacy boundaries unchanged. Use compact inline Plan summaries and ordinary salary/income wording; move the net-worth explanation to the existing tooltip style with keyboard access. Verify reduced setup, old-vault preservation, monthly accounting, check-ins, recovery/conflicts, analytics exclusion and mobile rendering.
