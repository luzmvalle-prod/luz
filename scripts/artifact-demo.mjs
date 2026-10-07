// Converte dist-demo/index.html (gerado pelo vite-plugin-singlefile) no formato de página
// publicada como Artifact: sem <!doctype>/<html>/<head>/<body>, com <title> e estilos no topo.
import fs from 'node:fs';

const src = fs.readFileSync('dist-demo/index.html', 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const title = '<title>Sinistros INFLEET</title>';
const links = head.match(/<link[^>]+>/gi) ?? [];
const styles = head.match(/<style[\s\S]*?<\/style>/gi) ?? [];
const scripts = head.match(/<script[\s\S]*?<\/script>/gi) ?? [];
const out = [title, ...links.filter((l) => /fonts\.(googleapis|gstatic)/.test(l)), ...styles, body.trim(), ...scripts].join('\n');
fs.writeFileSync('dist-demo/sinistros-demo.html', out);
console.log(`dist-demo/sinistros-demo.html · ${(out.length / 1024 / 1024).toFixed(2)} MB`);
