# Detalhes dos Testes de Carga

Este documento explica como os testes de carga foram implementados, como eles se relacionam com os casos CT-01 a CT-10 do PDF e quais casos são mais indicados para apresentar em sala.

## Visão geral

O sistema testado é o JSONPlaceholder, uma API REST pública usada para prototipagem. Para evitar instabilidade de rede, rate limit e variação por horário, o projeto também possui uma réplica local em `replica/`, executada via Docker.

Fluxo de execução:

1. O k6 lê um script em `tests/ctNN-*.js`.
2. O script cria usuários virtuais, chamados de VUs.
3. Cada VU executa requisições HTTP contra `BASE_URL`.
4. O k6 registra métricas como tempo de resposta, taxa de erro, quantidade de requisições por segundo e sucesso dos checks.
5. Os thresholds transformam o resultado esperado do caso de teste em aprovação/reprovação automática.
6. Quando executado com `--out influxdb`, as métricas também aparecem no Grafana.

Alvos possíveis:

| Alvo | Uso recomendado |
|---|---|
| `http://localhost:3000` | Execução principal e apresentação, pois é reprodutível. |
| `https://jsonplaceholder.typicode.com` | Demonstração de que os endpoints reais existem, mas não é ideal para carga alta. |

## Como os CTs foram implementados

| CT | Cenário | O que o script faz | Critério automatizado |
|---|---|---|---|
| CT-01 | Carga básica em posts | 100 VUs fazem `GET /posts` após ramp-up de 10s. | Status 200, média < 1000ms, erro 0%. |
| CT-02 | Payload grande | 50 VUs fazem `GET /photos`, endpoint com cerca de 5000 itens. | Status 200, média < 2000ms, erro 0%. |
| CT-03 | Spike repentino | 10 VUs base, pico instantâneo de 500 VUs por 20s e retorno a 10 VUs. | Erro < 5% no pico e recuperação sem erro. |
| CT-04 | Ramp-up misto | Sobe até 200 VUs; 70% das iterações fazem GET e 30% fazem POST. | GET 200, POST 201, média < 1500ms, erro < 2%. |
| CT-05 | Recurso aninhado | 150 VUs fazem `GET /posts/1/comments`. | Status 200, média < 1000ms, throughput > 100 req/s. |
| CT-06 | Publicações aleatórias | 200 VUs fazem `GET /posts/{id}` com IDs de 1 a 100. | Status 200, sem 404, média < 800ms, throughput > 150 req/s. |
| CT-07 | Burst de escrita | 300 VUs fazem `POST /posts` com payload dinâmico. | Status 201, média < 1200ms, erro < 1%. |
| CT-08 | Perfis de usuários | 250 VUs fazem `GET /users/{id}` com IDs de 1 a 10. | Status 200, média < 600ms, p95 < 1000ms, throughput > 200 req/s. |
| CT-09 | Edição concorrente | 100 VUs fazem `PUT /posts/{id}` com payload completo. | Status 200, média < 1000ms, erro 0%. |
| CT-10 | Exclusão concorrente | 80 VUs fazem `DELETE /posts/{id}` com IDs de 1 a 100. | Status 200, média < 800ms, erro 0%. |

## Casos recomendados para apresentação: CT-03 e CT-04

O CT-03 é o melhor caso para apresentar porque é o mais visual e o mais delicado tecnicamente. O CT-04 também é importante porque combina aumento gradual de carga com operações de leitura e escrita, aproximando melhor um uso real da API.

Motivos:

- Ele mostra claramente a ideia de teste de carga com variação brusca de usuários.
- Ele testa não só se a API responde, mas se continua estável quando a carga sobe de 10 para 500 VUs.
- Ele permite explicar degradação, taxa de erro, recuperação e uso do Grafana em poucos minutos.
- É mais interessante visualmente que um teste constante, pois o gráfico de VUs mostra o pico e o gráfico de latência mostra o impacto.
- O CT-04 complementa essa análise porque avalia um ramp-up até 200 VUs com 70% de requisições GET e 30% de requisições POST.
- Ele é importante para demonstrar comportamento sob carga mista, validando simultaneamente respostas 200 em leitura, 201 em escrita, média abaixo de 1500ms e erro abaixo de 2%.

## Como o CT-03 acontece

Script: `tests/ct03-spike-posts.js`

Endpoint testado:

```text
GET /posts
```

Fases:

| Fase | Tempo | Carga | Objetivo |
|---|---:|---:|---|
| Base | 0s a 10s | 10 VUs | Medir comportamento normal antes do pico. |
| Pico | 10s a 30s | 500 VUs | Simular aumento abrupto de acessos. |
| Recuperação | 30s a 45s | 10 VUs | Verificar se o sistema volta ao estado estável. |

O script usa `scenarios` do k6 para separar essas fases. Isso melhora a aderência ao PDF porque o pico deixa de ser um ramp-up gradual e passa a ser uma troca abrupta de 10 para 500 VUs.

Validações:

| Validação | Por quê |
|---|---|
| `GET /posts retorna 200` | Confirma que a API respondeu corretamente. |
| `lista de posts não está vazia` | Confirma que a resposta tem dados úteis, não só status HTTP. |
| `http_req_failed{fase:pico}: rate<0.05` | Critério principal do PDF: erro abaixo de 5% durante o pico. |
| `http_req_failed{fase:recuperacao}: rate==0` | Evidência de recuperação total após o pico. |
| `http_req_duration{fase:recuperacao}: avg<1000, p95<1500` | Evidência de ausência de degradação persistente. |

## Como executar o CT-03

Suba o ambiente local:

```powershell
cd k6
docker compose up -d --build
```

Execute o CT-03 enviando métricas para o Grafana:

```powershell
k6 run -e BASE_URL=http://localhost:3000 --out influxdb=http://localhost:8086/k6 --tag testid=ct03 tests/ct03-spike-posts.js
```

Abra o Grafana:

```text
http://localhost:3001
```

No dashboard, selecione `ct03` na variável de caso de teste.

## Como o CT-04 acontece

Script: `tests/ct04-rampup-misto.js`

Endpoints testados:

```text
GET /posts
POST /posts
```

Fases:

| Fase | Tempo | Carga | Objetivo |
|---|---:|---:|---|
| Ramp-up | 0s a 60s | 1 a 200 VUs | Aumentar a carga gradualmente para observar como a API se comporta enquanto o número de usuários cresce. |
| Sustentação | 60s a 90s | 200 VUs | Manter a carga máxima por 30s para verificar estabilidade com leitura e escrita concorrentes. |

O script usa `stages` do k6 para fazer um crescimento gradual até 200 VUs. Em cada iteração, ele decide aleatoriamente qual operação será executada: 70% das iterações fazem `GET /posts` e 30% fazem `POST /posts`.

Essa divisão deixa o CT-04 importante porque ele não mede apenas um endpoint isolado. Ele simula um cenário mais próximo de uso real, em que a maioria dos usuários consulta dados, enquanto uma parte menor cria novos registros.

Validações:

| Validação | Por quê |
|---|---|
| `GET /posts -> 200` | Confirma que as requisições de leitura continuam respondendo corretamente durante o aumento de carga. |
| `POST /posts -> 201` | Confirma que as requisições de escrita continuam sendo aceitas durante a carga mista. |
| `http_req_duration: avg<1500` | Garante que o tempo médio de resposta fique abaixo de 1500ms. |
| `http_req_failed: rate<0.02` | Critério principal de estabilidade: erro abaixo de 2%. |
| `checks: rate==1.00` | Exige que todos os checks de status HTTP sejam aprovados. |

## Como executar o CT-04

Suba o ambiente local:

```powershell
cd k6
docker compose up -d --build
```

Execute o CT-04 enviando métricas para o Grafana:

```powershell
k6 run -e BASE_URL=http://localhost:3000 --out influxdb=http://localhost:8086/k6 --tag testid=ct04 tests/ct04-rampup-misto.js
```

Abra o Grafana:

```text
http://localhost:3001
```

No dashboard, selecione `ct04` na variável de caso de teste.

## O que mostrar na apresentação

Sequência recomendada para apresentar o CT-03 como caso principal e o CT-04 como complemento:

1. Mostrar o objetivo: simular um pico abrupto de acessos em `GET /posts`.
2. Mostrar as três fases: base com 10 VUs, pico com 500 VUs e recuperação com 10 VUs.
3. Executar o comando do CT-03.
4. No Grafana, mostrar o gráfico de VUs para provar que o pico aconteceu.
5. Mostrar tempo de resposta médio/p95 durante o pico.
6. Mostrar taxa de erro.
7. Executar ou mostrar o CT-04 para comparar com um aumento gradual até 200 VUs.
8. Mostrar que o CT-04 mistura 70% de GET e 30% de POST.
9. Comparar os critérios: GET 200, POST 201, média abaixo de 1500ms e erro abaixo de 2%.
10. Concluir se os testes passaram com base nos thresholds.

Fala curta sugerida:

> Este caso testa se a API suporta um pico repentino de usuários. Primeiro medimos o comportamento normal com 10 usuários virtuais. Depois aplicamos um pico de 500 usuários por 20 segundos. Por fim, voltamos para 10 usuários para verificar se a API se recupera sem erro e sem degradação persistente. O teste passa se a taxa de erro durante o pico ficar abaixo de 5% e se a fase de recuperação voltar estável.

Fala curta sugerida para o CT-04:

> Este caso testa uma carga mais próxima do uso real. A carga sobe gradualmente até 200 usuários virtuais e, durante o teste, 70% das iterações fazem consulta em `/posts`, enquanto 30% fazem criação de posts. O objetivo é verificar se a API continua respondendo corretamente tanto leitura quanto escrita, mantendo tempo médio abaixo de 1500ms e taxa de erro abaixo de 2%.

## Observação sobre resultados exportados

Os arquivos em `results/ctNN.json` são úteis para recuperar métricas numéricas como `http_req_duration`, `http_reqs`, `http_req_failed` e `checks`.

Nesta instalação do k6, o campo `thresholds` dentro do JSON exportado pode aparecer como `false` mesmo quando o terminal mostra os thresholds aprovados. Por isso, para preencher “Resultado Obtido”, use:

- a saída do terminal do k6;
- os valores numéricos do JSON;
- os gráficos do Grafana;
- o exit code do comando.

## Cuidados importantes

- Para CT-03 e CT-07, prefira a réplica local. Rodar 500 VUs ou 300 VUs contra o serviço público pode gerar rate limit e afetar terceiros.
- O JSONPlaceholder não persiste POST, PUT e DELETE. A réplica local imita esse comportamento para manter os critérios dos CTs.
- A apresentação deve focar menos em “a API é rápida” e mais em “como o teste foi configurado, medido e avaliado”.
