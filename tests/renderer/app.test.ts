import { beforeEach, describe, expect, it, vi } from 'vitest';
import { services } from '../../src/shared/services';
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
  const reloadMocks = webviews.map(() => vi.fn());

  webviews.forEach((webview, index) => {
    webview.executeJavaScript = executeJavaScriptMocks[index];
    webview.reload = reloadMocks[index];
  });

  return { webviews, executeJavaScriptMocks, reloadMocks };
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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders prompt input, send button, 9 toggles, and 9 webviews', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    expect(root.querySelector('input[type="text"]')).not.toBeNull();
    expect(root.querySelector('button[type="button"]')?.textContent).toContain('发送到已选');
    expect(root.querySelectorAll('input[type="checkbox"][data-service-toggle]')).toHaveLength(9);
    expect(root.querySelectorAll('webview')).toHaveLength(9);
  });

  it('sets persistent partition and src on every webview', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const webviews = Array.from(root.querySelectorAll('webview')) as MockWebview[];

    expect(webviews).toHaveLength(services.length);
    expect(
      webviews.map((webview) => ({
        partition: webview.getAttribute('partition'),
        src: webview.getAttribute('src')
      }))
    ).toEqual(
      services.map((service) => ({
        partition: service.partition,
        src: service.url
      }))
    );
  });

  it('sends only to selected and enabled webviews', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const enabledToggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-pane-enabled]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    for (const mock of executeJavaScriptMocks) {
      mock.mockResolvedValue({ status: 'sent', errorMessage: null });
    }

    toggles[1].click();
    enabledToggles[2].click();
    promptInput.value = 'hello renderer';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await flushPromises();

    expect(executeJavaScriptMocks[0]).toHaveBeenCalledTimes(1);
    expect(executeJavaScriptMocks[1]).not.toHaveBeenCalled();
    expect(executeJavaScriptMocks[2]).not.toHaveBeenCalled();
    expect(executeJavaScriptMocks.slice(3).every((mock) => mock.mock.calls.length === 1)).toBe(true);

    const calledScript = executeJavaScriptMocks[0].mock.calls[0]?.[0];
    expect(calledScript).toContain(JSON.stringify('hello renderer'));
  });

  it('shows top error for empty prompts', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;
    sendButton.click();

    expect(root.querySelector('[data-top-error]')?.textContent).toBe('请输入问题');
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
    expect(pane.getAttribute('data-layout')).toBe('grid');

    header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('expanded');

    webview.dispatchEvent(new MouseEvent('dblclick'));
    expect(pane.getAttribute('data-layout')).toBe('grid');
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
    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    for (const toggle of toggles.slice(1)) {
      toggle.click();
    }

    executeJavaScriptMocks[0].mockRejectedValue(new Error('boom failed'));

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
    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;
    const firstSend = createDeferred<unknown>();
    const secondSend = createDeferred<unknown>();

    for (const toggle of toggles.slice(1)) {
      toggle.click();
    }

    executeJavaScriptMocks[0]
      .mockReturnValueOnce(firstSend.promise)
      .mockReturnValueOnce(secondSend.promise);

    promptInput.value = 'first prompt';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    promptInput.value = 'second prompt';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    secondSend.resolve({ status: 'manual_required', errorMessage: 'latest result' });
    await flushPromises();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('latest result');

    firstSend.resolve({ status: 'sent', errorMessage: null });
    await flushPromises();

    expect(pane.getAttribute('data-status')).toBe('manual_required');
    expect(pane.querySelector('.pane-error')?.textContent).toBe('latest result');
  });
});
