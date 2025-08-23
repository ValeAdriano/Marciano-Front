const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Trust proxy do Railway
app.set('trust proxy', 1);

// Middleware de redirecionamento HTTP -> HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// Configuração CORS para produção
app.use(cors({
  origin: [
    'https://qualidadesanimicas-production.up.railway.app',
    'https://qualidades-animicas-app-production.up.railway.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Configuração de segurança com Helmet
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": [
        "'self'",
        "'unsafe-inline'", // Angular precisa para templates dinâmicos
        "'unsafe-eval'"    // Angular precisa para compilação JIT
      ],
      "style-src": [
        "'self'",
        "'unsafe-inline'"  // Angular gera estilos inline
      ],
      "img-src": [
        "'self'",
        "data:",
        "blob:",
        "https:"
      ],
      "font-src": [
        "'self'",
        "data:",
        "https:"
      ],
      "connect-src": [
        "'self'",
        "https://qualidadesanimicas-production.up.railway.app",
        "wss://qualidadesanimicas-production.up.railway.app"
      ],
      "frame-ancestors": ["'self'"],
      "upgrade-insecure-requests": [],
      "base-uri": ["'self'"],
      "form-action": ["'self'"]
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: 'sameorigin' },
  hsts: { 
    maxAge: 31536000, 
    includeSubDomains: true, 
    preload: true 
  },
  crossOriginEmbedderPolicy: false, // Angular precisa desativar
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  xssFilter: true
}));

// Middleware para compressão (se necessário)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração de cache para assets estáticos
const staticOptions = {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
};

// Servir arquivos estáticos do build Angular
const distFolder = path.join(__dirname, 'dist', 'Marciano-Front', 'browser');
app.use(express.static(distFolder, staticOptions));

// Healthcheck para monitoramento
app.get('/healthz', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint de status da aplicação
app.get('/api/status', (_req, res) => {
  res.json({
    app: 'Marciano Front',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// SPA fallback - sempre retorna index.html para rotas não encontradas
app.get('*', (_req, res) => {
  res.sendFile(path.join(distFolder, 'index.html'));
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro na aplicação:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'production' ? 'Algo deu errado' : err.message
  });
});

// Middleware 404 para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

const port = process.env.PORT || 8080;
const host = '0.0.0.0';

app.listen(port, host, () => {
  console.log(`🚀 Marciano Front rodando em http://${host}:${port}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Build: ${distFolder}`);
  console.log(`🔒 Segurança: Helmet + HTTPS redirect + CORS configurado`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});
