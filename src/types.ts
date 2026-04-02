export interface Signer {
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface Installation {
  readonly id: number;
  readonly appSlug: string;
  readonly account: string;
}

export interface TokenOptions {
  readonly repositories: readonly string[];
  readonly permissions: Readonly<Record<string, string>>;
}

export interface AccessTokenResult {
  readonly token: string;
  readonly expiresAt: string;
  readonly permissions: Readonly<Record<string, string>>;
}

export interface ActionInputs {
  readonly appId: string;
  readonly kmsKeyId: string;
  readonly owner: string;
  readonly repositories: readonly string[];
  readonly githubApiUrl: string;
  readonly skipTokenRevoke: boolean;
  readonly permissions: Readonly<Record<string, string>>;
}
