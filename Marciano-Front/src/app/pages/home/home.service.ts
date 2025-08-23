import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, throwError, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

// Tipos seguindo o padrão do angular_implementation.md
export interface ParticipantJoin {
  name: string;
  envelope_choice: string;
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
  room_id: number;
  room_code: string;
  token?: string;
}

const STORAGE_KEY = 'qa:userSession';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly _session = signal<UserSession | null>(this.loadFromStorage());
  readonly session = this._session.asReadonly();

  constructor(private http: HttpClient) {}

  /**
   * Faz POST no backend: /rooms/{code}/join com nome e envelope_choice
   * Seguindo exatamente o padrão do angular_implementation.md
   */
  joinRoom(roomCode: string, participant: ParticipantJoin): Observable<UserSession> {
    const code = (roomCode ?? '').trim().toUpperCase();

    // POST direto para /rooms/{code}/join
    return this.http
      .post<JoinRoomResponse>(
        `${environment.apiUrl}/api/rooms/${code}/join`,
        {
          name: participant.name,
          envelope_choice: participant.envelope_choice
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
            name: participant.name,
            envelopeHex: participant.envelope_choice,
            token: res.token ?? null,
          };
          this.saveToStorage(session);
          this._session.set(session);
          return session;
        }),
        catchError((err: HttpErrorResponse) => {
          const detail = this.getErrorMessage(err);
          return throwError(() => new Error(detail));
        })
      );
  }

  /**
   * Obtém mensagem de erro customizada baseada no tipo de erro
   */
  private getErrorMessage(err: HttpErrorResponse): string {
    if (err.error instanceof ErrorEvent) {
      return `Erro de conexão: ${err.error.message}`;
    }

    switch (err.status) {
      case 400:
        return err.error?.detail || err.error?.message || 'Dados inválidos enviados para o servidor';
      case 401:
        return 'Não autorizado. Faça login novamente.';
      case 403:
        return 'Acesso negado. Você não tem permissão para esta ação.';
      case 404:
        return 'Sala não encontrada. Verifique o código e tente novamente.';
      case 409:
        return 'Você já está nesta sala ou o nome já está em uso.';
      case 422:
        return err.error?.detail || 'Dados inválidos';
      case 500:
        return 'Erro interno do servidor. Tente novamente em alguns minutos.';
      case 503:
        return 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.';
      default:
        return err.error?.message || `Erro ${err.status || 'desconhecido'}: ${err.message}`;
    }
  }

  getSession(): UserSession | null {
    return this.session();
  }

  /**
   * Verifica se a sessão está completa com todos os dados necessários
   */
  isSessionComplete(): boolean {
    const session = this.getSession();
    return !!(session && 
              session.name && 
              session.envelopeHex && 
              session.roomCode);
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
