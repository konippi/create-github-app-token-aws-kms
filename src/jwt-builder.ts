import type { Signer } from './types.js';

const JWT_HEADER = '{"alg":"RS256","typ":"JWT"}';

/**
 * Encodes a string or Uint8Array to Base64url format.
 * @param input - The data to encode.
 * @returns Base64url-encoded string.
 */
function base64url(input: string | Uint8Array): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Creates a `createJwt` callback compatible with @octokit/auth-app's StrategyOptions.
 * Builds an RS256 JWT and delegates signing to the provided Signer.
 * @param signer - The signer to use for JWT signature generation.
 * @returns An async callback that produces a signed JWT and its expiration timestamp.
 */
export function createJwtCallback(
  signer: Signer,
): (
  appId: string | number,
  timeDifference?: number | undefined,
) => Promise<{ jwt: string; expiresAt: string }> {
  return async (appId, timeDifference) => {
    const now = Math.floor(Date.now() / 1000) + (timeDifference ?? 0);

    const header = base64url(JWT_HEADER);
    const payload = base64url(
      JSON.stringify({
        iss: String(appId),
        iat: now - 60,
        exp: now + 600,
      }),
    );

    const signingInput = `${header}.${payload}`;
    const message = new TextEncoder().encode(signingInput);
    const signatureBytes = await signer.sign(message);
    const signature = base64url(signatureBytes);

    const jwt = `${signingInput}.${signature}`;
    const expiresAt = new Date((now + 600) * 1000).toISOString();

    return { jwt, expiresAt };
  };
}
