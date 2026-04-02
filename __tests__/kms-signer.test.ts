import { KMSClient, KMSServiceException, SignCommand } from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KmsSigner } from '../src/kms-signer.js';

const kmsMock = mockClient(KMSClient);

beforeEach(() => {
  kmsMock.reset();
});

afterEach(() => {
  kmsMock.restore();
});

describe('KmsSigner', () => {
  it('returns signature bytes from KMS', async () => {
    const expectedSignature = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

    kmsMock.on(SignCommand).resolves({
      Signature: expectedSignature,
      KeyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
      SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
    });

    const signer = new KmsSigner('test-key-id');
    const result = await signer.sign(new TextEncoder().encode('test message'));

    expect(result).toEqual(expectedSignature);

    const calls = kmsMock.commandCalls(SignCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      KeyId: 'test-key-id',
      MessageType: 'RAW',
      SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
    });
  });

  it('throws when Signature is missing from response', async () => {
    kmsMock.on(SignCommand).resolves({
      KeyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key',
    });

    const signer = new KmsSigner('test-key-id');
    await expect(signer.sign(new TextEncoder().encode('test'))).rejects.toThrow(
      'KMS Sign response missing Signature field',
    );
  });

  it('propagates KMS errors', async () => {
    kmsMock.on(SignCommand).rejects(new Error('Access denied'));

    const signer = new KmsSigner('test-key-id');
    await expect(signer.sign(new TextEncoder().encode('test'))).rejects.toThrow('Access denied');
  });
});

describe('KmsSigner.formatError', () => {
  it('formats AccessDeniedException', () => {
    const err = new KMSServiceException({
      name: 'AccessDeniedException',
      $fault: 'client',
      $metadata: {},
      message: 'denied',
    });
    const msg = KmsSigner.formatError(err, 'my-key');
    expect(msg).toContain('KMS access denied');
    expect(msg).toContain('my-key');
  });

  it('formats NotFoundException', () => {
    const err = new KMSServiceException({
      name: 'NotFoundException',
      $fault: 'client',
      $metadata: {},
      message: 'not found',
    });
    const msg = KmsSigner.formatError(err, 'my-key');
    expect(msg).toContain('not found');
    expect(msg).toContain('my-key');
  });

  it('formats KMSInvalidStateException', () => {
    const err = new KMSServiceException({
      name: 'KMSInvalidStateException',
      $fault: 'client',
      $metadata: {},
      message: 'invalid state',
    });
    const msg = KmsSigner.formatError(err, 'my-key');
    expect(msg).toContain('not in a valid state');
  });

  it('formats DisabledException', () => {
    const err = new KMSServiceException({
      name: 'DisabledException',
      $fault: 'client',
      $metadata: {},
      message: 'disabled',
    });
    const msg = KmsSigner.formatError(err, 'my-key');
    expect(msg).toContain('disabled');
  });

  it('formats unknown KMS errors with name and message', () => {
    const err = new KMSServiceException({
      name: 'SomeOtherException',
      $fault: 'server',
      $metadata: {},
      message: 'something else',
    });
    const msg = KmsSigner.formatError(err, 'my-key');
    expect(msg).toContain('SomeOtherException');
    expect(msg).toContain('something else');
  });

  it('formats non-Error values', () => {
    const msg = KmsSigner.formatError('string error', 'my-key');
    expect(msg).toBe('string error');
  });

  it('formats generic Error', () => {
    const msg = KmsSigner.formatError(new Error('something broke'), 'my-key');
    expect(msg).toBe('something broke');
  });
});
