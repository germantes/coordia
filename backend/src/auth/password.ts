import * as crypto from 'node:crypto';

// Node 24 provides Argon2id. Keep its parameters alongside the encoded hash.
const parameters = { memory: 65536, passes: 3, parallelism: 4, tagLength: 32 };
type Argon2 = (algorithm: string, options: Record<string, unknown>, callback: (error: Error | null, result: Buffer) => void) => void;
const argon2 = (crypto as unknown as { argon2: Argon2 }).argon2;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { ...parameters, message: password, nonce: salt }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const digest = await derive(password, salt);
  return `argon2id:m65536:t3:p4:${salt.toString('base64')}:${digest.toString('base64')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, memory, passes, parallelism, salt, digest] = encoded.split(':');
  if (algorithm !== 'argon2id' || memory !== 'm65536' || passes !== 't3' || parallelism !== 'p4' || !salt || !digest) return false;
  const actual = await derive(password, Buffer.from(salt, 'base64'));
  const expected = Buffer.from(digest, 'base64');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
