// @deno-types="https://cdn.skypack.dev/@types/markdown-it@12.2.3?dts"
import MarkdownIt from 'https://esm.sh/markdown-it@13.0.1?no-dts';

type WikiLinkOpts = {
  sanitizeUrls?: boolean;
  whitespaceChar?: string;
  baseUrl?: string;
};

function buildUrl(rawUrl: string, { whitespaceChar, baseUrl = '', sanitizeUrls }: WikiLinkOpts) {
  const whitespaceReplaced = whitespaceChar ? rawUrl.replace(/\s/g, whitespaceChar) : rawUrl;
  const withBaseUrl = `${baseUrl}/${whitespaceReplaced}`;
  const sanitized = sanitizeUrls ? encodeURIComponent(withBaseUrl) : withBaseUrl;
  return sanitized;
}

function MarkdownItWikiLink(md: MarkdownIt, options: WikiLinkOpts = {}) {
  md.inline.ruler.before('link', 'wiki', (state, silent) => {
    const remainingSrc = state.src.substring(state.pos);

    if (!remainingSrc.startsWith('[[')) return false;

    const closingPosition = remainingSrc.indexOf(']]');
    if (closingPosition == -1) return false;

    const linkParts = remainingSrc.substring(2, closingPosition).split('|');
    if (linkParts.length > 2) return false;

    if (!silent) {
      const rawUrl = linkParts[0];
      const url = buildUrl(rawUrl, options);
      const content = linkParts[1] ?? rawUrl;

      const token = state.push('link_open', 'a', 1);
      token.attrSet('href', buildUrl(url, options));
      token.markup = '[[';

      const textToken = state.push('text', '', 0);
      textToken.content = content;

      const closeToken = state.push('link_close', 'a', -1);
      closeToken.markup = ']]';
    }
    state.pos += closingPosition + 2;
    return true;
  });
}

export { MarkdownItWikiLink };
