import { Component, computed, signal, WritableSignal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, transferArrayItem, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';

// Swiper core + CSS (sem navegação/paginação)
import Swiper from 'swiper';
import 'swiper/css';

// Módulos do Swiper
import { Mousewheel, Keyboard, FreeMode } from 'swiper/modules';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

type Carta = {
  id: string;
  cor: Cor;
  texto: string;
};

type Alvo = {
  id: string;
  nome: string;
  envelope: Cor;
  iniciais: string;
};

@Component({
  selector: 'app-rodada',
  standalone: true,
  imports: [CommonModule, RouterLink, DragDropModule],
  templateUrl: './rodada.html',
  styleUrl: './rodada.scss',
})
export class RodadaComponent implements AfterViewInit {
  readonly rodadaNumero = 1;

  // Alvos na mesa (exemplo)
  readonly alvos: Alvo[] = [
    { id: 'joao',   nome: 'João Pereira',  envelope: 'Azul',     iniciais: 'JP' },
    { id: 'maria',  nome: 'Maria Silva',   envelope: 'Verde',    iniciais: 'MS' },
    { id: 'camila', nome: 'Camila Rocha',  envelope: 'Amarelo',  iniciais: 'CR' },
    { id: 'lucas',  nome: 'Lucas Alves',   envelope: 'Azul',     iniciais: 'LA' },
  ];

  // Mão do usuário
  hand: WritableSignal<Carta[]> = signal<Carta[]>([
    { id: 'lar-1', cor: 'Laranja',  texto: 'Tem pensamento estratégico e visão do todo' },
    { id: 'lar-2', cor: 'Laranja',  texto: 'É bom em planejar e organizar' },
    { id: 'ver-1', cor: 'Verde',    texto: 'Preserva a harmonia no ambiente de trabalho' },
    { id: 'ver-2', cor: 'Verde',    texto: 'Dá grande atenção ao bem estar da pessoa' },
    { id: 'ama-1', cor: 'Amarelo',  texto: 'É ágil, flexível e aberto a mudanças' },
    { id: 'ama-2', cor: 'Amarelo',  texto: 'Traz as novas ideias e ajuda a empresa a inovar' },
    { id: 'az-1',  cor: 'Azul',     texto: 'Ajuda a empresa e as equipes a manter o foco' },
    { id: 'az-2',  cor: 'Azul',     texto: 'Alinha os temas com profundidade e senso crítico' },
    { id: 'vermelho-1', cor: 'Vermelho', texto: 'Toma a iniciativa e faz acontecer' },
    { id: 'vermelho-2', cor: 'Vermelho', texto: 'É prático e focado na ação e nos resultados' },
    { id: 'roxo-1', cor: 'Roxo',    texto: 'Avalia o passado para melhorar as suas práticas' },
    { id: 'roxo-2', cor: 'Roxo',    texto: 'Acompanha e monitora ações e resultados' },
  ]);

  // Cada alvo aceita no máx. 1 carta
  assigned: Record<string, Carta[]> = {
    joao:   [],
    maria:  [],
    camila: [],
    lucas:  [],
  };

  // IDs de listas do CDK
  readonly handListId = 'handList';
  readonly targetListId = (alvoId: string) => `target_${alvoId}`;

  // Conexões de drop
  connectedTo = computed(() => [this.handListId, ...this.alvos.map(a => this.targetListId(a.id))]);

  // Paleta
  readonly colorHex: Record<Cor, string> = {
    Azul: '#2563eb',
    Amarelo: '#eab308',
    Verde: '#22c55e',
    Laranja: '#f97316',
    Vermelho: '#ef4444',
    Roxo: '#7c3aed',
  };

  // Swiper
  private swiper?: Swiper;

  // Controle: carta “levantada” (selecionada) e carta em arraste
  selectedCardId = signal<string | null>(null);
  draggingCardId = signal<string | null>(null);

ngAfterViewInit(): void {
  const el = document.querySelector('.mao-swiper') as HTMLElement | null;
  if (!el) return;

  this.swiper = new Swiper(el, {
    modules: [Mousewheel, Keyboard, FreeMode], // FreeMode pode ficar, mas desativado
    // Snap por slide (sem rolagem livre)
    freeMode: false,
    slidesPerView: 'auto',          // largura dos cards controla o layout
    slidesPerGroup: 1,              // mover 1 por vez
    centeredSlides: false,          // não força centralização
    centeredSlidesBounds: true,     // respeita limites ao iniciar/terminar
    speed: 320,
    resistanceRatio: 0.85,
    threshold: 6,                   // evita toques muito curtos dispararem slide

    // interação geral
    allowTouchMove: true,
    simulateTouch: true,
    grabCursor: true,

    // evitar conflito com drag do CDK quando a carta está “levantada”
    noSwiping: true,
    noSwipingClass: 'no-swipe',
    touchStartPreventDefault: false,
    passiveListeners: false,

    // entrada extra
    mousewheel: { forceToAxis: true, sensitivity: 0.6, releaseOnEdges: true },
    keyboard: { enabled: true },

    // responsividade
    watchSlidesProgress: true,
    updateOnWindowResize: true,
    breakpoints: {
      0:    { spaceBetween: 12 },
      640:  { spaceBetween: 14 },
      1024: { spaceBetween: 16 },
    },

    // observar mudanças na mão (DOM)
    observer: true,
    observeParents: true,
    observeSlideChildren: true,

    on: {
      afterInit: (sw) => sw.update(),
      resize:    (sw) => sw.update(),
      observerUpdate: (sw) => sw.update(),
      // roda a roda do mouse “um por vez”
      slideChange: () => {/* hook opcional se quiser side-effects */}
    },
  });

  queueMicrotask(() => this.swiper?.update());
}



  // Clique na carta: alterna “levantar/abaixar” e habilita drag-to-target
  onCardClick(id: string) {
    this.selectedCardId.update(curr => (curr === id ? null : id));
  }

  // Permite arrastar somente se a carta estiver selecionada
  canDrag = (id: string) => this.selectedCardId() === id;

  // Eventos de arraste (opcional, para UI/estilos)
  onDragStarted(ev: CdkDragStart<Carta>) {
    const id = ev.source.data?.id;
    // Se o usuário tentou arrastar sem clicar antes, interrompe
    if (!id || !this.canDrag(id)) {
      // Força cancelamento visual: solta imediatamente
      // O CDK não possui "cancel()", então apenas não deixamos prosseguir
      // e mostramos um aviso sutil.
      this.toastInfo('Clique na carta para habilitar o arraste.');
      // Como fallback, marcamos e já liberamos para esta interação:
      // (se você NÃO quiser esse comportamento, remova as 2 linhas abaixo)
      this.selectedCardId.set(id ?? null);
    }
    this.draggingCardId.set(id ?? null);
  }

  onDragEnded(_: CdkDragEnd<Carta>) {
    this.draggingCardId.set(null);
  }

  // Predicate: só aceita se alvo estiver vazio
  canEnterTarget = (alvoId: string) => () => this.assigned[alvoId].length === 0;

  // Drop mão -> alvo (somente se a carta dropada for a selecionada)
  async onDropToTarget(event: CdkDragDrop<Carta[]>, alvo: Alvo) {
    const destinoId = this.targetListId(alvo.id);
    if (event.previousContainer.id !== this.handListId || event.container.id !== destinoId) return;

    const card = event.previousContainer.data[event.previousIndex];
    if (!card) return;

    // Garante regra: precisa ter clicado antes (selecionada) e ser a mesma carta
    if (!this.selectedCardId() || this.selectedCardId() !== card.id) {
      this.toastInfo('Clique na carta antes de arrastar para um alvo.');
      return;
    }

    // Também impede se o alvo já está ocupado
    if (this.assigned[alvo.id].length > 0) {
      this.toastInfo('Este alvo já possui uma carta associada.');
      return;
    }

    const resumoHtml =
      `<div style="text-align:left">
        <p><b>Alvo:</b> ${this.escape(alvo.nome)}</p>
        <p><b>Carta:</b> ${this.escape(card.texto)}</p>
        <p><b>Cor:</b>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:6px;background:${this.colorHex[card.cor]}"></span>
          ${this.escape(card.cor)}
        </p>
       </div>`;

    const confirm = await Swal.fire({
      title: 'Confirmar voto?',
      html: resumoHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      0
    );

    // Atualiza sinais/UI
    this.hand.set([...this.hand()]);
    this.assigned[alvo.id] = [...this.assigned[alvo.id]];
    this.selectedCardId.set(null);      // deseleciona após associar
    this.draggingCardId.set(null);      // limpa estado de arraste
    this.swiper?.update();

    await Swal.fire({
      title: 'Voto registrado',
      html: 'Aguarde os demais participantes.<br>Esta janela fechará quando a próxima rodada começar.',
      icon: 'success',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
        // this.socket.on('proxima-rodada', () => Swal.close());
      }
    });
  }

  // Desfazer associação (volta carta pra mão)
  removerDoAlvo(alvoId: string, idx = 0) {
    const carta = this.assigned[alvoId][idx];
    if (!carta) return;

    this.hand.update(arr => [carta, ...arr]);
    this.assigned[alvoId].splice(idx, 1);
    this.assigned[alvoId] = [...this.assigned[alvoId]];
    this.swiper?.update();
  }

  trackById = (_: number, item: { id: string }) => item.id;

  private toastInfo(msg: string) {
    void Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: msg,
      timer: 1600,
      showConfirmButton: false,
    });
  }

  private escape(s: string) {
    const d = document.createElement('div');
    d.innerText = s;
    return d.innerHTML;
  }
}
