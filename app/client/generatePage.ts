import { bundle } from 'https://deno.land/x/emit@0.24.0/mod.ts';

async function exists(path: string | URL) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadGithubCSS() {
  const cssPath = new URL(import.meta.resolve('./github-markdown.min.css'));
  if (await exists(cssPath)) return;
  const result = await fetch(
    'https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.1.0/github-markdown.min.css',
  );

  if (!result.ok)
    throw new Error(`Failed to fetch github theme css. ${result.status} ${result.statusText}`);

  const css = (await result.text())
    .replace('@media (prefers-color-scheme:dark){', '')
    .replace('}@media (prefers-color-scheme:light){.markdown-body', '.markdown-body.light')
    .replace('--color-danger-fg:#cf222e}', '--color-danger-fg: #cf222e;');
  await Deno.writeTextFile(cssPath, css);
}

async function downloadKatexCSS() {
  const cssPath = new URL(import.meta.resolve('./katex.min.css'));
  if (await exists(cssPath)) return;
  const result = await fetch('https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css');

  if (!result.ok)
    throw new Error(`Failed to fetch katex css. ${result.status} ${result.statusText}`);

  const css = await result.text();
  await Deno.writeTextFile(cssPath, css);
}

async function style(path: string) {
  const textContents = await Deno.readTextFile(new URL(import.meta.resolve(path)));
  return `<style>${textContents}</style>`;
}

function debugElements() {
  return `
<style>
  #logbox {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    min-height: 20px;
    max-height: 200px;
    overflow: scroll;
    background: red;
    color: white;
  }
</style>
<script>
  console.log = (...args) => {
    const logBox = document.getElementById('logbox');
    const newlog = document.createElement('p');
    newlog.innerHTML = args.join(';');
    logBox.appendChild(newlog);
    logBox.scrollTop = logBox.scrollHeight;
  }
  console.error = (...args) => console.log("error:", ...args)
  console.warn = (...args) => console.log("warn:", ...args)
</script>
`;
}

async function script(path: string) {
  const scriptPath = import.meta.resolve(path);
  const build = await bundle(new URL(scriptPath));
  return `<script>${build.code}</script>`;
}

async function buildHtml(debug = false) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Peek preview</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${await style('./katex.min.css')}
    ${await style('./github-markdown.min.css')}
    ${await style('./style.css')}
    ${debug ? debugElements() : ''}
  </head>
  <body>
    <main id="markdown-body" class="markdown-body">
      <div class="loader"></div>
    </main>
    <div class="marker"></div>
    ${debug ? '<div id="logbox"></div>' : ''}
    ${await script('./script.ts')}
  </body>
</html>
`;
}

async function generatePage() {
  await downloadGithubCSS();
  await downloadKatexCSS();
  const html = await buildHtml(false);
  return `data:text/html,${encodeURIComponent(html)}`;
}

export { generatePage };
