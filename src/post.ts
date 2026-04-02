import * as core from '@actions/core';
import { revokeAccessToken } from './github-client.js';

async function run(): Promise<void> {
  const skipTokenRevoke = core.getBooleanInput('skip-token-revoke');
  if (skipTokenRevoke) {
    core.info('Token revocation was skipped (skip-token-revoke is true)');
    return;
  }

  const token = core.getState('token');
  if (!token) {
    core.info('No token to revoke');
    return;
  }

  // Re-mask the token in the post step process
  core.setSecret(token);

  const expiresAt = core.getState('expiresAt');
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    core.info('Token already expired, skipping revocation');
    return;
  }

  const githubApiUrl = core.getInput('github-api-url') || 'https://api.github.com';

  try {
    await revokeAccessToken(token, githubApiUrl);
    core.info('Token revoked successfully');
  } catch (error) {
    // Warning, not setFailed — don't fail the job over cleanup
    core.warning(
      `Token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}. The token will expire automatically within 1 hour.`,
    );
  }
}

run().catch((error: unknown) => {
  core.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
});
