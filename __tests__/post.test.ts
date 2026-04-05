import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@actions/core', () => ({
  getBooleanInput: vi.fn(),
  getState: vi.fn(),
  getInput: vi.fn(),
  setSecret: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock('../src/github-client.js', () => ({
  revokeAccessToken: vi.fn(),
}));

import * as core from '@actions/core';
import { revokeAccessToken } from '../src/github-client.js';

const getBooleanInput = vi.mocked(core.getBooleanInput);
const getState = vi.mocked(core.getState);
const getInput = vi.mocked(core.getInput);
const mockRevoke = vi.mocked(revokeAccessToken);

// Import the post module to trigger run()
async function runPost(): Promise<void> {
  // Re-import to re-execute the module
  vi.resetModules();
  // Re-mock after resetModules
  vi.doMock('@actions/core', () => ({
    getBooleanInput,
    getState,
    getInput,
    setSecret: vi.mocked(core.setSecret),
    info: vi.mocked(core.info),
    warning: vi.mocked(core.warning),
    setFailed: vi.mocked(core.setFailed),
  }));
  vi.doMock('../src/github-client.js', () => ({
    revokeAccessToken: mockRevoke,
  }));
  const { default: promise } = await import('../src/post.js');
  await promise;
}

beforeEach(() => {
  vi.resetAllMocks();
  getInput.mockReturnValue('https://api.github.com');
});

describe('post step', () => {
  it('skips revocation when skip-token-revoke is true', async () => {
    getBooleanInput.mockReturnValue(true);
    getState.mockReturnValue('');

    await runPost();

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('skipped'));
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('skips revocation when no token in state', async () => {
    getBooleanInput.mockReturnValue(false);
    getState.mockReturnValue('');

    await runPost();

    expect(core.info).toHaveBeenCalledWith('No token to revoke');
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('re-masks token and revokes successfully', async () => {
    getBooleanInput.mockReturnValue(false);
    getState.mockImplementation((name: string) => {
      if (name === 'token') return 'ghs_test123';
      if (name === 'expiresAt') return new Date(Date.now() + 3600000).toISOString();
      return '';
    });
    mockRevoke.mockResolvedValue();

    await runPost();

    expect(core.setSecret).toHaveBeenCalledWith('ghs_test123');
    expect(mockRevoke).toHaveBeenCalledWith('ghs_test123', 'https://api.github.com');
    expect(core.info).toHaveBeenCalledWith('Token revoked successfully');
  });

  it('warns on revocation failure instead of failing', async () => {
    getBooleanInput.mockReturnValue(false);
    getState.mockImplementation((name: string) => {
      if (name === 'token') return 'ghs_test123';
      if (name === 'expiresAt') return new Date(Date.now() + 3600000).toISOString();
      return '';
    });
    mockRevoke.mockRejectedValue(new Error('API error'));

    await runPost();

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Token revocation failed'));
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('skips revocation when token is expired', async () => {
    getBooleanInput.mockReturnValue(false);
    getState.mockImplementation((name: string) => {
      if (name === 'token') return 'ghs_test123';
      if (name === 'expiresAt') return '2020-01-01T00:00:00Z';
      return '';
    });

    await runPost();

    expect(core.info).toHaveBeenCalledWith('Token already expired, skipping revocation');
    expect(mockRevoke).not.toHaveBeenCalled();
  });
});
