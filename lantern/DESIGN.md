# Lantern — design notes

## Why a fantasy village

The first version of this was an on-call shift at a shop, with support tickets
and a trace viewer. It was accurate and nobody wanted to play it. Two things
were wrong. Reading a table of spans is work, and a game that reskins your job
as your job has no reason to be a game.

So the trace became a place and the steps became characters. You do not read
that a retrieval span returned the wrong document. You walk up to a mole holding
the wrong scroll.

## Rules the design follows

- **One screen, one glade, no menus of abstractions.** Everything is a thing you
  can walk to. The old version asked you to choose between four sentences about
  possible fixes; this one asks you to point at whoever did it.
- **Blaming a spirit is the whole verb.** "Which step failed?" is the actual
  question observability answers, so it is the only question the game asks.
- **Day one has to be frustrating.** If guessing at fog were pleasant, the
  lantern would be a feature tour instead of a relief.
- **Muse is never guilty.** Two of the four spirits are model calls. The one
  that does the reasoning is never at fault, and the one that speaks is at fault
  once, for a cost reason rather than a thinking reason. Players reach for the
  talking part first, every time.
- **A greater spirit is a real option and never works.** You can spend more mana
  on a better model at the plinth. It changes nothing, which is cheaper to learn
  here than in production.
- **Real calls, real numbers.** Mana and coin are the token counts and cost the
  provider reported. Streaming exists in the client only because it is the only
  way to measure time to first token.
- **The recorder runs on both days.** Day one draws fog; it does not skip the
  instrumentation. Otherwise the lantern would be a lie.

## The three faults

Each one teaches a different column of a trace, and each is reproducible against
a live model.

1. **Delve brings the wrong scroll.** The answer is fluent, sourced and wrong.
   Teaches: read what a step was given, not just what came out. The model was
   never the problem.
2. **Echo hoards.** The whole archive and every past asking are read aloud before
   it will speak. Teaches: cost and latency are debugging signals, and one trace
   tells you nothing here. You need to compare askings, which is why the pile is
   drawn growing in the world.
3. **Errand never comes back.** Three failed attempts, swallowed, and Echo
   invents a delivery. Teaches: a finished ritual and a confident answer prove
   nothing.

## Not built yet

Three villagers is a quiet day. A real oracle answers thousands, and the tools
change shape at that point:

- **Evaluations** — a judge that scores every answer, so faults surface before a
  villager walks up.
- **Datasets** — freeze the three ruined askings and re-run them after a fix.
- **Clustering** — group thousands of failures so you go after the biggest
  pattern rather than the loudest villager.

That is a second release. The fog-to-lantern flip is a complete idea on its own.

## Deploying

Not wired up yet. The intended shape matches `focus/`: a Cloudflare Pages
project plus a `.github/workflows/deploy-lantern.yml` that builds and runs
`wrangler pages deploy dist`. That needs the Pages project to exist first, so it
is a deliberate manual step rather than a workflow that would fail on its first
push.

Nothing here needs the worker or D1. The game is entirely client side.
