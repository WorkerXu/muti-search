---
change: add-code-repository-tab
design-doc: docs/superpowers/specs/2026-06-23-code-repository-tab-design.md
base-ref: 64aeb239b6c5501cc82cd8c8810f354b90a1964d
---

# 代码仓库 Tab 实施计划

> **面向代理执行者：** REQUIRED SUB-SKILL: 使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项实施本计划。所有步骤使用复选框 `- [ ]` 语法追踪。

**Goal:** 把 `代码` Tab 从本地占位区升级为 GitHub 仓库阅读工作流，支持输入仓库后同时加载 Zread、DeepWiki、CodeWiki，并通过共享规则保证主进程白名单与渲染层导航行为一致。

**Architecture:** 新增 `src/shared/codeSites.ts` 作为代码仓库路由的唯一规则源，集中定义站点元数据、仓库归一化、目标 URL 构造和代码站点 WebView 安全校验。`src/main/main.ts` 继续负责 `will-attach-webview` 安全阻断，但把代码站点判定委托给共享模块；`src/renderer/app.ts` 只维护代码 Tab 的输入、状态和延迟导航，不复制任何 URL 规则。

**Tech Stack:** TypeScript、Electron 39、Vite 7、Vitest 4、原生 DOM 渲染、CSS Grid

## Global Constraints

- 共享规则唯一来源必须是 `src/shared/codeSites.ts`，不要把仓库解析、URL 拼装或 partition 规则散落到 `main` 或 `renderer`。
- 仓库输入只接受 `owner/repo` 或 GitHub URL，归一化结果必须是 `owner/repo`，并保留用户输入中的大小写。
- 三个代码站点 URL 规则固定为 `https://zread.ai/{owner}/{repo}`、`https://deepwiki.com/{owner}/{repo}`、`https://codewiki.google/github.com/{owner}/{repo}`。
- 三个代码站点 partition 固定为 `persist:code-zread`、`persist:code-deepwiki`、`persist:code-codewiki`，不得与现有搜索站点共享 session 分区。
- 在用户提交有效仓库前，代码站点 WebView 不得导航任何远程页面；无效输入时只能展示错误，不能清空或覆盖当前已经加载的仓库页面。
- `isAllowedWebviewConfig()` 必须继续允许既有搜索站点精确主页 URL，同时新增代码站点的 origin、path、partition 三重校验，拒绝任意 origin、任意路径和 partition 不匹配。
- 本 change 不实现代码站点问答发送、历史导出、WebView 生命周期优化、私有仓库认证，也不改变搜索工作流的发送逻辑。
- 全程遵循 TDD：先写失败测试，再补最小实现，再跑针对性测试与全量验证。

---

## 文件结构

### 新增文件

- `src/shared/codeSites.ts`
  - 责任：定义 `CodeSiteId`、`NormalizedRepository`、`CodeSitePartition`、`codeSites`、`normalizeGitHubRepositoryInput()`、`buildCodeSiteUrl()`、`getCodeSite()`、`isAllowedCodeSiteWebviewConfig()`。
- `tests/shared/codeSites.test.ts`
  - 责任：覆盖仓库归一化、URL 构造、partition 派生和代码站点白名单规则。

### 修改文件

- `src/main/main.ts`（当前安全校验集中在 `67-131` 行）
  - 责任：在保留搜索站点白名单的同时，接入代码站点 WebView 配置校验。
- `src/renderer/app.ts`（当前代码 Tab 占位区集中在 `211-238` 行）
  - 责任：把占位区替换为代码仓库输入栏、当前仓库提示、三站点 pane 和延迟导航逻辑。
- `src/renderer/styles.css`（当前代码占位样式集中在 `502-532` 行）
  - 责任：为代码仓库工具栏、三列 pane 布局、状态点和错误提示提供样式。
- `tests/mainStartup.test.ts`（当前 `isAllowedWebviewConfig()` 用例在 `71-89` 行）
  - 责任：补充代码站点白名单与 partition 安全测试。
- `tests/renderer/app.test.ts`（当前代码 Tab / WebView 用例分布在 `132-215` 行之后）
  - 责任：补充代码 Tab 初始空态、有效输入导航、无效输入不导航且保留现状的测试。

### 参考但不修改

- `src/shared/services.ts`
  - 参考现有 registry、冻结对象和 partition 派生写法，不把代码仓库路由塞回搜索服务模型。
- `tests/shared/services.test.ts`
  - 参考共享注册表测试风格，不在该文件中混入代码站点断言。

## 任务拆分

### Task 1: 建立共享代码站点路由模型

**Files:**
- Create: `src/shared/codeSites.ts`
- Create: `tests/shared/codeSites.test.ts`
- Reference: `src/shared/services.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `export type CodeSiteId = 'zread' | 'deepwiki' | 'codewiki'`
  - `export type NormalizedRepository = \`${string}/${string}\``
  - `export type CodeSitePartition<T extends CodeSiteId = CodeSiteId> = \`persist:code-${T}\``
  - `export type NormalizeRepositoryResult = { ok: true; repository: NormalizedRepository } | { ok: false; errorMessage: string }`
  - `export const codeSites: readonly CodeSiteDefinition[]`
  - `export function normalizeGitHubRepositoryInput(input: string): NormalizeRepositoryResult`
  - `export function buildCodeSiteUrl(siteId: CodeSiteId, repository: NormalizedRepository): string`
  - `export function getCodeSite(siteId: CodeSiteId): CodeSiteDefinition`
  - `export function isAllowedCodeSiteWebviewConfig(src: string, partition: string): boolean`

- [ ] **Step 1: 先写共享单元测试，锁定输入归一化、URL 生成和 partition 规则**

```ts
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

  it('accepts tree, blob, query and hash repository urls', () => {
    expect(
      normalizeGitHubRepositoryInput('https://github.com/obra/superpowers/tree/main')
    ).toEqual({
      ok: true,
      repository: 'obra/superpowers'
    });
    expect(
      normalizeGitHubRepositoryInput('https://github.com/obra/superpowers/blob/main/README.md?plain=1#L1')
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
```

Run: `npm test -- tests/shared/codeSites.test.ts`

Expected: `FAIL`，提示 `Cannot find module '../../src/shared/codeSites'` 或缺少导出。

- [ ] **Step 2: 实现共享模块，集中代码站点定义、仓库归一化和安全校验**

```ts
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
```

Run: `npm test -- tests/shared/codeSites.test.ts`

Expected: `PASS`，`tests/shared/codeSites.test.ts` 全部通过。

- [ ] **Step 3: 立即补一轮共享模块自检，防止类型和冻结结构偏移**

Run: `npm run typecheck`

Expected: `PASS`，`src/shared/codeSites.ts` 的模板字面量类型、`readonly` 定义和导出在主/渲染两端都能通过类型检查。

- [ ] **Step 4: 提交共享路由模型**

```bash
git add src/shared/codeSites.ts tests/shared/codeSites.test.ts
git commit -m "feat: add code repository routing model"
```

Expected: 生成一笔只包含共享代码站点模型与对应测试的提交。

### Task 2: 扩展主进程 WebView 安全白名单

**Files:**
- Modify: `src/main/main.ts`
- Modify: `tests/mainStartup.test.ts`
- Consume: `src/shared/codeSites.ts`

**Interfaces:**
- Consumes:
  - `isAllowedCodeSiteWebviewConfig(src: string, partition: string): boolean`
  - 现有 `services: readonly ServiceDefinition[]`
- Produces:
  - `isAllowedWebviewConfig(src: string, partition: string): boolean` 同时接受搜索站点主页和合法代码站点仓库页
  - `handleWebviewAttach()` 的行为保持不变，但在代码站点配置非法时继续 `preventDefault()`

- [ ] **Step 1: 先给主进程补失败测试，固定代码站点白名单边界**

```ts
describe('isAllowedWebviewConfig', () => {
  it('allows generated code site urls with matching partitions', () => {
    expect(
      isAllowedWebviewConfig('https://zread.ai/obra/superpowers', 'persist:code-zread')
    ).toBe(true);
    expect(
      isAllowedWebviewConfig(
        'https://codewiki.google/github.com/obra/superpowers',
        'persist:code-codewiki'
      )
    ).toBe(true);
  });

  it('denies code site urls when origin, path, or partition does not match', () => {
    expect(
      isAllowedWebviewConfig('https://deepwiki.com/obra/superpowers/tree/main', 'persist:code-deepwiki')
    ).toBe(false);
    expect(
      isAllowedWebviewConfig('https://example.com/obra/superpowers', 'persist:code-deepwiki')
    ).toBe(false);
    expect(
      isAllowedWebviewConfig('https://deepwiki.com/obra/superpowers', 'persist:code-zread')
    ).toBe(false);
  });
});
```

Run: `npm test -- tests/mainStartup.test.ts`

Expected: `FAIL`，因为 `isAllowedWebviewConfig()` 目前只允许搜索站点主页 URL。

- [ ] **Step 2: 在主进程中拆开搜索站点白名单和代码站点白名单，再做统一汇总**

```ts
import { isAllowedCodeSiteWebviewConfig } from '../shared/codeSites.js';

const ALLOWED_EXTERNAL_ORIGINS = new Set(
  services.map((service) => new URL(service.url).origin)
);

function isAllowedServiceWebviewConfig(src: string, partition: string): boolean {
  let normalizedSrc: string;
  try {
    normalizedSrc = new URL(src).href;
  } catch {
    return false;
  }

  return services.some((service: ServiceDefinition) => {
    if (service.partition !== partition) {
      return false;
    }

    return new URL(service.url).href === normalizedSrc;
  });
}

export function isAllowedWebviewConfig(src: string, partition: string): boolean {
  return (
    isAllowedServiceWebviewConfig(src, partition) ||
    isAllowedCodeSiteWebviewConfig(src, partition)
  );
}
```

Run: `npm test -- tests/mainStartup.test.ts`

Expected: `PASS`，既有搜索站点测试继续通过，新增代码站点测试转绿。

- [ ] **Step 3: 做一轮主进程聚焦验证，确保 attach 阻断逻辑没有回归**

Run: `npm run typecheck`

Expected: `PASS`，`main.ts` 新增导入与辅助函数没有引入未使用变量或类型错误。

- [ ] **Step 4: 提交主进程安全改动**

```bash
git add src/main/main.ts tests/mainStartup.test.ts
git commit -m "feat: harden code site webview allowlist"
```

Expected: 生成一笔只包含主进程安全校验与对应测试的提交。

### Task 3: 实现代码 Tab 的仓库输入、三站点 pane 与延迟导航

**Files:**
- Modify: `src/renderer/app.ts`
- Modify: `src/renderer/styles.css`
- Modify: `tests/renderer/app.test.ts`
- Consume: `src/shared/codeSites.ts`

**Interfaces:**
- Consumes:
  - `codeSites: readonly CodeSiteDefinition[]`
  - `normalizeGitHubRepositoryInput(input: string): NormalizeRepositoryResult`
  - `buildCodeSiteUrl(siteId: CodeSiteId, repository: NormalizedRepository): string`
- Produces:
  - 新增测试钩子：`data-testid="code-repository-input" | "code-open-button" | "code-repository-current" | "code-repository-error" | "code-site-pane-<id>"`
  - 代码 Tab 内部状态：`draftRepositoryInput: string`、`activeRepository: NormalizedRepository | null`、`codeInputError: string | null`
  - 代码站点 pane 行为：初始仅带 `partition` 不带远程 `src`，有效提交后设置 `src`，无效提交时保留上一次成功导航

- [ ] **Step 1: 先补 renderer 失败测试，约束空态、成功导航和错误保留行为**

```ts
it('does not navigate remote code sites before a valid repository is submitted', () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const codeWebviews = Array.from(
    root.querySelectorAll('[data-testid^="code-site-pane-"] webview')
  ) as MockWebview[];

  expect(codeWebviews).toHaveLength(3);
  expect(codeWebviews.map((webview) => webview.getAttribute('src'))).toEqual([null, null, null]);
  expect(codeWebviews.map((webview) => webview.getAttribute('partition'))).toEqual([
    'persist:code-zread',
    'persist:code-deepwiki',
    'persist:code-codewiki'
  ]);
});

it('navigates all three code sites after a valid repository submission', () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const input = root.querySelector('[data-testid="code-repository-input"]') as HTMLInputElement;
  const button = root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement;
  input.value = 'obra/superpowers';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  button.click();

  const codeWebviews = Array.from(
    root.querySelectorAll('[data-testid^="code-site-pane-"] webview')
  ) as MockWebview[];

  expect(root.querySelector('[data-testid="code-repository-current"]')?.textContent).toContain(
    'obra/superpowers'
  );
  expect(codeWebviews.map((webview) => webview.getAttribute('src'))).toEqual([
    'https://zread.ai/obra/superpowers',
    'https://deepwiki.com/obra/superpowers',
    'https://codewiki.google/github.com/obra/superpowers'
  ]);
});

it('shows a validation error and preserves the previous repository pages on invalid input', () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const input = root.querySelector('[data-testid="code-repository-input"]') as HTMLInputElement;
  const button = root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement;

  input.value = 'obra/superpowers';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  button.click();

  input.value = 'https://example.com/obra/superpowers';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  button.click();

  const codeWebviews = Array.from(
    root.querySelectorAll('[data-testid^="code-site-pane-"] webview')
  ) as MockWebview[];

  expect(root.querySelector('[data-testid="code-repository-error"]')?.textContent).toContain(
    '仅支持 GitHub 仓库地址或 owner/repo'
  );
  expect(codeWebviews.map((webview) => webview.getAttribute('src'))).toEqual([
    'https://zread.ai/obra/superpowers',
    'https://deepwiki.com/obra/superpowers',
    'https://codewiki.google/github.com/obra/superpowers'
  ]);
});
```

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `FAIL`，提示缺少代码仓库输入控件、代码站点 pane 或 `src` 断言不满足。

- [ ] **Step 2: 在 `app.ts` 中用最小状态机替换代码占位区**

```ts
import {
  buildCodeSiteUrl,
  codeSites,
  normalizeGitHubRepositoryInput,
  type CodeSiteId,
  type CodeSiteDefinition,
  type NormalizedRepository
} from '../shared/codeSites';

type CodePaneStatus = 'idle' | 'loading' | 'ready' | 'error';

type CodePaneRuntime = {
  site: CodeSiteDefinition;
  article: HTMLElement;
  statusDot: HTMLSpanElement;
  statusText: HTMLSpanElement;
  errorText: HTMLParagraphElement;
  webview: RendererWebviewElement;
  status: CodePaneStatus;
};

let draftRepositoryInput = '';
let activeRepository: NormalizedRepository | null = null;
let codeInputError: string | null = null;
const codePanes = new Map<CodeSiteId, CodePaneRuntime>();

const codeWorkflow = document.createElement('section');
codeWorkflow.className = 'code-workflow';
codeWorkflow.dataset.testid = 'code-workflow';
appBody.append(codeWorkflow);

const codeToolbar = document.createElement('div');
codeToolbar.className = 'code-toolbar';
codeWorkflow.append(codeToolbar);

const codeRepositoryInput = document.createElement('input');
codeRepositoryInput.className = 'code-repository-input';
codeRepositoryInput.dataset.testid = 'code-repository-input';
codeRepositoryInput.placeholder = '输入 GitHub 仓库，如 obra/superpowers';
codeToolbar.append(codeRepositoryInput);

const codeOpenButton = document.createElement('button');
codeOpenButton.type = 'button';
codeOpenButton.className = 'code-open-button';
codeOpenButton.dataset.testid = 'code-open-button';
codeOpenButton.textContent = '打开仓库';
codeToolbar.append(codeOpenButton);

const codeRepositoryCurrent = document.createElement('p');
codeRepositoryCurrent.className = 'code-repository-current';
codeRepositoryCurrent.dataset.testid = 'code-repository-current';
codeWorkflow.append(codeRepositoryCurrent);

const codeRepositoryError = document.createElement('p');
codeRepositoryError.className = 'code-repository-error';
codeRepositoryError.dataset.testid = 'code-repository-error';
codeWorkflow.append(codeRepositoryError);

const codePaneGrid = document.createElement('section');
codePaneGrid.className = 'code-pane-grid';
codeWorkflow.append(codePaneGrid);

function setCodePaneStatus(pane: CodePaneRuntime, status: CodePaneStatus, errorMessage?: string) {
  pane.status = status;
  pane.article.dataset.status = status;
  pane.statusText.textContent =
    status === 'idle' ? '等待仓库' :
    status === 'loading' ? '加载中' :
    status === 'ready' ? '已就绪' : '加载失败';
  pane.errorText.textContent = errorMessage ?? '';
}

for (const site of codeSites) {
  const article = document.createElement('article');
  article.className = 'code-site-pane';
  article.dataset.testid = `code-site-pane-${site.id}`;

  const webview = document.createElement('webview') as RendererWebviewElement;
  webview.className = 'pane-webview';
  webview.setAttribute('partition', site.partition);

  webview.addEventListener('did-start-loading', () => setCodePaneStatus(pane, 'loading'));
  webview.addEventListener('did-stop-loading', () => setCodePaneStatus(pane, 'ready'));
  webview.addEventListener('did-fail-load', () =>
    setCodePaneStatus(pane, 'error', '页面加载失败，请稍后重试')
  );

  const pane: CodePaneRuntime = { site, article, statusDot, statusText, errorText, webview, status: 'idle' };
  codePanes.set(site.id, pane);
}

function submitCodeRepository() {
  const parsed = normalizeGitHubRepositoryInput(draftRepositoryInput);
  if (!parsed.ok) {
    codeInputError = parsed.errorMessage;
    codeRepositoryError.textContent = parsed.errorMessage;
    return;
  }

  activeRepository = parsed.repository;
  codeInputError = null;
  codeRepositoryCurrent.textContent = `当前仓库：${parsed.repository}`;
  codeRepositoryError.textContent = '';

  for (const pane of codePanes.values()) {
    pane.webview.setAttribute('partition', pane.site.partition);
    pane.webview.setAttribute('src', buildCodeSiteUrl(pane.site.id, parsed.repository));
    setCodePaneStatus(pane, 'loading');
  }
}

codeRepositoryInput.addEventListener('input', () => {
  draftRepositoryInput = codeRepositoryInput.value;
});
codeRepositoryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitCodeRepository();
  }
});
codeOpenButton.addEventListener('click', submitCodeRepository);
```

Run: `npm test -- tests/renderer/app.test.ts`

Expected: 仍可能 `FAIL`，但失败点应收敛到样式钩子、文案或状态渲染细节，而不是缺少 DOM 结构。

- [ ] **Step 3: 补齐代码 Tab 样式，让工具栏、三列 pane 和状态反馈可读可测**

```css
.code-workflow {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 12px;
}

.code-toolbar {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.code-repository-input,
.code-open-button {
  height: 42px;
  font: inherit;
}

.code-repository-input {
  width: 100%;
  min-width: 0;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.code-open-button {
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: #111827;
  color: #fff;
}

.code-repository-current,
.code-repository-error {
  margin: 0;
  font-size: 13px;
}

.code-repository-current {
  color: #374151;
}

.code-repository-error {
  color: #b91c1c;
  min-height: 20px;
}

.code-pane-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.code-site-pane {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
```

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `PASS`，代码 Tab 相关用例全部通过，既有搜索工作流用例不回归。

- [ ] **Step 4: 做代码 Tab 集成自检，确认针对性测试外的类型约束也稳定**

Run: `npm run typecheck`

Expected: `PASS`，`app.ts` 中新增代码站点状态与 `RendererWebviewElement` 交互没有类型错误。

- [ ] **Step 5: 提交 renderer 集成改动**

```bash
git add src/renderer/app.ts src/renderer/styles.css tests/renderer/app.test.ts
git commit -m "feat: add code repository tab workflow"
```

Expected: 生成一笔只包含代码 Tab UI、样式和 renderer 测试的提交。

## 全量验证

- [ ] **Step 1: 跑全量类型检查**

Run: `npm run typecheck`

Expected: `PASS`，无 TypeScript 错误。

- [ ] **Step 2: 跑完整测试套件**

Run: `npm test`

Expected: `PASS`，`tests/shared/codeSites.test.ts`、`tests/mainStartup.test.ts`、`tests/renderer/app.test.ts` 与既有测试全部通过。

- [ ] **Step 3: 跑构建，确认 Electron + Vite 打包不受新共享模块影响**

Run: `npm run build`

Expected: `PASS`，生成最新 `dist/main`、`dist/preload`、`dist/renderer` 产物。

- [ ] **Step 4: 最后检查改动范围**

Run: `git status --short`

Expected: 只出现本 change 计划内的实现文件与测试文件变更，不出现与代码仓库 Tab 无关的额外编辑。
