// Every sprite must be rectangular and use only palette characters.
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/rpg/sprites.ts', import.meta.url), 'utf8')

const paletteBlock = source.slice(source.indexOf('PALETTE'), source.indexOf('export type Sprite'))
const keys = new Set([...paletteBlock.matchAll(/^\s+'?([A-Za-z.])'?:/gm)].map((match) => match[1]))

let failures = 0
const sprites = [...source.matchAll(/export const (\w+): Sprite = \[([\s\S]*?)\n\]/g)]

for (const [, name, body] of sprites) {
    const rows = [...body.matchAll(/'([^']*)'/g)].map((match) => match[1])
    const widths = new Set(rows.map((row) => row.length))
    if (widths.size !== 1) {
        console.error(`${name}: rows differ in width -> ${[...widths].join(', ')}`)
        failures += 1
    }
    rows.forEach((row, index) => {
        for (const char of row) {
            if (!keys.has(char)) {
                console.error(`${name}: row ${index} uses '${char}', which is not in the palette`)
                failures += 1
            }
        }
    })
}

console.log(`${sprites.length} sprites checked`)
if (failures) {
    console.error(`${failures} problems`)
    process.exit(1)
}
