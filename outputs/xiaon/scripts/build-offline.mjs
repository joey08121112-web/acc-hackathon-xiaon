import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const output = path.resolve(process.argv[2] || path.join(root, '..', 'team'));
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
html=html.replace('</head>','<meta name="xiaon-offline" content="rules-only-no-server-agents"></head>');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Expected one fully bundled script and stylesheet.');
for (const match of scripts) {
  const js = await readFile(path.join(dist, match[1].replace(/^\//, '')), 'utf8');
  // Check classic-script syntax without executing the application in Node.
  // A future code-splitting/import change must fail the offline build explicitly.
  new Script(js, { filename: match[1] });
  html = html.replace(match[0], '');
  // Function replacements keep $ sequences in the bundle literal; a string
  // replacement would interpret $&, $$ or $' inside the code and corrupt it.
  html = html.replace(
    '</body>',
    () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`,
  );
}
for (const match of styles) {
  const css = await readFile(path.join(dist, match[1].replace(/^\//, '')), 'utf8');
  if (/url\(\s*['"]?(?:https?:|\/assets\/)/i.test(css)) throw new Error('External CSS resource detected.');
  html = html.replace(
    match[0],
    () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`,
  );
}
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
if (/<(?:script|link)\b[^>]*(?:src|href)="(?:https?:|\/assets\/)/i.test(markup)) throw new Error('An external asset is still referenced.');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, '双击打开-学伴小N.html'), html);
console.log(`Offline HTML: ${path.join(output, '双击打开-学伴小N.html')} (${Buffer.byteLength(html)} bytes)`);
