import { buildDomSendScript, type DomSendScriptResult } from '../shared/domScript';
import { services, type ServiceDefinition, type ServiceId } from '../shared/services';
import {
  createInitialPaneState,
  statusLabels,
  type PaneState
} from '../shared/status';
import type { RendererWebviewElement } from './webviewTypes';

const DEFAULT_INPUT_SELECTORS = ['textarea', '[contenteditable="true"]', 'div[role="textbox"]'];
const DEFAULT_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="发送"]',
  'button[data-testid*="send"]'
];

type PaneRuntime = {
  service: ServiceDefinition;
  state: PaneState;
  hasDomReady: boolean;
  sendGeneration: number;
  article: HTMLElement;
  header: HTMLElement;
  selectedToggle: HTMLInputElement;
  enabledToggle: HTMLInputElement;
  enabledText: HTMLSpanElement;
  statusDot: HTMLSpanElement;
  errorText: HTMLSpanElement;
  webview: RendererWebviewElement;
};

export function createApp(root: HTMLDivElement): void {
  root.innerHTML = '';

  let expandedPaneId: ServiceId | null = null;
  const panes = new Map<ServiceId, PaneRuntime>();

  const shell = document.createElement('main');
  shell.className = 'app-shell';

  const heading = document.createElement('h1');
  heading.className = 'sr-only';
  heading.textContent = 'muti-search';
  shell.append(heading);

  const topBar = document.createElement('header');
  topBar.className = 'top-bar';
  shell.append(topBar);

  const promptInput = document.createElement('input');
  promptInput.type = 'text';
  promptInput.className = 'prompt-input';
  promptInput.placeholder = '把同一个问题发给多个 AI 服务';
  promptInput.autocomplete = 'off';
  topBar.append(promptInput);

  const toggleStrip = document.createElement('div');
  toggleStrip.className = 'toggle-strip';
  topBar.append(toggleStrip);

  const sendButton = document.createElement('button');
  sendButton.type = 'button';
  sendButton.className = 'send-button';
  sendButton.textContent = '发送到已选';
  topBar.append(sendButton);

  const topError = document.createElement('p');
  topError.className = 'top-error';
  topError.dataset.topError = 'true';
  topError.setAttribute('aria-live', 'polite');
  shell.append(topError);

  const grid = document.createElement('section');
  grid.className = 'pane-grid';
  shell.append(grid);

  for (const service of services) {
    const selectedToggle = document.createElement('input');
    selectedToggle.type = 'checkbox';
    selectedToggle.checked = true;
    selectedToggle.dataset.serviceToggle = service.id;

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'service-toggle';
    toggleLabel.append(selectedToggle);

    const toggleText = document.createElement('span');
    toggleText.textContent = service.name;
    toggleLabel.append(toggleText);
    toggleStrip.append(toggleLabel);

    const paneState = createInitialPaneState();
    const article = document.createElement('article');
    article.className = 'service-pane';
    article.dataset.paneId = service.id;

    const header = document.createElement('div');
    header.className = 'pane-header';
    header.dataset.paneHeader = 'true';
    article.append(header);

    const name = document.createElement('span');
    name.className = 'pane-name';
    name.textContent = service.name;
    header.append(name);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'pane-enabled-toggle';
    header.append(enabledLabel);

    const enabledToggle = document.createElement('input');
    enabledToggle.type = 'checkbox';
    enabledToggle.checked = true;
    enabledToggle.dataset.paneEnabled = service.id;
    enabledLabel.append(enabledToggle);

    const enabledText = document.createElement('span');
    enabledLabel.append(enabledText);

    const statusDot = document.createElement('span');
    statusDot.className = 'pane-status-dot';
    header.append(statusDot);

    const errorText = document.createElement('span');
    errorText.className = 'pane-error';
    header.append(errorText);

    const body = document.createElement('div');
    body.className = 'pane-body';
    article.append(body);

    const webview = document.createElement('webview');
    webview.className = 'pane-webview';
    webview.setAttribute('src', service.url);
    webview.setAttribute('partition', service.partition);
    body.append(webview);

    const pane: PaneRuntime = {
      service,
      state: paneState,
      hasDomReady: false,
      sendGeneration: 0,
      article,
      header,
      selectedToggle,
      enabledToggle,
      enabledText,
      statusDot,
      errorText,
      webview
    };

    panes.set(service.id, pane);
    grid.append(article);

    selectedToggle.addEventListener('change', () => {
      pane.state.selected = selectedToggle.checked;
      renderPane(pane, expandedPaneId);
    });

    enabledToggle.addEventListener('change', () => {
      pane.state.enabled = enabledToggle.checked;
      pane.sendGeneration += 1;
      pane.state.status = enabledToggle.checked
        ? pane.hasDomReady
          ? 'ready'
          : 'loading'
        : 'disabled';
      pane.state.errorMessage = null;
      renderPane(pane, expandedPaneId);
    });

    const toggleExpanded = () => {
      expandedPaneId = expandedPaneId === service.id ? null : service.id;
      for (const item of panes.values()) {
        renderPane(item, expandedPaneId);
      }
    };

    header.addEventListener('dblclick', toggleExpanded);
    body.addEventListener('dblclick', toggleExpanded);
    webview.addEventListener('dblclick', toggleExpanded);

    webview.addEventListener('dom-ready', () => {
      pane.hasDomReady = true;

      if (!pane.state.enabled) {
        return;
      }

      if (pane.state.status === 'loading' || pane.state.status === 'error') {
        pane.state.status = 'ready';
        pane.state.errorMessage = null;
        renderPane(pane, expandedPaneId);
      }
    });

    webview.addEventListener('did-fail-load', (event: Event) => {
      if (!pane.state.enabled) {
        return;
      }

      const message =
        event instanceof CustomEvent && typeof event.detail?.errorDescription === 'string'
          ? event.detail.errorDescription
          : '加载失败';

      pane.state.status = 'error';
      pane.state.errorMessage = toShortError(message);
      renderPane(pane, expandedPaneId);
    });

    renderPane(pane, expandedPaneId);
  }

  promptInput.addEventListener('input', () => {
    setTopError(topError, null);
  });

  sendButton.addEventListener('click', () => {
    void sendPrompt({
      prompt: promptInput.value,
      panes,
      setTopError: (message) => setTopError(topError, message),
      getExpandedPaneId: () => expandedPaneId
    });
  });

  root.append(shell);
}

async function sendPrompt(options: {
  prompt: string;
  panes: Map<ServiceId, PaneRuntime>;
  setTopError: (message: string | null) => void;
  getExpandedPaneId: () => ServiceId | null;
}): Promise<void> {
  const prompt = options.prompt.trim();

  if (!prompt) {
    options.setTopError('请输入问题');
    return;
  }

  options.setTopError(null);

  const targets = Array.from(options.panes.values()).filter(
    (pane) => pane.state.selected && pane.state.enabled
  );

  await Promise.all(
    targets.map(async (pane) => {
      const sendGeneration = pane.sendGeneration + 1;
      pane.sendGeneration = sendGeneration;
      pane.state.status = 'sending';
      pane.state.errorMessage = null;
      renderPane(pane, options.getExpandedPaneId());

      if (typeof pane.webview.executeJavaScript !== 'function') {
        if (sendGeneration !== pane.sendGeneration) {
          return;
        }

        pane.state.status = 'manual_required';
        pane.state.errorMessage = '服务视图未就绪';
        renderPane(pane, options.getExpandedPaneId());
        return;
      }

      try {
        const result = await pane.webview.executeJavaScript(
          buildDomSendScript({
            prompt,
            inputSelectors: DEFAULT_INPUT_SELECTORS,
            submitSelectors: DEFAULT_SUBMIT_SELECTORS
          }),
          true
        );

        if (sendGeneration !== pane.sendGeneration) {
          return;
        }

        const normalized = normalizeDomSendResult(result);
        if (normalized) {
          pane.state.status = normalized.status;
          pane.state.errorMessage = normalized.errorMessage;
        } else {
          pane.state.status = 'manual_required';
          pane.state.errorMessage = '需人工确认';
        }
      } catch (error) {
        if (sendGeneration !== pane.sendGeneration) {
          return;
        }

        pane.state.status = 'error';
        pane.state.errorMessage = toShortError(error);
      }

      renderPane(pane, options.getExpandedPaneId());
    })
  );
}

function normalizeDomSendResult(value: unknown): DomSendScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'sent' && status !== 'manual_required') {
    return null;
  }

  return {
    status,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function renderPane(pane: PaneRuntime, expandedPaneId: ServiceId | null): void {
  const layout = expandedPaneId === null ? 'grid' : expandedPaneId === pane.service.id ? 'expanded' : 'collapsed';
  pane.article.dataset.layout = layout;
  pane.article.dataset.status = pane.state.status;
  pane.article.dataset.selected = String(pane.state.selected);
  pane.article.dataset.enabled = String(pane.state.enabled);

  pane.selectedToggle.checked = pane.state.selected;
  pane.enabledToggle.checked = pane.state.enabled;
  pane.enabledText.textContent = pane.state.enabled ? '开' : '关';
  pane.statusDot.dataset.status = pane.state.status;
  pane.statusDot.title = statusLabels[pane.state.status];
  pane.statusDot.setAttribute('aria-label', statusLabels[pane.state.status]);
  pane.errorText.textContent = pane.state.errorMessage ?? '';
  pane.webview.hidden = !pane.state.enabled;
}

function setTopError(element: HTMLElement, message: string | null): void {
  element.textContent = message ?? '';
}

function toShortError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '发送失败';

  const trimmed = message.trim();
  if (!trimmed) {
    return '发送失败';
  }

  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
}
