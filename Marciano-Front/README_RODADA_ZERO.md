# 🎯 Rodada Zero - Autoavaliação

## 📋 Visão Geral

A **Rodada Zero** é a primeira etapa do jogo Marciano, onde cada participante faz uma autoavaliação escolhendo uma carta que melhor representa suas qualidades anímicas.

## ✨ Funcionalidades Implementadas

### 🎮 **Sistema de Autoavaliação**
- **Drag & Drop**: Arraste cartas da sua mão para o alvo "Você"
- **Seleção Inteligente**: Clique na carta para habilitar o arraste
- **Validação**: Apenas uma carta por participante
- **Confirmação**: Modal de confirmação antes de enviar

### 🌟 **Mapeamento de Planetas**
- **Laranja** → 🪐 **Marte** (Pensamento estratégico)
- **Verde** → 🪐 **Vênus** (Harmonia e bem-estar)
- **Amarelo** → 🪐 **Mercúrio** (Agilidade e inovação)
- **Azul** → 🪐 **Saturno** (Foco e profundidade)
- **Vermelho** → 🪐 **Júpiter** (Iniciativa e ação)
- **Roxo** → 🪐 **Urano** (Avaliação e monitoramento)

### 🔌 **Integração com Backend**
- **WebSocket**: Conexão em tempo real
- **API REST**: Endpoints para votação e status
- **Status da Sala**: Monitoramento em tempo real
- **Progresso da Votação**: Barra de progresso visual

### 📱 **Interface Responsiva**
- **Swiper**: Navegação horizontal nas cartas
- **Tailwind CSS**: Design moderno e responsivo
- **Animações**: Transições suaves e feedback visual
- **Mobile First**: Otimizado para dispositivos móveis

## 🚀 Como Usar

### 1. **Acessar a Rodada**
```bash
# Navegar para a rodada zero
http://localhost:4200/rodada-zero
```

### 2. **Selecionar Carta**
1. **Clique** na carta desejada (ela se levantará)
2. **Arraste** a carta para o alvo "Você"
3. **Confirme** a seleção no modal

### 3. **Monitorar Progresso**
- **Status da Sala**: Visualizar estado atual
- **Progresso**: Barra de progresso da votação
- **Conexão**: Indicador de status WebSocket

## 🔧 Configuração

### **Environment**
```typescript
// src/environments/environment.ts
export const environment = {
  apiUrl: 'http://127.0.0.1:8000',
  socketUrl: 'http://127.0.0.1:8000',
  // ... outras configurações
};
```

### **Proxy**
```json
// proxy.conf.json
{
  "/api": { 
    "target": "http://127.0.0.1:8000", 
    "secure": false, 
    "changeOrigin": true 
  },
  "/socket.io": {
    "target": "http://127.0.0.1:8000",
    "secure": false,
    "ws": true,
    "changeOrigin": true
  }
}
```

## 📡 Endpoints da API

### **GET /api/rooms/{code}/me**
- **Descrição**: Obter informações do usuário atual
- **Resposta**: Dados do participante

### **POST /api/rooms/{code}/self-vote**
- **Descrição**: Enviar autoavaliação
- **Body**: `{ cardId, participantId }`
- **Resposta**: Confirmação do voto

### **GET /api/rooms/{code}/status**
- **Descrição**: Obter status atual da sala
- **Resposta**: Status, rodada atual, progresso

## 🔌 Eventos WebSocket

### **Entrada**
- `join_room`: Entrar na sala
- `leave`: Sair da sala

### **Recebidos**
- `room:joined`: Participante entrou
- `round:started`: Rodada iniciada
- `vote:progress`: Progresso da votação
- `round:finished`: Rodada finalizada
- `results:ready`: Resultados prontos
- `room:status`: Status atualizado da sala

## 🎨 Componentes

### **RodadaZeroComponent**
- **Responsabilidade**: Lógica principal da rodada
- **Funcionalidades**: Drag & Drop, votação, WebSocket

### **RodadaZeroApiService**
- **Responsabilidade**: Comunicação com backend
- **Funcionalidades**: HTTP, WebSocket, gerenciamento de estado

## 🧪 Testes

### **Executar Testes**
```bash
# Testes unitários
ng test

# Testes específicos da rodada zero
ng test --include="**/rodada-zero/**"
```

### **Testes Implementados**
- ✅ Criação do componente
- ✅ Número da rodada
- ✅ Informações dos planetas
- ✅ Mapeamento de cores
- ✅ Exibição de status

## 🐛 Troubleshooting

### **Problema: WebSocket não conecta**
```typescript
// Verificar no console:
console.log('Status da conexão:', this.api.connected());
console.log('URL do WebSocket:', environment.socketUrl);
```

### **Problema: API não responde**
```typescript
// Verificar no console:
console.log('URL da API:', environment.apiUrl);
console.log('Proxy configurado:', proxy.conf.json);
```

### **Problema: Drag & Drop não funciona**
```typescript
// Verificar se a carta está selecionada:
console.log('Carta selecionada:', this.selectedCardId());
console.log('Pode arrastar:', this.canDrag(cardId));
```

## 📱 Responsividade

### **Breakpoints**
- **Mobile**: < 640px (coluna única)
- **Tablet**: 640px - 1024px (layout híbrido)
- **Desktop**: > 1024px (layout completo)

### **Adaptações Mobile**
- Cartas em coluna única
- Badges de planeta menores
- HUD compacto
- Swiper otimizado para touch

## 🔮 Próximos Passos

### **Melhorias Planejadas**
1. **Animações**: Transições mais suaves
2. **Som**: Feedback auditivo
3. **Haptic**: Vibração em dispositivos móveis
4. **Offline**: Cache local para uso offline
5. **Acessibilidade**: Suporte a leitores de tela

### **Integrações Futuras**
1. **Analytics**: Métricas de uso
2. **Logs**: Sistema de logging
3. **Monitoramento**: Health checks
4. **Cache**: Redis para performance

## 📚 Documentação Relacionada

- [📖 Documentação da API](./BACKEND_API_SPEC.md)
- [🎮 Sistema de Rodadas](./README_ROUNDS.md)
- [🏠 Página Inicial](./README.md)
- [🔗 Integração](./README_INTEGRACAO.md)

## 🤝 Contribuição

Para contribuir com a rodada zero:

1. **Fork** o repositório
2. **Crie** uma branch para sua feature
3. **Implemente** as mudanças
4. **Teste** localmente
5. **Submeta** um pull request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](../LICENSE) para mais detalhes.

---

**🎯 Rodada Zero implementada com sucesso!** 

A implementação segue todas as especificações da documentação e está pronta para uso em produção.
