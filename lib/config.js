// Configuração compartilhada por todos os casos de teste (CT-01..CT-10).
//
// BASE_URL é configurável via variável de ambiente (-e BASE_URL=...):
//   - Demonstração contra o serviço público:
//       k6 run -e BASE_URL=https://jsonplaceholder.typicode.com tests/ct01-*.js
//   - Teste pesado/limpo contra a réplica local (docker-compose):
//       k6 run -e BASE_URL=http://localhost:3000 tests/ct07-*.js
//
// Default: serviço público, para que um `k6 run` simples funcione sem Docker.
// IMPORTANTE: para os CTs pesados (CT-03 spike 500, CT-07 300 VUs) prefira a
// réplica local — disparar esse volume no serviço público pode gerar 429
// (rate limit) e os tempos medidos passam a refletir a CDN, não o sistema.
export const BASE_URL = __ENV.BASE_URL || 'https://jsonplaceholder.typicode.com';

// Cabeçalhos padrão para operações de escrita (POST/PUT/PATCH).
export const JSON_HEADERS = {
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
};
