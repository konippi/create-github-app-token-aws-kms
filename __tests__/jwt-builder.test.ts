import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJwtCallback } from '../src/jwt-builder.js';
import type { Signer } from '../src/types.js';

const fakeSigner: Signer = {
  sign: async (_message: Uint8Array) => new Uint8Array([0x01, 0x02, 0x03]),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createJwtCallback', () => {
  it('produces a valid 3-part JWT string', async () => {
    const callback = createJwtCallback(fakeSigner);
    const { jwt } = await callback('12345');
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  it('encodes correct header', async () => {
    const callback = createJwtCallback(fakeSigner);
    const { jwt } = await callback('12345');
    const parts = jwt.split('.');
    const header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString());
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('encodes correct payload with iss, iat, exp', async () => {
    const callback = createJwtCallback(fakeSigner);
    const { jwt } = await callback('99999');
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString());

    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(payload.iss).toBe('99999');
    expect(payload.iat).toBe(nowSeconds - 60);
    expect(payload.exp).toBe(nowSeconds + 600);
  });

  it('applies timeDifference to iat and exp', async () => {
    const callback = createJwtCallback(fakeSigner);
    const { jwt } = await callback('12345', 30);
    const parts = jwt.split('.');
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString());

    const nowSeconds = Math.floor(Date.now() / 1000) + 30;
    expect(payload.iat).toBe(nowSeconds - 60);
    expect(payload.exp).toBe(nowSeconds + 600);
  });

  it('returns expiresAt as ISO string', async () => {
    const callback = createJwtCallback(fakeSigner);
    const { expiresAt } = await callback('12345');
    expect(new Date(expiresAt).toISOString()).toBe(expiresAt);
  });

  it('passes header.payload as UTF-8 bytes to signer', async () => {
    let capturedMessage: Uint8Array | undefined;
    const captureSigner: Signer = {
      sign: async (message: Uint8Array) => {
        capturedMessage = message;
        return new Uint8Array([0xff]);
      },
    };

    const callback = createJwtCallback(captureSigner);
    const { jwt } = await callback('12345');
    const [header, payload] = jwt.split('.');
    const expectedInput = `${header}.${payload}`;

    expect(capturedMessage).toBeDefined();
    expect(new TextDecoder().decode(capturedMessage)).toBe(expectedInput);
  });
});
