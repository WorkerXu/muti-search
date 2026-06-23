import { describe, expect, it } from 'vitest';
import {
  buildCodeSiteUrl,
  codeSites,
  getCodeSite,
  isAllowedCodeSiteWebviewConfig,
  normalizeGitHubRepositoryInput
} from '../../src/shared/codeSites';

describe('normalizeGitHubRepositoryInput', () => {
  it('accepts owner/repo shorthand', () => {
    expect(normalizeGitHubRepositoryInput('obra/superpowers')).toEqual({
      ok: true,
      repository: 'obra/superpowers'
    });
  });

  it('accepts canonical GitHub repository urls', () => {
    expect(normalizeGitHubRepositoryInput('https://github.com/obra/superpowers')).toEqual({
      ok: true,
      repository: 'obra/superpowers'
    });
    expect(normalizeGitHubRepositoryInput('https://github.com/obra/superpowers.git')).toEqual({
      ok: true,
      repository: 'obra/superpowers'
    });
  });

  it('accepts tree, blob, query, and hash repository urls', () => {
    expect(normalizeGitHubRepositoryInput('https://github.com/obra/superpowers/tree/main')).toEqual(
      {
        ok: true,
        repository: 'obra/superpowers'
      }
    );
    expect(
      normalizeGitHubRepositoryInput(
        'https://github.com/obra/superpowers/blob/main/README.md?plain=1#L1'
      )
    ).toEqual({
      ok: true,
      repository: 'obra/superpowers'
    });
  });

  it('rejects invalid repository inputs', () => {
    expect(normalizeGitHubRepositoryInput('')).toEqual({
      ok: false,
      errorMessage: '请输入 GitHub 仓库，例如 obra/superpowers'
    });
    expect(normalizeGitHubRepositoryInput('https://example.com/obra/superpowers')).toEqual({
      ok: false,
      errorMessage: '仅支持 GitHub 仓库地址或 owner/repo'
    });
    expect(normalizeGitHubRepositoryInput('obra')).toEqual({
      ok: false,
      errorMessage: '请输入完整仓库名，格式如 owner/repo'
    });
  });
});

describe('codeSites', () => {
  it('builds the three repository urls from one normalized repository', () => {
    expect(buildCodeSiteUrl('zread', 'obra/superpowers')).toBe(
      'https://zread.ai/obra/superpowers'
    );
    expect(buildCodeSiteUrl('deepwiki', 'obra/superpowers')).toBe(
      'https://deepwiki.com/obra/superpowers'
    );
    expect(buildCodeSiteUrl('codewiki', 'obra/superpowers')).toBe(
      'https://codewiki.google/github.com/obra/superpowers'
    );
  });

  it('derives a dedicated persistent partition for every code site', () => {
    expect(codeSites.map((site) => site.partition)).toEqual([
      'persist:code-zread',
      'persist:code-deepwiki',
      'persist:code-codewiki'
    ]);
    expect(getCodeSite('deepwiki').partition).toBe('persist:code-deepwiki');
  });

  it('allows only matching code site urls and partitions', () => {
    expect(
      isAllowedCodeSiteWebviewConfig(
        'https://deepwiki.com/obra/superpowers',
        'persist:code-deepwiki'
      )
    ).toBe(true);
    expect(
      isAllowedCodeSiteWebviewConfig(
        'https://deepwiki.com/obra/superpowers/tree/main',
        'persist:code-deepwiki'
      )
    ).toBe(false);
    expect(
      isAllowedCodeSiteWebviewConfig(
        'https://deepwiki.com/obra/superpowers',
        'persist:code-zread'
      )
    ).toBe(false);
  });
});
