import { parse } from 'https://deno.land/std@0.159.0/flags/mod.ts';
import { dirname, fromFileUrl, normalize } from 'https://deno.land/std@0.159.0/path/mod.ts';
import { readChunks } from './read.ts';
import { render } from './markdownit.ts';

await Deno.remove('./log.txt', { recursive: true });
const oldLog = console.log;
console.log = (...args: Parameters<typeof console.log>) => {
  oldLog(...args);
  Deno.writeTextFileSync('./log.txt', args.join('') + '\n-----\n', { append: true });
};

const __args = parse(Deno.args);
const __dirname = dirname(new URL(import.meta.url).pathname);

async function init(socket: WebSocket) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const generator = readChunks(Deno.stdin);

  try {
    for await (const chunk of generator) {
      const action = decoder.decode(chunk.buffer);

      switch (action) {
        case 'show': {
          console.log('show invoked');
          const content = decoder.decode((await generator.next()).value!);

          console.log('showing content', content);
          socket.send(
            encoder.encode(
              JSON.stringify({
                action: 'show',
                html: render(content),
                lcount: (content.match(/(?:\r?\n)/g) || []).length + 1,
              }),
            ),
          );

          break;
        }
        case 'scroll': {
          console.log('scroll invoked');
          socket.send(
            encoder.encode(
              JSON.stringify({
                action,
                line: decoder.decode((await generator.next()).value!),
              }),
            ),
          );
          break;
        }
        default: {
          break;
        }
      }
    }
  } catch (e) {
    console.log('error in stdio comms');
    if (e.name !== 'InvalidStateError') throw e;
  }
}

async function webview(theme: string, serverUrl: string) {
  console.log('starting webview');
  const uri = import.meta.resolve('./client/webview.ts');

  const webview = new Deno.Command('deno', {
    args: [
      'run',
      '--allow-read',
      '--allow-write',
      '--allow-env',
      '--allow-net',
      '--allow-ffi',
      '--unstable',
      uri,
    ],
    env: {
      theme,
      serverUrl,
    },
    // stdin: 'null',
    // stdout: 'null',
  });

  const child = webview.spawn();
  await child.status;
  // await webview.output();
}

type StatefulTimeout = {
  reset: () => void;
  stop: () => void;
};

// we want to allow any function here
// deno-lint-ignore no-explicit-any
function createSatefulTimeout(func: (...args: any) => any, ms: number): StatefulTimeout {
  let timeout = setTimeout(func, ms);
  return {
    reset: function () {
      clearTimeout(timeout);
      timeout = setTimeout(func, ms);
    },
    stop: function () {
      clearTimeout(timeout);
    },
  };
}

function handleSocket(socket: WebSocket, timeout: StatefulTimeout) {
  timeout.stop();

  console.log('we got dat sockkkkket');

  if (!socket.onopen)
    socket.onopen = () => {
      console.log('sever socket open');
      init(socket);
    };

  socket.onclose = () => {
    console.log('server socket close');
    timeout.reset();
  };
}

async function serveHttp(c: Deno.Conn) {
  const timeout = createSatefulTimeout(() => {
    Deno.exit();
  }, 2000);

  const httpConn = Deno.serveHttp(c);
  for await (const h of httpConn) {
    console.log('got H', h);
    const { request } = h;
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const { socket, response } = Deno.upgradeWebSocket(request);
      h.respondWith(response);
      handleSocket(socket, timeout);
    } else {
      h.respondWith(new Response(undefined, { status: 501 }));
    }
  }
}

async function serveTcp(conn: Deno.Listener) {
  for await (const c of conn) {
    console.log('got c', c);
    serveHttp(c);
  }
}

function server(hostname = '0.0.0.0', port = 0) {
  const conn = Deno.listen({ hostname, port });
  serveTcp(conn);
  const addr = conn.addr as Deno.NetAddr;
  return `${addr.hostname.replace('0.0.0.0', 'localhost')}:${addr.port}`;
}

function handleSignals() {
  const win_signals = ['SIGINT', 'SIGBREAK'] as const;
  const unix_signals = ['SIGINT', 'SIGUSR2', 'SIGTERM', 'SIGPIPE', 'SIGHUP'] as const;
  const signals = Deno.build.os === 'windows' ? win_signals : unix_signals;

  for (const signal of signals) {
    Deno.addSignalListener(signal, () => {
      Deno.exit();
    });
  }
}

async function main() {
  handleSignals();
  const serverUrl = server();
  await webview(__args['theme'] ?? 'dark', serverUrl);
}

await main();
console.log('guess were exiting now...');
