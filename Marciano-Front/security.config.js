/**
 * Configurações de Segurança para Marciano Front
 * Este arquivo contém configurações específicas de segurança para produção
 */

module.exports = {
  // Configurações de CORS
  cors: {
    origins: [
      'https://qualidadesanimicas-production.up.railway.app',
      'https://qualidades-animicas-app-production.up.railway.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-Forwarded-For',
      'X-Forwarded-Proto'
    ]
  },

  // Configurações de Helmet
  helmet: {
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
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    xssFilter: true
  },

  // Configurações de rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite por IP
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Configurações de compressão
  compression: {
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  },

  // Configurações de cache
  cache: {
    static: {
      maxAge: '1y',
      etag: true,
      lastModified: true
    },
    html: {
      maxAge: '0',
      etag: true,
      lastModified: true
    }
  },

  // Configurações de logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'dev'
  }
};
