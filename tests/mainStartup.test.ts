import { describe, expect, it } from 'vitest';
import { getRendererTarget } from '../src/main/main';

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
