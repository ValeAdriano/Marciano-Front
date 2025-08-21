# Marciano Game - Sistema Preparado para Backend

## Visão Geral

Este projeto Angular foi preparado para integração completa com backend e WebSockets. O sistema inclui:

- ✅ **Serviços de API** para todas as operações REST
- ✅ **Serviço de WebSocket** para comunicação em tempo real
- ✅ **Gerenciamento de estado global** do jogo
- ✅ **Fallback para dados mock** enquanto o backend não está pronto
- ✅ **Interceptors HTTP** para tratamento de erros
- ✅ **Configurações de ambiente** para dev/prod
- ✅ **Documentação completa** da API necessária

## Estrutura Implementada

### 1. Serviços Principais

#### `ApiService` (`src/app/@shared/services/api.service.ts`)
- Gerencia todas as chamadas HTTP para o backend
- Tratamento centralizado de erros
- Headers e configurações padronizadas
- Endpoints para salas, rodadas, participantes e resultados

#### `SocketService` (`src/app/@shared/services/socket.service.ts`)
- Gerencia conexões WebSocket via Socket.IO
- Eventos em tempo real para salas e rodadas
- Reconexão automática e tratamento de erros
- Estado da conexão e sala atual

#### `GameStateService` (`src/app/@shared/services/game-state.service.ts`)
- Estado global do jogo
- Sincronização entre componentes
- Navegação automática baseada em eventos
- Controle de fluxo do jogo

### 2. Tipos e Interfaces

#### `src/app/@shared/types/api.types.ts`
- Todas as interfaces necessárias para API e WebSocket
- Tipos para salas, participantes, rodadas e eventos
- Enums para status do jogo

### 3. Configurações

#### `src/environments/environment.ts` (Desenvolvimento)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
  // ... outras configurações
};
```

#### `src/environments/environment.prod.ts` (Produção)
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://seu-backend-prod.com/api',
  socketUrl: 'https://seu-backend-prod.com',
  // ... outras configurações
};
```

## Como Usar

### 1. Configuração do Backend

1. **Implemente a API** conforme especificação em `BACKEND_API_SPEC.md`
2. **Configure as URLs** nos arquivos de ambiente
3. **Teste os endpoints** antes de remover os dados mock

### 2. Ativação da Integração

#### Etapa 1: Testar Backend
```bash
# Teste se o backend está respondendo
curl http://localhost:3000/api/rooms/test
```

#### Etapa 2: Atualizar URLs
```typescript
// src/environments/environment.ts
export const environment = {
  apiUrl: 'http://localhost:3000/api', // Sua URL real
  socketUrl: 'http://localhost:3000',  // Sua URL real
  // ...
};
```

#### Etapa 3: Remover Dados Mock
Quando o backend estiver funcionando, remova os dados mock dos serviços:

```typescript
// src/app/pages/lobby/lobby.service.ts
private loadMockParticipants(): void {
  // Comentar ou remover este método
  // this.loadMockParticipants();
}
```

### 3. Uso dos Serviços

#### Em um Componente
```typescript
import { GameStateService } from '@shared/services/game-state.service';
import { ApiService } from '@shared/services/api.service';

export class MeuComponente {
  constructor(
    private gameState: GameStateService,
    private api: ApiService
  ) {}

  // Usar estado global
  readonly participants = this.gameState.participants;
  readonly isHost = this.gameState.isHost;

  // Fazer chamadas para API
  criarSala() {
    this.api.createRoom({
      name: 'Minha Sala',
      maxParticipants: 8,
      totalRounds: 5
    }).subscribe({
      next: (room) => console.log('Sala criada:', room),
      error: (error) => console.error('Erro:', error)
    });
  }
}
```

#### No Template
```html
<div *ngFor="let participant of participants()">
  <span>{{ participant.name }}</span>
  <span [style.background-color]="participant.envelopeHex"></span>
  <span>{{ participant.status }}</span>
</div>

<button 
  *ngIf="isHost()" 
  [disabled]="!canStartRound()"
  (click)="startRound()">
  Iniciar Rodada
</button>
```

## Funcionalidades Implementadas

### 1. Sistema de Salas
- ✅ Criar sala
- ✅ Entrar em sala
- ✅ Listar participantes
- ✅ Sair da sala
- ✅ Status de participantes

### 2. Sistema de Rodadas
- ✅ Iniciar rodada
- ✅ Timer sincronizado
- ✅ Finalizar rodada
- ✅ Navegação automática

### 3. WebSocket em Tempo Real
- ✅ Conexão automática
- ✅ Eventos de sala
- ✅ Eventos de rodada
- ✅ Reconexão automática

### 4. Gerenciamento de Estado
- ✅ Estado global do jogo
- ✅ Sincronização entre componentes
- ✅ Navegação baseada em eventos
- ✅ Controle de fluxo

## Fluxo do Jogo

### 1. Criação/Entrada na Sala
```
Usuário → Cria/Entra na Sala → API → WebSocket → Lobby
```

### 2. Preparação
```
Participantes → Marcam como Pronto → WebSocket → Todos Atualizados
```

### 3. Início da Rodada
```
Host → Inicia Rodada → WebSocket → Todos → Página de Rodada
```

### 4. Durante a Rodada
```
Timer → Sincronizado via WebSocket → Todos Atualizados
```

### 5. Fim da Rodada
```
Rodada Termina → WebSocket → Todos → Página de Resultados
```

## Tratamento de Erros

### 1. Interceptor HTTP
- ✅ Tratamento centralizado de erros HTTP
- ✅ Mensagens de erro amigáveis
- ✅ Logs de erro para debug

### 2. Fallback para Dados Mock
- ✅ Sistema funciona sem backend
- ✅ Dados simulados para desenvolvimento
- ✅ Transição suave para dados reais

### 3. WebSocket
- ✅ Reconexão automática
- ✅ Tratamento de erros de conexão
- ✅ Fallback para estado offline

## Desenvolvimento

### 1. Estrutura de Pastas
```
src/app/
├── @shared/
│   ├── services/          # Serviços principais
│   ├── types/            # Interfaces e tipos
│   └── interceptors/     # Interceptors HTTP
├── pages/                # Páginas da aplicação
└── app.config.ts         # Configuração principal
```

### 2. Padrões Utilizados
- **Signals** para estado reativo
- **Dependency Injection** para serviços
- **Observables** para operações assíncronas
- **Interceptors** para tratamento de erros
- **Environment** para configurações

### 3. Testes
```bash
# Executar testes
npm test

# Executar testes com coverage
npm run test:coverage
```

## Deploy

### 1. Build de Produção
```bash
# Build para produção
npm run build

# Build com SSR
npm run build:ssr
```

### 2. Configuração de Produção
1. Atualize `environment.prod.ts` com suas URLs
2. Configure CORS no backend
3. Configure SSL/HTTPS
4. Configure reverse proxy (Nginx/Apache)

### 3. Variáveis de Ambiente
```bash
# .env (se necessário)
API_URL=https://seu-backend.com/api
SOCKET_URL=https://seu-backend.com
```

## Troubleshooting

### 1. WebSocket não conecta
- Verifique se o backend está rodando
- Verifique as URLs nos arquivos de ambiente
- Verifique se o CORS está configurado no backend

### 2. API retorna erro
- Verifique se o backend está respondendo
- Verifique os logs do backend
- Use o interceptor de erro para debug

### 3. Estado não sincroniza
- Verifique se o `GameStateService` está sendo usado
- Verifique se os eventos WebSocket estão chegando
- Verifique os logs do console

## Próximos Passos

1. **Implementar Backend** conforme especificação
2. **Testar Integração** com dados reais
3. **Remover Dados Mock** gradualmente
4. **Adicionar Autenticação** se necessário
5. **Implementar Testes E2E**
6. **Configurar CI/CD**

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console
2. Verifique a documentação da API
3. Teste os endpoints individualmente
4. Verifique a conectividade WebSocket

---

**Status**: ✅ Sistema preparado para backend
**Próximo**: Implementar backend conforme especificação
