const KEY_STORAGE = 'questhog.apiKey'
/** The name the key was saved under before the game was called QuestHog. */
const KEY_STORAGE_OLD = 'lantern.apiKey'

/**
 * The key stays in this browser. QuestHog has no backend, so there is nowhere
 * else for it to go — every request is made from the page to the provider.
 */
export function loadKey(): string | null {
    try {
        return window.localStorage.getItem(KEY_STORAGE) ?? window.localStorage.getItem(KEY_STORAGE_OLD)
    } catch {
        return null
    }
}

export function saveKey(key: string): void {
    try {
        window.localStorage.setItem(KEY_STORAGE, key)
        window.localStorage.removeItem(KEY_STORAGE_OLD)
    } catch {
        // Private windows block storage. The key still works for this session.
    }
}
