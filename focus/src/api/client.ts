// ============================================
// API CLIENT - Base Fetch Wrapper with Auth
// ============================================
//
// The auth token is resolved per-request via a provider registered by
// `useAuthSync`. We deliberately don't cache the token in a module
// variable: Clerk's `getToken()` already caches and refreshes
// transparently, and going through it on each request means a request
// issued right after the tab wakes from sleep can never carry an
// expired JWT.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5555/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ============================================
// TOKEN PROVIDER
// ============================================

type TokenProvider = () => Promise<string | null>

let tokenProvider: TokenProvider | null = null

export function setTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider
}

// ============================================
// FETCH WRAPPER
// ============================================

async function fetchApi<TResponse>(
  endpoint: string,
  options?: RequestInit
): Promise<TResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const token = tokenProvider ? await tokenProvider() : null
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...options,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.status}`)
  }

  // Handle empty responses
  const text = await response.text()
  if (!text) {
    return undefined as TResponse
  }

  return JSON.parse(text) as TResponse
}

// ============================================
// TYPED REQUEST HELPERS
// ============================================

export function get<TResponse>(endpoint: string): Promise<TResponse> {
  return fetchApi<TResponse>(endpoint, { method: 'GET' })
}

export function post<TRequest, TResponse>(
  endpoint: string,
  data: TRequest
): Promise<TResponse> {
  return fetchApi<TResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function put<TRequest, TResponse>(
  endpoint: string,
  data: TRequest
): Promise<TResponse> {
  return fetchApi<TResponse>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function patch<TRequest, TResponse>(
  endpoint: string,
  data: TRequest
): Promise<TResponse> {
  return fetchApi<TResponse>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function del<TResponse>(endpoint: string): Promise<TResponse> {
  return fetchApi<TResponse>(endpoint, { method: 'DELETE' })
}
