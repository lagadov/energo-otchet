# Изгражда се от корена на хранилището: docker build -f usluga/Dockerfile .
# Образите са приковани по отпечатък (digest): етикетът е за четене, отпечатъкът решава.
# Обновяване: docker pull node:24-alpine, после новия отпечатък от docker inspect.

# --- 1. Изграждане: компилира TypeScript ---
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS izgrazhdane
WORKDIR /app
COPY package.json package-lock.json ./
COPY usluga/package.json usluga/
COPY tablo/package.json tablo/
RUN npm ci -w usluga
COPY usluga/ usluga/
RUN npm run build -w usluga

# --- 2. Изпълнение: само компилиран код и производствени зависимости ---
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY usluga/package.json usluga/
COPY tablo/package.json tablo/
RUN npm ci -w usluga --omit=dev && npm cache clean --force
COPY --from=izgrazhdane /app/usluga/dist usluga/dist
# Не работим като root вътре в контейнера.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "usluga/dist/server.js"]
