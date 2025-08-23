# Etapa 1 - Build da aplicação Angular
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etapa 2 - Servir via Express (mais seguro e configurável)
FROM node:22-alpine AS production
WORKDIR /app

# Copiar apenas dependências de produção
COPY package*.json ./
RUN npm ci --only=production

# Copiar build e servidor
COPY --from=build /app/dist ./dist
COPY server.js ./

# Usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "server.js"]
