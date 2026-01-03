// ============================================
// API CLIENT - Base Fetch Wrapper
// ============================================

const API_BASE = 'http://46.224.18.155:5555/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<TResponse>(
  endpoint: string,
  options?: RequestInit
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
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
