// CT-03 — Teste de Spike (Pico Repentino)
// Endpoint: GET /posts
// Config: 10 VUs base -> pico instantâneo de 500 VUs -> retorno a 10 | pico: 20s
// Esperado: taxa de erro < 5% durante o pico, recuperação total, sem degradação persistente.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../lib/config.js';

export const options = {
  scenarios: {
    base: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10s',
      gracefulStop: '0s',
      tags: { fase: 'base' },
      exec: 'listarPosts',
    },
    spike: {
      executor: 'constant-vus',
      vus: 500,
      duration: '20s',
      startTime: '10s',
      gracefulStop: '0s',
      tags: { fase: 'pico' },
      exec: 'listarPosts',
    },
    recovery: {
      executor: 'constant-vus',
      vus: 10,
      duration: '15s',
      startTime: '30s',
      gracefulStop: '0s',
      tags: { fase: 'recuperacao' },
      exec: 'listarPosts',
    },
  },
  thresholds: {
    // Critério principal do PDF: erro abaixo de 5% durante o pico.
    'http_req_failed{fase:pico}': ['rate<0.05'],

    // Evidência extra para a apresentação: a API deve voltar estável após o pico.
    'http_req_failed{fase:recuperacao}': ['rate==0'],
    'http_req_duration{fase:recuperacao}': ['avg<1000', 'p(95)<1500'],
    // O PDF permite até 5% de erro durante o pico; os checks seguem o mesmo critério.
    checks: ['rate>=0.95'],
  },
};

export function listarPosts() {
  const res = http.get(`${BASE_URL}/posts`);
  check(res, {
    'GET /posts retorna 200': (r) => r.status === 200,
    'lista de posts não está vazia': (r) => {
      if (r.status !== 200 || !r.body) {
        return false;
      }
      return Array.isArray(r.json()) && r.json().length > 0;
    },
  }, { endpoint: 'posts' });
}
