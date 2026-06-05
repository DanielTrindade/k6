// CT-02 — Carga Pesada em Endpoint de Alta Volumetria
// Endpoint: GET /photos  (~5000 itens, payload grande)
// Config: 50 usuários simultâneos | Ramp-up: 15s | Duração: 60s
// Esperado: 100% status 200, tempo médio < 2000ms, sem falhas de conexão.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../lib/config.js';

export const options = {
  stages: [
    { duration: '15s', target: 50 },
    { duration: '60s', target: 50 },
  ],
  thresholds: {
    http_req_duration: ['avg<2000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/photos`);
  check(res, {
    'status é 200': (r) => r.status === 200,
    'payload grande (>1000 itens)': (r) => Array.isArray(r.json()) && r.json().length > 1000,
  });
  sleep(1);
}
