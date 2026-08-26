# Blindspot

A short browser game about AI observability. You work one on-call shift for a
shop's AI support agent, twice. The first time you have no telemetry. The second
time you do. The bugs do not change.

Built to explain what AI observability is and why a product team wants it,
which mostly means making the blindness concrete before showing the fix.

## The idea

An LLM app fails silently. The request returns 200 and the customer just gets a
bad answer, so from the outside you cannot tell which of five steps went wrong.
Act 1 makes you feel that. Act 2 gives you the trace and the same bugs take one
move each.

Three bugs, each teaching a different column of a real trace:

| Ticket | Fault | What the trace shows |
|---|---|---|
| A-1128 | Retrieval returns the wrong SKU | A `retrieve_docs` span whose output has nothing to do with the question |
| A-1204 | The whole catalog and transcript re-sent every turn | `$ai_input_tokens` climbing turn over turn while output stays flat |
| A-1287 | The order lookup 500s and the agent swallows it | Three `500` spans, then an answer that invents a delivery date |

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3100
```

`web/` and `focus/` both use port 3000, so this one sits on 3100.

## Bring your own key

The game calls Claude directly from the page with the key you paste in. There is
no backend, so the key never reaches a server: it goes from your browser to
`api.anthropic.com` and nowhere else, and it is kept in `localStorage` only if
you tick the box.

Every call is capped at 1024 output tokens and the meter in the header shows real
spend, computed from the token counts the API returns. A full playthrough is a
few dozen short calls.

Without a key, "play without a key" runs the same pipeline against canned
replies. The agent breaks in exactly the same places, and the traces are real
traces of a fake model.

## Layout

```
src/
  tracing/     the trace model: nodes, $ai_* properties, cost, the recorder
  llm/         Claude client (streamed, for real time-to-first-token), demo backend, model picker
  agent/       the HedgeMart support agent: catalog, tools, the traced pipeline
  game/        scenarios, act and score state, the game hook
  ui/          the CRT console
```

`src/tracing/` is deliberately a small copy of how PostHog AI observability
models this: a trace holds spans and generations, and each node carries the real
`$ai_*` property names. What you read in the game's span detail panel is what you
would read in a production trace viewer.

The recorder runs in both acts. Act 1 only hides the panel. The blindness is a
missing view, never missing data, which is the whole point.
