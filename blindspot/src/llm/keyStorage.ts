const KEY_STORAGE = 'blindspot.apiKey'

/**
 * The key stays in this browser. Blindspot has no backend, so there is nowhere
 * else for it to go — every request is made from the page to the provider.
 */
export function loadKey(): string | null {
    try {
        return window.localStorage.getItem(KEY_STORAGE)
    } catch {
        return null
    }
}

export function saveKey(key: string): void {
    try {
        window.localStorage.setItem(KEY_STORAGE, key)
    } catch {
        // Private windows block storage. The key still works for this session.
    }
}
