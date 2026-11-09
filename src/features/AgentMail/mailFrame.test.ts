/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';

import { buildMailSrcDoc, estimateMailFrameHeight, MAIL_FRAME_SANDBOX } from './mailFrame';

const held = '<p>x</p><img data-lobe-remote-src="https://track.test/p.gif" width="1">';

describe('mail frame', () => {
  it('grants neither scripts nor same-origin nor top navigation', () => {
    expect(MAIL_FRAME_SANDBOX).not.toMatch(/allow-scripts|allow-same-origin|allow-top|allow-forms/);
  });

  it('keeps remote images held back and blocked by CSP by default', () => {
    const doc = buildMailSrcDoc(held, false);

    expect(doc).toContain('img-src data:;');
    expect(doc).not.toContain(' src="https://track.test');
  });

  it('loads them only when asked, without a referrer', () => {
    const doc = buildMailSrcDoc(held, true);

    expect(doc).toContain('img-src data: https: http:');
    expect(doc).toContain('src="https://track.test/p.gif"');
    expect(doc).toContain('referrerpolicy="no-referrer"');
  });

  it('keeps a leading style block when releasing images', () => {
    const doc = buildMailSrcDoc(`<style>.a{color:red}</style>${held}`, true);

    expect(doc).toContain('.a{color:red}');
  });

  it('bounds the estimated height', () => {
    expect(estimateMailFrameHeight('<p>a</p>', 600)).toBeGreaterThanOrEqual(96);
    expect(estimateMailFrameHeight('<p>a</p>'.repeat(500), 600)).toBeLessThanOrEqual(1200);
  });
});
