export class LLMError extends Error {
  readonly statusCode?: number
  readonly retryable: boolean

  constructor(
    message: string,
    statusCode?: number,
    retryable = false,
  ) {
    super(message)
    this.name = 'LLMError'
    this.statusCode = statusCode
    this.retryable = retryable
  }
}

export class AuthenticationError extends LLMError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, false)
    this.name = 'AuthenticationError'
  }
}

export class RateLimitError extends LLMError {
  constructor(message = 'Rate limit exceeded. Retrying...') {
    super(message, 429, true)
    this.name = 'RateLimitError'
  }
}

export class ProviderError extends LLMError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode, statusCode >= 500)
    this.name = 'ProviderError'
  }
}

export class NetworkError extends LLMError {
  constructor(message = 'Network request failed') {
    super(message, undefined, true)
    this.name = 'NetworkError'
  }
}

export class AbortError extends LLMError {
  constructor(message = 'Request was aborted') {
    super(message, undefined, false)
    this.name = 'AbortError'
  }
}

export class ValidationError extends LLMError {
  constructor(message: string) {
    super(message, undefined, false)
    this.name = 'ValidationError'
  }
}

export function mapHttpStatusToError(status: number, body?: string): LLMError {
  switch (status) {
    case 401:
    case 403:
      return new AuthenticationError(body || `HTTP ${status}`)
    case 429:
      return new RateLimitError(body || 'Rate limit exceeded')
    default:
      return new ProviderError(body || `HTTP ${status}`, status)
  }
}
