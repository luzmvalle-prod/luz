import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import type { Plugin } from 'vite';

/** `virtual:sql-wasm`: o binário do SQLite (sql.js) em base64, para caber no arquivo único. */
function sqlWasmInline(): Plugin {
  const id = 'virtual:sql-wasm';
  return {
    name: 'sql-wasm-inline',
    resolveId: (s) => (s === id ? '\0' + id : undefined),
    load(s) {
      if (s !== '\0' + id) return;
      const wasm = fs.readFileSync(fileURLToPath(new URL('./node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)));
      return `export default ${JSON.stringify(wasm.toString('base64'))};`;
    },
  };
}

const API_PORT = Number(process.env.API_PORT ?? 3789);

export default defineConfig(({ mode }) => {
  // `npm run build:demo`: um único HTML que roda sem servidor, com as regras e os dados de
  // exemplo no navegador (web/src/demo/api-demo.ts no lugar de web/src/api.ts).
  const demo = mode === 'demo';
  return {
    root: 'web',
    base: demo ? './' : '/',
    plugins: [react(), ...(demo ? [sqlWasmInline(), viteSingleFile()] : [])],
    resolve: demo
      ? { alias: [{ find: /^(?:\.\.?\/)+api\.ts$/, replacement: fileURLToPath(new URL('./web/src/demo/api-demo.ts', import.meta.url)) }] }
      : undefined,
    server: {
      port: Number(process.env.WEB_PORT ?? 5173),
      proxy: { '/api': `http://localhost:${API_PORT}` },
    },
    build: demo ? { outDir: '../dist-demo', emptyOutDir: true, assetsInlineLimit: 100_000_000 } : { outDir: '../dist', emptyOutDir: true },
  };
});
