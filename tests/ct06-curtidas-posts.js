// CT-06 — Curtidas em Publicações (Simulação de Engajamento)
// Endpoint: GET /posts/{id} com IDs aleatórios (1–100)
// Config: 200 usuários simultâneos | Ramp-up: 30s | Duração: 90s
// Esperado: 100% status 200, tempo médio < 800ms, sem 404, throughput > 150 req/s.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';
import { randomInt } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '90s', target: 200 },
  ],
  thresholds: {
    http_req_duration: ['avg<800'],
    http_req_failed: ['rate==0'],
    http_reqs: ['rate>150'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const id = randomInt(1, 100);
  const res = http.get(`${BASE_URL}/posts/${id}`);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'não retornou 404': (r) => r.status !== 404,
  });
  sleep(0.5);
}
