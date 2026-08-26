"""Writes src/rpg/sprites.ts.

The scenery is generated so its shading stays consistent, and the townsfolk are
one hand-drawn body recoloured per person, so the town reads as a set. Run this
when the art changes; do not hand-edit the output.
"""
import math
import pathlib
import random

OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "rpg" / "sprites.ts"

PALETTE = [
    (".", "null", "transparent"),
    ("0", "'#171009'", "deepest outline"),
    ("K", "'#2e2216'", "outline"),
    ("k", "'#453422'", "soft outline"),
    ("1", "'#1f4a1a'", "deep foliage"),
    ("G", "'#2f6b24'", "foliage dark"),
    ("g", "'#47912f'", "foliage"),
    ("h", "'#63b241'", "foliage light"),
    ("p", "'#8ad25f'", "foliage highlight"),
    ("P", "'#b9e890'", "foliage pale"),
    ("n", "'#3a2917'", "dark earth"),
    ("T", "'#5c4126'", "bark dark"),
    ("t", "'#7d5a33'", "bark"),
    ("u", "'#a37c48'", "bark light"),
    ("s", "'#96866a'", "stone dark"),
    ("S", "'#c0ae8e'", "stone"),
    ("w", "'#ded4bd'", "stone light"),
    ("W", "'#f6efe2'", "white"),
    ("F", "'#e6e0cf'", "pale cloth"),
    ("R", "'#8f2c1f'", "roof dark"),
    ("r", "'#c1432f'", "roof"),
    ("e", "'#e2694b'", "roof light"),
    ("B", "'#3f6fa8'", "blue dark"),
    ("b", "'#5d93cc'", "blue"),
    ("c", "'#8fbde8'", "blue light"),
    ("C", "'#57a8d4'", "water"),
    ("Y", "'#e8b53f'", "gold"),
    ("y", "'#c1922c'", "gold dark"),
    ("O", "'#d8813a'", "orange"),
    ("M", "'#8f4f8c'", "purple"),
    ("m", "'#c98cc4'", "purple light"),
    ("A", "'#BFFF00'", "the journal's glow"),
    ("a", "'#7fae00'", "the glow, shaded"),
    ("q", "'#42301f'", "spines, deep"),
    ("Q", "'#5e4430'", "spines"),
    ("j", "'#7d5c3f'", "spines, lit"),
    ("x", "'#c2905f'", "snout and shade"),
    ("z", "'#e5bc8b'", "hog"),
    ("Z", "'#f4d9b4'", "hog, lit"),
]

LIGHT = (-0.55, -0.8)


def shade(nx, ny):
    return nx * LIGHT[0] + ny * LIGHT[1]


def canopy(w, h, cx, cy, rx, ry, ramp, seed, wobble=0.13, rim="G"):
    rng = random.Random(seed)
    grid = [["." for _ in range(w)] for _ in range(h)]
    for y in range(h):
        for x in range(w):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            d = math.hypot(nx, ny)
            edge = 1.0 + math.sin(math.atan2(ny, nx) * 5 + seed) * wobble
            if d > edge:
                continue
            lit = shade(nx, ny) * 0.9 + (edge - d) * 0.5 + rng.uniform(-0.16, 0.16)
            idx = min(len(ramp) - 1, max(0, int((lit + 1) / 2 * len(ramp))))
            grid[y][x] = ramp[idx]
            if d > edge - 0.13:
                grid[y][x] = rim
    return grid


def outline(grid, ink="K"):
    h, w = len(grid), len(grid[0])
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            if grid[y][x] != ".":
                continue
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and grid[yy][xx] not in (".", ink):
                    out[y][x] = ink
                    break
    return out


def blit(grid, other, ox, oy):
    for y, row in enumerate(other):
        for x, ch in enumerate(row):
            if ch == "." or not (0 <= oy + y < len(grid)) or not (0 <= ox + x < len(grid[0])):
                continue
            grid[oy + y][ox + x] = ch


sprites = []


def add(name, grid, doc=None):
    sprites.append((name, [r if isinstance(r, str) else "".join(r) for r in grid], doc))


def outline(grid, ink="K"):
    h, w = len(grid), len(grid[0])
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            if grid[y][x] != ".":
                continue
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and grid[yy][xx] not in (".", ink):
                    out[y][x] = ink
                    break
    return out


# The signpost stays ours, because it carries game text.
sign = [["." for _ in range(34)] for _ in range(30)]
for y in range(2, 18):
    for x in range(1, 33):
        sign[y][x] = "u" if 3 <= y <= 16 and 2 <= x <= 31 else "t"
for y in range(18, 27):
    sign[y][16] = "T"
    sign[y][17] = "t"
for x in range(12, 22):
    sign[27][x] = "T"
add("SIGNPOST", outline(sign), "Points the way out of town.")


# ---------------- the townsfolk, who are hogs ----------------
# Hand-drawn, because a face does not survive being computed. The spiny hood
# rings the face, which is what makes it read as a hedgehog at this size.
HOG_BASE = [
    "................................",
    "..........qqqqqqqqqq............",
    ".......qqQQQQQQQQQQQQqq.........",
    ".....qqQQQQQQQQQQQQQQQQQq.......",
    "....qQQQjjQQQQjjQQQQjjQQQq......",
    "...qQQQQQQQQQQQQQQQQQQQQQQq.....",
    "..qQQjjQQQQjjQQQQjjQQQQjjQQq....",
    "..qQQQQQQQQQQQQQQQQQQQQQQQQq....",
    ".qQQQQjjQQQQQQQQQQQQjjQQQQQQq...",
    ".qQQQQQQQKKKKKKKKKKQQQQQQQQQq...",
    ".qQQjjQQKZZZZZZZZZZKQQjjQQQQq...",
    ".qQQQQQKZZZZZZZZZZZZKQQQQQQQq...",
    ".qQQQQQKZZKKZZZZKKZZKQQQjjQQq...",
    ".qQQjjQKZZKKZZZZKKZZKQQQQQQQq...",
    ".qQQQQQKZZZZZZZZZZZZKQQQQQQQq...",
    "..qQQQQKZZZZxxxxZZZZKQQQQQQq....",
    "..qQQQQKZZZKxxxxKZZZKQQjjQQq....",
    "...qQQQKZZZZZZZZZZZZKQQQQQq.....",
    "....qQQQKZZZZZZZZZZKQQQQQq......",
    ".....qQQQKKKKKKKKKKQQQQQq.......",
    "......qQQQQQQQQQQQQQQQq.........",
    ".......KKzzzzzzzzzzzzKK.........",
    ".....KKzzzzzzzzzzzzzzzzKK.......",
    "....KzzzzzzzzzzzzzzzzzzzzK......",
    "...KzzxzzzzzzzzzzzzzzzzzzzK.....",
    "...KzzxzzzzzzzzzzzzzzzzzzzK.....",
    "...KzzxzzzzzzzzzzzzzzzzzzzK.....",
    "...KzzzzzzzzzzzzzzzzzzzzzzK.....",
    "....KzzzzzzzzzzzzzzzzzzzzK......",
    ".....KKzzzzzzzzzzzzzzzzKK.......",
    ".......KKxxxK....KxxxKK.........",
    "........KKKK......KKKK..........",
]

# The other foot forward, so walking reads.
HOG_STRIDE = [
    ".....KKzzzzzzzzzzzzzzzzKK.......",
    "......KxxxK........KxxxK........",
    ".....KKxxxKK......KKxxxKK.......",
    ".....KKKKKK........KKKKKK.......",
]


def dress(base, overlays):
    grid = [list(row) for row in base]
    for rows, ox, oy in overlays:
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != "." and 0 <= oy + y < len(grid) and 0 <= ox + x < len(grid[0]):
                    grid[oy + y][ox + x] = ch
    return ["".join(row) for row in grid]


def cap(main, trim):
    """Sits over the spines, which is how you tell one hog from another."""
    rows = [
        "....MMMMMMMM....",
        "..MMMMMMMMMMMM..",
        ".MMMMMMMMMMMMMM.",
        "KTTTTTTTTTTTTTTK",
    ]
    return ([row.replace("M", main).replace("T", trim) for row in rows], 8, 1)


def scarf(colour):
    rows = [
        "CCCCCCCCCCCCCCCCCCCC",
        "CCCCCCCCCCCCCCCCCCCC",
        "..CCCCCC....CCCCCC..",
    ]
    return ([row.replace("C", colour) for row in rows], 6, 20)


SPECS = (
    [
        ".KKKK...KKKK.",
        "KWWWWK.KWWWWK",
        "KWWWWK.KWWWWK",
        ".KKKK...KKKK.",
    ],
    9,
    11,
)


def hog(name, overlays, doc=None):
    add(name + "_A", dress(HOG_BASE, overlays), doc)
    add(name + "_B", dress(HOG_BASE[:28] + HOG_STRIDE, overlays), None)


hog("HERO", [cap("A", "a")], "You. The one in the bright green cap.")
hog("PELL", [cap("W", "B")], "Pell, who has walked the harbour road for forty years.")
hog("MARN", [scarf("O")], "Marn, who keeps the inn and never uses one word where nine will do.")
hog("KIP", [cap("r", "R")], "Kip, who is nine and certain about everything.")
hog("ROW", [scarf("M"), SPECS], "Row, who keeps the ledgers and says when she does not know.")

# ---------------- write ----------------
lines = [
    "/**",
    " * Generated by scripts/gen-sprites.py. Do not hand-edit.",
    " *",
    " * The scenery is generated so its shading stays consistent, and the townsfolk",
    " * are one hand-drawn body recoloured per person, so the town reads as a set.",
    " */",
    "",
    "export const PALETTE: Record<string, string | null> = {",
]
for key, value, note in PALETTE:
    # Every key is quoted, so digits and punctuation are valid property names.
    lines.append(f"    '{key}': {value}, // {note}")
lines.append("}")
lines.append("")
lines.append("export type Sprite = string[]")
lines.append("")
for name, rows, doc in sprites:
    if doc:
        lines.append(f"/** {doc} */")
    lines.append(f"export const {name}: Sprite = [")
    for row in rows:
        lines.append(f"    '{row}',")
    lines.append("]")
    lines.append("")
OUT.write_text("\n".join(lines))
print(f"wrote {OUT} with {len(sprites)} sprites")
