import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET;
const MAX_AGE_MS = 20 * 60 * 1000; // 20 min session, comfortably longer than the 10-min voting window

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (Date.now() > payload.exp) return null;
  return payload;
}

export function createSessionToken(voterId, email) {
  return sign({ voterId, email, exp: Date.now() + MAX_AGE_MS });
}

export function readSessionToken(token) {
  return verify(token);
}

export const SESSION_COOKIE = 'fv_session';
export const SESSION_MAX_AGE_S = Math.floor(MAX_AGE_MS / 1000);
