---
change: add-code-qa-history-export
design-doc: docs/superpowers/specs/2026-06-23-code-qa-history-export-design.md
base-ref: 5bfd297f88ce953f099e889c132a38d82994bdb5
---

# 代码问答历史与导出实施计划

> **面向代理执行者：** REQUIRED SUB-SKILL: 使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项实施本计划。所有步骤使用复选框 `- [ ]` 语法追踪。

**Goal:** 为 `代码` Tab 增加三站点代码问答、多轮内存历史和 Markdown 导出，同时明确历史只存在当前仓库会话内，不做跨仓库恢复或磁盘持久化。

**Architecture:** 新增 `src/shared/codeQa.ts` 作为代码问答规则唯一来源，集中封装三站点选择器、发送脚本、回答抽取脚本和 Markdown formatter。`src/renderer/app.ts` 负责当前仓库会话、轮次状态机、代码问答 UI、仓库切换重置和导出分流，继续复用现有 `window.mutiSearch.saveMarkdownExport()` 固定导出 IPC，不新增任何持久化通道。

**Tech Stack:** TypeScript、Electron 39、Vite 7、Vitest 4、原生 DOM 渲染、既有 Markdown 导出 IPC

## Global Constraints

- 代码问答自动化规则唯一来源必须是 `src/shared/codeQa.ts`；`src/renderer/app.ts` 只能消费共享配置和共享脚本 builder，不能复制站点 selector 常量。
- 当前 change 只保留当前仓库的内存历史；切换仓库时必须清空 `codeRounds` 并开始新的会话，不恢复旧仓库历史，不写入磁盘。
- 同一仓库内的追问不能把 Zread、DeepWiki、CodeWiki 导航回仓库主页；DeepWiki 第二轮及以后必须使用 `textarea[data-deepwiki-input="followup"]`。
- 导出必须继续复用 `window.mutiSearch.saveMarkdownExport()` 与既有固定 Markdown 保存路径/剪贴板复制链路，不新增新的 IPC channel。
- `代码` Tab 无仓库时发送问题必须报错且不得执行任何 code webview 脚本；无轮次时点击导出必须提示 `没有可导出的代码问答记录` 且不得调用 IPC。
- Markdown 导出只包含当前 `activeRepository` 对应的 `codeRounds`，并按轮次顺序、站点固定顺序 `Zread -> DeepWiki -> CodeWiki` 输出。
- WebView 隐藏、切换 Tab、暂时失去 `executeJavaScript` 能力时必须保留历史记录；单站失败只更新对应 entry，不影响其他站点和整轮记录。
- 全程遵循 TDD：每个任务都先写失败测试、运行失败、实现最小代码、运行通过、提交；提交粒度与任务一一对应。

## 文件结构

### 新增文件

- `src/shared/codeQa.ts`
  - 责任：定义 `CodeQaStatus`、站点问答配置、发送脚本、回答抽取脚本、导出 formatter 以及导出所需共享类型。
- `tests/shared/codeQa.test.ts`
  - 责任：覆盖三站点 selector 规则、Zread Ask AI 激活、DeepWiki 首问/追问差异和 Markdown formatter 输出。

### 修改文件

- `src/renderer/app.ts`
  - 责任：增加代码问题输入栏、发送动作、`CodeRound`/`CodeRoundEntry` 内存状态、同仓库追问编排、仓库切换清空、代码历史渲染、代码导出分流。
- `src/renderer/styles.css`
  - 责任：为代码问答工具栏、轮次列表、站点状态块和错误/回答文本增加稳定布局样式，保证桌面与窄屏下文本不重叠。
- `tests/renderer/app.test.ts`
  - 责任：覆盖无仓库报错、首问发送到三站、同仓库追问不回主页、DeepWiki selector 切换、仓库变化开启新会话、导出多轮及单站错误。

### 参考但不修改

- `src/shared/codeSites.ts`
  - 参考现有 `CodeSiteId`、`NormalizedRepository`、`buildCodeSiteUrl()` 与站点顺序，避免在新模块中重新发明站点 ID。
- `src/shared/domScript.ts`
  - 参考已有 `buildDomSendScript()` / `buildDomExtractAnswerScript()` 返回结构，保持新脚本 builder 的返回值和错误语义一致。
- `src/shared/exportMarkdown.ts`
  - 参考既有 `MarkdownExportPayload` / `MarkdownExportResult`，确保导出仍走同一 IPC 契约。

## 任务拆分

### Task 1: 建立共享代码问答规则与 Markdown formatter

**Files:**
- Create: `src/shared/codeQa.ts`
- Create: `tests/shared/codeQa.test.ts`
- Reference: `src/shared/codeSites.ts`
- Reference: `src/shared/domScript.ts`

**Interfaces:**
- Consumes:
  - `CodeSiteId`、`NormalizedRepository` from `src/shared/codeSites.ts`
  - `buildDomSendScript(input: DomSendScriptInput): string`
  - `buildDomExtractAnswerScript(input: DomExtractAnswerScriptInput): string`
- Produces:
  - `export type CodeQaStatus = 'pending' | 'sending' | 'generating' | 'completed' | 'manual_required' | 'error'`
  - `export type CodeQaSendResult = { status: 'sent'; errorMessage: null } | { status: 'manual_required' | 'error'; errorMessage: string }`
  - `export type CodeQaExtractResult = { status: 'ok' | 'error'; answerText: string; isBusy: boolean; errorMessage: string | null }`
  - `export type CodeQaExportEntry = Readonly<{ siteId: CodeSiteId; siteName: string; status: CodeQaStatus; answerText: string; errorMessage: string | null; updatedAt: string }>`
  - `export type CodeQaExportRound = Readonly<{ id: string; repository: NormalizedRepository; question: string; createdAt: string; entries: Record<CodeSiteId, CodeQaExportEntry> }>`
  - `export type CodeQaSiteConfig = Readonly<{ siteId: CodeSiteId; siteName: string; firstQuestionInputSelectors: readonly string[]; followUpInputSelectors: readonly string[]; submitSelectors: readonly string[]; answerSelectors: readonly string[]; busySelectors: readonly string[]; activationSelectors?: readonly string[]; requiresFollowUpAfterFirstRound?: boolean }>`
  - `export const codeQaSiteConfigs: readonly CodeQaSiteConfig[]`
  - `export function getCodeQaSiteConfig(siteId: CodeSiteId): CodeQaSiteConfig`
  - `export function buildCodeQaSendScript(options: { siteId: CodeSiteId; question: string; isFollowUp: boolean }): string`
  - `export function buildCodeQaExtractScript(options: { siteId: CodeSiteId; question: string }): string`
  - `export function formatCodeQaMarkdownExport(repository: NormalizedRepository, rounds: readonly CodeQaExportRound[], exportedAt: Date): string`

- [x] **Step 1: 先写共享测试，锁定 selector、Ask AI 激活和导出格式**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCodeQaExtractScript,
  buildCodeQaSendScript,
  formatCodeQaMarkdownExport,
  getCodeQaSiteConfig,
  type CodeQaExportRound
} from '../../src/shared/codeQa';

describe('codeQaSiteConfigs', () => {
  it('uses the expected selectors for every code site', () => {
    expect(getCodeQaSiteConfig('zread').followUpInputSelectors).toEqual([
      'textarea[placeholder="提出后续问题..."]'
    ]);
    expect(getCodeQaSiteConfig('deepwiki').firstQuestionInputSelectors).toEqual([
      'textarea[data-deepwiki-input="question"]'
    ]);
    expect(getCodeQaSiteConfig('deepwiki').followUpInputSelectors).toEqual([
      'textarea[data-deepwiki-input="followup"]'
    ]);
    expect(getCodeQaSiteConfig('codewiki').submitSelectors).toEqual([
      'button[data-test-id="send-message-button"]'
    ]);
  });

  it('adds Ask AI activation for zread before sending', () => {
    const script = buildCodeQaSendScript({
      siteId: 'zread',
      question: '这个项目的核心架构是什么？',
      isFollowUp: false
    });

    expect(script).toContain('Ask AI');
    expect(script).toContain('textarea[placeholder="提出后续问题..."]');
  });

  it('switches deepwiki between question and followup selectors', () => {
    const firstRound = buildCodeQaSendScript({
      siteId: 'deepwiki',
      question: '第一问',
      isFollowUp: false
    });
    const followUp = buildCodeQaSendScript({
      siteId: 'deepwiki',
      question: '第二问',
      isFollowUp: true
    });

    expect(firstRound).toContain('textarea[data-deepwiki-input="question"]');
    expect(followUp).toContain('textarea[data-deepwiki-input="followup"]');
    expect(buildCodeQaExtractScript({ siteId: 'deepwiki', question: '第二问' })).toContain(
      'data-deepwiki-answer'
    );
  });
});

describe('formatCodeQaMarkdownExport', () => {
  it('exports repository name, multiple rounds, generating state and site errors', () => {
    const rounds: CodeQaExportRound[] = [
      {
        id: 'round-1',
        repository: 'obra/superpowers',
        question: '第一问',
        createdAt: '2026-06-23T09:00:00.000Z',
        entries: {
          zread: {
            siteId: 'zread',
            siteName: 'Zread',
            status: 'completed',
            answerText: 'Zread answer',
            errorMessage: null,
            updatedAt: '2026-06-23T09:00:02.000Z'
          },
          deepwiki: {
            siteId: 'deepwiki',
            siteName: 'DeepWiki',
            status: 'generating',
            answerText: 'partial answer',
            errorMessage: null,
            updatedAt: '2026-06-23T09:00:03.000Z'
          },
          codewiki: {
            siteId: 'codewiki',
            siteName: 'CodeWiki',
            status: 'error',
            answerText: '',
            errorMessage: '429 Too Many Requests',
            updatedAt: '2026-06-23T09:00:04.000Z'
          }
        }
      }
    ];

    const markdown = formatCodeQaMarkdownExport(
      'obra/superpowers',
      rounds,
      new Date('2026-06-23T09:30:00.000Z')
    );

    expect(markdown).toContain('# muti-search 代码问答导出');
    expect(markdown).toContain('- 仓库：obra/superpowers');
    expect(markdown).toContain('## 第 1 轮');
    expect(markdown).toContain('### DeepWiki');
    expect(markdown).toContain('状态：生成中');
    expect(markdown).toContain('partial answer');
    expect(markdown).toContain('错误：429 Too Many Requests');
  });
});
```

Run: `npm test -- tests/shared/codeQa.test.ts`

Expected: `FAIL`，报错 `Cannot find module '../../src/shared/codeQa'` 或缺少 `buildCodeQaSendScript` / `formatCodeQaMarkdownExport` 导出。

- [x] **Step 2: 实现共享模块，集中三站点 DOM 规则和导出 formatter**

```ts
import {
  buildDomExtractAnswerScript,
  buildDomSendScript,
  type DomExtractAnswerScriptInput
} from './domScript';
import { type CodeSiteId, type NormalizedRepository } from './codeSites';

export type CodeQaStatus =
  | 'pending'
  | 'sending'
  | 'generating'
  | 'completed'
  | 'manual_required'
  | 'error';

export type CodeQaExportEntry = Readonly<{
  siteId: CodeSiteId;
  siteName: string;
  status: CodeQaStatus;
  answerText: string;
  errorMessage: string | null;
  updatedAt: string;
}>;

export type CodeQaExportRound = Readonly<{
  id: string;
  repository: NormalizedRepository;
  question: string;
  createdAt: string;
  entries: Record<CodeSiteId, CodeQaExportEntry>;
}>;

export const codeQaSiteConfigs = Object.freeze([
  Object.freeze({
    siteId: 'zread',
    siteName: 'Zread',
    firstQuestionInputSelectors: ['textarea[placeholder="提出后续问题..."]'],
    followUpInputSelectors: ['textarea[placeholder="提出后续问题..."]'],
    submitSelectors: ['button[aria-label="Send message"]'],
    answerSelectors: ['main article', '[data-message-author-role="assistant"]'],
    busySelectors: ['button[aria-label="Stop generating"]', '[data-state="streaming"]'],
    activationSelectors: ['button[aria-label="Ask AI"]', 'button[title="Ask AI"]']
  }),
  Object.freeze({
    siteId: 'deepwiki',
    siteName: 'DeepWiki',
    firstQuestionInputSelectors: ['textarea[data-deepwiki-input="question"]'],
    followUpInputSelectors: ['textarea[data-deepwiki-input="followup"]'],
    submitSelectors: ['button[type="submit"]'],
    answerSelectors: ['main article', '[data-deepwiki-answer]'],
    busySelectors: ['[data-deepwiki-busy="true"]', 'button[aria-label="Stop generating"]'],
    requiresFollowUpAfterFirstRound: true
  }),
  Object.freeze({
    siteId: 'codewiki',
    siteName: 'CodeWiki',
    firstQuestionInputSelectors: ['#message-textarea'],
    followUpInputSelectors: ['#message-textarea'],
    submitSelectors: ['button[data-test-id="send-message-button"]'],
    answerSelectors: ['[data-test-id="conversation-turn-answer"]', 'main article'],
    busySelectors: ['button[aria-label="Stop generating"]', '[data-test-id="loading-answer"]']
  })
] as const);

export function buildCodeQaSendScript(options: {
  siteId: CodeSiteId;
  question: string;
  isFollowUp: boolean;
}): string {
  const config = getCodeQaSiteConfig(options.siteId);
  const inputSelectors = options.isFollowUp
    ? config.followUpInputSelectors
    : config.firstQuestionInputSelectors;
  const sendScript = buildDomSendScript({
    prompt: options.question,
    inputSelectors,
    submitSelectors: config.submitSelectors
  });

  if (config.siteId !== 'zread' || !config.activationSelectors?.length) {
    return sendScript;
  }

  const activationSelectors = JSON.stringify(config.activationSelectors);
  return `
(() => {
  const selectors = ${activationSelectors};
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button instanceof HTMLElement) {
      const semantic = [button.textContent, button.getAttribute('aria-label'), button.getAttribute('title')]
        .filter(Boolean)
        .join(' ');
      if (/Ask AI/i.test(semantic)) {
        button.click();
        break;
      }
    }
  }
  return null;
})()
    .then(() => ${sendScript})
`;
}

export function buildCodeQaExtractScript(options: { siteId: CodeSiteId; question: string }): string {
  const config = getCodeQaSiteConfig(options.siteId);
  const input: DomExtractAnswerScriptInput = {
    prompt: options.question,
    answerSelectors: config.answerSelectors,
    busySelectors: config.busySelectors
  };
  return buildDomExtractAnswerScript(input);
}

export function formatCodeQaMarkdownExport(
  repository: NormalizedRepository,
  rounds: readonly CodeQaExportRound[],
  exportedAt: Date
): string {
  const lines = [
    '# muti-search 代码问答导出',
    '',
    `- 仓库：${repository}`,
    `- 导出时间：${exportedAt.toLocaleString('zh-CN')}`,
    ''
  ];

  rounds.forEach((round, index) => {
    lines.push(`## 第 ${index + 1} 轮`, '', '### 问题', '', round.question, '');

    (['zread', 'deepwiki', 'codewiki'] as const).forEach((siteId) => {
      const entry = round.entries[siteId];
      lines.push(`### ${entry.siteName}`, '');

      if (entry.status === 'completed' && entry.answerText.trim()) {
        lines.push(entry.answerText.trim(), '');
        return;
      }

      if (entry.status === 'generating') {
        lines.push('状态：生成中', '');
        if (entry.answerText.trim()) {
          lines.push(entry.answerText.trim(), '');
        }
        return;
      }

      if (entry.errorMessage) {
        lines.push(`错误：${entry.errorMessage}`, '');
        return;
      }

      lines.push(`状态：${entry.status}`, '');
    });
  });

  return `${lines.join('\n').trimEnd()}\n`;
}
```

- [x] **Step 3: 运行共享测试，确认共享模块已锁定需求行为**

Run: `npm test -- tests/shared/codeQa.test.ts`

Expected: `PASS`，覆盖以下结果：
- Zread 发送脚本包含 `Ask AI` 激活逻辑。
- DeepWiki 首问/追问脚本分别使用 `question` 与 `followup` selector。
- CodeWiki 使用 `#message-textarea` 和 `button[data-test-id="send-message-button"]`。
- Markdown formatter 输出仓库名、轮次顺序、生成中状态和单站错误。

- [x] **Step 4: 提交共享规则与 formatter**

```bash
git add src/shared/codeQa.ts tests/shared/codeQa.test.ts
git commit -m "feat: add shared code qa rules"
```

### Task 2: 在 Renderer 中实现当前仓库会话、追问编排和历史 UI

**Files:**
- Modify: `src/renderer/app.ts`
- Modify: `src/renderer/styles.css`
- Modify: `tests/renderer/app.test.ts`
- Reference: `src/shared/codeQa.ts`

**Interfaces:**
- Consumes:
  - `buildCodeSiteUrl(siteId: CodeSiteId, repository: NormalizedRepository): string`
  - `buildCodeQaSendScript(options: { siteId: CodeSiteId; question: string; isFollowUp: boolean }): string`
  - `buildCodeQaExtractScript(options: { siteId: CodeSiteId; question: string }): string`
  - `CodeQaStatus`, `CodeQaSendResult`, `CodeQaExtractResult`
- Produces:
  - `type CodeRound = { id: string; repository: NormalizedRepository; question: string; createdAt: string; entries: Record<CodeSiteId, CodeRoundEntry> }`
  - `type CodeRoundEntry = { siteId: CodeSiteId; siteName: string; status: CodeQaStatus; answerText: string; errorMessage: string | null; updatedAt: string }`
  - `function createCodeRound(repository: NormalizedRepository, question: string): CodeRound`
  - `function renderCodeQaHistory(): void`
  - `function resetCodeRepositorySession(nextRepository: NormalizedRepository): void`
  - `async function sendCodeQuestion(): Promise<void>`
  - `async function runCodeQaForPane(pane: CodePaneRuntime, roundId: string, question: string, isFollowUp: boolean): Promise<void>`
  - `function updateRoundEntry(roundId: string, siteId: CodeSiteId, patch: Partial<CodeRoundEntry>): void`

- [x] **Step 1: 先写渲染层失败测试，锁定无仓库报错、三站发送、追问不回主页、DeepWiki selector 切换和仓库切换新会话**

```ts
it('shows an error and skips all code webviews when no repository is active', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  const { executeJavaScriptMocks } = attachWebviewMocks(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const questionInput = root.querySelector(
    '[data-testid="code-question-input"]'
  ) as HTMLInputElement;
  const sendButton = root.querySelector(
    '[data-testid="code-question-send-button"]'
  ) as HTMLButtonElement;

  questionInput.value = '这个项目的核心架构是什么？';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  sendButton.click();
  await flushPromises();

  expect(root.querySelector('[data-testid="code-qa-error"]')?.textContent).toContain('请先打开仓库');
  expect(executeJavaScriptMocks.every((mock) => mock.mock.calls.length === 0)).toBe(true);
});

it('sends the first code question to all three code sites and creates a round', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  const { executeJavaScriptMocks } = attachWebviewMocks(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const repositoryInput = root.querySelector(
    '[data-testid="code-repository-input"]'
  ) as HTMLInputElement;
  repositoryInput.value = 'obra/superpowers';
  repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

  const codeMocks = executeJavaScriptMocks.slice(-3);
  codeMocks.forEach((mock, index) => {
    mock
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: `answer-${index}`,
        isBusy: false,
        errorMessage: null
      });
  });

  const questionInput = root.querySelector(
    '[data-testid="code-question-input"]'
  ) as HTMLInputElement;
  questionInput.value = '第一问';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
  await flushAsyncWork();

  expect(root.querySelectorAll('[data-testid="code-qa-round"]')).toHaveLength(1);
  expect(root.querySelector('[data-testid="code-qa-round"]')?.textContent).toContain('第一问');
  expect(codeMocks[0].mock.calls[0]?.[0]).toContain('Ask AI');
  expect(codeMocks[1].mock.calls[0]?.[0]).toContain('textarea[data-deepwiki-input="question"]');
  expect(codeMocks[2].mock.calls[0]?.[0]).toContain('#message-textarea');
});

it('keeps the current pages for follow-up questions and switches deepwiki to the followup selector', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  const { executeJavaScriptMocks, loadURLMocks } = attachWebviewMocks(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const repositoryInput = root.querySelector(
    '[data-testid="code-repository-input"]'
  ) as HTMLInputElement;
  repositoryInput.value = 'obra/superpowers';
  repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

  const codeMocks = executeJavaScriptMocks.slice(-3);
  codeMocks.forEach((mock) => {
    mock
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({ status: 'ok', answerText: 'round-1', isBusy: false, errorMessage: null })
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({ status: 'ok', answerText: 'round-2', isBusy: false, errorMessage: null });
  });

  const questionInput = root.querySelector(
    '[data-testid="code-question-input"]'
  ) as HTMLInputElement;

  questionInput.value = '第一问';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
  await flushAsyncWork();

  questionInput.value = '第二问';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
  await flushAsyncWork();

  expect(root.querySelectorAll('[data-testid="code-qa-round"]')).toHaveLength(2);
  expect(loadURLMocks.slice(-3).every((mock) => mock.mock.calls.length === 0)).toBe(true);
  expect(codeMocks[1].mock.calls[2]?.[0]).toContain('textarea[data-deepwiki-input="followup"]');
});

it('starts a new in-memory session after repository change and keeps old rounds out of the current history', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  createApp(root);

  const { executeJavaScriptMocks } = attachWebviewMocks(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const repositoryInput = root.querySelector(
    '[data-testid="code-repository-input"]'
  ) as HTMLInputElement;
  const questionInput = root.querySelector(
    '[data-testid="code-question-input"]'
  ) as HTMLInputElement;

  repositoryInput.value = 'obra/superpowers';
  repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

  executeJavaScriptMocks.slice(-3).forEach((mock) => {
    mock
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({ status: 'ok', answerText: 'old answer', isBusy: false, errorMessage: null })
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({ status: 'ok', answerText: 'new answer', isBusy: false, errorMessage: null });
  });

  questionInput.value = '旧仓库问题';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
  await flushAsyncWork();

  repositoryInput.value = 'openai/openai-node';
  repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

  questionInput.value = '新仓库问题';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
  await flushAsyncWork();

  const rounds = Array.from(root.querySelectorAll('[data-testid="code-qa-round"]'));
  expect(rounds).toHaveLength(1);
  expect(rounds[0]?.textContent).toContain('新仓库问题');
  expect(rounds[0]?.textContent).not.toContain('旧仓库问题');
  expect(root.querySelector('[data-testid="code-repository-current"]')?.textContent).toContain(
    'openai/openai-node'
  );
});
```

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `FAIL`，至少出现以下失败之一：
- 找不到 `data-testid="code-question-input"` / `data-testid="code-question-send-button"`。
- `code-qa-round` 数量仍为 `0`。
- DeepWiki 第二轮脚本仍未切换到 `followup` selector。
- 切换仓库后旧问题仍残留在当前历史中。

- [x] **Step 2: 在 `app.ts` 和 `styles.css` 中实现最小状态模型、历史 UI 和发送编排**

```ts
import {
  buildCodeQaExtractScript,
  buildCodeQaSendScript,
  type CodeQaExtractResult,
  type CodeQaSendResult,
  type CodeQaStatus
} from '../shared/codeQa';

type CodeRoundEntry = {
  siteId: CodeSiteId;
  siteName: string;
  status: CodeQaStatus;
  answerText: string;
  errorMessage: string | null;
  updatedAt: string;
};

type CodeRound = {
  id: string;
  repository: NormalizedRepository;
  question: string;
  createdAt: string;
  entries: Record<CodeSiteId, CodeRoundEntry>;
};

let codeQuestionDraft = '';
let codeRounds: CodeRound[] = [];
let codeQuestionError: string | null = null;

const codeQuestionToolbar = document.createElement('div');
codeQuestionToolbar.className = 'code-qa-toolbar';
codeWorkflow.append(codeQuestionToolbar);

const codeQuestionInput = document.createElement('input');
codeQuestionInput.type = 'text';
codeQuestionInput.className = 'code-qa-input';
codeQuestionInput.dataset.testid = 'code-question-input';
codeQuestionInput.placeholder = '询问当前仓库';
codeQuestionToolbar.append(codeQuestionInput);

const codeQuestionSendButton = document.createElement('button');
codeQuestionSendButton.type = 'button';
codeQuestionSendButton.className = 'code-qa-send-button';
codeQuestionSendButton.dataset.testid = 'code-question-send-button';
codeQuestionSendButton.textContent = '发送问题';
codeQuestionToolbar.append(codeQuestionSendButton);

const codeQaError = document.createElement('p');
codeQaError.className = 'code-qa-error';
codeQaError.dataset.testid = 'code-qa-error';
codeWorkflow.append(codeQaError);

const codeQaHistory = document.createElement('section');
codeQaHistory.className = 'code-qa-history';
codeQaHistory.dataset.testid = 'code-qa-history';
codeWorkflow.append(codeQaHistory);

function renderCodeQaHistory(): void {
  codeQaError.textContent = codeQuestionError ?? '';
  codeQaHistory.innerHTML = '';

  for (const round of codeRounds) {
    const roundCard = document.createElement('article');
    roundCard.className = 'code-qa-round';
    roundCard.dataset.testid = 'code-qa-round';

    const title = document.createElement('h3');
    title.textContent = round.question;
    roundCard.append(title);

    (['zread', 'deepwiki', 'codewiki'] as const).forEach((siteId) => {
      const entry = round.entries[siteId];
      const entryBlock = document.createElement('section');
      entryBlock.className = 'code-qa-entry';
      entryBlock.textContent = `${entry.siteName} ${entry.status} ${entry.errorMessage ?? entry.answerText}`;
      roundCard.append(entryBlock);
    });

    codeQaHistory.append(roundCard);
  }

  updateExportButtonVisibility();
}

function createCodeRound(repository: NormalizedRepository, question: string): CodeRound {
  const now = new Date().toISOString();
  return {
    id: `code-round-${Date.now()}`,
    repository,
    question,
    createdAt: now,
    entries: Object.fromEntries(
      codeSites.map((site) => [
        site.id,
        {
          siteId: site.id,
          siteName: site.name,
          status: 'pending',
          answerText: '',
          errorMessage: null,
          updatedAt: now
        }
      ])
    ) as Record<CodeSiteId, CodeRoundEntry>
  };
}

function resetCodeRepositorySession(nextRepository: NormalizedRepository): void {
  activeRepository = nextRepository;
  codeRounds = [];
  codeQuestionError = null;
  renderCodeRepositoryMeta();
  renderCodeQaHistory();
}

function updateRoundEntry(
  roundId: string,
  siteId: CodeSiteId,
  patch: Partial<CodeRoundEntry>
): void {
  codeRounds = codeRounds.map((round) =>
    round.id !== roundId
      ? round
      : {
          ...round,
          entries: {
            ...round.entries,
            [siteId]: {
              ...round.entries[siteId],
              ...patch,
              updatedAt: new Date().toISOString()
            }
          }
        }
  );
  renderCodeQaHistory();
}

async function runCodeQaForPane(
  pane: CodePaneRuntime,
  roundId: string,
  question: string,
  isFollowUp: boolean
): Promise<void> {
  updateRoundEntry(roundId, pane.site.id, { status: 'sending', errorMessage: null });

  if (typeof pane.webview.executeJavaScript !== 'function') {
    updateRoundEntry(roundId, pane.site.id, {
      status: 'manual_required',
      errorMessage: '服务视图未就绪'
    });
    return;
  }

  const sendResult = (await pane.webview.executeJavaScript(
    buildCodeQaSendScript({ siteId: pane.site.id, question, isFollowUp }),
    true
  )) as CodeQaSendResult;

  if (sendResult.status !== 'sent') {
    updateRoundEntry(roundId, pane.site.id, {
      status: sendResult.status,
      errorMessage: sendResult.errorMessage
    });
    return;
  }

  updateRoundEntry(roundId, pane.site.id, { status: 'generating' });
  await sleep(300);

  const extractResult = (await pane.webview.executeJavaScript(
    buildCodeQaExtractScript({ siteId: pane.site.id, question }),
    true
  )) as CodeQaExtractResult;

  updateRoundEntry(roundId, pane.site.id, {
    status: extractResult.isBusy ? 'generating' : 'completed',
    answerText: extractResult.answerText,
    errorMessage: extractResult.errorMessage
  });
}

async function sendCodeQuestion(): Promise<void> {
  const question = codeQuestionDraft.trim();
  if (!activeRepository) {
    codeQuestionError = '请先打开仓库';
    renderCodeQaHistory();
    return;
  }
  if (!question) {
    codeQuestionError = '请输入代码问题';
    renderCodeQaHistory();
    return;
  }

  codeQuestionError = null;
  const round = createCodeRound(activeRepository, question);
  const isFollowUp = codeRounds.length > 0;
  codeRounds = [...codeRounds, round];
  renderCodeQaHistory();

  await Promise.all(
    Array.from(codePanes.values()).map((pane) =>
      runCodeQaForPane(pane, round.id, question, isFollowUp)
    )
  );
}

codeQuestionInput.addEventListener('input', (event) => {
  codeQuestionDraft = (event.currentTarget as HTMLInputElement).value;
});

codeQuestionSendButton.addEventListener('click', () => {
  void sendCodeQuestion();
});

const submitCodeRepository = () => {
  const parsed = normalizeGitHubRepositoryInput(draftRepositoryInput);
  if (!parsed.ok) {
    codeInputError = parsed.errorMessage;
    renderCodeRepositoryMeta();
    return;
  }

  const repositoryChanged = activeRepository !== parsed.repository;
  if (repositoryChanged) {
    resetCodeRepositorySession(parsed.repository);
  } else {
    activeRepository = parsed.repository;
    codeInputError = null;
    renderCodeRepositoryMeta();
  }

  for (const pane of codePanes.values()) {
    if (repositoryChanged) {
      pane.webview.setAttribute('src', buildCodeSiteUrl(pane.site.id, parsed.repository));
      setCodePaneStatus(pane, 'loading');
    }
  }
};
```

```css
.code-qa-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.code-qa-input,
.code-qa-send-button {
  height: 42px;
  font: inherit;
}

.code-qa-input {
  min-width: 0;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.code-qa-send-button {
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: #111827;
  color: #fff;
}

.code-qa-error {
  min-height: 20px;
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
}

.code-qa-history {
  display: grid;
  gap: 12px;
  align-content: start;
}

.code-qa-round {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.code-qa-entry {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

@media (max-width: 720px) {
  .code-qa-toolbar {
    grid-template-columns: 1fr;
  }

  .code-qa-send-button {
    width: 100%;
  }
}
```

- [x] **Step 3: 运行渲染层测试，确认当前仓库会话与追问编排成立**

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `PASS`，至少覆盖以下行为：
- 无仓库发送问题时报错且不执行任何 code webview 脚本。
- 首问会向 Zread、DeepWiki、CodeWiki 三站并发发送，并创建一条 `code-qa-round`。
- 同仓库第二问不会触发三站 `loadURL()`，DeepWiki 改用 `textarea[data-deepwiki-input="followup"]`。
- 切换仓库后当前历史只保留新仓库轮次，旧仓库问题不再出现在当前视图。

- [x] **Step 4: 提交当前仓库会话、历史 UI 与发送编排**

```bash
git add src/renderer/app.ts src/renderer/styles.css tests/renderer/app.test.ts
git commit -m "feat: add code qa session history"
```

### Task 3: 接入代码问答导出并完成全量验证

**Files:**
- Modify: `src/renderer/app.ts`
- Modify: `tests/renderer/app.test.ts`
- Reference: `src/shared/exportMarkdown.ts`
- Reference: `src/shared/codeQa.ts`

**Interfaces:**
- Consumes:
  - `formatCodeQaMarkdownExport(repository: NormalizedRepository, rounds: readonly CodeQaExportRound[], exportedAt: Date): string`
  - `saveMarkdownExport(payload: MarkdownExportPayload): Promise<MarkdownExportResult>`
- Produces:
  - `async function exportCodeQaHistory(options: { repository: NormalizedRepository | null; rounds: readonly CodeRound[]; exportButton: HTMLButtonElement; setTopError: (message: string | null) => void }): Promise<void>`
  - `function updateExportButtonVisibility(): void`
  - 搜索导出继续使用既有 `exportAnswers(...)`，代码导出只在 `productTab === 'code'` 时触发

- [x] **Step 1: 先写失败测试，锁定代码导出仅包含当前仓库轮次、单站错误和空历史提示**

```ts
it('exports all rounds for the current repository and includes per-site errors', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  const saveMarkdownExport = vi.fn().mockResolvedValue({
    filePath: '/Users/coderxu/Downloads/code-qa-export.md'
  });
  window.mutiSearch = { saveMarkdownExport };

  createApp(root);
  const { executeJavaScriptMocks } = attachWebviewMocks(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const repositoryInput = root.querySelector(
    '[data-testid="code-repository-input"]'
  ) as HTMLInputElement;
  repositoryInput.value = 'obra/superpowers';
  repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
  (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

  executeJavaScriptMocks.slice(-3).forEach((mock, index) => {
    mock
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce(
        index === 2
          ? { status: 'ok', answerText: '', isBusy: false, errorMessage: '429 Too Many Requests' }
          : { status: 'ok', answerText: `round-1-answer-${index}`, isBusy: false, errorMessage: null }
      )
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({ status: 'ok', answerText: `round-2-answer-${index}`, isBusy: false, errorMessage: null });
  });

  const questionInput = root.querySelector(
    '[data-testid="code-question-input"]'
  ) as HTMLInputElement;
  const sendButton = root.querySelector(
    '[data-testid="code-question-send-button"]'
  ) as HTMLButtonElement;

  questionInput.value = '第一问';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  sendButton.click();
  await flushAsyncWork();

  questionInput.value = '第二问';
  questionInput.dispatchEvent(new Event('input', { bubbles: true }));
  sendButton.click();
  await flushAsyncWork();

  const exportButton = root.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
  exportButton.click();
  await flushPromises();
  await flushPromises();

  expect(saveMarkdownExport).toHaveBeenCalledTimes(1);
  const markdown = saveMarkdownExport.mock.calls[0]?.[0]?.markdown as string;
  expect(markdown).toContain('# muti-search 代码问答导出');
  expect(markdown).toContain('- 仓库：obra/superpowers');
  expect(markdown).toContain('## 第 1 轮');
  expect(markdown).toContain('## 第 2 轮');
  expect(markdown).toContain('错误：429 Too Many Requests');
  expect(markdown).toContain('### Zread');
  expect(markdown).toContain('### DeepWiki');
  expect(markdown).toContain('### CodeWiki');
});

it('does not call export ipc when the current repository has no code rounds', async () => {
  const root = document.querySelector('#app') as HTMLDivElement;
  const saveMarkdownExport = vi.fn();
  window.mutiSearch = { saveMarkdownExport };

  createApp(root);
  (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

  const exportButton = root.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
  exportButton.hidden = false;
  exportButton.click();
  await flushPromises();

  expect(saveMarkdownExport).not.toHaveBeenCalled();
  expect(root.querySelector('[data-top-error]')?.textContent).toContain('没有可导出的代码问答记录');
});
```

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `FAIL`，因为当前 `exportButton` 仍只导出搜索答案，或空历史情况下仍调用旧导出分支。

- [x] **Step 2: 在 `app.ts` 中把导出按钮分流到代码历史，并保持搜索导出不回归**

```ts
async function exportCodeQaHistory(options: {
  repository: NormalizedRepository | null;
  rounds: readonly CodeRound[];
  exportButton: HTMLButtonElement;
  setTopError: (message: string | null) => void;
}): Promise<void> {
  if (!options.repository || options.rounds.length === 0) {
    options.setTopError('没有可导出的代码问答记录');
    return;
  }

  const exportApi = window.mutiSearch;
  if (!exportApi) {
    options.setTopError('导出通道未就绪');
    return;
  }

  options.exportButton.disabled = true;
  options.exportButton.textContent = '导出中';
  options.setTopError(null);

  try {
    const markdown = formatCodeQaMarkdownExport(
      options.repository,
      options.rounds,
      new Date()
    );
    const result = await exportApi.saveMarkdownExport({ markdown });
    options.setTopError(`已导出：${result.filePath}`);
  } catch (error) {
    options.setTopError(toShortError(error));
  } finally {
    options.exportButton.disabled = false;
    options.exportButton.textContent = '导出 MD';
  }
}

function updateExportButtonVisibility(): void {
  if (productTab === 'code') {
    exportButton.hidden = codeRounds.length === 0;
    return;
  }

  exportButton.hidden = lastPrompt === null;
}

exportButton.addEventListener('click', () => {
  if (productTab === 'code') {
    void exportCodeQaHistory({
      repository: activeRepository,
      rounds: codeRounds,
      exportButton,
      setTopError
    });
    return;
  }

  void exportAnswers({
    prompt: lastPrompt,
    targetIds: lastTargetIds,
    panes,
    exportButton,
    setTopError
  });
});
```

- [ ] **Step 3: 运行针对性测试、全量验证和手动流程检查**

Run: `npm test -- tests/renderer/app.test.ts`

Expected: `PASS`，代码导出只包含当前仓库轮次，空历史不调用 IPC，搜索导出用例保持通过。

Run: `npm run typecheck`

Expected: `PASS`，`app.ts` 中新增 `CodeRound` / `CodeRoundEntry` / 导出分流无类型错误。

Run: `npm test`

Expected: `PASS`，包括 `tests/shared/codeQa.test.ts`、`tests/renderer/app.test.ts` 在内的全量 Vitest 通过。

Run: `npm run build`

Expected: `PASS`，Electron 主进程与 renderer 构建完成，无新增 bundle 错误。

手动验证（dev app 或 packaged app）：
- 打开 `obra/superpowers`，发送首问，确认三站出现回答、生成中或错误状态。
- 发送第二问，确认 Zread、DeepWiki、CodeWiki 都不回仓库主页，DeepWiki 保持在 `/search/...` 会话。
- 切换到另一个仓库，确认历史从空开始，旧仓库问题不再出现在当前列表。
- 点击 `导出 MD`，确认导出的 Markdown 只包含当前仓库全部轮次，且包含生成中状态和单站错误。

- [ ] **Step 4: 提交导出集成与最终验证结果**

```bash
git add src/renderer/app.ts tests/renderer/app.test.ts
git commit -m "feat: export code qa history"
```
