import { Octokit } from '@octokit/rest';
import type { AccessTokenResult, Installation, TokenOptions } from './types.js';

function createOctokitWithJwt(jwt: string, baseUrl: string): Octokit {
  return new Octokit({
    baseUrl,
    request: {
      headers: {
        authorization: `Bearer ${jwt}`,
      },
    },
  });
}

export async function getInstallation(
  jwt: string,
  owner: string,
  baseUrl: string,
): Promise<Installation> {
  const octokit = createOctokitWithJwt(jwt, baseUrl);

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
  jwt: string,
  installationId: number,
  options: TokenOptions,
  baseUrl: string,
): Promise<AccessTokenResult> {
  const octokit = createOctokitWithJwt(jwt, baseUrl);

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
