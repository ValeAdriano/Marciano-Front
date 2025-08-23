export const environment = {
  production: false,
  apiUrl: 'https://qualidadesanimicas-production.up.railway.app',
  socketUrl: 'https://qualidadesanimicas-production.up.railway.app',
  appName: 'Marciano Game',
  version: '1.0.0',
  
  // Configurações de WebSocket
  socket: {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
  },
  
  // Configurações de API
  api: {
    timeout: 30000,
    retryAttempts: 3
  },
  
  // Configurações do jogo
  game: {
    defaultRoundDuration: 180, // 3 minutos em segundos
    maxParticipants: 10,
    minParticipants: 2
  }
};
