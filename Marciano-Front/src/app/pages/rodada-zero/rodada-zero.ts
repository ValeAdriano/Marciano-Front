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
import { NavigationService } from '../../@shared/services/navigation.service';
import { VoteStateService } from '../../@shared/services/vote-state.service';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';
type Carta = { id: string; cor: Cor; texto: string; };

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
  private readonly navigation = inject(NavigationService);
  private readonly voteState = inject(VoteStateService);

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
    { id: 'lar-1', cor: 'Laranja',  texto: 'Tem pensamento estratégico e visão do todo' },
    { id: 'lar-2', cor: 'Laranja',  texto: 'É bom em planejar e organizar' },
    { id: 'ver-1', cor: 'Verde',    texto: 'Preserva a harmonia no ambiente de trabalho' },
    { id: 'ver-2', cor: 'Verde',    texto: 'Dá grande atenção ao bem estar da pessoa' },
    { id: 'ama-1', cor: 'Amarelo',  texto: 'É ágil, flexível e aberto a mudanças' },
    { id: 'ama-2', cor: 'Amarelo',  texto: 'Traz as novas ideias e ajuda a empresa a inovar' },
    { id: 'rox-1', cor: 'Roxo',    texto: 'É criativo e tem intuição aguçada' },
    { id: 'rox-2', cor: 'Roxo',    texto: 'Consegue ver além do óbvio' },
    { id: 'ver-3', cor: 'Vermelho', texto: 'É determinado e focado em resultados' },
    { id: 'ver-4', cor: 'Vermelho', texto: 'Toma decisões rápidas quando necessário' },
    { id: 'azu-1', cor: 'Azul',     texto: 'É analítico e baseia decisões em dados' },
    { id: 'azu-2', cor: 'Azul',     texto: 'Mantém a calma em situações de pressão' }
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
      
      // VERIFICAÇÃO CRÍTICA: Verificar se já votou nesta rodada
      this.checkLastVote();
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
    console.log('🎧 Configurando listeners do socket...');
    
    // Escutar eventos de status da sala
    this.subscriptions.push(
      this.api.socketEvents$.subscribe(event => {
        console.log('📡 Evento recebido via socket:', event);
        
        switch (event.type) {
          case 'room:status':
            console.log('🔄 Processando room:status:', event.status);
            this._roomStatus.set(event.status);
            this.handleStatusChange(event.status);
            break;
          case 'room:finalized':
            console.log('🏁 Processando room:finalized - navegando para resultados');
            // Fechar todos os SweetAlerts imediatamente
            this.forceCloseAllSweetAlerts();
            // Navegar direto para resultados
            this.navigateToResults();
            break;
          case 'vote:progress':
            console.log('📊 Processando vote:progress:', event.progress);
            this.handleVoteProgress(event.progress);
            break;
          case 'round:finished':
            console.log('🏁 Processando round:finished');
            this.handleRoundFinished();
            break;
          case 'round:started':
            console.log('🎯 Processando round:started - nova rodada iniciada');
            // Fechar todos os SweetAlerts quando uma nova rodada começar
            this.forceCloseAllSweetAlerts();
            this.closeWaitingSweetAlerts();
            break;
          case 'results:ready':
            console.log('🎉 Processando results:ready');
            this.handleResultsReady();
            break;
          case 'connected':
            console.log('🔌 Socket conectado com ID:', event.socketId);
            break;
          default:
            console.log('❓ Evento não reconhecido:', event);
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
        
        // Usar o NavigationService para verificar se está na tela correta
        if (!this.navigation.isOnCorrectScreen(result.data)) {
          // Se não estiver na tela correta, navegar para ela
          this.navigation.navigateToCorrectScreen(result.data);
        } else {
          // Se estiver na tela correta, verificar lastvote
          this.checkLastVote();
        }
      } else {
        console.warn('Erro ao carregar status da sala:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar status da sala:', error);
    }
  }

  private handleStatusChange(status: RoomStatus): void {
    const currentStatus = status.status;
    const previousStatus = this._roomStatus()?.status;
    
    console.log(`🔄 Mudança de status detectada: ${previousStatus} → ${currentStatus}`);
    
    // CORREÇÃO CRÍTICA: Fechar TODOS os modais de SweetAlert de forma mais robusta
    this.forceCloseAllSweetAlerts();
    
    // Fechar especificamente os SweetAlerts de espera
    this.closeWaitingSweetAlerts();
    
    // Limpar o lastvote da rodada anterior quando mudar de status
    const code = this.roomCode();
    if (code && previousStatus && previousStatus !== currentStatus) {
      console.log(`🧹 Limpando estado da rodada anterior: ${previousStatus}`);
      
      // Limpar lastvote da rodada anterior
      const lastVoteKey = `lastvote_${code}`;
      localStorage.removeItem(lastVoteKey);
      
      // Também limpar no VoteStateService para compatibilidade
      this.voteState.clearVoteState(code, previousStatus);
      
      // Reabilitar votação se mudou para uma nova rodada
      if (currentStatus !== 'rodada_0' || previousStatus === 'rodada_0') {
        this.enableVoting();
      }
    }
    
    // Aguardar um pouco para garantir que o SweetAlert foi fechado
    setTimeout(() => {
      // Usar o NavigationService para navegar para a tela correta
      if (!this.navigation.isOnCorrectScreen(status)) {
        console.log(`🧭 Navegando para tela correta: ${currentStatus}`);
        this.navigation.navigateToCorrectScreen(status);
      } else {
        console.log(`✅ Já está na tela correta: ${currentStatus}`);
      }
    }, 100);
  }

  /**
   * Método utilitário para fechar TODOS os SweetAlerts de forma robusta
   * Usado quando o status muda via socket para garantir que não fiquem modais abertos
   */
  private forceCloseAllSweetAlerts(): void {
    try {
      console.log('🔒 Tentando fechar todos os SweetAlerts...');
      
      // Método 1: Fechar via Swal.close() (método oficial)
      Swal.close();
      
      // Método 2: Fechar via DOM (fallback para casos onde Swal.close() falha)
      const sweetAlertElements = document.querySelectorAll('.swal2-container');
      if (sweetAlertElements.length > 0) {
        console.log(`🔍 Encontrados ${sweetAlertElements.length} elementos SweetAlert no DOM`);
        sweetAlertElements.forEach((element, index) => {
          if (element instanceof HTMLElement) {
            console.log(`🗑️ Removendo SweetAlert ${index + 1}`);
            element.style.display = 'none';
            element.remove();
          }
        });
      }
      
      // Método 3: Fechar via backdrop (fallback para backdrops órfãos)
      const backdrops = document.querySelectorAll('.swal2-backdrop-show');
      if (backdrops.length > 0) {
        console.log(`🔍 Encontrados ${backdrops.length} backdrops no DOM`);
        backdrops.forEach((backdrop, index) => {
          if (backdrop instanceof HTMLElement) {
            console.log(`🗑️ Removendo backdrop ${index + 1}`);
            backdrop.style.display = 'none';
            backdrop.remove();
          }
        });
      }
      
      // Método 4: Remover classes de body (limpeza final)
      const bodyClasses = document.body.classList;
      if (bodyClasses.contains('swal2-shown') || bodyClasses.contains('swal2-height-auto')) {
        console.log('🧹 Removendo classes SweetAlert do body');
        bodyClasses.remove('swal2-shown', 'swal2-height-auto');
      }
      
      // Método 5: Verificar se ainda existem elementos órfãos
      setTimeout(() => {
        const remainingAlerts = document.querySelectorAll('.swal2-container, .swal2-backdrop-show');
        if (remainingAlerts.length > 0) {
          console.log(`⚠️ Ainda existem ${remainingAlerts.length} elementos SweetAlert após limpeza`);
          remainingAlerts.forEach(element => {
            if (element instanceof HTMLElement) {
              element.remove();
            }
          });
        } else {
          console.log('✅ Limpeza completa dos SweetAlerts realizada');
        }
      }, 50);
      
    } catch (error) {
      console.error('❌ Erro ao fechar SweetAlerts:', error);
    }
  }

  /**
   * Método específico para fechar SweetAlerts de espera quando há mudança de status
   */
  private closeWaitingSweetAlerts(): void {
    try {
      console.log('🎯 Fechando SweetAlerts de espera específicos...');
      
      // Fechar SweetAlerts com classes específicas
      const waitingAlerts = document.querySelectorAll('.waiting-next-round-alert, .already-voted-alert, .round-finished-alert');
      if (waitingAlerts.length > 0) {
        console.log(`🔍 Encontrados ${waitingAlerts.length} SweetAlerts de espera`);
        waitingAlerts.forEach((alert, index) => {
          console.log(`🗑️ Fechando SweetAlert de espera ${index + 1}`);
          if (alert instanceof HTMLElement) {
            alert.remove();
          }
        });
      }
      
      // Também fechar via Swal.close() para garantir
      Swal.close();
      
    } catch (error) {
      console.error('❌ Erro ao fechar SweetAlerts de espera:', error);
    }
  }

  private handleVoteProgress(progress: number): void {
    // Atualizar progresso da Rodada
    console.log('Progresso da Rodada:', progress);
  }

  private handleRoundFinished(): void {
    console.log('🏁 Rodada finalizada, fechando SweetAlerts e mostrando mensagem');
    
    // CORREÇÃO: Fechar qualquer SweetAlert anterior de forma robusta
    this.forceCloseAllSweetAlerts();
    this.closeWaitingSweetAlerts();
    
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
      customClass: {
        container: 'round-finished-alert'
      }
    });
  }

  private handleResultsReady(): void {
    // CORREÇÃO: Fechar qualquer SweetAlert anterior de forma robusta
    this.forceCloseAllSweetAlerts();
    
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
      // Redirecionar para resultados com parâmetros corretos
      const session = this.home.getSession();
      if (session) {
        this.router.navigate(['/resultados', session.roomCode, session.participantId]);
      } else {
        console.error('Sessão não encontrada para redirecionamento');
        this.router.navigate(['/']);
      }
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
            console.log(`🔄 Mudança de status detectada via polling: ${currentStatus} → ${newStatus}`);
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
  canDrag = (id: string) => {
    // Verificar se já votou nesta rodada
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_0';
    if (code && this.voteState.hasVotedInCurrentRound(code, currentStatus)) {
      return false; // Não permitir arraste se já votou
    }
    
    // Só permitir arraste se a carta estiver selecionada
    return this.selectedCardId() === id;
  };

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

  /** Só aceita drop no próprio alvo e apenas uma carta, E se ainda não votou */
  canEnterTarget = (alvoId: string) => () => {
    // Verificar se já votou nesta rodada
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_0';
    if (code && this.voteState.hasVotedInCurrentRound(code, currentStatus)) {
      return false; // Não permitir drop se já votou
    }
    
    // Verificar se o alvo já tem carta
    return this.ensureBucket(alvoId).length === 0;
  };

  async onDropToTarget(event: CdkDragDrop<Carta[]>, alvo: Alvo) {
    const destinoId = this.targetListId(alvo.id);
    if (event.previousContainer.id !== this.handListId || event.container.id !== destinoId) return;

    const card = event.previousContainer.data[event.previousIndex];
    if (!card) return;

    // VERIFICAÇÃO CRÍTICA: Verificar se já votou nesta rodada
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_0';
    if (code && this.voteState.hasVotedInCurrentRound(code, currentStatus)) {
      // Se já votou, mostrar SweetAlert impedindo o voto
      Swal.fire({
        title: '❌ Carta já enviada!',
        text: 'Você já realizou sua autoavaliação nesta rodada. Não é possível enviar uma carta novamente.',
        icon: 'warning',
        confirmButtonText: 'Entendi',
        allowOutsideClick: true,
        allowEscapeKey: true,
        allowEnterKey: true,
      });
      return; // Impedir continuar com o voto
    }

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

        // Marcar que o usuário votou nesta rodada
        const code = this.roomCode();
        const currentStatus = this._roomStatus()?.status || 'rodada_0';
        if (code) {
          // Salvar lastvote no localStorage
          const lastVoteKey = `lastvote_${code}`;
          localStorage.setItem(lastVoteKey, currentStatus);
          
          // Também marcar no VoteStateService para compatibilidade
          this.voteState.markAsVoted(code, currentStatus, {
            cardColor: card.cor.toLowerCase(),
            cardDescription: card.texto,
            targetId: alvo.id
          });
        }

        await Swal.fire({
          title: 'Autoavaliação registrada',
          html: 'Aguarde o próximo passo.<br>Esta janela fechará quando a próxima etapa começar.',
          icon: 'success',
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false,
          showConfirmButton: false,
          timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
        });
      } else {
        this.toastError(`Erro ao registrar carta: ${result.error}`);
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

  getProgressPercentage(): number {
    const status = this._roomStatus();
    if (!status) return 0;
    
    // Só mostrar progresso se estiver na rodada_0 (autoavaliação)
    if (status.status !== 'rodada_0') return 0;
    
    const progress = status.round_progress;
    if (!progress) return 0;
    
    // Calcular porcentagem baseada na rodada atual
    const currentVotes = progress.current_votes;
    const expectedVotes = progress.expected_votes;
    
    if (expectedVotes === 0) return 0;
    
    // Garantir que a porcentagem não exceda 100%
    const percentage = Math.min((currentVotes / expectedVotes) * 100, 100);
    return Math.round(percentage);
  }

  getStatusDisplay(status: string | undefined): string {
    if (!status) return 'Carregando...';
    
    const statusMap: { [key: string]: string } = {
      'lobby': '🔄 Lobby',
      'rodada_0': '🎯 Rodada 0 - Autoavaliação',
      'rodada_1': '🎯 Rodada 1 - Rodada',
      'rodada_2': '🎯 Rodada 2 - Rodada',
      'finalizado': '🏁 Finalizado'
    };
    return statusMap[status] || status;
  }

  private checkAndRestoreVoteState(): void {
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_0';
    
    if (!code) return;

    // Verificar se já votou nesta rodada
    if (this.voteState.hasVotedInCurrentRound(code, currentStatus)) {
      // Se já votou, mostrar mensagem e desabilitar interação
      this.showAlreadyVotedMessage();
      
      // Restaurar o estado visual (carta no alvo)
      this.restoreVoteVisualState(code, currentStatus);
    }
  }

  private showAlreadyVotedMessage(): void {
    console.log('📝 Mostrando mensagem de que já votou');
    
    // Mostrar mensagem de que já votou
    Swal.fire({
      title: 'Você já enviou sua carta nesta rodada!',
      text: 'Aguarde o próximo passo. Esta janela fechará automaticamente quando a próxima etapa começar.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
      customClass: {
        container: 'already-voted-alert'
      }
    });
  }

  private restoreVoteVisualState(roomCode: string, roundStatus: string): void {
    const voteData = this.voteState.getCurrentVoteData(roomCode, roundStatus);
    if (!voteData) return;

    // Encontrar a carta que foi votada
    const votedCard = this.hand().find(card => 
      card.cor.toLowerCase() === voteData.cardColor && 
      card.texto === voteData.cardDescription
    );

    if (votedCard) {
      // Remover a carta da mão
      this.hand.update(hand => hand.filter(card => card.id !== votedCard.id));
      
      // Adicionar a carta ao alvo (próprio usuário)
      const selfAlvo = this.alvos().find(a => a.isSelf);
      if (selfAlvo) {
        this.assigned[selfAlvo.id] = [votedCard];
      }
    }
  }

  private checkLastVote(): void {
    const code = this.roomCode();
    if (!code) return;

    // Buscar lastvote do localStorage
    const lastVoteKey = `lastvote_${code}`;
    const lastVote = localStorage.getItem(lastVoteKey);
    
    console.log(`🔍 Verificando lastvote para sala ${code}: ${lastVote}`);
    
    // Se existe lastvote e é igual à rodada atual (rodada_0), mostrar SweetAlert
    if (lastVote === 'rodada_0') {
      console.log('📝 Usuário já votou na rodada 0, mostrando mensagem de espera');
      this.showWaitingForNextRoundMessage();
      this.disableVoting();
    } else {
      console.log('✅ Usuário ainda não votou na rodada 0, votação habilitada');
      this.enableVoting();
    }
  }

  private showWaitingForNextRoundMessage(): void {
    console.log('⏳ Mostrando mensagem de espera para próxima rodada');
    
    Swal.fire({
      title: '⏳ Aguardando Próxima Rodada',
      text: 'Você já realizou sua autoavaliação nesta rodada. Aguarde o próximo passo.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
      customClass: {
        container: 'waiting-next-round-alert'
      }
    });
  }

  private disableVoting(): void {
    // Desabilitar todas as cartas visualmente
    this.hand.update(hand => hand.map(card => ({ ...card, disabled: true })));
  }

  private enableVoting(): void {
    // Reabilitar todas as cartas visualmente
    this.hand.update(hand => hand.map(card => ({ ...card, disabled: false })));
    
    // Limpar seleção atual
    this.selectedCardId.set(null);
    this.draggingCardId.set(null);
    
    console.log('✅ Votação reabilitada');
  }

  private navigateToResults(): void {
    const session = this.home.getSession();
    if (session) {
      this.router.navigate(['/resultados', session.roomCode, session.participantId]);
    } else {
      console.error('Sessão não encontrada para redirecionamento de resultados');
      this.router.navigate(['/']);
    }
  }
}