export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

const RAW_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('tripmates_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${BASE_URL}${cleanEndpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMsg = response.status === 404
      ? 'Backend service unreachable or route not found (HTTP 404). Please ensure the backend server is running on port 4000.'
      : `HTTP ${response.status}`;
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
