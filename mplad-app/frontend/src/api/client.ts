// src/api/client.ts
const TIMEOUT_MS = 10000;

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(id);
    
    if (!response.ok) {
      window.dispatchEvent(new CustomEvent('api-toast', { detail: { message: `Error: ${response.status} ${response.statusText}`, type: 'error' } }));
      console.error(`API Error: ${response.status} on ${endpoint}`);
      throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      window.dispatchEvent(new CustomEvent('api-toast', { detail: { message: 'Request timed out.', type: 'error' } }));
      throw new Error('Timeout');
    }
    console.error(`Fetch failed for ${endpoint}`, err);
    throw err;
  }
}
