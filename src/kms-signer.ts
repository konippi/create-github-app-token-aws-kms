import { KMSClient, KMSServiceException, SignCommand } from '@aws-sdk/client-kms';
import type { Signer } from './types.js';

/** AWS KMS-backed signer that delegates signing to the KMS Sign API. */
export class KmsSigner implements Signer {
  readonly #client: KMSClient;
  readonly #keyId: string;

  /**
   * @param keyId - KMS key ID, key ARN, alias name, or alias ARN.
   * @param client - Optional KMS client instance (for testing).
   */
  constructor(keyId: string, client?: KMSClient) {
    this.#keyId = keyId;
    this.#client = client ?? new KMSClient();
  }

  /**
   * Signs a message using RSASSA_PKCS1_V1_5_SHA_256 with MessageType RAW.
   * @param message - The raw message bytes to sign.
   * @returns The raw signature bytes from KMS.
   */
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

  /**
   * Formats a KMS error into a user-friendly message with actionable guidance.
   * @param error - The caught error (may be KMSServiceException or generic Error).
   * @param keyId - The KMS key identifier, included in the message for context.
   * @returns A human-readable error message.
   */
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
