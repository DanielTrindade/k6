// CT-07 — Publicação em Massa de Novos Posts (Burst de Escrita)
// Endpoint: POST /posts
// Config: 300 usuários simultâneos enviando POST | Ramp-up: 10s | Duração: 60s
// Esperado: 100% status 201, tempo médio < 1200ms, taxa de erro < 1%, sem falhas.
// OBS: rode preferencialmente contra a réplica local (-e BASE_URL=http://localhost:3000).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../lib/config.js';
import { randomInt, randomString } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '10s', target: 300 },
    { duration: '60s', target: 300 },
  ],
  thresholds: {
    http_req_duration: ['avg<1200'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  // Payload gerado dinamicamente para simular dados variados de cada usuário.
  const payload = JSON.stringify({
    title: randomString(15),
    body: randomString(40),
    userId: randomInt(1, 10),
  });
  const res = http.post(`${BASE_URL}/posts`, payload, JSON_HEADERS);
  check(res, {
    'status é 201': (r) => r.status === 201,
    'retornou id do novo post': (r) => r.json('id') !== undefined,
  });
  sleep(0.5);
}
