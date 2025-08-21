# 🎮 Sistema de Rodadas - Jogo de Qualidades Anímicas

## 🚀 Funcionalidades Implementadas

### ✅ Sistema de Status das Salas
- **Lobby**: Aguardando participantes
- **Rodadas**: rodada_0, rodada_1, rodada_2, etc.
- **Finalizado**: Jogo concluído

### ✅ Controle de Rodadas pelo Facilitador
- Avançar manualmente para próxima rodada
- Número de rodadas = número de participantes
- Timer automático de 3 minutos por rodada

### ✅ Sistema de Votação Inteligente
- Cada participante vota em todos os outros (exceto em si)
- Sistema previne votos duplicados
- Controle automático de quem já recebeu voto

### ✅ Mapeamento de Cores para Planetas
- **Roxo** → **Lua**
- **Amarelo** → **Mercúrio**
- **Verde** → **Vênus**
- **Vermelho** → **Marte**
- **Laranja** → **Júpiter**
- **Azul** → **Saturno**

## 🔧 Instalação e Configuração

### 1. Atualizar Banco de Dados
```bash
cd backend
python update_database.py
```

### 2. Instalar Dependências
```bash
pip install -r requirements.txt
```

### 3. Executar Servidor
```bash
python -m uvicorn app.main:app --reload
```

## 📡 Endpoints da API

### 🔍 Status e Controle
```
GET    /rooms/{code}/status              # Status atual da sala
POST   /rooms/{code}/next-round          # Avançar rodada
GET    /rooms/{code}/check-timeout       # Verificar timeout
```

### 👥 Participantes e Votação
```
GET    /rooms/{code}/participants        # Listar participantes
GET    /rooms/{code}/available-participants/{id}  # Disponíveis para voto
POST   /rooms/{code}/vote                # Submeter voto
```

### 🃏 Cartas
```
GET    /rooms/{code}/cards               # Todas as cartas disponíveis
```

## 🎯 Como Usar

### 1. Criar Sala
```bash
POST /api/rooms
{
  "code": "ABC123",
  "title": "Minha Sala",
  "isAnonymous": true
}
```

### 2. Adicionar Participantes
```bash
POST /rooms/{room_id}/join
{
  "name": "João",
  "envelope_choice": "opcional"
}
```

### 3. Iniciar Jogo
```bash
POST /rooms/ABC123/next-round
```
**Resultado**: Sala vai de `lobby` para `rodada_0`

### 4. Verificar Status
```bash
GET /rooms/ABC123/status
```
**Retorna**:
```json
{
  "status": "rodada_0",
  "current_round": 0,
  "max_rounds": 4,
  "participants_count": 4,
  "round_progress": {...}
}
```

### 5. Ver Participantes Disponíveis para Voto
```bash
GET /rooms/ABC123/available-participants/1
```
**Retorna**: Lista de participantes que o participante 1 ainda não votou

### 6. Submeter Voto
```bash
POST /rooms/ABC123/vote
{
  "room_code": "ABC123",
  "from_participant": 1,
  "to_participant": 2,
  "card_id": 3
}
```

### 7. Avançar Rodada
```bash
POST /rooms/ABC123/next-round
```
**Resultado**: Vai para `rodada_1`, `rodada_2`, etc.

## 🧪 Testando o Sistema

### Script de Teste Automatizado
```bash
cd backend
python test_rounds.py
```

### Teste Manual via Swagger
1. Acesse: `http://localhost:8000/docs`
2. Teste os endpoints na interface interativa

## 📊 Estrutura do Banco de Dados

### Tabela `rooms`
- `id`: ID único da sala
- `code`: Código da sala (ex: ABC123)
- `title`: Título da sala
- `status`: Status atual (lobby, rodada_0, finalizado)
- `current_round`: Rodada atual
- `max_rounds`: Número máximo de rodadas
- `round_start_time`: Início da rodada atual

### Tabela `cards`
- `id`: ID único da carta
- `name`: Nome da qualidade
- `color`: Cor em hexadecimal
- `planet`: Planeta correspondente

### Tabela `votes`
- `id`: ID único do voto
- `room_id`: ID da sala
- `from_participant`: Quem votou
- `to_participant`: Quem recebeu o voto
- `card_id`: Qualidade votada
- `round_number`: Em qual rodada foi feito

## 🔄 Fluxo do Jogo

```
Lobby → Rodada 0 → Rodada 1 → ... → Rodada N → Finalizado
  ↓         ↓         ↓              ↓         ↓
Aguardando → Votação → Votação → ... → Votação → Relatório
```

## ⏱️ Controle de Tempo

- **Timer automático**: 3 minutos por rodada
- **Avanço manual**: Facilitador pode avançar antes do timeout
- **Verificação**: Endpoint `/check-timeout` para verificar expiração

## 🛡️ Validações de Segurança

- ✅ Participante não pode votar em si mesmo
- ✅ Voto único por participante (não duplicado)
- ✅ Sala deve estar em estado de rodada
- ✅ Participantes e cartas devem existir
- ✅ Controle de transações no banco

## 📝 Logs e Debugging

Todas as operações incluem logs detalhados:
- 🔍 Busca de dados
- ✅ Operações bem-sucedidas
- ❌ Erros e exceções
- 📊 Contadores e estatísticas

## 🚨 Tratamento de Erros

- **404**: Sala não encontrada
- **400**: Operação inválida (jogo não iniciado, voto duplicado)
- **500**: Erro interno do servidor
- Mensagens claras e descritivas

## 🔮 Próximos Passos

- [ ] Interface web para facilitador
- [ ] Timer visual em tempo real
- [ ] Notificações WebSocket
- [ ] Relatórios avançados
- [ ] Exportação de dados

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do servidor
2. Execute o script de teste
3. Consulte a documentação da API em `/docs`
4. Verifique a estrutura do banco de dados

---

**🎯 Sistema implementado e testado com sucesso!**
