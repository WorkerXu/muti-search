import { describe, expect, it } from 'vitest';
import { SERVICE_IDS, getService, services } from '../../src/shared/services';
import { createInitialPaneState, statusLabels } from '../../src/shared/status';

describe('service registry', () => {
  it('contains the selected services in grid order', () => {
    expect(SERVICE_IDS).toEqual([
      'chatgpt',
      'deepseek',
      'grok',
      'doubao',
      'gemini',
      'yuanbao',
      'perplexity'
    ]);
    expect(services).toHaveLength(7);
  });

  it('keeps service order and ids in sync', () => {
    expect(services.map((service) => service.id)).toEqual(SERVICE_IDS);
  });

  it('uses persistent partitions for every service', () => {
    expect(services.map((service) => service.partition)).toEqual([
      'persist:chatgpt',
      'persist:deepseek',
      'persist:grok',
      'persist:doubao',
      'persist:gemini',
      'persist:yuanbao',
      'persist:perplexity'
    ]);
  });

  it('derives every partition from its service id', () => {
    for (const service of services) {
      expect(service.partition).toBe(`persist:${service.id}`);
    }
  });

  it('preserves official service URLs', () => {
    expect(getService('doubao')).toMatchObject({
      id: 'doubao',
      name: '豆包',
      url: 'https://www.doubao.com/chat/'
    });
    expect(getService('perplexity').url).toBe('https://www.perplexity.ai');
  });

  it('stores explicit send selector metadata on every service', () => {
    for (const service of services) {
      const send = (
        service as {
          send?: { inputSelectors?: readonly string[]; submitSelectors?: readonly string[] };
        }
      ).send;

      expect(Array.isArray(send?.inputSelectors)).toBe(true);
      expect(send?.inputSelectors?.length ?? 0).toBeGreaterThan(0);
      expect(Array.isArray(send?.submitSelectors)).toBe(true);
      expect(send?.submitSelectors?.length ?? 0).toBeGreaterThan(0);
    }

    expect(getService('doubao')).toMatchObject({
      send: {
        inputSelectors: expect.arrayContaining(['textarea', '[contenteditable="true"]']),
        submitSelectors: expect.arrayContaining(['button[aria-label*="发送"]'])
      }
    });
    expect(getService('perplexity')).toMatchObject({
      send: {
        inputSelectors: expect.arrayContaining([
          '[data-ask-input-container="true"] [contenteditable="true"][role="textbox"]'
        ])
      }
    });
  });

  it('stores explicit answer extraction metadata on every service', () => {
    for (const service of services) {
      const answer = (
        service as {
          answer?: { answerSelectors?: readonly string[]; busySelectors?: readonly string[] };
        }
      ).answer;

      expect(Array.isArray(answer?.answerSelectors)).toBe(true);
      expect(answer?.answerSelectors?.length ?? 0).toBeGreaterThan(0);
      expect(Array.isArray(answer?.busySelectors)).toBe(true);
      expect(answer?.busySelectors?.length ?? 0).toBeGreaterThan(0);
    }

    expect(getService('chatgpt')).toMatchObject({
      answer: {
        answerSelectors: expect.arrayContaining(['[data-message-author-role="assistant"]']),
        busySelectors: expect.arrayContaining(['[data-testid="stop-button"]'])
      }
    });
    expect(getService('doubao')).toMatchObject({
      answer: {
        answerSelectors: expect.arrayContaining(['.md-box-root'])
      }
    });
  });


  it('throws a clear error for an unknown service id', () => {
    expect(() => getService('missing')).toThrow('Unknown service id: missing');
  });

  it('exposes frozen service definitions and labels', () => {
    expect(Object.isFrozen(services)).toBe(true);
    expect(Object.isFrozen(getService('chatgpt'))).toBe(true);
    expect(Object.isFrozen(statusLabels)).toBe(true);
  });

  it('creates an initial pane state with no stored prompt or answer data', () => {
    expect(createInitialPaneState()).toEqual({
      enabled: true,
      selected: true,
      status: 'loading',
      errorMessage: null
    });
    expect(statusLabels.manual_required).toBe('需人工处理');
  });
});
