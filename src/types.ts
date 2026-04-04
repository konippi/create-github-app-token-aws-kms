/** Interface for signing raw message bytes. */
export interface Signer {
  /**
   * @param message - The raw message bytes to sign.
   * @returns The raw signature bytes.
   */
  sign(message: Uint8Array): Promise<Uint8Array>;
}

/** Metadata for a GitHub App installation. */
export interface Installation {
  readonly id: number;
  readonly appSlug: string;
  readonly account: string;
}

/** Options for scoping an installation access token. */
export interface TokenOptions {
  readonly repositories: readonly string[];
  readonly permissions: Readonly<Record<string, string>>;
}

/** Result of creating an installation access token. */
export interface AccessTokenResult {
  readonly token: string;
  readonly expiresAt: string;
  readonly permissions: Readonly<Record<string, string>>;
}

/** Validated action inputs parsed from the GitHub Actions environment. */
export interface ActionInputs {
  readonly appId: string;
  readonly kmsKeyId: string;
  readonly owner: string;
  readonly repositories: readonly string[];
  readonly githubApiUrl: string;
  readonly skipTokenRevoke: boolean;
  readonly permissions: Readonly<Record<string, string>>;
}
