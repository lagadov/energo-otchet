#!/usr/bin/env bash
# Проверка на работещата система от край до край (след `docker compose up`).
# Минава през таблото (nginx) → услугата → базата, т.е. през всички части.
# Всяка стъпка или минава, или спира скрипта с ненулев код и обяснение.
set -euo pipefail
ADRES="${1:-http://localhost:8080}"

provali() { echo "ПРОВАЛ: $*" >&2; exit 1; }

echo "1. Здравна проверка на услугата"
curl -fsS http://localhost:3000/health || provali "услугата не е здрава"

echo; echo "2. Показание през таблото (nginx → услуга → база)"
SEGA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X POST "$ADRES/api/pokazaniya" -H 'content-type: application/json' \
  -d "{\"elektromerId\":\"EM-9999\",\"vreme\":\"$SEGA\",\"energiyaWh\":1000}" \
  || provali "показанието не беше прието"

echo; echo "3. Невалидно показание трябва да бъде отказано с 400"
KOD=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$ADRES/api/pokazaniya" \
  -H 'content-type: application/json' -d '{"elektromerId":"x","vreme":"x","energiyaWh":-1}')
[ "$KOD" = "400" ] || provali "очаквах 400, получих $KOD"
echo "400 — правилно"

echo "4. Симулаторът изпраща показания"
BROI=0
for _ in $(seq 1 30); do
  # `|| true`: празен списък не е грешка тук — просто опитваме пак.
  BROI=$(curl -fsS "$ADRES/api/elektromeri" | { grep -o '"EM-0[0-9]*"' || true; } | wc -l)
  [ "$BROI" -ge 1 ] && break
  sleep 1
done
[ "$BROI" -ge 1 ] || provali "симулаторът не е изпратил показания за 30 секунди"
echo "електромери от симулатора: $BROI"

echo "5. Таблото отговаря със страницата на приложението"
STRANICA=$(curl -fsS "$ADRES/") || provali "таблото не отговаря"
grep -q "<title>Енерго-отчет</title>" <<<"$STRANICA" || provali "началната страница не е на таблото"
echo "таблото е достъпно"

echo "ПРОВЕРКАТА МИНА"
