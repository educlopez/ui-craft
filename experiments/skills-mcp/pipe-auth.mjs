import { timingSafeEqual } from 'node:crypto';

export function verifyWorkerGreeting(greeting, secret) {
  const supplied = Buffer.from(greeting, 'utf8');
  const expected = Buffer.from(secret + '\n', 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
