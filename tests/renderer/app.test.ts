import { beforeEach, describe, expect, it, vi } from 'vitest';
import { services } from '../../src/shared/services';
import { createApp } from '../../src/renderer/app';
import type { RendererWebviewElement } from '../../src/renderer/webviewTypes';

type MockWebview = HTMLDivElement & RendererWebviewElement;

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

  it('sends only to selected webviews', async () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const { executeJavaScriptMocks } = attachWebviewMocks(root);
    const promptInput = root.querySelector('input[type="text"]') as HTMLInputElement;
    const toggles = Array.from(
      root.querySelectorAll('input[type="checkbox"][data-service-toggle]')
    ) as HTMLInputElement[];
    const sendButton = root.querySelector('button[type="button"]') as HTMLButtonElement;

    executeJavaScriptMocks[0].mockResolvedValue({ status: 'sent', errorMessage: null });
    executeJavaScriptMocks[1].mockResolvedValue({ status: 'sent', errorMessage: null });
    executeJavaScriptMocks[2].mockResolvedValue({ status: 'sent', errorMessage: null });

    toggles[1].click();
    promptInput.value = 'hello renderer';
    promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(executeJavaScriptMocks[0]).toHaveBeenCalledTimes(1);
    expect(executeJavaScriptMocks[1]).not.toHaveBeenCalled();
    expect(executeJavaScriptMocks[2]).toHaveBeenCalledTimes(1);
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

  it('toggles enlarged pane on header and pane body double click', () => {
    const root = document.querySelector('#app') as HTMLDivElement;

    createApp(root);

    const pane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLDivElement;
    const header = pane.querySelector('[data-pane-header]') as HTMLDivElement;
    const body = pane.querySelector('.pane-body') as HTMLDivElement;

    header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('expanded');

    body.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(pane.getAttribute('data-layout')).toBe('grid');
  });
});
