# Lantern

A short pixel-art game about AI observability, in a village that has never heard
the phrase.

A stone Oracle answers the villagers' questions, and it has started getting them
badly wrong. The Oracle does not think. It has four helpers:

- **Finder** looks the question up in the village book
- **Thinker** works out what to do about it
- **Runner** goes out and checks the real world
- **Teller** reads what the others brought and says the answer

Bram left his potatoes in the ground until the snow because the Oracle told him
to, and they all froze. One of the four helpers did that to him. You have to say
which.

On the first morning the circle they stand in is full of fog. You can hear them,
you know what each of them is for, and you cannot see what any of them did. So
you guess.

Then an old woman hands you a lantern, the fog is gone, and she tells you to go
and look at the asking you already made. It was all still there. You just had no
way to see it.

**The lantern is tracing.** That is the whole lesson.

## The three faults

| Villager | What went wrong | What the lantern shows |
|---|---|---|
| Bram, farmer | Finder brought the page about carrots to a question about potatoes | A helper asked for one thing, holding another |
| Nel, lamp keeper | Teller will not speak until the whole book is read to it, and forgets between askings | A pile of books that grows every time you ask |
| Tam, carter | Runner never came back, and Teller filled the gap itself | Three failed tries, and an answer invented to cover them |

Thinker is never at fault. That is deliberate: the part of an AI that does the
talking is rarely the part that broke, and everybody blames it first.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3100
```

`web/` and `focus/` both use port 3000, so this one sits on 3100.

Arrow keys or WASD to walk, space to act. Clicking anything works too, so it is
playable with a mouse alone. There is a chiptune loop with a toggle in the
header.

## Bring your own key

Paste an OpenAI or an Anthropic key, whichever you have. The provider is read
from the prefix, so there is nothing to configure. There is no backend, so the
key never reaches a server of mine: it goes from your browser straight to the
provider, and it stays in `localStorage`.

The Oracle really is a model. Every answer is a live call, and the words and
cost in the header are the token counts and price the provider reported.

Without a key, "visit without a key" runs the same asking against canned
replies. It breaks in exactly the same places, and the record is still real.

## Layout

```
src/
  tracing/     the record: nodes, $ai_* properties, cost, the recorder
  llm/         Anthropic and OpenAI clients (streamed, for real time-to-first-token), demo backend, model catalog
  agent/       the asking: the village book, the world, the four recorded steps
  game/        the helpers, the quests, one continuous run of state
  rpg/         hand-authored sprites, the canvas renderer, the glade, movement
  audio/       a chiptune loop generated in the browser
  ui/          the dialogue box and the screens around the game
```

`src/tracing/` is deliberately a small copy of how PostHog AI observability
models this. A record holds spans and generations, and every node carries the
real `$ai_*` property names. When you walk up to a helper it shows you a plain
label and the real property name next to it, so both stick.

The recorder runs on both days. The first morning only draws fog over the
circle. The blindness is a missing view, never missing data, which is the whole
point of the game.

The art is hand-authored pixel data in `src/rpg/sprites.ts` at 24x24, so there
are no external assets to license or load. `pnpm validate:sprites` checks that
every sprite is rectangular and uses only palette characters; build runs it too.
The music is generated with the Web Audio API for the same reason.
