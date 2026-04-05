import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { createJwtCallback } from './jwt-builder.js';
import type { AccessTokenResult, Installation, Signer, TokenOptions } from './types.js';

/**
 * Creates an Octokit instance configured with KMS-backed JWT signing via @octokit/auth-app.
 * @param appId - The GitHub App ID.
 * @param signer - The KMS signer for JWT signature generation.
 * @param baseUrl - The GitHub API base URL.
 * @returns A configured Octokit instance.
 */
export function createOctokitForApp(appId: string, signer: Signer, baseUrl: string): Octokit {
  return new Octokit({
    baseUrl,
    authStrategy: createAppAuth,
    auth: {
      appId,
      createJwt: createJwtCallback(signer),
    },
  });
}

/**
 * Finds the GitHub App installation for the given owner.
 * @param octokit - The Octokit instance authenticated as the GitHub App.
 * @param owner - The organization or user login to find the installation for.
 * @returns The matching installation metadata.
 */
export async function getInstallation(octokit: Octokit, owner: string): Promise<Installation> {
  try {
    const response = await octokit.rest.apps.getUserInstallation({
      username: owner,
    });

    return {
      id: response.data.id,
      appSlug: response.data.app_slug,
      account:
        response.data.account && 'login' in response.data.account
          ? response.data.account.login
          : owner,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      throw new Error(
        `No installation found for owner "${owner}". Verify the GitHub App is installed on this organization/user.`,
      );
    }
    throw error;
  }
}

/**
 * Creates a scoped installation access token with the specified repositories and permissions.
 * @param octokit - The Octokit instance authenticated as the GitHub App.
 * @param installationId - The installation ID to create the token for.
 * @param options - The repositories and permissions to scope the token to.
 * @returns The created access token and its metadata.
 */
export async function createAccessToken(
  octokit: Octokit,
  installationId: number,
  options: TokenOptions,
): Promise<AccessTokenResult> {
  const response = await octokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
    ...(options.repositories.length > 0 && {
      repositories: [...options.repositories],
    }),
    permissions: { ...options.permissions },
  });

  return {
    token: response.data.token,
    expiresAt: response.data.expires_at,
    permissions: (response.data.permissions ?? {}) as Record<string, string>,
  };
}

/**
 * Revokes an installation access token. Uses the token itself for authentication.
 * @param token - The installation access token to revoke.
 * @param baseUrl - The GitHub API base URL.
 */
export async function revokeAccessToken(token: string, baseUrl: string): Promise<void> {
  const octokit = new Octokit({
    baseUrl,
    auth: token,
  });

  await octokit.rest.apps.revokeInstallationAccessToken();
}
