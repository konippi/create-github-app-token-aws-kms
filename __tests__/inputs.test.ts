import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @actions/core before importing
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  warning: vi.fn(),
}));

import * as core from '@actions/core';
import { parseInputs } from '../src/inputs.js';

const getInput = vi.mocked(core.getInput);
const getBooleanInput = vi.mocked(core.getBooleanInput);

function setEnv(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    GITHUB_REPOSITORY: 'test-org/test-repo',
    GITHUB_REPOSITORY_OWNER: 'test-org',
    'INPUT_PERMISSION-CONTENTS': 'read',
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    process.env[key] = value;
  }
}

function clearEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('INPUT_PERMISSION-')) {
      delete process.env[key];
    }
  }
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_REPOSITORY_OWNER;
}

beforeEach(() => {
  vi.resetAllMocks();
  clearEnv();

  getInput.mockImplementation((name: string) => {
    const map: Record<string, string> = {
      'app-id': '123456',
      'kms-key-id': 'alias/my-key',
      owner: '',
      repositories: '',
      'github-api-url': 'https://api.github.com',
    };
    return map[name] ?? '';
  });
  getBooleanInput.mockReturnValue(false);
});

afterEach(() => {
  clearEnv();
});

describe('parseInputs', () => {
  it('defaults to current repository when owner and repositories are not set', () => {
    setEnv();
    const inputs = parseInputs();
    expect(inputs.owner).toBe('test-org');
    expect(inputs.repositories).toEqual(['test-repo']);
  });

  it('uses explicit owner when provided', () => {
    setEnv();
    getInput.mockImplementation((name: string) => {
      const map: Record<string, string> = {
        'app-id': '123456',
        'kms-key-id': 'alias/my-key',
        owner: 'other-org',
        repositories: '',
        'github-api-url': 'https://api.github.com',
      };
      return map[name] ?? '';
    });
    const inputs = parseInputs();
    expect(inputs.owner).toBe('other-org');
  });

  it('parses comma-separated repositories', () => {
    setEnv();
    getInput.mockImplementation((name: string) => {
      const map: Record<string, string> = {
        'app-id': '123456',
        'kms-key-id': 'alias/my-key',
        owner: 'my-org',
        repositories: 'repo-a, repo-b',
        'github-api-url': 'https://api.github.com',
      };
      return map[name] ?? '';
    });
    const inputs = parseInputs();
    expect(inputs.repositories).toEqual(['repo-a', 'repo-b']);
  });

  it('throws on invalid app-id', () => {
    setEnv();
    getInput.mockImplementation((name: string) => (name === 'app-id' ? 'abc' : ''));
    expect(() => parseInputs()).toThrow('Invalid app-id');
  });

  it('throws when no permissions are set', () => {
    process.env.GITHUB_REPOSITORY = 'test-org/test-repo';
    getInput.mockImplementation((name: string) => {
      const map: Record<string, string> = {
        'app-id': '123456',
        'kms-key-id': 'alias/my-key',
        owner: '',
        repositories: '',
        'github-api-url': '',
      };
      return map[name] ?? '';
    });
    expect(() => parseInputs()).toThrow('At least one permission-* input must be set');
  });

  it('throws on invalid permission level', () => {
    setEnv({ 'INPUT_PERMISSION-CONTENTS': 'invalid' });
    expect(() => parseInputs()).toThrow('Invalid permission level');
  });

  it('throws on repository with owner prefix', () => {
    setEnv();
    getInput.mockImplementation((name: string) => {
      if (name === 'repositories') return 'org/repo';
      if (name === 'app-id') return '123456';
      if (name === 'kms-key-id') return 'alias/my-key';
      if (name === 'owner') return 'my-org';
      return '';
    });
    expect(() => parseInputs()).toThrow('should be just the repo name');
  });

  it('warns when owner is set but no repositories specified', () => {
    setEnv();
    getInput.mockImplementation((name: string) => {
      const map: Record<string, string> = {
        'app-id': '123456',
        'kms-key-id': 'alias/my-key',
        owner: 'my-org',
        repositories: '',
        'github-api-url': 'https://api.github.com',
      };
      return map[name] ?? '';
    });
    parseInputs();
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('No repositories specified'));
  });

  it('throws when GITHUB_REPOSITORY is not available and no owner/repos set', () => {
    // No GITHUB_REPOSITORY env var, no owner/repos inputs
    process.env['INPUT_PERMISSION-CONTENTS'] = 'read';
    expect(() => parseInputs()).toThrow('GITHUB_REPOSITORY is not available');
  });
});
