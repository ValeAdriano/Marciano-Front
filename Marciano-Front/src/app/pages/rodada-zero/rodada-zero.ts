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
      
      // CAMADA DE GARANTIA: Verificação periódica de status como fallback
      console.log('🔒 Iniciando verificação periódica de status como fallback...');
      this.startPeriodicStatusCheck();
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
        console.log('🔍 Tipo do evento:', event.type);
        console.log('🔍 Dados do evento:', JSON.stringify(event, null, 2));
        
        switch (event.type) {
          case 'room:status':
            console.log('🔄 Processando room:status:', event.status);
            console.log('🔍 Status anterior (antes da atualização):', this._roomStatus()?.status);
            console.log('🔍 Status novo recebido:', event.status.status);
            this._roomStatus.set(event.status);
            console.log('🔍 Status atualizado no signal:', this._roomStatus()?.status);
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
            // CORREÇÃO CRÍTICA: Fechar todos os SweetAlerts quando uma nova rodada começar
            this.forceCloseAllSweetAlerts();
            // CORREÇÃO ESPECÍFICA: Fechar SweetAlerts específicos da rodada_0
            this.closeRoundZeroSweetAlerts();
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

  private async loadRoomStatus(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;

    try {
      console.log('🔄 Carregando status da sala via API...');
      const result = await this.api.getRoomStatus(code);
      if (result.ok) {
        console.log('✅ Status da sala carregado via API:', result.data);
        console.log('🔍 Status anterior (antes da atualização):', this._roomStatus()?.status);
        console.log('🔍 Status novo recebido:', result.data.status);
        
        this._roomStatus.set(result.data);
        console.log('🔍 Status atualizado no signal:', this._roomStatus()?.status);
        
        // Usar o NavigationService para verificar se está na tela correta
        if (!this.navigation.isOnCorrectScreen(result.data)) {
          console.log('🧭 Navegando para tela correta...');
          // Se não estiver na tela correta, navegar para ela
          this.navigation.navigateToCorrectScreen(result.data);
        } else {
          console.log('✅ Já está na tela correta');
          // Se estiver na tela correta, verificar lastvote
          this.checkLastVote();
        }
      } else {
        console.warn('❌ Erro ao carregar status da sala:', result.error);
      }
    } catch (error) {
      console.error('💥 Erro ao carregar status da sala:', error);
    }
  }

  private handleStatusChange(status: RoomStatus): void {
    console.log('🔄 handleStatusChange chamado com status:', status);
    console.log('🔍 Detalhes do status recebido:', JSON.stringify(status, null, 2));
    
    const currentStatus = status.status;
    console.log('📊 Status atual extraído:', currentStatus);
    
    // CORREÇÃO CRÍTICA: Fechar TODOS os modais de SweetAlert de forma mais robusta
    console.log('🔒 Iniciando fechamento de SweetAlerts...');
    this.forceCloseAllSweetAlerts();
    
    // VERIFICAÇÃO CRÍTICA: Se o status for "finalizado", navegar direto para resultados
    if (currentStatus === 'finalizado') {
      console.log('🏁 Status finalizado detectado, navegando para resultados...');
      this.navigateToResults();
      return; // Sair do método para não executar o resto da lógica
    }
    
    // VERIFICAÇÃO CRÍTICA: Se mudou de rodada_0 para rodada_1+, fechar SweetAlerts imediatamente
    const code = this.roomCode();
    const previousStatus = this._roomStatus()?.status;
    console.log('📝 Status anterior:', previousStatus, 'Status atual:', currentStatus);
    console.log('🔍 Código da sala:', code);
    console.log('🔍 Signal _roomStatus atual:', this._roomStatus());
    
    if (code && previousStatus && previousStatus !== currentStatus) {
      console.log('🔄 Status mudou, limpando lastvote da rodada anterior');
      console.log('🎯 Mudança detectada:', previousStatus, '->', currentStatus);
      
      // CORREÇÃO ESPECÍFICA: Se mudou de rodada_0 para rodada_1+, fechar SweetAlerts imediatamente
      if (previousStatus === 'rodada_0' && currentStatus.startsWith('rodada_') && currentStatus !== 'rodada_0') {
        console.log('🎯 Mudança de rodada_0 para nova rodada detectada - fechando SweetAlerts...');
        console.log('🔒 Executando fechamento forçado...');
        this.forceCloseAllSweetAlerts();
        this.closeRoundZeroSweetAlerts();
        
        // CAMADA DE GARANTIA ADICIONAL: Fechamento múltiplo com delays
        console.log('🔒 CAMADA DE GARANTIA: Fechamento adicional após 200ms...');
        setTimeout(() => {
          console.log('🔒 Executando fechamento adicional...');
          this.forceCloseAllSweetAlerts();
          this.closeRoundZeroSweetAlerts();
        }, 200);
        
        console.log('🔒 CAMADA DE GARANTIA: Fechamento adicional após 500ms...');
        setTimeout(() => {
          console.log('🔒 Executando fechamento adicional...');
          this.forceCloseAllSweetAlerts();
          this.closeRoundZeroSweetAlerts();
        }, 500);
        
        console.log('🔒 CAMADA DE GARANTIA: Fechamento adicional após 1000ms...');
        setTimeout(() => {
          console.log('🔒 Executando fechamento adicional...');
          this.forceCloseAllSweetAlerts();
          this.closeRoundZeroSweetAlerts();
        }, 1000);
      }
      
      // Limpar lastvote da rodada anterior
      const lastVoteKey = `lastvote_${code}`;
      localStorage.removeItem(lastVoteKey);
      console.log('🗑️ Lastvote removido:', lastVoteKey);
      
      // Também limpar no VoteStateService para compatibilidade
      this.voteState.clearVoteState(code, previousStatus);
      console.log('🗑️ VoteState limpo para:', code, previousStatus);
    } else {
      console.log('⚠️ Condições não atendidas para limpeza:');
      console.log('  - code existe:', !!code);
      console.log('  - previousStatus existe:', !!previousStatus);
      console.log('  - status diferente:', previousStatus !== currentStatus);
    }
    
    // Aguardar um pouco para garantir que o SweetAlert foi fechado
    setTimeout(() => {
      console.log('🔒 Verificação final de SweetAlerts...');
      this.forceCloseAllSweetAlerts();
      
      // Usar o NavigationService para verificar se está na tela correta
      if (!this.navigation.isOnCorrectScreen(status)) {
        console.log('🧭 Navegando para tela correta...');
        this.navigation.navigateToCorrectScreen(status);
      } else {
        console.log('✅ Já está na tela correta');
      }
    }, 100);
  }

  /**
   * Método utilitário para fechar TODOS os SweetAlerts de forma robusta
   * Usado quando o status muda via socket para garantir que não fiquem modais abertos
   */
  private forceCloseAllSweetAlerts(): void {
    try {
      console.log('🔒 Iniciando fechamento forçado de todos os SweetAlerts...');
      
      // Método 1: Fechar via Swal.close() (método oficial)
      console.log('🔒 Método 1: Executando Swal.close()...');
      Swal.close();
      
      // Método 2: Fechar via DOM (fallback para casos onde Swal.close() falha)
      const sweetAlertElements = document.querySelectorAll('.swal2-container');
      console.log(`🔍 Método 2: Encontrados ${sweetAlertElements.length} elementos de SweetAlert para fechar`);
      sweetAlertElements.forEach((element, index) => {
        if (element instanceof HTMLElement) {
          console.log(`🗑️ Fechando SweetAlert ${index + 1} via DOM`);
          element.style.display = 'none';
          element.remove();
        }
      });
      
      // Método 3: Fechar via backdrop (fallback para backdrops órfãos)
      const backdrops = document.querySelectorAll('.swal2-backdrop-show');
      console.log(`🔍 Método 3: Encontrados ${backdrops.length} backdrops para fechar`);
      backdrops.forEach((backdrop, index) => {
        if (backdrop instanceof HTMLElement) {
          console.log(`🗑️ Fechando backdrop ${index + 1}`);
          backdrop.style.display = 'none';
          backdrop.remove();
        }
      });
      
      // Método 4: Remover classes de body (limpeza final)
      console.log('🔒 Método 4: Removendo classes do body...');
      document.body.classList.remove('swal2-shown', 'swal2-height-auto');
      
      // Método 5: Verificação adicional após um delay
      setTimeout(() => {
        const remainingAlerts = document.querySelectorAll('.swal2-container, .swal2-backdrop-show');
        if (remainingAlerts.length > 0) {
          console.log(`🧹 Limpeza adicional: removendo ${remainingAlerts.length} elementos restantes`);
          remainingAlerts.forEach(element => {
            if (element instanceof HTMLElement) {
              element.remove();
            }
          });
        } else {
          console.log('✅ Nenhum elemento restante encontrado');
        }
      }, 100);
      
      console.log('✅ Todos os SweetAlerts foram fechados com sucesso');
    } catch (error) {
      console.warn('⚠️ Erro ao fechar SweetAlerts:', error);
    }
  }

  /**
   * Método específico para fechar SweetAlerts quando uma nova rodada iniciar
   * Usado para garantir que mensagens de espera da rodada_0 sejam fechadas
   */
  private closeRoundZeroSweetAlerts(): void {
    try {
      console.log('🎯 Fechando SweetAlerts específicos da rodada_0...');
      
      // Fechar SweetAlerts com mensagens de espera da rodada_0
      const waitingAlerts = document.querySelectorAll('.swal2-container');
      if (waitingAlerts.length > 0) {
        console.log(`🔍 Encontrados ${waitingAlerts.length} SweetAlerts para fechar`);
        waitingAlerts.forEach((alert, index) => {
          if (alert instanceof HTMLElement) {
            const title = alert.querySelector('.swal2-title');
            // Verificar se é um SweetAlert de espera da rodada_0
            if (title && (
              title.textContent?.includes('Aguardando') || 
              title.textContent?.includes('Próxima Rodada') ||
              title.textContent?.includes('Autoavaliação registrada') ||
              title.textContent?.includes('Você já enviou') ||
              title.textContent?.includes('Carta já enviada')
            )) {
              console.log(`🗑️ Fechando SweetAlert da rodada_0: ${title.textContent}`);
              alert.remove();
            }
          }
        });
      }
      
      // Também fechar via Swal.close() para garantir
      console.log('🔒 Executando Swal.close() adicional...');
      Swal.close();
      
      // Verificação adicional para elementos restantes
      setTimeout(() => {
        const remainingAlerts = document.querySelectorAll('.swal2-container');
        if (remainingAlerts.length > 0) {
          console.log(`🧹 Limpeza adicional: removendo ${remainingAlerts.length} elementos restantes`);
          remainingAlerts.forEach(element => {
            if (element instanceof HTMLElement) {
              element.remove();
            }
          });
        }
      }, 50);
      
      console.log('✅ SweetAlerts da rodada_0 fechados com sucesso');
    } catch (error) {
      console.warn('⚠️ Erro ao fechar SweetAlerts da rodada_0:', error);
    }
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
    
    // Se existe lastvote e é igual à rodada atual, mostrar SweetAlert
    const currentStatus = this._roomStatus()?.status || 'rodada_0';
    if (lastVote === currentStatus) {
      this.showWaitingForNextRoundMessage();
      this.disableVoting();
    }
  }

  private showWaitingForNextRoundMessage(): void {
    Swal.fire({
      title: '⏳ Aguardando Próxima Rodada',
      text: 'Você já realizou sua autoavaliação nesta rodada. Aguarde o próximo passo.',
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      timer: undefined, // Sem timer automático - será fechado pelo handleStatusChange
    });
  }

  private disableVoting(): void {
    // Desabilitar todas as cartas visualmente
    this.hand.update(hand => hand.map(card => ({ ...card, disabled: true })));
  }



  /**
   * Inicia verificação periódica do status da sala como fallback
   * Útil para casos onde o socket não está funcionando
   */
  private startPeriodicStatusCheck(): void {
    const code = this.roomCode();
    if (!code) return;

    console.log('🔒 Iniciando verificação periódica de status a cada 5 segundos...');
    
    // Verificar a cada 5 segundos
    setInterval(async () => {
      try {
        console.log('🔄 Verificação periódica de status da sala...');
        const result = await this.api.getRoomStatus(code);
        
        if (result.ok) {
          const currentStatus = result.data.status;
          const previousStatus = this._roomStatus()?.status;
          
          console.log('🔍 Verificação periódica - Status anterior:', previousStatus, 'Status atual:', currentStatus);
          
          // Se o status mudou para "finalizado", navegar para resultados
          if (currentStatus === 'finalizado' && previousStatus !== 'finalizado') {
            console.log('🏁 Status finalizado detectado via verificação periódica');
            this.forceCloseAllSweetAlerts();
            this.navigateToResults();
            return;
          }
          
          // Se o status mudou, atualizar e processar
          if (previousStatus !== currentStatus) {
            console.log('🔄 Status mudou via verificação periódica:', previousStatus, '->', currentStatus);
            console.log('🔒 Executando handleStatusChange via verificação periódica...');
            this._roomStatus.set(result.data);
            this.handleStatusChange(result.data);
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro na verificação periódica de status:', error);
      }
    }, 5000); // A cada 5 segundos
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