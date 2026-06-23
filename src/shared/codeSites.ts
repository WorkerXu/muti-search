export const CODE_SITE_IDS = ['zread', 'deepwiki', 'codewiki'] as const;

export type CodeSiteId = (typeof CODE_SITE_IDS)[number];
export type NormalizedRepository = `${string}/${string}`;
export type CodeSitePartition<T extends CodeSiteId = CodeSiteId> = `persist:code-${T}`;

export type NormalizeRepositoryResult =
  | { ok: true; repository: NormalizedRepository }
  | { ok: false; errorMessage: string };

export type CodeSiteDefinition<T extends CodeSiteId = CodeSiteId> = Readonly<{
  id: T;
  name: string;
  origin: string;
  partition: CodeSitePartition<T>;
  buildUrl: (repository: NormalizedRepository) => string;
  matchesUrlForRepo: (url: string, repository: NormalizedRepository) => boolean;
}>;

const REPOSITORY_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

function buildPartition<T extends CodeSiteId>(siteId: T): CodeSitePartition<T> {
  return `persist:code-${siteId}` as CodeSitePartition<T>;
}

function parseRepositorySegments(owner: string, repo: string): NormalizedRepository | null {
  if (!REPOSITORY_SEGMENT_PATTERN.test(owner) || !REPOSITORY_SEGMENT_PATTERN.test(repo)) {
    return null;
  }

  const normalizedRepo = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
  if (!normalizedRepo || !REPOSITORY_SEGMENT_PATTERN.test(normalizedRepo)) {
    return null;
  }

  return `${owner}/${normalizedRepo}` as NormalizedRepository;
}

export function normalizeGitHubRepositoryInput(input: string): NormalizeRepositoryResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, errorMessage: '请输入 GitHub 仓库，例如 obra/superpowers' };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false, errorMessage: '仅支持 GitHub 仓库地址或 owner/repo' };
    }

    if (!GITHUB_HOSTS.has(parsed.hostname)) {
      return { ok: false, errorMessage: '仅支持 GitHub 仓库地址或 owner/repo' };
    }

    const [owner = '', repo = '', extra = ''] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repo) {
      return { ok: false, errorMessage: '请输入完整仓库名，格式如 owner/repo' };
    }
    if (extra && extra !== 'tree' && extra !== 'blob') {
      return { ok: false, errorMessage: '无法从该 GitHub 地址识别仓库' };
    }

    const repository = parseRepositorySegments(owner, repo);
    return repository
      ? { ok: true, repository }
      : { ok: false, errorMessage: '仓库 owner 或 repo 包含非法字符' };
  }

  const shorthandMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!shorthandMatch) {
    return { ok: false, errorMessage: '请输入完整仓库名，格式如 owner/repo' };
  }

  const repository = parseRepositorySegments(shorthandMatch[1], shorthandMatch[2]);
  return repository
    ? { ok: true, repository }
    : { ok: false, errorMessage: '仓库 owner 或 repo 包含非法字符' };
}

export const codeSites = Object.freeze([
  Object.freeze({
    id: 'zread',
    name: 'Zread',
    origin: 'https://zread.ai',
    partition: buildPartition('zread'),
    buildUrl: (repository: NormalizedRepository) => `https://zread.ai/${repository}`,
    matchesUrlForRepo: (url: string, repository: NormalizedRepository) =>
      new URL(url).href === `https://zread.ai/${repository}`
  }),
  Object.freeze({
    id: 'deepwiki',
    name: 'DeepWiki',
    origin: 'https://deepwiki.com',
    partition: buildPartition('deepwiki'),
    buildUrl: (repository: NormalizedRepository) => `https://deepwiki.com/${repository}`,
    matchesUrlForRepo: (url: string, repository: NormalizedRepository) =>
      new URL(url).href === `https://deepwiki.com/${repository}`
  }),
  Object.freeze({
    id: 'codewiki',
    name: 'CodeWiki',
    origin: 'https://codewiki.google',
    partition: buildPartition('codewiki'),
    buildUrl: (repository: NormalizedRepository) =>
      `https://codewiki.google/github.com/${repository}`,
    matchesUrlForRepo: (url: string, repository: NormalizedRepository) =>
      new URL(url).href === `https://codewiki.google/github.com/${repository}`
  })
] as const satisfies readonly CodeSiteDefinition[]);

export function getCodeSite(siteId: CodeSiteId): CodeSiteDefinition {
  const site = codeSites.find((item) => item.id === siteId);
  if (!site) {
    throw new Error(`Unknown code site id: ${siteId}`);
  }
  return site;
}

export function buildCodeSiteUrl(siteId: CodeSiteId, repository: NormalizedRepository): string {
  return getCodeSite(siteId).buildUrl(repository);
}

export function isAllowedCodeSiteWebviewConfig(src: string, partition: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  return codeSites.some((site) => {
    if (site.partition !== partition || parsed.origin !== site.origin) {
      return false;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const repository =
      site.id === 'codewiki'
        ? parseRepositorySegments(pathParts[1] ?? '', pathParts[2] ?? '')
        : parseRepositorySegments(pathParts[0] ?? '', pathParts[1] ?? '');

    if (!repository) {
      return false;
    }

    if (site.id === 'codewiki' && pathParts[0] !== 'github.com') {
      return false;
    }

    return site.matchesUrlForRepo(parsed.href, repository);
  });
}
