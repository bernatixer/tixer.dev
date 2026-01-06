// ============================================
// API CLIENT - Base Fetch Wrapper with Auth
// ============================================

// const API_BASE = 'http://localhost:5555/api'
const API_BASE = 'https://api.tixer.dev/api'

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
// TOKEN STORAGE
// ============================================

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
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

  // Add Authorization header if token is available
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
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
