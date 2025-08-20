import {
  Component, computed, signal, WritableSignal, AfterViewInit, OnInit,
  inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  DragDropModule, CdkDragDrop, transferArrayItem, CdkDragStart, CdkDragEnd
} from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';

// Swiper core + CSS
import Swiper from 'swiper';
import 'swiper/css';
import { Mousewheel, Keyboard, FreeMode } from 'swiper/modules';

import { RodadaService } from './rodada.service';
import { HomeService } from '../home/home.service';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

type Carta = { id: string; cor: Cor; texto: string; };

type Alvo = {
  id: string;
  nome: string;
  envelope: Cor;  // usado para cor do avatar
};

@Component({
  selector: 'app-rodada',
  standalone: true,
  imports: [CommonModule, RouterLink, DragDropModule],
  templateUrl: './rodada.html',
  styleUrl: './rodada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RodadaComponent implements AfterViewInit, OnInit {
  private readonly rodada = inject(RodadaService);
  private readonly home = inject(HomeService);
  private readonly router = inject(Router);

  readonly rodadaNumero = 1;

  // Header (expostos pelo service)
  roomCode = this.rodada.roomCode;
  timeLabel = this.rodada.timeLabel;
  progress = this.rodada.progress;
  session = this.rodada.session;

  // Alvos (participantes de destino) — mocks por enquanto
  readonly alvos: Alvo[] = [
    { id: 'joao',    nome: 'João Pereira',   envelope: 'Azul'     },
    { id: 'maria',   nome: 'Maria Silva',    envelope: 'Verde'    },
    { id: 'camila',  nome: 'Camila Rocha',   envelope: 'Amarelo'  },
    { id: 'lucas',   nome: 'Lucas Alves',    envelope: 'Azul'     },
    { id: 'ana',     nome: 'Ana Costa',      envelope: 'Laranja'  },
    { id: 'pedro',   nome: 'Pedro Ramos',    envelope: 'Vermelho' },
    { id: 'juliana', nome: 'Juliana Melo',   envelope: 'Roxo'     },
    { id: 'felipe',  nome: 'Felipe Souza',   envelope: 'Verde'    },
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

  /** Associações por alvo (máx. 1 carta) */
  assigned: Record<string, Carta[]> = {};

  // DnD lists
  readonly handListId = 'handList';
  readonly targetListId = (alvoId: string) => `target_${alvoId}`;
  connectedTo = computed(() => [this.handListId, ...this.alvos.map(a => this.targetListId(a.id))]);

  // Paleta (alinha com tokens do design system)
  readonly colorHex: Record<Cor, string> = {
    Azul: '#0091ff',
    Amarelo: '#ffd600',
    Verde: '#22c55e',
    Laranja: '#ff8800',
    Vermelho: '#ff2d2d',
    Roxo: '#a259ff',
  };

  // Swiper
  private swiper?: Swiper;

  // Controle: carta “levantada” e arraste
  selectedCardId = signal<string | null>(null);
  draggingCardId = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.home.getSession()) {
      this.router.navigateByUrl('/');
      return;
    }
    this.ensureAllBuckets();
    this.rodada.init(); // inicia timer e expõe sessão
  }

  ngAfterViewInit(): void {
    const el = document.querySelector('.mao-swiper') as HTMLElement | null;
    if (!el) return;

    this.swiper = new Swiper(el, {
      modules: [Mousewheel, Keyboard, FreeMode],
      freeMode: false,
      slidesPerView: 'auto',
      slidesPerGroup: 1,
      centeredSlides: false,
      centeredSlidesBounds: true,
      speed: 320,
      resistanceRatio: 0.85,
      threshold: 6,
      allowTouchMove: true,
      simulateTouch: true,
      grabCursor: true,
      noSwiping: true,
      noSwipingClass: 'no-swipe',
      touchStartPreventDefault: false,
      passiveListeners: false,
      mousewheel: { forceToAxis: true, sensitivity: 0.6, releaseOnEdges: true },
      keyboard: { enabled: true },
      watchSlidesProgress: true,
      updateOnWindowResize: true,
      breakpoints: { 0:{spaceBetween:12}, 640:{spaceBetween:14}, 1024:{spaceBetween:16} },
      observer: true, observeParents: true, observeSlideChildren: true,
      on: { afterInit: (sw) => sw.update(), resize: (sw) => sw.update(), observerUpdate: (sw) => sw.update() },
    });

    queueMicrotask(() => this.swiper?.update());
  }

  // Utils
  private ensureBucket(alvoId: string): Carta[] {
    if (!this.assigned[alvoId]) this.assigned[alvoId] = [];
    return this.assigned[alvoId];
  }
  private ensureAllBuckets(): void {
    for (const a of this.alvos) this.ensureBucket(a.id);
  }

  onCardClick(id: string) {
    this.selectedCardId.update(curr => (curr === id ? null : id));
  }
  canDrag = (id: string) => this.selectedCardId() === id;

  onDragStarted(ev: CdkDragStart<Carta>) {
    const id = ev.source.data?.id;
    if (!id || !this.canDrag(id)) {
      this.toastInfo('Clique na carta para habilitar o arraste.');
      this.selectedCardId.set(id ?? null);
    }
    this.draggingCardId.set(id ?? null);
  }
  onDragEnded(_: CdkDragEnd<Carta>) {
    this.draggingCardId.set(null);
  }

  canEnterTarget = (alvoId: string) => () => this.ensureBucket(alvoId).length === 0;

  async onDropToTarget(event: CdkDragDrop<Carta[]>, alvo: Alvo) {
    const destinoId = this.targetListId(alvo.id);
    if (event.previousContainer.id !== this.handListId || event.container.id !== destinoId) return;

    const card = event.previousContainer.data[event.previousIndex];
    if (!card) return;

    if (!this.selectedCardId() || this.selectedCardId() !== card.id) {
      this.toastInfo('Clique na carta antes de arrastar para um alvo.');
      return;
    }

    const bucket = this.ensureBucket(alvo.id);
    if (bucket.length > 0) {
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

    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, 0);

    this.hand.set([...this.hand()]);
    this.assigned[alvo.id] = [...this.ensureBucket(alvo.id)];

    this.selectedCardId.set(null);
    this.draggingCardId.set(null);
    this.swiper?.update();

    await Swal.fire({
      title: 'Voto registrado',
      html: 'Aguarde os demais participantes.<br>Esta janela fechará quando a próxima rodada começar.',
      icon: 'success',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  removerDoAlvo(alvoId: string, idx = 0) {
    const bucket = this.ensureBucket(alvoId);
    const carta = bucket[idx];
    if (!carta) return;

    this.hand.update(arr => [carta, ...arr]);
    bucket.splice(idx, 1);
    this.assigned[alvoId] = [...bucket];
    this.swiper?.update();
  }

  trackById = (_: number, item: { id: string }) => item.id;

  private toastInfo(msg: string) {
    void Swal.fire({ toast: true, position: 'top', icon: 'info', title: msg, timer: 1600, showConfirmButton: false });
  }
  private escape(s: string) {
    const d = document.createElement('div'); d.innerText = s; return d.innerHTML;
  }
}
