# Railway: nur Billing-API (Frontend läuft auf Vercel)
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server/billingServer.js"]
