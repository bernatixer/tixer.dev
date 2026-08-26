/**
 * Hand-authored pixel art. Each sprite is 16x16 characters mapped through
 * PALETTE. No external assets, so nothing to license or load.
 */

export const PALETTE: Record<string, string | null> = {
    '.': null,
    K: '#0a0a0a',
    A: '#BFFF00',
    D: '#6b8a00',
    W: '#F5F5F0',
    S: '#9a9a90',
    G: '#2f2f2f',
    g: '#565656',
    R: '#FF4444',
    O: '#FF9500',
    B: '#1a1a1a',
    C: '#4ECDC4',
}

export type Sprite = string[]

export const HERO_A: Sprite = [
    '................',
    '.....KKKKKK.....',
    '....KWWWWWWK....',
    '....KWKWWKWK....',
    '....KWWWWWWK....',
    '....KWSSSSWK....',
    '.....KWWWWK.....',
    '...KKKAAAAKKK...',
    '..KAAAAAAAAAAK..',
    '..KAAAAAAAAAAK..',
    '..KWAAAAAAAAWK..',
    '..KKAAAAAAAAKK..',
    '...KKAAAAAAKK...',
    '....KGGKKGGK....',
    '....KGGK.KGGK...',
    '....KKK...KKK...',
]

export const HERO_B: Sprite = [
    '................',
    '.....KKKKKK.....',
    '....KWWWWWWK....',
    '....KWKWWKWK....',
    '....KWWWWWWK....',
    '....KWSSSSWK....',
    '.....KWWWWK.....',
    '...KKKAAAAKKK...',
    '..KAAAAAAAAAAK..',
    '..KAAAAAAAAAAK..',
    '..KWAAAAAAAAWK..',
    '..KKAAAAAAAAKK..',
    '...KKAAAAAAKK...',
    '.....KGGKKGG....',
    '....KGGK..KGGK..',
    '...KKK.....KKK..',
]

export const CUSTOMER_A: Sprite = [
    '................',
    '.....KKKKKK.....',
    '....KSSSSSSK....',
    '....KSKSSKSK....',
    '....KSSSSSSK....',
    '....KSSKKSSK....',
    '.....KSSSSK.....',
    '...KKKOOOOKKK...',
    '..KOOOOOOOOOOK..',
    '..KOOOOOOOOOOK..',
    '..KSOOOOOOOOSK..',
    '..KKOOOOOOOOKK..',
    '...KKOOOOOOKK...',
    '....KGGKKGGK....',
    '....KGGK.KGGK...',
    '....KKK...KKK...',
]

export const CUSTOMER_B: Sprite = [
    '................',
    '................',
    '.....KKKKKK.....',
    '....KSSSSSSK....',
    '....KSKSSKSK....',
    '....KSSSSSSK....',
    '....KSSKKSSK....',
    '.....KSSSSK.....',
    '...KKKOOOOKKK...',
    '..KOOOOOOOOOOK..',
    '..KOOOOOOOOOOK..',
    '..KSOOOOOOOOSK..',
    '..KKOOOOOOOOKK..',
    '...KKOOOOOOKK...',
    '....KGGKKGGK....',
    '....KKK...KKK...',
]

/** The support agent, a terminal with a face. */
export const TERMINAL_A: Sprite = [
    '.KKKKKKKKKKKKKK.',
    '.KGGGGGGGGGGGGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGBAABBBBAABGK.',
    '.KGBAABBBBAABGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGBBBAAAABBBGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGGGGGGGGGGGGK.',
    '.KKKKKKKKKKKKKK.',
    '.....KGGGGK.....',
    '.....KGGGGK.....',
    '...KKKKKKKKKK...',
    '..KGGGGGGGGGGK..',
    '..KKKKKKKKKKKK..',
    '................',
]

export const TERMINAL_B: Sprite = [
    '.KKKKKKKKKKKKKK.',
    '.KGGGGGGGGGGGGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGBAAAAAAAABGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGBBBAAAABBBGK.',
    '.KGBBBBBBBBBBGK.',
    '.KGGGGGGGGGGGGK.',
    '.KKKKKKKKKKKKKK.',
    '.....KGGGGK.....',
    '.....KGGGGK.....',
    '...KKKKKKKKKK...',
    '..KGGGGGGGGGGK..',
    '..KKKKKKKKKKKK..',
    '................',
]

/** The way into the trace. Sealed while there is no telemetry. */
export const DOOR_SEALED: Sprite = [
    'KKKKKKKKKKKKKKKK',
    'KGGGGGGGGGGGGGGK',
    'KGKKKKKKKKKKKKGK',
    'KGKBBBBBBBBBBKGK',
    'KGKBRBBBBBBRBKGK',
    'KGKBBRBBBBRBBKGK',
    'KGKBBBRBBRBBBKGK',
    'KGKBBBBRRBBBBKGK',
    'KGKBBBBRRBBBBKGK',
    'KGKBBBRBBRBBBKGK',
    'KGKBBRBBBBRBBKGK',
    'KGKBRBBBBBBRBKGK',
    'KGKBBBBBBBBBBKGK',
    'KGKKKKKKKKKKKKGK',
    'KGGGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
]

export const DOOR_OPEN: Sprite = [
    'KKKKKKKKKKKKKKKK',
    'KAAAAAAAAAAAAAAK',
    'KAKKKKKKKKKKKKAK',
    'KAKBBBBBBBBBBKAK',
    'KAKBBBBBBBBBBKAK',
    'KAKBBBBAABBBBKAK',
    'KAKBBBAAAABBBKAK',
    'KAKBBAAAAAABBKAK',
    'KAKBBAAAAAABBKAK',
    'KAKBBBAAAABBBKAK',
    'KAKBBBBAABBBBKAK',
    'KAKBBBBBBBBBBKAK',
    'KAKBBBBBBBBBBKAK',
    'KAKKKKKKKKKKKKAK',
    'KAAAAAAAAAAAAAAK',
    'KKKKKKKKKKKKKKKK',
]

/** Retrieval: a shelf of documents. */
export const SHELF: Sprite = [
    '................',
    'KKKKKKKKKKKKKKKK',
    'KGGGGGGGGGGGGGGK',
    'KGKWKWKKWKWKKWGK',
    'KGKWKWKKWKWKKWGK',
    'KGKWKWKKWKWKKWGK',
    'KGGGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
    'KGGGGGGGGGGGGGGK',
    'KGKWKKWKWKKWKWGK',
    'KGKWKKWKWKKWKWGK',
    'KGKWKKWKWKKWKWGK',
    'KGGGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
    '..KK........KK..',
    '..KK........KK..',
]

/** A tool call: a machine with a status lamp. */
export const MACHINE: Sprite = [
    '................',
    '..KKKKKKKKKKKK..',
    '..KGGGGGGGGGGK..',
    '..KGKKKKKKKKGK..',
    '..KGKBBBBBBKGK..',
    '..KGKBAAAABKGK..',
    '..KGKBBBBBBKGK..',
    '..KGKKKKKKKKGK..',
    '..KGGGGGGGGGGK..',
    '..KGKAKGGKAKGK..',
    '..KGGGGGGGGGGK..',
    '..KKKKKKKKKKKK..',
    '...KGGKKKKGGK...',
    '...KKKK..KKKK...',
    '................',
    '................',
]

export const MACHINE_BROKEN: Sprite = [
    '.......R........',
    '..KKKKKRKKKKKK..',
    '..KGGGRRRGGGGK..',
    '..KGKKRKRKKKGK..',
    '..KGKBRBBBBKGK..',
    '..KGKBRRRRBKGK..',
    '..KGKBBRBBBKGK..',
    '..KGKKKRKKKKGK..',
    '..KGGGGRGGGGGK..',
    '..KGKRKGGKRKGK..',
    '..KGGGGGGGGGGK..',
    '..KKKKKKKKKKKK..',
    '...KGGKKKKGGK...',
    '...KKKK..KKKK...',
    '................',
    '................',
]

/** The ticket board you ship a fix from. */
export const BOARD: Sprite = [
    'KKKKKKKKKKKKKKKK',
    'KWWWWWWWWWWWWWWK',
    'KWKKKKWWKKKKKWWK',
    'KWWWWWWWWWWWWWWK',
    'KWKKKKKKWWKKKWWK',
    'KWWWWWWWWWWWWWWK',
    'KWKKKKKWWKKKKWWK',
    'KWWWWWWWWWWWWWWK',
    'KWKKKKKKKWWKKWWK',
    'KWWWWWWWWWWWWWWK',
    'KKKKKKKKKKKKKKKK',
    '.....KGGGGK.....',
    '.....KGGGGK.....',
    '...KKKKKKKKKK...',
    '...KGGGGGGGGK...',
    '...KKKKKKKKKK...',
]

/** A model call: a brazier whose flame is the tokens it burned. */
export const ORB: Sprite = [
    '................',
    '.......AA.......',
    '......AAAA......',
    '.....AAWWAA.....',
    '....AAWWWWAA....',
    '....AAWWWWAA....',
    '.....AAWWAA.....',
    '......AAAA......',
    '.......AA.......',
    '................',
    '......KGGK......',
    '.....KGGGGK.....',
    '....KGGGGGGK....',
    '....KKKKKKKK....',
    '................',
    '................',
]
