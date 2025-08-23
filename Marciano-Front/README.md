# 🚀 Marciano Front

<div align="center">

![Angular](https://img.shields.io/badge/Angular-20-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**Aplicação Angular para o jogo Marciano - Interface moderna e responsiva**

[Demo](#) • [Documentação](#documentação) • [API Spec](BACKEND_API_SPEC.md) • [Contribuir](#contribuição)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Desenvolvimento](#desenvolvimento)
- [Build e Deploy](#build-e-deploy)
- [Docker](#docker)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Páginas e Componentes](#páginas-e-componentes)
- [API e Backend](#api-e-backend)
- [Testes](#testes)
- [Deploy](#deploy)
- [Contribuição](#contribuição)
- [Licença](#licença)

---

## 🎯 Sobre o Projeto

O **Marciano Front** é uma aplicação web moderna desenvolvida em Angular 20 que oferece uma interface interativa para o jogo Marciano. O projeto utiliza tecnologias de ponta como Tailwind CSS para estilização, Socket.IO para comunicação em tempo real e Chart.js para visualização de dados.

### 🎮 O que é o Jogo Marciano?

O Marciano é um jogo multiplayer em tempo real onde os participantes competem em rodadas estratégicas. Os jogadores podem criar salas, convidar outros participantes e acompanhar resultados em tempo real através de uma interface moderna e intuitiva.

---

## ✨ Funcionalidades

### 🏠 **Página Inicial (Home)**
- ✅ Formulário de entrada na sala com validação
- ✅ Seleção de envelope personalizado
- ✅ Validação de código da sala
- ✅ Interface responsiva e moderna

### 🏗️ **Criação de Sala**
- ✅ Criação de salas personalizadas
- ✅ Configuração de parâmetros do jogo
- ✅ Geração automática de códigos únicos
- ✅ Gerenciamento de participantes

### 🏛️ **Lobby**
- ✅ Visualização de participantes em tempo real
- ✅ Sistema de status (conectado/pronto)
- ✅ Chat integrado (planejado)
- ✅ Controles de host

### 🎯 **Rodada Zero**
- ✅ Interface de preparação
- ✅ Swiper para navegação
- ✅ Visualização de cartas/planetas
- ✅ Sistema de seleção

### 🎮 **Rodada Principal**
- ✅ Interface de jogo em tempo real
- ✅ Timer visual
- ✅ Sistema de pontuação
- ✅ Feedback visual

### 📊 **Resultados**
- ✅ Gráficos interativos com Chart.js
- ✅ Estatísticas detalhadas
- ✅ Exportação para PDF
- ✅ Histórico de partidas

---

## 🛠️ Tecnologias

### **Frontend Core**
- **[Angular 20](https://angular.io/)** - Framework principal
- **[TypeScript 5.8](https://www.typescriptlang.org/)** - Linguagem de programação
- **[RxJS 7.8](https://rxjs.dev/)** - Programação reativa

### **Estilização e UI**
- **[Tailwind CSS 3.4](https://tailwindcss.com/)** - Framework CSS utilitário
- **[Angular CDK 20](https://material.angular.io/cdk)** - Componentes e utilitários
- **[Swiper 11](https://swiperjs.com/)** - Carrossel e navegação

### **Comunicação e Dados**
- **[Socket.IO Client 4.8](https://socket.io/)** - WebSocket em tempo real
- **[Chart.js 4.5](https://www.chartjs.org/)** - Gráficos e visualizações

### **Utilitários**
- **[SweetAlert2 11](https://sweetalert2.github.io/)** - Modais e alertas
- **[jsPDF 3.0](https://github.com/parallax/jsPDF)** - Geração de PDFs
- **[html2canvas](https://html2canvas.hertzen.com/)** - Captura de tela

### **Desenvolvimento**
- **[Angular CLI 20](https://cli.angular.io/)** - Ferramentas de desenvolvimento
- **[Karma](https://karma-runner.github.io/)** - Test runner
- **[Jasmine](https://jasmine.github.io/)** - Framework de testes
- **[Prettier](https://prettier.io/)** - Formatação de código

### **Deploy e Containerização**
- **[Docker](https://www.docker.com/)** - Containerização
- **[Nginx](https://nginx.org/)** - Servidor web
- **[Vercel](https://vercel.com/)** - Deploy automático

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** (versão 9 ou superior)
- **Angular CLI** (versão 20 ou superior)
- **Docker** (opcional, para containerização)

```bash
# Verificar versões
node --version
npm --version
ng version
docker --version
```

---

## 🚀 Instalação

### 1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/marciano-front.git
cd marciano-front/Marciano-Front
```

### 2. **Instale as dependências**
```bash
npm install
```

### 3. **Configure o ambiente**
```bash
# Copie o arquivo de configuração (se existir)
cp src/environments/environment.example.ts src/environments/environment.ts
```

### 4. **Execute o projeto**
```bash
npm start
```

A aplicação estará disponível em `http://localhost:4200`

---

## 💻 Desenvolvimento

### **Comandos Disponíveis**

```bash
# Desenvolvimento com proxy para API
npm start

# Build para produção
npm run build

# Executar testes
npm test

# Executar testes com watch
npm run test:watch

# Linting
npm run lint

# Formatação de código
npm run format
```

### **Estrutura de Scripts**

| Script | Comando | Descrição |
|--------|---------|-----------|
| `start` | `ng serve --proxy-config proxy.conf.json` | Inicia servidor de desenvolvimento |
| `build` | `ng build --configuration=production` | Build otimizado para produção |
| `test` | `ng test` | Executa testes unitários |
| `watch` | `ng build --watch --configuration development` | Build com watch mode |

### **Configuração do Proxy**

O projeto utiliza um proxy para comunicação com a API backend durante o desenvolvimento:

```json
{
  "/api": {
    "target": "https://qualidadesanimicas-production.up.railway.app",
    "secure": true,
    "changeOrigin": true
  },
  "/socket.io": {
    "target": "https://qualidadesanimicas-production.up.railway.app",
    "secure": true,
    "ws": true,
    "changeOrigin": true
  }
}
```

---

## 🏗️ Build e Deploy

### **Build Local**

```bash
# Build de produção
npm run build

# Arquivos gerados em: dist/Marciano-Front/browser/
```

### **Configurações de Build**

- **Orçamentos ajustados** para aplicações modernas
- **Otimização automática** de assets
- **Tree shaking** para redução de bundle
- **Lazy loading** de módulos

---

## 🐳 Docker

### **Build da Imagem**

```bash
# Construir imagem Docker
docker build -t marciano-front .
```

### **Executar Container**

```bash
# Executar em modo detached na porta 8080
docker run -d -p 8080:80 --name marciano-app marciano-front

# Acessar aplicação
open http://localhost:8080
```

### **Docker Compose (Recomendado)**

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
```

### **Arquivos Docker**

- **`Dockerfile`** - Multi-stage build com Node.js + Nginx
- **`nginx.conf`** - Configuração otimizada para SPA
- **`.dockerignore`** - Exclusões para build eficiente

---

## 📁 Estrutura do Projeto

```
Marciano-Front/
├── 📁 src/
│   ├── 📁 app/
│   │   ├── 📁 @shared/           # Recursos compartilhados
│   │   │   ├── 📁 interceptors/  # HTTP interceptors
│   │   │   ├── 📁 layout/        # Layout components
│   │   │   ├── 📁 services/      # Serviços globais
│   │   │   └── 📁 types/         # Tipos TypeScript
│   │   ├── 📁 pages/             # Páginas da aplicação
│   │   │   ├── 📁 criar-sala/    # Criação de sala
│   │   │   ├── 📁 home/          # Página inicial
│   │   │   ├── 📁 lobby/         # Lobby de espera
│   │   │   ├── 📁 resultados/    # Resultados e estatísticas
│   │   │   ├── 📁 rodada/        # Rodada principal
│   │   │   └── 📁 rodada-zero/   # Rodada de preparação
│   │   ├── app.component.ts      # Componente raiz
│   │   ├── app.config.ts         # Configuração da aplicação
│   │   └── app.routes.ts         # Roteamento
│   ├── 📁 environments/          # Configurações de ambiente
│   ├── 📁 public/                # Assets públicos
│   ├── index.html                # HTML principal
│   ├── main.ts                   # Bootstrap da aplicação
│   └── styles.scss               # Estilos globais
├── 📁 dist/                      # Build de produção
├── 📄 angular.json               # Configuração Angular
├── 📄 package.json               # Dependências e scripts
├── 📄 tailwind.config.js         # Configuração Tailwind
├── 📄 tsconfig.json              # Configuração TypeScript
├── 📄 Dockerfile                 # Configuração Docker
├── 📄 nginx.conf                 # Configuração Nginx
└── 📄 README.md                  # Este arquivo
```

---

## 📄 Páginas e Componentes

### **🏠 Home (`/`)**
- **Funcionalidade**: Entrada na sala de jogo
- **Componentes**: Formulário de entrada, seleção de envelope
- **Validações**: Código da sala, nome do participante

### **🏗️ Criar Sala (`/criar-sala`)**
- **Funcionalidade**: Criação e gerenciamento de salas
- **Componentes**: Formulário de criação, lista de salas
- **Features**: Geração de código, configurações avançadas

### **🏛️ Lobby (`/lobby/:roomCode`)**
- **Funcionalidade**: Sala de espera antes do jogo
- **Componentes**: Lista de participantes, controles de host
- **Real-time**: Atualizações via WebSocket

### **🎯 Rodada Zero (`/rodada-zero/:roomCode`)**
- **Funcionalidade**: Preparação para o jogo
- **Componentes**: Swiper de cartas, seleção de estratégia
- **Interação**: Interface touch-friendly

### **🎮 Rodada (`/rodada/:roomCode`)**
- **Funcionalidade**: Jogo principal
- **Componentes**: Timer, interface de jogo, pontuação
- **Real-time**: Sincronização em tempo real

### **📊 Resultados (`/resultados/:roomCode`)**
- **Funcionalidade**: Visualização de resultados
- **Componentes**: Gráficos Chart.js, estatísticas
- **Export**: Geração de PDF com jsPDF

---

## 🔌 API e Backend

### **Especificação da API**

A aplicação está preparada para integrar com uma API REST + WebSocket. Consulte o arquivo [`BACKEND_API_SPEC.md`](BACKEND_API_SPEC.md) para detalhes completos sobre:

- **Endpoints REST** para gerenciamento de salas e rodadas
- **Eventos WebSocket** para comunicação em tempo real
- **Estruturas de dados** e modelos
- **Códigos de status** e tratamento de erros

### **Serviços Frontend**

| Serviço | Responsabilidade |
|---------|------------------|
| `ApiService` | Comunicação HTTP com backend |
| `SocketService` | WebSocket e eventos em tempo real |
| `GameStateService` | Estado global do jogo |
| `AuthGuard` | Proteção de rotas |

### **Estado Atual**

✅ **Backend Real**: A aplicação está configurada para integrar com o backend em produção em `https://qualidadesanimicas-production.up.railway.app`.

**Configurações Atualizadas:**
- **API REST**: `/api/*` → `https://qualidadesanimicas-production.up.railway.app/api`
- **WebSocket**: `/socket.io/*` → `https://qualidadesanimicas-production.up.railway.app`
- **Proxy de Desenvolvimento**: Configurado para usar o backend de produção
- **HTTPS**: Configuração segura para produção

---

## 🧪 Testes

### **Executar Testes**

```bash
# Testes unitários
npm test

# Testes com coverage
npm run test:coverage

# Testes em modo watch
npm run test:watch
```

### **Estrutura de Testes**

- **Testes unitários** para todos os componentes
- **Testes de serviços** para lógica de negócio
- **Testes de integração** para fluxos completos
- **Mocks** para APIs e dependências externas

### **Ferramentas de Teste**

- **Karma** - Test runner
- **Jasmine** - Framework de testes
- **Angular Testing Utilities** - Utilitários específicos

---

## 🚀 Deploy

### **Vercel (Recomendado)**

O projeto está configurado para deploy automático na Vercel:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/Marciano-Front/browser",
  "installCommand": "npm ci",
  "framework": "angular"
}
```

**Configurações Vercel:**
- **Root Directory**: `Marciano-Front`
- **Install Command**: `npm ci`
- **Build Command**: `npm run build`
- **Output Directory**: `dist/Marciano-Front/browser`

### **Outras Plataformas**

#### **Netlify**
```bash
# Build command
npm run build

# Publish directory
dist/Marciano-Front/browser
```

#### **Firebase Hosting**
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Deploy
firebase deploy
```

#### **Docker Production**
```bash
# Build e deploy
docker build -t marciano-front .
docker run -d -p 80:80 marciano-front
```

---

## 🤝 Contribuição

### **Como Contribuir**

1. **Fork** o projeto
2. **Clone** seu fork
3. **Crie** uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
4. **Commit** suas mudanças (`git commit -m 'Add some AmazingFeature'`)
5. **Push** para a branch (`git push origin feature/AmazingFeature`)
6. **Abra** um Pull Request

### **Padrões de Código**

- **ESLint** para linting
- **Prettier** para formatação
- **Conventional Commits** para mensagens
- **Angular Style Guide** para estrutura

### **Antes de Contribuir**

```bash
# Executar linting
npm run lint

# Executar testes
npm test

# Verificar build
npm run build
```

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/marciano-front/issues)
- **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/marciano-front/discussions)
- **Email**: seu-email@exemplo.com

---

## 🙏 Agradecimentos

- **Angular Team** - Framework incrível
- **Tailwind CSS** - Estilização moderna
- **Socket.IO** - Comunicação em tempo real
- **Chart.js** - Visualizações de dados
- **Comunidade Open Source** - Inspiração e suporte

---

<div align="center">

**⭐ Se este projeto foi útil, considere dar uma estrela!**

**Feito com ❤️ e Angular**

</div>