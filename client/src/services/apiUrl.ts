// Keep authentication and the rest of the API on the page's origin. Vercel
// forwards /api to Render; the Vite development server proxies it locally.
export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('Invalid API path');
  return path;
}
