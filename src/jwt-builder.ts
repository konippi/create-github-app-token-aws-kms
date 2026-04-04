import type { Signer } from './types.js';

const JWT_HEADER = '{"alg":"RS256","typ":"JWT"}';

function base64url(input: string | Uint8Array): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Creates a `createJwt` callback compatible with @octokit/auth-app's StrategyOptions.
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
