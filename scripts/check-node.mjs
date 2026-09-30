// Verifica a versão do Node antes de subir o projeto (o banco usa o SQLite embutido do Node).
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) {
  console.error(`\n  ✖ Node.js ${process.versions.node} detectado. Este projeto precisa do Node.js 22.13 ou mais recente.`);
  console.error('    Baixe a versão LTS em https://nodejs.org, feche e reabra o terminal e rode "npm install" de novo.\n');
  process.exit(1);
}
