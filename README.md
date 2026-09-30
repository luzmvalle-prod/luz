# C1 · Registro e investigação de sinistros (localhost)

Implementação local do protótipo **C1 · Sinistros** da INFLEET: registro, classificação, investigação em comitê, acompanhamento do plano de ação com evidências e conclusão do caso, com histórico completo.

## Rodando

Requisitos: **Node.js 22.13+** (usa o SQLite embutido do Node, sem dependências nativas).

```bash
npm install
npm run dev
```

- Aplicação: http://localhost:5173
- API: http://localhost:3789/api

Na primeira execução o banco (`data/sinistros.db`) é criado com os 5 casos do protótipo, um em cada etapa. Para voltar ao estado inicial: `npm run db:reset` (com o servidor parado).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API (com reload) + interface Vite |
| `npm test` | Testes das regras de negócio |
| `npm run typecheck` | Checagem de tipos |
| `npm run build && npm start` | Build de produção servido pela API em http://localhost:3789 |
| `npm run db:reset` | Recria o banco com os dados de exemplo |

Não há login no ambiente local: o seletor **“Usando como”**, no rodapé do menu, define o autor das ações (Ana · Monitoramento, Fernanda · Qualidade, Rafaela · Sinistro, Diego · Manutenção).

## Se der erro

| O que aparece | Causa e solução |
| --- | --- |
| Navegador: “Não é possível acessar esse site” / `ERR_CONNECTION_REFUSED` | O servidor não está rodando **no seu computador**. Rode `npm run dev` e deixe o terminal aberto. |
| Terminal: `Node.js X detectado… precisa do 22.13` ou `No such built-in module: node:sqlite` | Instale o Node.js LTS (22 ou mais recente) em https://nodejs.org, reabra o terminal e rode `npm install` de novo. Confira com `node -v`. |
| Tela: “A API não está respondendo” | A interface subiu mas a API caiu. Veja a mensagem na linha `[api]` do terminal. |
| Terminal: `A porta 3789 já está em uso` | Outro processo usa a porta. Feche-o ou rode `API_PORT=3790 npm run dev`. |
| Erro no `npm install` | Apague `node_modules` e rode `npm install` de novo com o Node atualizado. |

## Fluxo e regras

1. **Registro:** veículo próprio ou de terceiro. Para veículo próprio, motorista e local são sugeridos pela telemetria no horário informado. Ao registrar, jornada, eventos de telemetria e videotelemetria, manutenção e vídeo da janela são **puxados e congelados** no caso. Veículo de terceiro segue só com os dados e anexos informados.
2. **Classificação:** dano real e potencial em 4 dimensões (pessoas, via, meio ambiente, carga e prejuízo). O **nível do caso é o maior entre todos**. Se o potencial for maior que o real, a justificativa é obrigatória. **Grave ou gravíssimo exige investigação** (o comitê é sugerido para o dia seguinte). Abaixo disso, o caso é concluído sem investigação.
3. **Investigação:** comitê (data e participantes), eventos da plataforma marcados como evidência, jornada avaliada pela Lei 13.103/2015, histórico de 30 dias do motorista, relato × constatação, hipóteses e fatores, conclusão (causa raiz, certeza, evitabilidade, responsabilidade) e plano de ação. Rascunho salvo automaticamente. Só conclui sem pendências e com ao menos uma ação, cada uma com responsável e prazo.
4. **Acompanhamento:** cada ação só é concluída **com evidência anexada**. O caso só é concluído quando todas as ações estiverem concluídas. Incluir ou alterar ações nessa fase exige motivo.
5. **Conclusão:** resumo, relatório para impressão/PDF, exportação dos dados da CAT (JSON) e reabertura com motivo.

**Ficha do caso:** Resumo, Dados coletados (com fonte e horário de coleta), Investigação, Plano de ação e Histórico. Nada é apagado: cada mudança guarda autor, data e motivo. Correções no registro exigem motivo e não alteram os dados congelados.

## Estrutura

```
shared/domain.ts     tipos e regras (níveis, critérios, jornada, pendências), usados pela API e pela interface
server/
  casos.ts           serviço com as regras de transição de etapa e o histórico
  plataforma.ts      simulação das integrações INFLEET (telemetria, vídeo, manutenção, jornada)
  app.ts             rotas Express (REST em /api)
  db.ts / seed.ts    esquema SQLite e dados de exemplo
  casos.test.ts      testes (node:test)
web/src/
  pages/             Lista, Registro, Classificação, Investigação, Acompanhamento, Conclusão, Ficha, Relatório
  components/        layout, stepper, badges, modais
```

Arquivos enviados ficam em `data/uploads/` (limite de 25 MB por arquivo).

### O que é simulado

- **Integrações INFLEET** (`server/plataforma.ts`): os dados são gerados de forma determinística a partir da placa e do horário. O caso RTB-4E21 · 22/09/2026 07:42 reproduz exatamente os dados do protótipo. Para integrar de verdade, basta trocar `consultarPosicao` e `coletarDados` por chamadas aos serviços reais.
- **Critérios de nível e regras de jornada** estão em `shared/domain.ts` (`CRITERIOS`, `REGRAS_JORNADA`). No produto, são configuráveis por cliente.
- Os outros itens do menu lateral são apenas visuais.
