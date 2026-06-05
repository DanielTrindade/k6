// CT-09 — Atualização de Publicações (Edição Concorrente)
// Endpoint: PUT /posts/{id} com IDs aleatórios (1–100)
// Config: 100 usuários simultâneos | Ramp-up: 15s | Duração: 60s | 100% PUT
// Esperado: 100% status 200, tempo médio < 1000ms, taxa de erro 0%, sem timeouts.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../lib/config.js';
import { randomInt, randomString } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '15s', target: 100 },
    { duration: '60s', target: 100 },
  ],
  thresholds: {
    http_req_duration: ['avg<1000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const id = randomInt(1, 100);
  const payload = JSON.stringify({
    id: id,
    title: randomString(15),
    body: randomString(40),
    userId: randomInt(1, 10),
  });
  const res = http.put(`${BASE_URL}/posts/${id}`, payload, JSON_HEADERS);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'retornou recurso atualizado': (r) => r.json('id') !== undefined,
  });
  sleep(0.5);
}
