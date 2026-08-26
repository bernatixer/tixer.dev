import { ORDERS, policyDoc, productBySku, searchProducts } from './catalog'

export type ToolName = 'lookup_policy' | 'lookup_order' | 'check_stock'

export const TOOL_NAMES: ToolName[] = ['lookup_policy', 'lookup_order', 'check_stock']

export function parseToolName(raw: string): ToolName {
    const cleaned = raw.trim().toLowerCase()
    return TOOL_NAMES.find((name) => cleaned.includes(name)) ?? 'lookup_policy'
}

export class ToolHttpError extends Error {
    readonly httpStatus: number

    constructor(message: string, httpStatus: number) {
        super(message)
        this.name = 'ToolHttpError'
        this.httpStatus = httpStatus
    }
}

function findOrderId(text: string): string | null {
    const match = text.match(/\b[A-Z]-\d{4}\b/i)
    return match ? match[0].toUpperCase() : null
}

export function runTool(name: ToolName, query: string): string {
    if (name === 'lookup_order') {
        const orderId = findOrderId(query)
        const order = orderId ? ORDERS.find((candidate) => candidate.id === orderId) : undefined
        if (!order) {
            return 'ORDER NOT FOUND. Ask the customer for their order number.'
        }
        const product = productBySku(order.sku)
        return [
            `Order ${order.id}: ${order.status}`,
            `Placed ${order.placedOn} via ${order.carrier}`,
            `Item: ${product?.name ?? order.sku}`,
        ].join('\n')
    }

    if (name === 'check_stock') {
        return searchProducts(query)
            .map((product) => `${product.sku} ${product.name}: ${product.inStock} in stock`)
            .join('\n')
    }

    return searchProducts(query).map(policyDoc).join('\n\n')
}
