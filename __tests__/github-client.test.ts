import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUserInstallation = vi.fn();
const mockCreateToken = vi.fn();
const mockRevoke = vi.fn();

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

vi.mock('@octokit/rest', () => {
  class MockOctokit {
    rest = {
      apps: {
        getUserInstallation: mockGetUserInstallation,
        createInstallationAccessToken: mockCreateToken,
        revokeInstallationAccessToken: mockRevoke,
      },
    };
  }
  return { Octokit: MockOctokit };
});

import { Octokit } from '@octokit/rest';
import { createAccessToken, getInstallation, revokeAccessToken } from '../src/github-client.js';

beforeEach(() => {
  vi.clearAllMocks();
});

function createMockOctokit(): Octokit {
  return new Octokit();
}

describe('getInstallation', () => {
  it('finds installation by owner', async () => {
    mockGetUserInstallation.mockResolvedValue({
      data: { id: 42, app_slug: 'my-app', account: { login: 'my-org' } },
    });

    const result = await getInstallation(createMockOctokit(), 'my-org');
    expect(result.id).toBe(42);
    expect(result.appSlug).toBe('my-app');
    expect(result.account).toBe('my-org');
    expect(mockGetUserInstallation).toHaveBeenCalledWith({ username: 'my-org' });
  });

  it('throws when installation not found', async () => {
    const error = new Error('Not Found');
    Object.assign(error, { status: 404 });
    mockGetUserInstallation.mockRejectedValue(error);

    await expect(getInstallation(createMockOctokit(), 'missing-org')).rejects.toThrow(
      'No installation found for owner "missing-org"',
    );
  });

  it('propagates non-404 errors', async () => {
    const error = new Error('Server Error');
    Object.assign(error, { status: 500 });
    mockGetUserInstallation.mockRejectedValue(error);

    await expect(getInstallation(createMockOctokit(), 'my-org')).rejects.toThrow('Server Error');
  });
});

describe('createAccessToken', () => {
  it('returns token data with repositories', async () => {
    mockCreateToken.mockResolvedValue({
      data: {
        token: 'ghs_test123',
        expires_at: '2025-01-01T01:00:00Z',
        permissions: { contents: 'read' },
      },
    });

    const result = await createAccessToken(createMockOctokit(), 42, {
      repositories: ['my-repo'],
      permissions: { contents: 'read' },
    });

    expect(result.token).toBe('ghs_test123');
    expect(result.expiresAt).toBe('2025-01-01T01:00:00Z');
    expect(result.permissions).toEqual({ contents: 'read' });
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({ repositories: ['my-repo'] }),
    );
  });

  it('omits repositories when array is empty', async () => {
    mockCreateToken.mockResolvedValue({
      data: {
        token: 'ghs_org_token',
        expires_at: '2025-01-01T01:00:00Z',
        permissions: { contents: 'read' },
      },
    });

    await createAccessToken(createMockOctokit(), 42, {
      repositories: [],
      permissions: { contents: 'read' },
    });

    const callArgs = mockCreateToken.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('repositories');
  });
});

describe('revokeAccessToken', () => {
  it('calls revokeInstallationAccessToken', async () => {
    mockRevoke.mockResolvedValue({ status: 204 });

    await revokeAccessToken('ghs_test123', 'https://api.github.com');
    expect(mockRevoke).toHaveBeenCalled();
  });
});
