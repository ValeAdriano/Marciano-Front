# Especificação da API Backend - Marciano Game

## Visão Geral

Este documento descreve a API REST e WebSocket que o backend deve implementar para funcionar com o frontend Angular.

## Base URL

- **Desenvolvimento**: `http://localhost:3000`
- **Produção**: `https://seu-backend-prod.com`

## Estrutura da API

### 1. Endpoints REST

#### 1.1 Salas (Rooms)

##### Criar Sala
```
POST /api/rooms
Content-Type: application/json

{
  "name": "Sala do João",
  "maxParticipants": 8,
  "totalRounds": 5
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-da-sala",
    "code": "ABC123",
    "name": "Sala do João",
    "status": "waiting",
    "maxParticipants": 8,
    "currentRound": 0,
    "totalRounds": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

##### Obter Sala
```
GET /api/rooms/{roomCode}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-da-sala",
    "code": "ABC123",
    "name": "Sala do João",
    "status": "waiting",
    "maxParticipants": 8,
    "currentRound": 0,
    "totalRounds": 5,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

##### Entrar na Sala
```
POST /api/rooms/join
Content-Type: application/json

{
  "roomCode": "ABC123",
  "participantName": "João Silva",
  "envelopeHex": "#ff0000"
}

Response:
{
  "success": true,
  "data": {
    "room": { /* dados da sala */ },
    "participant": {
      "id": "uuid-participante",
      "name": "João Silva",
      "envelopeHex": "#ff0000",
      "status": "connected",
      "isHost": false,
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "lastSeen": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

##### Sair da Sala
```
POST /api/rooms/{roomCode}/leave
Content-Type: application/json

{
  "participantId": "uuid-participante"
}

Response:
{
  "success": true,
  "data": null
}
```

##### Listar Participantes
```
GET /api/rooms/{roomCode}/participants

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-participante",
      "name": "João Silva",
      "envelopeHex": "#ff0000",
      "status": "connected",
      "isHost": true,
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "lastSeen": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### 1.2 Rodadas (Rounds)

##### Iniciar Rodada
```
POST /api/rooms/{roomCode}/rounds/start
Content-Type: application/json

{}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-rodada",
    "roomId": "uuid-sala",
    "roundNumber": 1,
    "status": "active",
    "duration": 180,
    "startedAt": "2024-01-01T00:00:00.000Z",
    "participants": [/* lista de participantes */]
  }
}
```

##### Obter Rodada Atual
```
GET /api/rooms/{roomCode}/rounds/current

Response:
{
  "success": true,
  "data": {
    "id": "uuid-rodada",
    "roomId": "uuid-sala",
    "roundNumber": 1,
    "status": "active",
    "duration": 180,
    "startedAt": "2024-01-01T00:00:00.000Z",
    "participants": [/* lista de participantes */]
  }
}
```

##### Finalizar Rodada
```
POST /api/rooms/{roomCode}/rounds/{roundId}/finish
Content-Type: application/json

{}

Response:
{
  "success": true,
  "data": {
    "id": "uuid-rodada",
    "roomId": "uuid-sala",
    "roundNumber": 1,
    "status": "finished",
    "duration": 180,
    "startedAt": "2024-01-01T00:00:00.000Z",
    "finishedAt": "2024-01-01T00:03:00.000Z",
    "participants": [/* lista de participantes com resultados */]
  }
}
```

##### Marcar Participante como Pronto
```
PUT /api/rooms/{roomCode}/participants/{participantId}/ready
Content-Type: application/json

{
  "isReady": true
}

Response:
{
  "success": true,
  "data": null
}
```

#### 1.3 Resultados e Histórico

##### Obter Resultados da Rodada
```
GET /api/rooms/{roomCode}/rounds/{roundId}/results

Response:
{
  "success": true,
  "data": {
    "id": "uuid-rodada",
    "roomId": "uuid-sala",
    "roundNumber": 1,
    "status": "finished",
    "duration": 180,
    "startedAt": "2024-01-01T00:00:00.000Z",
    "finishedAt": "2024-01-01T00:03:00.000Z",
    "participants": [
      {
        "participantId": "uuid-participante",
        "participantName": "João Silva",
        "envelopeHex": "#ff0000",
        "status": "finished",
        "score": 100,
        "timeSpent": 175
      }
    ]
  }
}
```

##### Obter Histórico da Sala
```
GET /api/rooms/{roomCode}/history

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid-rodada",
      "roomId": "uuid-sala",
      "roundNumber": 1,
      "status": "finished",
      "duration": 180,
      "startedAt": "2024-01-01T00:00:00.000Z",
      "finishedAt": "2024-01-01T00:03:00.000Z"
    }
  ]
}
```

### 2. WebSocket Events

#### 2.1 Eventos de Conexão

##### Conectar
```javascript
// Cliente se conecta automaticamente
socket.connect();
```

##### Desconectar
```javascript
// Cliente se desconecta
socket.disconnect();
```

#### 2.2 Eventos de Sala

##### Entrar na Sala
```javascript
// Cliente emite
socket.emit('room:join', { roomCode: 'ABC123', participantId: 'uuid' });

// Servidor responde
socket.on('room:joined', (data) => {
  // data: { room: Room, participants: Participant[] }
});
```

##### Sair da Sala
```javascript
// Cliente emite
socket.emit('room:leave', { roomCode: 'ABC123' });

// Servidor responde
socket.on('room:left', () => {
  // Sala abandonada com sucesso
});
```

#### 2.3 Eventos de Participantes

##### Participante Entrou
```javascript
// Servidor emite para todos na sala
socket.on('participant:joined', (data) => {
  // data: { participant: Participant }
});
```

##### Participante Saiu
```javascript
// Servidor emite para todos na sala
socket.on('participant:left', (data) => {
  // data: { participantId: string }
});
```

##### Participante Pronto
```javascript
// Cliente emite
socket.emit('participant:ready', {
  roomCode: 'ABC123',
  participantId: 'uuid',
  isReady: true
});

// Servidor emite para todos na sala
socket.on('participant:ready', (data) => {
  // data: { participantId: string, isReady: boolean }
});
```

#### 2.4 Eventos de Rodada

##### Iniciar Rodada
```javascript
// Cliente (host) emite
socket.emit('round:start', { roomCode: 'ABC123' });

// Servidor emite para todos na sala
socket.on('round:started', (data) => {
  // data: { round: Round, duration: number }
});
```

##### Finalizar Rodada
```javascript
// Cliente emite
socket.emit('round:finish', { roomCode: 'ABC123', roundId: 'uuid' });

// Servidor emite para todos na sala
socket.on('round:finished', (data) => {
  // data: { round: Round, results: RoundParticipant[] }
});
```

### 3. Estrutura de Dados

#### 3.1 Sala (Room)
```typescript
interface Room {
  id: string;
  code: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxParticipants: number;
  currentRound: number;
  totalRounds: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3.2 Participante (Participant)
```typescript
interface Participant {
  id: string;
  name: string;
  envelopeHex: string;
  status: 'connected' | 'disconnected' | 'ready';
  isHost: boolean;
  joinedAt: Date;
  lastSeen: Date;
}
```

#### 3.3 Rodada (Round)
```typescript
interface Round {
  id: string;
  roomId: string;
  roundNumber: number;
  status: 'waiting' | 'active' | 'finished';
  duration: number; // em segundos
  startedAt?: Date;
  finishedAt?: Date;
  participants: RoundParticipant[];
}
```

#### 3.4 Participante da Rodada (RoundParticipant)
```typescript
interface RoundParticipant {
  participantId: string;
  participantName: string;
  envelopeHex: string;
  status: 'waiting' | 'ready' | 'finished';
  score?: number;
  timeSpent?: number;
}
```

### 4. Códigos de Status HTTP

- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Dados inválidos
- `401` - Não autorizado
- `403` - Acesso negado
- `404` - Recurso não encontrado
- `409` - Conflito
- `422` - Dados inválidos
- `500` - Erro interno do servidor
- `503` - Serviço indisponível

### 5. Respostas de Erro

```json
{
  "success": false,
  "error": "Mensagem de erro descritiva",
  "message": "Mensagem para o usuário"
}
```

### 6. Implementação Recomendada

#### 6.1 Tecnologias
- **Node.js** com **Express.js** ou **Fastify**
- **Socket.IO** para WebSocket
- **PostgreSQL** ou **MongoDB** para banco de dados
- **Redis** para cache e sessões
- **JWT** para autenticação (se necessário)

#### 6.2 Estrutura de Pastas
```
backend/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── socket/
│   └── utils/
├── tests/
├── package.json
└── README.md
```

#### 6.3 Dependências Principais
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.7.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.7.0"
  }
}
```

### 7. Considerações de Segurança

1. **Validação de entrada**: Sempre valide dados recebidos
2. **Rate limiting**: Implemente limitação de taxa para evitar spam
3. **CORS**: Configure CORS adequadamente
4. **Sanitização**: Sanitize dados antes de salvar no banco
5. **Logs**: Implemente logs para auditoria
6. **Monitoramento**: Monitore performance e erros

### 8. Testes

Implemente testes para:
- Endpoints da API
- Eventos do WebSocket
- Validações de dados
- Casos de erro
- Performance

### 9. Deploy

1. **Variáveis de ambiente**: Configure URLs, portas e credenciais
2. **Process manager**: Use PM2 ou similar
3. **Reverse proxy**: Nginx ou Apache
4. **SSL**: Configure HTTPS em produção
5. **Backup**: Implemente backup do banco de dados

---

**Nota**: Esta especificação deve ser implementada no backend antes de remover os dados mock do frontend. O sistema funcionará com dados simulados até que o backend esteja pronto.
