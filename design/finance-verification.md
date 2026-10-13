# Focus Finance v1

Use the money icon in **FOCUS / todo** to open **FOCUS / finance**, or `/finance.html`. The MVP tracks balances, income and spending with occasional check-ins, plus an optional future simulation. It has no FIRE planner, saved allocation rules, transaction feed, bank integration, market prices or external AI. The English UI and card/bar styling follow Focus and the previous `financials` branch.

**Overview** shows cash, investments, loans, a combined account table and large donut, the portions of cash already set aside, and a compact Monthly panel with grey labels, Income and Left amounts in the existing accent colour, and Costs amounts in red. Costs include loan payments that are not already counted in expenses. The account table shows recorded balances and their share of known cash/investments; loans are separate. Investment contributions, withdrawals and gains appear in that same table; cash has dashes in those fields. Donut hover/focus highlights the matching row, while share percentages stay neutral. Growth previews compounded assets from today’s recorded balances, editable annual assumptions seeded from current gain percentages, monthly allocations and transfers. Historical chart rendering has been removed; saved check-ins remain intact. Preview edits never change the vault and reset on leaving Overview. There are no duplicate summary cards or net-worth footer; loans sit below the account table. Missing balances remain unknown, and shares explicitly exclude them. **Accounts** is a dedicated page for cash, investments and loans. **Plan** contains income, spending and yearly costs in subtle grey sections. **Check-in** opens a drawer that walks through one account at a time. Investments ask for money added and taken out since the previous balance, starting at zero; these changes update the saved cumulative totals once on Finish. Lifetime totals are only requested when starting contributions are missing or the entry is backdated. Starting totals can be edited in Accounts. No confirmation checkbox is required. Missing money out defaults to zero; missing contributions or balances still leave gains unknown. Current salary is entered after tax. Yearly pay and expenses are normalized over 12 months, separate from cash available today. The income formula appears only as a tooltip when regular payment frequency differs from 12; tooltips support hover, touch and keyboard focus, and stay within the viewport outside scrolling tables. Account cells have no tooltips. Monthly uses a standard left-aligned card heading and compact receipt rows with expandable details.

Vault settings live behind the header gear, including currency and inactivity locking. Check-ins have no schedule, due notices or reminder panel. The lock icon locks after any unsaved-edit confirmation. The kanban icon returns to Todo through a new document, keeping Finance out of the analytics runtime.

Encrypted schema v3 retains and validates the old FIRE, allocation-rule, income-growth and historical-income fields for backup compatibility. They do not affect current budget calculations. New check-ins leave historical income unknown. Removing an account also removes only its invalidated legacy references. Valid v1/v2 documents migrate after local decryption. Previously recorded contributions stay intact; legacy missing withdrawal values remain stored as null but are treated as zero for calculations and prefilled as zero in editors. The old confirmation flag is retained for compatibility and no longer gates gains. Unsupported or unreadable data is never replaced by defaults. Saving uses normal encryption and revision checks. Crypto envelope remains v1; no additional D1 migration is needed for the private payload upgrade.

## Local development

Use the existing separate `focus/` and `worker/` installs. No workspace is introduced. `hash-wasm` 4.12.0 is the only added runtime dependency; Argon2id runs locally in a dedicated worker, with a fixed 64 MiB profile and no weaker fallback. Secure context and Web Crypto are required. Low-memory devices may fail to unlock rather than reduce the protection.

1. `cd worker && pnpm install && pnpm db:apply:local`. This applies only the local D1 schema. Set `CLERK_PEM_PUBLIC_KEY` and mandatory `CLERK_ISSUER_URL` in local Worker secrets, matching the Focus Clerk instance. See [API configuration](finance-api.md).
2. Run `cd worker && pnpm dev` on port 5555.
3. In `focus/.env.local`, set `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL=http://localhost:5555/api`. Run `cd focus && pnpm install && pnpm dev` on port 3000.
4. Sign in normally. Create a separate vault passphrase, save and acknowledge the recovery key, then complete the editable setup. No private numbers belong in source or environment files.

For a disposable local preview without a configured development Clerk instance, start `node worker/tests/serve.mjs` (port 5556), then from `focus/` run `FOCUS_LOCAL_PREVIEW=1 VITE_API_URL=http://localhost:5556/api pnpm dev`. The dev server maps `/` to the actual Todo workspace using the locally signed test-session provider, and `/finance.html` to the existing real-crypto Finance test document. Both icon switches work at their normal paths. The account control is omitted in this preview. Tasks and encrypted vaults live in the test API's disposable local SQLite database; weekly goals use the existing dev-only localStorage mock. This mode does not use a Clerk instance or production data, is opt-in, and is not included in the production build. Restarting the test API loses preview records. Never use it for durable personal data.

`node tests/local-preview.mjs` verifies root rendering, native Todo/Finance switching and a synthetic task surviving reload through the local authenticated API. It deletes only the task it created. It accepts the same Playwright and isolated test-API environment variables as the Finance browser suite.

The schema adds `financial_vaults` only. CI already applies `worker/schema.sql` before Worker deployment. Finance also needs the pinned issuer configuration; otherwise it fails closed with 503. No legacy table or data cleanup is part of this feature. Do not run a remote schema command or deploy without authorization.

## Using and recovering a vault

Balances are observations. Annualised income and spending are estimates; cash today remains separate. Check in whenever useful; missing periods remain missing. The history contains observations only.

After setup, valid plan edits autosave after 800 ms. Each save encrypts the entire document and atomically compares the last server revision. Edits made during a save remain pending until their own acknowledgement. Invalid input pauses saving. Network failures show **Retry save**; conflicts require exporting your local copy before explicitly loading the server version. Neither is retried automatically. Failed password and recovery-key changes have separate warnings on every unlocked tab. A plan save cannot acknowledge either failure; only a successful matching credential operation or explicit dismissal clears its warning. The header continues to show Needs attention after a plan retry while a credential warning remains. These warnings are in-memory session state and are not a persistent audit log. There is no offline synchronization or automatic merge. Setup steps and **Finish check-in** remain explicit confirmations; check-in drafts stay in memory until finished. Closing an edited drawer asks before discarding it.

The plan consists of the settings you enter. Generated written policy and its editor have been removed; existing encrypted policy notes are preserved in backups, without a data migration.

Decrypted content and keys remain in memory. Explicit locking warns about unsaved edits. Inactivity (default 10 minutes, editable 1–60), leaving Finance, logout and account changes clear accessible unlocked state. A short browser-tab switch keeps the unlocked session in memory; the same inactivity deadline continues while hidden. Returning after expiry locks before input can reset the timer. A monotonic clock plus a wall-clock deadline cover ordinary inactivity and device sleep; a forward clock change can conservatively lock early. Automatic locking discards unsaved edits; export an encrypted copy first if needed. Browser restoration reloads locked. JavaScript cannot guarantee memory erasure.

Keep an encrypted export and its secret separately. Export includes unsaved validated edits and contains only the envelope. In a fresh browser, use **Restore a backup**, choose the file, and enter its passphrase, or select recovery-key restoration and choose a new passphrase. The browser decrypts and validates before asking to replace server content. Wrong secrets, corruption and unsupported schema versions preserve the current vault. A recovery key must match that backup's recovery wrap.

For a server vault with a lost passphrase, use **Can’t unlock? → Use a recovery key** on the locked screen. A Clerk login reset cannot decrypt it. Passphrase changes and recovery-key rotation use the same atomic save protocol. Both keep the same data encryption key. An old backup and either of its old secrets can therefore decrypt later ciphertext from this vault if that ciphertext is obtained, even after both credentials change. These operations do not revoke future access after a compromise; a full data-key replacement is not implemented. Deletion is available only in unlocked Vault settings, not on the locked page. It requires typing DELETE and a second confirmation; it clears server ciphertext, retaining a ciphertext-free revision tombstone. Provider backups may retain encrypted copies under their own policies.

## Privacy and limits

The dedicated finance document imports no PostHog, replay or board query cache. Full-document navigation stops recording/capture before departure; event filtering drops capture on finance paths and strips finance referrers from later board events. Direct URLs and old-PWA app-shell fallback pass through a guard before board analytics can load. Finance API requests bypass Worker analytics. Public app assets may be precached; plaintext financial state and secrets are never intentionally cached or persisted. Finance's route is a privacy boundary, not a security sandbox.

The server knows ownership, opaque vault ID, ciphertext length, revision, update time and cryptographic parameters. A weak passphrase permits offline guessing. A compromised browser/device, malicious same-origin script or malicious deployment can read an unlocked vault. Authenticated encryption detects modification but cannot independently detect replay of an old valid encrypted document by a malicious server. Revision checks prevent ordinary concurrent overwrites, not that rollback attack. This implementation has not received an independent security audit.

One vault per user, maximum 256 KiB plaintext / 512 KiB envelope, modest history (240 check-ins), and ten supported two-decimal currencies. Currency changes relabel existing amounts; there is no conversion. Stored monetary inputs are integer hundredths. Gains compare recorded balances with cumulative deposits and withdrawals; their percentage is a simple total gain, not an annualized, time-weighted or money-weighted return. The separate simulator compounds editable annual assumptions; its defaults reuse these lifetime gain percentages and must not be read as measured annual returns. Past periods cannot be reconstructed from the current balance alone. See [formulas and assumptions](finance-formulas.md), [vault format and threat model](finance-crypto.md), [storage API](finance-api.md), and the [repo-specific implementation plan](encrypted-finance.md).

## Checks

With Node 24 and installed dependencies:

```sh
cd focus
pnpm test
pnpm build
cd ../worker
pnpm test
pnpm typecheck
node tests/serve.mjs --self-check
```

There is no lint script in either app. Unit checks use real Argon2id/AES, an independent native cryptography fixture, session lifecycle failures, pure financial invariants, signed synthetic RS256 tokens and real SQLite using the production SQL/router. Local D1 schema application is separate from those SQLite tests.

Browser integration uses the production finance component and crypto, real HTTP API/auth/SQL, and the actual PostHog SDK with intercepted outbound transport. It injects only a synthetic signed-session token provider through a dev-only test HTML entry; there is no production authentication bypass. Start `node worker/tests/serve.mjs`, and start Focus on localhost:3000 with a synthetic valid-format Clerk public key, `VITE_API_URL=http://localhost:5556/api`, `VITE_POSTHOG_KEY=phc_synthetic_finance_privacy_test`, and `VITE_POSTHOG_HOST=http://localhost:5556/__test/posthog`. To isolate tests from a running demo, start a second API with `FINANCE_TEST_PORT=5557 node worker/tests/serve.mjs` and set `FINANCE_TEST_API_URL=http://localhost:5557` for the browser command; browser requests are forwarded to that real API instance. Then run `node tests/browser.mjs` from `focus/` with an available Playwright installation. `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM` may point to existing installations; no browser dependency is added to the product.

Only synthetic fixtures are used. The test checks actual outbound API/analytics requests and browser storage, mobile overflow, keyboard focus, recovery, import, conflicts and failed-save preservation. It does not verify interactive deployed Clerk sign-in, Cloudflare remote D1 transport, low-memory physical devices or production deployment configuration. Those remain release checks requiring an authorized environment.

For the built entry/PWA boundary, build with the synthetic public key and analytics key, run `pnpm preview --host localhost --port 3001`, then `node tests/bootstrap.mjs` with the same Playwright variables. This uses actual production bundles and the generated service worker, without a finance component override. It checks direct finance asset loading and finance navigation after board analytics/service-worker initialization. [Recorded verification and review](finance-verification.md) describes the completed checks and their limits.

Plan uses compact rows and the existing Focus select/calendar controls. Income, spending and yearly costs are shown one section at a time; rows expand for editing. Each section has a top-right add button that also opens the section. All fields remain mounted so an invalid draft cannot vanish when another section is opened. Accounts have individual bordered rows; empty groups retain only their compact header. Missing investment gains link directly to the investment's missing balance or contribution total. Gain amounts and percentages use two lines in the combined account table; shares use all known cash and investment balances. The unused portfolio-mix editor is removed; previously saved percentages remain intact.

The donut, cash bar and simulator support pointer and keyboard inspection; touch selects the same values. Historical observations remain in the collapsed Balance history table. Retired review-interval settings remain stored but have no UI or calculation effect. Vault currency is in settings. Amounts use European grouping, decimal commas and a currency suffix; money inputs show that currency as a fixed suffix outside their editable value. Dates read day–month–year (for example, 31st October 2067). Stored ISO dates and integer money are unchanged. Dashboard summaries round to whole currency units; money inputs omit forced trailing zeros but still accept cents, and recorded history retains exact hundredths.

Cash savings goals are edited under **Accounts → cash account → Money set aside**, with an add button beside that heading. Choose emergency savings or name another goal directly; no retired FIRE scenario is required. Existing legacy links remain preserved until that goal is changed or removed.


## Monthly breakdown and savings labels — 12 October 2026

Verified 78 finance unit tests, the production TypeScript/Vite build, and the Overview browser suite. Costs and multi-source Income disclose monthly detail with keyboard controls; annual rounding and included-loan adjustments reconcile with totals. Named savings goals replace the empty Other category. Browser checks include mobile expanded panels. The build retains the existing board chunk-size warning.


## Sorted accounts, chart inspection and compact check-in — 13 October 2026

Verified 79 finance unit tests, the production build, the Overview browser regression and the encrypted browser suite against isolated API 5557. Known deposits remain visible without valuations; missing values still break their own series. Pointer leave and Escape remove the chart cursor and popup together; isolated points remain visible. Account/table ordering and matching colors, removed account tooltips/footer, mobile Monthly header and full-width check-in fields were checked. Check-in rendering was inspected in both themes and on mobile. The imported history was rendered read-only without writing the interactive vault. Existing board chunk-size warning remains.


## Combined accounts and larger donut — 13 October 2026

Verified 79 finance unit tests, the TypeScript/Vite production build, the Overview browser regression and the encrypted browser suite on isolated API 5557 (25 encrypted API requests). The combined table preserves investment flows, gains and missing-data edit shortcuts; cash has no invented contributions or returns. Shares use one asset denominator and normal text color. Donut hover selects the matching row, clears on leave, and the chart takes roughly half the desktop width. All columns fit at the checked desktop widths; mobile tables scroll within their cards. Monthly uses aligned totals and expanding detail below a standard heading. Growth remains an independent panel. Read-only rendering of the imported accounts passed; the interactive vault was not modified. The existing board bundle warning remains.


## Compact account panel — 13 October 2026

Verified the Overview browser regression and TypeScript/Vite production build after sizing the donut to the table height, splitting gain amounts and percentages, greying Monthly labels, and removing the selected-row accent line. The imported six-account layout was inspected read-only. Chart inspection, row highlighting, missing balances and mobile overflow still pass. No data, calculation or storage logic changed; the encrypted integration suite was not repeated for these presentation edits.


## Future simulation and monthly receipt — 13 October 2026

Verified all 85 finance unit tests, the TypeScript/Vite production build, the Overview browser regression, and the encrypted browser suite against isolated API 5557 (25 encrypted API requests). New checks cover effective annual compounding, month-end contributions, transfer conservation, reserved cash, negative returns, unknown balances, over-allocation and numeric limits. Browser checks cover Future / History state retention, invalid input, remaining-surplus allocation, transfer rejection and reset. Preview changes leave recorded account values, encrypted vault contents and autosave request counts unchanged.

Desktop and mobile layouts were inspected, including a read-only rendering of the imported six-account layout. Monthly now uses receipt rows with expandable income/cost items. The interactive vault was not changed. The existing board bundle-size warning remains. Scenario persistence, market-derived return estimates, inflation, taxes, transfer costs and future debt balances are outside this preview; assumptions are shown in the panel. No deployment was performed.


## Compact simulator and automatic chart scale — 13 October 2026

Verified 85 finance unit tests, TypeScript/Vite build, Overview browser regression, and encrypted browser integration on isolated API 5557 (25 encrypted requests). Two obsolete chart-history tests were removed with that implementation; two focused tests now cover default gain percentages and chart bounds for small gains, losses and flat values. Browser checks confirm aligned results, compact rows, Years in the header, removal of the History controls, gain defaults on Reset, red losses, keyboard/touch inspection and mobile width. The imported six-account layout was inspected read-only at a one-year horizon. Saved snapshots and the interactive vault are unchanged. The existing board bundle warning remains; no deployment was performed.


## Clearer unlock screen — 13 October 2026

Verified the TypeScript/Vite production build and encrypted browser suite against isolated API 5557 (25 encrypted API requests). The compact unlock card identifies the Finance password separately from sign-in, with recovery and restore grouped under Can’t unlock. Deletion is absent from the locked page and remains available in unlocked settings with typed DELETE and a second confirmation. Desktop, mobile and expanded-help screenshots were inspected; mobile has no horizontal overflow. Wrong-password handling, recovery, backup validation and cancelled deletion passed. No interactive vault data was changed. The existing board bundle-size warning remains.


## PR verification and Pages routing — 13 October 2026

Re-ran 85 Finance tests, 18 Worker tests, Worker type-check and the Focus production build. Final review found a Cloudflare Pages redirect loop that Vite preview does not reproduce. The new `tests/pages.mjs` failed against the original built redirects (308 instead of 200), then passed after using an internal extensionless asset lookup for `/finance.html` and removing the invalid catch-all rewrite. The check uses the local Wrangler Pages server and covers Finance aliases, dedicated HTML/JavaScript, privacy headers, Todo root and SPA fallback. The existing production bootstrap test also passed against that Pages server, including analytics isolation after the board service worker registers. No other blocking review findings remained. Production sign-in, remote D1 and physical-device Argon2 performance remain external release checks.


## Credential review follow-up — 13 October 2026

Both reported medium findings were reproduced. A real-crypto test confirms that an old backup and old password or recovery key can decrypt a later payload after both credentials change, because the data key is retained. The UI and documentation now explicitly describe this future-access limitation; full rekeying remains unimplemented. A separate regression failed before the fix when a plan retry cleared the failed password-change state. Credential warnings now remain independent through plan saves, exports, lock/unlock and unrelated credential changes until their own operation succeeds or the warning is dismissed. No credential secret is retained for retry.

All 89 Finance unit tests, the TypeScript/Vite production build, and the encrypted browser suite passed (27 encrypted API requests against isolated API 5557). The browser reproduces HTTP 500 during password change, saves the plan from another tab, checks the persistent warning and old/new password behavior, then successfully retries the password change. Follow-up review found no further actionable issues. The existing board bundle-size warning remains. Interactive preview data and production were untouched.
