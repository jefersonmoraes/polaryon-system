#!/bin/bash
# Teste de latência real para endpoints do Serpro (licitações)
# Uso: curl -s https://raw.githubusercontent.com/... | bash
# Ou: bash test-serpro-latency.sh

echo "==========================================="
echo "🏁 Teste de Latência - Serpro / ComprasNet"
echo "==========================================="
echo "Servidor: $(curl -s ifconfig.me 2>/dev/null || hostname)"
echo "Data:     $(date)"
echo ""

ENDPOINTS=(
  "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4"
  "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-fase-externa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4"
  "https://www.comprasnet.gov.br/main.asp"
  "https://sso.acesso.gov.br"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TESTE 1: Primeiro acesso (DNS + TLS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for url in "${ENDPOINTS[@]}"; do
  nome=$(echo "$url" | sed 's|https://||' | sed 's|/.*||')
  result=$(curl -s -o /dev/null -w "%{http_code} | DNS: %{time_namelookup}s | TCP: %{time_connect}s | TLS: %{time_starttransfer}s | Total: %{time_total}s" --connect-timeout 10 "$url" 2>&1)
  echo "  $nome → $result"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TESTE 2: Requisições consecutivas (keep-alive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SERPRO="cnetmobile.estaleiro.serpro.gov.br"
for i in 1 2 3 4 5; do
  result=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 10 \
    "https://${SERPRO}/comprasnet-disputa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4" 2>&1)
  echo "  Requisição $i: ${result}s"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " GEO: Rastreamento de rota via traceroute"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v traceroute &>/dev/null; then
  traceroute -n -q 2 -w 3 cnetmobile.estaleiro.serpro.gov.br 2>&1 | tail -5
elif command -v tracepath &>/dev/null; then
  tracepath -n cnetmobile.estaleiro.serpro.gov.br 2>&1 | tail -5
else
  echo "  traceroute não disponível"
fi

echo ""
echo "==========================================="
echo "✅ Resultado:"
echo "  Se TOTAL < 30ms  → 🏆 Excelente (São Paulo local)"
echo "  Se TOTAL < 100ms → 👍 Bom (Brasil)"
echo "  Se TOTAL > 200ms → ⚠️ Ruim (fora do Brasil)"
echo "==========================================="
