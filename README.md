# Teste de Carga — JSONPlaceholder com k6 + Grafana

**TP2 – VV&T | Equipe 5 – Engenharia de Software – UFAM | Tema sorteado: Teste de Carga**

Implementação dos 10 casos de teste (CT-01 a CT-10) descritos em
`CT01 CT10 JSONPlaceholder Completo.pdf`, usando **[k6](https://k6.io)** como
ferramenta de teste de carga e **InfluxDB + Grafana** para visualização.

Documento detalhado dos testes e do caso recomendado para apresentação:
[`DETALHES-DOS-TESTES.md`](DETALHES-DOS-TESTES.md).

Documento de arquitetura da implementação:
[`ARQUITETURA-TESTE-DE-CARGA.md`](ARQUITETURA-TESTE-DE-CARGA.md).

---

## 1. Estudo de caso — é viável?

**Sistema sob teste:** [JSONPlaceholder](https://jsonplaceholder.typicode.com),
uma API REST pública e gratuita usada para prototipagem. Endpoints relevantes:
`/posts` (100), `/photos` (~5000), `/comments` (500), `/users` (10), além de
recursos aninhados como `/posts/1/comments`.

**Conclusão: é viável**, com duas observações que justificam as decisões de projeto:

| Aspecto | Análise |
|---|---|
| **Endpoints existem e respondem** | Todos os caminhos dos CTs são válidos (GET, POST, PUT, DELETE). ✅ |
| **Escrita "fake"** | No JSONPlaceholder, POST/PUT/DELETE **não persistem**, mas retornam os status corretos (201/200/200) — exatamente o que os CTs esperam. ✅ |
| **Alvo é serviço de terceiros** | Disparar 300 VUs (CT-07) ou spike de 500 (CT-03) contra o serviço público pode gerar **HTTP 429 (rate limit)** e os tempos medidos refletem a **CDN/rede**, não "o sistema". ⚠️ |
| **Reprodutibilidade** | Resultados contra o público variam com a internet e horário. ⚠️ |

**Decisões tomadas por causa disso:**

1. **Réplica local** (`replica/`, via Docker + `json-server`) que imita o
   JSONPlaceholder — inclusive **fakeando as escritas** (não persiste, devolve
   201/200). É o alvo recomendado para os CTs pesados: medição limpa, sem
   rate-limit e 100% reprodutível.
2. **`BASE_URL` configurável**: o mesmo script roda contra a réplica local
   **ou** contra o serviço público (para a demonstração "ao vivo").
3. **Thresholds do k6** traduzem cada "Resultado Esperado" em pass/fail
   automático (tempo médio, p95, taxa de erro, throughput).

> Por que a réplica fakea a escrita? Se ela persistisse de verdade, um
> `DELETE /posts/5` repetido (CT-10 usa IDs aleatórios) retornaria 404 na
> segunda vez, quebrando o critério "taxa de erro 0%". Fakeando, o
> comportamento fica idêntico ao serviço público.

---

## 2. Estrutura do projeto

```
k6/
├── docker-compose.yml          # replica + influxdb + grafana
├── run-all.ps1 / run-all.sh    # executa os 10 CTs em sequência
├── lib/
│   ├── config.js               # BASE_URL e headers
│   └── helpers.js              # randomInt / randomString
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
├── replica/                    # réplica local do JSONPlaceholder
│   ├── Dockerfile
│   ├── generate-db.js          # gera db.json (100 posts, 5000 photos...)
│   └── server.js               # json-server + escrita fakeada
└── grafana/                    # datasource + dashboard provisionados
```

---

## 3. Pré-requisitos

- **k6** — https://grafana.com/docs/k6/latest/set-up/install-k6/
  - Windows: `winget install k6 --source winget` (ou `choco install k6`)
- **Docker Desktop** (para a réplica local e o dashboard Grafana).

Verifique:
```powershell
k6 version
docker --version
```

---

## 4. Subir o ambiente (réplica + InfluxDB + Grafana)

```powershell
cd k6
docker compose up -d --build
```

Serviços disponíveis:

| Serviço  | URL                     | Observação                         |
|----------|-------------------------|------------------------------------|
| Réplica  | http://localhost:3000   | alvo limpo dos testes              |
| InfluxDB | http://localhost:8086   | banco `k6` (recebe as métricas)    |
| Grafana  | http://localhost:3001   | dashboard já provisionado          |

Teste a réplica: `curl http://localhost:3000/posts/1/comments`

---

## 5. Executar os testes

### Todos os CTs de uma vez

```powershell
# Contra a réplica local (recomendado), enviando métricas ao InfluxDB:
.\run-all.ps1

# Contra o serviço público (para a demo ao vivo):
.\run-all.ps1 -BaseUrl https://jsonplaceholder.typicode.com
```

No Linux/macOS/Git Bash: `./run-all.sh` (ou `BASE_URL=... ./run-all.sh`).

### Um CT específico

```powershell
# Réplica local + dashboard:
k6 run -e BASE_URL=http://localhost:3000 --out influxdb=http://localhost:8086/k6 --tag testid=ct01 tests/ct01-carga-basica-posts.js

# CT-03 recomendado: roda o k6 dentro da rede Docker e evita gargalo do localhost publicado:
docker compose --profile tools run --rm k6 run -e BASE_URL=http://replica:3000 --out influxdb=http://influxdb:8086/k6 --tag testid=ct03 tests/ct03-spike-posts.js

# Rápido, só no terminal (sem Docker), contra o público:
k6 run -e BASE_URL=https://jsonplaceholder.typicode.com tests/ct01-carga-basica-posts.js
```

A flag `--tag testid=ctNN` é o que permite **filtrar cada caso de teste** no
dashboard do Grafana (variável "Caso de Teste" no topo).

---

## 6. Ver o dashboard

1. Abra **http://localhost:3001**.
2. Dashboard **"k6 - Teste de Carga JSONPlaceholder (CT-01..CT-10)"**
   (pasta *k6 - Teste de Carga*).
3. No topo, selecione o **Caso de Teste** (ex.: `ct03`) e ajuste o intervalo
   de tempo (canto superior direito) para `Last 15 minutes`.

Painéis: VUs ao longo do tempo, throughput (req/s), tempo de resposta
(avg/p90/p95), taxa de erro e sucesso de checks, além dos cartões de resumo.

> **Dica para a apresentação:** apresente o **CT-03 (spike)**. Ele agora separa
> as fases `base`, `pico` e `recuperacao`, então fica fácil mostrar no Grafana
> o salto para 500 VUs, a taxa de erro durante o pico e a recuperação após o pico.

---

## 7. Mapeamento CT → script → thresholds

| CT | Cenário | Endpoint | Carga | Thresholds (k6) |
|----|---------|----------|-------|-----------------|
| 01 | Carga básica | `GET /posts` | 100 VUs, 10s ramp, 60s | avg<1000ms, erro=0 |
| 02 | Alta volumetria | `GET /photos` | 50 VUs, 15s ramp, 60s | avg<2000ms, erro=0 |
| 03 | Spike | `GET /posts` | 10→500→10, pico 20s | erro no pico<5%, recuperação sem erro, p95 recuperação<1500ms |
| 04 | Ramp-up misto | `GET`+`POST /posts` 70/30 | 1→200 em 60s, 90s total | avg<1500ms, erro<2% |
| 05 | Recurso aninhado | `GET /posts/1/comments` | 150 VUs, 20s ramp, 60s | avg<1000ms, **req/s>100** |
| 06 | Engajamento | `GET /posts/{1-100}` | 200 VUs, 30s ramp, 90s | avg<800ms, **req/s>150**, sem 404 |
| 07 | Burst de escrita | `POST /posts` | 300 VUs, 10s ramp, 60s | status 201, avg<1200ms, erro<1% |
| 08 | Perfis | `GET /users/{1-10}` | 250 VUs, 20s ramp, 120s | avg<600ms, **p95<1000ms**, req/s>200 |
| 09 | Edição | `PUT /posts/{1-100}` | 100 VUs, 15s ramp, 60s | status 200, avg<1000ms, erro=0 |
| 10 | Exclusão | `DELETE /posts/{1-100}` | 80 VUs, 10s ramp, 60s | status 200, avg<800ms, erro=0 |

Se um threshold falhar, o k6 marca o teste como reprovado (exit code ≠ 0) e
exibe a métrica em vermelho no resumo — é assim que se preenche a coluna
**"Resultado Obtido"** das tabelas do PDF.

---

## 8. Resultados / "Resultado Obtido"

- Resumo por teste: gerado em `results/ctNN.json` (`--summary-export`).
- O k6 também imprime no terminal: `http_req_duration` (avg/p95), `http_reqs`
  (throughput), `http_req_failed` (taxa de erro) e o status dos thresholds
  (✓ verde / ✗ vermelho).
- Capturas do Grafana servem como evidência visual nos slides.

> Observação: nesta versão do k6, o campo `thresholds` dentro do JSON exportado
> pode aparecer como `false` mesmo quando o terminal mostra o threshold aprovado.
> Para evidência, use a saída do terminal, os valores numéricos do JSON e o
> dashboard do Grafana. O documento `DETALHES-DOS-TESTES.md` explica isso.

---

## 9. Encerrar

```powershell
docker compose down          # para os serviços
docker compose down -v       # para e remove os volumes (zera métricas)
```
