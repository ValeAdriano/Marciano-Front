import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  ApiResponse, 
  PaginatedResponse, 
  Room, 
  CreateRoomRequest, 
  JoinRoomRequest, 
  Participant,
  Round,
  RoomResults
} from '../types/api.types';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  
  // Base URL da API - configurada via environment
  private readonly baseUrl = environment.apiUrl;
  
  // Headers padrão
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      // Adicione aqui headers de autenticação quando necessário
      // 'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  // Método genérico para tratar erros
  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    
    let errorMessage = 'Ocorreu um erro inesperado';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = 'Dados inválidos';
          break;
        case 401:
          errorMessage = 'Não autorizado';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          errorMessage = 'Recurso não encontrado';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        default:
          errorMessage = `Erro ${error.status}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Método genérico para requisições GET
  private get<T>(endpoint: string, params?: HttpParams): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.http.get<ApiResponse<T>>(url, { 
      headers: this.getHeaders(), 
      params 
    }).pipe(
      map(response => {
        if (response.success && response.data !== undefined) {
          return response.data;
        }
        throw new Error(response.message || 'Resposta inválida da API');
      }),
      catchError(this.handleError)
    );
  }

  // Método genérico para requisições POST
  private post<T>(endpoint: string, data: any): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.http.post<ApiResponse<T>>(url, data, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => {
        if (response.success && response.data !== undefined) {
          return response.data;
        }
        throw new Error(response.message || 'Resposta inválida da API');
      }),
      catchError(this.handleError)
    );
  }

  // Método genérico para requisições PUT
  private put<T>(endpoint: string, data: any): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.http.put<ApiResponse<T>>(url, data, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => {
        if (response.success && response.data !== undefined) {
          return response.data;
        }
        throw new Error(response.message || 'Resposta inválida da API');
      }),
      catchError(this.handleError)
    );
  }

  // Método genérico para requisições DELETE
  private delete<T>(endpoint: string): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.http.delete<ApiResponse<T>>(url, { 
      headers: this.getHeaders() 
    }).pipe(
      map(response => {
        if (response.success && response.data !== undefined) {
          return response.data;
        }
        throw new Error(response.message || 'Resposta inválida da API');
      }),
      catchError(this.handleError)
    );
  }

  // ===== ENDPOINTS PARA SALAS =====
  
  // Criar uma nova sala
  createRoom(request: CreateRoomRequest): Observable<Room> {
    return this.post<Room>('/rooms', request);
  }

  // Obter informações de uma sala
  getRoom(roomCode: string): Observable<Room> {
    return this.get<Room>(`/rooms/${roomCode}`);
  }

  // Entrar em uma sala
  joinRoom(request: JoinRoomRequest): Observable<{ room: Room; participant: Participant }> {
    return this.post<{ room: Room; participant: Participant }>('/rooms/join', request);
  }

  // Sair de uma sala
  leaveRoom(roomCode: string, participantId: string): Observable<void> {
    return this.post<void>(`/rooms/${roomCode}/leave`, { participantId });
  }

  // Obter participantes de uma sala
  getRoomParticipants(roomCode: string): Observable<Participant[]> {
    return this.get<Participant[]>(`/rooms/${roomCode}/participants`);
  }

  // ===== ENDPOINTS PARA RODADAS =====
  
  // Iniciar uma rodada
  startRound(roomCode: string): Observable<Round> {
    return this.post<Round>(`/rooms/${roomCode}/rounds/start`, {});
  }

  // Obter informações da rodada atual
  getCurrentRound(roomCode: string): Observable<Round> {
    return this.get<Round>(`/rooms/${roomCode}/rounds/current`);
  }

  // Finalizar uma rodada
  finishRound(roomCode: string, roundId: string): Observable<Round> {
    return this.post<Round>(`/rooms/${roomCode}/rounds/${roundId}/finish`, {});
  }

  // Marcar participante como pronto
  setParticipantReady(roomCode: string, participantId: string, isReady: boolean): Observable<void> {
    return this.put<void>(`/rooms/${roomCode}/participants/${participantId}/ready`, { isReady });
  }

  // ===== ENDPOINTS PARA RESULTADOS =====
  
  // Obter resultados de uma rodada
  getRoundResults(roomCode: string, roundId: string): Observable<Round> {
    return this.get<Round>(`/rooms/${roomCode}/rounds/${roundId}/results`);
  }

  // Obter histórico de rodadas de uma sala
  getRoomHistory(roomCode: string): Observable<Round[]> {
    return this.get<Round[]>(`/rooms/${roomCode}/history`);
  }

  // ===== ENDPOINTS PARA ESTATÍSTICAS =====
  
  // Obter estatísticas de um participante
  getParticipantStats(participantId: string): Observable<any> {
    return this.get<any>(`/participants/${participantId}/stats`);
  }

  // Obter ranking geral
  getGlobalRanking(): Observable<any[]> {
    return this.get<any[]>('/ranking/global');
  }

  // ===== ENDPOINTS PARA A NOVA API DE RESULTADOS =====
  
  // Obter resultados de todos os participantes de uma sala por ID
  getRoomResultsById(roomId: number): Observable<RoomResults> {
    return this.getRoomResultsDirect(`/api/rooms/results/${roomId}/all`);
  }

  // Obter resultados de todos os participantes de uma sala por código
  getRoomResultsByCode(roomCode: string): Observable<RoomResults> {
    return this.getRoomResultsDirect(`/api/rooms/results/${roomCode}/all`);
  }

  // Método específico para a API de resultados que retorna dados diretamente (sem wrapper ApiResponse)
  private getRoomResultsDirect(endpoint: string): Observable<RoomResults> {
    const url = `${this.baseUrl}${endpoint}`;
    return this.http.get<RoomResults>(url, { 
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }
}
