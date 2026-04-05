import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setSecret: vi.fn(),
  setOutput: vi.fn(),
  saveState: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('../src/inputs.js', () => ({
  parseInputs: vi.fn(),
}));

vi.mock('../src/kms-signer.js', () => {
  const formatError = vi.fn((error: unknown, _keyId: string) =>
    error instanceof Error ? error.message : String(error),
  );
  return {
    KmsSigner: vi.fn().mockImplementation(() => ({ sign: vi.fn() })),
    formatError,
  };
});

vi.mock('../src/github-client.js', () => ({
  createOctokitForApp: vi.fn().mockReturnValue({}),
  getInstallation: vi.fn(),
  createAccessToken: vi.fn(),
}));

import * as core from '@actions/core';
import { createAccessToken, getInstallation } from '../src/github-client.js';
import { parseInputs } from '../src/inputs.js';
import { KmsSigner } from '../src/kms-signer.js';

const mockParseInputs = vi.mocked(parseInputs);
const mockGetInstallation = vi.mocked(getInstallation);
const mockCreateAccessToken = vi.mocked(createAccessToken);

const defaultInputs = {
  appId: '123456',
  kmsKeyId: 'alias/my-key',
  owner: 'test-org',
  repositories: ['test-repo'] as readonly string[],
  githubApiUrl: 'https://api.github.com',
  skipTokenRevoke: false,
  permissions: { contents: 'read' } as Readonly<Record<string, string>>,
};

const defaultInstallation = {
  id: 42,
  appSlug: 'my-app',
  account: 'test-org',
};

const defaultTokenResult = {
  token: 'ghs_test123',
  expiresAt: '2025-01-01T01:00:00Z',
  permissions: { contents: 'read' } as Readonly<Record<string, string>>,
};

async function runMain(): Promise<void> {
  vi.resetModules();
  vi.doMock('@actions/core', () => ({
    getInput: vi.mocked(core.getInput),
    getBooleanInput: vi.mocked(core.getBooleanInput),
    setSecret: vi.mocked(core.setSecret),
    setOutput: vi.mocked(core.setOutput),
    saveState: vi.mocked(core.saveState),
    setFailed: vi.mocked(core.setFailed),
    info: vi.mocked(core.info),
    warning: vi.mocked(core.warning),
  }));
  vi.doMock('../src/inputs.js', () => ({ parseInputs: mockParseInputs }));
  vi.doMock('../src/kms-signer.js', () => ({
    KmsSigner: vi.mocked(KmsSigner),
  }));
  vi.doMock('../src/github-client.js', () => ({
    createOctokitForApp: vi.fn().mockReturnValue({}),
    getInstallation: mockGetInstallation,
    createAccessToken: mockCreateAccessToken,
  }));
  const { default: promise } = await import('../src/main.js');
  await promise;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(core.getInput).mockReturnValue('alias/my-key');
  mockParseInputs.mockReturnValue({ ...defaultInputs });
  mockGetInstallation.mockResolvedValue({ ...defaultInstallation });
  mockCreateAccessToken.mockResolvedValue({ ...defaultTokenResult });
});

describe('main', () => {
  it('creates token and sets outputs on success', async () => {
    await runMain();

    expect(core.setSecret).toHaveBeenCalledWith('ghs_test123');
    expect(core.setOutput).toHaveBeenCalledWith('token', 'ghs_test123');
    expect(core.setOutput).toHaveBeenCalledWith('installation-id', '42');
    expect(core.setOutput).toHaveBeenCalledWith('app-slug', 'my-app');
    expect(core.info).toHaveBeenCalledWith('Token created successfully');
  });

  it('saves state when skipTokenRevoke is false', async () => {
    await runMain();

    expect(core.saveState).toHaveBeenCalledWith('token', 'ghs_test123');
    expect(core.saveState).toHaveBeenCalledWith('expiresAt', '2025-01-01T01:00:00Z');
  });

  it('does not save state when skipTokenRevoke is true', async () => {
    mockParseInputs.mockReturnValue({ ...defaultInputs, skipTokenRevoke: true });

    await runMain();

    expect(core.saveState).not.toHaveBeenCalled();
  });

  it('calls setFailed on error', async () => {
    mockGetInstallation.mockRejectedValue(new Error('Installation not found'));

    await runMain();

    expect(core.setFailed).toHaveBeenCalled();
  });
});
