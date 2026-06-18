import { describe, expect, it } from 'vitest';
import { SERVICE_IDS, getService, services } from '../../src/shared/services';
import { createInitialPaneState, statusLabels } from '../../src/shared/status';

describe('service registry', () => {
  it('contains the 9 selected services in grid order', () => {
    expect(SERVICE_IDS).toEqual([
      'chatgpt',
      'deepseek',
      'grok',
      'doubao',
      'gemini',
      'yuanbao',
      'qwen',
      'zhipu',
      'perplexity'
    ]);
    expect(services).toHaveLength(9);
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
      'persist:qwen',
      'persist:zhipu',
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
