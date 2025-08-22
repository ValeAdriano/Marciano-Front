import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Observable, of, delay, takeUntil, Subject, BehaviorSubject, tap } from 'rxjs';
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
    this.socket = io(environment.socketUrl);
    this.setupEventListeners();
  }

  /**
   * Inicializa a sala: conecta ao WebSocket e carrega participantes da API
   */
  initRoom(roomCode: string): void {
    const session = this.home.getSession();
    if (!session) {
      console.error('Sessão não encontrada');
      return;
    }

    // Conecta ao WebSocket se não estiver conectado
    if (!this.socket.connected) {
      this.socket.connect();
    }

    // Entra na sala via WebSocket
    this.joinRoom(roomCode, session.participantId);

    // Configura listeners do WebSocket
    this.setupSocketListeners();

    // Carrega status inicial da sala
    this.loadRoomStatus(roomCode);

    // Inicia monitoramento periódico do status
    this.startStatusMonitoring(roomCode);
  }

  /**
   * Carrega participantes da API seguindo o padrão do angular_implementation.md
   */
  private loadParticipantsFromApi(roomCode: string): void {
    this.getRoomParticipants(roomCode).subscribe({
      next: (participants: LobbyParticipant[]) => {
        console.log('✅ Participantes carregados com sucesso:', participants);
        this._participants.set(participants);
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
    
    return this.http.get<LobbyParticipant[]>(url).pipe(
      tap((participants) => {
        console.log('📋 Dados brutos da API:', participants);
        participants.forEach(p => {
          console.log(`👤 Participante: ${p.name} | ID: ${p.id} | Cor: ${p.envelope_choice}`);
        });
      })
    );
  }

  /**
   * Configura listeners do WebSocket seguindo o padrão do angular_implementation.md
   */
  private setupSocketListeners(): void {
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
  }

  /**
   * Atualiza a lista de participantes da API
   */
  private refreshParticipants(): void {
    const session = this.home.getSession();
    if (!session?.roomCode) return;
    
    this.getRoomParticipants(session.roomCode).subscribe({
      next: (participants: LobbyParticipant[]) => {
        console.log('🔄 Lista de participantes atualizada:', participants);
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

    this._participants.set(seed);
  }

  /**
   * Retorna os participantes "como se viesse do socket".
   * Mantém uma pequena latência pra simular rede.
   */
  listParticipants(roomCode: string): Observable<LobbyParticipant[]> {
    // Em um futuro próximo, aqui você ouviria o socket:
    // this.socket.on('room:joined', ...);
    // this.socket.on('room:left', ...);
    return of(this._participants()).pipe(delay(250));
  }

  /**
   * Simula um novo participante entrando (apenas para debug/manual).
   */
  simulateJoin(name: string, envelope_choice: string): void {
    const next: LobbyParticipant = {
      id: crypto.randomUUID(),
      name,
      envelope_choice,
      status: 'connected',
    };
    this._participants.set([next, ...this._participants()]);
  }

  /**
   * Configura listeners básicos do socket
   */
  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('🔌 Conectado ao servidor WebSocket');
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Desconectado do servidor WebSocket');
      this.connected$.next(false);
    });
  }

  /**
   * Entra na sala via WebSocket
   */
  joinRoom(roomCode: string, participantId: string): void {
    this.socket.emit('join_room', { room_id: roomCode, participant_id: participantId });
  }

  /**
   * Sai da sala atual
   */
  leaveRoom(): void {
    this.socket.emit('leave_room');
    this._participants.set([]);
  }

  /**
   * Marca participante como pronto
   */
  setReady(participantId: string, isReady: boolean): void {
    this.socket.emit('set_ready', { participant_id: participantId, is_ready: isReady });
  }

  /**
   * Inicia a rodada (apenas para facilitadores)
   */
  startRound(roomCode: string): void {
    // Emite evento via WebSocket
    this.socket.emit('start_round', { room_code: roomCode });
    
    // Também chama a API para iniciar a rodada
    this.startRoundViaApi(roomCode);
  }

  /**
   * Inicia a rodada via API
   */
  private startRoundViaApi(roomCode: string): void {
    const url = `${environment.apiUrl}/rooms/${roomCode}/next-round`;
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
    this.socket.emit('finish_round', { room_code: roomCode });
  }

  /**
   * Carrega o status atual da sala
   */
  private async loadRoomStatus(roomCode: string): Promise<void> {
    try {
      const result = await this.getRoomStatus(roomCode).toPromise();
      if (result) {
        this._roomStatus.set(result);
        this.checkAndRedirect(result);
      }
    } catch (error) {
      console.error('Erro ao carregar status da sala:', error);
    }
  }

  /**
   * Inicia monitoramento periódico do status da sala
   */
  private startStatusMonitoring(roomCode: string): void {
    // Verifica status a cada 5 segundos
    const interval = setInterval(() => {
      if (this.destroy$.closed) {
        clearInterval(interval);
        return;
      }
      this.loadRoomStatus(roomCode);
    }, 5000);

    // Limpa o intervalo quando o serviço for destruído
    this.destroy$.subscribe(() => {
      clearInterval(interval);
    });
  }

  /**
   * Verifica se deve redirecionar o usuário baseado no status da rodada
   */
  private checkAndRedirect(roomStatus: RoomStatus): void {
    console.log('🔍 Verificando status da rodada:', roomStatus.status);
    
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
    const session = this.home.getSession();
    if (session) {
      this.router.navigate(['/resultados', session.roomCode, session.participantId]);
    } else {
      console.error('Sessão não encontrada para redirecionamento');
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
      tap(status => console.log('✅ Status da sala carregado:', status)),
      takeUntil(this.destroy$)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.leaveRoom();
    
    // Desconecta o socket
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
