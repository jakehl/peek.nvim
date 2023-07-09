import { Webview } from 'https://deno.land/x/webview@0.7.4/mod.ts';
import { generatePage } from './generatePage.ts';

const theme = Deno.env.get('theme') ?? '';
const serverUrl = Deno.env.get('serverUrl') ?? '';

const webview = new Webview();

console.log('its comingggggg');

webview.title = 'Peek preview';
webview.bind('_log', console.log);
webview.init(`
  window.peek = {};
  window.peek.theme = "${theme}"
  window.peek.serverUrl = "${serverUrl}"
`);

webview.navigate(await generatePage());
webview.run();

Deno.exit();
