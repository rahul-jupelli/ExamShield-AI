import { supabase } from '../lib/supabase.js';

/**
 * Returns the current active Supabase session access token.
 */
export async function getAccessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch (err) {
    console.warn('[apiClient] Failed to retrieve session access token:', err);
    return null;
  }
}

/**
 * Secure fetch wrapper that injects the current Supabase access token in the
 * Authorization Bearer header, and handles 401 and 403 responses clearly.
 */
export async function apiFetch(url, options = {}) {
  const token = await getAccessToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resolvedUrl = typeof window === 'undefined' && url.startsWith('/')
    ? `http://localhost:${(typeof process !== 'undefined' && process.env?.PORT) || 3000}${url}`
    : url;

  const response = await fetch(resolvedUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    const errorMsg = data.error || 'Authentication required: session is missing, invalid, or expired.';
    const error = new Error(errorMsg);
    error.status = 401;
    throw error;
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    const errorMsg = data.error || 'Access denied: your staff role is not authorized for this operation.';
    const error = new Error(errorMsg);
    error.status = 403;
    throw error;
  }

  return response;
}
