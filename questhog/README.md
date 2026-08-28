# QuestHog

A five minute game that teaches AI observability without ever using the words.

The last boat leaves at dusk and you do not know the way to the harbour. Four
people are out in the square. You ask each of them, they ask you something back,
and then you pick whose directions to follow.

Every one of those four is a **real language model with different instructions**.
Pell knows the road. Marn knows it too but buries it in nine sentences about her
cousin. Kip is nine and invents the whole thing with total confidence. Row says
plainly that she does not know and points you at Pell.

The game never tells you any of that.

## The turn

You pick someone and set off. Halfway down the road you realise you cannot
actually remember what the others said, only how they made you feel.

But you have your notebook, and you wrote all four down without thinking about
it. That is a **trace**: who was asked, what they were given, what came back, how
long it took, what it cost.

Then the game asks you what actually matters to you, and marks all four against
it for you. That is an **evaluation**.

And the part worth staying for: **change the question and the winner changes.**
Ask "did they answer?" and Kip tops the board with directions he made up. Ask
"were they telling the truth?" and he comes last. Your eval is only ever as good
as the question you thought to ask.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:3100
```

### One-off: fetch the art

The scenery uses the [Free Top-Down RPG 32x32 Tile Set by
Mixel](https://mixelslime.itch.io/free-top-down-rpg-32x32-tile-set). **Those
files are not in this repo and must not be committed.** The pack's licence
allows shipping the assets inside a built game but forbids redistributing them,
and a public repo is redistribution.

Download the pack, then:

```bash
mkdir -p questhog/public/tiles
cd "Top-Down RPG 32x32 by Mixel v1.7"
cp "Nature v1.5"/*.PNG "Nature v1.5"/*.png "Buildings v.1.1"/*.PNG <repo>/questhog/public/tiles/
cd <repo>/questhog/public/tiles
for f in *; do mv "$f" "$(echo "$f" | sed 's/Topdown RPG 32x32 - //; s/ /-/g; s/\.PNG$/.png/' | tr 'A-Z' 'a-z')"; done
```

`public/tiles/` is gitignored. The game runs without the pack, on flat colours,
so a fresh clone is not broken; it just looks plain. The hogs are ours and are
always there.

`web/` and `focus/` both use port 3000, so this one sits on 3100.

Arrow keys or WASD to walk, space to talk. Clicking anyone works too. There is a
chiptune loop with a toggle in the strip under the town.

## Bring your own key

The game opens on the town with one prompt over it: paste an OpenAI or an
Anthropic key. There is no model picker, because the cheap model for whichever
provider you brought is the right answer for a five minute game, and one more
decision there is one more reason to close the tab. The provider is read from
the prefix.

There is no backend, so the key never reaches a server of mine: it goes from
your browser straight to the provider and stays in `localStorage`. A full
playthrough is about a dozen short calls.

No key, no game. For working on it without spending anything, `?demo` in the URL
runs the same town against canned replies; everyone still goes wrong in
character and the scoring still works.

## Layout

```
src/
  tracing/     the record: nodes, $ai_* properties, cost, the recorder
  llm/         Anthropic and OpenAI clients, demo backend, model catalog
  agent/       talk.ts asks one person; judge.ts is the eval, a model marking every conversation against one rule
  game/        the four people, the criteria, one continuous run of state
  rpg/         generated sprites, the canvas renderer, the town, movement
  audio/       a chiptune loop generated in the browser
  ui/          the dialogue box, the notebook, the scoreboard
```

`src/tracing/` is a small copy of how PostHog AI observability models this, with
the real `$ai_*` property names on every node. The notebook is that data shown
as a notebook, because a trace viewer is the wrong thing to hand someone in the
first five minutes.

The townsfolk are hedgehogs, hand-drawn in `scripts/gen-sprites.py`, which
writes `src/rpg/sprites.ts`. One body, recoloured and given a cap or a scarf per
person. Run the script when they change; do not hand-edit the output.
`pnpm validate:sprites` checks every sprite is rectangular and uses only palette
characters, and build runs it too.

Everything else in the scene comes from the Mixel pack via `src/rpg/tiles.ts`,
which holds the exact rects measured off each sheet. The music is generated with
Web Audio, so there are no media files in the repo at all.
