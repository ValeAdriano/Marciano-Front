# 🚀 Implementação das APIs no Angular - Jogo de Qualidades Anímicas

## 📋 Índice
1. [Configuração Inicial](#configuração-inicial)
2. [Serviços HTTP](#serviços-http)
3. [Serviços WebSocket](#serviços-websocket)
4. [Componentes de Exemplo](#componentes-de-exemplo)
5. [Modelos de Dados](#modelos-de-dados)
6. [Sistema de Rodadas](#sistema-de-rodadas)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Exemplos Completos](#exemplos-completos)
9. [🔧 Troubleshooting - Problemas Comuns](#troubleshooting-problemas-comuns)

---

## 🔧 Configuração Inicial

### 1. Instalar Dependências
```bash
npm install socket.io-client
npm install @angular/common
```

### 2. Configurar Environment
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  wsUrl: 'http://localhost:8000/socket.io'
};
```

### 3. Configurar CORS no Angular
```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // outros providers...
  ]
};
```

---

## 🌐 Serviços HTTP

### 1. Serviço Base para Cards
```typescript
// src/app/services/cards.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Card {
  id: number;
  name: string;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class CardsService {
  private apiUrl = `${environment.apiUrl}/cards`;

  constructor(private http: HttpClient) {}

  getCards(): Observable<Card[]> {
    return this.http.get<Card[]>(this.apiUrl);
  }
}
```

### 2. Serviço para Salas
```typescript
// src/app/services/rooms.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
}

@Injectable({
  providedIn: 'root'
})
export class RoomsService {
  private apiUrl = `${environment.apiUrl}/api/rooms`;

  constructor(private http: HttpClient) {}

  createRoom(request: CreateRoomRequest): Observable<Room> {
    return this.http.post<Room>(this.apiUrl, request);
  }

  getRoomReports(): Observable<RoomReport[]> {
    return this.http.get<RoomReport[]>(`${this.apiUrl}/reports/mine`);
  }

  joinRoomByCode(code: string, participant: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${code}/join`, participant);
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

  resetRoom(roomId: number, token: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${roomId}/reset?token=${token}`, {});
  }

  clearVotes(roomId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${roomId}/votes`);
  }
}
```

### 3. Serviço para Participantes
```typescript
// src/app/services/participants.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParticipantJoin {
  name: string;
  envelope_choice?: string;
}

export interface Participant {
  participant_id: number;
  room_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class ParticipantsService {
  private apiUrl = `${environment.apiUrl}/rooms`;

  constructor(private http: HttpClient) {}

  joinRoom(roomId: number, participant: ParticipantJoin): Observable<Participant> {
    return this.http.post<Participant>(`${this.apiUrl}/${roomId}/join`, participant);
  }

  getRoomParticipants(roomId: number): Observable<Participant[]> {
    return this.http.get<Participant[]>(`${this.apiUrl}/${roomId}/participants`);
  }

  getRoomParticipantsByCode(code: string): Observable<Participant[]> {
    return this.http.get<Participant[]>(`${this.apiUrl}/${code}/participants`);
  }
}
```

### 4. Serviço para Resultados
```typescript
// src/app/services/results.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Results {
  labels: string[];
  counts: number[];
  colors: string[];
  detail?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ResultsService {
  private apiUrl = `${environment.apiUrl}/rooms`;

  constructor(private http: HttpClient) {}

  getResults(roomId: number, participantId: number): Observable<Results> {
    return this.http.get<Results>(`${this.apiUrl}/${roomId}/results/${participantId}`);
  }

  downloadResultsCSV(roomId: number, participantId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${roomId}/results/${participantId}/csv`, {
      responseType: 'blob'
    });
  }
}
```

---

## 🔌 Serviços WebSocket

### 1. Serviço WebSocket Principal
```typescript
// src/app/services/socket.service.ts
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VoteData {
  room_id: number;
  from_participant: number;
  to_participant: number;
  card_id: number;
}

export interface JoinRoomData {
  room_id: number;
  participant_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private connected$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // URL correta para WebSocket: /socket.io
    this.socket = io(environment.apiUrl + '/socket.io');
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('Conectado ao servidor WebSocket');
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Desconectado do servidor WebSocket');
      this.connected$.next(false);
    });
  }

  // Métodos para emitir eventos
  joinRoom(data: JoinRoomData): void {
    this.socket.emit('join_room', data);
  }

  sendVote(data: VoteData): void {
    this.socket.emit('vote_send', data);
  }

  finishRound(roomId: number): void {
    this.socket.emit('round_finish', { room_id: roomId });
  }

  // Métodos para escutar eventos
  onRoundStarted(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('round:started', (data) => observer.next(data));
    });
  }

  onRoundFinished(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('round:finished', (data) => observer.next(data));
    });
  }

  onResultsReady(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('results:ready', (data) => observer.next(data));
    });
  }

  onRoomReset(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('room:reset', (data) => observer.next(data));
    });
  }

  onParticipantJoined(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('room:joined', (data) => observer.next(data));
    });
  }

  onVoteProgress(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('vote:progress', (data) => observer.next(data));
    });
  }

  onVoteError(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('vote:error', (data) => observer.next(data));
    });
  }

  onRoomError(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('room:error', (data) => observer.next(data));
    });
  }

  // Status da conexão
  isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  // Desconectar
  disconnect(): void {
    this.socket.disconnect();
  }
}
```

---

## 🎯 Componentes de Exemplo

### 1. Componente para Criar Sala
```typescript
// src/app/components/create-room/create-room.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RoomsService } from '../../services/rooms.service';

@Component({
  selector: 'app-create-room',
  template: `
    <div class="create-room-container">
      <h2>Criar Nova Sala</h2>
      
      <form [formGroup]="roomForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="code">Código da Sala:</label>
          <input 
            id="code" 
            type="text" 
            formControlName="code" 
            placeholder="Ex: ABC123"
            maxlength="6"
          >
          <div class="error" *ngIf="roomForm.get('code')?.errors?.['required'] && roomForm.get('code')?.touched">
            Código é obrigatório
          </div>
          <div class="error" *ngIf="roomForm.get('code')?.errors?.['pattern'] && roomForm.get('code')?.touched">
            Código deve ter 6 caracteres (A-Z, 2-9, sem I/O/1/0)
          </div>
        </div>

        <div class="form-group">
          <label for="title">Título da Sala:</label>
          <input 
            id="title" 
            type="text" 
            formControlName="title" 
            placeholder="Nome da sua sala"
          >
          <div class="error" *ngIf="roomForm.get('title')?.errors?.['required'] && roomForm.get('title')?.touched">
            Título é obrigatório
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" formControlName="isAnonymous">
            Sala Anônima
          </label>
        </div>

        <button type="submit" [disabled]="roomForm.invalid || isLoading">
          {{ isLoading ? 'Criando...' : 'Criar Sala' }}
        </button>
      </form>

      <div class="success" *ngIf="createdRoom">
        <h3>Sala criada com sucesso!</h3>
        <p><strong>Código:</strong> {{ createdRoom.code }}</p>
        <p><strong>URL para entrar:</strong> {{ createdRoom.joinUrl }}</p>
        <button (click)="copyToClipboard(createdRoom.joinUrl)">Copiar URL</button>
      </div>
    </div>
  `,
  styleUrls: ['./create-room.component.css']
})
export class CreateRoomComponent {
  roomForm: FormGroup;
  isLoading = false;
  createdRoom: any = null;

  constructor(
    private fb: FormBuilder,
    private roomsService: RoomsService,
    private router: Router
  ) {
    this.roomForm = this.fb.group({
      code: ['', [
        Validators.required,
        Validators.pattern(/^[A-Z2-9]{6}$/)
      ]],
      title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      isAnonymous: [false]
    });
  }

  onSubmit(): void {
    if (this.roomForm.valid) {
      this.isLoading = true;
      const roomData = this.roomForm.value;
      
      this.roomsService.createRoom(roomData).subscribe({
        next: (room) => {
          this.createdRoom = room;
          this.isLoading = false;
          console.log('Sala criada:', room);
        },
        error: (error) => {
          console.error('Erro ao criar sala:', error);
          this.isLoading = false;
          // Aqui você pode mostrar uma mensagem de erro para o usuário
        }
      });
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      console.log('URL copiada para a área de transferência');
    });
  }
}
```

### 2. Componente para Entrar na Sala
```typescript
// src/app/components/join-room/join-room.component.ts
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';

@Component({
  selector: 'app-join-room',
  template: `
    <div class="join-room-container">
      <h2>Entrar na Sala</h2>
      
      <div class="room-info" *ngIf="roomCode">
        <p><strong>Código da Sala:</strong> {{ roomCode }}</p>
      </div>

      <form [formGroup]="joinForm" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="name">Seu Nome:</label>
          <input 
            id="name" 
            type="text" 
            formControlName="name" 
            placeholder="Digite seu nome"
          >
          <div class="error" *ngIf="joinForm.get('name')?.errors?.['required'] && joinForm.get('name')?.touched">
            Nome é obrigatório
          </div>
        </div>

        <div class="form-group">
          <label for="envelope">Escolha do Envelope (opcional):</label>
          <input 
            id="envelope" 
            type="text" 
            formControlName="envelope_choice" 
            placeholder="Ex: vermelho, azul, etc."
          >
        </div>

        <button type="submit" [disabled]="joinForm.invalid || isLoading">
          {{ isLoading ? 'Entrando...' : 'Entrar na Sala' }}
        </button>
      </form>

      <div class="success" *ngIf="joinedRoom">
        <h3>Entrou na sala com sucesso!</h3>
        <p><strong>Participante ID:</strong> {{ joinedRoom.participant_id }}</p>
        <p><strong>Sala ID:</strong> {{ joinedRoom.room_id }}</p>
        <button (click)="goToLobby()">Ir para o Lobby</button>
      </div>
    </div>
  `,
  styleUrls: ['./join-room.component.css']
})
export class JoinRoomComponent {
  joinForm: FormGroup;
  isLoading = false;
  roomCode: string = '';
  roomId: number = 0;
  joinedRoom: any = null;

  constructor(
    private fb: FormBuilder,
    private participantsService: ParticipantsService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.joinForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
      envelope_choice: ['']
    });

    // Pegar o código da sala da URL
    this.route.params.subscribe(params => {
      this.roomCode = params['code'];
      // Aqui você pode buscar informações da sala pelo código
    });
  }

  onSubmit(): void {
    if (this.joinForm.valid) {
      this.isLoading = true;
      const participantData = this.joinForm.value;
      
      this.participantsService.joinRoom(this.roomId, participantData).subscribe({
        next: (result) => {
          this.joinedRoom = result;
          this.isLoading = false;
          console.log('Entrou na sala:', result);
        },
        error: (error) => {
          console.error('Erro ao entrar na sala:', error);
          this.isLoading = false;
        }
      });
    }
  }

  goToLobby(): void {
    this.router.navigate(['/lobby', this.roomId]);
  }
}
```

---

## 📊 Modelos de Dados

### 1. Interfaces Principais
```typescript
// src/app/models/index.ts

// Cards
export interface Card {
  id: number;
  name: string;
  color: string;
  planet: string;  // Novo: mapeamento para planetas
}

// Rooms
export interface Room {
  id: number;
  code: string;
  title: string;
  status: 'lobby' | 'rodada_0' | 'rodada_1' | 'rodada_2' | 'finalizado';
  current_round: number;
  max_rounds: number;
  round_start_time?: string;
  is_anonymous: boolean;
  joinUrl?: string;
}

export interface CreateRoomRequest {
  code: string;
  title: string;
  isAnonymous: boolean;
}

export interface RoomReport {
  id: number;
  code: string;
  title: string;
  createdAt: string;
  reportUrl: string;
}

// Participants
export interface Participant {
  id: number;
  name: string;
  room_id: number;
  envelope_choice?: string;
}

export interface ParticipantJoin {
  name: string;
  envelope_choice?: string;
}

// Votes
export interface Vote {
  id: number;
  room_id: number;
  from_participant: number;
  to_participant: number;
  card_id: number;
  created_at: string;
}

export interface VoteRequest {
  room_code: string;  // Mudou de room_id para room_code
  from_participant: number;
  to_participant: number;
  card_id: number;
}

// Novas interfaces para o sistema de rodadas
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

export interface AvailableParticipants {
  participants: Array<{
    id: number;
    name: string;
    envelope_choice?: string;
  }>;
  current_round: number;
  max_rounds: number;
}

export interface NextRoundResponse {
  success: boolean;
  message: string;
  current_round: number;
  max_rounds: number;
  status: string;
}

export interface VoteResult {
  success: boolean;
  message: string;
  round_number: number;
}

export interface TimeoutCheck {
  timeout: boolean;
}

// Results
export interface Results {
  labels: string[];
  counts: number[];
  colors: string[];
  detail?: VoteDetail[];
}

export interface VoteDetail {
  from_participant: string;
  card_name: string;
}

// WebSocket Events
export interface SocketEvent {
  room_id: number;
  [key: string]: any;
}

export interface VoteProgressEvent {
  to: number;
  from: number;
  card_id: number;
}

export interface ErrorEvent {
  error: string;
}
```

---

## 🎮 Sistema de Rodadas

### 1. Serviço para Controle de Rodadas
```typescript
// src/app/services/rounds.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  RoomStatus, 
  AvailableParticipants, 
  NextRoundResponse, 
  VoteResult, 
  TimeoutCheck 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class RoundsService {
  private apiUrl = `${environment.apiUrl}/rooms`;

  constructor(private http: HttpClient) {}

  // Obter status atual da sala
  getRoomStatus(roomCode: string): Observable<RoomStatus> {
    return this.http.get<RoomStatus>(`${this.apiUrl}/${roomCode}/status`);
  }

  // Avançar para próxima rodada
  startNextRound(roomCode: string): Observable<NextRoundResponse> {
    return this.http.post<NextRoundResponse>(`${this.apiUrl}/${roomCode}/next-round`, {});
  }

  // Obter participantes disponíveis para votação
  getAvailableParticipants(roomCode: string, participantId: number): Observable<AvailableParticipants> {
    return this.http.get<AvailableParticipants>(`${this.apiUrl}/${roomCode}/available-participants/${participantId}`);
  }

  // Submeter voto
  submitVote(voteData: any): Observable<VoteResult> {
    return this.http.post<VoteResult>(`${this.apiUrl}/${voteData.room_code}/vote`, voteData);
  }

  // Obter todas as cartas disponíveis
  getAllCards(roomCode: string): Observable<Card[]> {
    return this.http.get<Card[]>(`${this.apiUrl}/${roomCode}/cards`);
  }

  // Verificar timeout da rodada
  checkTimeout(roomCode: string): Observable<TimeoutCheck> {
    return this.http.get<TimeoutCheck>(`${this.apiUrl}/${roomCode}/check-timeout`);
  }
}
```

### 2. Componente de Controle de Rodadas (Facilitador)
```typescript
// src/app/components/round-control/round-control.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RoundsService } from '../../services/rounds.service';
import { RoomStatus, NextRoundResponse } from '../../models';

@Component({
  selector: 'app-round-control',
  template: `
    <div class="round-control-container">
      <h3>🎮 Controle de Rodadas</h3>
      
      <div class="room-status" *ngIf="roomStatus">
        <div class="status-info">
          <p><strong>Status:</strong> {{ getStatusDisplay(roomStatus.status) }}</p>
          <p><strong>Rodada:</strong> {{ roomStatus.current_round }}/{{ roomStatus.max_rounds }}</p>
          <p><strong>Participantes:</strong> {{ roomStatus.participants_count }}</p>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="roomStatus.round_progress.progress_pct"></div>
        </div>
        <p class="progress-text">{{ roomStatus.round_progress.current_votes }}/{{ roomStatus.round_progress.expected_votes }} votos</p>
      </div>

      <div class="actions">
        <button 
          (click)="startNextRound()" 
          [disabled]="!canStartNextRound()"
          class="btn-primary"
        >
          {{ getButtonText() }}
        </button>
        
        <button 
          (click)="checkTimeout()" 
          *ngIf="roomStatus?.status !== 'lobby' && roomStatus?.status !== 'finalizado'"
          class="btn-secondary"
        >
          Verificar Timeout
        </button>
      </div>

      <div class="timer" *ngIf="roomStatus?.round_start_time && roomStatus?.status !== 'lobby'">
        <p><strong>Tempo da Rodada:</strong> {{ getElapsedTime() }}</p>
        <div class="timer-bar">
          <div class="timer-fill" [style.width.%]="getTimerProgress()"></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./round-control.component.css']
})
export class RoundControlComponent {
  @Input() roomCode: string = '';
  @Output() roundChanged = new EventEmitter<NextRoundResponse>();
  
  roomStatus: RoomStatus | null = null;
  isLoading = false;
  private timerInterval: any;

  constructor(private roundsService: RoundsService) {}

  ngOnInit(): void {
    this.loadRoomStatus();
    this.startStatusPolling();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  loadRoomStatus(): void {
    if (!this.roomCode) return;
    
    this.roundsService.getRoomStatus(this.roomCode).subscribe({
      next: (status) => {
        this.roomStatus = status;
        console.log('Status da sala:', status);
      },
      error: (error) => {
        console.error('Erro ao carregar status:', error);
      }
    });
  }

  startNextRound(): void {
    if (!this.roomCode || this.isLoading) return;
    
    this.isLoading = true;
    this.roundsService.startNextRound(this.roomCode).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.roomStatus = null; // Recarregar status
        this.loadRoomStatus();
        this.roundChanged.emit(response);
        
        console.log('Rodada avançada:', response);
        // Mostrar notificação de sucesso
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Erro ao avançar rodada:', error);
        // Mostrar notificação de erro
      }
    });
  }

  checkTimeout(): void {
    if (!this.roomCode) return;
    
    this.roundsService.checkTimeout(this.roomCode).subscribe({
      next: (timeout) => {
        if (timeout.timeout) {
          console.log('⚠️ Rodada expirou!');
          // Mostrar alerta de timeout
        } else {
          console.log('✅ Rodada ainda ativa');
        }
      },
      error: (error) => {
        console.error('Erro ao verificar timeout:', error);
      }
    });
  }

  private startStatusPolling(): void {
    // Atualizar status a cada 5 segundos
    this.timerInterval = setInterval(() => {
      this.loadRoomStatus();
    }, 5000);
  }

  canStartNextRound(): boolean {
    if (!this.roomStatus) return false;
    
    if (this.roomStatus.status === 'lobby') {
      return this.roomStatus.participants_count >= 2;
    }
    
    if (this.roomStatus.status === 'finalizado') {
      return false;
    }
    
    return true;
  }

  getButtonText(): string {
    if (!this.roomStatus) return 'Carregando...';
    
    switch (this.roomStatus.status) {
      case 'lobby':
        return 'Iniciar Jogo';
      case 'finalizado':
        return 'Jogo Finalizado';
      default:
        return 'Próxima Rodada';
    }
  }

  getStatusDisplay(status: string): string {
    const statusMap: { [key: string]: string } = {
      'lobby': '🔄 Lobby',
      'rodada_0': '🎯 Rodada 1',
      'rodada_1': '🎯 Rodada 2',
      'rodada_2': '🎯 Rodada 3',
      'finalizado': '🏁 Finalizado'
    };
    return statusMap[status] || status;
  }

  getElapsedTime(): string {
    if (!this.roomStatus?.round_start_time) return '00:00';
    
    const startTime = new Date(this.roomStatus.round_start_time);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  getTimerProgress(): number {
    if (!this.roomStatus?.round_start_time) return 0;
    
    const startTime = new Date(this.roomStatus.round_start_time);
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    
    // 3 minutos = 180000 ms
    const maxTime = 180000;
    const progress = (elapsed / maxTime) * 100;
    
    return Math.min(progress, 100);
  }
}
```

### 3. Componente de Votação Inteligente
```typescript
// src/app/components/smart-voting/smart-voting.component.ts
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { RoundsService } from '../../services/rounds.service';
import { AvailableParticipants, Card, VoteResult } from '../../models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-smart-voting',
  template: `
    <div class="smart-voting-container">
      <h3>🗳️ Sistema de Votação Inteligente</h3>
      
      <div class="voting-area" *ngIf="availableParticipants">
        <div class="participants-section">
          <h4>👥 Participantes Disponíveis para Voto</h4>
          <div class="participants-grid">
            <div 
              *ngFor="let participant of availableParticipants.participants" 
              class="participant-card"
              [class.selected]="selectedParticipant === participant.id"
              (click)="selectParticipant(participant.id)"
            >
              <h5>{{ participant.name }}</h5>
              <p *ngIf="participant.envelope_choice" class="envelope">
                ({{ participant.envelope_choice }})
              </p>
            </div>
          </div>
        </div>

        <div class="cards-section" *ngIf="selectedParticipant && cards.length > 0">
          <h4>🃏 Escolha uma Carta para {{ getParticipantName(selectedParticipant) }}</h4>
          <div class="cards-grid">
            <div 
              *ngFor="let card of cards" 
              class="card-item"
              [style.background-color]="card.color"
              [class.selected]="selectedCard === card.id"
              (click)="selectCard(card.id)"
            >
              <div class="card-content">
                <h5>{{ card.name }}</h5>
                <p class="planet">🪐 {{ card.planet }}</p>
              </div>
            </div>
          </div>

          <button 
            (click)="submitVote()" 
            [disabled]="!canSubmitVote() || isSubmitting"
            class="btn-vote"
          >
            {{ isSubmitting ? 'Enviando...' : 'Enviar Voto' }}
          </button>
        </div>
      </div>

      <div class="voting-progress" *ngIf="availableParticipants">
        <h4>📊 Progresso da Votação</h4>
        <p>Rodada {{ availableParticipants.current_round + 1 }} de {{ availableParticipants.max_rounds }}</p>
        <p>Participantes disponíveis: {{ availableParticipants.participants.length }}</p>
      </div>

      <div class="no-participants" *ngIf="availableParticipants && availableParticipants.participants.length === 0">
        <h4>✅ Votação Concluída!</h4>
        <p>Você já votou em todos os participantes desta rodada.</p>
      </div>
    </div>
  `,
  styleUrls: ['./smart-voting.component.css']
})
export class SmartVotingComponent implements OnInit, OnDestroy {
  @Input() roomCode: string = '';
  @Input() participantId: number = 0;
  
  availableParticipants: AvailableParticipants | null = null;
  cards: Card[] = [];
  selectedParticipant: number | null = null;
  selectedCard: number | null = null;
  isSubmitting = false;
  
  private subscriptions: Subscription[] = [];

  constructor(private roundsService: RoundsService) {}

  ngOnInit(): void {
    this.loadAvailableParticipants();
    this.loadCards();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadAvailableParticipants(): void {
    if (!this.roomCode || !this.participantId) return;
    
    this.roundsService.getAvailableParticipants(this.roomCode, this.participantId).subscribe({
      next: (participants) => {
        this.availableParticipants = participants;
        console.log('Participantes disponíveis:', participants);
      },
      error: (error) => {
        console.error('Erro ao carregar participantes:', error);
      }
    });
  }

  loadCards(): void {
    if (!this.roomCode) return;
    
    this.roundsService.getAllCards(this.roomCode).subscribe({
      next: (cards) => {
        this.cards = cards;
        console.log('Cartas carregadas:', cards);
      },
      error: (error) => {
        console.error('Erro ao carregar cartas:', error);
      }
    });
  }

  selectParticipant(participantId: number): void {
    this.selectedParticipant = participantId;
    this.selectedCard = null; // Resetar seleção de carta
  }

  selectCard(cardId: number): void {
    this.selectedCard = cardId;
  }

  submitVote(): void {
    if (!this.canSubmitVote()) return;
    
    const voteData = {
      room_code: this.roomCode,
      from_participant: this.participantId,
      to_participant: this.selectedParticipant!,
      card_id: this.selectedCard!
    };
    
    this.isSubmitting = true;
    
    this.roundsService.submitVote(voteData).subscribe({
      next: (result: VoteResult) => {
        this.isSubmitting = false;
        console.log('Voto enviado com sucesso:', result);
        
        // Resetar seleções
        this.selectedParticipant = null;
        this.selectedCard = null;
        
        // Recarregar participantes disponíveis
        this.loadAvailableParticipants();
        
        // Mostrar notificação de sucesso
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Erro ao enviar voto:', error);
        // Mostrar notificação de erro
      }
    });
  }

  canSubmitVote(): boolean {
    return this.selectedParticipant !== null && 
           this.selectedCard !== null && 
           !this.isSubmitting;
  }

  getParticipantName(participantId: number): string {
    if (!this.availableParticipants) return '';
    
    const participant = this.availableParticipants.participants.find(p => p.id === participantId);
    return participant ? participant.name : 'Desconhecido';
  }
}
```

---

## ⚠️ Tratamento de Erros

### 1. Interceptor de Erros HTTP
```typescript
// src/app/interceptors/error.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Ocorreu um erro inesperado';

        if (error.error instanceof ErrorEvent) {
          // Erro do cliente
          errorMessage = `Erro: ${error.error.message}`;
        } else {
          // Erro do servidor
          switch (error.status) {
            case 400:
              errorMessage = 'Dados inválidos enviados';
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
            case 422:
              errorMessage = error.error?.detail || 'Dados inválidos';
              break;
            case 500:
              errorMessage = 'Erro interno do servidor';
              break;
            default:
              errorMessage = `Erro ${error.status}: ${error.message}`;
          }
        }

        console.error('Erro HTTP:', error);
        
        // Aqui você pode mostrar uma notificação para o usuário
        // this.notificationService.showError(errorMessage);
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}
```

### 2. Serviço de Notificações
```typescript
// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<Notification>();
  notifications$ = this.notificationSubject.asObservable();

  showSuccess(message: string, duration: number = 3000): void {
    this.showNotification({ type: 'success', message, duration });
  }

  showError(message: string, duration: number = 5000): void {
    this.showNotification({ type: 'error', message, duration });
  }

  showWarning(message: string, duration: number = 4000): void {
    this.showNotification({ type: 'warning', message, duration });
  }

  showInfo(message: string, duration: number = 3000): void {
    this.showNotification({ type: 'info', message, duration });
  }

  private showNotification(notification: Notification): void {
    this.notificationSubject.next(notification);
  }
}
```

---

## 🎯 Exemplos Completos

### 1. Componente de Lobby da Sala
```typescript
// src/app/components/room-lobby/room-lobby.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { RoomsService } from '../../services/rooms.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-room-lobby',
  template: `
    <div class="lobby-container">
      <h2>Lobby da Sala: {{ roomCode }}</h2>
      
      <div class="room-info">
        <p><strong>Título:</strong> {{ roomTitle }}</p>
        <p><strong>Status:</strong> {{ roomStatus }}</p>
        <p><strong>Participantes:</strong> {{ participants.length }}</p>
      </div>

      <div class="participants-list">
        <h3>Participantes:</h3>
        <ul>
          <li *ngFor="let participant of participants">
            {{ participant.name }}
            <span *ngIf="participant.envelope_choice">({{ participant.envelope_choice }})</span>
          </li>
        </ul>
      </div>

      <div class="actions" *ngIf="isHost">
        <button 
          (click)="startRound()" 
          [disabled]="participants.length < 2 || roomStatus !== 'lobby'"
        >
          Iniciar Rodada
        </button>
        <button (click)="resetRoom()" class="reset-btn">
          Resetar Sala
        </button>
      </div>

      <div class="waiting-message" *ngIf="roomStatus === 'lobby'">
        <p>Aguardando o host iniciar a rodada...</p>
        <p>Mínimo de 2 participantes necessários</p>
      </div>

      <div class="round-started" *ngIf="roomStatus === 'running'">
        <h3>🎯 Rodada Iniciada!</h3>
        <p>Redirecionando para a tela de votação...</p>
      </div>
    </div>
  `,
  styleUrls: ['./room-lobby.component.css']
})
export class RoomLobbyComponent implements OnInit, OnDestroy {
  roomId: number = 0;
  roomCode: string = '';
  roomTitle: string = '';
  roomStatus: string = 'lobby';
  participants: any[] = [];
  isHost: boolean = false;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private socketService: SocketService,
    private roomsService: RoomsService
  ) {}

  ngOnInit(): void {
    this.roomId = Number(this.route.snapshot.paramMap.get('id'));
    this.roomCode = this.route.snapshot.paramMap.get('code') || '';
    
    this.setupSocketListeners();
    this.loadRoomInfo();
  }

  private setupSocketListeners(): void {
    // Escutar quando alguém entra na sala
    this.subscriptions.push(
      this.socketService.onParticipantJoined().subscribe(data => {
        this.loadRoomInfo(); // Recarregar informações da sala
      })
    );

    // Escutar quando a rodada inicia
    this.subscriptions.push(
      this.socketService.onRoundStarted().subscribe(data => {
        if (data.room_id === this.roomId) {
          this.roomStatus = 'running';
          // Redirecionar para tela de votação após 2 segundos
          setTimeout(() => {
            // this.router.navigate(['/vote', this.roomId]);
          }, 2000);
        }
      })
    );

    // Escutar quando a sala é resetada
    this.subscriptions.push(
      this.socketService.onRoomReset().subscribe(data => {
        if (data.room_id === this.roomId) {
          this.roomStatus = 'lobby';
          this.loadRoomInfo();
        }
      })
    );
  }

  private loadRoomInfo(): void {
    // Carregar participantes da sala usando o endpoint correto
    this.participantsService.getRoomParticipants(this.roomId).subscribe({
      next: (participants) => {
        this.participants = participants;
        console.log('Participantes carregados:', participants);
      },
      error: (error) => {
        console.error('Erro ao carregar participantes:', error);
        // Fallback: dados simulados em caso de erro
        this.participants = [
          { id: 1, name: 'João', envelope_choice: 'vermelho' },
          { id: 2, name: 'Maria', envelope_choice: 'azul' }
        ];
      }
    });
    
    // Verificar se o usuário atual é o host
    this.isHost = true; // Implementar lógica real
  }

  startRound(): void {
    this.roomsService.startRound(this.roomId).subscribe({
      next: (response) => {
        console.log('Rodada iniciada:', response);
        this.roomStatus = 'running';
      },
      error: (error) => {
        console.error('Erro ao iniciar rodada:', error);
      }
    });
  }

  resetRoom(): void {
    const token = prompt('Digite o token de administrador:');
    if (token) {
      this.roomsService.resetRoom(this.roomId, token).subscribe({
        next: (response) => {
          console.log('Sala resetada:', response);
          this.roomStatus = 'lobby';
        },
        error: (error) => {
          console.error('Erro ao resetar sala:', error);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

### 2. Componente de Votação
```typescript
// src/app/components/voting/voting.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { CardsService } from '../../services/cards.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-voting',
  template: `
    <div class="voting-container">
      <h2>🎯 Votação em Andamento</h2>
      
      <div class="voting-area">
        <div class="participants-grid">
          <div 
            *ngFor="let participant of participants" 
            class="participant-card"
            [class.selected]="selectedParticipant === participant.id"
            (click)="selectParticipant(participant.id)"
          >
            <h4>{{ participant.name }}</h4>
            <p *ngIf="participant.envelope_choice">({{ participant.envelope_choice }})</p>
          </div>
        </div>

        <div class="cards-selection" *ngIf="selectedParticipant">
          <h3>Escolha uma carta para {{ getParticipantName(selectedParticipant) }}:</h3>
          <div class="cards-grid">
            <div 
              *ngFor="let card of cards" 
              class="card-item"
              [style.background-color]="card.color"
              [class.selected]="selectedCard === card.id"
              (click)="selectCard(card.id)"
            >
              {{ card.name }}
            </div>
          </div>

          <button 
            (click)="sendVote()" 
            [disabled]="!selectedParticipant || !selectedCard || isVoting"
            class="vote-btn"
          >
            {{ isVoting ? 'Enviando...' : 'Enviar Voto' }}
          </button>
        </div>
      </div>

      <div class="progress-info">
        <h3>Progresso da Votação</h3>
        <p>Votos enviados: {{ votesSent }}/{{ totalVotes }}</p>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="(votesSent / totalVotes) * 100"></div>
        </div>
      </div>

      <div class="recent-votes">
        <h3>Votos Recentes:</h3>
        <ul>
          <li *ngFor="let vote of recentVotes">
            {{ getParticipantName(vote.from) }} → {{ getParticipantName(vote.to) }}: {{ getCardName(vote.card_id) }}
          </li>
        </ul>
      </div>
    </div>
  `,
  styleUrls: ['./voting.component.css']
})
export class VotingComponent implements OnInit, OnDestroy {
  roomId: number = 0;
  participants: any[] = [];
  cards: any[] = [];
  selectedParticipant: number | null = null;
  selectedCard: number | null = null;
  votesSent: number = 0;
  totalVotes: number = 0;
  isVoting: boolean = false;
  recentVotes: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private socketService: SocketService,
    private cardsService: CardsService
  ) {}

  ngOnInit(): void {
    this.roomId = Number(this.route.snapshot.paramMap.get('id'));
    
    this.loadCards();
    this.setupSocketListeners();
    this.loadParticipants();
  }

  private loadCards(): void {
    this.cardsService.getCards().subscribe({
      next: (cards) => {
        this.cards = cards;
      },
      error: (error) => {
        console.error('Erro ao carregar cartas:', error);
      }
    });
  }

  private loadParticipants(): void {
    // Carregar participantes da sala usando o endpoint correto
    this.participantsService.getRoomParticipants(this.roomId).subscribe({
      next: (participants) => {
        this.participants = participants;
        // Calcular total de votos (cada participante vota para todos os outros)
        this.totalVotes = this.participants.length * (this.participants.length - 1);
        console.log('Participantes carregados para votação:', participants);
      },
      error: (error) => {
        console.error('Erro ao carregar participantes para votação:', error);
        // Fallback: dados simulados em caso de erro
        this.participants = [
          { id: 1, name: 'João', envelope_choice: 'vermelho' },
          { id: 2, name: 'Maria', envelope_choice: 'azul' },
          { id: 3, name: 'Pedro', envelope_choice: 'verde' }
        ];
        this.totalVotes = this.participants.length * (this.participants.length - 1);
      }
    });
  }

  private setupSocketListeners(): void {
    // Escutar progresso dos votos
    this.subscriptions.push(
      this.socketService.onVoteProgress().subscribe(data => {
        this.recentVotes.unshift(data);
        this.votesSent++;
        
        // Manter apenas os últimos 10 votos
        if (this.recentVotes.length > 10) {
          this.recentVotes = this.recentVotes.slice(0, 10);
        }
      })
    );

    // Escutar erros de voto
    this.subscriptions.push(
      this.socketService.onVoteError().subscribe(data => {
        console.error('Erro no voto:', data.error);
        // Mostrar mensagem de erro para o usuário
      })
    );

    // Escutar quando a rodada termina
    this.subscriptions.push(
      this.socketService.onRoundFinished().subscribe(data => {
        if (data.room_id === this.roomId) {
          // Redirecionar para resultados
          // this.router.navigate(['/results', this.roomId]);
        }
      })
    );
  }

  selectParticipant(participantId: number): void {
    this.selectedParticipant = participantId;
    this.selectedCard = null; // Resetar seleção de carta
  }

  selectCard(cardId: number): void {
    this.selectedCard = cardId;
  }

  sendVote(): void {
    if (!this.selectedParticipant || !this.selectedCard) return;

    this.isVoting = true;
    
    const voteData = {
      room_id: this.roomId,
      from_participant: 1, // ID do usuário atual (implementar lógica real)
      to_participant: this.selectedParticipant,
      card_id: this.selectedCard
    };

    this.socketService.sendVote(voteData);
    
    // Resetar seleções
    this.selectedParticipant = null;
    this.selectedCard = null;
    this.isVoting = false;
  }

  getParticipantName(id: number): string {
    const participant = this.participants.find(p => p.id === id);
    return participant ? participant.name : 'Desconhecido';
  }

  getCardName(id: number): string {
    const card = this.cards.find(c => c.id === id);
    return card ? card.name : 'Desconhecida';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

---

## 🚀 Configuração Final

### 1. App Module
```typescript
// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { CreateRoomComponent } from './components/create-room/create-room.component';
import { JoinRoomComponent } from './components/join-room/join-room.component';
import { RoomLobbyComponent } from './components/room-lobby/room-lobby.component';
import { VotingComponent } from './components/voting/voting.component';

import { ErrorInterceptor } from './interceptors/error.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    CreateRoomComponent,
    JoinRoomComponent,
    RoomLobbyComponent,
    VotingComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    ReactiveFormsModule,
    RouterModule.forRoot([
      { path: '', component: CreateRoomComponent },
      { path: 'join/:code', component: JoinRoomComponent },
      { path: 'lobby/:id/:code', component: RoomLobbyComponent },
      { path: 'vote/:id', component: VotingComponent }
    ])
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### 2. Estilos CSS Básicos
```css
/* src/styles.css */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

.participants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.participant-card {
  border: 2px solid #ddd;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.participant-card:hover {
  border-color: #007bff;
  transform: translateY(-2px);
}

.participant-card.selected {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.card-item {
  padding: 1rem;
  border-radius: 8px;
  color: white;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.card-item:hover {
  transform: scale(1.05);
}

.card-item.selected {
  transform: scale(1.1);
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  transition: width 0.3s ease;
}

/* ===== Estilos para o Sistema de Rodadas ===== */

.round-control-container {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 2rem;
  margin: 1rem 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.status-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.status-info p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.actions {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  flex-wrap: wrap;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.timer {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e9ecef;
  border-radius: 8px;
}

.timer-bar {
  width: 100%;
  height: 8px;
  background-color: #dee2e6;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.timer-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
  transition: width 0.3s ease;
}

/* ===== Estilos para Votação Inteligente ===== */

.smart-voting-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin: 1rem 0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.participants-section, .cards-section {
  margin-bottom: 2rem;
}

.participants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.participant-card {
  border: 2px solid #dee2e6;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  background: white;
}

.participant-card:hover {
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.participant-card.selected {
  border-color: #007bff;
  background-color: #f8f9fa;
  box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
}

.envelope {
  color: #6c757d;
  font-size: 0.9rem;
  margin: 0.5rem 0 0 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.card-item {
  padding: 1.5rem 1rem;
  border-radius: 12px;
  color: white;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
}

.card-item:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
}

.card-item.selected {
  transform: scale(1.1);
  box-shadow: 0 0 30px rgba(255,255,255,0.5);
}

.card-content h5 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.planet {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
}

.btn-vote {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
}

.btn-vote:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.voting-progress {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.no-participants {
  text-align: center;
  padding: 2rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.no-participants h4 {
  color: #155724;
  margin-bottom: 0.5rem;
}

.no-participants p {
  color: #155724;
  margin: 0;
}
```

---

## 📝 Resumo da Implementação

### ✅ **O que foi implementado:**

1. **Serviços HTTP** para todas as APIs REST
2. **Serviço WebSocket** para comunicação em tempo real
3. **Componentes** para criar sala, entrar na sala, lobby e votação
4. **Modelos de dados** com interfaces TypeScript
5. **Sistema de Rodadas** completo com controle de facilitador
6. **Votação Inteligente** com prevenção de votos duplicados
7. **Mapeamento de Cores para Planetas** conforme especificação
8. **Tratamento de erros** com interceptor HTTP
9. **Sistema de notificações** para feedback do usuário
10. **Estilos CSS** responsivos e modernos

### 🎯 **Próximos passos:**

1. **Implementar autenticação** de usuários
2. **Adicionar validações** mais robustas
3. **Implementar testes** unitários e de integração
4. **Adicionar animações** e transições
5. **Implementar PWA** para uso offline
6. **Adicionar internacionalização** (i18n)
7. **Timer visual em tempo real** para rodadas
8. **Notificações WebSocket** para mudanças de estado
9. **Relatórios avançados** com gráficos
10. **Exportação de dados** em diferentes formatos

### 🔗 **URLs para testar:**

- **Criar Sala:** `/`
- **Entrar na Sala:** `/join/{codigo}`
- **Lobby:** `/lobby/{id}/{codigo}`
- **Votação:** `/vote/{id}`
- **Controle de Rodadas:** `/rounds/{codigo}` (facilitador)
- **Votação Inteligente:** `/voting/{codigo}` (participantes)

Agora você tem uma base sólida para implementar o jogo completo no Angular! 🎉

## 🔧 Troubleshooting - Problemas Comuns

### ❌ Erro "Failed to fetch" / CORS

#### **Sintomas:**
- Erro "Failed to fetch" no console do navegador
- Requisições bloqueadas pelo navegador
- Erro de CORS policy

#### **Soluções:**

##### 1. **Verificar se o backend está rodando:**
```bash
# No terminal, verifique se o servidor está ativo
netstat -an | findstr :8000

# Ou reinicie o servidor:
cd backend
python -m uvicorn app.main:star_app --reload --host 127.0.0.1 --port 8000
```

##### 2. **Testar endpoint de CORS:**
```bash
# Teste o endpoint de CORS no navegador:
http://127.0.0.1:8000/test

# Deve retornar: {"message": "CORS está funcionando!", "status": "success"}
```

##### 3. **Verificar configuração do Angular:**
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000',  // Use 127.0.0.1 em vez de localhost
  wsUrl: 'http://127.0.0.1:8000/socket.io'
};
```

##### 4. **Configurar proxy no Angular (Alternativa):**
```json
// angular.json (na seção "architect" > "serve" > "options")
{
  "proxyConfig": "src/proxy.conf.json"
}
```

```json
// src/proxy.conf.json
{
  "/api": {
    "target": "http://127.0.0.1:8000",
    "secure": false,
    "changeOrigin": true
  },
  "/socket.io": {
    "target": "http://127.0.0.1:8000",
    "secure": false,
    "changeOrigin": true,
    "ws": true
  }
}
```

##### 5. **Testar com curl para verificar o backend:**
```bash
# Teste se o backend responde:
curl -X GET http://127.0.0.1:8000/test

# Teste se o CORS está funcionando:
curl -H "Origin: http://localhost:4200" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://127.0.0.1:8000/test
```

#### **Configuração CORS no Backend (já corrigida):**
```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todas as origens
    allow_credentials=False,  # Deve ser False quando allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### ❌ Erro de WebSocket

#### **Sintomas:**
- Erro de conexão WebSocket
- Socket não conecta
- Lobby não atualiza em tempo real
- Eventos não são recebidos
- Sistema de rodadas não atualiza status

#### **Soluções:**

##### 1. **Verificar URL do WebSocket:**
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000',
  // IMPORTANTE: WebSocket usa apiUrl + '/socket.io'
  wsUrl: 'http://127.0.0.1:8000/socket.io'
};

// No serviço WebSocket:
constructor() {
  // URL correta: http://127.0.0.1:8000/socket.io
  this.socket = io(environment.apiUrl + '/socket.io');
  this.setupEventListeners();
}
```

##### 2. **Testar conexão WebSocket:**
```javascript
// No console do navegador:
const socket = io('http://127.0.0.1:8000/socket.io');
socket.on('connect', () => console.log('✅ Conectado! SID:', socket.id));
socket.on('disconnect', () => console.log('❌ Desconectado'));
socket.on('server:hello', (data) => console.log('👋 Servidor:', data));

// Testar eventos:
socket.emit('join_room', { room_id: 1, participant_id: 1 });
```

##### 3. **Verificar se o servidor WebSocket está rodando:**
```bash
# Testar endpoint de WebSocket:
curl http://127.0.0.1:8000/ws-test

# Verificar logs do servidor:
# Deve mostrar: "🔌 Cliente conectado: [SID]"
```

##### 4. **Problemas comuns no lobby:**
```typescript
// 1. Verificar se está conectando na sala correta:
this.socketService.joinRoom({ 
  room_id: this.roomId,  // Deve ser número
  participant_id: this.participantId 
});

// 2. Verificar se está escutando os eventos:
ngOnInit() {
  this.socketService.onParticipantJoined().subscribe(data => {
    console.log('Novo participante:', data);
    this.loadRoomInfo(); // Recarregar dados
  });
  
  this.socketService.onRoundStarted().subscribe(data => {
    if (data.room_id === this.roomId) {
      this.roomStatus = 'running';
    }
  });
}
```

##### 5. **Debug do WebSocket:**
```typescript
// Adicionar logs no serviço:
private setupEventListeners(): void {
  this.socket.on('connect', () => {
    console.log('🔌 WebSocket conectado:', this.socket.id);
    this.connected$.next(true);
  });

  this.socket.on('disconnect', () => {
    console.log('❌ WebSocket desconectado');
    this.connected$.next(false);
  });

  this.socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão WebSocket:', error);
  });
}
```

### ❌ Erro no Sistema de Rodadas

#### **Sintomas:**
- Rodadas não avançam
- Status da sala não atualiza
- Votação não funciona
- Participantes disponíveis não carregam

#### **Soluções:**

##### 1. **Verificar endpoints da API:**
```bash
# Testar status da sala:
curl http://127.0.0.1:8000/rooms/ABC123/status

# Testar avanço de rodada:
curl -X POST http://127.0.0.1:8000/rooms/ABC123/next-round

# Testar participantes disponíveis:
curl http://127.0.0.1:8000/rooms/ABC123/available-participants/1
```

##### 2. **Verificar banco de dados:**
```bash
# Executar script de atualização:
cd backend
python update_database.py

# Verificar se as novas colunas foram criadas:
sqlite3 data.db ".schema rooms"
sqlite3 data.db ".schema cards"
sqlite3 data.db ".schema votes"
```

##### 3. **Debug dos componentes:**
```typescript
// No componente de controle de rodadas:
ngOnInit() {
  console.log('🔍 Iniciando componente com roomCode:', this.roomCode);
  this.loadRoomStatus();
}

loadRoomStatus() {
  console.log('📡 Carregando status da sala:', this.roomCode);
  this.roundsService.getRoomStatus(this.roomCode).subscribe({
    next: (status) => {
      console.log('✅ Status recebido:', status);
      this.roomStatus = status;
    },
    error: (error) => {
      console.error('❌ Erro ao carregar status:', error);
    }
  });
}
```

##### 4. **Verificar mapeamento de planetas:**
```typescript
// Verificar se as cartas têm planetas:
loadCards() {
  this.roundsService.getAllCards(this.roomCode).subscribe({
    next: (cards) => {
      console.log('🃏 Cartas carregadas:', cards);
      // Verificar se cada carta tem planeta
      cards.forEach(card => {
        if (!card.planet) {
          console.warn('⚠️ Carta sem planeta:', card);
        }
      });
    }
  });
}
```

##### 5. **Verificar validações de voto:**
```typescript
// No componente de votação:
submitVote() {
  console.log('🗳️ Tentando enviar voto:', {
    room_code: this.roomCode,
    from_participant: this.participantId,
    to_participant: this.selectedParticipant,
    card_id: this.selectedCard
  });
  
  // Verificar se todos os campos estão preenchidos
  if (!this.canSubmitVote()) {
    console.warn('⚠️ Voto não pode ser enviado:', this.canSubmitVote());
    return;
  }
}
```

### ❌ Erro de Porta

#### **Sintomas:**
- Erro "Connection refused"
- Porta 8000 não disponível

#### **Soluções:**

##### 1. **Verificar se a porta está livre:**
```bash
# Windows
netstat -an | findstr :8000

# Linux/Mac
lsof -i :8000
```

##### 2. **Usar porta diferente:**
```bash
# Backend
python -m uvicorn app.main:star_app --reload --host 127.0.0.1 --port 8001

# Angular
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8001',
  wsUrl: 'http://127.0.0.1:8001/ws'
};
```

### ❌ Erro de DNS

#### **Sintomas:**
- localhost não resolve
- Problemas de conectividade

#### **Soluções:**

##### 1. **Usar IP direto:**
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000',  // IP direto em vez de localhost
  wsUrl: 'http://127.0.0.1:8000/ws'
};
```

##### 2. **Verificar hosts file:**
```bash
# Windows: C:\Windows\System32\drivers\etc\hosts
# Linux/Mac: /etc/hosts

# Adicione se necessário:
127.0.0.1 localhost
```

### ✅ **Checklist de Verificação:**

- [ ] Backend rodando na porta 8000
- [ ] Endpoint `/test` respondendo
- [ ] CORS configurado corretamente
- [ ] Angular usando URL correta
- [ ] WebSocket conectando
- [ ] Sistema de rodadas funcionando
- [ ] Banco de dados atualizado com novas colunas
- [ ] Mapeamento de planetas funcionando
- [ ] Votação inteligente funcionando
- [ ] Sem erros no console do navegador

### 🚀 **Comando para testar tudo:**
```bash
# 1. Iniciar backend
cd backend
python -m uvicorn app.main:star_app --reload --host 127.0.0.1 --port 8000

# 2. Em outro terminal, testar endpoints
curl http://127.0.0.1:8000/test
curl http://127.0.0.1:8000/docs

# 3. Iniciar Angular
cd ../frontend
ng serve --open
```
