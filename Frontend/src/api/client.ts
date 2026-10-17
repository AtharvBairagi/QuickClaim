export class ApiError extends Error {
  public status: number;
  public isNetworkError: boolean;

  constructor(status: number, message: string, isNetworkError: boolean = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {};
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders = {
    ...defaultHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  // Ensure path starts with /api if relative endpoint passed like '/health' or '/products'
  const normalizedEndpoint = endpoint.startsWith('/api')
    ? endpoint
    : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(normalizedEndpoint, {
      ...options,
      credentials: 'include', // Automatically transmit HttpOnly session cookies
      headers: mergedHeaders,
    });
  } catch (networkErr: any) {
    throw new ApiError(
      0,
      networkErr?.message || 'Network error: Failed to connect to server',
      true
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let data: any = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      (typeof data === 'string' && data.length > 0 ? data : `Request failed with status ${response.status}`);

    throw new ApiError(response.status, errorMessage, false);
  }

  return (data !== null ? data : {}) as T;
}
