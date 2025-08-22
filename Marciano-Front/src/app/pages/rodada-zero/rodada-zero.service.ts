import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HomeService } from '../home/home.service';

export type Room = {
  id: string;
  code: string;
  title: string;
  status: 'lobby' | 'rodada_0' | 'rodada_1' | 'rodada_2' | 'finalizado';
  current_round: number;
  max_rounds: number;
  round_start_time?: string;
  is_anonymous: boolean;
  created_at: string;
};

export type Participant = {
  id: string;
  room_id: string;
  name: string;
  envelope_choice?: string;
};

export type ApiResponse<T> = { ok: true; data: T } | { ok: false, error: string };

export type SendSelfVoteIn = {
  roomCode: string;
  cardColor: string;
  cardDescription: string;
};

export type RoomStatus = {
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
};

export type VoteResult = {
  success: boolean;
  message: string;
  round_number: number;
};

type SocketEventsOut =
  | { type: 'connected'; socketId: string }
  | { type: 'room:joined'; participants: Participant[] }
  | { type: 'round:started'; totalSeconds: number }
  | { type: 'vote:progress'; progress: number }
  | { type: 'round:finished' }
  | { type: 'results:ready' }
  | { type: 'room:status'; status: RoomStatus };

@Injectable({ providedIn: 'root' })
export class RodadaZeroApiService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly home = inject(HomeService);

  // --------- Socket ---------
  private socket?: Socket;
  private readonly _socketEvents$ = new Subject<SocketEventsOut>();
  readonly socketEvents$ = this._socketEvents$.asObservable();

  private readonly _connected = signal(false);
  readonly connected = computed(() => this._connected());

  private headers(): HttpHeaders {
    return new HttpHeaders({ 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  // ====== Identidade do usuário (vem do localStorage via HomeService) ======
  async getMeByRoomCode(code: string): Promise<ApiResponse<Participant>> {
    try {
      // Buscar do localStorage via HomeService
      const session = this.home.getSession();
      if (!session || session.roomCode !== code) {
        return { ok: false, error: 'Sessão não encontrada ou sala incorreta' };
      }

      // Criar objeto Participant baseado na sessão
      const participant: Participant = {
        id: session.participantId,
        room_id: session.roomCode,
        name: session.name,
        envelope_choice: session.envelopeHex
      };

      return { ok: true, data: participant };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'getMeByRoomCode failed' };
    }
  }

  async sendSelfVote(input: SendSelfVoteIn): Promise<ApiResponse<VoteResult>> {
    const { roomCode, cardColor, cardDescription } = input;

    const me = await this.getMeByRoomCode(roomCode);
    if (!me.ok) {
      return { ok: false, error: `Não foi possível identificar o usuário na sala (${me.error})` };
    }

    const participantId = me.data.id;

    try {
      // Garantir que participantId seja um número válido
      const participantIdNum = parseInt(participantId);
      if (isNaN(participantIdNum)) {
        return { ok: false, error: 'ID do participante inválido' };
      }

      console.log('Enviando voto:', {
        room_code: roomCode,
        from_participant: participantIdNum,
        to_participant: participantIdNum,
        card_color: cardColor,
        card_description: cardDescription
      });

      const obs = this.http.post<VoteResult>(
        `${environment.apiUrl}/api/rooms/${encodeURIComponent(roomCode)}/vote`,
        {
          room_code: roomCode,
          from_participant: participantIdNum,
          to_participant: participantIdNum, // Autoavaliação: mesmo participante
          card_color: cardColor,
          card_description: cardDescription
        },
        { headers: this.headers() }
      );
      const data = await firstValueFrom(obs);

      this._socketEvents$.next({ type: 'vote:progress', progress: 1 });
      return { ok: true, data };
    } catch (e: any) {
      console.error('Erro ao enviar voto:', e);
      return { ok: false, error: e?.message ?? 'sendSelfVote failed' };
    }
  }

  // ====== Status da Sala ======
  async getRoomStatus(roomCode: string): Promise<ApiResponse<RoomStatus>> {
    try {
      const obs = this.http.get<RoomStatus>(
        `${environment.apiUrl}/api/rooms/${encodeURIComponent(roomCode)}/status`,
        { headers: this.headers() }
      );
      const data = await firstValueFrom(obs);
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'getRoomStatus failed' };
    }
  }

  // ====== Socket.IO ======
  connectSocket(roomCode: string) {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      query: { room: roomCode },
      withCredentials: true,
      reconnectionAttempts: environment.socket.reconnectionAttempts,
      reconnectionDelay: environment.socket.reconnectionDelay,
      timeout: environment.socket.timeout,
    });

    const s = this.socket;

    s.on('connect',    () => { 
      this._connected.set(true); 
      this._socketEvents$.next({ type: 'connected', socketId: s.id! }); 
    });
    
    s.on('disconnect', () => this._connected.set(false));
    
    s.on('connect_error', (error) => {
      console.error('Erro de conexão WebSocket:', error);
    });

    s.on('room:joined',    (p: { participants: Participant[] }) =>
      this._socketEvents$.next({ type: 'room:joined', participants: p.participants }));

    s.on('round:started',  (p: { totalSeconds: number }) =>
      this._socketEvents$.next({ type: 'round:started', totalSeconds: p.totalSeconds }));

    s.on('vote:progress',  (p: { progress: number }) =>
      this._socketEvents$.next({ type: 'vote:progress', progress: p.progress }));

    s.on('round:finished', () => this._socketEvents$.next({ type: 'round:finished' }));
    s.on('results:ready',  () => this._socketEvents$.next({ type: 'results:ready' }));
    
    s.on('room:status', (status: RoomStatus) => 
      this._socketEvents$.next({ type: 'room:status', status }));

    // Emitir evento para entrar na sala
    s.emit('join_room', { room_code: roomCode });
  }

  leaveSocketRoom() {
    if (!this.socket) return;
    this.socket.emit('leave');
    this.socket.disconnect();
    this.socket = undefined;
    this._connected.set(false);
  }

  ngOnDestroy(): void {
    this.leaveSocketRoom();
  }
}
