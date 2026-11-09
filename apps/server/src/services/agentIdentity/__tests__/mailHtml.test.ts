import { describe, expect, it } from 'vitest';

import { REMOTE_IMAGE_ATTRIBUTE, sanitizeMailHtml } from '../mailHtml';

describe('sanitizeMailHtml', () => {
  it('drops scripts, event handlers and active elements', () => {
    const result = sanitizeMailHtml(
      `<p onclick="x()">hi</p><script>alert(1)</script><iframe src="https://a.test"></iframe><form action="https://a.test"><input name="q">kept</form><svg onload="x()"></svg>`,
    )!;

    expect(result.html).not.toMatch(/script|onclick|iframe|<form|<input|svg/i);
    expect(result.html).toContain('hi');
    expect(result.html).toContain('kept');
  });

  it('holds remote images back and reports them', () => {
    const result = sanitizeMailHtml(
      `<img onerror="x()" src="https://track.test/p.gif" width="1"><img src="data:image/png;base64,AAAA">`,
    )!;

    expect(result.hasRemoteContent).toBe(true);
    expect(result.html).toContain(`${REMOTE_IMAGE_ATTRIBUTE}="https://track.test/p.gif"`);
    expect(result.html).not.toContain(' src="https://track.test');
    expect(result.html).not.toContain('onerror');
    expect(result.html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('reports remote CSS and strips imports', () => {
    const result = sanitizeMailHtml(
      `<html><head><style>@import url(https://a.test/x.css); p{color:red}</style></head><body><div style="background:url(https://a.test/p.png)">x</div></body></html>`,
    )!;

    expect(result.html).not.toContain('@import');
    expect(result.html).toContain('color:red');
    expect(result.hasRemoteContent).toBe(true);
  });

  it('opens links safely and removes unsafe schemes', () => {
    const { html } = sanitizeMailHtml(
      `<a href="https://ok.test">a</a><a href=" java\tscript:alert(1)">b</a><a href="data:text/html,x">c</a>`,
    )!;

    expect(html).toContain('href="https://ok.test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/javascript|data:text/i);
  });

  it('refuses oversized mail', () => {
    expect(sanitizeMailHtml('x'.repeat(3 * 1024 * 1024))).toBeNull();
  });

  it('reports no remote content for a plain mail', () => {
    expect(sanitizeMailHtml('<p>hello</p>')).toEqual({
      hasRemoteContent: false,
      html: '<p>hello</p>',
    });
  });
});
