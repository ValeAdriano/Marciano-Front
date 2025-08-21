import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CreateRoomRequest {
  code: string;
  title: string;
  isAnonymous: boolean;
}

export interface Room {
  id: number;
  code: string;
  title: string;
  joinUrl: string;
}

export interface RoomReport {
  id: number;
  code: string;
  title: string;
  createdAt: string;
  reportUrl: string;
  status: string;
  currentRound: number;
  maxRounds: number;
  participantsCount: number;
  roundProgress?: {
    currentVotes: number;
    expectedVotes: number;
    progressPct: number;
  };
}

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

export interface DetailedVote {
  from_name: string;
  card_color: string;
  card_description: string;
}

export interface ColorResult {
  color: string;
  planet: string;
  count: number;
}

export interface ParticipantResult {
  participant_id: number;
  name: string;
  envelope_choice: string;
  total_votes: number;
  results_by_color: ColorResult[];
  detailed_votes: DetailedVote[];
}

export interface RoomResults {
  room_id: number;
  room_code: string;
  room_title: string;
  total_participants: number;
  participants_results: ParticipantResult[];
}

@Injectable({
  providedIn: 'root'
})
export class CriarSalaService {
  private apiUrl = `${environment.apiUrl}/api/rooms`;

  constructor(private http: HttpClient) {}

  createRoom(request: CreateRoomRequest): Observable<Room> {
    return this.http.post<Room>(this.apiUrl, request);
  }

  getRoomReports(): Observable<RoomReport[]> {
    return this.http.get<RoomReport[]>(`${this.apiUrl}/reports/mine`);
  }

  getRoomStatus(roomCode: string): Observable<RoomStatus> {
    return this.http.get<RoomStatus>(`${this.apiUrl}/${roomCode}/status`);
  }

  advanceToNextRound(roomCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomCode}/next-round`, {});
  }

  openRoomReport(roomCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${roomCode}/report`);
  }

  joinRoomByCode(code: string, participant: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${code}/join_by_code`, participant);
  }

  startRound(roomId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomId}/start`, {});
  }

  finishRound(roomId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomId}/finish`, {});
  }

  getProgress(roomId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${roomId}/progress`);
  }

  clearVotes(roomId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${roomId}/votes`);
  }

  // ===== FUNCIONALIDADES ADMINISTRATIVAS =====

  /**
   * Deleta uma sala permanentemente
   */
  deleteRoom(roomCode: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${roomCode}`);
  }

  /**
   * Reseta uma sala
   */
  resetRoom(roomCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomCode}/reset`, {});
  }

  /**
   * Limpa todos os votos de uma sala
   */
  clearAllVotes(roomCode: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${roomCode}/votes`);
  }

  /**
   * Finaliza rodada forçadamente
   */
  forceFinishRound(roomCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomCode}/force-finish`, {});
  }

  /**
   * Finaliza sala forçadamente
   */
  forceFinishRoom(roomCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomCode}/force-finish-room`, {});
  }

  /**
   * Obter estatísticas de uma sala
   */
  getRoomStats(roomCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${roomCode}/stats`);
  }

  /**
   * Obter logs de uma sala
   */
  getRoomLogs(roomCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${roomCode}/logs`);
  }

  /**
   * Exportar dados de uma sala
   */
  exportRoomData(roomCode: string, format: 'csv' | 'json' = 'json'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${roomCode}/export?format=${format}`, {
      responseType: 'blob'
    });
  }

  /**
   * Obter todas as salas
   */
  getAllRooms(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/all`);
  }

  /**
   * Obter resultados de todas as rodadas de uma sala
   */
  getRoomResults(roomCode: string): Observable<RoomResults> {
    return this.http.get<RoomResults>(`${this.apiUrl}/results/${roomCode}/all`);
  }
}