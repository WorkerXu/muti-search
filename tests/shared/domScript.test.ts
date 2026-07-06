import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDomExtractAnswerScript,
  buildDomFillScript,
  buildDomPreSendPrepareScript,
  buildDomSendTargetScript,
  buildDomSendScript,
  type DomExtractAnswerScriptInput,
  type DomExtractAnswerScriptResult,
  type DomFillScriptInput,
  type DomFillScriptResult,
  type DomPreSendPrepareScriptInput,
  type DomPreSendPrepareScriptResult,
  type DomSendTargetScriptInput,
  type DomSendTargetScriptResult,
  type DomSendScriptInput,
  type DomSendScriptResult
} from '../../src/shared/domScript';

const runDomSendScript = async (input: DomSendScriptInput): Promise<DomSendScriptResult> =>
  (await window.eval(buildDomSendScript(input))) as DomSendScriptResult;

const runDomExtractAnswerScript = async (
  input: DomExtractAnswerScriptInput
): Promise<DomExtractAnswerScriptResult> =>
  (await window.eval(buildDomExtractAnswerScript(input))) as DomExtractAnswerScriptResult;

const runDomFillScript = async (input: DomFillScriptInput): Promise<DomFillScriptResult> =>
  (await window.eval(buildDomFillScript(input))) as DomFillScriptResult;

const runDomPreSendPrepareScript = async (
  input: DomPreSendPrepareScriptInput
): Promise<DomPreSendPrepareScriptResult> =>
  (await window.eval(buildDomPreSendPrepareScript(input))) as DomPreSendPrepareScriptResult;

const runDomSendTargetScript = async (
  input: DomSendTargetScriptInput
): Promise<DomSendTargetScriptResult> =>
  (await window.eval(buildDomSendTargetScript(input))) as DomSendTargetScriptResult;

describe('buildDomSendScript', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('escapes prompt text safely', () => {
    const script = buildDomSendScript({
      prompt: 'hello `world` ${bad}',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(script).toContain(JSON.stringify('hello `world` ${bad}'));
    expect(script).not.toContain('const prompt = `hello `world` ${bad}`');
  });

  it('escapes selector arrays safely', () => {
    const inputSelectors = [
      'textarea[data-label="say \\"hello\\""]',
      'div[data-line="first line\nsecond line"]',
      'section[data-html="</script><script>window.bad()</script>"]'
    ];
    const submitSelectors = [
      'button[aria-label="send \\"now\\""]',
      'button[data-line="submit\nnext"]',
      'button[data-html="</script><script>window.send()</script>"]'
    ];

    const script = buildDomSendScript({
      prompt: 'hello',
      inputSelectors,
      submitSelectors
    });

    expect(script).toContain(`const inputSelectors = ${JSON.stringify(inputSelectors)};`);
    expect(script).toContain(`const submitSelectors = ${JSON.stringify(submitSelectors)};`);
  });

  it('contains stable result shapes and Chinese error messages', () => {
    const script = buildDomSendScript({
      prompt: 'hello',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(script).toContain("status: 'sent'");
    expect(script).toContain("status: 'manual_required'");
    expect(script).toContain('未找到输入框');
    expect(script).toContain('未找到发送按钮');
  });

  it('fills a textarea, dispatches input and change, clicks submit, and returns sent', async () => {
    document.body.innerHTML = '<textarea></textarea><button type="submit">Send</button>';

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    const submit = document.querySelector('button') as HTMLButtonElement;
    const events: string[] = [];
    let clicks = 0;

    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    submit.addEventListener('click', () => {
      clicks += 1;
    });

    const result = await runDomSendScript({
      prompt: 'hello world',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(input.value).toBe('hello world');
    expect(events).toEqual(['input', 'change']);
    expect(clicks).toBe(1);
    expect('findFirst' in window).toBe(false);
  });

  it('returns manual_required for malformed selectors instead of throwing', async () => {
    document.body.innerHTML = '<textarea></textarea><button type="submit">Send</button>';

    const result = await runDomSendScript({
      prompt: 'hello world',
      inputSelectors: ['textarea['],
      submitSelectors: ['button[type="submit"]']
    });

    expect(result).toEqual({
      status: 'manual_required',
      errorMessage: '未找到输入框'
    });
  });

  it('fills contenteditable text, clicks submit, and returns sent', async () => {
    document.body.innerHTML = '<div contenteditable="true"></div><button type="button">Send</button>';

    const input = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const submit = document.querySelector('button') as HTMLButtonElement;
    let clicks = 0;

    submit.addEventListener('click', () => {
      clicks += 1;
    });

    const result = await runDomSendScript({
      prompt: 'editable hello',
      inputSelectors: ['[contenteditable="true"]'],
      submitSelectors: ['button']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(input.textContent).toBe('editable hello');
    expect(clicks).toBe(1);
  });

  it('falls back to the nearest icon submit button when selectors do not match', async () => {
    document.body.innerHTML = `
      <section class="composer">
        <button type="button" aria-label="添加附件">+</button>
        <div contenteditable="true" role="textbox"></div>
        <button type="button" aria-label="语音输入">voice</button>
        <button type="button" class="round-primary"><svg aria-hidden="true"></svg></button>
      </section>
    `;

    const input = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    let clickedIndex = -1;
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        clickedIndex = index;
      });
    });

    const result = await runDomSendScript({
      prompt: 'icon button hello',
      inputSelectors: ['[contenteditable="true"]'],
      submitSelectors: ['button[data-testid*="send"]']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(input.textContent).toBe('icon button hello');
    expect(clickedIndex).toBe(2);
  });

  it('waits for a framework-rendered submit button after input events', async () => {
    document.body.innerHTML = '<textarea></textarea><section class="composer"></section>';

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    const composer = document.querySelector('.composer') as HTMLElement;
    let clicks = 0;

    input.addEventListener('input', () => {
      window.setTimeout(() => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.testid = 'send-button';
        button.addEventListener('click', () => {
          clicks += 1;
        });
        composer.append(button);
      }, 20);
    });

    const result = await runDomSendScript({
      prompt: 'async submit hello',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[data-testid="send-button"]']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(input.value).toBe('async submit hello');
    expect(clicks).toBe(1);
  });

  it('waits for a lazily rendered input after navigation', async () => {
    document.body.innerHTML = '<section class="composer"></section>';

    const composer = document.querySelector('.composer') as HTMLElement;
    let clicks = 0;

    window.setTimeout(() => {
      const textarea = document.createElement('textarea');
      const button = document.createElement('button');
      button.type = 'submit';
      button.addEventListener('click', () => {
        clicks += 1;
      });
      composer.append(textarea, button);
    }, 20);

    const result = await runDomSendScript({
      prompt: 'lazy input hello',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'lazy input hello'
    );
    expect(clicks).toBe(1);
  });

  it('clicks send anchors and ignores enabled class false positives', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <button type="button" class="sm:enabled:hover:bg-token-bg-tertiary">查找资料</button>
      <a id="yuanbao-send-btn" class="style__send-btn___RwTm5" href="javascript:void(0)"></a>
    `;

    const textButton = document.querySelector('button') as HTMLButtonElement;
    const sendAnchor = document.querySelector('a') as HTMLAnchorElement;
    let textButtonClicks = 0;
    let sendAnchorClicks = 0;

    textButton.addEventListener('click', () => {
      textButtonClicks += 1;
    });
    sendAnchor.addEventListener('click', () => {
      sendAnchorClicks += 1;
    });

    const result = await runDomSendScript({
      prompt: 'anchor send hello',
      inputSelectors: ['textarea'],
      submitSelectors: ['#yuanbao-send-btn']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(textButtonClicks).toBe(0);
    expect(sendAnchorClicks).toBe(1);
  });

  it('waits until class-disabled send anchors become enabled before clicking', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <a id="yuanbao-send-btn" class="style__send-btn___RwTm5 style__send-btn--disabled___mhfdQ" href="javascript:void(0)"></a>
    `;

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    const sendAnchor = document.querySelector('a') as HTMLAnchorElement;
    let disabledClicks = 0;
    let enabledClicks = 0;

    input.addEventListener('input', () => {
      window.setTimeout(() => {
        sendAnchor.className = 'style__send-btn___RwTm5';
      }, 20);
    });

    sendAnchor.addEventListener('click', () => {
      if (sendAnchor.className.includes('disabled')) {
        disabledClicks += 1;
        return;
      }

      enabledClicks += 1;
    });

    const result = await runDomSendScript({
      prompt: 'wait for enabled anchor',
      inputSelectors: ['textarea'],
      submitSelectors: ['#yuanbao-send-btn']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(disabledClicks).toBe(0);
    expect(enabledClicks).toBe(1);
  });

  it('activates custom send controls with pointer and mouse events before click', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <div role="button" class="send-button"></div>
    `;

    const sendControl = document.querySelector('[role="button"]') as HTMLDivElement;
    const events: string[] = [];

    for (const eventName of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      sendControl.addEventListener(eventName, () => {
        events.push(eventName);
      });
    }

    const result = await runDomSendScript({
      prompt: 'custom send control',
      inputSelectors: ['textarea'],
      submitSelectors: ['[role="button"].send-button']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(events).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  });

  it('extracts the last matching assistant answer and ignores the user prompt', async () => {
    document.body.innerHTML = `
      <section data-message-author-role="user">hello prompt</section>
      <section data-message-author-role="assistant">first answer</section>
      <section data-message-author-role="assistant">final answer</section>
    `;

    const result = await runDomExtractAnswerScript({
      prompt: 'hello prompt',
      answerSelectors: ['[data-message-author-role="assistant"]'],
      busySelectors: ['[data-testid="stop-button"]']
    });

    expect(result).toEqual({
      status: 'ok',
      answerText: 'final answer',
      isBusy: false,
      errorMessage: null
    });
  });

  it('ignores bare CodeWiki spark icon text while extracting answers', async () => {
    document.body.innerHTML = `
      <section data-test-id="agent-message">spark</section>
      <section data-test-id="agent-message">spark 真实回答内容</section>
    `;

    const result = await runDomExtractAnswerScript({
      prompt: 'hello prompt',
      answerSelectors: ['[data-test-id="agent-message"]'],
      busySelectors: []
    });

    expect(result).toEqual({
      status: 'ok',
      answerText: '真实回答内容',
      isBusy: false,
      errorMessage: null
    });
  });

  it('reports busy empty answers when only a stop control is visible', async () => {
    document.body.innerHTML = '<button data-testid="stop-button">Stop</button>';

    const result = await runDomExtractAnswerScript({
      prompt: 'hello prompt',
      answerSelectors: ['.missing-answer'],
      busySelectors: ['[data-testid="stop-button"]']
    });

    expect(result).toEqual({
      status: 'empty',
      answerText: '',
      isBusy: true,
      errorMessage: '回答可能仍在生成中'
    });
  });

  it('locates input and waits for an enabled submit target', async () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <a id="yuanbao-send-btn" class="style__send-btn___RwTm5 style__send-btn--disabled___mhfdQ" href="javascript:void(0)"></a>
    `;

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    const submit = document.querySelector('a') as HTMLAnchorElement;
    input.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 200, height: 40 }) as DOMRect;
    submit.getBoundingClientRect = () =>
      ({ left: 250, top: 20, width: 40, height: 40 }) as DOMRect;

    const inputResult = await runDomSendTargetScript({
      inputSelectors: ['textarea'],
      submitSelectors: ['#yuanbao-send-btn'],
      target: 'input'
    });

    expect(inputResult).toEqual({
      status: 'ok',
      rect: { x: 10, y: 20, width: 200, height: 40 },
      errorMessage: null
    });

    window.setTimeout(() => {
      submit.className = 'style__send-btn___RwTm5';
    }, 20);

    const submitResult = await runDomSendTargetScript({
      inputSelectors: ['textarea'],
      submitSelectors: ['#yuanbao-send-btn'],
      target: 'submit'
    });

    expect(submitResult).toMatchObject({
      status: 'ok',
      rect: { x: 250, y: 20, width: 40, height: 40 },
      debug: {
        selected: {
          matchedBy: '#yuanbao-send-btn',
          id: 'yuanbao-send-btn'
        }
      },
      errorMessage: null
    });
  });

  it('waits for a lazily rendered physical input target', async () => {
    document.body.innerHTML = '<section class="composer"></section>';

    const composer = document.querySelector('.composer') as HTMLElement;
    window.setTimeout(() => {
      const input = document.createElement('textarea');
      input.getBoundingClientRect = () =>
        ({ left: 16, top: 24, width: 240, height: 48 }) as DOMRect;
      composer.append(input);
    }, 20);

    const inputResult = await runDomSendTargetScript({
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]'],
      target: 'input'
    });

    expect(inputResult).toEqual({
      status: 'ok',
      rect: { x: 16, y: 24, width: 240, height: 48 },
      errorMessage: null
    });
  });

  it('fills a physical-path textarea and dispatches input events', async () => {
    document.body.innerHTML = '<textarea></textarea>';

    const input = document.querySelector('textarea') as HTMLTextAreaElement;
    input.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 40 }) as DOMRect;
    const events: string[] = [];
    input.addEventListener('beforeinput', () => events.push('beforeinput'));
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    const result = await runDomFillScript({
      prompt: 'physical fill hello',
      inputSelectors: ['textarea']
    });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(input.value).toBe('physical fill hello');
    expect(events).toEqual(['beforeinput', 'input', 'change']);
  });

  it('fills a physical-path contenteditable with insertText semantics', async () => {
    document.body.innerHTML = '<div contenteditable="true" role="textbox">old</div>';

    const input = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    input.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 40 }) as DOMRect;
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    const result = await runDomFillScript({
      prompt: 'editable physical fill',
      inputSelectors: ['[contenteditable="true"]']
    });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(input.textContent).toBe('editable physical fill');
    expect(events).toContain('change');
  });

  it('selects Doubao expert mode before sending', async () => {
    document.body.innerHTML = '<button class="mode">快速</button>';

    const modeButton = document.querySelector('.mode') as HTMLButtonElement;
    modeButton.getBoundingClientRect = () =>
      ({ left: 760, top: 600, width: 73, height: 32 }) as DOMRect;
    modeButton.addEventListener('click', () => {
      if (document.querySelector('[role="menuitem"]')) {
        return;
      }

      const expert = document.createElement('button');
      expert.setAttribute('role', 'menuitem');
      expert.textContent = '专家 研究级专业问答 - 2.1 Turbo';
      expert.getBoundingClientRect = () =>
        ({ left: 760, top: 520, width: 240, height: 44 }) as DOMRect;
      expert.addEventListener('click', () => {
        modeButton.textContent = '专家';
      });
      document.body.append(expert);
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'doubao' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(modeButton.textContent).toBe('专家');
  });

  it('prefers the Doubao expert menu item over the expanded mode button text', async () => {
    document.body.innerHTML = '<button class="mode">快速</button>';

    const modeButton = document.querySelector('.mode') as HTMLButtonElement;
    let modeButtonClicks = 0;
    let expertClicks = 0;
    modeButton.getBoundingClientRect = () =>
      ({ left: 760, top: 600, width: 73, height: 32 }) as DOMRect;
    modeButton.addEventListener('click', () => {
      modeButtonClicks += 1;
      if (document.querySelector('[role="menuitem"]')) {
        return;
      }

      modeButton.textContent =
        '快速适用于大部分情况专家研究级专业问答 - 2.1 Turbo快速';
      const expert = document.createElement('div');
      expert.setAttribute('role', 'menuitem');
      expert.textContent = '专家 研究级专业问答 - 2.1 Turbo';
      expert.getBoundingClientRect = () =>
        ({ left: 760, top: 520, width: 240, height: 44 }) as DOMRect;
      expert.addEventListener('click', () => {
        expertClicks += 1;
        modeButton.textContent = '专家';
      });
      document.body.append(expert);
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'doubao' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(modeButtonClicks).toBe(1);
    expect(expertClicks).toBe(1);
    expect(modeButton.textContent).toBe('专家');
  });

  it('requires Doubao expert mode to be visibly selected before sending', async () => {
    document.body.innerHTML = '<button class="mode">快速</button>';

    const modeButton = document.querySelector('.mode') as HTMLButtonElement;
    modeButton.getBoundingClientRect = () =>
      ({ left: 760, top: 600, width: 73, height: 32 }) as DOMRect;
    modeButton.addEventListener('click', () => {
      if (document.querySelector('[role="menuitem"]')) {
        return;
      }

      const expert = document.createElement('button');
      expert.setAttribute('role', 'menuitem');
      expert.textContent = '专家 研究级专业问答 - 2.1 Turbo';
      expert.getBoundingClientRect = () =>
        ({ left: 760, top: 520, width: 240, height: 44 }) as DOMRect;
      document.body.append(expert);
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'doubao' });

    expect(result).toEqual({ status: 'manual_required', errorMessage: '豆包专家模式未生效' });
    expect(modeButton.textContent).toBe('快速');
  });

  it('keeps Doubao expert mode when it is already selected', async () => {
    document.body.innerHTML = '<button class="mode">专家</button>';

    const modeButton = document.querySelector('.mode') as HTMLButtonElement;
    let clicks = 0;
    modeButton.getBoundingClientRect = () =>
      ({ left: 760, top: 600, width: 73, height: 32 }) as DOMRect;
    modeButton.addEventListener('click', () => {
      clicks += 1;
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'doubao' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(clicks).toBe(0);
  });

  it('selects DeepSeek expert mode before sending', async () => {
    document.body.innerHTML = `
      <h1>使用快速模式开始对话</h1>
      <div role="radiogroup">
        <div role="radio" class="selected"><span>快速模式</span></div>
        <div role="radio"><span>专家模式</span></div>
        <div role="radio"><span>识图模式</span></div>
      </div>
    `;

    const heading = document.querySelector('h1') as HTMLHeadingElement;
    const quick = document.querySelector('[role="radio"]') as HTMLDivElement;
    const expert = Array.from(document.querySelectorAll('[role="radio"]')).find((element) =>
      /专家模式/.test(element.textContent || '')
    ) as HTMLDivElement;

    [quick, expert].forEach((element, index) => {
      element.getBoundingClientRect = () =>
        ({ left: 900 + index * 124, top: 295, width: 120, height: 34 }) as DOMRect;
    });
    expert.addEventListener('click', () => {
      quick.className = '';
      expert.className = 'selected';
      heading.textContent = '使用专家模式开始对话';
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'deepseek' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(heading.textContent).toBe('使用专家模式开始对话');
    expect(expert.className).toBe('selected');
  });

  it('recognizes DeepSeek expert mode selected by the radio-only selected class', async () => {
    document.body.innerHTML = `
      <h1>使用快速模式开始对话</h1>
      <div role="radiogroup">
        <div role="radio" class="_9f2341b _18572c1 _31a22b0"><span>快速模式</span></div>
        <div role="radio" class="_9f2341b _18572c1"><span>专家模式</span></div>
        <div role="radio" class="_9f2341b _18572c1"><span>识图模式</span></div>
      </div>
    `;

    const radios = Array.from(document.querySelectorAll('[role="radio"]')) as HTMLDivElement[];
    const expert = radios[1];

    radios.forEach((element, index) => {
      element.getBoundingClientRect = () =>
        ({ left: 900 + index * 124, top: 295, width: 120, height: 34 }) as DOMRect;
    });
    expert.addEventListener('click', () => {
      radios[0].className = '_9f2341b _18572c1';
      expert.className = '_9f2341b _18572c1 _31a22b0';
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'deepseek' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(expert.className).toContain('_31a22b0');
  });

  it('returns the DeepSeek expert mode rect when the dom click does not take effect', async () => {
    document.body.innerHTML = `
      <h1>使用快速模式开始对话</h1>
      <div role="radiogroup">
        <div role="radio" class="_9f2341b _18572c1 _31a22b0"><span>快速模式</span></div>
        <div role="radio" class="_9f2341b _18572c1"><span>专家模式</span></div>
        <div role="radio" class="_9f2341b _18572c1"><span>识图模式</span></div>
      </div>
    `;

    const expert = Array.from(document.querySelectorAll('[role="radio"]')).find((element) =>
      /专家模式/.test(element.textContent || '')
    ) as HTMLDivElement;
    expert.getBoundingClientRect = () =>
      ({ left: 1028, top: 295, width: 120, height: 34 }) as DOMRect;

    const result = await runDomPreSendPrepareScript({ serviceId: 'deepseek' });

    expect(result).toEqual({
      status: 'manual_required',
      errorMessage: 'DeepSeek 专家模式未生效',
      rect: { x: 1028, y: 295, width: 120, height: 34 }
    });
  });

  it('selects Gemini 3.1 Pro before sending', async () => {
    document.body.innerHTML =
      '<button aria-label="打开模式选择器，当前模式为“Flash”">Flash</button>';

    const modelButton = document.querySelector('button') as HTMLButtonElement;
    modelButton.getBoundingClientRect = () =>
      ({ left: 820, top: 700, width: 120, height: 36 }) as DOMRect;
    modelButton.addEventListener('click', () => {
      if (document.querySelector('[role="menuitem"]')) {
        return;
      }

      const pro = document.createElement('button');
      pro.setAttribute('role', 'menuitem');
      pro.textContent = '3.1 Pro 高等数学与代码';
      pro.getBoundingClientRect = () =>
        ({ left: 820, top: 620, width: 260, height: 44 }) as DOMRect;
      pro.addEventListener('click', () => {
        modelButton.textContent = 'Pro';
        modelButton.setAttribute('aria-label', '打开模式选择器，当前模式为“3.1 Pro”');
      });
      document.body.append(pro);
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'gemini' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(modelButton.getAttribute('aria-label')).toContain('3.1 Pro');
  });

  it('does not click Gemini 3.1 Pro when the menu reports it is already selected', async () => {
    document.body.innerHTML = '<button aria-label="打开模式选择器，当前模式为“Pro”">Pro</button>';

    const modelButton = document.querySelector('button') as HTMLButtonElement;
    let proClicks = 0;
    modelButton.getBoundingClientRect = () =>
      ({ left: 820, top: 700, width: 120, height: 36 }) as DOMRect;
    modelButton.addEventListener('click', () => {
      if (document.querySelector('[role="menuitem"]')) {
        return;
      }

      const selectedPro = document.createElement('button');
      selectedPro.setAttribute('role', 'menuitem');
      selectedPro.textContent = '已选中 3.1 Pro 高等数学与代码';
      selectedPro.getBoundingClientRect = () =>
        ({ left: 820, top: 620, width: 260, height: 44 }) as DOMRect;
      selectedPro.addEventListener('click', () => {
        proClicks += 1;
      });
      document.body.append(selectedPro);
    });

    const result = await runDomPreSendPrepareScript({ serviceId: 'gemini' });

    expect(result).toEqual({ status: 'ok', errorMessage: null });
    expect(proClicks).toBe(0);
  });
});
