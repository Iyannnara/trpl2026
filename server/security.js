import { randomBytes, timingSafeEqual } from 'node:crypto';

export function normalizeName(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

export function issueCsrfToken(request, response) {
  if (!request.session.csrfToken) request.session.csrfToken = randomBytes(32).toString('hex');
  response.json({ csrfToken: request.session.csrfToken });
}

export function verifyCsrf(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const expected = request.session?.csrfToken;
  const supplied = request.get('x-csrf-token');
  if (!expected || !supplied) return response.status(403).json({ error: 'Permintaan tidak valid. Muat ulang halaman.' });
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return response.status(403).json({ error: 'Permintaan tidak valid. Muat ulang halaman.' });
  }
  return next();
}

export function requireAuth(request, response, next) {
  if (!request.session?.user) return response.status(401).json({ error: 'Silakan masuk untuk melanjutkan.' });
  return next();
}

export function requireAdmin(request, response, next) {
  if (request.session?.user?.role !== 'admin') return response.status(403).json({ error: 'Akses tidak diizinkan.' });
  return next();
}

export function currentUser(request) {
  const user = request.session.user;
  return { id: user.id, name: user.name, role: user.role };
}