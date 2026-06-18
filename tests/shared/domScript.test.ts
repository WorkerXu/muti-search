import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDomSendScript,
  type DomSendScriptInput,
  type DomSendScriptResult
} from '../../src/shared/domScript';

const runDomSendScript = (input: DomSendScriptInput): DomSendScriptResult =>
  window.eval(buildDomSendScript(input)) as DomSendScriptResult;

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

  it('fills a textarea, dispatches input and change, clicks submit, and returns sent', () => {
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

    const result = runDomSendScript({
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

  it('returns manual_required for malformed selectors instead of throwing', () => {
    document.body.innerHTML = '<textarea></textarea><button type="submit">Send</button>';

    const result = runDomSendScript({
      prompt: 'hello world',
      inputSelectors: ['textarea['],
      submitSelectors: ['button[type="submit"]']
    });

    expect(result).toEqual({
      status: 'manual_required',
      errorMessage: '未找到输入框'
    });
  });

  it('fills contenteditable text, clicks submit, and returns sent', () => {
    document.body.innerHTML = '<div contenteditable="true"></div><button type="button">Send</button>';

    const input = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const submit = document.querySelector('button') as HTMLButtonElement;
    let clicks = 0;

    submit.addEventListener('click', () => {
      clicks += 1;
    });

    const result = runDomSendScript({
      prompt: 'editable hello',
      inputSelectors: ['[contenteditable="true"]'],
      submitSelectors: ['button']
    });

    expect(result).toEqual({ status: 'sent', errorMessage: null });
    expect(input.textContent).toBe('editable hello');
    expect(clicks).toBe(1);
  });
});
