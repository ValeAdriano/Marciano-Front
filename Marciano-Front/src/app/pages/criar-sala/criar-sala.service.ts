import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_BASE = '/api'; // ajuste conforme ambiente (ex.: import.meta.env.NG_APP_API_BASE)

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export type CreateRoomIn = {
  code: string;       // ex.: '7KQ2XJ'
  title: string;      // nome da sala
  isAnonymous: boolean;
};

export type CreatedRoomOut = {
  id: string;
  code: string;
  title: string;
  joinUrl?: string;   // backend pode retornar link para compartilhar
};

export type RoomReport = {
  id: string;
  code: string;
  title: string;
  createdAt: string;  // ISO
  reportUrl: string;  // link para relatório
};

@Injectable({ providedIn: 'root' })
export class CriarSalaApiService {
  private readonly http = inject(HttpClient);

  private headers(): HttpHeaders {
    // Acrescente Authorization se usar Bearer Token, e withCredentials para cookie/sessão
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /** Gera um código alfa-numérico de 6 chars, MAIÚSCULAS, evitando confusões (sem I/1/O/0). */
  generateRoomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out.toUpperCase();
  }

  /** POST /rooms — cria sala (placeholder de integração futura). */
  async createRoom(input: CreateRoomIn): Promise<ApiResponse<CreatedRoomOut>> {
    try {
      const obs = this.http.post<CreatedRoomOut>(
        `${API_BASE}/rooms`,
        input,
        { headers: this.headers(), withCredentials: true }
      );
      const data = await firstValueFrom(obs);
      return { ok: true, data };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'createRoom failed';
      return { ok: false, error: msg };
    }
  }

  /** GET /rooms/reports/mine — lista relatórios das salas do facilitador (placeholder). */
  async listMyRoomReports(): Promise<ApiResponse<RoomReport[]>> {
    try {
      const obs = this.http.get<RoomReport[]>(
        `${API_BASE}/rooms/reports/mine`,
        { headers: this.headers(), withCredentials: true }
      );
      const data = await firstValueFrom(obs);
      return { ok: true, data };
    } catch (e: unknown) {
      // MVP: retorna vazio ao invés de erro para não quebrar a tela
      return { ok: true, data: [] };
    }
  }
}
