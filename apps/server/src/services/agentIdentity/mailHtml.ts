import { parseHTML } from 'linkedom';

/** Larger than this is not rendered as HTML; the reader falls back to the plain text. */
const MAX_HTML_LENGTH = 2 * 1024 * 1024;

/** Where a remote image waits until the reader asks to load it. */
export const REMOTE_IMAGE_ATTRIBUTE = 'data-lobe-remote-src';

const ALLOWED_TAGS = new Set(
  'a abbr b big blockquote br caption center cite code col colgroup dd del div dl dt em font h1 h2 h3 h4 h5 h6 hr i img ins kbd li ol p pre q s small span strike strong style sub sup table tbody td tfoot th thead tr tt u ul'.split(
    ' ',
  ),
);

/** Dropped with everything inside them, rather than unwrapped to their text. */
const REMOVED_TAGS = new Set(
  'applet audio base button canvas embed frame frameset head iframe input link math meta noscript object script select svg template textarea title video'.split(
    ' ',
  ),
);

const ALLOWED_ATTRIBUTES = new Set(
  'align alt bgcolor border cellpadding cellspacing class color colspan dir face height href hspace lang rowspan size src style title valign vspace width'.split(
    ' ',
  ),
);

const SAFE_LINK = /^(https?:|mailto:)/i;
const REMOTE_URL = /^https?:/i;
const EMBEDDED_IMAGE = /^data:image\/(?:gif|jpe?g|png|webp);/i;
const REMOTE_CSS_URL = /url\(\s*['"]?\s*(?:https?:)?\/\//i;

/** URL schemes are compared without the whitespace and controls browsers ignore. */
// eslint-disable-next-line no-control-regex
const normalizeUrl = (value: string) => value.replaceAll(/[\u0000-\u0020]/g, '');

export interface SanitizedMailHtml {
  /** Whether anything remote was held back, so the reader can offer to load it. */
  hasRemoteContent: boolean;
  html: string;
}

const sanitizeElement = (element: any, state: { remote: boolean }): void => {
  for (const child of [...element.children]) {
    const tag = child.tagName.toLowerCase();

    if (REMOVED_TAGS.has(tag)) {
      child.remove();
      continue;
    }

    sanitizeElement(child, state);

    if (!ALLOWED_TAGS.has(tag)) {
      child.replaceWith(...child.childNodes);
      continue;
    }

    for (const { name, value } of [...child.attributes]) {
      if (!ALLOWED_ATTRIBUTES.has(name.toLowerCase())) child.removeAttribute(name);
      else if (name.toLowerCase() === 'style' && REMOTE_CSS_URL.test(value)) state.remote = true;
    }

    if (tag === 'a') {
      const href = normalizeUrl(child.getAttribute('href') ?? '');
      if (SAFE_LINK.test(href)) child.setAttribute('href', href);
      else child.removeAttribute('href');
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noopener noreferrer');
    }

    if (tag === 'img') {
      const src = normalizeUrl(child.getAttribute('src') ?? '');
      child.removeAttribute('src');
      if (EMBEDDED_IMAGE.test(src)) child.setAttribute('src', src);
      else if (REMOTE_URL.test(src)) {
        child.setAttribute(REMOTE_IMAGE_ATTRIBUTE, src);
        state.remote = true;
      }
    }

    if (tag === 'style') {
      const css = (child.textContent ?? '').replaceAll(/@import[^;]*;?/gi, '');
      if (REMOTE_CSS_URL.test(css)) state.remote = true;
      child.textContent = css;
    }
  }
};

/**
 * Reduce a mail's HTML to an allowlist of inert markup. Remote images lose their
 * `src` here, so nothing can load until the reader asks. This is the first of
 * two walls: the reader also renders the result in a script-less sandbox with a
 * CSP, so a parser disagreement here still cannot run anything.
 *
 * Returns `null` when the mail cannot be rendered safely.
 */
export const sanitizeMailHtml = (raw: string): SanitizedMailHtml | null => {
  if (raw.length > MAX_HTML_LENGTH) return null;

  try {
    const source = /<html[\s>]/i.test(raw) ? raw : `<html><body>${raw}</body></html>`;
    const { document } = parseHTML(source);
    const state = { remote: false };

    // Head styles carry most of a newsletter's layout, so they move into the body.
    const styles = [...document.querySelectorAll('head style')];
    if (styles.length > 0) document.body.prepend(...styles);

    sanitizeElement(document.body, state);

    return { hasRemoteContent: state.remote, html: document.body.innerHTML };
  } catch (error) {
    console.error('[AgentMailbox] sanitize html failed', error);
    return null;
  }
};
