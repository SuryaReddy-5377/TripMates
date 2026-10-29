export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;

// Connect directly to live Render backend by default so both Vercel & local development work seamlessly
const DEFAULT_API_BASE = 'https://tripmates-backend.onrender.com/api';
let RAW_BASE_URL = (envBaseUrl || DEFAULT_API_BASE).trim().replace(/\/+$/, '');

// Guarantee '/api' is present so routes like '/auth/login' map properly even if VITE_API_BASE_URL omitted it
if (!RAW_BASE_URL.endsWith('/api')) {
  RAW_BASE_URL = `${RAW_BASE_URL}/api`;
}
const BASE_URL = RAW_BASE_URL;

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('tripmates_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Prevent double '/api/api' if endpoint already included '/api'
  if (BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }

  const response = await fetch(`${BASE_URL}${cleanEndpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    if (response.status === 404) {
      errorMsg = 'Backend route not found (HTTP 404). Please ensure your Render backend service is awake and running.';
    } else if (response.status === 502 || response.status === 503 || response.status === 504) {
      errorMsg = 'Render backend is waking up (takes ~30-50s on free tier). Please try again in a moment.';
    }
    if (data && typeof data === 'object') {
      if (data.message) {
        errorMsg = data.message;
      } else if (data.error) {
        if (data.details && typeof data.details === 'object') {
          const fieldMsgs: string[] = [];
          for (const [k, v] of Object.entries(data.details)) {
            if (k === '_errors') continue;
            const errList = (v as any)?._errors;
            if (Array.isArray(errList) && errList.length > 0) {
              fieldMsgs.push(`${k}: ${errList.join(', ')}`);
            }
          }
          errorMsg = fieldMsgs.length > 0 ? `${data.error}: ${fieldMsgs.join('; ')}` : data.error;
        } else {
          errorMsg = data.error;
        }
      }
    }
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) => request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) => request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(url: string, body?: any) => request<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string) => request<T>(url, { method: 'DELETE' }),
};
