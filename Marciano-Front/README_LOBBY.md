# 🏠 Lobby da Sala - Sistema de Gerenciamento

## 📋 Visão Geral

O **Lobby** é o centro de controle da sala onde os participantes aguardam o início das rodadas. Ele monitora automaticamente o status da sala e redireciona os usuários para as etapas apropriadas.

## ✨ Funcionalidades Implementadas

### 🔍 **Monitoramento Automático de Status**
- **Status em Tempo Real**: Monitora o status da sala a cada 5 segundos
- **Redirecionamento Automático**: Redireciona usuários baseado no status da rodada
- **API Integration**: Busca status via endpoint `/api/rooms/{code}/status`
- **WebSocket**: Recebe atualizações em tempo real

### 🎯 **Sistema de Redirecionamento Inteligente**
- **Lobby** → **Rodada Zero** (quando status = `rodada_0`)
- **Lobby** → **Rodada 1/2** (quando status = `rodada_1` ou `rodada_2`)
- **Lobby** → **Resultados** (quando status = `finalizado`)
- **Mantém no Lobby** (quando status = `lobby`)

### 🚀 **Controle de Facilitador**
- **Iniciar Rodada**: Botão para facilitadores iniciarem a votação
- **Validação**: Apenas ativa quando há 2+ participantes
- **API + WebSocket**: Dupla comunicação para garantir sincronização
- **Feedback Visual**: Confirmação e mensagens de sucesso

### 📊 **Interface Dinâmica**
- **Status da Rodada**: Exibe etapa atual com cores e ícones
- **Progresso da Votação**: Barra de progresso visual
- **Participantes**: Lista em tempo real com status de conexão
- **Etapas**: Timeline visual das etapas do jogo

## 🚀 Como Funciona

### 1. **Inicialização do Lobby**
```typescript
// Ao entrar no lobby
ngOnInit() {
  // Carrega sessão do usuário
  // Conecta ao WebSocket
  // Inicia monitoramento de status
  // Carrega participantes iniciais
}
```

### 2. **Monitoramento de Status**
```typescript
// Verifica status a cada 5 segundos
private startStatusMonitoring(roomCode: string): void {
  const interval = setInterval(() => {
    this.loadRoomStatus(roomCode);
  }, 5000);
}
```

### 3. **Redirecionamento Automático**
```typescript
private checkAndRedirect(roomStatus: RoomStatus): void {
  switch (roomStatus.status) {
    case 'rodada_0':
      this.router.navigate(['/rodada-zero']);
      break;
    case 'rodada_1':
    case 'rodada_2':
      this.router.navigate(['/rodada']);
      break;
    case 'finalizado':
      this.router.navigate(['/resultados']);
      break;
  }
}
```

## 🔧 Configuração

### **Endpoints da API**
- **GET** `/api/rooms/{code}/status` - Status atual da sala
- **POST** `/api/rooms/{code}/next-round` - Iniciar próxima rodada

### **Eventos WebSocket**
- **Entrada**: `start_round`, `join_room`, `leave_room`
- **Recebidos**: `room:joined`, `room:left`, `round:started`

### **Environment**
```typescript
// src/environments/environment.ts
export const environment = {
  apiUrl: 'http://127.0.0.1:8000',
  socketUrl: 'http://127.0.0.1:8000',
  // ... outras configurações
};
```

## 🎨 Interface do Usuário

### **Header com Status da Rodada**
- **Título**: Status atual da rodada com emojis
- **Informações**: Rodada atual, total de rodadas, participantes
- **Progresso**: Barra de progresso da votação
- **Redirecionamento**: Mensagem de aviso quando apropriado

### **Grid de Informações**
- **Código da Sala**: Com botão de copiar
- **Perfil do Usuário**: Avatar, nome e cor do envelope
- **Status de Conexão**: Indicador visual online/offline

### **Lista de Participantes**
- **Avatar**: Ícone com cor do envelope
- **Nome**: Nome do participante
- **Status**: Conectado/Desconectado
- **Contador**: Total de participantes

### **Timeline de Etapas**
- **Lobby**: Etapa atual (azul)
- **Rodada 0**: Autoavaliação (amarelo)
- **Votação**: Rodadas 1 e 2 (verde)
- **Resultados**: Finalização (roxo)

## 🔌 Integração com Backend

### **Monitoramento Contínuo**
```typescript
// Carrega status inicial
this.loadRoomStatus(roomCode);

// Inicia monitoramento periódico
this.startStatusMonitoring(roomCode);

// Verifica redirecionamento
this.checkAndRedirect(roomStatus);
```

### **Início de Rodada**
```typescript
// Via WebSocket
this.socket.emit('start_round', { room_code: roomCode });

// Via API
this.startRoundViaApi(roomCode);
```

### **Tratamento de Erros**
- **Fallback**: Dados mock se API falhar
- **Reconexão**: WebSocket reconecta automaticamente
- **Logs**: Console detalhado para debugging

## 📱 Responsividade

### **Breakpoints**
- **Mobile**: < 640px (coluna única)
- **Tablet**: 640px - 1024px (grid 2 colunas)
- **Desktop**: > 1024px (grid 3 colunas)

### **Adaptações Mobile**
- Status da rodada em coluna única
- Grid de informações empilhado
- Botões em largura total
- Timeline vertical

## 🧪 Testes

### **Funcionalidades Testadas**
- ✅ Inicialização do componente
- ✅ Conexão WebSocket
- ✅ Monitoramento de status
- ✅ Redirecionamento automático
- ✅ Interface responsiva
- ✅ Tratamento de erros

### **Executar Testes**
```bash
# Testes unitários
ng test

# Testes específicos do lobby
ng test --include="**/lobby/**"
```

## 🐛 Troubleshooting

### **Problema: Status não atualiza**
```typescript
// Verificar no console:
console.log('Status da sala:', this.lobby.roomStatus());
console.log('Monitoramento ativo:', this.startStatusMonitoring);
```

### **Problema: Redirecionamento não funciona**
```typescript
// Verificar no console:
console.log('Status atual:', roomStatus.status);
console.log('Navegação:', this.router.navigate);
```

### **Problema: WebSocket não conecta**
```typescript
// Verificar no console:
console.log('Status da conexão:', this.lobby.isConnected());
console.log('URL do WebSocket:', environment.socketUrl);
```

## 🔮 Próximos Passos

### **Melhorias Planejadas**
1. **Notificações Push**: Alertas para mudanças de status
2. **Chat em Tempo Real**: Comunicação entre participantes
3. **Configurações de Sala**: Personalização pelo facilitador
4. **Histórico de Rodadas**: Log de atividades
5. **Modo Offline**: Cache local para uso offline

### **Integrações Futuras**
1. **Analytics**: Métricas de uso e tempo no lobby
2. **Moderação**: Controles para facilitadores
3. **Backup**: Sistema de backup de dados da sala
4. **Exportação**: Relatórios em diferentes formatos

## 📚 Documentação Relacionada

- [🎯 Rodada Zero](./README_RODADA_ZERO.md)
- [🎮 Sistema de Rodadas](./README_ROUNDS.md)
- [🏠 Página Inicial](./README.md)
- [🔗 Integração](./README_INTEGRACAO.md)

## 🤝 Contribuição

Para contribuir com o lobby:

1. **Fork** o repositório
2. **Crie** uma branch para sua feature
3. **Implemente** as mudanças
4. **Teste** localmente
5. **Submeta** um pull request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](../LICENSE) para mais detalhes.

---

**🏠 Lobby implementado com sucesso!**

O sistema agora monitora automaticamente o status da sala e redireciona os usuários para as etapas apropriadas, proporcionando uma experiência fluida e intuitiva.
