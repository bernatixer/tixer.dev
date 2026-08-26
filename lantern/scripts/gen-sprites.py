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


FOLIAGE = "1GGgghhpP"
STONE = "ksssSSSw"

sprites = []


def add(name, grid, doc=None):
    sprites.append((name, [r if isinstance(r, str) else "".join(r) for r in grid], doc))


# ---------------- scenery ----------------
W, H = 32, 44
tree = [["." for _ in range(W)] for _ in range(H)]
blit(tree, canopy(32, 30, 15.5, 14, 15, 13.5, FOLIAGE, 3), 0, 0)
blit(tree, canopy(20, 16, 10, 8, 9.5, 7.5, FOLIAGE, 11, 0.18), 1, 2)
blit(tree, canopy(18, 14, 9, 7, 8.5, 6.5, FOLIAGE, 7, 0.2), 13, 12)
trunk = [["." for _ in range(W)] for _ in range(H)]
for y in range(25, 41):
    spread = int((y - 25) * 0.42)
    for x in range(14 - spread, 18 + spread):
        trunk[y][x] = "t"
    trunk[y][14 - spread] = "T"
    trunk[y][17 + spread - 1] = "T"
    if y % 4 == 1:
        trunk[y][16] = "u"
for x in range(6, 26):
    trunk[41][x] = "T"
blit(tree, trunk, 0, 0)
add("TREE", outline(tree), "A broadleaf, three clumps deep so it does not read as a lollipop.")

bush = [["." for _ in range(32)] for _ in range(20)]
blit(bush, canopy(32, 18, 16, 11, 15, 8, FOLIAGE, 5, 0.16), 0, 0)
blit(bush, canopy(16, 12, 8, 7, 7.5, 5.5, FOLIAGE, 21, 0.22), 2, 3)
add("BUSH", outline(bush))

rock = [["." for _ in range(32)] for _ in range(18)]
blit(rock, canopy(30, 16, 15, 10, 13, 6.5, STONE, 13, 0.1, rim="s"), 1, 0)
blit(rock, canopy(14, 10, 7, 6, 6.5, 4.5, STONE, 29, 0.14, rim="s"), 3, 2)
add("ROCK", outline(rock))

PETALS = ["M", "Y", "c", "m"]
flowers = [["." for _ in range(32)] for _ in range(18)]
for i, fx in enumerate((4, 12, 20, 27)):
    petal = PETALS[i % len(PETALS)]
    top = 4 + (i % 2) * 2
    for y in range(top + 4, 15):
        flowers[y][fx] = "g"
    flowers[14][fx - 1] = "G"
    flowers[14][fx + 1] = "G"
    for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        flowers[top + 1 + dy][fx + dx] = petal
    flowers[top + 1][fx] = "W"
    flowers[top][fx] = petal
    flowers[top + 2][fx] = petal
add("FLOWERS", outline(flowers))

tuft = [["." for _ in range(32)] for _ in range(12)]
rng = random.Random(9)
for x in range(2, 30, 3):
    height = rng.randint(3, 6)
    for y in range(11 - height, 11):
        tuft[y][x] = "g" if y > 11 - height + 1 else "h"
    tuft[11][x] = "G"
add("GRASS_TUFT", tuft, "Loose grass, scattered to break up the ground.")


def house(w, h, roof_h, wall_ramp, roof_ramp, door_x, windows, seed=1):
    rng = random.Random(seed)
    grid = [["." for _ in range(w)] for _ in range(h)]
    for y in range(roof_h, h - 1):
        for x in range(1, w - 1):
            t = (y - roof_h) / max(1, h - roof_h - 2)
            idx = min(len(wall_ramp) - 1, int((1 - t) * (len(wall_ramp) - 1) + rng.uniform(-0.4, 0.4)))
            grid[y][x] = wall_ramp[max(0, idx)]
    for y in range(roof_h):
        spread = int(w / 2 * (y + 1) / roof_h)
        for x in range(max(0, w // 2 - spread), min(w, w // 2 + spread)):
            grid[y][x] = roof_ramp[min(len(roof_ramp) - 1, y * len(roof_ramp) // roof_h)]
            if y % 3 == 2 and x % 4 == (y // 3) % 4:
                grid[y][x] = roof_ramp[0]
    for x in range(w):
        if grid[roof_h - 1][x] != ".":
            grid[roof_h - 1][x] = roof_ramp[0]
    for wx, wy in windows:
        for y in range(wy, wy + 5):
            for x in range(wx, wx + 6):
                grid[y][x] = "c" if (y - wy) in (1, 2) and (x - wx) in (1, 2, 3, 4) else "K"
        grid[wy + 2][wx + 3] = "b"
    for y in range(h - 10, h - 1):
        for x in range(door_x, door_x + 8):
            grid[y][x] = "T" if x in (door_x, door_x + 7) or y == h - 10 else "t"
    grid[h - 6][door_x + 6] = "Y"
    for x in range(w):
        grid[h - 1][x] = "K"
    return outline(grid)


add("HOUSE", house(40, 40, 15, "KTttuu", ["R", "R", "r", "r", "e"], 16, [(5, 20), (29, 20)]),
    "A townhouse. Tiled roof, timber walls, a light on inside.")
add("SHOP", house(44, 40, 14, "KsssSS", ["y", "Y", "Y", "e", "e"], 18, [(5, 19), (13, 19), (31, 19)], seed=6),
    "The wide-fronted one, which is the shop.")

sign = [["." for _ in range(24)] for _ in range(28)]
for y in range(2, 14):
    for x in range(2, 22):
        sign[y][x] = "u" if 3 <= y <= 12 and 3 <= x <= 20 else "t"
for y in range(5, 12, 3):
    for x in range(5, 19):
        sign[y][x] = "T"
for y in range(14, 25):
    sign[y][11] = "T"
    sign[y][12] = "t"
for x in range(8, 16):
    sign[25][x] = "T"
add("SIGNPOST", outline(sign))

fount = [["." for _ in range(40)] for _ in range(26)]
blit(fount, canopy(40, 20, 20, 13, 18, 8, STONE, 17, 0.03, rim="s"), 0, 4)
blit(fount, canopy(32, 14, 16, 8, 14, 5.5, "BBCCcc", 23, 0.03, rim="B"), 4, 7)
for y in range(0, 9):
    for x in range(18, 22):
        fount[y][x] = "S" if x in (18, 21) else "w"
for y in range(2, 7):
    fount[y][17] = "c"
    fount[y][22] = "c"
add("FOUNTAIN", outline(fount), "The middle of the square.")

# ---------------- townsfolk ----------------
# One body, recoloured. H hat, X hair, F face, C clothes, D trousers.
BODY = [
    "................................",
    "..........HHHHHHHHHH............",
    "........HHHHHHHHHHHHHH..........",
    ".......HHHHHHHHHHHHHHHH.........",
    "......KHHHHHHHHHHHHHHHHK........",
    ".....KHHHHHHHHHHHHHHHHHHK.......",
    "....KKKKKKKKKKKKKKKKKKKKKK......",
    "..........KXXXXXXXXK............",
    ".........KFFFFFFFFFFK...........",
    "........KFFFFFFFFFFFFK..........",
    "........KFFkFFFFFFkFFK..........",
    "........KFFFFFFFFFFFFK..........",
    "........KFFFFkkkkFFFFK..........",
    ".........KFFFFFFFFFFK...........",
    "..........KFFFFFFFFK............",
    "...........KKKKKKKK.............",
    "........KKKCCCCCCCCKKK..........",
    ".......KCCCCCCCCCCCCCCK.........",
    "......KCCCCCCCCCCCCCCCCK........",
    "......KCFCCCCCCCCCCCCFCK........",
    "......KCFCCCCDDDDCCCCFCK........",
    "......KCCCCCDDDDDDCCCCCK........",
    "......KCCCCCDDDDDDCCCCCK........",
    ".......KCCCCCCCCCCCCCCK.........",
    "........KCCCCCCCCCCCCK..........",
    "........KCCCCKKKKCCCCK..........",
    "........KDDDKK..KKDDDK..........",
    "........KDDDK....KDDDK..........",
    "........KDDDK....KDDDK..........",
    ".......KKDDDKK..KKDDDKK.........",
    ".......KnnnnnK..KnnnnnK.........",
    ".......KKKKKKK..KKKKKKK.........",
]

STRIDE = [
    "........KCCCCKKKKCCCCK..........",
    ".......KDDDKK......KKDDDK.......",
    ".......KDDDK........KDDDK.......",
    "......KKDDDK.........KDDDKK.....",
    "......KnnnnK.........KnnnnK.....",
    "......KKKKKK.........KKKKKK.....",
    "................................",
]


def person(name, hat, hair, face, cloth, trouser, doc=None):
    def paint(rows):
        return [
            row.replace("H", hat).replace("X", hair).replace("F", face)
            .replace("C", cloth).replace("D", trouser)
            for row in rows
        ]

    add(name + "_A", paint(BODY), doc)
    add(name + "_B", paint(BODY[:25] + STRIDE), None)


person("HERO", "A", "u", "W", "B", "n", "You.")
person("PELL", "B", "w", "S", "b", "B", "Pell, who has walked the harbour road for forty years.")
person("MARN", "O", "T", "W", "O", "y", "Marn, who keeps the inn and never uses one word where nine will do.")
person("KIP", "h", "Y", "W", "h", "G", "Kip, who is nine and certain about everything.")
person("ROW", "M", "K", "F", "M", "m", "Row, who keeps the ledgers and says when she does not know.")

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
