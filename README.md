# Qualidades Anímicas

Projeto front-end em **Angular 20** com foco na criação de uma interface gamificada para uma dinâmica de grupo em que **cada participante associa uma carta (qualidade)** a **um alvo (outro participante)**. O escopo atual é **visual (mock UI)**, sem integrações de back-end.

---

## Objetivos

- Disponibilizar telas e fluxos de navegação para:
  - **Home** (entrada do participante)
  - **Lobby** (lista de participantes conectados)
  - **Rodada / Rodada** (associação carta → alvo)
  - **Resultados** (visualização agregada por cores)
- Prover uma base de UI consistente, acessível e responsiva, pronta para futura integração com API/tempo real.
- Manter código e estrutura alinhados ao ecossistema **Angular 20** (Standalone APIs, Signals, CLI).

---

## Escopo Funcional (UI)

- **Fluxo sem papel de facilitador**: apenas o participante.
- **Rodada**: para cada **alvo**, é possível **associar uma carta**; não é permitido votar em si mesmo.
- **Resultados**: exibição agregada por **cores** das cartas (sem pontuações).

> Observação: todas as interações são **mockadas**; os botões/links podem navegar entre rotas, mas não persistem dados.

---

## Stack Técnica

- **Angular 20** (Standalone Components, Angular CLI)
- **TypeScript** (ES2022+)
- **CSS utilitário** (ex.: Tailwind CSS) — opcional
- **Gerenciador de pacotes**: npm, pnpm ou yarn (à escolha da equipe)

---

## Requisitos

- **Node.js** 18 LTS ou superior
- **Angular CLI** 20.x
- Navegadores suportados: últimas versões estáveis de Chrome, Edge, Firefox e Safari

---

## Como Executar

1. Instale dependências:
   ```bash
   npm install
   ```

2. Ambiente de desenvolvimento:

   ```bash
   ng serve -o
   ```
3. Build de produção:

   ```bash
   ng build
   ```
4. Testes (se configurados):

   ```bash
   ng test       # unitários
   ng e2e        # ponta-a-ponta
   ```

---

## Estrutura Geral (alto nível)

src/
  app/
    pages/               # páginas/rotas (Home, Lobby, Rodada, Resultados)
    core/                # serviços, modelos e utilitários compartilhados
  assets/                # ícones, ilustrações, fontes
  index.html             # <base href="/">, metas globais
  styles.(css|scss)      # estilos globais (Tailwind opcional)


* **Rotas esperadas**: `/`, `/lobby`, `/rodada`, `/resultados`.
* Componentes **standalone** devem importar apenas o necessário (ex.: `RouterLink` para navegação).

---

## Convenções & Boas Práticas

* **Acessibilidade (a11y)**: foco visível, contraste adequado, semântica HTML, textos alternativos quando necessário.
* **Responsividade**: quebrar em colunas/grades progressivamente; evitar overflow horizontal.
* **Nomenclatura**: nomes descritivos para componentes e estilos; evitar abreviações obscuras.
* **Commits**: convencional (ex.: *Conventional Commits*) e PRs pequenos e objetivos.
* **Internacionalização**: textos centralizados e prontos para i18n em futuras iterações.

---

## Segurança & Privacidade (futuras integrações)

* Não registrar dados sensíveis no front-end.
* Sanitização e validação no cliente (defensiva), com validação autoritativa no back-end.
* Políticas de **CSP**, **XSS** e **CSRF** devem ser tratadas quando houver API real.

---

## Desempenho & Otimização

* Uso de **standalone components** e **lazy loading** para rotas pesadas (quando aplicável).
* Minificação/treeshaking via `ng build --configuration production`.
* Estratégias de pré-renderização/hidratação podem ser avaliadas futuramente.

---

## Roadmap (alto nível)

1. Estado leve (Signals) para seleção de alvos e cartas.
2. Integração com API/tempo real (ex.: WebSocket/SSE).
3. Persistência e autenticação dos participantes.
4. Resultados com base em dados reais (agregação por cor).
5. Testes unitários e e2e abrangentes.
6. Observabilidade (métricas de UX e logs não sensíveis).

---

## Licença

Definida pelo repositório da equipe (ex.: MIT, Apache-2.0). Adicionar arquivo `LICENSE` conforme decisão do projeto.

