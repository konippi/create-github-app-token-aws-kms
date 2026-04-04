import * as core from '@actions/core';
import type { ActionInputs } from './types.js';

const VALID_PERMISSION_LEVELS = new Set(['read', 'write', 'admin']);

function getPermissionsFromEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const permissions: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('INPUT_PERMISSION-')) continue;
    if (!value) continue;

    const permission = key.slice('INPUT_PERMISSION-'.length).toLowerCase().replaceAll(/-/g, '_');
    const level = value.trim().toLowerCase();

    if (!VALID_PERMISSION_LEVELS.has(level)) {
      throw new Error(
        `Invalid permission level for "${permission}": expected "read", "write", or "admin", got "${value}"`,
      );
    }

    permissions[permission] = level;
  }

  if (Object.keys(permissions).length === 0) {
    throw new Error(
      'At least one permission-* input must be set. This action requires explicit permission scoping for security.',
    );
  }

  return permissions;
}

export function parseInputs(): ActionInputs {
  const appId = core.getInput('app-id', { required: true }).trim();
  if (!/^[1-9]\d{0,9}$/.test(appId)) {
    throw new Error(`Invalid app-id: expected a positive integer, got "${appId}"`);
  }

  const kmsKeyId = core.getInput('kms-key-id', { required: true }).trim();
  if (!kmsKeyId) {
    throw new Error('kms-key-id is required');
  }

  const ownerInput = core.getInput('owner');
  const repositoriesRaw = core.getInput('repositories');

  let owner: string;
  let repositories: string[];

  if (!ownerInput && !repositoriesRaw) {
    const githubRepository = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = githubRepository.split('/');
    if (!repoOwner || !repoName) {
      throw new Error(
        'owner and repositories are not set, and GITHUB_REPOSITORY is not available. ' +
          'Either specify owner/repositories inputs or run in a GitHub Actions environment.',
      );
    }
    owner = repoOwner;
    repositories = [repoName];
  } else {
    owner = ownerInput || process.env.GITHUB_REPOSITORY_OWNER || '';
    if (!owner) {
      throw new Error('owner is required (or must be running in a GitHub Actions environment)');
    }

    repositories = repositoriesRaw
      ? repositoriesRaw
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter((x) => x !== '')
      : [];

    if (repositories.length === 0) {
      core.warning(
        'No repositories specified. The token will have access to all repositories the GitHub App can access.',
      );
    }
  }

  for (const repo of repositories) {
    if (repo.includes('/')) {
      throw new Error(`Repository "${repo}" should be just the repo name, not "owner/repo".`);
    }
  }

  const githubApiUrl = core.getInput('github-api-url') || 'https://api.github.com';
  const skipTokenRevoke = core.getBooleanInput('skip-token-revoke');
  const permissions = getPermissionsFromEnv(process.env);

  if (skipTokenRevoke) {
    core.warning(
      'skip-token-revoke is enabled. The token will remain valid for up to 1 hour and will not be automatically revoked.',
    );
  }

  return {
    appId,
    kmsKeyId,
    owner,
    repositories,
    githubApiUrl,
    skipTokenRevoke,
    permissions,
  };
}
