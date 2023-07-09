import { getInjectConfig } from './util.ts';

type ShowEvent = {
  action: 'show';
  html: string;
  lcount: number;
};

type ScrollEvent = {
  action: 'scroll';
  line: number;
};

type SocketEvent = ShowEvent | ScrollEvent;

addEventListener('DOMContentLoaded', () => {
  const markdownBody = document.getElementById('markdown-body') as HTMLDivElement;
  const peek = getInjectConfig();

  if (peek.theme) markdownBody.classList.add(peek.theme);

  let source: { lcount: number } | undefined;
  let scroll: { line: number } | undefined;

  onload = () => {
    const item = sessionStorage.getItem('session');
    if (item) {
      const session = JSON.parse(item);
      onShow({ action: 'show', html: session.html, lcount: session.lcount });
      onScroll({ action: 'scroll', line: session.line });
    }
  };

  onbeforeunload = () => {
    sessionStorage.setItem(
      'session',
      JSON.stringify({
        html: markdownBody.innerHTML,
        lcount: source?.lcount,
        line: scroll?.line,
      }),
    );
  };

  const decoder = new TextDecoder();
  const socket = new WebSocket(`ws://${peek.serverUrl}/`);

  socket.binaryType = 'arraybuffer';

  socket.onclose = (event) => {
    if (!event.wasClean) {
      close();
      location.reload();
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(decoder.decode(event.data)) as SocketEvent;
    switch (data.action) {
      case 'show':
        onShow(data);
        break;
      case 'scroll':
        onScroll(data);
        break;
      default:
        break;
    }
  };

  function onShow(data: ShowEvent) {
    const html = data.html;
    markdownBody.innerHTML = html;
  }

  function onScroll(data: ScrollEvent) {
    const elements = document.querySelectorAll('[data-line-begin]');
    const targets = Array.from(elements)
      .map((e) => ({
        line: parseInt(e.getAttribute('data-line-begin')!),
        element: e,
      }))
      .sort((a, b) => b.line - a.line);
    const target = targets.find((t) => t.line <= data.line);
    target?.element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});
