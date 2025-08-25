# 🔐 Sistema de Login - Qualidades Anímicas

## Visão Geral

Este projeto agora possui um sistema de login falso implementado com SweetAlert2 que controla o acesso à tela de criar-sala e outras funcionalidades administrativas.

## 🚀 Como Funciona

### 1. **Credenciais Padrão**
O sistema vem com as seguintes credenciais pré-configuradas:

- **Usuário:** `admin` | **Senha:** `123456`
- **Usuário:** `marciano` | **Senha:** `2024`
- **Usuário:** `teste` | **Senha:** `teste123`

### 2. **Armazenamento Local**
- As credenciais são salvas no `localStorage` do navegador
- O sistema lembra do último usuário logado
- As credenciais persistem entre sessões do navegador

### 3. **Controle de Acesso**
- **Página Inicial (`/`)**: Acesso livre para todos
- **Criar Sala (`/criar-sala`)**: Requer autenticação
- **Lobby (`/lobby`)**: Requer autenticação + sessão completa
- **Rodadas**: Requer autenticação + sessão completa
- **Resultados**: Requer autenticação + sessão completa

## 🎯 Funcionalidades

### **Modal de Login**
- Interface amigável com SweetAlert2
- Validação de campos obrigatórios
- Mensagens de erro/sucesso
- Design responsivo

### **Header Atualizado**
- Mostra usuário logado
- Botão de logout
- Botão de login para usuários não autenticados
- Versão mobile otimizada

### **Proteção de Rotas**
- Guard de autenticação automático
- Redirecionamento para home se não autenticado
- Verificação dupla: login + sessão completa

## 🔧 Implementação Técnica

### **Arquivos Criados/Modificados**

1. **`auth.service.ts`** - Serviço principal de autenticação
2. **`auth.guard.ts`** - Guard de proteção de rotas
3. **`header.component.ts`** - Componente de cabeçalho atualizado
4. **`header.component.html`** - Template do cabeçalho
5. **`app.routes.ts`** - Rotas protegidas
6. **`app.component.ts`** - Inicialização do sistema
7. **`styles.scss`** - Estilos personalizados do SweetAlert

### **Estrutura do Serviço**

```typescript
export interface LoginCredentials {
  usuario: string;
  senha: string;
}

export class AuthService {
  // Métodos principais
  isAuthenticated(): boolean
  showLoginModal(): Promise<boolean>
  logout(): void
  getCurrentUser(): string | null
}
```

## 📱 Como Usar

### **Primeiro Acesso**
1. Acesse qualquer rota protegida (ex: `/criar-sala`)
2. O modal de login aparecerá automaticamente
3. Use uma das credenciais válidas
4. Clique em "Entrar"

### **Acessos Subsequentes**
- O sistema lembrará suas credenciais
- Acesso direto às funcionalidades protegidas
- Use o botão "Sair" no header para fazer logout

### **Trocar de Usuário**
1. Clique em "Sair" no header
2. Acesse uma rota protegida
3. Faça login com novas credenciais

## 🎨 Personalização

### **Adicionar Novas Credenciais**
Edite o método `validateCredentials()` no `auth.service.ts`:

```typescript
private validateCredentials(credentials: LoginCredentials): boolean {
  const validCredentials = [
    { usuario: 'admin', senha: '123456' },
    { usuario: 'marciano', senha: '2024' },
    { usuario: 'teste', senha: 'teste123' },
    // Adicione novas credenciais aqui
    { usuario: 'novo', senha: 'senha123' }
  ];
  // ... resto do código
}
```

### **Modificar Estilos do Modal**
Edite o arquivo `styles.scss` na seção de estilos do SweetAlert.

## 🔒 Segurança

⚠️ **Importante**: Este é um sistema de login **FALSO** para demonstração.

- **NÃO** implementa criptografia real
- **NÃO** valida credenciais no servidor
- **NÃO** é seguro para produção
- Usado apenas para controle de acesso básico na interface

## 🐛 Solução de Problemas

### **Modal não aparece**
- Verifique se o SweetAlert2 está instalado
- Confirme se não há erros no console do navegador

### **Credenciais não são salvas**
- Verifique se o localStorage está habilitado
- Confirme se não há bloqueios de privacidade

### **Rotas não são protegidas**
- Verifique se o `authGuard` está aplicado nas rotas
- Confirme se o serviço está sendo injetado corretamente

## 📝 Logs de Debug

O sistema registra logs no console para facilitar o debug:

- `🔐 Sistema de autenticação inicializado - usuário não autenticado`
- `✅ Usuário autenticado: [nome_do_usuario]`
- `✅ Todos os SweetAlerts foram fechados com sucesso`

## 🚀 Próximos Passos

Para um sistema de produção, considere:

1. **Backend real** com API de autenticação
2. **JWT tokens** para sessões seguras
3. **Criptografia** de senhas
4. **Rate limiting** para tentativas de login
5. **Logs de auditoria** para acessos
6. **Recuperação de senha** por email
7. **Autenticação de dois fatores**

---

**Desenvolvido para o projeto Qualidades Anímicas** 🎯
