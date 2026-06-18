export type DomSendScriptInput = {
  prompt: string;
  inputSelectors: string[];
  submitSelectors: string[];
};

export type DomSendScriptResult = {
  status: 'sent' | 'manual_required';
  errorMessage: string | null;
};

export function buildDomSendScript(input: DomSendScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const inputSelectors = JSON.stringify(input.inputSelectors);
  const submitSelectors = JSON.stringify(input.submitSelectors);

  return `
(() => {
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

  const input = findFirst(inputSelectors);
  if (!input) {
    return { status: 'manual_required', errorMessage: '未找到输入框' };
  }

  input.focus();

  if ('value' in input) {
    input.value = prompt;
  } else {
    input.textContent = prompt;
  }

  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const submit = findFirst(submitSelectors);
  if (!submit) {
    return { status: 'manual_required', errorMessage: '未找到发送按钮' };
  }

  submit.click();
  return { status: 'sent', errorMessage: null };
})();
`;
}
