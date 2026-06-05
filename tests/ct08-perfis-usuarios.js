// CT-08 — Consulta Simultânea de Perfis de Usuários
// Endpoint: GET /users/{id} com IDs aleatórios (1–10)
// Config: 250 usuários simultâneos | Ramp-up: 20s | Duração: 120s
// Esperado: 100% status 200, tempo médio < 600ms, p95 < 1000ms, throughput > 200 req/s.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';
import { randomInt } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '20s', target: 250 },
    { duration: '120s', target: 250 },
  ],
  thresholds: {
    http_req_duration: ['avg<600', 'p(95)<1000'],
    http_req_failed: ['rate==0'],
    http_reqs: ['rate>200'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const id = randomInt(1, 10); // distribuição uniforme entre os 10 perfis
  const res = http.get(`${BASE_URL}/users/${id}`);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'retornou perfil válido': (r) => r.json('id') !== undefined,
  });
  sleep(0.5);
}
