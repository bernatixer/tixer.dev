export interface Product {
    sku: string
    name: string
    priceUsd: number
    returnWindowDays: number
    returnNotes: string
    inStock: number
}

export const PRODUCTS: Product[] = [
    {
        sku: 'HH-101',
        name: 'Enamel camp mug',
        priceUsd: 18,
        returnWindowDays: 30,
        returnNotes: 'Free return postage. We accept it used, as long as it is not chipped.',
        inStock: 214,
    },
    {
        sku: 'HH-104',
        name: 'Merino wool socks',
        priceUsd: 22,
        returnWindowDays: 14,
        returnNotes: 'Must be unworn with tags attached. Hygiene rules mean we cannot take worn socks back.',
        inStock: 0,
    },
    {
        sku: 'HH-118',
        name: 'Folding desk lamp',
        priceUsd: 64,
        returnWindowDays: 30,
        returnNotes: 'Return in the original box. We deduct $8 if the box is missing.',
        inStock: 31,
    },
    {
        sku: 'HH-122',
        name: 'Dot grid notebook',
        priceUsd: 14,
        returnWindowDays: 30,
        returnNotes: 'Free return postage while the seal is unbroken.',
        inStock: 502,
    },
]

export interface Order {
    id: string
    sku: string
    status: string
    placedOn: string
    carrier: string
}

export const ORDERS: Order[] = [
    { id: 'A-1128', sku: 'HH-101', status: 'delivered', placedOn: '2026-08-11', carrier: 'Rowan Post' },
    { id: 'A-1204', sku: 'HH-118', status: 'held at depot', placedOn: '2026-08-19', carrier: 'Rowan Post' },
    { id: 'A-1287', sku: 'HH-104', status: 'awaiting stock', placedOn: '2026-08-22', carrier: 'unassigned' },
]

export function productBySku(sku: string): Product | undefined {
    return PRODUCTS.find((product) => product.sku === sku)
}

export function policyDoc(product: Product): string {
    return [
        `SKU ${product.sku} — ${product.name} ($${product.priceUsd})`,
        `Return window: ${product.returnWindowDays} days from delivery.`,
        `Conditions: ${product.returnNotes}`,
    ].join('\n')
}

/** A deliberately naive keyword search, which is what most first retrievers are. */
export function searchProducts(query: string): Product[] {
    const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2)
    const scored = PRODUCTS.map((product) => {
        const haystack = `${product.sku} ${product.name}`.toLowerCase()
        const score = words.reduce((total, word) => (haystack.includes(word) ? total + 1 : total), 0)
        return { product, score }
    })
    const hits = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
    return hits.length > 0 ? hits.map((entry) => entry.product) : [PRODUCTS[0]]
}
