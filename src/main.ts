import * as core from '@actions/core';
import { createAccessToken, createOctokitForApp, getInstallation } from './github-client.js';
import { parseInputs } from './inputs.js';
import { KmsSigner } from './kms-signer.js';

/**
 * Main entrypoint for the action.
 */
async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    // Create Octokit with KMS-backed JWT signing via @octokit/auth-app
    const signer = new KmsSigner(inputs.kmsKeyId);
    const octokit = createOctokitForApp(inputs.appId, signer, inputs.githubApiUrl);

    // Find installation for the specified owner
    const installation = await getInstallation(octokit, inputs.owner);
    core.info(
      `Found installation ${installation.id} for ${installation.account} (${installation.appSlug})`,
    );

    // Create scoped access token
    const result = await createAccessToken(octokit, installation.id, {
      repositories: inputs.repositories,
      permissions: inputs.permissions,
    });
    core.setSecret(result.token);

    // Set outputs
    core.setOutput('token', result.token);
    core.setOutput('installation-id', installation.id.toString());
    core.setOutput('app-slug', installation.appSlug);

    // Save state for post step cleanup
    if (!inputs.skipTokenRevoke) {
      core.saveState('token', result.token);
      core.saveState('expiresAt', result.expiresAt);
    }

    core.info('Token created successfully');
  } catch (error) {
    const message = KmsSigner.formatError(error, core.getInput('kms-key-id'));
    core.setFailed(message);
  }
}

// Export promise for testing
export default run().catch((error: unknown) => {
  core.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
});
