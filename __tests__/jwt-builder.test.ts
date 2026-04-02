import { describe, expect, it } from 'vitest';
import { buildJwt } from '../src/jwt-builder.js';
import type { Signer } from '../src/types.js';

const fakeSigner: Signer = {
  sign: async (_message: Uint8Array) => new Uint8Array([0x01, 0x02, 0x03]),
};

describe('buildJwt', () => {
  it('produces a valid 3-part JWT string', async () => {
    const jwt = await buildJwt(fakeSigner, '12345');
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  it('encodes correct header', async () => {
    const jwt = await buildJwt(fakeSigner, '12345');
    const parts = jwt.split('.');
    const header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString());
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('encodes correct payload with iss, iat, exp', async () => {
    const now = new Date('2025-01-01T00:00:00Z');
    const jwt = await buildJwt(fakeSigner, '99999', now);
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString());

    const nowSeconds = Math.floor(now.getTime() / 1000);
    expect(payload.iss).toBe('99999');
    expect(payload.iat).toBe(nowSeconds - 60);
    expect(payload.exp).toBe(nowSeconds + 600);
  });

  it('passes header.payload as UTF-8 bytes to signer', async () => {
    let capturedMessage: Uint8Array | undefined;
    const captureSigner: Signer = {
      sign: async (message: Uint8Array) => {
        capturedMessage = message;
        return new Uint8Array([0xff]);
      },
    };

    const jwt = await buildJwt(captureSigner, '12345');
    const [header, payload] = jwt.split('.');
    const expectedInput = `${header}.${payload}`;

    expect(capturedMessage).toBeDefined();
    expect(new TextDecoder().decode(capturedMessage)).toBe(expectedInput);
  });
});
