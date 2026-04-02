import * as core from '@actions/core';
import { createAccessToken, getInstallation } from './github-client.js';
import { parseInputs } from './inputs.js';
import { buildJwt } from './jwt-builder.js';
import { KmsSigner } from './kms-signer.js';

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();

    // Build JWT signed by KMS
    const signer = new KmsSigner(inputs.kmsKeyId);
    let jwt: string;
    try {
      jwt = await buildJwt(signer, inputs.appId);
    } catch (error) {
      throw new Error(KmsSigner.formatError(error, inputs.kmsKeyId));
    }
    core.setSecret(jwt);

    // Find installation for the specified owner
    const installation = await getInstallation(jwt, inputs.owner, inputs.githubApiUrl);
    core.info(
      `Found installation ${installation.id} for ${installation.account} (${installation.appSlug})`,
    );

    // Create scoped access token
    const result = await createAccessToken(
      jwt,
      installation.id,
      { repositories: inputs.repositories, permissions: inputs.permissions },
      inputs.githubApiUrl,
    );
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
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run().catch((error: unknown) => {
  core.setFailed(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
});
