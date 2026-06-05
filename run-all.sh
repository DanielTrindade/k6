#!/usr/bin/env bash
# Executa todos os casos de teste (CT-01..CT-10) em sequência.
#
# Uso:
#   ./run-all.sh                                         # alvo = réplica local
#   BASE_URL=https://jsonplaceholder.typicode.com ./run-all.sh   # alvo público
#   NO_INFLUX=1 ./run-all.sh                             # sem InfluxDB
#
# Pré-requisitos: k6 instalado e (para o dashboard) `docker compose up -d`.
set -u
cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:3000}"
INFLUX_URL="${INFLUX_URL:-http://localhost:8086/k6}"
mkdir -p results

for test in tests/ct*.js; do
  testid="$(basename "$test" | cut -c1-4)"   # ex.: "ct01"
  echo ""
  echo "=== Executando $(basename "$test")  (testid=$testid, alvo=$BASE_URL) ==="

  out_args=()
  [ -z "${NO_INFLUX:-}" ] && out_args+=(--out "influxdb=${INFLUX_URL}")

  k6 run \
    -e "BASE_URL=${BASE_URL}" \
    --tag "testid=${testid}" \
    --summary-export "results/${testid}.json" \
    "${out_args[@]}" \
    "$test" || echo "  -> ${testid} FALHOU em algum threshold"
done

echo ""
echo "Concluído. Resumos em ./results/  | Dashboard: http://localhost:3001"
