import {
  Component, computed, signal, WritableSignal, AfterViewInit, OnInit, OnDestroy,
  inject, ChangeDetectionStrategy
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

import { RodadaService } from './rodada.service';
import { HomeService } from '../home/home.service';
import { RodadaApiService, RoomStatus, VoteResult, AvailableParticipants, Card } from './rodada-api.service';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

type Carta = { id: string; cor: Cor; texto: string; planeta?: string; };

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
export class RodadaComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly rodada = inject(RodadaService);
  private readonly home = inject(HomeService);
  private readonly router = inject(Router);
  readonly api = inject(RodadaApiService);

  readonly rodadaNumero = 1;

  // Header (expostos pelo service)
  roomCode = this.rodada.roomCode;
  timeLabel = this.rodada.timeLabel;
  progress = this.rodada.progress;
  session = this.rodada.session;

  // Status da sala
  private readonly _roomStatus = signal<RoomStatus | null>(null);
  roomStatus = this._roomStatus.asReadonly();

  // Participantes disponíveis
  private readonly _availableParticipants = signal<AvailableParticipants | null>(null);
  availableParticipants = this._availableParticipants.asReadonly();

  // Alvos derivados dos participantes disponíveis
  readonly alvos = computed(() => {
    const participants = this._availableParticipants();
    if (!participants) return [];
    
    return participants.participants.map(p => ({
      id: p.id,
      nome: p.name,
      envelope: this.getEnvelopeColor(p.envelope_choice)
    }));
  });

  // Mão do usuário (cartas fixas do frontend)
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

  // Participante atual
  private readonly _currentParticipant = signal<string | null>(null);
  currentParticipant = this._currentParticipant.asReadonly();

  // Controle de submissão
  isSubmitting = signal(false);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  /** Associações por alvo (máx. 1 carta) */
  assigned: Record<string, Carta[]> = {};

  // DnD lists
  readonly handListId = 'handList';
  readonly targetListId = (alvoId: string) => `target_${alvoId}`;
  connectedTo = computed(() => [this.handListId, ...this.alvos().map(a => this.targetListId(a.id))]);

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

    // Timer local
    this.rodada.init();

    // Conecta socket e carrega dados
    const code = this.roomCode();
    if (code) {
      this.api.connectSocket(code);
      this.setupSocketListeners();
      this.loadInitialData();
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
    for (const a of this.alvos()) this.ensureBucket(a.id);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.swiper?.destroy();
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
        <p><b>Planeta:</b> 🪐 ${this.escape(card.planeta || 'N/A')}</p>
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

    // --- API: Enviar voto para o servidor ---
    try {
      this.isSubmitting.set(true);
      const currentParticipantId = this._currentParticipant();
      if (!currentParticipantId) {
        this.toastError('Erro: Participante não identificado');
        return;
      }

             const result = await this.api.sendVote({
         roomCode: this.roomCode(),
         fromParticipantId: currentParticipantId,
         toParticipantId: alvo.id,
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

        // Recarregar participantes disponíveis
        await this.loadAvailableParticipants();

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

  private getEnvelopeColor(envelopeChoice?: string): Cor {
    const colorMap: { [key: string]: Cor } = {
      'azul': 'Azul',
      'amarelo': 'Amarelo',
      'verde': 'Verde',
      'laranja': 'Laranja',
      'vermelho': 'Vermelho',
      'roxo': 'Roxo'
    };
    return envelopeChoice ? colorMap[envelopeChoice.toLowerCase()] || 'Azul' : 'Azul';
  }

  private async loadInitialData(): Promise<void> {
    // Primeiro carregar o participante atual (do localStorage)
    await this.loadCurrentParticipant();
    
    // Depois carregar os outros dados que dependem do participante
    await Promise.all([
      this.loadAvailableParticipants(),
      this.loadRoomStatus()
    ]);
    this.ensureAllBuckets();
  }

  private async loadCurrentParticipant(): Promise<void> {
    // Buscar diretamente do HomeService (localStorage)
    const session = this.home.getSession();
    if (session) {
      this._currentParticipant.set(session.participantId);
    } else {
      console.warn('Sessão não encontrada no localStorage');
    }
  }

  private async loadAvailableParticipants(): Promise<void> {
    const code = this.roomCode();
    const participantId = this._currentParticipant();
    if (!code || !participantId) return;

    try {
      const result = await this.api.getAvailableParticipants(code, participantId);
      if (result.ok) {
        this._availableParticipants.set(result.data);
      } else {
        console.warn('Erro ao carregar participantes disponíveis:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar participantes disponíveis:', error);
    }
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
  }

  private handleStatusChange(status: RoomStatus): void {
    const currentStatus = status.status;
    
    // Se a sala foi finalizada, redirecionar para resultados
    if (currentStatus === 'finalizado') {
      this.redirectToResults();
    }
  }

  private async redirectToResults(): Promise<void> {
    // Fechar qualquer modal de SweetAlert que esteja aberto
    Swal.close();

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
}
