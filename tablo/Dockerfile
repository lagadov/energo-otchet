# Изгражда се от корена на хранилището: docker build -f tablo/Dockerfile .

# --- 1. Изграждане на статичните файлове ---
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS izgrazhdane
WORKDIR /app
COPY package.json package-lock.json ./
COPY usluga/package.json usluga/
COPY tablo/package.json tablo/
RUN npm ci -w tablo
# Договорът на услугата: таблото ползва типовете от него.
COPY usluga/src/dogovor.ts usluga/src/dogovor.ts
COPY tablo/ tablo/
RUN npm run build -w tablo

# --- 2. Сервиране с nginx; /api се препраща към услугата ---
FROM nginx:stable-alpine@sha256:8eb04fe3b385090e9aa02961f77398ad09b6bf33ab07f6669a5bb7acce22c0d3
COPY tablo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=izgrazhdane /app/tablo/dist /usr/share/nginx/html
EXPOSE 80
