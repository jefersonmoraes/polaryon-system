// Script para testar latência de uma VPS remota contra o Serpro
// Uso: node test-latency-remote.cjs <host> <port> <user> <password>
// Ex:  node test-latency-remote.cjs 203.0.113.10 22 root "senha123"

const { Client } = require('ssh2');

const host = process.argv[2];
const port = parseInt(process.argv[3] || '22');
const user = process.argv[4] || 'root';
const pass = process.argv[5];

if (!host) {
  console.log('Uso: node test-latency-remote.cjs <host> [port] [user] [password]');
  console.log('Ex:  node test-latency-remote.cjs 203.0.113.10 22 root minha_senha');
  process.exit(1);
}

const conn = new Client();

const script = `
echo "===== Teste de Latência VPS ====="
echo "Servidor: $(hostname)"
echo "IP Local: $(curl -s ifconfig.me 2>/dev/null || ip addr show | grep 'inet ' | head -1)"

echo ""
echo "--- Primeiro acesso (TLS handshake incluso) ---"
for url in \\
  "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4" \\
  "https://www.comprasnet.gov.br/main.asp" \\
  "https://sso.acesso.gov.br"; do
  nome=$(echo "$url" | sed 's|https://||' | sed 's|/.*||')
  result=$(curl -s -o /dev/null -w "%{http_code} | DNS: %{time_namelookup}s | TCP: %{time_connect}s | TLS: %{time_starttransfer}s | Total: %{time_total}s" --connect-timeout 10 "$url" 2>&1)
  echo "  $nome => $result"
done

echo ""
echo "--- 5 requisições consecutivas (keep-alive) ---"
for i in 1 2 3 4 5; do
  result=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 10 \\
    "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-disputa/v1/compras/participacoes?tamanhoPagina=1&pagina=0&filtro=4" 2>&1)
  echo "  Req $i: ${result}s"
done

echo ""
echo "--- Traceroute ---"
if command -v traceroute &>/dev/null; then
  traceroute -n -q 2 -w 2 cnetmobile.estaleiro.serpro.gov.br 2>&1 | tail -5
elif command -v tracepath &>/dev/null; then
  tracepath -n cnetmobile.estaleiro.serpro.gov.br 2>&1 | tail -5
else
  echo "  indisponivel"
fi
`;

console.log(`\n🔌 Conectando em ${host}:${port}...`);

conn.on('ready', () => {
  console.log('✅ Conectado! Executando testes...\n');
  conn.exec(script, (err, stream) => {
    if (err) { console.error('❌ Erro:', err.message); conn.end(); process.exit(1); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      console.log('\n✅ Teste concluído.');
      conn.end();
      process.exit(0);
    });
  });
}).on('error', err => {
  console.error('❌ Erro de conexão:', err.message);
  process.exit(1);
}).connect({ host, port, username: user, password: pass });
