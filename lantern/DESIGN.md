# Lantern — design notes

## Why a fantasy village

The first version of this was an on-call shift at a shop, with support tickets
and a trace viewer. It was accurate and nobody wanted to play it. Two things
were wrong. Reading a table of spans is work, and a game that reskins your job
as your job has no reason to be a game.

So the trace became a place and the steps became characters. You do not read
that a retrieval span returned the wrong document. You walk up to a mole holding
the page about carrots.

## Why one screen, and one day

An earlier pass had a title screen, three tickets, an interlude screen, three
more tickets and a results screen. Every transition threw the world away and
rebuilt it, and it read as a slideshow with a game trapped inside.

Now there is one glade and it never resets. Villagers arrive and leave, the old
woman walks up on her own, the lantern is a thing that happens to you in the
middle of the day rather than a screen between two halves. The player's position
is never touched by any of it.

## Why day one is one villager

The complaint that mattered most in testing was that stage one taught nothing.
It was three rounds of blind guessing before anything was explained.

Two changes fixed it. Day one is now a single villager, so the fog is something
you feel for two minutes rather than fifteen. And the fogged helpers are worth
talking to: walk up to one while you still cannot see it and it tells you what
it is for, and what that part of an AI does out here. You learn the anatomy
while blind, which is the part that makes the lantern mean something.

The strongest beat is the one straight after: the old woman does not hand you a
new problem, she tells you to look again at the asking you already made. The
record was there the whole time. That is the actual product truth and it is
worth more than any number of fresh puzzles.

## Wording

Plain words, village words. Nobody sows anything or consults an archive. Bram
digs potatoes up before the frost. Tokens are "words read" and "words spoken",
cost is cost, and the real `$ai_*` name sits in brackets after the plain label
so it is learnable without being the first thing you read.

## Rules the design follows

- **One screen, one glade, no menus of abstractions.** Everything is a thing you
  can walk to. The old version asked you to choose between four sentences about
  possible fixes; this one asks you to point at whoever did it.
- **Blaming a helper is the whole verb.** "Which step failed?" is the actual
  question observability answers, so it is the only question the game asks.
- **Day one has to be frustrating.** If guessing at fog were pleasant, the
  lantern would be a feature tour instead of a relief.
- **Thinker is never guilty.** Two of the four helpers are model calls. The one
  that does the reasoning is never at fault, and the one that speaks is at fault
  once, for a cost reason rather than a thinking reason. Players reach for the
  talking part first, every time.
- **Stepping back is always the first option.** Accusing someone is never the
  default highlighted choice, so a stray space bar cannot blame a helper.
- **A cleverer mind is a real option and never works.** You can spend more on a
  better model at the stone. It changes nothing, which is cheaper to learn
  here than in production.
- **Real calls, real numbers.** Mana and coin are the token counts and cost the
  provider reported. Streaming exists in the client only because it is the only
  way to measure time to first token.
- **The recorder runs on both days.** Day one draws fog; it does not skip the
  instrumentation. Otherwise the look-back beat would be a lie.
- **Art and music are code.** Sprites are pixel data validated on build, and the
  chiptune is generated with Web Audio. Nothing to license, nothing to download,
  and the whole game stays a static site.

## The three faults, in the village's terms

Each one teaches a different column of a trace, and each is reproducible against
a live model.

1. **Finder brings the wrong page.** The answer is fluent, sourced and wrong.
   Teaches: read what a step was given, not just what came out. The model was
   never the problem.
2. **Teller hoards.** The whole book and every past asking are read out before it
   will speak. Teaches: cost and time are debugging signals, and one asking tells
   you nothing here. You need to compare several, which is why the pile is drawn
   growing in front of it.
3. **Runner never comes back.** Three failed tries, swallowed, and Teller invents
   a safe bridge. Teaches: a finished asking and a confident answer prove
   nothing.

## Not built yet

Three villagers is a quiet day. A real oracle answers thousands, and the tools
change shape at that point:

- **Evaluations** — a judge that scores every answer, so faults surface before a
  villager walks up.
- **Datasets** — freeze the three ruined askings and re-run them after a fix.
- **Clustering** — group thousands of failures so you go after the biggest
  pattern rather than the loudest villager.

A second thing worth doing before any of that: villagers currently pop in and
out. Walking them in and out of the glade would cost little and would make the
day feel like a day.

That is a second release. The fog-to-lantern flip is a complete idea on its own.

## Deploying

Not wired up yet. The intended shape matches `focus/`: a Cloudflare Pages
project plus a `.github/workflows/deploy-lantern.yml` that builds and runs
`wrangler pages deploy dist`. That needs the Pages project to exist first, so it
is a deliberate manual step rather than a workflow that would fail on its first
push.

Nothing here needs the worker or D1. The game is entirely client side.
