// CT-04 — Ramp-up Gradual com Requisições Mistas
// Endpoints: GET /posts e POST /posts alternados (70% GET / 30% POST)
// Config: ramp-up de 1 a 200 VUs em 60s | duração total: 90s
// Esperado: GET=200, POST=201, tempo médio < 1500ms, taxa de erro < 2%.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS } from '../lib/config.js';
import { randomInt } from '../lib/helpers.js';

export const options = {
  stages: [
    { duration: '60s', target: 200 }, // sobe de 1 a 200 VUs
    { duration: '30s', target: 200 }, // completa os 90s totais
  ],
  thresholds: {
    http_req_duration: ['avg<1500'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate==1.00'],
  },
};

export default function () {
  // 70% das iterações fazem GET, 30% fazem POST.
  if (Math.random() < 0.7) {
    const res = http.get(`${BASE_URL}/posts`, { tags: { op: 'GET' } });
    check(res, { 'GET /posts -> 200': (r) => r.status === 200 });
  } else {
    const payload = JSON.stringify({ title: 'teste', body: 'carga', userId: 1 });
    const res = http.post(`${BASE_URL}/posts`, payload, { ...JSON_HEADERS, tags: { op: 'POST' } });
    check(res, { 'POST /posts -> 201': (r) => r.status === 201 });
  }
  sleep(randomInt(1, 2));
}
