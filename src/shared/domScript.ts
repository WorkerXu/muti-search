export type DomSendScriptInput = {
  prompt: string;
  inputSelectors: readonly string[];
  submitSelectors: readonly string[];
};

export type DomSendScriptResult = {
  status: 'sent' | 'manual_required';
  errorMessage: string | null;
};

export type DomSendTargetScriptInput = {
  inputSelectors: readonly string[];
  submitSelectors: readonly string[];
  target: 'input' | 'submit';
};

export type DomFillScriptInput = {
  prompt: string;
  inputSelectors: readonly string[];
};

export type DomFillScriptResult = {
  status: 'ok' | 'manual_required';
  errorMessage: string | null;
};

export type DomActivateSubmitScriptInput = {
  inputSelectors: readonly string[];
  submitSelectors: readonly string[];
  requireExplicitSubmit?: boolean;
};

export type DomActivateSubmitScriptResult = {
  status: 'activated' | 'manual_required';
  errorMessage: string | null;
};

export type DomPromptStateScriptInput = {
  prompt: string;
  inputSelectors: readonly string[];
};

export type DomPromptStateScriptResult = {
  status: 'ok' | 'manual_required';
  hasPrompt: boolean;
  errorMessage: string | null;
};

export type DomSendTargetScriptResult = {
  status: 'ok' | 'manual_required';
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  debug?: unknown;
  errorMessage: string | null;
};

export type DomExtractAnswerScriptInput = {
  prompt: string;
  answerSelectors: readonly string[];
  busySelectors: readonly string[];
};

export type DomExtractAnswerScriptResult = {
  status: 'ok' | 'empty';
  answerText: string;
  isBusy: boolean;
  errorMessage: string | null;
};

export function buildDomSendScript(input: DomSendScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const inputSelectors = JSON.stringify(input.inputSelectors);
  const submitSelectors = JSON.stringify(input.submitSelectors);

  return `
(async () => {
  const prompt = ${prompt};
  const inputSelectors = ${inputSelectors};
  const submitSelectors = ${submitSelectors};

  const findFirst = (selectors) => {
    for (const selector of selectors) {
      let element = null;
      try {
        element = document.querySelector(selector);
      } catch {
        continue;
      }
      if (element) return element;
    }
    return null;
  };

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const isValidSelector = (selector) => {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };

  const validInputSelectors = inputSelectors.filter(isValidSelector);

  const waitForInput = async () => {
    if (validInputSelectors.length === 0) {
      return null;
    }

    const started = Date.now();
    while (Date.now() - started < 8000) {
      const input = findFirst(validInputSelectors);
      if (input) return input;
      await sleep(100);
    }
    return null;
  };

  const getSemanticText = (element) =>
    [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-testid'),
      element.getAttribute('id'),
      element.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const getClassText = (element) => (element.getAttribute('class') || '').toLowerCase();

  const isDisabled = (element) => {
    const classText = getClassText(element);
    return element.disabled === true ||
      element.getAttribute('aria-disabled') === 'true' ||
      /(^|[\\s_-])disabled($|[\\s_-])|--disabled|is-disabled|pointer-events-none|cursor-not-allowed/.test(classText);
  };

  const isRejectedAction = (element) => {
    const text = getSemanticText(element);
    const classText = getClassText(element);
    return /添加|附件|上传|upload|attach|语音|麦克风|voice|mic|more|更多|下载|download|图片|image|视频|ppt|表格|写作|生成|新对话|new\\s*chat/.test(text) ||
      /skill-bar-button|upload-image|attach-button|composer-plus|think-arrow/.test(classText);
  };

  const isSendAction = (element) => {
    const text = getSemanticText(element);
    const classText = getClassText(element);
    return /发送|提交|send|submit|arrow-up|uparrow|send-button|chat-submit|yuanbao-send-btn/.test(text) ||
      /send-button|composer-submit|submit-button|chat-submit|send[_-]?btn|send-msg|send-message/.test(classText) ||
      (/ds-button--primary/.test(classText) && /ds-button--filled/.test(classText) && /circle/.test(classText));
  };

  const isUsableAction = (element) => !isDisabled(element) && !isRejectedAction(element);

  const activateAction = (element) => {
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus?.();

    const dispatchMouseLikeEvent = (type) => {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true
      };
      const EventConstructor = type.startsWith('pointer') && typeof PointerEvent === 'function'
        ? PointerEvent
        : MouseEvent;
      element.dispatchEvent(new EventConstructor(type, eventInit));
    };

    dispatchMouseLikeEvent('pointerdown');
    dispatchMouseLikeEvent('mousedown');
    dispatchMouseLikeEvent('pointerup');
    dispatchMouseLikeEvent('mouseup');

    if (typeof element.click === 'function') {
      element.click();
    } else {
      dispatchMouseLikeEvent('click');
    }
  };

  const getButtons = (scope) =>
    Array.from(
      scope.querySelectorAll(
        [
          'button',
          '[role="button"]',
          'a[id*="send"]',
          'a[class*="send"]',
          '[id*="send"]',
          '[class*="send-btn"]',
          '[class*="send_msg"]',
          '[class*="send-msg"]',
          '[class*="send-button"]',
          '[class*="chat-submit"]',
          '[class*="submit"]',
          '[class*="enter"][class*="is-main-chat"]',
          '[class*="ds-button--primary"][class*="ds-button--filled"][class*="ds-button--circle"]'
        ].join(',')
      )
    ).filter(isUsableAction);

  const findSubmitBySelector = () => {
    for (const selector of submitSelectors) {
      let elements = [];
      try {
        elements = Array.from(document.querySelectorAll(selector));
      } catch {
        continue;
      }

      const match = elements.find(isUsableAction);
      if (match) return match;
    }

    return null;
  };

  const findNearestSubmit = (inputElement) => {
    const scopes = [];
    const form = inputElement.closest('form, [role="form"]');
    if (form) scopes.push(form);

    let scope = inputElement.parentElement;
    while (scope && scopes.length < 5) {
      scopes.push(scope);
      scope = scope.parentElement;
    }

    scopes.push(document);

    for (const item of scopes) {
      const buttons = getButtons(item);
      const semanticButton = buttons.find((button) => isSendAction(button));
      if (semanticButton) {
        return semanticButton;
      }

      const followingButtons = buttons.filter(
        (button) =>
          !isRejectedAction(button) &&
          Boolean(inputElement.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
      if (followingButtons.length > 0) {
        return followingButtons[followingButtons.length - 1];
      }
    }

    return null;
  };

  const setNativeValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : null;

    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
  };

  const fillInput = (element) => {
    element.focus();

    if ('value' in element) {
      setNativeValue(element, prompt);
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const inserted = typeof document.execCommand === 'function'
        ? document.execCommand('insertText', false, prompt)
        : false;
      if (!inserted) {
        element.textContent = prompt;
      }
    }

    element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: prompt }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const waitForSubmit = async (inputElement) => {
    const started = Date.now();
    while (Date.now() - started < 2500) {
      const submit = findSubmitBySelector() || findNearestSubmit(inputElement);
      if (submit) return submit;
      await sleep(100);
    }
    return null;
  };

  const input = await waitForInput();
  if (!input) {
    return { status: 'manual_required', errorMessage: '未找到输入框' };
  }

  fillInput(input);

  const submit = await waitForSubmit(input);
  if (!submit) {
    return { status: 'manual_required', errorMessage: '未找到发送按钮' };
  }

  activateAction(submit);
  return { status: 'sent', errorMessage: null };
})();
`;
}

export function buildDomFillScript(input: DomFillScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const inputSelectors = JSON.stringify(input.inputSelectors);

  return `
(async () => {
  const prompt = ${prompt};
  const inputSelectors = ${inputSelectors};

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const isValidSelector = (selector) => {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };

  const safeQueryAll = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const validInputSelectors = inputSelectors.filter(isValidSelector);

  const findInput = () => {
    for (const selector of validInputSelectors) {
      const element = safeQueryAll(selector).find(isVisible);
      if (element) return element;
    }
    return null;
  };

  const waitForInput = async () => {
    if (validInputSelectors.length === 0) {
      return null;
    }

    const started = Date.now();
    while (Date.now() - started < 30000) {
      const input = findInput();
      if (input) return input;
      await sleep(100);
    }
    return null;
  };

  const setNativeValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
    const setter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : null;

    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
  };

  const dispatchTextEvents = (element) => {
    element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fillInput = (element) => {
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus();

    if ('value' in element) {
      setNativeValue(element, prompt);
      dispatchTextEvents(element);
      return;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = typeof document.execCommand === 'function'
      ? document.execCommand('insertText', false, prompt)
      : false;
    if (!inserted) {
      element.textContent = prompt;
      dispatchTextEvents(element);
    } else {
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const input = await waitForInput();
  if (!input) {
    return { status: 'manual_required', errorMessage: '未找到输入框' };
  }

  fillInput(input);
  return { status: 'ok', errorMessage: null };
})();
`;
}

export function buildDomActivateSubmitScript(input: DomActivateSubmitScriptInput): string {
  const inputSelectors = JSON.stringify(input.inputSelectors);
  const submitSelectors = JSON.stringify(input.submitSelectors);
  const requireExplicitSubmit = JSON.stringify(input.requireExplicitSubmit ?? false);

  return `
(async () => {
  const inputSelectors = ${inputSelectors};
  const submitSelectors = ${submitSelectors};
  const requireExplicitSubmit = ${requireExplicitSubmit};

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const safeQueryAll = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const getClassText = (element) => (element.getAttribute('class') || '').toLowerCase();

  const isDisabled = (element) => {
    const classText = getClassText(element);
    return element.disabled === true ||
      element.getAttribute('aria-disabled') === 'true' ||
      /(^|[\\s_-])disabled($|[\\s_-])|--disabled|is-disabled|pointer-events-none|cursor-not-allowed/.test(classText);
  };

  const getSemanticText = (element) =>
    [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-testid'),
      element.getAttribute('id'),
      element.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const isRejectedAction = (element) => {
    const text = getSemanticText(element);
    const classText = getClassText(element);
    return /添加|附件|上传|upload|attach|语音|麦克风|voice|mic|more|更多|下载|download|图片|image|视频|ppt|表格|写作|生成|新对话|new\\s*chat/.test(text) ||
      /skill-bar-button|upload-image|attach-button|composer-plus|think-arrow/.test(classText);
  };

  const isUsableAction = (element) => isVisible(element) && !isDisabled(element) && !isRejectedAction(element);

  const findFirstInput = () => {
    for (const selector of inputSelectors) {
      const input = safeQueryAll(selector).find(isVisible);
      if (input) return input;
    }
    return null;
  };

  const getButtons = (scope) =>
    Array.from(
      scope.querySelectorAll(
        [
          'button',
          '[role="button"]',
          'a[id*="send"]',
          'a[class*="send"]',
          '[id*="send"]',
          '[class*="send-btn"]',
          '[class*="send_msg"]',
          '[class*="send-msg"]',
          '[class*="send-button"]',
          '[class*="chat-submit"]',
          '[class*="submit"]',
          '[class*="enter"][class*="is-main-chat"]',
          '[class*="message-input-right-button-send"]',
          '[class*="chat-prompt-send-button"]'
        ].join(',')
      )
    ).filter(isUsableAction);

  const findSubmitBySelector = () => {
    for (const selector of submitSelectors) {
      const match = safeQueryAll(selector).find(isUsableAction);
      if (match) return match;
    }
    return null;
  };

  const findNearestSubmit = (inputElement) => {
    const scopes = [];
    const form = inputElement.closest('form, [role="form"]');
    if (form) scopes.push(form);

    let scope = inputElement.parentElement;
    while (scope && scopes.length < 5) {
      scopes.push(scope);
      scope = scope.parentElement;
    }

    scopes.push(document);

    for (const item of scopes) {
      const buttons = getButtons(item).filter(
        (button) => Boolean(inputElement.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
      if (buttons.length > 0) {
        return buttons[buttons.length - 1];
      }
    }

    return null;
  };

  const activateAction = (element) => {
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    element.focus?.();

    const dispatchMouseLikeEvent = (type) => {
      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true
      };
      const EventConstructor = type.startsWith('pointer') && typeof PointerEvent === 'function'
        ? PointerEvent
        : MouseEvent;
      element.dispatchEvent(new EventConstructor(type, eventInit));
    };

    dispatchMouseLikeEvent('pointerdown');
    dispatchMouseLikeEvent('mousedown');
    dispatchMouseLikeEvent('pointerup');
    dispatchMouseLikeEvent('mouseup');

    if (typeof element.click === 'function') {
      element.click();
    } else {
      dispatchMouseLikeEvent('click');
    }
  };

  const input = findFirstInput();
  if (!input) {
    return { status: 'manual_required', errorMessage: '未找到输入框' };
  }

  const started = Date.now();
  while (Date.now() - started < 8000) {
    const submit = findSubmitBySelector() || (requireExplicitSubmit ? null : findNearestSubmit(input));
    if (submit) {
      activateAction(submit);
      return { status: 'activated', errorMessage: null };
    }
    await sleep(100);
  }

  return { status: 'manual_required', errorMessage: '未找到发送按钮' };
})();
`;
}

export function buildDomPromptStateScript(input: DomPromptStateScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const inputSelectors = JSON.stringify(input.inputSelectors);

  return `
(() => {
  const prompt = ${prompt};
  const inputSelectors = ${inputSelectors};
  const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();

  const safeQueryAll = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  for (const selector of inputSelectors) {
    const input = safeQueryAll(selector).find(isVisible);
    if (!input) continue;

    const value = 'value' in input ? input.value : input.textContent;
    return {
      status: 'ok',
      hasPrompt: normalize(value).includes(normalize(prompt)),
      errorMessage: null
    };
  }

  return { status: 'manual_required', hasPrompt: false, errorMessage: '未找到输入框' };
})();
`;
}

export function buildDomSendTargetScript(input: DomSendTargetScriptInput): string {
  const inputSelectors = JSON.stringify(input.inputSelectors);
  const submitSelectors = JSON.stringify(input.submitSelectors);
  const target = JSON.stringify(input.target);

  return `
(async () => {
  const inputSelectors = ${inputSelectors};
  const submitSelectors = ${submitSelectors};
  const target = ${target};

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const isValidSelector = (selector) => {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };

  const validInputSelectors = inputSelectors.filter(isValidSelector);

  const safeQueryAll = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const findFirst = (selectors) => {
    for (const selector of selectors) {
      const element = safeQueryAll(selector).find((item) => isVisible(item));
      if (element) return element;
    }
    return null;
  };

  const waitForInput = async () => {
    if (validInputSelectors.length === 0) {
      return null;
    }

    const started = Date.now();
    while (Date.now() - started < 30000) {
      const input = findFirst(validInputSelectors);
      if (input) return input;
      await sleep(100);
    }
    return null;
  };

  const getClassText = (element) => (element.getAttribute('class') || '').toLowerCase();

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const isDisabled = (element) => {
    const classText = getClassText(element);
    return element.disabled === true ||
      element.getAttribute('aria-disabled') === 'true' ||
      /(^|[\\s_-])disabled($|[\\s_-])|--disabled|is-disabled|pointer-events-none|cursor-not-allowed/.test(classText);
  };

  const getSemanticText = (element) =>
    [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-testid'),
      element.getAttribute('id'),
      element.textContent
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const isRejectedAction = (element) => {
    const text = getSemanticText(element);
    const classText = getClassText(element);
    return /添加|附件|上传|upload|attach|语音|麦克风|voice|mic|more|更多|下载|download|图片|image|视频|ppt|表格|写作|生成|新对话|new\\s*chat/.test(text) ||
      /skill-bar-button|upload-image|attach-button|composer-plus|think-arrow/.test(classText);
  };

  const isUsableAction = (element) => isVisible(element) && !isDisabled(element) && !isRejectedAction(element);

  const getButtons = (scope) =>
    Array.from(
      scope.querySelectorAll(
        [
          'button',
          '[role="button"]',
          'a[id*="send"]',
          'a[class*="send"]',
          '[id*="send"]',
          '[class*="send-btn"]',
          '[class*="send_msg"]',
          '[class*="send-msg"]',
          '[class*="send-button"]',
          '[class*="chat-submit"]',
          '[class*="submit"]',
          '[class*="enter"][class*="is-main-chat"]',
          '[class*="ds-button--primary"][class*="ds-button--filled"][class*="ds-button--circle"]'
        ].join(',')
      )
    ).filter(isUsableAction);

  const summarizeElement = (element, matchedBy = null) => {
    const rect = element.getBoundingClientRect();
    return {
      matchedBy,
      tagName: element.tagName,
      id: element.getAttribute('id'),
      className: element.getAttribute('class'),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      role: element.getAttribute('role'),
      type: element.getAttribute('type'),
      disabled: element.disabled === true,
      ariaDisabled: element.getAttribute('aria-disabled'),
      text: (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  };

  const getCandidateSummaries = (inputElement) => {
    const scopes = [];
    const form = inputElement.closest('form, [role="form"]');
    if (form) scopes.push(form);

    let scope = inputElement.parentElement;
    while (scope && scopes.length < 5) {
      scopes.push(scope);
      scope = scope.parentElement;
    }

    scopes.push(document);

    const seen = new Set();
    const candidates = [];
    for (const item of scopes) {
      for (const button of getButtons(item)) {
        if (seen.has(button)) continue;
        seen.add(button);
        candidates.push(summarizeElement(button));
      }
    }

    return candidates.slice(0, 12);
  };

  const findSubmitBySelector = () => {
    for (const selector of submitSelectors) {
      const match = safeQueryAll(selector).find(isUsableAction);
      if (match) return { element: match, matchedBy: selector };
    }

    return null;
  };

  const findNearestSubmit = (inputElement) => {
    const scopes = [];
    const form = inputElement.closest('form, [role="form"]');
    if (form) scopes.push(form);

    let scope = inputElement.parentElement;
    while (scope && scopes.length < 5) {
      scopes.push(scope);
      scope = scope.parentElement;
    }

    scopes.push(document);

    for (const item of scopes) {
      const followingButtons = getButtons(item).filter(
        (button) =>
          !isRejectedAction(button) &&
          Boolean(inputElement.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
      if (followingButtons.length > 0) {
        return { element: followingButtons[followingButtons.length - 1], matchedBy: 'nearest-following' };
      }
    }

    return null;
  };

  const toResult = (element, debug = undefined) => {
    const rect = element.getBoundingClientRect();
    return {
      status: 'ok',
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      debug,
      errorMessage: null
    };
  };

  const input = await waitForInput();
  if (!input) {
    return { status: 'manual_required', rect: null, errorMessage: '未找到输入框' };
  }

  if (target === 'input') {
    input.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return toResult(input);
  }

  const started = Date.now();
  while (Date.now() - started < 8000) {
    const submit = findSubmitBySelector() || findNearestSubmit(input);
    if (submit) {
      submit.element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return toResult(submit.element, {
        selected: summarizeElement(submit.element, submit.matchedBy),
        candidates: getCandidateSummaries(input)
      });
    }
    await sleep(100);
  }

  return { status: 'manual_required', rect: null, errorMessage: '未找到发送按钮' };
})();
`;
}

export function buildDomExtractAnswerScript(input: DomExtractAnswerScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const answerSelectors = JSON.stringify(input.answerSelectors);
  const busySelectors = JSON.stringify(input.busySelectors);

  return `
(() => {
  const prompt = ${prompt};
  const answerSelectors = ${answerSelectors};
  const busySelectors = ${busySelectors};

  const normalizeWhitespace = (value) => (value || '').replace(/\\s+/g, ' ').trim();

  const safeQueryAll = (selector) => {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rects = typeof element.getClientRects === 'function' ? element.getClientRects() : [];
    if (rects.length === 0) {
      return true;
    }

    return Array.from(rects).some((rect) => rect.width > 0 && rect.height > 0);
  };

  const isBusy = busySelectors.some((selector) =>
    safeQueryAll(selector).some((element) => isVisible(element))
  );

  const stripPromptAndLabels = (value) => {
    let text = normalizeWhitespace(value);
    if (!text) {
      return '';
    }

    const normalizedPrompt = normalizeWhitespace(prompt);
    if (normalizedPrompt && text === normalizedPrompt) {
      return '';
    }
    if (normalizedPrompt && text.includes(normalizedPrompt)) {
      text = text.replace(normalizedPrompt, ' ');
    }

    text = text.replace(/^(ChatGPT|Gemini|DeepSeek|Grok|豆包|元宝|Perplexity|spark)\\s*(说|回复)?\\s*[：:]?\\s*/i, '');
    text = text.replace(/^你说[：:]?\\s*/i, '');
    text = text.replace(/到目前为止，这段对话对你有帮助吗[？?]?/g, '');
    text = text.replace(/^(如何测试导出功能[？?]?|导出功能的测试用例有哪些[？?]?|如何保证导出数据的准确性[？?]?\\s*)+/g, '');

    const normalized = normalizeWhitespace(text);
    if (/^(Gemini\\s*说|ChatGPT\\s*说|豆包|DeepSeek|Grok|spark)$/i.test(normalized)) {
      return '';
    }

    return normalized;
  };

  const collectBySelectors = (selectors) => {
    for (const selector of selectors) {
      const texts = safeQueryAll(selector)
        .filter((element) => isVisible(element))
        .map((element) => stripPromptAndLabels(element.textContent))
        .filter(Boolean);

      const uniqueTexts = texts.filter((text, index) => texts.indexOf(text) === index);
      if (uniqueTexts.length > 0) {
        return uniqueTexts[uniqueTexts.length - 1];
      }
    }

    return '';
  };

  const answerText = collectBySelectors(answerSelectors);
  if (answerText) {
    return { status: 'ok', answerText, isBusy, errorMessage: null };
  }

  const fallbackText = collectBySelectors([
    '[data-message-author-role="assistant"]',
    '[data-turn="assistant"]',
    '[class*="markdown"]',
    '.markdown-body',
    '.prose',
    '[class*="answer"]',
    '[class*="response"]',
    'article'
  ]);

  if (fallbackText) {
    return { status: 'ok', answerText: fallbackText, isBusy, errorMessage: null };
  }

  return {
    status: 'empty',
    answerText: '',
    isBusy,
    errorMessage: isBusy ? '回答可能仍在生成中' : '未读取到回答'
  };
})();
`;
}
