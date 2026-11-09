/** Where a remote image waits until the reader asks to load it (see the server's sanitizer). */
const REMOTE_IMAGE_ATTRIBUTE = 'data-lobe-remote-src';

const MIN_FRAME_HEIGHT = 96;
const MAX_FRAME_HEIGHT = 1200;

/**
 * What the sandbox grants: opening a link in a new tab, and nothing else. No
 * scripts and no same-origin, so the mail can neither run nor reach this page.
 */
export const MAIL_FRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';

const buildCsp = (allowRemote: boolean) =>
  [
    "default-src 'none'",
    `img-src data:${allowRemote ? ' https: http:' : ''}`,
    "style-src 'unsafe-inline'",
    'font-src data:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');

// Mail is authored for a white page, so the frame stays light whatever the app theme is.
const FRAME_CSS = `
html,body{margin:0;padding:0;background:#fff;color:#1f1f1f}
body{padding:12px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-wrap:break-word}
img{max-width:100%;height:auto}
table{max-width:100%}
a{color:#0b57d0}
`;

/** The sanitized body with its held-back images released, parsed inertly. */
const releaseRemoteImages = (html: string): string => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  for (const image of parsed.querySelectorAll(`img[${REMOTE_IMAGE_ATTRIBUTE}]`)) {
    image.setAttribute('src', image.getAttribute(REMOTE_IMAGE_ATTRIBUTE) ?? '');
    image.setAttribute('referrerpolicy', 'no-referrer');
    image.removeAttribute(REMOTE_IMAGE_ATTRIBUTE);
  }

  // A leading <style> is parsed into the head, so the head has to come along.
  return parsed.head.innerHTML + parsed.body.innerHTML;
};

export const buildMailSrcDoc = (html: string, allowRemote: boolean): string => {
  const body = allowRemote ? releaseRemoteImages(html) : html;

  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${buildCsp(allowRemote)}"><meta name="referrer" content="no-referrer"><style>${FRAME_CSS}</style></head><body>${body}</body></html>`;
};

/**
 * A script-less, cross-origin frame cannot report its height, so it is estimated
 * from the inert markup; the frame scrolls inside itself if the estimate is short.
 */
export const estimateMailFrameHeight = (html: string, width: number): number => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const charsPerLine = Math.max(20, Math.floor((width - 24) / 7.5));
  const blocks = parsed.body.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,br').length;
  const textLines = Math.ceil((parsed.body.textContent ?? '').trim().length / charsPerLine);
  const imageHeight = [...parsed.body.querySelectorAll('img')].reduce(
    (total, image) => total + (Number(image.getAttribute('height')) || 160),
    0,
  );
  const estimate = 24 + (textLines + blocks) * 22 + imageHeight;

  return Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, estimate));
};
