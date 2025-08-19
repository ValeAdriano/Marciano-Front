import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { firstValueFrom, Subject } from 'rxjs';

/** Ajuste conforme seu ambiente */
const API_BASE = '/api';
const WS_URL   = '/';

export type Room = {
  id: string;
  code: string;
  title: string;
  status: 'lobby' | 'running' | 'finished';
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
  cardId: string;
};

type SocketEventsOut =
  | { type: 'connected'; socketId: string }
  | { type: 'room:joined'; participants: Participant[] }
  | { type: 'round:started'; totalSeconds: number }
  | { type: 'vote:progress'; progress: number }
  | { type: 'round:finished' }
  | { type: 'results:ready' };

@Injectable({ providedIn: 'root' })
export class RodadaZeroApiService implements OnDestroy {
  private readonly http = inject(HttpClient);

  // --------- Socket ---------
  private socket?: Socket;
  private readonly _socketEvents$ = new Subject<SocketEventsOut>();
  readonly socketEvents$ = this._socketEvents$.asObservable();

  private readonly _connected = signal(false);
  readonly connected = computed(() => this._connected());

  private headers(): HttpHeaders {
    // TODO: anexar Authorization: Bearer <token> se necessário
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  // ====== Identidade do usuário (vem do backend) ======
  async getMeByRoomCode(code: string): Promise<ApiResponse<Participant>> {
    try {
      const obs = this.http.get<Participant>(
        `${API_BASE}/rooms/${encodeURIComponent(code)}/me`,
        { headers: this.headers(), withCredentials: true }
      );
      const data = await firstValueFrom(obs);
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'getMeByRoomCode failed' };
    }
  }

  async sendSelfVote(input: SendSelfVoteIn): Promise<ApiResponse<{ saved: boolean }>> {
    const { roomCode, cardId } = input;

    const me = await this.getMeByRoomCode(roomCode);
    if (!me.ok) {
      return { ok: false, error: `Não foi possível identificar o usuário na sala (${me.error})` };
    }

    const participantId = me.data.id;

    try {
      const obs = this.http.post<{ saved: boolean }>(
        `${API_BASE}/rooms/${encodeURIComponent(roomCode)}/self-vote`,
        // Se o servidor infere pelo cookie/token, troque o body para { cardId }.
        { cardId, participantId },
        { headers: this.headers(), withCredentials: true }
      );
      const data = await firstValueFrom(obs);

      this._socketEvents$.next({ type: 'vote:progress', progress: 1 });
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'sendSelfVote failed' };
    }
  }

  // ====== Socket.IO ======
  connectSocket(roomCode: string) {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      query: { room: roomCode },
      withCredentials: true,
    });

    const s = this.socket;

    s.on('connect',    () => { this._connected.set(true); this._socketEvents$.next({ type: 'connected', socketId: s.id! }); });
    s.on('disconnect', () => this._connected.set(false));

    s.on('room:joined',    (p: { participants: Participant[] }) =>
      this._socketEvents$.next({ type: 'room:joined', participants: p.participants }));

    s.on('round:started',  (p: { totalSeconds: number }) =>
      this._socketEvents$.next({ type: 'round:started', totalSeconds: p.totalSeconds }));

    s.on('vote:progress',  (p: { progress: number }) =>
      this._socketEvents$.next({ type: 'vote:progress', progress: p.progress }));

    s.on('round:finished', () => this._socketEvents$.next({ type: 'round:finished' }));
    s.on('results:ready',  () => this._socketEvents$.next({ type: 'results:ready' }));
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
