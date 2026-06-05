// CT-05 — Carga em Endpoint de Recurso Aninhado
// Endpoint: GET /posts/1/comments
// Config: 150 usuários simultâneos | Ramp-up: 20s | Duração: 60s
// Esperado: 100% status 200, tempo médio < 1000ms, throughput > 100 req/s.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';

export const options = {
  stages: [
    { duration: '20s', target: 150 },
    { duration: '60s', target: 150 },
  ],
  thresholds: {
    http_req_duration: ['avg<1000'],
    http_req_failed: ['rate==0'],
    http_reqs: ['rate>100'], // throughput acima de 100 req/s
    checks: ['rate==1.00'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/posts/1/comments`);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'retornou comentários': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  sleep(0.5);
}
