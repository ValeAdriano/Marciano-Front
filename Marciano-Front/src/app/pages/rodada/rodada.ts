import {
  Component, computed, signal, WritableSignal, AfterViewInit, OnInit, OnDestroy,
  inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { NavigationService } from '../../@shared/services/navigation.service';
import { VoteStateService } from '../../@shared/services/vote-state.service';

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
  imports: [CommonModule, DragDropModule],
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
  private readonly navigation = inject(NavigationService);
  private readonly voteState = inject(VoteStateService);

  // Número da rodada atual (dinâmico do backend)
  readonly rodadaNumero = computed(() => this._roomStatus()?.current_round || 0);

  // Número total de rodadas (dinâmico do backend)
  readonly totalRodadas = computed(() => this._roomStatus()?.max_rounds || 0);

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

    console.log('🚀 RodadaComponent inicializando...');

    // Timer local
    this.rodada.init();

    // Conecta socket e carrega dados
    const code = this.roomCode();
    if (code) {
      console.log('🔌 Conectando socket para sala:', code);
      this.api.connectSocket(code);
      this.setupSocketListeners();
      this.loadInitialData();
      
      // VERIFICAÇÃO CRÍTICA: Verificar se já votou nesta rodada
      this.checkLastVote();
      
      // Verificar status da conexão do socket
      this.checkSocketStatus();
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
  canDrag = (id: string) => {
    // Verificar se já votou nesta rodada
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_1';
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

  canEnterTarget = (alvoId: string) => () => {
    // Verificar se já votou nesta rodada
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_1';
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
    const currentStatus = this._roomStatus()?.status || 'rodada_1';
    if (code && this.voteState.hasVotedInCurrentRound(code, currentStatus)) {
      // Se já votou, mostrar SweetAlert impedindo o voto
      Swal.fire({
        title: '❌ Carta já enviada!',
        text: 'Você já enviou sua carta nesta rodada. Não é possível enviar novamente.',
        icon: 'warning',
        confirmButtonText: 'Entendi',
        allowOutsideClick: true,
        allowEscapeKey: true,
        allowEnterKey: true,
      });
      return; // Impedir continuar com o voto
    }

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

        // Marcar que o usuário votou nesta rodada
        const code = this.roomCode();
        const currentStatus = this._roomStatus()?.status || 'rodada_1';
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

        // Mostrar SweetAlert que será fechado automaticamente quando o status mudar
        Swal.fire({
          title: 'Voto registrado',
          html: 'Aguarde os demais participantes.<br>Esta janela fechará automaticamente quando a próxima rodada começar.',
          icon: 'success',
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: false,
          showConfirmButton: false,
          timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
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

  getProgressPercentage(): number {
    const status = this._roomStatus();
    if (!status) return 0;
    
    // Só mostrar progresso se estiver em uma rodada de Rodada (rodada_1, rodada_2, etc.)
    if (!status.status.startsWith('rodada_') || status.status === 'rodada_0') return 0;
    
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

  getOverallProgressPercentage(): number {
    const status = this._roomStatus();
    if (!status) return 0;
    
    // Calcular progresso geral considerando todas as rodadas
    const currentRound = status.current_round;
    const maxRounds = status.max_rounds;
    
    if (maxRounds === 0) return 0;
    
    // Se estiver na rodada 0 (autoavaliação), considerar como 0%
    if (currentRound === 0) return 0;
    
    // Calcular progresso baseado na rodada atual vs total de rodadas
    const progress = Math.min((currentRound / maxRounds) * 100, 100);
    return Math.round(progress);
  }

  getStatusDisplay(status: string | undefined): string {
    if (!status) return 'Carregando...';
    
    const statusMap: { [key: string]: string } = {
      'lobby': '🔄 Lobby',
      'rodada_0': '🎯 Rodada 0 - Autoavaliação',
      'rodada_1': '🎯 Rodada 1 - Rodada',
      'rodada_2': '🎯 Rodada 2 - Rodada',
      'rodada_3': '🎯 Rodada 3 - Rodada',
      'rodada_4': '🎯 Rodada 4 - Rodada',
      'rodada_5': '🎯 Rodada 5 - Rodada',
      'rodada_6': '🎯 Rodada 6 - Rodada',
      'rodada_7': '🎯 Rodada 7 - Rodada',
      'rodada_8': '🎯 Rodada 8 - Rodada',
      'rodada_9': '🎯 Rodada 9 - Rodada',
      'rodada_10': '🎯 Rodada 10 - Rodada',
      'finalizado': '🏁 Finalizado'
    };
    
    // Se for uma rodada genérica (rodada_X), usar o padrão
    if (status.startsWith('rodada_')) {
      const rodadaNum = status.replace('rodada_', '');
      if (rodadaNum === '0') {
        return '🎯 Rodada 0 - Autoavaliação';
      } else {
        return `🎯 Rodada ${rodadaNum} - Rodada`;
      }
    }
    
    return statusMap[status] || status;
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
    
    // Verificar lastvote após carregar todos os dados
    this.checkLastVote();
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
          case 'round:started':
            console.log('🎯 Processando round:started:', event.totalSeconds);
            // Iniciar timer quando a rodada for iniciada
            this.rodada.onRoundStarted(event.totalSeconds);
            break;
          case 'round:finished':
            console.log('🏁 Processando round:finished');
            this.handleRoundFinished();
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
  }

  /**
   * Método utilitário para fechar TODOS os SweetAlerts de forma robusta
   * Usado quando o status muda via socket para garantir que não fiquem modais abertos
   */
  private forceCloseAllSweetAlerts(): void {
    try {
      // Método 1: Fechar via Swal.close() (método oficial)
      Swal.close();
      
      // Método 2: Fechar via DOM (fallback para casos onde Swal.close() falha)
      const sweetAlertElements = document.querySelectorAll('.swal2-container');
      sweetAlertElements.forEach(element => {
        if (element instanceof HTMLElement) {
          element.style.display = 'none';
          element.remove();
        }
      });
      
      // Método 3: Fechar via backdrop (fallback para backdrops órfãos)
      const backdrops = document.querySelectorAll('.swal2-backdrop-show');
      backdrops.forEach(backdrop => {
        if (backdrop instanceof HTMLElement) {
          backdrop.style.display = 'none';
          backdrop.remove();
        }
      });
      
      // Método 4: Remover classes de body (limpeza final)
      document.body.classList.remove('swal2-shown', 'swal2-height-auto');
      
      console.log('✅ Todos os SweetAlerts foram fechados com sucesso');
    } catch (error) {
      console.warn('⚠️ Erro ao fechar SweetAlerts:', error);
    }
  }

  private handleStatusChange(status: RoomStatus): void {
    console.log('🔄 handleStatusChange chamado com status:', status);
    const currentStatus = status.status;
    
    // CORREÇÃO CRÍTICA: Fechar TODOS os modais de SweetAlert de forma mais robusta
    this.forceCloseAllSweetAlerts();
    
    // VERIFICAÇÃO CRÍTICA: Se o status for "finalizado", navegar direto para resultados
    if (currentStatus === 'finalizado') {
      console.log('🏁 Status finalizado detectado, navegando para resultados...');
      this.navigateToResults();
      return; // Sair do método para não executar o resto da lógica
    }
    
    // Limpar o lastvote da rodada anterior quando mudar de status
    const code = this.roomCode();
    const previousStatus = this._roomStatus()?.status;
    console.log('📝 Status anterior:', previousStatus, 'Status atual:', currentStatus);
    
    if (code && previousStatus && previousStatus !== currentStatus) {
      console.log('🔄 Status mudou, limpando lastvote da rodada anterior');
      // Limpar lastvote da rodada anterior
      const lastVoteKey = `lastvote_${code}`;
      localStorage.removeItem(lastVoteKey);
      
      // Também limpar no VoteStateService para compatibilidade
      this.voteState.clearVoteState(code, previousStatus);
    }
    
    // Aguardar um pouco para garantir que o SweetAlert foi fechado
    setTimeout(() => {
      // Usar o NavigationService para verificar se está na tela correta
      if (!this.navigation.isOnCorrectScreen(status)) {
        console.log('🧭 Navegando para tela correta...');
        this.navigation.navigateToCorrectScreen(status);
      } else {
        console.log('✅ Já está na tela correta');
      }
    }, 100);
  }

  private handleVoteProgress(progress: number): void {
    // Atualizar progresso da Rodada
    console.log('Progresso da Rodada:', progress);
  }

  private handleRoundFinished(): void {
    // CORREÇÃO: Fechar qualquer SweetAlert anterior de forma robusta
    this.forceCloseAllSweetAlerts();
    
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
      // Usar o método centralizado para navegar para resultados
      this.navigateToResults();
    });
  }

  private checkAndRestoreVoteState(): void {
    const code = this.roomCode();
    const currentStatus = this._roomStatus()?.status || 'rodada_1';
    
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
    // Mostrar mensagem de que já votou
    Swal.fire({
      title: 'Você já enviou sua carta nesta rodada!',
      text: 'Aguarde os demais participantes. Esta janela fechará automaticamente quando a próxima rodada começar.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
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

    if (votedCard && voteData.targetId) {
      // Remover a carta da mão
      this.hand.update(hand => hand.filter(card => card.id !== votedCard.id));
      
      // Adicionar a carta ao alvo correto
      this.assigned[voteData.targetId] = [votedCard];
    }
  }

  private checkLastVote(): void {
    const code = this.roomCode();
    if (!code) return;

    // Buscar lastvote do localStorage
    const lastVoteKey = `lastvote_${code}`;
    const lastVote = localStorage.getItem(lastVoteKey);
    
    // Se existe lastvote e é igual à rodada atual, mostrar SweetAlert
    const currentStatus = this._roomStatus()?.status || 'rodada_1';
    if (lastVote === currentStatus) {
      this.showWaitingForNextRoundMessage();
      this.disableVoting();
    }
  }

  private showWaitingForNextRoundMessage(): void {
    Swal.fire({
      title: '⏳ Aguardando Próxima Rodada',
      text: 'Você já enviou sua carta nesta rodada. Aguarde os demais participantes.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: undefined, // Sem timer automático
    });
  }

  private disableVoting(): void {
    // Desabilitar todas as cartas visualmente
    this.hand.update(hand => hand.map(card => ({ ...card, disabled: true })));
  }

  /**
   * Força a atualização do status da sala via socket
   * Método de debug para testar a conexão
   */
  forceStatusUpdate(): void {
    const code = this.roomCode();
    if (!code) {
      console.warn('❌ Nenhum código de sala disponível');
      return;
    }

    console.log('🔄 Forçando atualização de status para sala:', code);
    
    // Verificar se o socket está conectado
    if (!this.api.connected()) {
      console.warn('⚠️ Socket não está conectado, reconectando...');
      this.api.connectSocket(code);
      return;
    }

    // Emitir evento para solicitar status atualizado
    console.log('📡 Emitindo get_room_status via socket');
    this.api.emitSocketEvent('get_room_status', { room_code: code });

    // Também fazer uma requisição HTTP como fallback
    this.loadRoomStatus();
  }

  /**
   * Verifica o status da conexão do socket para debug
   */
  private checkSocketStatus(): void {
    setTimeout(() => {
      const isConnected = this.api.connected();
      console.log('🔌 Status da conexão do socket:', isConnected ? '✅ Conectado' : '❌ Desconectado');
      
      if (!isConnected) {
        console.warn('⚠️ Socket não está conectado, tentando reconectar...');
        const code = this.roomCode();
        if (code) {
          this.api.connectSocket(code);
        }
      }
      
      // Verificar periodicamente o status da sala como fallback
      this.startPeriodicStatusCheck();
    }, 2000); // Verificar após 2 segundos
  }

  /**
   * Inicia verificação periódica do status da sala como fallback
   * Útil para casos onde o socket não está funcionando
   */
  private startPeriodicStatusCheck(): void {
    const code = this.roomCode();
    if (!code) return;

    // Verificar a cada 10 segundos
    setInterval(async () => {
      try {
        console.log('🔄 Verificação periódica de status da sala...');
        const result = await this.api.getRoomStatus(code);
        
        if (result.ok) {
          const currentStatus = result.data.status;
          const previousStatus = this._roomStatus()?.status;
          
          // Se o status mudou para "finalizado", navegar para resultados
          if (currentStatus === 'finalizado' && previousStatus !== 'finalizado') {
            console.log('🏁 Status finalizado detectado via verificação periódica');
            this.forceCloseAllSweetAlerts();
            this.navigateToResults();
            return;
          }
          
          // Se o status mudou, atualizar
          if (previousStatus !== currentStatus) {
            console.log('🔄 Status mudou via verificação periódica:', previousStatus, '->', currentStatus);
            this._roomStatus.set(result.data);
            this.handleStatusChange(result.data);
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro na verificação periódica de status:', error);
      }
    }, 10000); // A cada 10 segundos
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
