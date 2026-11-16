import { afterEach, expect, it, vi } from 'vitest';
import { apiUrl } from '../src/services/apiUrl';
import vercel from '../vercel.json';

afterEach(() => vi.unstubAllEnvs());

it('keeps sign-in and private resources on the page origin even with a legacy environment setting', () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
  expect(apiUrl('/api/v1/auth/login')).toBe('/api/v1/auth/login');
  expect(apiUrl('/api/v1/auth/me')).toBe('/api/v1/auth/me');
  expect(apiUrl('/api/v1/learning/modules?completed=true')).toBe('/api/v1/learning/modules?completed=true');
  expect(() => apiUrl('//evil.test')).toThrow();
});

it('forwards API calls to Render before the SPA fallback can consume them', () => {
  expect(vercel.rewrites).toEqual([
    { source: '/api/:path*', destination: 'https://disha360-cypher.onrender.com/api/:path*' },
    { source: '/(.*)', destination: '/index.html' },
  ]);
});
