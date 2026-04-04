import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { createJwtCallback } from './jwt-builder.js';
import type { AccessTokenResult, Installation, Signer, TokenOptions } from './types.js';

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

export async function getInstallation(octokit: Octokit, owner: string): Promise<Installation> {
  const installations = await octokit.paginate(octokit.rest.apps.listInstallations, {
    per_page: 100,
  });

  const installation = installations.find(
    (i) => i.account?.login?.toLowerCase() === owner.toLowerCase(),
  );

  if (!installation) {
    throw new Error(
      `No installation found for owner "${owner}". Verify the GitHub App is installed on this organization/user.`,
    );
  }

  return {
    id: installation.id,
    appSlug: installation.app_slug,
    account: installation.account?.login ?? owner,
  };
}

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

export async function revokeAccessToken(token: string, baseUrl: string): Promise<void> {
  const octokit = new Octokit({
    baseUrl,
    auth: token,
  });

  await octokit.rest.apps.revokeInstallationAccessToken();
}
