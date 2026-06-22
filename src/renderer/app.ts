import {
  buildDomActivateSubmitScript,
  buildDomExtractAnswerScript,
  buildDomFillScript,
  buildDomPromptStateScript,
  buildDomSendTargetScript,
  buildDomSendScript,
  type DomActivateSubmitScriptResult,
  type DomExtractAnswerScriptResult,
  type DomFillScriptResult,
  type DomPromptStateScriptResult,
  type DomSendTargetScriptResult,
  type DomSendScriptResult
} from '../shared/domScript';
import type {
  ClipboardTextPastePayload,
  ClipboardTextPasteRestorePayload,
  ClipboardTextPasteResult,
  DebugLogPayload,
  MarkdownExportPayload,
  MarkdownExportResult
} from '../shared/exportMarkdown';
import { services, type ServiceDefinition, type ServiceId } from '../shared/services';
import {
  createInitialPaneState,
  statusLabels,
  type PaneState
} from '../shared/status';
import type { RendererWebviewElement } from './webviewTypes';

type RuntimeDataPath = Readonly<{
  id: string;
  label: string;
  path: string;
}>;

type ViewMode = 'grid' | 'single';

type ExportApi = {
  saveMarkdownExport(payload: MarkdownExportPayload): Promise<MarkdownExportResult>;
  appendDebugLog?(payload: DebugLogPayload): Promise<void>;
  beginClipboardTextPaste?(
    payload: ClipboardTextPastePayload
  ): Promise<ClipboardTextPasteResult>;
  restoreClipboardTextPaste?(payload: ClipboardTextPasteRestorePayload): Promise<void>;
};

type AnswerExportEntry = {
  serviceName: string;
  answerText: string;
  isBusy: boolean;
  errorMessage: string | null;
};

declare global {
  interface Window {
    mutiSearch?: ExportApi;
  }
}

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
  homeButton: HTMLButtonElement;
  expandButton: HTMLButtonElement;
  errorText: HTMLSpanElement;
  sidebarButton: HTMLButtonElement;
  sidebarEnabledToggle: HTMLInputElement;
  sidebarStatusDot: HTMLSpanElement;
  webview: RendererWebviewElement;
};

const runtimeDataRoot = '/Users/coderxu/Library/Application Support/muti-search';
const runtimeDataPaths: readonly RuntimeDataPath[] = Object.freeze([
  Object.freeze({
    id: 'app-user-data',
    label: '应用数据目录',
    path: runtimeDataRoot
  }),
  ...services.map((service) =>
    Object.freeze({
      id: service.id,
      label: `${service.name} 会话分区`,
      path: `${runtimeDataRoot}/Partitions/${service.id}`
    })
  )
]);

export function createApp(root: HTMLDivElement): void {
  root.innerHTML = '';

  let viewMode: ViewMode = 'grid';
  let activePaneId: ServiceId = services[0].id;
  let expandedPaneId: ServiceId | null = null;
  let lastPrompt: string | null = null;
  let lastTargetIds = new Set<ServiceId>();
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

  const viewModeSwitch = document.createElement('div');
  viewModeSwitch.className = 'view-mode-switch';
  viewModeSwitch.setAttribute('aria-label', '展示方式');
  topBar.append(viewModeSwitch);

  const gridModeButton = document.createElement('button');
  gridModeButton.className = 'view-mode-button';
  gridModeButton.dataset.testid = 'view-mode-grid';
  gridModeButton.textContent = '分屏';
  viewModeSwitch.append(gridModeButton);

  const singleModeButton = document.createElement('button');
  singleModeButton.className = 'view-mode-button';
  singleModeButton.dataset.testid = 'view-mode-single';
  singleModeButton.textContent = '单站';
  viewModeSwitch.append(singleModeButton);

  const sendButton = document.createElement('button');
  sendButton.type = 'button';
  sendButton.className = 'send-button';
  sendButton.textContent = '发送到已选';
  topBar.append(sendButton);

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'export-button';
  exportButton.dataset.testid = 'export-button';
  exportButton.textContent = '导出 MD';
  exportButton.hidden = true;
  topBar.append(exportButton);

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'settings-button';
  settingsButton.dataset.testid = 'settings-button';
  settingsButton.textContent = '设置';
  settingsButton.title = '运行数据目录';
  topBar.append(settingsButton);

  const instanceBadge = document.createElement('span');
  instanceBadge.className = 'instance-badge';
  instanceBadge.dataset.testid = 'instance-badge';
  instanceBadge.textContent = getRuntimeInstanceLabel();
  topBar.append(instanceBadge);

  const topError = document.createElement('p');
  topError.className = 'top-error';
  topError.dataset.topError = 'true';
  topError.setAttribute('aria-live', 'polite');
  shell.append(topError);

  const settingsOverlay = createSettingsOverlay();
  shell.append(settingsOverlay.element);

  const appBody = document.createElement('section');
  appBody.className = 'app-body';
  appBody.dataset.testid = 'app-body';
  shell.append(appBody);

  const sidebar = document.createElement('aside');
  sidebar.className = 'service-sidebar';
  sidebar.dataset.testid = 'service-sidebar';
  appBody.append(sidebar);

  const sidebarTitle = document.createElement('h2');
  sidebarTitle.textContent = '网站';
  sidebar.append(sidebarTitle);

  const sidebarList = document.createElement('div');
  sidebarList.className = 'service-sidebar-list';
  sidebar.append(sidebarList);

  const grid = document.createElement('section');
  grid.className = 'pane-grid';
  appBody.append(grid);

  const renderApp = () => {
    shell.dataset.viewMode = viewMode;
    appBody.dataset.viewMode = viewMode;
    gridModeButton.setAttribute('aria-pressed', String(viewMode === 'grid'));
    singleModeButton.setAttribute('aria-pressed', String(viewMode === 'single'));
    for (const pane of panes.values()) {
      renderPane(pane, expandedPaneId, viewMode, activePaneId);
    }
  };

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

    const sidebarRow = document.createElement('div');
    sidebarRow.className = 'service-sidebar-row';
    sidebarList.append(sidebarRow);

    const sidebarButton = document.createElement('button');
    sidebarButton.className = 'service-sidebar-button';
    sidebarButton.dataset.sidebarService = service.id;
    sidebarRow.append(sidebarButton);

    const sidebarStatusDot = document.createElement('span');
    sidebarStatusDot.className = 'pane-status-dot';
    sidebarButton.append(sidebarStatusDot);

    const sidebarName = document.createElement('span');
    sidebarName.textContent = service.name;
    sidebarButton.append(sidebarName);

    const sidebarEnabledLabel = document.createElement('label');
    sidebarEnabledLabel.className = 'service-sidebar-toggle';
    sidebarRow.append(sidebarEnabledLabel);

    const sidebarEnabledToggle = document.createElement('input');
    sidebarEnabledToggle.type = 'checkbox';
    sidebarEnabledToggle.checked = true;
    sidebarEnabledToggle.dataset.sidebarEnabled = service.id;
    sidebarEnabledLabel.append(sidebarEnabledToggle);

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

    const homeButton = document.createElement('button');
    homeButton.type = 'button';
    homeButton.className = 'pane-action-button';
    homeButton.dataset.paneHome = service.id;
    header.append(homeButton);

    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className = 'pane-action-button';
    expandButton.dataset.paneExpand = service.id;
    header.append(expandButton);

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
      homeButton,
      expandButton,
      errorText,
      sidebarButton,
      sidebarEnabledToggle,
      sidebarStatusDot,
      webview
    };

    panes.set(service.id, pane);
    grid.append(article);

    const setPaneEnabled = (enabled: boolean) => {
      pane.state.enabled = enabled;
      pane.sendGeneration += 1;
      pane.state.status = enabled ? (pane.hasDomReady ? 'ready' : 'loading') : 'disabled';
      pane.state.errorMessage = null;
      renderApp();
    };

    selectedToggle.addEventListener('change', () => {
      pane.state.selected = selectedToggle.checked;
      renderApp();
    });

    enabledToggle.addEventListener('change', () => {
      setPaneEnabled(enabledToggle.checked);
    });

    sidebarButton.addEventListener('click', () => {
      activePaneId = service.id;
      expandedPaneId = null;
      renderApp();
    });

    sidebarEnabledToggle.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    sidebarEnabledToggle.addEventListener('change', () => {
      setPaneEnabled(sidebarEnabledToggle.checked);
    });

    const toggleExpanded = () => {
      expandedPaneId = expandedPaneId === service.id ? null : service.id;
      renderApp();
    };

    homeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      navigatePaneHome(pane, () => renderPane(pane, expandedPaneId, viewMode, activePaneId));
    });

    expandButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleExpanded();
    });

    const handlePaneDoubleClick = (event: Event) => {
      event.stopPropagation();
      toggleExpanded();
    };

    header.addEventListener('dblclick', handlePaneDoubleClick);
    body.addEventListener('dblclick', handlePaneDoubleClick);
    webview.addEventListener('dblclick', handlePaneDoubleClick);

    webview.addEventListener('dom-ready', () => {
      pane.hasDomReady = true;

      if (!pane.state.enabled) {
        return;
      }

      if (pane.state.status === 'loading' || pane.state.status === 'error') {
        pane.state.status = 'ready';
        pane.state.errorMessage = null;
        renderApp();
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
      renderApp();
    });

    renderPane(pane, expandedPaneId, viewMode, activePaneId);
  }

  promptInput.addEventListener('input', () => {
    setTopError(topError, null);
  });

  sendButton.addEventListener('click', () => {
    void sendPrompt({
      prompt: promptInput.value,
      panes,
      setTopError: (message) => setTopError(topError, message),
      renderPane: (pane) => renderPane(pane, expandedPaneId, viewMode, activePaneId)
    }).then((targetIds) => {
      if (targetIds.length === 0) {
        return;
      }

      lastPrompt = promptInput.value.trim();
      lastTargetIds = new Set(targetIds);
      exportButton.hidden = false;
    });
  });

  exportButton.addEventListener('click', () => {
    void exportAnswers({
      prompt: lastPrompt,
      targetIds: lastTargetIds,
      panes,
      exportButton,
      setTopError: (message) => setTopError(topError, message)
    });
  });

  gridModeButton.addEventListener('click', () => {
    viewMode = 'grid';
    renderApp();
  });

  singleModeButton.addEventListener('click', () => {
    viewMode = 'single';
    expandedPaneId = null;
    renderApp();
  });

  settingsButton.addEventListener('click', settingsOverlay.open);

  renderApp();
  root.append(shell);
}

function createSettingsOverlay(): { element: HTMLElement; open: () => void } {
  const overlay = document.createElement('section');
  overlay.className = 'settings-overlay';
  overlay.hidden = true;
  overlay.dataset.testid = 'settings-overlay';

  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'settings-title');
  overlay.append(panel);

  const header = document.createElement('header');
  header.className = 'settings-header';
  panel.append(header);

  const title = document.createElement('h2');
  title.id = 'settings-title';
  title.textContent = '运行数据目录';
  header.append(title);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'settings-close-button';
  closeButton.textContent = '关闭';
  header.append(closeButton);

  const note = document.createElement('p');
  note.className = 'settings-note';
  note.textContent = '只读展示：这里只显示应用数据和各服务会话分区路径，不访问目录，也不提供任何目录操作。';
  panel.append(note);

  const list = document.createElement('div');
  list.className = 'runtime-path-list';
  list.dataset.testid = 'runtime-path-list';
  panel.append(list);

  const close = () => {
    overlay.hidden = true;
  };

  const renderPaths = (paths: readonly RuntimeDataPath[]): void => {
    list.replaceChildren();
    for (const item of paths) {
      const row = document.createElement('div');
      row.className = 'runtime-path-row';

      const text = document.createElement('div');
      text.className = 'runtime-path-text';

      const label = document.createElement('strong');
      label.textContent = item.label;
      text.append(label);

      const path = document.createElement('code');
      path.textContent = item.path;
      text.append(path);

      row.append(text);
      list.append(row);
    }
  };

  const open = (): void => {
    overlay.hidden = false;
    renderPaths(runtimeDataPaths);
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  return { element: overlay, open };
}

function getRuntimeInstanceLabel(): string {
  if (window.location.protocol === 'file:') {
    return '运行: packaged';
  }

  const { hostname, port } = window.location;
  return port ? `运行: ${hostname}:${port}` : `运行: ${hostname}`;
}

function shouldLogPhysicalSendDebug(): boolean {
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}

function logPhysicalSendDebug(
  pane: PaneRuntime,
  stage: string,
  details: unknown
): void {
  if (!shouldLogPhysicalSendDebug()) {
    return;
  }

  const message = `[muti-search] ${JSON.stringify({
    service: pane.service.id,
    stage,
    details
  })}`;
  console.info(message);
  void window.mutiSearch?.appendDebugLog?.({ message }).catch(() => {});
}

async function sendPrompt(options: {
  prompt: string;
  panes: Map<ServiceId, PaneRuntime>;
  setTopError: (message: string | null) => void;
  renderPane: (pane: PaneRuntime) => void;
}): Promise<ServiceId[]> {
  const prompt = options.prompt.trim();

  if (!prompt) {
    options.setTopError('请输入问题');
    return [];
  }

  options.setTopError(null);

  const targets = Array.from(options.panes.values()).filter(
    (pane) => pane.state.selected && pane.state.enabled
  );

  if (targets.length === 0) {
    options.setTopError('请选择至少一个已开启的服务');
    return [];
  }

  await Promise.all(
    targets.map(async (pane) => {
      const sendGeneration = pane.sendGeneration + 1;
      pane.sendGeneration = sendGeneration;
      pane.hasDomReady = false;
      pane.state.status = 'loading';
      pane.state.errorMessage = null;
      options.renderPane(pane);

      const navigation = await navigatePaneHomeForSend(pane, sendGeneration);
      if (sendGeneration !== pane.sendGeneration) {
        return;
      }

      if (!navigation.ok) {
        pane.state.status = 'error';
        pane.state.errorMessage = navigation.errorMessage;
        options.renderPane(pane);
        return;
      }

      pane.state.status = 'sending';
      pane.state.errorMessage = null;
      options.renderPane(pane);

      if (typeof pane.webview.executeJavaScript !== 'function') {
        if (sendGeneration !== pane.sendGeneration) {
          return;
        }

        pane.state.status = 'manual_required';
        pane.state.errorMessage = '服务视图未就绪';
        options.renderPane(pane);
        return;
      }

      try {
        const result =
          pane.service.send.mode === 'physical'
            ? await sendPromptWithPhysicalInput(pane, prompt)
            : await pane.webview.executeJavaScript(
                buildDomSendScript({
                  prompt,
                  inputSelectors: pane.service.send.inputSelectors,
                  submitSelectors: pane.service.send.submitSelectors
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

      options.renderPane(pane);
    })
  );

  return targets.map((pane) => pane.service.id);
}

async function navigatePaneHomeForSend(
  pane: PaneRuntime,
  sendGeneration: number
): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  try {
    if (typeof pane.webview.loadURL === 'function') {
      await pane.webview.loadURL(pane.service.url);
    } else {
      pane.webview.setAttribute('src', pane.service.url);
      await waitForWebviewReady(pane.webview, 8000);
    }
  } catch (error) {
    if (sendGeneration !== pane.sendGeneration) {
      return { ok: false, errorMessage: '发送已取消' };
    }

    return { ok: false, errorMessage: toShortError(error) };
  }

  if (sendGeneration !== pane.sendGeneration) {
    return { ok: false, errorMessage: '发送已取消' };
  }

  pane.hasDomReady = true;
  return { ok: true };
}

function waitForWebviewReady(webview: RendererWebviewElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      webview.removeEventListener('dom-ready', handleReady);
      webview.removeEventListener('did-finish-load', handleReady);
      webview.removeEventListener('did-fail-load', handleFail);
      window.clearTimeout(timeout);
    };
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const handleReady = () => {
      settle(resolve);
    };
    const handleFail = (event: Event) => {
      const message =
        event instanceof CustomEvent && typeof event.detail?.errorDescription === 'string'
          ? event.detail.errorDescription
          : '加载失败';
      settle(() => reject(new Error(message)));
    };
    const timeout = window.setTimeout(() => {
      settle(() => reject(new Error('等待主页加载超时')));
    }, timeoutMs);

    webview.addEventListener('dom-ready', handleReady);
    webview.addEventListener('did-finish-load', handleReady);
    webview.addEventListener('did-fail-load', handleFail);
  });
}

async function sendPromptWithPhysicalInput(
  pane: PaneRuntime,
  prompt: string
): Promise<DomSendScriptResult> {
  const webview = pane.webview;
  if (
    typeof webview.sendInputEvent !== 'function' ||
    typeof webview.executeJavaScript !== 'function'
  ) {
    return { status: 'manual_required', errorMessage: '服务视图不支持物理输入' };
  }

  const inputTarget = normalizeDomSendTargetResult(
    await webview.executeJavaScript(
      buildDomSendTargetScript({
        inputSelectors: pane.service.send.inputSelectors,
        submitSelectors: pane.service.send.submitSelectors,
        target: 'input'
      }),
      true
    )
  );
  if (!inputTarget?.rect) {
    logPhysicalSendDebug(pane, 'input-target-missing', inputTarget);
    return {
      status: 'manual_required',
      errorMessage: inputTarget?.errorMessage ?? '未找到输入框'
    };
  }
  const inputRect = inputTarget.rect;
  logPhysicalSendDebug(pane, 'input-target', { rect: inputRect });

  webview.focus();
  await clickWebviewPoint(webview, rectCenter(inputRect));
  logPhysicalSendDebug(pane, 'input-clicked', { point: rectCenter(inputRect) });

  let usedNativeTextInput = false;
  if (typeof webview.insertText === 'function') {
    webview.selectAll?.();
    await webview.insertText(prompt);
    usedNativeTextInput = true;
    await sleep(250);
  } else if (typeof webview.selectAll === 'function' && typeof webview.replace === 'function') {
    webview.selectAll();
    webview.replace(prompt);
    usedNativeTextInput = true;
    await sleep(150);
  }
  logPhysicalSendDebug(pane, 'native-fill', { usedNativeTextInput });

  let hasPrompt = await promptStillInInput(pane, prompt);
  logPhysicalSendDebug(pane, 'prompt-state', { hasPrompt });

  let fillResult: DomFillScriptResult | null = null;
  if (!hasPrompt || pane.service.send.domFillAfterNative) {
    fillResult = normalizeDomFillResult(
      await webview.executeJavaScript(
        buildDomFillScript({
          prompt,
          inputSelectors: pane.service.send.inputSelectors
        }),
        true
      )
    );
    logPhysicalSendDebug(pane, 'dom-fill', fillResult);
    if (fillResult?.status !== 'ok' && !usedNativeTextInput) {
      return {
        status: 'manual_required',
        errorMessage: fillResult?.errorMessage ?? '未能填入问题'
      };
    }

    await sleep(250);
    hasPrompt = await promptStillInInput(pane, prompt);
    logPhysicalSendDebug(pane, 'prompt-state-recheck', { hasPrompt });
  }

  if (!hasPrompt) {
    return {
      status: 'manual_required',
      errorMessage: '未确认问题已填入'
    };
  }

  if (pane.service.send.submitStrategy === 'button-only') {
    const activation = await activateSubmitInPage(pane, { requireExplicitSubmit: true });
    logPhysicalSendDebug(pane, 'button-only-activation', activation);
    return activation?.status === 'activated'
      ? { status: 'sent', errorMessage: null }
      : {
          status: 'manual_required',
          errorMessage: activation?.errorMessage ?? '未找到发送按钮'
        };
  }

  const submitTarget = normalizeDomSendTargetResult(
    await webview.executeJavaScript(
      buildDomSendTargetScript({
        inputSelectors: pane.service.send.inputSelectors,
        submitSelectors: pane.service.send.submitSelectors,
        target: 'submit'
      }),
      true
    )
  );
  if (!submitTarget?.rect) {
    logPhysicalSendDebug(pane, 'submit-target-missing', submitTarget);
    return {
      status: 'manual_required',
      errorMessage: submitTarget?.errorMessage ?? '未找到发送按钮'
    };
  }
  const submitRect = submitTarget.rect;
  logPhysicalSendDebug(pane, 'submit-target', { rect: submitRect, debug: submitTarget.debug });

  const attempts =
    pane.service.send.submitStrategy === 'enter-first'
      ? [
          { name: 'enter', run: () => submitWithEnter(webview, inputRect) },
          { name: 'submit-coordinate-click', run: () => clickWebviewPoint(webview, rectCenter(submitRect)) },
          { name: 'dom-activation', run: () => activateSubmitInPage(pane) },
          { name: 'meta-enter', run: () => submitWithMetaEnter(webview, inputRect) }
        ]
      : [
          { name: 'submit-coordinate-click', run: () => clickWebviewPoint(webview, rectCenter(submitRect)) },
          { name: 'dom-activation', run: () => activateSubmitInPage(pane) },
          { name: 'enter', run: () => submitWithEnter(webview, inputRect) },
          { name: 'meta-enter', run: () => submitWithMetaEnter(webview, inputRect) }
        ];

  const attemptDiagnostics: string[] = [];
  for (const attempt of attempts) {
    logPhysicalSendDebug(pane, 'attempt-start', { attempt: attempt.name });
    const attemptResult = await attempt.run();
    if (attemptResult) {
      logPhysicalSendDebug(pane, 'attempt-result', { attempt: attempt.name, result: attemptResult });
    }
    await sleep(350);
    const stillHasPrompt = await promptStillInInput(pane, prompt);
    attemptDiagnostics.push(`${attempt.name}:${stillHasPrompt ? 'prompt-still-present' : 'prompt-cleared'}`);
    logPhysicalSendDebug(pane, 'attempt-prompt-state', {
      attempt: attempt.name,
      hasPrompt: stillHasPrompt
    });
    if (!stillHasPrompt) {
      return { status: 'sent', errorMessage: null };
    }
  }

  if (pane.service.send.pasteSubmitFallback) {
    logPhysicalSendDebug(pane, 'attempt-start', { attempt: 'clipboard-paste-enter' });
    const pasteResult = await submitWithClipboardPaste(pane, prompt, inputRect, submitRect);
    logPhysicalSendDebug(pane, 'attempt-result', {
      attempt: 'clipboard-paste-enter',
      result: pasteResult
    });
    await sleep(1000);
    const stillHasPrompt = await promptStillInInput(pane, prompt);
    attemptDiagnostics.push(
      `clipboard-paste-enter:${stillHasPrompt ? 'prompt-still-present' : 'prompt-cleared'}`
    );
    logPhysicalSendDebug(pane, 'attempt-prompt-state', {
      attempt: 'clipboard-paste-enter',
      hasPrompt: stillHasPrompt
    });
    if (!stillHasPrompt) {
      return { status: 'sent', errorMessage: null };
    }
  }

  return {
    status: 'manual_required',
    errorMessage: `已填入但未触发发送（${attemptDiagnostics.join(' → ')}）`
  };
}

async function activateSubmitInPage(
  pane: PaneRuntime,
  options: { requireExplicitSubmit?: boolean } = {}
): Promise<DomActivateSubmitScriptResult | null> {
  const result = await pane.webview.executeJavaScript(
    buildDomActivateSubmitScript({
      inputSelectors: pane.service.send.inputSelectors,
      submitSelectors: pane.service.send.submitSelectors,
      requireExplicitSubmit: options.requireExplicitSubmit
    }),
    true
  );

  return normalizeDomActivateSubmitResult(result);
}

async function promptStillInInput(pane: PaneRuntime, prompt: string): Promise<boolean> {
  const result = normalizeDomPromptStateResult(
    await pane.webview.executeJavaScript(
      buildDomPromptStateScript({
        prompt,
        inputSelectors: pane.service.send.inputSelectors
      }),
      true
    )
  );

  return result?.status === 'ok' ? result.hasPrompt : false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function rectCenter(rect: NonNullable<DomSendTargetScriptResult['rect']>): { x: number; y: number } {
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2)
  };
}

async function clickWebviewPoint(
  webview: RendererWebviewElement,
  point: { x: number; y: number }
): Promise<void> {
  webview.focus();
  await webview.sendInputEvent?.({
    type: 'mouseMove',
    x: point.x,
    y: point.y
  });
  await sleep(20);
  await webview.sendInputEvent?.({
    type: 'mouseDown',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1
  });
  await sleep(80);
  await webview.sendInputEvent?.({
    type: 'mouseUp',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1
  });
}

async function pressEnter(webview: RendererWebviewElement): Promise<void> {
  await webview.sendInputEvent?.({
    type: 'rawKeyDown',
    keyCode: 'Enter'
  });
  await webview.sendInputEvent?.({
    type: 'keyDown',
    keyCode: 'Enter'
  });
  await webview.sendInputEvent?.({
    type: 'keyUp',
    keyCode: 'Enter'
  });
}

async function pressSelectAll(webview: RendererWebviewElement): Promise<void> {
  await webview.sendInputEvent?.({
    type: 'rawKeyDown',
    keyCode: 'A',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyDown',
    keyCode: 'A',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyUp',
    keyCode: 'A',
    modifiers: ['meta']
  });
}

async function pressPaste(webview: RendererWebviewElement): Promise<void> {
  await webview.sendInputEvent?.({
    type: 'rawKeyDown',
    keyCode: 'V',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyDown',
    keyCode: 'V',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyUp',
    keyCode: 'V',
    modifiers: ['meta']
  });
}

async function submitWithEnter(
  webview: RendererWebviewElement,
  inputRect: NonNullable<DomSendTargetScriptResult['rect']>
): Promise<void> {
  await clickWebviewPoint(webview, rectCenter(inputRect));
  await pressEnter(webview);
}

async function submitWithMetaEnter(
  webview: RendererWebviewElement,
  inputRect: NonNullable<DomSendTargetScriptResult['rect']>
): Promise<void> {
  await clickWebviewPoint(webview, rectCenter(inputRect));
  await webview.sendInputEvent?.({
    type: 'rawKeyDown',
    keyCode: 'Enter',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyDown',
    keyCode: 'Enter',
    modifiers: ['meta']
  });
  await webview.sendInputEvent?.({
    type: 'keyUp',
    keyCode: 'Enter',
    modifiers: ['meta']
  });
}

async function submitWithClipboardPaste(
  pane: PaneRuntime,
  prompt: string,
  inputRect: NonNullable<DomSendTargetScriptResult['rect']>,
  submitRect: NonNullable<DomSendTargetScriptResult['rect']>
): Promise<{ ok: boolean; reason: string }> {
  const webview = pane.webview;
  const api = window.mutiSearch;
  if (typeof api?.beginClipboardTextPaste !== 'function') {
    return { ok: false, reason: 'begin-clipboard-ipc-unavailable' };
  }
  if (typeof api.restoreClipboardTextPaste !== 'function') {
    return { ok: false, reason: 'restore-clipboard-ipc-unavailable' };
  }
  if (typeof webview.sendInputEvent !== 'function') {
    return { ok: false, reason: 'keyboard-paste-unavailable' };
  }

  const tokenResult = await api.beginClipboardTextPaste({ text: prompt });
  try {
    webview.focus();
    await clickWebviewPoint(webview, rectCenter(inputRect));
    await pressSelectAll(webview);
    webview.selectAll?.();
    await pressPaste(webview);
    await sleep(350);

    const hasPrompt = await promptStillInInput(pane, prompt);
    if (!hasPrompt) {
      return { ok: false, reason: 'prompt-not-confirmed-after-paste' };
    }

    await pressEnter(webview);
    await sleep(650);

    if (!(await promptStillInInput(pane, prompt))) {
      return { ok: true, reason: 'submitted-with-paste-enter' };
    }

    await clickWebviewPoint(webview, rectCenter(submitRect));
    return { ok: true, reason: 'submitted-with-paste-enter-then-click' };
  } finally {
    await api.restoreClipboardTextPaste({ token: tokenResult.token }).catch(() => {});
  }
}

async function exportAnswers(options: {
  prompt: string | null;
  targetIds: ReadonlySet<ServiceId>;
  panes: Map<ServiceId, PaneRuntime>;
  exportButton: HTMLButtonElement;
  setTopError: (message: string | null) => void;
}): Promise<void> {
  if (!options.prompt) {
    options.setTopError('请先发送问题');
    return;
  }

  const prompt = options.prompt;
  const exportApi = window.mutiSearch;
  if (!exportApi) {
    options.setTopError('导出通道未就绪');
    return;
  }

  const targets = Array.from(options.targetIds)
    .map((id) => options.panes.get(id))
    .filter((pane): pane is PaneRuntime => Boolean(pane));

  if (targets.length === 0) {
    options.setTopError('没有可导出的服务');
    return;
  }

  options.exportButton.disabled = true;
  options.exportButton.textContent = '导出中';
  options.setTopError(null);

  try {
    const entries = await Promise.all(targets.map((pane) => extractPaneAnswer(pane, prompt)));
    const markdown = formatMarkdownExport(prompt, entries, new Date());
    const result = await exportApi.saveMarkdownExport({ markdown });
    options.setTopError(`已导出：${result.filePath}`);
  } catch (error) {
    options.setTopError(toShortError(error));
  } finally {
    options.exportButton.disabled = false;
    options.exportButton.textContent = '导出 MD';
  }
}

async function extractPaneAnswer(
  pane: PaneRuntime,
  prompt: string
): Promise<AnswerExportEntry> {
  if (typeof pane.webview.executeJavaScript !== 'function') {
    return {
      serviceName: pane.service.name,
      answerText: '',
      isBusy: false,
      errorMessage: '服务视图未就绪'
    };
  }

  try {
    const result = await pane.webview.executeJavaScript(
      buildDomExtractAnswerScript({
        prompt,
        answerSelectors: pane.service.answer.answerSelectors,
        busySelectors: pane.service.answer.busySelectors
      }),
      true
    );
    const normalized = normalizeDomExtractAnswerResult(result);

    return {
      serviceName: pane.service.name,
      answerText: normalized?.answerText ?? '',
      isBusy: normalized?.isBusy ?? false,
      errorMessage: normalized?.errorMessage ?? (normalized ? null : '未读取到回答')
    };
  } catch (error) {
    return {
      serviceName: pane.service.name,
      answerText: '',
      isBusy: false,
      errorMessage: toShortError(error)
    };
  }
}

function normalizeDomExtractAnswerResult(value: unknown): DomExtractAnswerScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const answerText = Reflect.get(value, 'answerText');
  const isBusy = Reflect.get(value, 'isBusy');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'ok' && status !== 'empty') {
    return null;
  }

  return {
    status,
    answerText: typeof answerText === 'string' ? answerText : '',
    isBusy: isBusy === true,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function formatMarkdownExport(
  prompt: string,
  entries: readonly AnswerExportEntry[],
  exportedAt: Date
): string {
  const lines = [
    '# muti-search 导出',
    '',
    `导出时间：${exportedAt.toLocaleString('zh-CN')}`,
    '',
    '## 问题',
    '',
    prompt,
    ''
  ];

  for (const entry of entries) {
    lines.push(`## ${entry.serviceName}`, '');

    if (entry.isBusy) {
      lines.push('> 状态：回答可能仍在生成中。', '');
    }

    if (entry.answerText.trim()) {
      lines.push(entry.answerText.trim(), '');
    } else {
      lines.push(`> ${entry.errorMessage ?? '未读取到回答'}`, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
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

function normalizeDomFillResult(value: unknown): DomFillScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'ok' && status !== 'manual_required') {
    return null;
  }

  return {
    status,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function normalizeDomActivateSubmitResult(value: unknown): DomActivateSubmitScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'activated' && status !== 'manual_required') {
    return null;
  }

  return {
    status,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function normalizeDomPromptStateResult(value: unknown): DomPromptStateScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const hasPrompt = Reflect.get(value, 'hasPrompt');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'ok' && status !== 'manual_required') {
    return null;
  }

  return {
    status,
    hasPrompt: hasPrompt === true,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function normalizeDomSendTargetResult(value: unknown): DomSendTargetScriptResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = Reflect.get(value, 'status');
  const rect = Reflect.get(value, 'rect');
  const debug = Reflect.get(value, 'debug');
  const errorMessage = Reflect.get(value, 'errorMessage');

  if (status !== 'ok' && status !== 'manual_required') {
    return null;
  }

  const normalizedRect =
    rect && typeof rect === 'object'
      ? {
          x: Number(Reflect.get(rect, 'x')),
          y: Number(Reflect.get(rect, 'y')),
          width: Number(Reflect.get(rect, 'width')),
          height: Number(Reflect.get(rect, 'height'))
        }
      : null;

  return {
    status,
    rect:
      normalizedRect &&
      Number.isFinite(normalizedRect.x) &&
      Number.isFinite(normalizedRect.y) &&
      Number.isFinite(normalizedRect.width) &&
      Number.isFinite(normalizedRect.height)
        ? normalizedRect
        : null,
    debug,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : null
  };
}

function renderPane(
  pane: PaneRuntime,
  expandedPaneId: ServiceId | null,
  viewMode: ViewMode,
  activePaneId: ServiceId
): void {
  const layout =
    viewMode === 'single'
      ? activePaneId === pane.service.id
        ? 'single-active'
        : 'single-hidden'
      : expandedPaneId === null
        ? 'grid'
        : expandedPaneId === pane.service.id
          ? 'expanded'
          : 'collapsed';
  pane.article.dataset.layout = layout;
  pane.article.dataset.status = pane.state.status;
  pane.article.dataset.selected = String(pane.state.selected);
  pane.article.dataset.enabled = String(pane.state.enabled);

  pane.selectedToggle.checked = pane.state.selected;
  pane.enabledToggle.checked = pane.state.enabled;
  pane.sidebarEnabledToggle.checked = pane.state.enabled;
  pane.enabledText.textContent = pane.state.enabled ? '开' : '关';
  pane.statusDot.dataset.status = pane.state.status;
  pane.statusDot.title = statusLabels[pane.state.status];
  pane.statusDot.setAttribute('aria-label', statusLabels[pane.state.status]);
  pane.sidebarStatusDot.dataset.status = pane.state.status;
  pane.sidebarStatusDot.title = statusLabels[pane.state.status];
  pane.sidebarStatusDot.setAttribute('aria-label', statusLabels[pane.state.status]);
  pane.sidebarButton.setAttribute('aria-current', String(viewMode === 'single' && activePaneId === pane.service.id));
  pane.homeButton.textContent = '↻';
  pane.homeButton.title = '回主页';
  pane.homeButton.setAttribute('aria-label', '回主页');
  pane.expandButton.textContent = layout === 'expanded' ? '↙' : '⛶';
  pane.expandButton.title = layout === 'expanded' ? '还原' : '放大';
  pane.expandButton.setAttribute('aria-label', layout === 'expanded' ? '还原' : '放大');
  pane.errorText.textContent = pane.state.errorMessage ?? '';
  pane.errorText.title = pane.state.errorMessage ?? '';
  pane.webview.hidden = !pane.state.enabled;
}

function navigatePaneHome(pane: PaneRuntime, render: () => void): void {
  const navigationGeneration = pane.sendGeneration + 1;
  pane.sendGeneration = navigationGeneration;
  pane.hasDomReady = false;
  pane.state.status = pane.state.enabled ? 'loading' : 'disabled';
  pane.state.errorMessage = null;
  render();

  if (typeof pane.webview.loadURL === 'function') {
    void pane.webview.loadURL(pane.service.url).catch((error: unknown) => {
      if (navigationGeneration !== pane.sendGeneration || !pane.state.enabled) {
        return;
      }

      pane.state.status = 'error';
      pane.state.errorMessage = toShortError(error);
      render();
    });
    return;
  }

  pane.webview.setAttribute('src', pane.service.url);
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
