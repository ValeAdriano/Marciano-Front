import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, throwError, catchError } from 'rxjs';

// Tipos
export interface JoinRoomRequest {
  name: string;
  envelopeHex: string;
}

export interface UserSession {
  roomCode: string;        // mantém em string para exibir no front
  participantId: string;   // vem do backend (participant_id)
  name: string;
  envelopeHex: string;
  token?: string | null;
}

// Resposta esperada do backend em POST /rooms/{room_id}/join
interface JoinRoomResponse {
  participant_id: number | string;
  token?: string;
}

const STORAGE_KEY = 'qa:userSession';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly _session = signal<UserSession | null>(this.loadFromStorage());
  readonly session = this._session.asReadonly();

  constructor(private http: HttpClient) {}

  /**
   * Faz POST no backend: /rooms/{room_id}/join  { name }
   * Salva sessão no storage e atualiza o signal.
   */
  joinRoom(roomCode: string, body: JoinRoomRequest): Observable<UserSession> {
    const code = (roomCode ?? '').trim().toUpperCase();

    return this.http
      .post<{ participant_id: string | number; room_id: number; room_code: string; token?: string }>(
        `/rooms/join_by_code`,
        {
          code,
          name: body.name,
          envelope_choice: body.envelopeHex,
        }
      )
      .pipe(
        map((res) => {
          if (!res || res.participant_id == null || !res.room_code) {
            throw new Error('Resposta inválida do servidor');
          }
          const session: UserSession = {
            roomCode: res.room_code,
            participantId: String(res.participant_id),
            name: body.name,
            envelopeHex: body.envelopeHex,
            token: res.token ?? null,
          };
          this.saveToStorage(session);
          this._session.set(session);
          return session;
        }),
        catchError((err: HttpErrorResponse) => {
          const detail =
            (err.error && (err.error.detail || err.error.message)) ||
            (typeof err.error === 'string' ? err.error : '') ||
            `Erro ${err.status || ''}`;
          return throwError(() => new Error(detail));
        })
      );
  }


  getSession(): UserSession | null {
    return this.session();
  }

  clearSession(): void {
    this._session.set(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  updateEnvelope(hex: string): void {
    const s = this.session();
    if (!s) return;
    const updated = { ...s, envelopeHex: hex };
    this._session.set(updated);
    this.saveToStorage(updated);
  }

  private saveToStorage(session: UserSession): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }

  private loadFromStorage(): UserSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as UserSession;
    } catch {
      return null;
    }
  }
}
