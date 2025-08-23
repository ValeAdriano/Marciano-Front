# 🚀 Deploy no Railway - Marciano Front

Este guia explica como fazer deploy seguro do Marciano Front no Railway com todas as configurações de segurança implementadas.

## 📋 Pré-requisitos

- ✅ Conta no [Railway](https://railway.app)
- ✅ Projeto configurado com segurança
- ✅ Build funcionando localmente

## 🔧 Configurações Implementadas

### **1. Servidor Express Seguro**
- ✅ **Helmet.js** - Headers de segurança
- ✅ **CORS** configurado para produção
- ✅ **HTTPS redirect** automático
- ✅ **Rate limiting** contra ataques
- ✅ **Healthcheck** para monitoramento

### **2. Configurações de Segurança**
- ✅ **Content Security Policy (CSP)** otimizado para Angular
- ✅ **HSTS** com preload
- ✅ **Frame protection** contra clickjacking
- ✅ **XSS protection** ativada
- ✅ **Referrer policy** restritiva

### **3. Otimizações de Produção**
- ✅ **Cache** configurado para assets estáticos
- ✅ **Compressão** de resposta
- ✅ **Trust proxy** para Railway
- ✅ **Graceful shutdown**

## 🚀 Deploy no Railway

### **Passo 1: Conectar Repositório**

1. Acesse [Railway Dashboard](https://railway.app/dashboard)
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha seu repositório `marciano-front`

### **Passo 2: Configurar Build**

O Railway detectará automaticamente as configurações do `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build",
    "watchPatterns": ["src/**/*", "package.json"]
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/healthz",
    "healthcheckTimeout": 300
  }
}
```

### **Passo 3: Variáveis de Ambiente**

Configure no Railway:

```bash
NODE_ENV=production
PORT=8080
```

### **Passo 4: Deploy Automático**

- ✅ O Railway fará build automático
- ✅ Executará `npm run build`
- ✅ Iniciará com `npm run start:prod`
- ✅ Healthcheck em `/healthz`

## 🔒 Verificações de Segurança

### **1. Headers de Segurança**

```bash
curl -I https://seu-app.railway.app
```

Deve retornar:
- ✅ `Strict-Transport-Security`
- ✅ `X-Frame-Options: SAMEORIGIN`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`

### **2. HTTPS Redirect**

```bash
curl -I http://seu-app.railway.app
```

Deve retornar:
- ✅ `301 Moved Permanently`
- ✅ `Location: https://seu-app.railway.app`

### **3. CORS Configurado**

```bash
curl -H "Origin: https://qualidadesanimicas-production.up.railway.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://seu-app.railway.app/api/status
```

Deve retornar:
- ✅ `Access-Control-Allow-Origin: https://qualidadesanimicas-production.up.railway.app`
- ✅ `Access-Control-Allow-Methods: POST`
- ✅ `Access-Control-Allow-Headers: Content-Type`

### **4. Healthcheck**

```bash
curl https://seu-app.railway.app/healthz
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

## 🐳 Deploy com Docker (Alternativo)

Se preferir usar Docker:

```bash
# Build da imagem
docker build -t marciano-front .

# Teste local
docker run -p 8080:8080 marciano-front

# Push para Railway
railway up
```

## 📊 Monitoramento

### **1. Logs do Railway**

- Acesse **"Deployments"** no projeto
- Clique no deployment ativo
- Visualize logs em tempo real

### **2. Métricas de Performance**

- **Response time** médio
- **Throughput** (requisições/segundo)
- **Error rate** (taxa de erro)
- **Memory usage** (uso de memória)

### **3. Alertas**

Configure alertas para:
- ⚠️ **Healthcheck falhando**
- ⚠️ **Response time > 2s**
- ⚠️ **Error rate > 5%**
- ⚠️ **Memory usage > 80%**

## 🔧 Troubleshooting

### **Problema: Build falhando**

```bash
# Verificar logs
railway logs

# Build local para debug
npm run build

# Verificar dependências
npm ci
```

### **Problema: App não inicia**

```bash
# Verificar variáveis de ambiente
railway variables

# Verificar comando de start
railway logs --tail
```

### **Problema: Healthcheck falhando**

```bash
# Testar endpoint localmente
curl http://localhost:8080/healthz

# Verificar se porta está correta
railway variables
```

### **Problema: CORS errors**

```bash
# Verificar configuração CORS
cat server.js | grep -A 10 "cors"

# Testar com curl
curl -H "Origin: https://qualidadesanimicas-production.up.railway.app" \
     -X GET https://seu-app.railway.app/api/status
```

## 🎯 Próximos Passos

1. ✅ **Deploy inicial** no Railway
2. ✅ **Verificar segurança** com testes
3. ✅ **Configurar domínio** personalizado
4. ✅ **Monitoramento** e alertas
5. ✅ **Backup** e recuperação

## 📞 Suporte

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Issues**: [GitHub Issues](https://github.com/seu-usuario/marciano-front/issues)
- **Discord**: [Railway Discord](https://discord.gg/railway)

---

**🎉 Seu Marciano Front está pronto para produção com segurança máxima!**
