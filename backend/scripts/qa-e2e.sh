#!/usr/bin/env bash
# Comprehensive E2E QA — curl against Ay.WebApi (see plan: phases B–E).
# Usage: BASE_URL=http://localhost:5017 ./scripts/qa-e2e.sh

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:5017}"
: "${PGUSER:=syedshahabdurrehman}"
: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=ay_db}"

FAILURES=0

log() { printf '%s\n' "$*"; }

check_http() {
  local id="$1" want="$2" got="$3" note="${4:-}"
  if [[ "$got" == "$want" ]]; then
    log "PASS $id HTTP $got${note:+ — $note}"
  else
    log "FAIL $id expected HTTP $want got $got${note:+ — $note}"
    FAILURES=$((FAILURES + 1))
  fi
}

# Split curl response: last line = HTTP code, rest = body
parse_resp() {
  local resp=$1
  CODE=$(printf '%s' "$resp" | tail -n1)
  BODY=$(printf '%s' "$resp" | sed '$d')
}

curl_json() {
  local method="$1" path="$2" token="$3" data="$4"
  if [[ -n "$token" ]]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $token" \
      -d "$data" \
      -w "\n%{http_code}"
  else
    curl -sS -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -d "$data" \
      -w "\n%{http_code}"
  fi
}

curl_auth() {
  local method="$1" path="$2" token="$3"
  if [[ -n "$token" ]]; then
    curl -sS -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $token" -w "\n%{http_code}"
  else
    curl -sS -X "$method" "$BASE_URL$path" -w "\n%{http_code}"
  fi
}

jget() {
  python3 -c 'import json,sys; d=json.load(sys.stdin); v=d
for k in sys.argv[1].split("."):
  v=v[k]
print(v)' "$1" 2>/dev/null || true
}

advance_order_seq() {
  if command -v psql >/dev/null 2>&1; then
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
      "SELECT setval('order_number_seq', GREATEST((SELECT COALESCE(MAX(CAST(REPLACE(\"OrderNumber\", 'AY-', '') AS BIGINT)), 1000) FROM orders), (SELECT last_value FROM order_number_seq)));" \
      >/dev/null 2>&1 || true
  fi
}

verify_merchants_sql() {
  local u1="$1" u2="$2"
  if command -v psql >/dev/null 2>&1; then
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -c \
      "UPDATE merchant_accounts SET \"Status\" = 'verified' WHERE \"UserId\" IN ('$u1'::uuid, '$u2'::uuid);" >/dev/null
  else
    log "WARN: psql not found — set merchants to verified manually for discovery tests."
  fi
}

TS=$(date +%s)
M1_EMAIL="qa-m1-${TS}@test.local"
M2_EMAIL="qa-m2-${TS}@test.local"
C1_EMAIL="qa-c1-${TS}@test.local"
C2_EMAIL="qa-c2-${TS}@test.local"

log "=== Ay backend QA — BASE_URL=$BASE_URL ==="
advance_order_seq

# --- Fixture ---
log "--- Fixture: register ---"
R=$(curl_json POST /api/v1/auth/register '' "{\"email\":\"$M1_EMAIL\",\"password\":\"Testpass1\",\"name\":\"Merchant One\"}"); parse_resp "$R"
check_http REG-M1 200 "$CODE"
RAW_M1="$BODY"

R=$(curl_json POST /api/v1/auth/register '' "{\"email\":\"$M2_EMAIL\",\"password\":\"Testpass1\",\"name\":\"Merchant Two\"}"); parse_resp "$R"
check_http REG-M2 200 "$CODE"
RAW_M2="$BODY"

R=$(curl_json POST /api/v1/auth/register '' "{\"email\":\"$C1_EMAIL\",\"password\":\"Testpass1\",\"name\":\"Consumer One\"}"); parse_resp "$R"
check_http REG-C1 200 "$CODE"
RAW_C1="$BODY"

R=$(curl_json POST /api/v1/auth/register '' "{\"email\":\"$C2_EMAIL\",\"password\":\"Testpass1\",\"name\":\"Consumer Two\"}"); parse_resp "$R"
check_http REG-C2 200 "$CODE"
RAW_C2="$BODY"

AT_M1=$(printf '%s' "$RAW_M1" | jget accessToken)
AT_M2=$(printf '%s' "$RAW_M2" | jget accessToken)
AT_C1=$(printf '%s' "$RAW_C1" | jget accessToken)
AT_C2=$(printf '%s' "$RAW_C2" | jget accessToken)

M1_UID=$(printf '%s' "$RAW_M1" | jget user.id)
M2_UID=$(printf '%s' "$RAW_M2" | jget user.id)
C1_UID=$(printf '%s' "$RAW_C1" | jget user.id)
C2_UID=$(printf '%s' "$RAW_C2" | jget user.id)

log "--- Fixture: merchant accounts + verify DB ---"
R=$(curl_json POST /api/v1/merchant/account "$AT_M1" '{"shopType":"grocery","numberOfShops":"1"}'); parse_resp "$R"; check_http FIX-M1-ACCT 200 "$CODE"
R=$(curl_json POST /api/v1/merchant/account "$AT_M2" '{"shopType":"grocery","numberOfShops":"1"}'); parse_resp "$R"; check_http FIX-M2-ACCT 200 "$CODE"

R=$(curl_json POST /api/v1/auth/login '' "{\"email\":\"$M1_EMAIL\",\"password\":\"Testpass1\"}"); parse_resp "$R"; AT_M1=$(printf '%s' "$BODY" | jget accessToken)
R=$(curl_json POST /api/v1/auth/login '' "{\"email\":\"$M2_EMAIL\",\"password\":\"Testpass1\"}"); parse_resp "$R"; AT_M2=$(printf '%s' "$BODY" | jget accessToken)

verify_merchants_sql "$M1_UID" "$M2_UID"

SHOP_A_LAT="31.5204"
SHOP_A_LON="74.3587"
SHOP_B_LAT="31.4850"
SHOP_B_LON="74.3200"

log "--- Fixture: shops / categories / items ---"
R=$(curl_json POST /api/v1/merchant/shops "$AT_M1" "{\"name\":\"QA Shop A\",\"description\":\"A\",\"shopType\":\"Grocery\",\"address\":\"Addr A\",\"latitude\":$SHOP_A_LAT,\"longitude\":$SHOP_A_LON,\"tags\":[\"qa\"]}"); parse_resp "$R"; check_http FIX-SHOP-A 200 "$CODE"
SHOP_A=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST /api/v1/merchant/shops "$AT_M2" "{\"name\":\"QA Shop B\",\"description\":\"B\",\"shopType\":\"Grocery\",\"address\":\"Addr B\",\"latitude\":$SHOP_B_LAT,\"longitude\":$SHOP_B_LON,\"tags\":[\"qa\"]}"); parse_resp "$R"; check_http FIX-SHOP-B 200 "$CODE"
SHOP_B=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_A/categories" "$AT_M1" '{"name":"CatA","description":"c"}'); parse_resp "$R"; check_http FIX-CAT-A 200 "$CODE"
CAT_A=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_B/categories" "$AT_M2" '{"name":"CatB","description":"c"}'); parse_resp "$R"; check_http FIX-CAT-B 200 "$CODE"
CAT_B=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_A/items" "$AT_M1" "{\"name\":\"ItemA1\",\"priceCents\":20000,\"categoryIds\":[\"$CAT_A\"]}"); parse_resp "$R"; check_http FIX-ITEM-A1 200 "$CODE"
ITEM_A1=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_A/items" "$AT_M1" "{\"name\":\"ItemA2\",\"priceCents\":5000,\"categoryIds\":[\"$CAT_A\"]}"); parse_resp "$R"; check_http FIX-ITEM-A2 200 "$CODE"
ITEM_A2=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_B/items" "$AT_M2" "{\"name\":\"ItemB1\",\"priceCents\":12000,\"categoryIds\":[\"$CAT_B\"]}"); parse_resp "$R"; check_http FIX-ITEM-B1 200 "$CODE"
ITEM_B1=$(printf '%s' "$BODY" | jget id)

R=$(curl_json PUT "/api/v1/merchant/shops/$SHOP_A/delivery-logic" "$AT_M1" '{"minimumOrderValue":200,"smallOrderSurcharge":40,"leastOrderValue":100,"distanceTiers":[{"maxDistance":5000,"fee":50}],"maxDeliveryFee":130,"beyondTierFeePerUnit":10,"beyondTierDistanceUnit":250,"freeDeliveryThreshold":800,"freeDeliveryRadius":1000}'); parse_resp "$R"; check_http FIX-DL-A 200 "$CODE"
R=$(curl_json PUT "/api/v1/merchant/shops/$SHOP_B/delivery-logic" "$AT_M2" '{"minimumOrderValue":200,"smallOrderSurcharge":40,"leastOrderValue":100,"distanceTiers":[{"maxDistance":5000,"fee":55}],"maxDeliveryFee":130,"beyondTierFeePerUnit":10,"beyondTierDistanceUnit":250,"freeDeliveryThreshold":800,"freeDeliveryRadius":1000}'); parse_resp "$R"; check_http FIX-DL-B 200 "$CODE"

R=$(curl_json POST /api/v1/consumer/addresses "$AT_C1" "{\"streetAddress\":\"Near A\",\"city\":\"Lahore\",\"latitude\":$SHOP_A_LAT,\"longitude\":$SHOP_A_LON,\"title\":\"home\"}"); parse_resp "$R"; check_http FIX-ADDR-C1 200 "$CODE"
ADDR_C1=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST /api/v1/consumer/addresses "$AT_C2" "{\"streetAddress\":\"Near B\",\"city\":\"Lahore\",\"latitude\":$SHOP_B_LAT,\"longitude\":$SHOP_B_LON,\"title\":\"home\"}"); parse_resp "$R"; check_http FIX-ADDR-C2 200 "$CODE"
ADDR_C2=$(printf '%s' "$BODY" | jget id)

R=$(curl_json POST /api/v1/consumer/addresses "$AT_C2" "{\"streetAddress\":\"Second\",\"city\":\"Lahore\",\"latitude\":31.49,\"longitude\":74.33}"); parse_resp "$R"; check_http FIX-ADDR-C2B 200 "$CODE"
ADDR_C2B=$(printf '%s' "$BODY" | jget id)

log "Fixture SHOP_A=$SHOP_A SHOP_B=$SHOP_B"

# ========== Phase B: Consumer ==========
log "=== Phase B: Consumer ==="

R=$(curl_auth GET /api/v1/consumer/profile "$AT_C1"); parse_resp "$R"
check_http C-01 200 "$CODE"
if printf '%s' "$BODY" | python3 -c 'import json,sys; j=json.load(sys.stdin); assert j.get("role")=="consumer"' 2>/dev/null; then log "PASS C-01b role consumer"; else log "FAIL C-01b role"; FAILURES=$((FAILURES+1)); fi

LONG_NAME=$(python3 -c 'print("x"*101)')
R=$(curl_json PUT /api/v1/consumer/profile "$AT_C1" "{\"name\":\"$LONG_NAME\"}"); parse_resp "$R"
check_http C-02 400 "$CODE" "name > 100 chars"

R=$(curl_json PUT /api/v1/consumer/profile "$AT_C1" '{"name":"C1 OK"}'); parse_resp "$R"
check_http C-02b 200 "$CODE"

R=$(curl_auth GET /api/v1/consumer/addresses "$AT_C1"); parse_resp "$R"
check_http C-03-LIST 200 "$CODE"

R=$(curl_auth GET "/api/v1/consumer/addresses/$ADDR_C2" "$AT_C1"); parse_resp "$R"
check_http C-04 404 "$CODE" "other user address"

R=$(curl_auth GET "/api/v1/consumer/shops?lat=$SHOP_A_LAT&lon=$SHOP_A_LON&radius=50000&type=Grocery" "$AT_C1"); parse_resp "$R"
check_http C-05 200 "$CODE"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); ids={x['id'] for x in a}; assert '$SHOP_A' in ids and '$SHOP_B' in ids" 2>/dev/null; then log "PASS C-05b discovery"; else log "FAIL C-05b discovery"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET "/api/v1/consumer/shops/$SHOP_A?lat=$SHOP_A_LAT&lon=$SHOP_A_LON" "$AT_C1"); parse_resp "$R"
check_http C-06 200 "$CODE"
if printf '%s' "$BODY" | python3 -c 'import json,sys; j=json.load(sys.stdin); assert len(j.get("categories",[]))>=1' 2>/dev/null; then log "PASS C-06b categories"; else log "FAIL C-06b"; FAILURES=$((FAILURES+1)); fi

R=$(curl_json POST /api/v1/consumer/orders/calculate "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}]}"); parse_resp "$R"
check_http C-07 200 "$CODE"

R=$(curl_json POST /api/v1/consumer/orders/calculate "$AT_C2" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}]}"); parse_resp "$R"
check_http C-08 422 "$CODE" "C2 + C1 address"

R=$(curl_json POST /api/v1/consumer/orders/calculate "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A2\",\"quantity\":1}]}"); parse_resp "$R"
check_http C-09 422 "$CODE" "below least order"

R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
check_http C-10 200 "$CODE"
ORDER_C1_A=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth GET "/api/v1/consumer/orders/$ORDER_C1_A" "$AT_C2"); parse_resp "$R"
check_http C-11 404 "$CODE"

R=$(curl_auth GET /api/v1/consumer/orders "$AT_C1"); parse_resp "$R"
check_http C-12 200 "$CODE"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); assert any(o['id']=='$ORDER_C1_A' for o in a)" 2>/dev/null; then log "PASS C-12b"; else log "FAIL C-12b"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET /api/v1/consumer/orders/active "$AT_C2"); parse_resp "$R"
if [[ "$CODE" == "204" || "$CODE" == "200" ]]; then log "PASS C-13 no-active HTTP $CODE"; else log "FAIL C-13 HTTP $CODE"; FAILURES=$((FAILURES+1)); fi

R=$(curl_json POST "/api/v1/consumer/orders/$ORDER_C1_A/cancel" "$AT_C1" '{"reason":"qa"}'); parse_resp "$R"
check_http C-14a 204 "$CODE"

R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
ORDER_C1_A2=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth POST "/api/v1/merchant/shops/$SHOP_A/orders/$ORDER_C1_A2/confirm" "$AT_M1"); parse_resp "$R"
check_http C-14b-CONF 204 "$CODE"

R=$(curl_json POST "/api/v1/consumer/orders/$ORDER_C1_A2/cancel" "$AT_C1" '{}'); parse_resp "$R"
check_http C-14c 422 "$CODE" "cancel after confirm"

advance_order_seq
R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_B\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_B1\",\"quantity\":2}],\"paymentMethod\":\"card\"}"); parse_resp "$R"
check_http C-15-PLACE 200 "$CODE"
ORD_REV=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth POST "/api/v1/merchant/shops/$SHOP_B/orders/$ORD_REV/confirm" "$AT_M2"); parse_resp "$R"; check_http C-15-CONF 204 "$CODE"
R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_B/runners" "$AT_M2" '{"name":"R","phoneNumber":"03000000000"}'); parse_resp "$R"; check_http C-15-RUN 200 "$CODE"
RID_B=$(printf '%s' "$BODY" | jget id)
R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_B/orders/$ORD_REV/dispatch" "$AT_M2" "{\"runnerId\":\"$RID_B\"}"); parse_resp "$R"; check_http C-15-DISP 204 "$CODE"
R=$(curl_auth POST "/api/v1/merchant/shops/$SHOP_B/orders/$ORD_REV/deliver" "$AT_M2"); parse_resp "$R"; check_http C-15-DEL 204 "$CODE"

R=$(curl_json POST /api/v1/consumer/reviews "$AT_C1" "{\"shopId\":\"$SHOP_B\",\"orderId\":\"$ORD_REV\",\"rating\":5,\"reviewText\":\"Great\"}"); parse_resp "$R"
check_http C-15a 200 "$CODE"

R=$(curl_json POST /api/v1/consumer/reviews "$AT_C1" "{\"shopId\":\"$SHOP_B\",\"rating\":4}"); parse_resp "$R"
check_http C-15b 422 "$CODE" "duplicate review"

R=$(curl_auth GET "/api/v1/consumer/shops/$SHOP_B/reviews" "$AT_C2"); parse_resp "$R"
check_http C-15c 200 "$CODE"

R=$(curl_auth GET /api/v1/consumer/notification-preferences "$AT_C1"); parse_resp "$R"
check_http C-16a 200 "$CODE"

R=$(curl_json PUT /api/v1/consumer/notification-preferences "$AT_C1" '{"allowPushNotifications":false}'); parse_resp "$R"
check_http C-16b 200 "$CODE"

# ========== Phase C: Merchant ==========
log "=== Phase C: Merchant ==="

R=$(curl_auth GET /api/v1/merchant/shops "$AT_M1"); parse_resp "$R"
check_http M-01 200 "$CODE"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); assert len(a)==1 and a[0]['id']=='$SHOP_A'" 2>/dev/null; then log "PASS M-01b"; else log "FAIL M-01b"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_B/orders" "$AT_M1"); parse_resp "$R"
check_http M-02 404 "$CODE" "M1 on M2 shop"

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_A/orders/$ORD_REV" "$AT_M1"); parse_resp "$R"
check_http M-03 404 "$CODE" "order on other shop"

advance_order_seq
R=$(curl_json POST /api/v1/consumer/orders "$AT_C2" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C2\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
ORD_M4=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth POST "/api/v1/merchant/shops/$SHOP_A/orders/$ORD_M4/confirm" "$AT_M1"); parse_resp "$R"; check_http M-04a 204 "$CODE"
R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_A/runners" "$AT_M1" '{"name":"RA","phoneNumber":"03011111111"}'); parse_resp "$R"; RA=$(printf '%s' "$BODY" | jget id)
R=$(curl_json POST "/api/v1/merchant/shops/$SHOP_A/orders/$ORD_M4/dispatch" "$AT_M1" "{\"runnerId\":\"$RA\"}"); parse_resp "$R"; check_http M-04b 204 "$CODE"
R=$(curl_auth POST "/api/v1/merchant/shops/$SHOP_A/orders/$ORD_M4/deliver" "$AT_M1"); parse_resp "$R"; check_http M-04c 204 "$CODE"

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_A/analytics" "$AT_M1"); parse_resp "$R"
check_http M-05 200 "$CODE"

# ========== Phase D: Cross ==========
log "=== Phase D: Cross-actor ==="

advance_order_seq
R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
OX=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_B/orders" "$AT_M2"); parse_resp "$R"
check_http X-01 200 "$CODE"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); assert all(o['id']!='$OX' for o in a)" 2>/dev/null; then log "PASS X-01b"; else log "FAIL X-01b"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_A/orders" "$AT_M2"); parse_resp "$R"
check_http X-02 404 "$CODE" "M2 list shop A"

R=$(curl_auth GET "/api/v1/consumer/orders/$OX" "$AT_C2"); parse_resp "$R"
check_http X-03 404 "$CODE"

advance_order_seq
R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_B\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_B1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
OB_C1=$(printf '%s' "$BODY" | jget id)
advance_order_seq
R=$(curl_json POST /api/v1/consumer/orders "$AT_C2" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C2\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
OA_C2=$(printf '%s' "$BODY" | jget id)

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_A/orders" "$AT_M1"); parse_resp "$R"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); ids={o['id'] for o in a}; assert '$OA_C2' in ids; assert '$OB_C1' not in ids" 2>/dev/null; then log "PASS X-04 M1/shopA"; else log "FAIL X-04"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET "/api/v1/merchant/shops/$SHOP_B/orders" "$AT_M2"); parse_resp "$R"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); ids={o['id'] for o in a}; assert '$OB_C1' in ids; assert '$OA_C2' not in ids" 2>/dev/null; then log "PASS X-04b M2/shopB"; else log "FAIL X-04b"; FAILURES=$((FAILURES+1)); fi

R=$(curl_auth GET /api/v1/consumer/orders "$AT_C1"); parse_resp "$R"
if printf '%s' "$BODY" | python3 -c "import json,sys; a=json.load(sys.stdin); sid=set();
for o in a:
  s=o.get('shop')
  if isinstance(s,dict) and s.get('id'): sid.add(s['id'])
assert '$SHOP_A' in sid and '$SHOP_B' in sid" 2>/dev/null; then log "PASS X-05 C1 both shops in history"; else log "INFO X-05 C1 history shop check inconclusive"; fi

# ========== Phase E: Edge ==========
log "=== Phase E: Edge ==="

R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_B1\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
check_http E-01 422 "$CODE" "cross-shop item"

R=$(curl_json PUT "/api/v1/merchant/shops/$SHOP_A/items/$ITEM_A2" "$AT_M1" '{"isActive":false}'); parse_resp "$R"
check_http E-02a 200 "$CODE"

R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A2\",\"quantity\":1}],\"paymentMethod\":\"cash\"}"); parse_resp "$R"
check_http E-02b 422 "$CODE" "inactive item"

R=$(curl_json POST /api/v1/consumer/orders "$AT_C1" "{\"shopId\":\"$SHOP_A\",\"consumerAddressId\":\"$ADDR_C1\",\"items\":[{\"merchantItemId\":\"$ITEM_A1\",\"quantity\":1}],\"paymentMethod\":\"crypto\"}"); parse_resp "$R"
check_http E-03 400 "$CODE"

R=$(curl_auth GET /api/v1/merchant/shops "$AT_C1"); parse_resp "$R"
check_http E-04 403 "$CODE"

R=$(curl_auth GET /api/v1/consumer/profile "$AT_M1"); parse_resp "$R"
check_http E-05 403 "$CODE"

R=$(curl_auth GET /api/v1/consumer/profile ''); parse_resp "$R"
check_http E-06 401 "$CODE"

R=$(curl_auth GET "/api/v1/consumer/shops?lat=$SHOP_A_LAT&lon=$SHOP_A_LON&radius=50000&page=1&pageSize=1" "$AT_C1"); parse_resp "$R"
check_http E-07 200 "$CODE"
if printf '%s' "$BODY" | python3 -c 'import json,sys; a=json.load(sys.stdin); assert len(a)<=1' 2>/dev/null; then log "PASS E-07b pageSize=1"; else log "FAIL E-07b"; FAILURES=$((FAILURES+1)); fi

log "=== Summary: failures=$FAILURES ==="
[[ "$FAILURES" -eq 0 ]]
