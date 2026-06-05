// CT-01 — Carga Básica em Listagem de Posts
// Endpoint: GET /posts
// Config: 100 usuários simultâneos | Ramp-up: 10s | Duração: 60s
// Esperado: 100% status 200, tempo médio < 1000ms, sem timeouts.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // ramp-up até 100 VUs
    { duration: '60s', target: 100 }, // sustentação da carga
  ],
  thresholds: {
    http_req_duration: ['avg<1000'], // tempo médio abaixo de 1000ms
    http_req_failed: ['rate==0'],     // nenhum erro/timeout
    checks: ['rate==1.00'],           // 100% das validações ok
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/posts`);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'retornou lista de posts': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  sleep(1);
}
