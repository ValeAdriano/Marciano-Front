import {
  Component, computed, signal, WritableSignal, AfterViewInit, OnInit,
  inject, ChangeDetectionStrategy, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  DragDropModule, CdkDragDrop, transferArrayItem, CdkDragStart, CdkDragEnd
} from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

// Swiper core + CSS
import Swiper from 'swiper';
import 'swiper/css';
import { Mousewheel, Keyboard, FreeMode } from 'swiper/modules';

import { RodadaService } from '../rodada/rodada.service';
import { HomeService } from '../home/home.service';
import { RodadaZeroApiService, RoomStatus, VoteResult } from './rodada-zero.service';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';
type Carta = { id: string; cor: Cor; texto: string; planeta?: string; };

type Alvo = {
  id: string;
  nome: string;
  envelope?: Cor;
  envelopeHex?: string;
  isSelf?: boolean;
};

@Component({
  selector: 'app-rodada-zero',
  imports: [CommonModule, DragDropModule],
  templateUrl: './rodada-zero.html',
  styleUrl: './rodada-zero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block uno' },
})
export class RodadaZeroComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly rodada = inject(RodadaService);
  private readonly home = inject(HomeService);
  private readonly router = inject(Router);
  readonly api = inject(RodadaZeroApiService);

  readonly rodadaNumero = 0;

  // Header (signals do serviço existente)
  roomCode = this.rodada.roomCode;
  timeLabel = this.rodada.timeLabel;
  progress = this.rodada.progress;
  session = this.rodada.session;

  // Status da sala
  private readonly _roomStatus = signal<RoomStatus | null>(null);
  roomStatus = this._roomStatus.asReadonly();

  // Alvo único: o próprio usuário
  private readonly _alvos = signal<Alvo[]>([]);
  alvos = this._alvos.asReadonly();

  // Mão do usuário
  hand: WritableSignal<Carta[]> = signal<Carta[]>([
    { id: 'lar-1', cor: 'Laranja',  texto: 'Tem pensamento estratégico e visão do todo', planeta: 'Marte' },
    { id: 'lar-2', cor: 'Laranja',  texto: 'É bom em planejar e organizar', planeta: 'Marte' },
    { id: 'ver-1', cor: 'Verde',    texto: 'Preserva a harmonia no ambiente de trabalho', planeta: 'Vênus' },
    { id: 'ver-2', cor: 'Verde',    texto: 'Dá grande atenção ao bem estar da pessoa', planeta: 'Vênus' },
    { id: 'ama-1', cor: 'Amarelo',  texto: 'É ágil, flexível e aberto a mudanças', planeta: 'Mercúrio' },
    { id: 'ama-2', cor: 'Amarelo',  texto: 'Traz as novas ideias e ajuda a empresa a inovar', planeta: 'Mercúrio' },
    { id: 'az-1',  cor: 'Azul',     texto: 'Ajuda a empresa e as equipes a manter o foco', planeta: 'Saturno' },
    { id: 'az-2',  cor: 'Azul',     texto: 'Alinha os temas com profundidade e senso crítico', planeta: 'Saturno' },
    { id: 'vermelho-1', cor: 'Vermelho', texto: 'Toma a iniciativa e faz acontecer', planeta: 'Júpiter' },
    { id: 'vermelho-2', cor: 'Vermelho', texto: 'É prático e focado na ação e nos resultados', planeta: 'Júpiter' },
    { id: 'roxo-1', cor: 'Roxo',    texto: 'Avalia o passado para melhorar as suas práticas', planeta: 'Urano' },
    { id: 'roxo-2', cor: 'Roxo',    texto: 'Acompanha e monitora ações e resultados', planeta: 'Urano' },
  ]);

  /** Associações por alvo (máx. 1 carta) */
  assigned: Record<string, Carta[]> = {};

  // DnD lists
  readonly handListId = 'handList';
  readonly targetListId = (alvoId: string) => `target_${alvoId}`;
  connectedTo = computed(() => [this.handListId, ...this.alvos().map(a => this.targetListId(a.id))]);

  // Paleta (coesa com tokens)
  readonly colorHex: Record<Cor, string> = {
    Azul: '#0067b1',
    Amarelo: '#ecc500',
    Verde: '#75b463',
    Laranja: '#f97316',
    Vermelho: '#ef4444',
    Roxo: '#7c3aed',
  };

  private swiper?: Swiper;
  selectedCardId = signal<string | null>(null);
  draggingCardId = signal<string | null>(null);
  isSubmitting = signal(false);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    if (!this.home.getSession()) {
      this.router.navigateByUrl('/');
      return;
    }

    // Alvo único: "Você"
    const self: Alvo = {
      id: '_self',
      nome: this.session()?.name || 'Você',
      envelopeHex: this.session()?.envelopeHex || '#0067b1',
      isSelf: true,
    };

    this._alvos.set([self]);
    this.ensureAllBuckets();

    // Timer local
    this.rodada.init();

    // Conecta socket (por roomCode)
    const code = this.roomCode();
    if (code) {
      this.api.connectSocket(code);
      this.setupSocketListeners();
      this.loadRoomStatus();
    }
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
      breakpoints: { 0:{spaceBetween:12}, 640:{spaceBetween:14}, 1024:{spaceBetween:16} },
      observer: true, observeParents: true, observeSlideChildren: true,
      on: { afterInit: (sw) => sw.update(), resize: (sw) => sw.update(), observerUpdate: (sw) => sw.update() },
    });

    queueMicrotask(() => this.swiper?.update());
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.swiper?.destroy();
  }

  private setupSocketListeners(): void {
    // Escutar eventos de status da sala
    this.subscriptions.push(
      this.api.socketEvents$.subscribe(event => {
        switch (event.type) {
          case 'room:status':
            this._roomStatus.set(event.status);
            this.handleStatusChange(event.status);
            break;
          case 'vote:progress':
            this.handleVoteProgress(event.progress);
            break;
          case 'round:finished':
            this.handleRoundFinished();
            break;
          case 'results:ready':
            this.handleResultsReady();
            break;
        }
      })
    );

    // Configurar polling para verificar mudanças de status (fallback)
    this.setupStatusPolling();
  }

  private async loadRoomStatus(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;

    try {
      const result = await this.api.getRoomStatus(code);
      if (result.ok) {
        this._roomStatus.set(result.data);
        this.handleStatusChange(result.data);
      } else {
        console.warn('Erro ao carregar status da sala:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar status da sala:', error);
    }
  }

  private handleStatusChange(status: RoomStatus): void {
    const currentStatus = status.status;
    
    // Se não estiver mais na rodada_0, redirecionar para o componente rodada
    if (currentStatus !== 'rodada_0' && currentStatus !== 'lobby') {
      this.redirectToNextRound(currentStatus);
    }
  }

  private async redirectToNextRound(status: string): Promise<void> {
    // Fechar qualquer modal de SweetAlert que esteja aberto
    Swal.close();

    if (status === 'finalizado') {
      // Se a sala foi finalizada, redirecionar para resultados
      await Swal.fire({
        title: 'Sala Finalizada!',
        text: 'Redirecionando para os resultados...',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        timer: 2000,
      });
      this.router.navigate(['/resultados']);
    } else if (status.startsWith('rodada_')) {
      // Se mudou para qualquer rodada (rodada_1, rodada_2, etc.), redirecionar para o componente rodada
      const roundNumber = status.replace('rodada_', '');
      await Swal.fire({
        title: 'Próxima Rodada Iniciada!',
        text: `Redirecionando para a Rodada ${roundNumber}...`,
        icon: 'success',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        timer: 2000,
      });
      // Redirecionar para o componente rodada
      this.router.navigate(['/rodada']);
    }
  }

  private handleVoteProgress(progress: number): void {
    // Atualizar progresso da votação
    console.log('Progresso da votação:', progress);
  }

  private handleRoundFinished(): void {
    // Rodada terminou, mostrar mensagem
    Swal.fire({
      title: 'Rodada Finalizada!',
      text: 'Aguarde o próximo passo.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: 3000,
    });
  }

  private handleResultsReady(): void {
    // Resultados estão prontos, redirecionar
    Swal.fire({
      title: 'Resultados Prontos!',
      text: 'Redirecionando para os resultados...',
      icon: 'success',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: 2000,
    }).then(() => {
      // Redirecionar para resultados
      this.router.navigate(['/resultados']);
    });
  }

  private setupStatusPolling(): void {
    // Verificar status da sala a cada 5 segundos como fallback
    const pollInterval = setInterval(async () => {
      const code = this.roomCode();
      if (!code) return;

      try {
        const result = await this.api.getRoomStatus(code);
        if (result.ok) {
          const currentStatus = this._roomStatus()?.status;
          const newStatus = result.data.status;
          
          // Se o status mudou, atualizar e verificar redirecionamento
          if (currentStatus !== newStatus) {
            this._roomStatus.set(result.data);
            this.handleStatusChange(result.data);
          }
        }
      } catch (error) {
        console.warn('Erro no polling de status:', error);
      }
    }, 5000);

    // Limpar o intervalo quando o componente for destruído
    this.subscriptions.push(new Subscription(() => clearInterval(pollInterval)));
  }

  // Utils
  private ensureBucket(alvoId: string): Carta[] {
    if (!this.assigned[alvoId]) this.assigned[alvoId] = [];
    return this.assigned[alvoId];
  }
  private ensureAllBuckets(): void {
    for (const a of this.alvos()) this.ensureBucket(a.id);
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

  /** Só aceita drop no próprio alvo e apenas uma carta */
  canEnterTarget = (alvoId: string) => () => this.ensureBucket(alvoId).length === 0;

  async onDropToTarget(event: CdkDragDrop<Carta[]>, alvo: Alvo) {
    const destinoId = this.targetListId(alvo.id);
    if (event.previousContainer.id !== this.handListId || event.container.id !== destinoId) return;

    const card = event.previousContainer.data[event.previousIndex];
    if (!card) return;

    if (!this.selectedCardId() || this.selectedCardId() !== card.id) {
      this.toastInfo('Clique na carta antes de arrastar para o seu alvo.');
      return;
    }

    const bucket = this.ensureBucket(alvo.id);
    if (bucket.length > 0) {
      this.toastInfo('Você já escolheu sua carta nesta rodada.');
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
        <p><b>Planeta:</b> 🪐 ${this.escape(card.planeta || 'N/A')}</p>
       </div>`;

    const confirm = await Swal.fire({
      title: 'Confirmar sua autoavaliação?',
      html: resumoHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    // --- API: userID vem do back via /rooms/{code}/me ---
    try {
      this.isSubmitting.set(true);
      
      const roomCode = this.roomCode();
      console.log('Dados da sessão:', this.home.getSession());
      console.log('RoomCode:', roomCode);
      console.log('Carta selecionada:', card);
      
      const result = await this.api.sendSelfVote({
        roomCode: roomCode,
        cardColor: card.cor.toLowerCase(),
        cardDescription: card.texto,
      });

      if (result.ok) {
        // Sucesso - transferir carta
        transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, 0);
        this.hand.set([...this.hand()]);
        this.assigned[alvo.id] = [...this.ensureBucket(alvo.id)];

        this.selectedCardId.set(null);
        this.draggingCardId.set(null);
        this.swiper?.update();

        await Swal.fire({
          title: 'Autoavaliação registrada',
          html: 'Aguarde o próximo passo.<br>Esta janela fechará quando a próxima etapa começar.',
          icon: 'success',
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
        });
      } else {
        this.toastError(`Erro ao registrar voto: ${result.error}`);
      }
    } catch (error) {
      this.toastInfo('Não foi possível registrar no servidor (offline?). Sua seleção será mantida localmente.');
    } finally {
      this.isSubmitting.set(false);
    }
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

  private toastError(msg: string) {
    void Swal.fire({ toast: true, position: 'top', icon: 'error', title: msg, timer: 3000, showConfirmButton: false });
  }

  private escape(s: string) {
    const d = document.createElement('div'); d.innerText = s; return d.innerHTML;
  }

  getStatusDisplay(status: string | undefined): string {
    if (!status) return 'Carregando...';
    
    const statusMap: { [key: string]: string } = {
      'lobby': '🔄 Lobby',
      'rodada_0': '🎯 Rodada 0 - Autoavaliação',
      'rodada_1': '🎯 Rodada 1 - Votação',
      'rodada_2': '🎯 Rodada 2 - Votação',
      'finalizado': '🏁 Finalizado'
    };
    return statusMap[status] || status;
  }
}
