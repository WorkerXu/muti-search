import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDomActivateSubmitScript,
  buildDomExtractAnswerScript,
  buildDomPromptStateScript,
  buildDomSendTargetScript,
  buildDomSendScript
} from '../../src/shared/domScript';
import { codeSites } from '../../src/shared/codeSites';
import { getService, services } from '../../src/shared/services';
import { createApp } from '../../src/renderer/app';
import type { RendererWebviewElement } from '../../src/renderer/webviewTypes';

type MockWebview = HTMLDivElement & RendererWebviewElement;
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createMockExecuteJavaScript() {
  return vi.fn<(code: string, userGesture?: boolean) => Promise<unknown>>();
}

function attachWebviewMocks(root: HTMLDivElement) {
  const webviews = Array.from(root.querySelectorAll('webview')) as MockWebview[];

  const executeJavaScriptMocks = webviews.map(() => createMockExecuteJavaScript());
  const insertTextMocks = webviews.map(() => vi.fn<(text: string) => Promise<void>>());
  const loadURLMocks = webviews.map(() => vi.fn<(url: string) => Promise<void>>());
  const reloadMocks = webviews.map(() => vi.fn());
  const replaceMocks = webviews.map(() => vi.fn<(text: string) => void>());
  const selectAllMocks = webviews.map(() => vi.fn<() => void>());
  const sendInputEventMocks = webviews.map(() => vi.fn<(event: unknown) => Promise<void>>());

  webviews.forEach((webview, index) => {
    webview.executeJavaScript = executeJavaScriptMocks[index];
    webview.insertText = insertTextMocks[index];
    webview.loadURL = loadURLMocks[index];
    webview.reload = reloadMocks[index];
    webview.replace = replaceMocks[index];
    webview.selectAll = selectAllMocks[index];
    webview.sendInputEvent = sendInputEventMocks[index];
  });

  return {
    webviews,
    executeJavaScriptMocks,
    insertTextMocks,
    loadURLMocks,
    reloadMocks,
    replaceMocks,
    selectAllMocks,
    sendInputEventMocks
  };
}

function codeWebviewsFrom(root: HTMLDivElement): MockWebview[] {
  return Array.from(
    root.querySelectorAll('[data-testid^="code-site-pane-"] webview')
  ) as MockWebview[];
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function mockSuccessfulSends(executeJavaScriptMocks: ReturnType<typeof createMockExecuteJavaScript>[]) {
  services.forEach((service, index) => {
    if (service.send.mode === 'physical') {
      const mock = executeJavaScriptMocks[index]
        .mockResolvedValueOnce({
          status: 'ok',
          rect: { x: 10, y: 20, width: 200, height: 40 },
          errorMessage: null
        })
        .mockResolvedValueOnce({
          status: 'ok',
          hasPrompt: true,
          errorMessage: null
        });

      if (service.send.submitStrategy === 'button-only') {
        mock.mockResolvedValueOnce({
          status: 'activated',
          errorMessage: null
        });
        return;
      }

      mock
        .mockResolvedValueOnce({
          status: 'ok',
          rect: { x: 250, y: 20, width: 40, height: 40 },
          errorMessage: null
        })
        .mockResolvedValueOnce({
          status: 'ok',
          hasPrompt: false,
          errorMessage: null
        });
      return;
    }

    executeJavaScriptMocks[index].mockResolvedValue({ status: 'sent', errorMessage: null });
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushAsyncWork() {
  await flushPromises();
  await new Promise((resolve) => window.setTimeout(resolve, 400));
  await flushPromises();
}

async function flushPhysicalSendWork() {
  for (let index = 0; index < 7; index += 1) {
    await flushAsyncWork();
  }
}

describe('createApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    delete window.mutiSearch;
  });

  it('renders prompt input, send button, service toggles, and webviews', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    expect(root.querySelector('input[type="text"]')).not.toBeNull();
    expect(root.querySelector('button[type="button"]')?.textContent).toContain('发送到已选');
    expect((root.querySelector('[data-testid="export-button"]') as HTMLButtonElement).hidden).toBe(
      true
    );
    expect(root.querySelector('[data-testid="settings-button"]')?.textContent).toBe('设置');
    expect(root.querySelectorAll('input[type="checkbox"][data-service-toggle]')).toHaveLength(
      services.length
    );
    expect(root.querySelectorAll('webview')).toHaveLength(services.length + codeSites.length);
  });

  it('opens read-only runtime data settings and lists static paths', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const settingsButton = root.querySelector(
      '[data-testid="settings-button"]'
    ) as HTMLButtonElement;
    settingsButton.click();

    const overlay = root.querySelector('[data-testid="settings-overlay"]') as HTMLElement;
    const pathList = root.querySelector('[data-testid="runtime-path-list"]') as HTMLElement;

    expect(overlay.hidden).toBe(false);
    expect(root.querySelector('.settings-note')?.textContent).toContain('不访问目录');
    expect(pathList.textContent).toContain(
      '/Users/coderxu/Library/Application Support/muti-search/Partitions/chatgpt'
    );
    expect(pathList.textContent).toContain(
      '/Users/coderxu/Library/Application Support/muti-search/Partitions/perplexity'
    );
    expect(pathList.textContent).not.toContain('正在读取');
    expect(pathList.textContent).not.toContain('当前环境无法读取');
    expect(pathList.textContent).not.toContain('删除');
    expect(pathList.textContent).not.toContain('清理');
  });

  it('sets persistent partition but only navigates the visible search webview at startup', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const webviews = Array.from(root.querySelectorAll('[data-pane-id] webview')) as MockWebview[];

    expect(webviews).toHaveLength(services.length);
    expect(
      webviews.map((webview) => ({
        partition: webview.getAttribute('partition'),
        src: webview.getAttribute('src')
      }))
    ).toEqual(
      services.map((service, index) => ({
        partition: service.partition,
        src: index === 0 ? service.url : null
      }))
    );
    expect(root.querySelector('[data-pane-id="chatgpt"]')?.getAttribute('data-status')).toBe(
      'loading'
    );
    expect(root.querySelector('[data-pane-id="deepseek"]')?.getAttribute('data-status')).toBe(
      'unloaded'
    );
  });

  it('does not restart search navigation after a site redirects away from its home url', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const chatgptPane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLElement;
    const chatgptWebview = chatgptPane.querySelector('webview') as MockWebview;

    chatgptWebview.setAttribute('src', 'https://chatgpt.com/auth/login');
    chatgptWebview.dispatchEvent(new Event('dom-ready'));

    expect(chatgptWebview.getAttribute('src')).toBe('https://chatgpt.com/auth/login');
    expect(chatgptPane.getAttribute('data-status')).toBe('ready');
  });

  it('keeps an existing answer page when selecting a loaded search service tab', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const deepseekPane = root.querySelector('[data-pane-id="deepseek"]') as HTMLElement;
    const deepseekWebview = deepseekPane.querySelector('webview') as MockWebview;
    const deepseekTab = root.querySelector(
      '[data-sidebar-service="deepseek"]'
    ) as HTMLButtonElement;

    deepseekWebview.setAttribute('src', 'https://chat.deepseek.com/a/chat/s/answer-123');
    deepseekWebview.dispatchEvent(new Event('dom-ready'));

    deepseekTab.click();

    expect(deepseekPane.getAttribute('data-layout')).toBe('single-active');
    expect(deepseekWebview.getAttribute('src')).toBe(
      'https://chat.deepseek.com/a/chat/s/answer-123'
    );
  });

  it('defaults to the search product tab and hides the legacy view mode switch', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const appBody = root.querySelector('[data-testid="app-body"]') as HTMLElement;
    const searchTab = root.querySelector('[data-testid="product-tab-search"]') as HTMLButtonElement;
    const codeTab = root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement;

    expect(appBody.getAttribute('data-product-tab')).toBe('search');
    expect(searchTab.getAttribute('aria-pressed')).toBe('true');
    expect(codeTab.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[data-testid="view-mode-grid"]')).toBeNull();
    expect(root.querySelector('[data-testid="view-mode-single"]')).toBeNull();
    expect(root.querySelector('[data-testid="search-workflow"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="code-workflow"]')).not.toBeNull();
  });

  it('switches between search and code tabs while releasing the inactive workflow', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const originalWebviews = Array.from(root.querySelectorAll('webview'));
    const shell = root.querySelector('.app-shell') as HTMLElement;
    const appBody = root.querySelector('[data-testid="app-body"]') as HTMLElement;
    const searchTab = root.querySelector('[data-testid="product-tab-search"]') as HTMLButtonElement;
    const codeTab = root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement;
    const searchWorkflow = root.querySelector('[data-testid="search-workflow"]') as HTMLElement;
    const codeWorkflow = root.querySelector('[data-testid="code-workflow"]') as HTMLElement;
    const activePane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLElement;

    codeTab.click();

    expect(shell.getAttribute('data-product-tab')).toBe('code');
    expect(appBody.getAttribute('data-product-tab')).toBe('code');
    expect(searchTab.getAttribute('aria-pressed')).toBe('false');
    expect(codeTab.getAttribute('aria-pressed')).toBe('true');
    expect(searchWorkflow.hidden).toBe(true);
    expect(codeWorkflow.hidden).toBe(false);
    expect(activePane.closest('[hidden]')).toBe(searchWorkflow);
    expect(codeWorkflow.textContent).toContain('Zread');
    expect(Array.from(root.querySelectorAll('webview'))).toEqual(originalWebviews);
    expect((activePane.querySelector('webview') as MockWebview).getAttribute('src')).toBeNull();
    expect(activePane.getAttribute('data-status')).toBe('released');

    searchTab.click();

    expect(shell.getAttribute('data-product-tab')).toBe('search');
    expect(appBody.getAttribute('data-product-tab')).toBe('search');
    expect(searchTab.getAttribute('aria-pressed')).toBe('true');
    expect(searchWorkflow.hidden).toBe(false);
    expect(codeWorkflow.hidden).toBe(true);
    expect((activePane.querySelector('webview') as MockWebview).getAttribute('src')).toBe(
      getService('chatgpt').url
    );
  });

  it('keeps the search workflow in single-pane mode and reuses existing webviews', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const originalWebviews = Array.from(root.querySelectorAll('webview'));
    const chatgptPane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLElement;
    const deepseekPane = root.querySelector('[data-pane-id="deepseek"]') as HTMLElement;

    expect(root.querySelector('[data-testid="service-sidebar"]')).not.toBeNull();
    expect(chatgptPane.getAttribute('data-layout')).toBe('single-active');
    expect(deepseekPane.getAttribute('data-layout')).toBe('single-hidden');
    expect(root.querySelector('[data-testid="view-mode-grid"]')).toBeNull();
    expect(root.querySelector('[data-testid="view-mode-single"]')).toBeNull();
    expect(Array.from(root.querySelectorAll('webview'))).toEqual(originalWebviews);
  });

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

  it('keeps code site load failures visible after loading stops', () => {
    const root = document.querySelector('#app') as HTMLDivElement;
    createApp(root);

    (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

    const input = root.querySelector('[data-testid="code-repository-input"]') as HTMLInputElement;
    const button = root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement;
    input.value = 'obra/superpowers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();

    const deepwikiPane = root.querySelector(
      '[data-testid="code-site-pane-deepwiki"]'
    ) as HTMLElement;
    const deepwikiWebview = deepwikiPane.querySelector('webview') as MockWebview;
    const statusDot = deepwikiPane.querySelector('.pane-status-dot') as HTMLSpanElement;

    deepwikiWebview.dispatchEvent(
      new CustomEvent('did-fail-load', {
        detail: { errorDescription: 'net::ERR_NAME_NOT_RESOLVED' }
      })
    );
    deepwikiWebview.dispatchEvent(new Event('did-stop-loading'));

    expect(deepwikiPane.getAttribute('data-status')).toBe('error');
    expect(statusDot.getAttribute('data-status')).toBe('error');
    expect(statusDot.getAttribute('aria-label')).toBe('加载失败');
    expect(deepwikiPane.querySelector('.code-site-error')?.textContent).toContain(
      'net::ERR_NAME_NOT_RESOLVED'
    );
  });

  it('shows an error and skips all code webviews when no repository is active', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;
    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();

    const questionInput = root.querySelector(
      '[data-testid="code-question-input"]'
    ) as HTMLInputElement;
    const sendQuestionButton = root.querySelector(
      '[data-testid="code-question-send-button"]'
    ) as HTMLButtonElement;

    questionInput.value = '这个项目的核心架构是什么？';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendQuestionButton.click();
    await flushPromises();

    expect(root.querySelector('[data-testid="code-qa-error"]')?.textContent).toContain(
      '请先打开仓库'
    );
    expect(executeJavaScriptMocks.slice(-3).every((mock) => mock.mock.calls.length === 0)).toBe(
      true
    );
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

  it('keeps polling code site answers when extraction is initially empty', async () => {
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
    codeMocks[0]
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'zread answer',
        isBusy: false,
        errorMessage: null
      });
    codeMocks[1]
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'deepwiki answer',
        isBusy: false,
        errorMessage: null
      });
    codeMocks[2]
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'empty',
        answerText: '',
        isBusy: false,
        errorMessage: '未读取到回答'
      })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'codewiki delayed answer',
        isBusy: false,
        errorMessage: null
      });

    const questionInput = root.querySelector(
      '[data-testid="code-question-input"]'
    ) as HTMLInputElement;
    questionInput.value = '第一问';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));
    (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
    await flushAsyncWork();

    const codewikiEntry = Array.from(root.querySelectorAll('.code-qa-entry')).find((entry) =>
      entry.textContent?.includes('CodeWiki')
    ) as HTMLElement | undefined;

    expect(codeMocks[2]).toHaveBeenCalledTimes(3);
    expect(codewikiEntry?.dataset.status).toBe('completed');
    expect(codewikiEntry?.textContent).toContain('codewiki delayed answer');
  });

  it('marks one code site as error when its injected script times out', async () => {
    vi.useFakeTimers();

    try {
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
      codeMocks[0].mockReturnValue(new Promise(() => {}));
      codeMocks[1]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'deepwiki answer',
          isBusy: false,
          errorMessage: null
        });
      codeMocks[2]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'codewiki answer',
          isBusy: false,
          errorMessage: null
        });

      const questionInput = root.querySelector(
        '[data-testid="code-question-input"]'
      ) as HTMLInputElement;
      questionInput.value = '第一问';
      questionInput.dispatchEvent(new Event('input', { bubbles: true }));
      (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();

      await flushPromises();
      await vi.advanceTimersByTimeAsync(20_100);
      await flushPromises();

      const zreadEntry = Array.from(root.querySelectorAll('.code-qa-entry')).find((entry) =>
        entry.textContent?.includes('Zread')
      ) as HTMLElement | undefined;
      const codewikiEntry = Array.from(root.querySelectorAll('.code-qa-entry')).find((entry) =>
        entry.textContent?.includes('CodeWiki')
      ) as HTMLElement | undefined;

      expect(zreadEntry?.dataset.status).toBe('error');
      expect(zreadEntry?.textContent).toContain('代码站点脚本执行超时');
      expect(codewikiEntry?.dataset.status).toBe('completed');
      expect(codewikiEntry?.textContent).toContain('codewiki answer');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not let an old in-flight code question reveal export after repository changes', async () => {
    vi.useFakeTimers();

    try {
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
      const exportButton = root.querySelector('[data-testid="export-button"]') as HTMLButtonElement;

      repositoryInput.value = 'obra/superpowers';
      repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
      (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

      const codeMocks = executeJavaScriptMocks.slice(-3);
      codeMocks[0].mockReturnValue(new Promise(() => {}));
      codeMocks[1]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'deepwiki answer',
          isBusy: false,
          errorMessage: null
        });
      codeMocks[2]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'codewiki answer',
          isBusy: false,
          errorMessage: null
        });

      questionInput.value = '旧仓库问题';
      questionInput.dispatchEvent(new Event('input', { bubbles: true }));
      (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
      await flushPromises();

      expect(exportButton.hidden).toBe(false);

      repositoryInput.value = 'openai/openai-node';
      repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
      (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();
      expect(exportButton.hidden).toBe(true);

      await vi.advanceTimersByTimeAsync(20_100);
      await flushPromises();

      expect(exportButton.hidden).toBe(true);
      expect(root.querySelectorAll('[data-testid="code-qa-round"]')).toHaveLength(0);
      expect(root.querySelector('[data-testid="code-repository-current"]')?.textContent).toContain(
        'openai/openai-node'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a code site generating when answer extraction stays busy but empty', async () => {
    vi.useFakeTimers();

    try {
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
      codeMocks[0]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'zread answer',
          isBusy: false,
          errorMessage: null
        });
      codeMocks[1]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'deepwiki answer',
          isBusy: false,
          errorMessage: null
        });
      codeMocks[2]
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValue({
          status: 'empty',
          answerText: '',
          isBusy: true,
          errorMessage: '回答可能仍在生成中'
        });

      const questionInput = root.querySelector(
        '[data-testid="code-question-input"]'
      ) as HTMLInputElement;
      questionInput.value = '第一问';
      questionInput.dispatchEvent(new Event('input', { bubbles: true }));
      (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();

      await flushPromises();
      await vi.advanceTimersByTimeAsync(30_000);
      await flushPromises();

      const codewikiEntry = Array.from(root.querySelectorAll('.code-qa-entry')).find((entry) =>
        entry.textContent?.includes('CodeWiki')
      ) as HTMLElement | undefined;

      expect(codewikiEntry?.dataset.status).toBe('generating');
      expect(codewikiEntry?.textContent).toContain('回答可能仍在生成中');
    } finally {
      vi.useRealTimers();
    }
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
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'round-1',
          isBusy: false,
          errorMessage: null
        })
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'round-2',
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

    questionInput.value = '第二问';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));
    (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
    await flushAsyncWork();

    expect(root.querySelectorAll('[data-testid="code-qa-round"]')).toHaveLength(2);
    expect(loadURLMocks.slice(-3).every((mock) => mock.mock.calls.length === 0)).toBe(true);
    expect(codeMocks[1].mock.calls[2]?.[0]).toContain(
      'textarea[data-deepwiki-input="followup"]'
    );
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
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'old answer',
          isBusy: false,
          errorMessage: null
        })
        .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
        .mockResolvedValueOnce({
          status: 'ok',
          answerText: 'new answer',
          isBusy: false,
          errorMessage: null
        });
    });

    questionInput.value = '旧仓库问题';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));
    (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
    await flushAsyncWork();

    repositoryInput.value = 'openai/openai-node';
    repositoryInput.dispatchEvent(new Event('input', { bubbles: true }));
    (root.querySelector('[data-testid="code-open-button"]') as HTMLButtonElement).click();

    expect((root.querySelector('[data-testid="export-button"]') as HTMLButtonElement).hidden).toBe(
      true
    );

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

  it('shows a code export error without calling ipc when the current repository has no rounds', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;
    const saveMarkdownExport = vi.fn();
    window.mutiSearch = { saveMarkdownExport };
    createApp(root);

    (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();
    (root.querySelector('[data-testid="export-button"]') as HTMLButtonElement).click();

    await flushPromises();

    expect(saveMarkdownExport).not.toHaveBeenCalled();
    expect(root.querySelector('[data-top-error]')?.textContent).toBe('没有可导出的代码问答记录');
  });

  it('exports current repository code qa rounds with stored answers and site errors', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;
    const saveMarkdownExport = vi.fn().mockResolvedValue({
      filePath: '/Users/coderxu/Downloads/muti-search-export.md'
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

    const codeMocks = executeJavaScriptMocks.slice(-3);
    codeMocks[0]
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'Zread stored answer',
        isBusy: false,
        errorMessage: null
      });
    codeMocks[1]
      .mockResolvedValueOnce({ status: 'sent', errorMessage: null })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'DeepWiki partial answer',
        isBusy: true,
        errorMessage: null
      });
    codeMocks[2].mockResolvedValueOnce({
      status: 'manual_required',
      errorMessage: '服务视图未就绪'
    });

    const questionInput = root.querySelector(
      '[data-testid="code-question-input"]'
    ) as HTMLInputElement;
    questionInput.value = '这个项目的核心架构是什么？';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));
    (root.querySelector('[data-testid="code-question-send-button"]') as HTMLButtonElement).click();
    await flushAsyncWork();

    (root.querySelector('[data-testid="product-tab-search"]') as HTMLButtonElement).click();
    expect(codeWebviewsFrom(root).map((webview) => webview.getAttribute('src'))).toEqual([
      null,
      null,
      null
    ]);

    (root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement).click();
    expect(codeWebviewsFrom(root).map((webview) => webview.getAttribute('src'))).toEqual([
      'https://zread.ai/obra/superpowers',
      'https://deepwiki.com/obra/superpowers',
      'https://codewiki.google/github.com/obra/superpowers'
    ]);

    const exportButton = root.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
    expect(exportButton.hidden).toBe(false);
    exportButton.click();
    await flushPromises();

    expect(saveMarkdownExport).toHaveBeenCalledTimes(1);
    const markdown = saveMarkdownExport.mock.calls[0]?.[0]?.markdown as string;
    expect(markdown).toContain('# muti-search 代码问答导出');
    expect(markdown).toContain('- 仓库：obra/superpowers');
    expect(markdown).toContain('## 第 1 轮');
    expect(markdown).toContain('这个项目的核心架构是什么？');
    expect(markdown).toContain('Zread stored answer');
    expect(markdown).toContain('状态：生成中');
    expect(markdown).toContain('DeepWiki partial answer');
    expect(markdown).toContain('错误：服务视图未就绪');
    expect(root.querySelector('[data-top-error]')?.textContent).toContain('已导出：');
  });

  it('selects the active large site from the sidebar and keeps sidebar state in sync', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const geminiRow = root.querySelector('[data-sidebar-service="gemini"]') as HTMLButtonElement;
    geminiRow.click();

    expect(geminiRow.getAttribute('aria-current')).toBe('true');
    expect(root.querySelector('[data-pane-id="gemini"]')?.getAttribute('data-layout')).toBe(
      'single-active'
    );
    expect(
      (root.querySelector('[data-pane-id="gemini"] webview') as MockWebview).getAttribute('src')
    ).toBe(getService('gemini').url);
    expect(root.querySelector('[data-pane-id="chatgpt"]')?.getAttribute('data-layout')).toBe(
      'single-hidden'
    );

    const sidebarEnabled = root.querySelector(
      '[data-sidebar-enabled="gemini"]'
    ) as HTMLInputElement;
    const paneEnabled = root.querySelector('[data-pane-enabled="gemini"]') as HTMLInputElement;

    sidebarEnabled.click();

    expect(sidebarEnabled.checked).toBe(false);
    expect(paneEnabled.checked).toBe(false);
    expect(root.querySelector('[data-pane-id="gemini"]')?.getAttribute('data-enabled')).toBe(
      'false'
    );
  });

  it('sends only to selected and enabled webviews', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks, loadURLMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const enabledToggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-pane-enabled]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    mockSuccessfulSends(executeJavaScriptMocks);

    toggles[1].click();
    enabledToggles[2].click();
    promptInput.value = 'hello renderer';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPromises();

    expect(loadURLMocks[0]).toHaveBeenCalledWith(getService('chatgpt').url);
    expect(loadURLMocks[1]).not.toHaveBeenCalled();
    expect(loadURLMocks[2]).not.toHaveBeenCalled();
    expect(loadURLMocks.slice(3, services.length).every((mock) => mock.mock.calls.length === 1))
      .toBe(true);
    expect(executeJavaScriptMocks[0]).toHaveBeenCalled();
    expect(executeJavaScriptMocks[1]).not.toHaveBeenCalled();
    expect(executeJavaScriptMocks[2]).not.toHaveBeenCalled();
    expect(
      executeJavaScriptMocks.slice(3, services.length).every((mock) => mock.mock.calls.length >= 1)
    ).toBe(true);

    const doubaoScript = executeJavaScriptMocks[3].mock.calls[0]?.[0];
    expect(doubaoScript).toContain(JSON.stringify('hello renderer'));
    expect(loadURLMocks[3].mock.invocationCallOrder[0]).toBeLessThan(
      executeJavaScriptMocks[3].mock.invocationCallOrder[0]
    );
  });

  it('uses each service send selector config when building the dom script', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks, loadURLMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;
    const doubao = getService('doubao') as (typeof services)[number] & {
      send: {
        inputSelectors: string[];
        submitSelectors: string[];
      };
    };

    for (const mock of executeJavaScriptMocks) {
      mock.mockResolvedValue({ status: 'sent', errorMessage: null });
    }

    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'doubao') {
        toggle.click();
      }
    }

    promptInput.value = 'hello doubao';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPromises();

    expect(executeJavaScriptMocks[3]).toHaveBeenCalledTimes(1);
    expect(loadURLMocks[3]).toHaveBeenCalledWith(doubao.url);
    expect(loadURLMocks[3].mock.invocationCallOrder[0]).toBeLessThan(
      executeJavaScriptMocks[3].mock.invocationCallOrder[0]
    );
    expect(executeJavaScriptMocks[3].mock.calls[0]?.[0]).toBe(
      buildDomSendScript({
        prompt: 'hello doubao',
        inputSelectors: doubao.send.inputSelectors,
        submitSelectors: doubao.send.submitSelectors
      })
    );
  });

  it('uses physical webview input for services that reject dom-only clicks', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const {
      executeJavaScriptMocks,
      insertTextMocks,
      replaceMocks,
      selectAllMocks,
      sendInputEventMocks
    } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('发送到已选')
    ) as HTMLButtonElement;
    const grok = getService('grok');

    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'grok') {
        toggle.click();
      }
    }

    executeJavaScriptMocks[2]
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 10, y: 20, width: 200, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'activated',
        errorMessage: null
      });

    promptInput.value = 'physical hello';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPhysicalSendWork();

    expect(executeJavaScriptMocks[2].mock.calls[0]?.[0]).toBe(
      buildDomSendTargetScript({
        inputSelectors: grok.send.inputSelectors,
        submitSelectors: grok.send.submitSelectors,
        target: 'input'
      })
    );
    expect(executeJavaScriptMocks[2].mock.calls[1]?.[0]).toBe(
      buildDomPromptStateScript({
        prompt: 'physical hello',
        inputSelectors: grok.send.inputSelectors
      })
    );
    expect(executeJavaScriptMocks[2].mock.calls[2]?.[0]).toBe(
      buildDomActivateSubmitScript({
        inputSelectors: grok.send.inputSelectors,
        submitSelectors: grok.send.submitSelectors,
        requireExplicitSubmit: true
      })
    );
    expect(executeJavaScriptMocks[2]).toHaveBeenCalledTimes(3);
    expect(selectAllMocks[2]).toHaveBeenCalledTimes(1);
    expect(insertTextMocks[2]).toHaveBeenCalledWith('physical hello');
    expect(replaceMocks[2]).not.toHaveBeenCalled();
    expect(sendInputEventMocks[2]).toHaveBeenCalledTimes(3);
    expect(sendInputEventMocks[2].mock.calls.map((call) => call[0])).toEqual([
      { type: 'mouseMove', x: 110, y: 40 },
      { type: 'mouseDown', x: 110, y: 40, button: 'left', clickCount: 1 },
      { type: 'mouseUp', x: 110, y: 40, button: 'left', clickCount: 1 }
    ]);
  });

  it('falls back to pressing Enter when submit clicks leave the prompt in the input', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks, sendInputEventMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('发送到已选')
    ) as HTMLButtonElement;

    const perplexityIndex = services.findIndex((service) => service.id === 'perplexity');
    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'perplexity') {
        toggle.click();
      }
    }

    executeJavaScriptMocks[perplexityIndex]
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 10, y: 20, width: 200, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 250, y: 20, width: 40, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'activated',
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      });

    promptInput.value = 'enter fallback hello';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPhysicalSendWork();

    expect(sendInputEventMocks[perplexityIndex].mock.calls.map((call) => call[0]).slice(-3)).toEqual([
      { type: 'rawKeyDown', keyCode: 'Enter', modifiers: ['meta'] },
      { type: 'keyDown', keyCode: 'Enter', modifiers: ['meta'] },
      { type: 'keyUp', keyCode: 'Enter', modifiers: ['meta'] }
    ]);
  });

  it('reports manual required when every submit strategy leaves the prompt in place', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="perplexity"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('发送到已选')
    ) as HTMLButtonElement;

    const perplexityIndex = services.findIndex((service) => service.id === 'perplexity');
    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'perplexity') {
        toggle.click();
      }
    }

    executeJavaScriptMocks[perplexityIndex]
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 10, y: 20, width: 200, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 250, y: 20, width: 40, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'activated',
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: true,
        errorMessage: null
      });

    promptInput.value = 'manual required hello';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPhysicalSendWork();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toContain('已填入但未触发发送');
    expect(pane.querySelector('.pane-error')?.textContent).toContain('prompt-still-present');
  });

  it('shows top error for empty prompts', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;
    sendButton.click();

    expect(root.querySelector('[data-top-error]')?.textContent).toBe('请输入问题');
  });

  it('shows export after sending and saves selected answers as markdown', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;
    const saveMarkdownExport = vi.fn().mockResolvedValue({
      filePath: '/Users/coderxu/Downloads/muti-search-export.md'
    });
    window.mutiSearch = { saveMarkdownExport };

    createApp(root);

    const { executeJavaScriptMocks, loadURLMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('发送到已选')
    ) as HTMLButtonElement;
    const exportButton = root.querySelector('[data-testid="export-button"]') as HTMLButtonElement;
    const chatgpt = getService('chatgpt');

    for (const toggle of toggles.slice(1)) {
      toggle.click();
    }

    executeJavaScriptMocks[0]
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 10, y: 20, width: 200, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        rect: { x: 250, y: 20, width: 40, height: 40 },
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        hasPrompt: false,
        errorMessage: null
      })
      .mockResolvedValueOnce({
        status: 'ok',
        answerText: 'ChatGPT answer',
        isBusy: false,
        errorMessage: null
      });

    promptInput.value = 'export this';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPhysicalSendWork();

    expect(exportButton.hidden).toBe(false);
    expect(loadURLMocks[0]).toHaveBeenCalledWith(chatgpt.url);
    exportButton.click();

    await flushPromises();
    await flushPromises();

    expect(executeJavaScriptMocks[0].mock.calls[4]?.[0]).toBe(
      buildDomExtractAnswerScript({
        prompt: 'export this',
        answerSelectors: chatgpt.answer.answerSelectors,
        busySelectors: chatgpt.answer.busySelectors
      })
    );
    expect(saveMarkdownExport).toHaveBeenCalledTimes(1);
    const markdown = saveMarkdownExport.mock.calls[0]?.[0]?.markdown as string;
    expect(markdown).toContain('# muti-search 导出');
    expect(markdown).toContain('## 问题');
    expect(markdown).toContain('export this');
    expect(markdown).toContain('## ChatGPT');
    expect(markdown).toContain('ChatGPT answer');
    expect(root.querySelector('[data-top-error]')?.textContent).toContain('已导出：');
  });

  it('toggles enlarged pane on header, pane body, and webview double click', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const header = pane.querySelector('[data-pane-header]') as HTMLDivElement;
    const body = pane.querySelector('.pane-body') as HTMLDivElement;
    const webview = pane.querySelector('webview') as MockWebview;

    header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('expanded');

    body.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('single-active');

    header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('expanded');

    webview.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('single-active');
  });

  it('toggles enlarged pane with the visible expand and restore button', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const button = pane.querySelector('[data-pane-expand="chatgpt"]') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe('放大');
    button.click();
    expect(pane.getAttribute('data-layout')).toBe('expanded');
    expect(button.getAttribute('aria-label')).toBe('还原');

    button.click();
    expect(pane.getAttribute('data-layout')).toBe('single-active');
    expect(button.getAttribute('aria-label')).toBe('放大');
  });

  it('reloads a pane back to its configured home url', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { webviews, loadURLMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="grok"]') as HTMLDivElement;
    const button = pane.querySelector('[data-pane-home="grok"]') as HTMLButtonElement;
    const grok = getService('grok');

    webviews[2].setAttribute('src', 'https://x.com/home');
    webviews[2].dispatchEvent(new Event('dom-ready'));
    expect(pane.getAttribute('data-status')).toBe('ready');

    loadURLMocks[2].mockResolvedValue();
    button.click();

    await flushPromises();

    expect(loadURLMocks[2]).toHaveBeenCalledWith(grok.url);
    expect(pane.getAttribute('data-status')).toBe('loading');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('');
  });

  it('falls back to resetting webview src when loadURL is unavailable', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { webviews } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="grok"]') as HTMLDivElement;
    const button = pane.querySelector('[data-pane-home="grok"]') as HTMLButtonElement;
    const grok = getService('grok');

    webviews[2].setAttribute('src', 'https://x.com/home');
    delete webviews[2].loadURL;

    button.click();

    expect(webviews[2].getAttribute('src')).toBe(grok.url);
    expect(pane.getAttribute('data-status')).toBe('loading');
  });

  it('re-enables a loaded pane as ready without reloading it', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { webviews, reloadMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const enabledToggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-pane-enabled]')
    ) as HTMLInputElement[];

    webviews[0].dispatchEvent(new Event('dom-ready'));
    expect(pane.getAttribute('data-status')).toBe('ready');

    enabledToggles[0].click();
    expect(pane.getAttribute('data-status')).toBe('disabled');

    enabledToggles[0].click();
    expect(pane.getAttribute('data-status')).toBe('ready');
    expect(reloadMocks[0]).not.toHaveBeenCalled();
  });

  it('marks a pane as manual_required when the webview api is not ready', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { webviews, executeJavaScriptMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    for (const toggle of toggles.slice(1)) {
      toggle.click();
    }

    delete (webviews[0] as Partial<RendererWebviewElement>).executeJavaScript;
    executeJavaScriptMocks[0].mockResolvedValue({ status: 'sent', errorMessage: null });

    promptInput.value = 'needs manual send';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPromises();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('服务视图未就绪');
  });

  it('marks a pane as error when executeJavaScript rejects', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="deepseek"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'deepseek') {
        toggle.click();
      }
    }

    executeJavaScriptMocks[1].mockRejectedValue(new Error('boom failed'));

    promptInput.value = 'reject please';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPromises();

    expect(pane.getAttribute('data-status')).toBe('error');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('boom failed');
  });

  it('keeps the latest send result when older sends finish later', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    const pane = root.querySelector('[data-pane-id="deepseek"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;
    const firstSend = createDeferred<unknown>();
    const secondSend = createDeferred<unknown>();

    for (const toggle of toggles) {
      if (toggle.dataset.serviceToggle !== 'deepseek') {
        toggle.click();
      }
    }

    executeJavaScriptMocks[1]
      .mockReturnValueOnce(firstSend.promise)
      .mockReturnValueOnce(secondSend.promise);

    promptInput.value = 'first prompt';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();
    await flushPromises();

    promptInput.value = 'second prompt';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    secondSend.resolve({ status: 'manual_required', errorMessage: 'latest result' });
    await flushAsyncWork();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('latest result');

    firstSend.resolve({ status: 'sent', errorMessage: null });
    await flushAsyncWork();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('latest result');
  });
});
