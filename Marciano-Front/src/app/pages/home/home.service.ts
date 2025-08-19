import { Injectable, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

// Tipos
export interface JoinRoomRequest {
  name: string;
  envelopeHex: string;
}

export interface UserSession {
  roomCode: string;
  participantId: string;
  name: string;
  envelopeHex: string;
  token?: string;
}

const STORAGE_KEY = 'qa:userSession';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly _session = signal<UserSession | null>(this.loadFromStorage());
  readonly session = this._session.asReadonly();

  /**
   * Fake joinRoom
   * Simula uma chamada HTTP retornando status ok,
   * salva a sessão no localStorage.
   */
  joinRoom(roomCode: string, body: JoinRoomRequest): Observable<UserSession> {
    const session: UserSession = {
      roomCode: roomCode.toUpperCase(),
      participantId: crypto.randomUUID(), // gera id fake
      name: body.name,
      envelopeHex: body.envelopeHex,
      token: 'fake-token',
    };

    // salva e atualiza sinal
    this.saveToStorage(session);
    this._session.set(session);

    // retorna como se fosse uma API (delay de 400ms para simular rede)
    return of(session).pipe(delay(400));
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
