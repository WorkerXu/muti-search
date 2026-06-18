import { describe, expect, it } from 'vitest';
import { getService, services } from '../src/shared/services';
import {
  getPreloadPath,
  getRendererTarget,
  isAllowedExternalUrl,
  isAllowedWebviewConfig,
  resolveDistRoot,
  sanitizeWebviewPreferences
} from '../src/main/main';

describe('getRendererTarget', () => {
  it('loads the Vite dev server when VITE_DEV_SERVER_URL is set', () => {
    expect(getRendererTarget({ VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' })).toEqual({
      type: 'url',
      value: 'http://127.0.0.1:5173'
    });
  });

  it('loads the built renderer file when VITE_DEV_SERVER_URL is absent', () => {
    const target = getRendererTarget({});

    expect(target.type).toBe('file');
    expect(target.value.endsWith('/dist/renderer/index.html')).toBe(true);
  });
});

describe('resolveDistRoot', () => {
  it('uses the built dist parent when running from compiled main output', () => {
    expect(resolveDistRoot('file:///app/dist/main/main.js', '/ignored')).toBe('/app/dist');
  });

  it('falls back to cwd outside the compiled main output path', () => {
    expect(resolveDistRoot('file:///workspace/src/main/main.ts', '/workspace')).toBe(
      '/workspace/dist'
    );
  });
});

describe('getPreloadPath', () => {
  it('resolves the preload bundle under the selected dist root', () => {
    expect(getPreloadPath('file:///app/dist/main/main.js', '/ignored')).toBe(
      '/app/dist/preload/preload.js'
    );
  });
});

describe('isAllowedExternalUrl', () => {
  it('allows configured service origins and urls', () => {
    expect(isAllowedExternalUrl(getService('chatgpt').url)).toBe(true);
    expect(isAllowedExternalUrl('https://chatgpt.com/c/123')).toBe(true);
    expect(isAllowedExternalUrl(getService('doubao').url)).toBe(true);
  });

  it('denies arbitrary origins, non-http protocols, and invalid URLs', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(false);
    expect(isAllowedExternalUrl('http://127.0.0.1:5173')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('file:///tmp/test.html')).toBe(false);
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });
});

describe('isAllowedWebviewConfig', () => {
  const chatgpt = services.find((service) => service.id === 'chatgpt');

  it('allows exact configured service URLs with matching persistent partitions', () => {
    expect(chatgpt).toBeDefined();
    expect(isAllowedWebviewConfig(chatgpt?.url ?? '', chatgpt?.partition ?? '')).toBe(true);
  });

  it('allows browser-normalized root urls for configured services', () => {
    expect(isAllowedWebviewConfig('https://chatgpt.com/', 'persist:chatgpt')).toBe(true);
  });

  it('denies mismatched partitions, unconfigured paths, and invalid urls', () => {
    expect(isAllowedWebviewConfig('https://chatgpt.com/c/123', 'persist:chatgpt')).toBe(false);
    expect(isAllowedWebviewConfig('https://chatgpt.com', 'persist:deepseek')).toBe(false);
    expect(isAllowedWebviewConfig('not a url', 'persist:chatgpt')).toBe(false);
  });
});

describe('sanitizeWebviewPreferences', () => {
  it('strips guest preload values and enforces secure guest preferences', () => {
    const preferences = {
      preload: '/tmp/guest.js',
      preloadURL: 'file:///tmp/guest.js',
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false
    };

    expect(sanitizeWebviewPreferences(preferences)).toEqual({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    });
  });
});
