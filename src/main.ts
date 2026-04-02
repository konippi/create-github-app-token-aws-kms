import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    core.info('create-github-app-token-aws-kms');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
