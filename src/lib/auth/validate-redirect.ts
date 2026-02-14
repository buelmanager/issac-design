const ALLOWED_PREFIXES = ['/admin', '/shop', '/simulator'];

export function validateRedirect(input: string | null | undefined, fallback = '/shop'): string {
  if (!input) return fallback;
  if (!input.startsWith('/')) return fallback;
  if (input.startsWith('//')) return fallback;
  if (input.includes('..')) return fallback;

  if (input === '/') return input;

  const isAllowed = ALLOWED_PREFIXES.some(p => input === p || input.startsWith(p + '/'));
  return isAllowed ? input : fallback;
}
