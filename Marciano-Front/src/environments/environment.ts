export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000',
  socketUrl: 'http://127.0.0.1:8000',
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
