import { KMSClient, KMSServiceException, SignCommand } from '@aws-sdk/client-kms';
import type { Signer } from './types.js';

export class KmsSigner implements Signer {
  readonly #client: KMSClient;
  readonly #keyId: string;

  constructor(keyId: string, client?: KMSClient) {
    this.#keyId = keyId;
    this.#client = client ?? new KMSClient();
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const response = await this.#client.send(
      new SignCommand({
        KeyId: this.#keyId,
        Message: message,
        MessageType: 'RAW',
        SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      }),
    );

    if (!response.Signature) {
      throw new Error('KMS Sign response missing Signature field');
    }

    return response.Signature;
  }

  static formatError(error: unknown, keyId: string): string {
    if (!(error instanceof KMSServiceException)) {
      return error instanceof Error ? error.message : String(error);
    }

    switch (error.name) {
      case 'AccessDeniedException':
        return `KMS access denied for key ${keyId}. Verify the IAM role has kms:Sign permission and the key policy allows signing.`;
      case 'NotFoundException':
        return `KMS key ${keyId} not found. Verify the kms-key-id input and AWS region.`;
      case 'KMSInvalidStateException':
        return `KMS key ${keyId} is not in a valid state for signing. Ensure the key is Enabled with SIGN_VERIFY usage.`;
      case 'DisabledException':
        return `KMS key ${keyId} is disabled. Enable the key in the AWS console or via API.`;
      default:
        return `KMS error (${error.name}): ${error.message}`;
    }
  }
}
