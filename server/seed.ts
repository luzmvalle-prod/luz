// Dados de exemplo: os cinco casos do protótipo, um em cada etapa, com histórico.
import type { Usuario } from '../shared/domain.ts';
import { Casos, type ArquivoRecebido, type Arquivos } from './casos.ts';
import { FROTA } from './plataforma.ts';
import { pdfSimples } from './pdf.ts';
import { tx, type Db } from './schema.ts';

export const USUARIOS: Usuario[] = [
  { id: 'ana', nome: 'Ana Souza', setor: 'Monitoramento' },
  { id: 'fernanda', nome: 'Fernanda Alves', setor: 'Qualidade' },
  { id: 'rafaela', nome: 'Rafaela Costa', setor: 'Sinistro' },
  { id: 'diego', nome: 'Diego Nunes', setor: 'Manutenção' },
];

const arq = (nome: string, titulo: string, linhas: string[]): ArquivoRecebido => {
  const buffer = pdfSimples(titulo, linhas);
  return { originalname: nome, size: buffer.length, mimetype: 'application/pdf', buffer };
};

export function seed(db: Db, arquivos: Arquivos) {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM casos').get() as { n: number }).n;
  if (Number(n) > 0) return false;

  tx(db, () => {
    const u = db.prepare('INSERT OR IGNORE INTO usuarios (id, nome, setor) VALUES (?, ?, ?)');
    for (const x of USUARIOS) u.run(x.id, x.nome, x.setor);
    const v = db.prepare('INSERT OR IGNORE INTO veiculos (placa, modelo, categoria, unidade, motorista) VALUES (?, ?, ?, ?, ?)');
    for (const x of FROTA) v.run(x.placa, x.modelo, x.categoria, x.unidade, x.motorista);
  });

  const svc = new Casos(db, arquivos);
  const [ana, fernanda, rafaela, diego] = USUARIOS;
  const acao = (casoId: string, i: number) => svc.obter(casoId).acoes[i].id;

  // 5 · PNV-5C47 · Médio · concluído sem investigação
  const pnv = svc.registrar(
    {
      propriedade: 'proprio',
      placa: 'PNV-5C47',
      dataHora: '2026-09-03T11:05',
      motorista: 'Marcos Lima',
      local: 'Av. Recife, 4200 · Recife (PE)',
      tipo: 'Colisão traseira',
      condicaoVia: 'Pista seca',
      relato: 'Veículo à frente freou no semáforo; tocou a traseira em baixa velocidade.',
      envolvidos: [
        { nome: 'Marcos Lima', papel: 'Motorista do veículo', veiculo: 'PNV-5C47', lesao: 'Sem lesão' },
        { nome: 'Juliana Prado', papel: 'Condutor de terceiro', veiculo: 'Fiat Argo, placa QRS-1J22', lesao: 'Sem lesão' },
      ],
    },
    [],
    ana,
    '2026-09-03T11:30',
  );
  svc.salvarClassificacao(
    pnv.id,
    { real: { pessoas: 0, via: 0, ambiente: 0, carga: 1 }, pot: { pessoas: 1, via: 0, ambiente: 0, carga: 1 }, justificativa: 'Baixa velocidade; potencial limitado a lesão leve do terceiro.' },
    ana,
    true,
    '2026-09-03T11:48',
  );

  // 4 · SGD-2B83 · Gravíssimo · concluído
  const sgd = svc.registrar(
    {
      propriedade: 'proprio',
      placa: 'SGD-2B83',
      dataHora: '2026-09-09T22:35',
      motorista: 'Antônio Ribeiro',
      local: 'BR-232, km 18 · Jaboatão dos Guararapes (PE)',
      tipo: 'Colisão com motocicleta',
      condicaoVia: 'Iluminação precária',
      relato: 'Motocicleta surgiu no ponto cego ao mudar de faixa.',
      envolvidos: [
        { nome: 'Antônio Ribeiro', papel: 'Motorista do veículo', veiculo: 'SGD-2B83', lesao: 'Sem lesão' },
        { nome: 'Wellington Souza', papel: 'Condutor de terceiro', veiculo: 'Honda CG 160, placa PFR-7C03', lesao: 'Lesão grave' },
      ],
    },
    [],
    ana,
    '2026-09-09T22:58',
  );
  svc.salvarClassificacao(
    sgd.id,
    { real: { pessoas: 2, via: 1, ambiente: 0, carga: 1 }, pot: { pessoas: 3, via: 2, ambiente: 0, carga: 1 }, justificativa: 'Motociclista arrastado sob a carreta; risco de óbito.' },
    ana,
    true,
    '2026-09-09T23:10',
  );
  svc.salvarInvestigacao(
    sgd.id,
    {
      comiteData: '2026-09-10',
      participantes: ['Fernanda Alves · Qualidade', 'Diego Nunes · Manutenção', 'Rafaela Costa · Sinistro'],
      evidencias: svc.obter(sgd.id).dados?.eventos.map((e) => e.id) ?? [],
      constatado: 'Retrovisor lateral direito desregulado; mudança de faixa sem sinalização prévia de 3 s.',
      hipoteses: [
        { id: 'h1', tipo: 'Hipótese confirmada', descricao: 'Ponto cego por retrovisor desregulado', evidencia: 'Checklist de saída' },
        { id: 'h2', tipo: 'Fator · humano', descricao: 'Mudança de faixa sem checagem', evidencia: 'Clipe da câmera externa' },
        { id: 'h3', tipo: 'Fator · ambiente', descricao: 'Trecho com iluminação precária', evidencia: 'Relato do monitoramento' },
      ],
      causaRaiz: 'Mudança de faixa com ponto cego não verificado.',
      certeza: 'Confirmada',
      evitabilidade: 'Evitável',
      responsabilidade: 'Compartilhada',
    },
    fernanda,
    '2026-09-10T15:20',
  );
  svc.criarAcao(sgd.id, { titulo: 'Incluir regulagem de retrovisores no checklist de saída', responsavel: 'Diego Nunes · Manutenção', prazo: '2026-09-20' }, fernanda, null, '2026-09-10T15:30');
  svc.criarAcao(sgd.id, { titulo: 'Reciclagem de direção defensiva para o motorista', responsavel: 'Fernanda Alves · Qualidade', prazo: '2026-09-24' }, fernanda, null, '2026-09-10T15:32');
  svc.concluirInvestigacao(sgd.id, undefined, fernanda, '2026-09-10T15:40');
  svc.anexarEvidencia(acao(sgd.id, 0), arq('checklist-saida-v3.pdf', 'Checklist de saída · v3', ['Item 14: regulagem de retrovisores (novo).']), diego, '2026-09-18T09:12');
  svc.concluirAcao(acao(sgd.id, 0), diego, '2026-09-18T09:15');
  svc.anexarEvidencia(acao(sgd.id, 1), arq('certificado-direcao-defensiva.pdf', 'Certificado · Direção defensiva', ['Antônio Ribeiro · 8 h · 23/09/2026']), fernanda, '2026-09-23T17:40');
  svc.concluirAcao(acao(sgd.id, 1), fernanda, '2026-09-23T17:42');
  svc.concluirCaso(sgd.id, fernanda, '2026-09-24T10:05');

  // 3 · QPX-7H09 · Grave · em investigação
  const qpx = svc.registrar(
    {
      propriedade: 'proprio',
      placa: 'QPX-7H09',
      dataHora: '2026-09-18T16:10',
      motorista: 'José Ferreira',
      local: 'PE-060, km 9 · Ipojuca (PE)',
      tipo: 'Colisão frontal',
      condicaoVia: 'Obras na via',
      relato: 'Desvio de obra sem sinalização; veículo em sentido contrário invadiu a faixa.',
      envolvidos: [
        { nome: 'José Ferreira', papel: 'Motorista do veículo', veiculo: 'QPX-7H09', lesao: 'Lesão leve' },
        { nome: 'Não identificado', papel: 'Condutor de terceiro', veiculo: 'Caminhonete branca', lesao: 'Lesão leve' },
      ],
    },
    [],
    ana,
    '2026-09-18T16:32',
  );
  svc.salvarClassificacao(
    qpx.id,
    { real: { pessoas: 1, via: 2, ambiente: 0, carga: 2 }, pot: { pessoas: 2, via: 2, ambiente: 1, carga: 2 }, justificativa: 'Choque frontal a 40 km/h; potencial de lesão com afastamento e vazamento de diesel.' },
    ana,
    true,
    '2026-09-18T16:50',
  );
  svc.salvarInvestigacao(qpx.id, { comiteData: '2026-09-19', participantes: ['Fernanda Alves · Qualidade'] }, fernanda, '2026-09-19T10:02');

  // 2 · RTB-4E21 · Gravíssimo · acompanhamento (caso de referência do protótipo)
  const rtb = svc.registrar(
    {
      propriedade: 'proprio',
      placa: 'RTB-4E21',
      dataHora: '2026-09-22T07:42',
      motorista: 'Carlos Menezes',
      local: 'BR-101, km 72 · Cabo de Santo Agostinho (PE)',
      tipo: 'Saída de pista',
      condicaoVia: 'Pista molhada',
      relato: 'Relatou falha no freio ao ligar para a manutenção.',
      vinculo: 'Frota',
      operacao: 'Distribuição Suape',
      rnc: 'RNC-2026-031',
      bo: '',
      envolvidos: [
        { nome: 'Carlos Menezes', papel: 'Motorista do veículo', veiculo: 'RTB-4E21', lesao: 'Sem lesão' },
        { nome: 'Não identificado', papel: 'Condutor de terceiro', veiculo: 'Carreta à frente, placa não registrada', lesao: 'Sem lesão' },
      ],
    },
    [arq('fotos-local-br101.pdf', 'Fotos do local · BR-101 km 72', ['Registro fotográfico do acostamento e da pista molhada.'])],
    ana,
    '2026-09-22T07:58',
  );
  svc.salvarClassificacao(
    rtb.id,
    {
      real: { pessoas: 0, via: 0, ambiente: 0, carga: 1 },
      pot: { pessoas: 3, via: 2, ambiente: 0, carga: 1 },
      justificativa: 'O veículo seguia sem reduzir em direção à traseira de outra carreta. Evitou a colisão pelo acostamento.',
    },
    ana,
    true,
    '2026-09-22T08:02',
  );
  svc.salvarArquivo(rtb.id, 'investigacao', arq('laudo-teste-freio.pdf', 'Laudo · Teste de freio pós-sinistro', ['RTB-4E21 · Resultado: aprovado.']), diego, null, '2026-09-22T15:10');
  svc.log(rtb.id, 'Laudo do teste de freio anexado', diego, null, '2026-09-22T15:10');
  svc.salvarInvestigacao(
    rtb.id,
    {
      comiteData: '2026-09-23',
      participantes: ['Fernanda Alves · Qualidade', 'Diego Nunes · Manutenção', 'Rafaela Costa · Sinistro'],
      evidencias: ['ev-cam', 'ev1', 'ev2', 'ev3'],
      constatado: 'Freio aprovado em teste. Na câmera externa, os veículos à frente reduzem e o nosso segue sem reduzir.',
      hipoteses: [
        { id: 'h1', tipo: 'Hipótese descartada', descricao: 'Falha mecânica no freio', evidencia: 'Laudo do teste de freio' },
        { id: 'h2', tipo: 'Fator · humano', descricao: 'Provável distração, não confirmada', evidencia: 'Evento: risco de colisão 07:41:58' },
        { id: 'h3', tipo: 'Fator · humano', descricao: 'Excesso de velocidade 6 min antes', evidencia: 'Evento de telemetria 07:36' },
        { id: 'h4', tipo: 'Fator · ambiente', descricao: 'Pista molhada após chuva', evidencia: 'Clipe da câmera externa' },
        { id: 'h5', tipo: 'Fator · organização', descricao: 'Câmera interna obstruída sem alerta prévio', evidencia: 'Status da câmera' },
        { id: 'h6', tipo: 'Fator · organização', descricao: 'Comunicação chegou à manutenção, não ao setor de sinistro', evidencia: 'Relato do monitoramento' },
      ],
      detalhes: {
        jornadaObs: 'Fez a jornada dentro da lei, sem paradas desde as 05:30. Saída antecipada a pedido da operação.',
        condutor: { condicaoFisica: ['Normal'], condicaoObs: '', historico: ['Punições'], historicoObs: 'Advertência em agosto por câmera obstruída.', cnh: '', validadeCnh: '', validadeToxicologico: '' },
        via: { pista: ['Molhada'], pavimentacao: 'Boa', sinalizacao: 'Regular', contexto: ['Dia', 'Chuva'], rodovia: 'BR-101, km 72', concessionaria: '', faixas: '2' },
      },
      causaRaiz: 'Provável distração do motorista.',
      certeza: 'Inconclusiva',
      evitabilidade: 'Evitável',
      responsabilidade: 'Nosso condutor',
    },
    fernanda,
    '2026-09-23T16:02',
  );
  svc.criarAcao(rtb.id, { titulo: 'Reforçar o fluxo de comunicação do sinistro', responsavel: 'Rafaela Costa · Sinistro', prazo: '2026-10-10' }, fernanda, null, '2026-09-23T16:03');
  svc.criarAcao(rtb.id, { titulo: 'Conscientizar motoristas sobre a câmera interna', responsavel: 'Fernanda Alves · Qualidade', prazo: '2026-10-17' }, fernanda, null, '2026-09-23T16:04');
  svc.concluirInvestigacao(rtb.id, undefined, fernanda, '2026-09-23T16:05');
  void rafaela;

  // 1 · KTR-1A66 · aguardando classificação
  svc.registrar(
    {
      propriedade: 'proprio',
      placa: 'KTR-1A66',
      dataHora: '2026-09-29T06:15',
      motorista: 'Paulo Andrade',
      local: 'Porto de Suape, pátio 3 · Ipojuca (PE)',
      tipo: 'Choque com objeto fixo',
      condicaoVia: 'Pista seca',
      relato: 'Encostou a lateral no pilar da doca durante manobra de ré.',
      envolvidos: [{ nome: 'Paulo Andrade', papel: 'Motorista do veículo', veiculo: 'KTR-1A66', lesao: 'Sem lesão' }],
    },
    [],
    ana,
    '2026-09-29T06:40',
  );
  return true;
}
