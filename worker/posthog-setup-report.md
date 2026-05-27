<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the tixer.dev Cloudflare Worker backend. The integration adds server-side event tracking across all major user actions using `posthog-node` v5.35.1, configured for a serverless (Cloudflare Workers) environment with `flushAt: 1` and `captureImmediate` to ensure events are sent before each request completes.

**Files created/modified:**
- `src/posthog.ts` — new PostHog client factory (`getPostHog`, `getPhSessionId`)
- `src/types.ts` — added `POSTHOG_API_KEY`, `POSTHOG_HOST` to `Env`; added `phSessionId` to `Variables`
- `src/auth.ts` — reads `X-POSTHOG-SESSION-ID` header for frontend session correlation
- `src/handlers/tasks.ts` — task created / updated / completed / deleted events
- `src/handlers/tags.ts` — tag created / deleted events
- `src/handlers/weeklyGoals.ts` — weekly goal created / completed / deleted events
- `src/handlers/bank.ts` — bank session imported / auth started / auth completed / synced / transaction categorized events
- `src/handlers/ai.ts` — AI task parsed event
- `.env` — `POSTHOG_API_KEY` and `POSTHOG_HOST` added (also add these as Wrangler secrets via `wrangler secret put POSTHOG_API_KEY`)

| Event | Description | File |
|---|---|---|
| `task created` | A new task is created, tracking type, priority, column, and tags | `src/handlers/tasks.ts` |
| `task updated` | A task is updated, tracking column moves and priority changes | `src/handlers/tasks.ts` |
| `task completed` | A task is moved to the "done" column (conversion event) | `src/handlers/tasks.ts` |
| `task deleted` | A task is permanently deleted | `src/handlers/tasks.ts` |
| `tag created` | A new tag label is created | `src/handlers/tags.ts` |
| `tag deleted` | A tag is deleted (strips from all tasks) | `src/handlers/tags.ts` |
| `weekly goal created` | A weekly goal is created | `src/handlers/weeklyGoals.ts` |
| `weekly goal completed` | A weekly goal's progress reaches its target | `src/handlers/weeklyGoals.ts` |
| `weekly goal deleted` | A weekly goal is deleted | `src/handlers/weeklyGoals.ts` |
| `bank session imported` | A bank session is imported from Enable Banking dashboard | `src/handlers/bank.ts` |
| `bank auth started` | OAuth bank authorization flow is initiated | `src/handlers/bank.ts` |
| `bank auth completed` | OAuth bank authorization is finalized | `src/handlers/bank.ts` |
| `bank synced` | Bank transactions are synced, tracking new transaction counts | `src/handlers/bank.ts` |
| `bank transaction categorized` | A transaction category is manually set | `src/handlers/bank.ts` |
| `ai task parsed` | AI natural-language task parsing is invoked | `src/handlers/ai.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/699850)
- [Tasks created vs completed](/insights/46go0yQ0)
- [Task completion rate](/insights/WsjxNqbc) — weekly % of created tasks that get completed
- [Weekly goals completed](/insights/Yaqn2h77) — goals created vs completed per week
- [Bank integration activity](/insights/bGXbwwsi) — sessions, syncs, and categorization events
- [All actions over time](/insights/TeKFt5Jj) — stacked view of all key user actions

> **Deployment note:** `POSTHOG_API_KEY` and `POSTHOG_HOST` are Cloudflare Worker secrets. For production, set them with:
> ```
> wrangler secret put POSTHOG_API_KEY
> wrangler secret put POSTHOG_HOST
> ```

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
