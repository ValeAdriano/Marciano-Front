import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Observable, of, delay, takeUntil, Subject, BehaviorSubject, tap, map, firstValueFrom } from 'rxjs';
import { HomeService } from '../home/home.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';

export type ConnectionStatus = 'connected' | 'disconnected';

export interface LobbyParticipant {
  id: string;
  name: string;
  envelope_choice: string; // cor do envelope (hex) - vem da API
  status: ConnectionStatus;
}

// Interfaces seguindo o padrão do angular_implementation.md
export interface JoinRoomData {
  room_id: number;
  participant_id: number;
}

export interface ParticipantJoinEvent {
  participant: {
    id: string;
    name: string;
    envelope_choice: string;
  };
}

// Interface para status da sala
export interface RoomStatus {
  status: string;
  current_round: number;
  max_rounds: number;
  round_start_time?: string;
  participants_count: number;
  round_progress: {
    participants: number;
    expected_votes: number;
    current_votes: number;
    progress_pct: number;
  };
}

@Injectable({ providedIn: 'root' })
export class LobbyService implements OnDestroy {
  private readonly home = inject(HomeService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  // Socket.io connection
  private socket: Socket;
  private connected$ = new BehaviorSubject<boolean>(false);

  // estado local dos participantes
  private readonly _participants = signal<LobbyParticipant[]>([]);
  readonly participants = computed(() => this._participants());
  readonly count = computed(() => this._participants().length);
  readonly isConnected = computed(() => this.connected$.value);

  // Status da sala
  private readonly _roomStatus = signal<RoomStatus | null>(null);
  readonly roomStatus = computed(() => this._roomStatus());

  constructor() {
    console.log('🔧 Inicializando LobbyService...');
    console.log('🔌 URL do WebSocket:', environment.socketUrl);
    console.log('🌐 URL da API:', environment.apiUrl);
    
    this.socket = io(environment.socketUrl);
    this.setupEventListeners();
    
    console.log('✅ LobbyService inicializado com sucesso');
  }

  /**
   * Inicializa a sala: conecta ao WebSocket e carrega participantes da API
   */
  initRoom(roomCode: string): void {
    console.log('🚀 Inicializando sala:', roomCode);
    
    const session = this.home.getSession();
    if (!session) {
      console.error('❌ Sessão não encontrada');
      return;
    }

    console.log('✅ Sessão encontrada:', { 
      participantId: session.participantId, 
      name: session.name, 
      roomCode: session.roomCode 
    });

    // Conecta ao WebSocket se não estiver conectado
    if (!this.socket.connected) {
      console.log('🔌 Conectando ao WebSocket...');
      this.socket.connect();
    } else {
      console.log('✅ WebSocket já conectado');
    }

    // Entra na sala via WebSocket
    this.joinRoom(roomCode, session.participantId);

    // Configura listeners do WebSocket
    this.setupSocketListeners();

    // Carrega participantes iniciais da API
    this.loadParticipantsFromApi(roomCode);

    // Carrega status inicial da sala
    this.loadRoomStatus(roomCode);

    // Inicia monitoramento periódico do status
    this.startStatusMonitoring(roomCode);
    
    console.log('✅ Sala inicializada com sucesso');
  }

  /**
   * Carrega participantes da API seguindo o padrão do angular_implementation.md
   */
  private loadParticipantsFromApi(roomCode: string): void {
    console.log('🔄 Carregando participantes da API para sala:', roomCode);
    this.getRoomParticipants(roomCode).subscribe({
      next: (participants: LobbyParticipant[]) => {
        console.log('✅ Participantes carregados com sucesso:', participants);
        console.log('📊 Contagem de participantes:', participants.length);
        this._participants.set(participants);
        console.log('✅ Signal _participants atualizado:', this._participants());
        console.log('📊 Contagem após atualização:', this.count());
      },
      error: (error) => {
        console.error('❌ Erro ao carregar participantes:', error);
        // Fallback para dados mock se a API falhar
        this.loadMockParticipants();
      }
    });
  }

  /**
   * Busca participantes da sala via API
   */
  getRoomParticipants(roomCode: string): Observable<LobbyParticipant[]> {
    const url = `${environment.apiUrl}/api/rooms/${roomCode}/participants`;
    console.log('🔍 Buscando participantes da URL:', url);
    console.log('🔍 Room Code:', roomCode);
    console.log('🔍 API URL Base:', environment.apiUrl);
    
    return this.http.get<any[]>(url).pipe(
      tap((participants) => {
        console.log('📋 Dados brutos da API:', participants);
        if (participants && Array.isArray(participants)) {
          participants.forEach(p => {
            console.log(`👤 Participante: ${p.name} | ID: ${p.id} | Cor: ${p.envelope_choice}`);
          });
        } else {
          console.warn('⚠️ Dados da API não são um array:', participants);
        }
      }),
      // Transforma os dados da API para o formato esperado pelo componente
      map((participants: any[]): LobbyParticipant[] => {
        if (!participants || !Array.isArray(participants)) {
          console.warn('⚠️ Dados da API inválidos, retornando array vazio');
          return [];
        }
        
        const transformed = participants.map(p => ({
          id: p.id.toString(), // Converte para string se necessário
          name: p.name,
          envelope_choice: p.envelope_choice,
          status: 'connected' as ConnectionStatus // Por padrão, considera todos conectados
        }));
        
        console.log('🔄 Dados transformados:', transformed);
        return transformed;
      })
    );
  }

  /**
   * Configura listeners do WebSocket seguindo o padrão do angular_implementation.md
   */
  private setupSocketListeners(): void {
    console.log('🔌 Configurando listeners específicos da sala...');
    
    // Participante entrou
    this.socket.on('room:joined', (event: ParticipantJoinEvent) => {
      console.log('🚪 Novo participante entrou:', event);
      
      // Busca participantes atualizados da API
      this.refreshParticipants();
    });

    // Participante saiu
    this.socket.on('room:left', (event: { participant_id: string }) => {
      console.log('🚪 Participante saiu:', event);
      
      // Busca participantes atualizados da API
      this.refreshParticipants();
    });

    // Participante marcou como pronto
    this.socket.on('participant:ready', (event: { participant_id: string; isReady: boolean }) => {
      console.log('✅ Participante pronto:', event);
      
      // Busca participantes atualizados da API para refletir mudanças
      this.refreshParticipants();
    });

    // Status da sala atualizado
    this.socket.on('room:status_updated', (event: RoomStatus) => {
      console.log('🔄 Status da sala atualizado via WebSocket:', event);
      this._roomStatus.set(event);
    });

    // Rodada iniciada
    this.socket.on('round:started', (event: { room_code: string; round: number }) => {
      console.log('🎯 Rodada iniciada via WebSocket:', event);
      // Recarrega o status da sala
      this.loadRoomStatus(event.room_code);
    });
  }

  /**
   * Atualiza a lista de participantes da API
   */
  private refreshParticipants(): void {
    const session = this.home.getSession();
    if (!session?.roomCode) {
      console.warn('⚠️ Sessão não encontrada para atualizar participantes');
      return;
    }
    
    console.log('🔄 Atualizando lista de participantes para sala:', session.roomCode);
    this.getRoomParticipants(session.roomCode).subscribe({
      next: (participants: LobbyParticipant[]) => {
        console.log('🔄 Lista de participantes atualizada:', participants);
        console.log('📊 Nova contagem:', participants.length);
        this._participants.set(participants);
      },
      error: (error) => {
        console.error('❌ Erro ao atualizar participantes:', error);
      }
    });
  }

  /**
   * Fallback para dados mock se a API falhar
   */
  loadMockParticipants(): void {
    console.log('🔄 Carregando participantes mock como fallback...');
    
    const session = this.home.getSession();
    const me: LobbyParticipant | null = session
      ? {
          id: session.participantId,
          name: session.name,
          envelope_choice: session.envelopeHex,
          status: 'connected',
        }
      : null;

    const seed: LobbyParticipant[] = [
      ...(me ? [me] : []),
      {
        id: crypto.randomUUID(),
        name: 'Maria Silva',
        envelope_choice: '#0067b1',
        status: 'connected',
      },
      {
        id: crypto.randomUUID(),
        name: 'João Pereira',
        envelope_choice: '#75b463',
        status: 'connected',
      },
      {
        id: crypto.randomUUID(),
        name: 'Camila Rocha',
        envelope_choice: '#ecc500',
        status: 'connected',
      }
    ];

    console.log('✅ Participantes mock carregados:', seed);
    this._participants.set(seed);
  }

  /**
   * Retorna os participantes "como se viesse do socket".
   * Mantém uma pequena latência pra simular rede.
   */
  listParticipants(roomCode: string): Observable<LobbyParticipant[]> {
    console.log('📋 Listando participantes para sala:', roomCode);
    console.log('📊 Participantes atuais:', this._participants());
    
    // Em um futuro próximo, aqui você ouviria o socket:
    // this.socket.on('room:joined', ...);
    // this.socket.on('room:left', ...);
    return of(this._participants()).pipe(delay(250));
  }

  /**
   * Simula um novo participante entrando (apenas para debug/manual).
   */
  simulateJoin(name: string, envelope_choice: string): void {
    console.log('🎭 Simulando entrada de participante:', { name, envelope_choice });
    
    const next: LobbyParticipant = {
      id: crypto.randomUUID(),
      name,
      envelope_choice,
      status: 'connected',
    };
    
    const currentParticipants = this._participants();
    const newParticipants = [next, ...currentParticipants];
    
    console.log('📊 Participantes antes:', currentParticipants.length);
    console.log('📊 Participantes depois:', newParticipants.length);
    
    this._participants.set(newParticipants);
  }

  /**
   * Configura listeners básicos do socket
   */
  private setupEventListeners(): void {
    console.log('🔌 Configurando listeners básicos do WebSocket...');
    
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor WebSocket');
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Desconectado do servidor WebSocket');
      this.connected$.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão WebSocket:', error);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Erro geral do WebSocket:', error);
    });
  }

  /**
   * Entra na sala via WebSocket
   */
  joinRoom(roomCode: string, participantId: string): void {
    console.log('🚪 Entrando na sala via WebSocket:', { room_id: roomCode, participant_id: participantId });
    this.socket.emit('join_room', { room_id: roomCode, participant_id: participantId });
  }

  /**
   * Sai da sala atual
   */
  leaveRoom(): void {
    console.log('🚪 Saindo da sala...');
    this.socket.emit('leave_room');
    this._participants.set([]);
    console.log('✅ Sala limpa, participantes removidos');
  }

  /**
   * Marca participante como pronto
   */
  setReady(participantId: string, isReady: boolean): void {
    console.log('✅ Marcando participante como pronto:', { participant_id: participantId, is_ready: isReady });
    this.socket.emit('set_ready', { participant_id: participantId, is_ready: isReady });
  }

  /**
   * Inicia a rodada (apenas para facilitadores)
   */
  startRound(roomCode: string): void {
    console.log('🚀 Iniciando rodada para sala:', roomCode);
    
    // Emite evento via WebSocket
    this.socket.emit('start_round', { room_code: roomCode });
    
    // Também chama a API para iniciar a rodada
    this.startRoundViaApi(roomCode);
  }

  /**
   * Inicia a rodada via API
   */
  private startRoundViaApi(roomCode: string): void {
    const url = `${environment.apiUrl}/api/rooms/${roomCode}/next-round`;
    console.log('🚀 Iniciando rodada via API:', url);
    
    this.http.post<any>(url, {}).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        console.log('✅ Rodada iniciada com sucesso:', response);
        // Recarrega o status da sala para atualizar a interface
        this.loadRoomStatus(roomCode);
      },
      error: (error) => {
        console.error('❌ Erro ao iniciar rodada:', error);
        // Mesmo com erro, tenta recarregar o status
        this.loadRoomStatus(roomCode);
      }
    });
  }

  /**
   * Finaliza a rodada
   */
  finishRound(roomCode: string): void {
    console.log('🏁 Finalizando rodada para sala:', roomCode);
    this.socket.emit('finish_round', { room_code: roomCode });
  }

  /**
   * Carrega o status atual da sala
   */
  private async loadRoomStatus(roomCode: string): Promise<void> {
    try {
      console.log('🔄 Carregando status da sala:', roomCode);
      const result = await firstValueFrom(this.getRoomStatus(roomCode));
      if (result) {
        console.log('✅ Status da sala carregado com sucesso:', result);
        this._roomStatus.set(result);
        console.log('✅ Signal _roomStatus atualizado:', this._roomStatus());
        this.checkAndRedirect(result);
      } else {
        console.warn('⚠️ Status da sala retornou null/undefined');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar status da sala:', error);
      // Em caso de erro, tenta definir um status padrão
      const defaultStatus = {
        status: 'lobby',
        current_round: 0,
        max_rounds: 0,
        participants_count: 0,
        round_progress: {
          participants: 0,
          expected_votes: 0,
          current_votes: 0,
          progress_pct: 0.0
        }
      };
      console.log('🔄 Definindo status padrão:', defaultStatus);
      this._roomStatus.set(defaultStatus);
    }
  }

  /**
   * Inicia monitoramento periódico do status da sala
   */
  private startStatusMonitoring(roomCode: string): void {
    console.log('🔄 Iniciando monitoramento do status da sala:', roomCode);
    
    // Verifica status a cada 5 segundos
    const interval = setInterval(() => {
      if (this.destroy$.closed) {
        console.log('🛑 Monitoramento interrompido - serviço destruído');
        clearInterval(interval);
        return;
      }
      console.log('🔄 Verificando status da sala...');
      this.loadRoomStatus(roomCode);
    }, 5000);

    // Limpa o intervalo quando o serviço for destruído
    this.destroy$.subscribe(() => {
      console.log('🛑 Limpando intervalo de monitoramento');
      clearInterval(interval);
    });
  }

  /**
   * Verifica se deve redirecionar o usuário baseado no status da rodada
   */
  private checkAndRedirect(roomStatus: RoomStatus): void {
    console.log('🔍 Verificando status da rodada:', roomStatus.status);
    console.log('📊 Rodada atual:', roomStatus.current_round, 'de', roomStatus.max_rounds);
    
    // Verifica se a rodada atual é maior que o total de rodadas
    if (roomStatus.current_round > roomStatus.max_rounds) {
      console.log('🏁 Todas as rodadas foram concluídas, redirecionando para Resultados...');
      this.redirectToResults();
      return;
    }
    
    switch (roomStatus.status) {
      case 'rodada_0':
        console.log('🎯 Redirecionando para Rodada Zero...');
        this.router.navigate(['/rodada-zero']);
        break;
      case 'rodada_1':
        console.log('🎯 Redirecionando para Rodada 1...');
        this.router.navigate(['/rodada']);
        break;
      case 'rodada_2':
        console.log('🎯 Redirecionando para Rodada 2...');
        this.router.navigate(['/rodada']);
        break;
      case 'finalizado':
        console.log('🏁 Redirecionando para Resultados...');
        this.redirectToResults();
        break;
      default:
        console.log('🔄 Mantendo no lobby...');
        break;
    }
  }

  /**
   * Redireciona para a tela de resultados com os parâmetros corretos
   */
  private redirectToResults(): void {
    console.log('🏁 Redirecionando para resultados...');
    const session = this.home.getSession();
    if (session) {
      console.log('✅ Sessão encontrada, redirecionando para:', ['/resultados', session.roomCode, session.participantId]);
      this.router.navigate(['/resultados', session.roomCode, session.participantId]);
    } else {
      console.error('❌ Sessão não encontrada para redirecionamento');
      this.router.navigate(['/']);
    }
  }

  /**
   * Busca o status atual da sala via API
   */
  getRoomStatus(roomCode: string): Observable<RoomStatus> {
    const url = `${environment.apiUrl}/api/rooms/${roomCode}/status`;
    console.log('🔍 Buscando status da sala:', url);
    
    return this.http.get<RoomStatus>(url).pipe(
      tap(status => {
        console.log('✅ Status da sala carregado:', status);
        if (status) {
          console.log('📊 Detalhes do status:', {
            status: status.status,
            current_round: status.current_round,
            max_rounds: status.max_rounds,
            participants_count: status.participants_count
          });
        }
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Método público para recarregar todos os dados da sala
   */
  refreshRoomData(roomCode: string): void {
    console.log('🔄 Recarregando dados da sala:', roomCode);
    
    // Recarrega participantes
    this.loadParticipantsFromApi(roomCode);
    
    // Recarrega status
    this.loadRoomStatus(roomCode);
    
    console.log('✅ Recarregamento de dados iniciado');
  }

  ngOnDestroy(): void {
    console.log('🛑 Destruindo LobbyService...');
    this.destroy$.next();
    this.destroy$.complete();
    this.leaveRoom();
    
    // Desconecta o socket
    if (this.socket) {
      console.log('🔌 Desconectando WebSocket...');
      this.socket.disconnect();
    }
  }
}
