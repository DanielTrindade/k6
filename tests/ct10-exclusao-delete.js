// CT-10 — Exclusão Sequencial sob Carga (Deleção Concorrente)
// Endpoint: DELETE /posts/{id} com IDs aleatórios (1–100)
// Config: 80 usuários simultâneos | Ramp-up: 10s | Duração: 60s | 100% DELETE
// Esperado: 100% status 200, tempo médio < 800ms, taxa de erro 0%, sem degradação.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';
import { randomInt } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '10s', target: 80 },
    { duration: '60s', target: 80 },
  ],
  thresholds: {
    http_req_duration: ['avg<800'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const id = randomInt(1, 100);
  const res = http.del(`${BASE_URL}/posts/${id}`);
  check(res, {
    'status é 200': (r) => r.status === 200,
  });
  sleep(0.5);
}
