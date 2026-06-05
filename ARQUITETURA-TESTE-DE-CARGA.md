# Arquitetura da Implementação do Teste de Carga

Este documento explica a arquitetura usada para implementar os testes de carga com k6, incluindo os componentes do projeto, o fluxo de execução, a coleta de métricas e as decisões técnicas adotadas para tornar os testes reprodutíveis.

## Visão geral da arquitetura

A implementação foi organizada em quatro partes principais:

1. **Scripts de teste k6**: cada caso de teste CT-01 a CT-10 possui um script próprio em `tests/`.
2. **Biblioteca compartilhada**: configurações e funções auxiliares ficam em `lib/`.
3. **Ambiente local de execução**: o `docker-compose.yml` sobe uma réplica local do JSONPlaceholder, o InfluxDB e o Grafana.
4. **Observabilidade e resultados**: o k6 exporta métricas para o terminal, para arquivos JSON em `results/` e, opcionalmente, para o InfluxDB, onde o Grafana monta os dashboards.

Fluxo simplificado:

```text
scripts k6
   |
   | requisições HTTP
   v
JSONPlaceholder público ou réplica local
   |
   | métricas do k6
   v
terminal + results/*.json + InfluxDB
   |
   v
Grafana
```

Essa separação permite executar os mesmos testes contra dois alvos:

| Alvo | Finalidade |
|---|---|
| `http://localhost:3000` | Execução principal dos testes, com resultado mais controlado e reprodutível. |
| `https://jsonplaceholder.typicode.com` | Demonstração de que os endpoints reais existem, com cuidado para não aplicar cargas altas no serviço público. |

## Estrutura de diretórios

```text
k6/
├── docker-compose.yml
├── run-all.ps1
├── run-all.sh
├── lib/
│   ├── config.js
│   └── helpers.js
├── tests/
│   ├── ct01-carga-basica-posts.js
│   ├── ct02-carga-pesada-photos.js
│   ├── ct03-spike-posts.js
│   ├── ct04-rampup-misto.js
│   ├── ct05-recurso-aninhado.js
│   ├── ct06-curtidas-posts.js
│   ├── ct07-burst-escrita-posts.js
│   ├── ct08-perfis-usuarios.js
│   ├── ct09-atualizacao-put.js
│   └── ct10-exclusao-delete.js
├── replica/
│   ├── Dockerfile
│   ├── generate-db.js
│   ├── package.json
│   └── server.js
├── grafana/
│   ├── dashboards/
│   └── provisioning/
└── results/
```

## Camada de scripts k6

Cada arquivo em `tests/` representa um caso de teste do trabalho. A estrutura dos scripts segue o padrão do k6:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '60s', target: 100 },
  ],
  thresholds: {
    http_req_duration: ['avg<1000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/posts`);
  check(res, {
    'status 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

Os pontos mais importantes são:

| Elemento | Papel na arquitetura |
|---|---|
| `options` | Define o modelo de carga, duração, VUs e thresholds. |
| `stages` | Modela ramp-up, sustentação e redução gradual de carga. |
| `scenarios` | Usado quando é necessário controlar fases separadas, como no CT-03 de spike. |
| `default function` ou função `exec` | Representa o comportamento executado por cada usuário virtual. |
| `http.get`, `http.post`, `http.put`, `http.del` | Disparam as requisições HTTP contra o alvo configurado. |
| `check` | Valida a resposta funcionalmente, por exemplo status HTTP e presença de dados. |
| `thresholds` | Transformam o resultado esperado em critério automático de aprovação/reprovação. |
| `sleep` | Simula pausa entre ações de usuário e evita uma carga artificialmente contínua. |

## Configuração compartilhada

O arquivo `lib/config.js` concentra a configuração comum:

- `BASE_URL`: alvo dos testes, configurável via `-e BASE_URL=...`.
- `JSON_HEADERS`: cabeçalhos usados nas operações de escrita com JSON.

Com isso, os scripts não precisam saber se estão rodando contra a API pública ou contra a réplica local. A troca de alvo acontece no comando de execução:

```powershell
k6 run -e BASE_URL=http://localhost:3000 tests/ct01-carga-basica-posts.js
```

O arquivo `lib/helpers.js` concentra funções simples para gerar dados dinâmicos:

- `randomInt(min, max)`: escolhe IDs aleatórios válidos.
- `randomString(length)`: gera textos para payloads de POST e PUT.

Essa camada evita repetição nos scripts e mantém os testes mais consistentes.

## Modelagem dos casos de teste

Os CTs foram implementados com modelos de carga diferentes, de acordo com o objetivo de cada cenário:

| CT | Modelo usado | Endpoint principal | Objetivo arquitetural |
|---|---|---|---|
| CT-01 | `stages` com carga constante | `GET /posts` | Validar carga básica e estabilidade simples. |
| CT-02 | `stages` com payload grande | `GET /photos` | Medir resposta com alto volume de dados. |
| CT-03 | `scenarios` separados por fase | `GET /posts` | Simular pico abrupto e recuperação. |
| CT-04 | `stages` com operação mista | `GET /posts` e `POST /posts` | Misturar leitura e escrita sob crescimento gradual. |
| CT-05 | `stages` com recurso aninhado | `GET /posts/1/comments` | Testar rota com relacionamento entre recursos. |
| CT-06 | `stages` com IDs aleatórios | `GET /posts/{id}` | Distribuir acessos entre diferentes posts. |
| CT-07 | `stages` com burst de escrita | `POST /posts` | Avaliar criação concorrente. |
| CT-08 | `stages` com IDs aleatórios | `GET /users/{id}` | Avaliar consulta de perfis sob alta concorrência. |
| CT-09 | `stages` com atualização | `PUT /posts/{id}` | Avaliar atualização concorrente. |
| CT-10 | `stages` com exclusão | `DELETE /posts/{id}` | Avaliar exclusão concorrente. |

O CT-03 usa `scenarios` em vez de apenas `stages` porque precisava separar explicitamente as fases `base`, `pico` e `recuperacao`. Essas tags permitem aplicar thresholds específicos por fase:

```javascript
'http_req_failed{fase:pico}': ['rate<0.05'],
'http_req_failed{fase:recuperacao}': ['rate==0'],
'http_req_duration{fase:recuperacao}': ['avg<1000', 'p(95)<1500'],
```

O CT-04 usa tags de operação (`op: GET` e `op: POST`) para diferenciar as requisições de leitura e escrita no mesmo teste.

## Réplica local do JSONPlaceholder

A pasta `replica/` implementa uma versão local do JSONPlaceholder usando `json-server`. Ela existe porque o JSONPlaceholder público é um serviço de terceiros e não deve ser usado como alvo principal para cargas agressivas, como 500 VUs no CT-03 ou 300 VUs no CT-07.

Componentes da réplica:

| Arquivo | Responsabilidade |
|---|---|
| `generate-db.js` | Gera o `db.json` com volumes próximos ao JSONPlaceholder real: usuários, posts, comentários, fotos, álbuns e tarefas. |
| `server.js` | Sobe o `json-server` e intercepta POST, PUT, PATCH e DELETE para imitar o comportamento de escrita fake do JSONPlaceholder. |
| `Dockerfile` | Empacota a réplica para execução via Docker. |

A réplica local mantém o comportamento esperado dos CTs:

- `GET` retorna dados persistidos no `db.json`.
- `POST /posts` retorna `201` e um `id`, mas não persiste.
- `PUT /posts/{id}` retorna `200`, mas não altera permanentemente o banco.
- `DELETE /posts/{id}` retorna `200`, mas não remove de fato o registro.

Essa decisão é importante porque o JSONPlaceholder real também não persiste escritas. Se a réplica persistisse exclusões, o CT-10 poderia retornar `404` ao deletar novamente o mesmo ID, criando falhas que não fazem parte do objetivo do teste.

## Stack Docker

O `docker-compose.yml` sobe três serviços:

| Serviço | Porta | Função |
|---|---:|---|
| `replica` | `3000` | API local usada como sistema sob teste. |
| `influxdb` | `8086` | Banco de séries temporais que recebe métricas do k6. |
| `grafana` | `3001` | Visualização das métricas em dashboards. |

O Grafana já é provisionado com:

- datasource apontando para o InfluxDB;
- dashboard em `grafana/dashboards/k6-load-testing.json`;
- variável de filtro por caso de teste usando a tag `testid`.

## Coleta de métricas e evidências

Durante a execução, o k6 coleta automaticamente métricas como:

| Métrica | Significado |
|---|---|
| `http_req_duration` | Tempo total da requisição HTTP. |
| `http_req_failed` | Taxa de requisições com falha. |
| `http_reqs` | Quantidade total e taxa de requisições. |
| `vus` | Número de usuários virtuais ativos. |
| `checks` | Percentual de validações funcionais aprovadas. |

Essas métricas são usadas de três formas:

1. **Terminal**: mostra o resumo imediato da execução.
2. **`results/ctNN.json`**: arquivo gerado por `--summary-export`, útil para consultar os valores numéricos depois.
3. **InfluxDB + Grafana**: permite visualizar a evolução temporal das métricas, principalmente VUs, latência, throughput e taxa de erro.

O comando de execução com observabilidade completa segue este formato:

```powershell
k6 run `
  -e BASE_URL=http://localhost:3000 `
  --out influxdb=http://localhost:8086/k6 `
  --tag testid=ct03 `
  --summary-export results/ct03.json `
  tests/ct03-spike-posts.js
```

A tag `testid=ct03` é essencial para separar os resultados por caso de teste no Grafana.

## Execução em lote

Os scripts `run-all.ps1` e `run-all.sh` automatizam a execução dos dez CTs. A lógica é:

1. listar todos os arquivos `ct*.js` em `tests/`;
2. ordenar os arquivos pelo nome;
3. extrair o identificador do caso, como `ct01`, `ct02`, `ct03`;
4. executar `k6 run` com `BASE_URL`, `testid`, `--summary-export` e, se habilitado, `--out influxdb`;
5. salvar o resumo de cada caso em `results/ctNN.json`.

No Windows, a execução padrão usa a réplica local:

```powershell
.\run-all.ps1
```

Para rodar contra o serviço público:

```powershell
.\run-all.ps1 -BaseUrl https://jsonplaceholder.typicode.com
```

## Critérios de aprovação

Os critérios esperados de cada CT foram codificados como `thresholds`. Isso faz com que o teste não dependa apenas de inspeção manual.

Exemplos:

```javascript
thresholds: {
  http_req_duration: ['avg<1200'],
  http_req_failed: ['rate<0.01'],
  checks: ['rate==1.00'],
}
```

Na prática:

- se o tempo médio passar do limite, o teste falha;
- se a taxa de erro ultrapassar o limite, o teste falha;
- se algum status HTTP esperado não for atendido, o `check` falha;
- se um threshold falhar, o k6 retorna exit code diferente de zero.

## Decisões de projeto

As principais decisões arquiteturais foram:

| Decisão | Justificativa |
|---|---|
| Separar um script por CT | Facilita rastrear cada caso do PDF e apresentar resultados individualmente. |
| Centralizar `BASE_URL` | Permite alternar entre réplica local e API pública sem alterar os scripts. |
| Usar réplica local | Evita rate limit, instabilidade de rede e impacto em serviço de terceiros. |
| Imitar escritas fake | Mantém compatibilidade com o comportamento real do JSONPlaceholder. |
| Exportar para InfluxDB | Permite análise temporal no Grafana, não apenas resumo final. |
| Usar `testid` | Permite filtrar cada caso de teste no dashboard. |
| Usar thresholds | Transforma o resultado esperado em aprovação/reprovação objetiva. |
| Gerar payloads dinâmicos | Evita que todos os VUs enviem exatamente os mesmos dados nos testes de escrita. |

## Limitações conhecidas

Mesmo com a réplica local, os testes têm algumas limitações:

- a réplica simula a API, mas não representa uma aplicação real com banco transacional, autenticação ou regras de negócio complexas;
- os testes medem comportamento HTTP e estabilidade básica, não validam desempenho de camadas internas;
- a API pública pode apresentar variação por CDN, internet, horário e rate limit;
- os resultados da réplica local também dependem da máquina e do Docker usados na execução.

Por isso, a interpretação correta dos resultados deve focar em como a carga foi modelada, medida e avaliada, não em concluir que o JSONPlaceholder real possui uma capacidade fixa de usuários simultâneos.

## Como adicionar um novo teste

Para incluir um novo caso de teste na mesma arquitetura:

1. criar um arquivo em `tests/` seguindo o padrão `ctNN-nome-do-cenario.js`;
2. importar `BASE_URL` de `../lib/config.js`;
3. definir `options` com `stages` ou `scenarios`;
4. implementar as requisições HTTP no `default function` ou em uma função usada por `exec`;
5. adicionar `check` para validar status e conteúdo esperado;
6. adicionar `thresholds` para automatizar os critérios de aprovação;
7. executar com `--tag testid=ctNN` para aparecer corretamente no Grafana;
8. verificar o resumo no terminal, em `results/ctNN.json` e no dashboard.

Essa estrutura mantém o projeto extensível sem mudar a arquitetura principal.
