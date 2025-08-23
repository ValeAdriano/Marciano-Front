export const environment = {
  production: true,
  apiUrl: 'https://qualidadesanimicas-production.up.railway.app/api',
  socketUrl: 'https://qualidadesanimicas-production.up.railway.app',
  appName: 'Marciano Game',
  version: '1.0.0',
  
  // Configurações de WebSocket
  socket: {
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 30000
  },
  
  // Configurações de API
  api: {
    timeout: 60000,
    retryAttempts: 5
  },
  
  // Configurações do jogo
  game: {
    defaultRoundDuration: 180,
    maxParticipants: 10,
    minParticipants: 2
  }
};
