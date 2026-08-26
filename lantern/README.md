# Lantern

A short pixel-art RPG about AI observability.

A village Oracle has started giving ruinous advice. The Oracle does not think.
It runs a ritual, and four spirits do the work:

- **Delve** digs the right scroll out of the archive
- **Muse** decides which rite the question calls for
- **Errand** runs out into the world and brings a fact back
- **Echo** reads what the others brought, and speaks

Three villagers come to you with a ruined crop, a half-spent mana store, and a
lost cartwheel. Each time, one spirit is at fault. You have to say which.

On the first day the circle is full of fog. You hear Echo's answer, it sounds
perfect, and you point at a shape in the mist. On the second day someone hands
you a lantern, the fog is not there any more, and the same three faults take a
minute each.

The Lantern is tracing. That is the whole joke and the whole lesson.

## The three faults

| Villager | What went wrong | What the Lantern shows |
|---|---|---|
| Marrow, herbalist | Delve fetched the sunflower scroll for a moonflower question | A spirit asked for one thing and holding another |
| Odd, miller | Echo will not speak until the whole archive is read to it, and forgets between askings | A pile of scrolls that grows every time you ask |
| Wren, carter | Errand never came back, and Echo covered for it | Three failed attempts, and an answer invented to fill the gap |

Muse is never at fault, which is the point. The part that does the talking is
rarely the part that broke.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3100
```

`web/` and `focus/` both use port 3000, so this one sits on 3100.

Arrow keys or WASD to walk and space to act. Clicking anything works too, so it
is playable with a mouse alone.

## Bring your own key

Paste an OpenAI or an Anthropic key, whichever you have. The provider is read
from the prefix, so there is nothing to configure. There is no backend, so the
key never reaches a server of mine: it goes from your browser straight to the
provider, and it stays in `localStorage`.

The Oracle really is a model. Every answer in the game is a live call, and the
mana and coin in the header are the token counts and cost the provider reported.

Without a key, "visit without a key" runs the same ritual against canned replies.
It breaks in exactly the same places, and the traces are real traces.

## Layout

```
src/
  tracing/     the trace model: nodes, $ai_* properties, cost, the recorder
  llm/         Anthropic and OpenAI clients (streamed, for real time-to-first-token), demo backend, model catalog
  agent/       the ritual: the archive, the world, the four traced steps
  game/        the spirits, the three quests, act and score state
  rpg/         hand-authored sprites, the canvas renderer, the glade, movement
  ui/          the dialogue box and the screens around the game
```

`src/tracing/` is deliberately a small copy of how PostHog AI observability
models this. A trace holds spans and generations, and every node carries the
real `$ai_*` property names, so what a spirit tells you when you walk up to it
is what you would read in a production trace viewer.

The recorder runs on both days. The first day only draws fog over the circle.
The blindness is a missing view, never missing data, which is the whole point.

The art is hand-authored pixel data in `src/rpg/sprites.ts`, so there are no
external assets to license or load. `pnpm validate:sprites` checks that every
sprite is rectangular and uses only palette characters; it also runs on build.
