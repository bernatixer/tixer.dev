# Blindspot — design notes

## Why it works this way

The teaching goal is one sentence: **an LLM app is a tree of steps, most of which
can fail without the response looking broken.** Everything is arranged to make
that land rather than to be explained.

- **Act 1 has to be frustrating.** If guessing blind were pleasant, act 2 would
  be a feature tour instead of a relief. Three attempts per ticket, and the wrong
  answers are the plausible ones a real team reaches for first.
- **"Use a bigger model" is on every menu and wrong every time.** It is the most
  common wrong instinct in this space, so the game should let you spend the money
  and watch nothing change.
- **The traces in act 1 are recorded, not faked later.** The `Tracer` runs in
  both acts. Hiding the panel, rather than skipping the instrumentation, is what
  makes the interlude honest.
- **Real calls, real numbers.** Token counts, cost and time-to-first-token come
  from the API response, not from a script. Streaming exists in the client only
  because it is the only way to measure TTFT.

## The three faults

Each fault teaches a different property, and each is reproducible on a live model.

1. `poisoned_retrieval` — the retriever returns the neighbouring SKU. The answer
   is fluent, sourced and wrong. Teaches: read the span inputs, not just the
   output. The model was never the problem.
2. `runaway_context` — the catalog and the full transcript are re-sent every
   turn. Teaches: cost and latency are debugging signals, and one trace tells you
   nothing here. You need to compare turns.
3. `silent_tool_failure` — `lookup_order` returns 500 three times, the agent
   swallows it, and the model fills the gap with an invented delivery date.
   Teaches: a 200 response and a fluent answer prove nothing.

## Not built yet

The obvious act 3 is scale. Three tickets is a shift; production is ten thousand
traces a day, and the tools change shape:

- **Evaluations** — an LLM judge scores every answer, so failures surface without
  a customer complaining first.
- **Datasets** — freeze the three broken conversations as test cases and re-run
  them after each fix.
- **Clustering** — group thousands of failures so you attack the biggest pattern
  rather than the loudest customer.

That is a second release, not a stretch goal for this one. The act 1 to act 2
flip is a complete idea on its own.

## Deploying

Not wired up yet. The intended shape matches `focus/`: a Cloudflare Pages project
plus a `.github/workflows/deploy-blindspot.yml` that builds and runs
`wrangler pages deploy dist`. That needs the Pages project to exist first, so it
is a deliberate manual step rather than a workflow that would fail on its first
push.

Nothing here needs the worker or D1. The game is entirely client side.
