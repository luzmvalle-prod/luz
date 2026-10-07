import fs from 'node:fs';
import path from 'node:path';
import type { Arquivos } from './casos.ts';
import { UPLOAD_DIR } from './db.ts';

/** Anexos gravados em data/uploads. */
export const arquivosEmDisco: Arquivos = {
  salvar(arquivo, f) {
    const destino = path.join(UPLOAD_DIR, arquivo);
    if (f.path) fs.renameSync(f.path, destino);
    else fs.writeFileSync(destino, f.buffer ?? new Uint8Array());
  },
};

export const caminhoDoArquivo = (arquivo: string) => path.join(UPLOAD_DIR, arquivo);
