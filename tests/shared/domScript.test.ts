import { describe, expect, it } from 'vitest';
import { buildDomSendScript } from '../../src/shared/domScript';

describe('buildDomSendScript', () => {
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
});
