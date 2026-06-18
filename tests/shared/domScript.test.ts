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
