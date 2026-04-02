import type { Signer } from './types.js';

const JWT_HEADER = '{"alg":"RS256","typ":"JWT"}';

function base64url(input: string | Uint8Array): string {
  return Buffer.from(input).toString('base64url');
}

export async function buildJwt(
  signer: Signer,
  appId: string,
  now: Date = new Date(),
): Promise<string> {
  const nowSeconds = Math.floor(now.getTime() / 1000);

  const header = base64url(JWT_HEADER);
  const payload = base64url(
    JSON.stringify({
      iss: appId,
      iat: nowSeconds - 60,
      exp: nowSeconds + 600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const message = new TextEncoder().encode(signingInput);
  const signatureBytes = await signer.sign(message);
  const signature = base64url(signatureBytes);

  return `${signingInput}.${signature}`;
}
