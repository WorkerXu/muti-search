import {
  buildDomExtractAnswerScript,
  buildDomSendScript,
  type DomExtractAnswerScriptInput
} from './domScript.js';
import type { CodeSiteId, NormalizedRepository } from './codeSites.js';

export type CodeQaStatus =
  | 'pending'
  | 'sending'
  | 'generating'
  | 'completed'
  | 'manual_required'
  | 'error';

export type CodeQaSendResult =
  | { status: 'sent'; errorMessage: null }
  | { status: 'manual_required' | 'error'; errorMessage: string };

export type CodeQaExtractResult = {
  status: 'ok' | 'empty' | 'error';
  answerText: string;
  isBusy: boolean;
  errorMessage: string | null;
};

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

export type CodeQaSiteConfig = Readonly<{
  siteId: CodeSiteId;
  siteName: string;
  firstQuestionInputSelectors: readonly string[];
  followUpInputSelectors: readonly string[];
  submitSelectors: readonly string[];
  answerSelectors: readonly string[];
  busySelectors: readonly string[];
  activationSelectors?: readonly string[];
  activationTextPattern?: string;
  requiresFollowUpAfterFirstRound?: boolean;
}>;

const CODE_QA_SITE_ORDER = ['zread', 'deepwiki', 'codewiki'] as const;

function buildSelectorDebugComment(config: CodeQaSiteConfig, inputSelectors: readonly string[]) {
  return [
    '/* codeQa selectors:',
    `site=${config.siteId};`,
    `input=${inputSelectors.join(', ')};`,
    `submit=${config.submitSelectors.join(', ')};`,
    config.activationSelectors?.length
      ? `activation=${config.activationSelectors.join(', ')};`
      : null,
    '*/'
  ]
    .filter(Boolean)
    .join(' ');
}

export const codeQaSiteConfigs = Object.freeze([
  Object.freeze({
    siteId: 'zread',
    siteName: 'Zread',
    firstQuestionInputSelectors: Object.freeze(['textarea[placeholder="提出后续问题..."]']),
    followUpInputSelectors: Object.freeze(['textarea[placeholder="提出后续问题..."]']),
    submitSelectors: Object.freeze(['button[aria-label="Send message"]']),
    answerSelectors: Object.freeze(['main article', '[data-message-author-role="assistant"]']),
    busySelectors: Object.freeze([
      'button[aria-label="Stop generating"]',
      '[data-state="streaming"]'
    ]),
    activationSelectors: Object.freeze([
      'button[aria-label="Ask AI"]',
      'button[title="Ask AI"]',
      'button'
    ]),
    activationTextPattern: 'Ask AI'
  }),
  Object.freeze({
    siteId: 'deepwiki',
    siteName: 'DeepWiki',
    firstQuestionInputSelectors: Object.freeze(['textarea[data-deepwiki-input="question"]']),
    followUpInputSelectors: Object.freeze(['textarea[data-deepwiki-input="followup"]']),
    submitSelectors: Object.freeze(['button[type="submit"]']),
    answerSelectors: Object.freeze(['main article', '[data-deepwiki-answer]']),
    busySelectors: Object.freeze([
      '[data-deepwiki-busy="true"]',
      'button[aria-label="Stop generating"]'
    ]),
    requiresFollowUpAfterFirstRound: true
  }),
  Object.freeze({
    siteId: 'codewiki',
    siteName: 'CodeWiki',
    firstQuestionInputSelectors: Object.freeze(['#message-textarea']),
    followUpInputSelectors: Object.freeze(['#message-textarea']),
    submitSelectors: Object.freeze(['button[data-test-id="send-message-button"]']),
    answerSelectors: Object.freeze([
      '[data-test-id="agent-message"]',
      '[data-test-id="conversation-turn-answer"]',
      'main article'
    ]),
    busySelectors: Object.freeze([
      'button[aria-label="Stop generating"]',
      '[data-test-id="loading-answer"]'
    ]),
    activationSelectors: Object.freeze(['button[aria-label="Toggle chat"]']),
    activationTextPattern: 'Toggle chat|Chat'
  })
] as const satisfies readonly CodeQaSiteConfig[]);

export function getCodeQaSiteConfig(siteId: CodeSiteId): CodeQaSiteConfig {
  const config = codeQaSiteConfigs.find((item) => item.siteId === siteId);
  if (!config) {
    throw new Error(`Unknown code QA site id: ${siteId}`);
  }
  return config;
}

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
  const debugComment = buildSelectorDebugComment(config, inputSelectors);

  if (!config.activationSelectors?.length) {
    return `${debugComment}\n${sendScript}`;
  }

  const activationSelectors = JSON.stringify(config.activationSelectors);
  const activationTextPattern = JSON.stringify(config.activationTextPattern ?? '');
  return `${debugComment}
(async () => {
  const activationSelectors = ${activationSelectors};
  const activationTextPattern = ${activationTextPattern};
  const activationPattern = activationTextPattern ? new RegExp(activationTextPattern, 'i') : null;
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  for (const selector of activationSelectors) {
    let elements = [];
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch {
      continue;
    }

    const button = elements.find((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const semantic = [
        element.textContent,
        element.getAttribute('aria-label'),
        element.getAttribute('title')
      ].filter(Boolean).join(' ');
      return activationPattern ? activationPattern.test(semantic) : true;
    });

    if (button instanceof HTMLElement) {
      button.click();
      await sleep(250);
      break;
    }
  }

  return await ${sendScript};
})()
`;
}

export function buildCodeQaExtractScript(options: {
  siteId: CodeSiteId;
  question: string;
}): string {
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

    for (const siteId of CODE_QA_SITE_ORDER) {
      const entry = round.entries[siteId];
      lines.push(`### ${entry.siteName}`, '');

      if (entry.status === 'completed' && entry.answerText.trim()) {
        lines.push(entry.answerText.trim(), '');
        continue;
      }

      if (entry.status === 'generating') {
        lines.push('状态：生成中', '');
        if (entry.answerText.trim()) {
          lines.push(entry.answerText.trim(), '');
        }
        continue;
      }

      if (entry.errorMessage) {
        lines.push(`错误：${entry.errorMessage}`, '');
        continue;
      }

      lines.push(`状态：${entry.status}`, '');
    }
  });

  return `${lines.join('\n').trimEnd()}\n`;
}
