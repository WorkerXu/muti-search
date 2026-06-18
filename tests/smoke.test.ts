import { beforeEach, describe, expect, it } from 'vitest';

describe('renderer bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('mounts the app shell into #app', async () => {
    await import('../src/renderer/main');

    expect(document.querySelector('.app-shell')).not.toBeNull();
    expect(document.querySelector('h1')?.textContent).toBe('muti-search');
  });
});
