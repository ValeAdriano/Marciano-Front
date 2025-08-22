import { Injectable, inject, OnDestroy, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { 
  SocketEvent, 
  SocketMessage, 
  RoomJoinedEvent, 
  ParticipantJoinedEvent, 
  ParticipantLeftEvent,
  RoundStartedEvent,
  RoundFinishedEvent,
  ParticipantReadyEvent
} from '../types/api.types';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly baseUrl = environment.socketUrl;
  
  // Estado da conexão
  private readonly _isConnected = signal<boolean>(false);
  readonly isConnected = this._isConnected.asReadonly();
  
  // Estado da sala atual
  private readonly _currentRoom = signal<string | null>(null);
  readonly currentRoom = this._currentRoom.asReadonly();
  
  // Eventos recebidos
  private readonly _lastEvent = signal<SocketEvent | null>(null);
  readonly lastEvent = this._lastEvent.asReadonly();
  
  // Subjects para eventos específicos
  private readonly roomJoinedSubject = new Subject<RoomJoinedEvent>();
  private readonly participantJoinedSubject = new Subject<ParticipantJoinedEvent>();
  private readonly participantLeftSubject = new Subject<ParticipantLeftEvent>();
  private readonly roundStartedSubject = new Subject<RoundStartedEvent>();
  private readonly roundFinishedSubject = new Subject<RoundFinishedEvent>();
  private readonly participantReadySubject = new Subject<ParticipantReadyEvent>();
  private readonly errorSubject = new Subject<string>();
  
  // Observables públicos
  readonly onRoomJoined$ = this.roomJoinedSubject.asObservable();
  readonly onParticipantJoined$ = this.participantJoinedSubject.asObservable();
  readonly onParticipantLeft$ = this.participantLeftSubject.asObservable();
  readonly onRoundStarted$ = this.roundStartedSubject.asObservable();
  readonly onRoundFinished$ = this.roundFinishedSubject.asObservable();
  readonly onParticipantReady$ = this.participantReadySubject.asObservable();
  readonly onError$ = this.errorSubject.asObservable();

  constructor() {
    this.initializeSocket();
  }

  /**
   * Inicializa a conexão Socket.IO
   */
  private initializeSocket(): void {
    try {
      this.socket = io(this.baseUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: environment.socket.reconnectionAttempts,
        reconnectionDelay: environment.socket.reconnectionDelay,
        timeout: environment.socket.timeout
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Erro ao inicializar Socket.IO:', error);
      this.errorSubject.next('Erro ao conectar com o servidor');
    }
  }

  /**
   * Configura os listeners de eventos do socket
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Eventos de conexão
    this.socket.on('connect', () => {
      console.log('Socket conectado:', this.socket?.id);
      this._isConnected.set(true);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket desconectado:', reason);
      this._isConnected.set(false);
      this._currentRoom.set(null);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Erro de conexão:', error);
      this.errorSubject.next('Erro de conexão com o servidor');
    });

    // Eventos de sala
    this.socket.on('room:joined', (data: RoomJoinedEvent) => {
      console.log('Entrou na sala:', data);
      this._currentRoom.set(data.room.code);
      this.roomJoinedSubject.next(data);
      this._lastEvent.set({
        event: 'room:joined',
        data,
        timestamp: new Date()
      });
    });

    this.socket.on('room:left', () => {
      console.log('Saiu da sala');
      this._currentRoom.set(null);
      this._lastEvent.set({
        event: 'room:left',
        data: null,
        timestamp: new Date()
      });
    });

    // Eventos de participantes
    this.socket.on('participant:joined', (data: ParticipantJoinedEvent) => {
      console.log('Participante entrou:', data);
      this.participantJoinedSubject.next(data);
      this._lastEvent.set({
        event: 'participant:joined',
        data,
        timestamp: new Date()
      });
    });

    this.socket.on('participant:left', (data: ParticipantLeftEvent) => {
      console.log('Participante saiu:', data);
      this.participantLeftSubject.next(data);
      this._lastEvent.set({
        event: 'participant:left',
        data,
        timestamp: new Date()
      });
    });

    this.socket.on('participant:ready', (data: ParticipantReadyEvent) => {
      console.log('Participante pronto:', data);
      this.participantReadySubject.next(data);
      this._lastEvent.set({
        event: 'participant:ready',
        data,
        timestamp: new Date()
      });
    });

    // Eventos de rodada
    this.socket.on('round:started', (data: RoundStartedEvent) => {
      console.log('Rodada iniciada:', data);
      this.roundStartedSubject.next(data);
      this._lastEvent.set({
        event: 'round:started',
        data,
        timestamp: new Date()
      });
    });

    this.socket.on('round:finished', (data: RoundFinishedEvent) => {
      console.log('Rodada finalizada:', data);
      this.roundFinishedSubject.next(data);
      this._lastEvent.set({
        event: 'round:finished',
        data,
        timestamp: new Date()
      });
    });

    // Eventos de erro
    this.socket.on('error', (error: string) => {
      console.error('Erro do socket:', error);
      this.errorSubject.next(error);
    });
  }

  /**
   * Conecta ao servidor
   */
  connect(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  /**
   * Desconecta do servidor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  /**
   * Entra em uma sala
   */
  joinRoom(roomCode: string, participantId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('room:join', { roomCode, participantId });
    } else {
      this.errorSubject.next('Socket não está conectado');
    }
  }

  /**
   * Sai de uma sala
   */
  leaveRoom(): void {
    if (this.socket && this.socket.connected && this._currentRoom()) {
      this.socket.emit('room:leave', { roomCode: this._currentRoom() });
    }
  }

  /**
   * Marca participante como pronto
   */
  setReady(participantId: string, isReady: boolean): void {
    if (this.socket && this.socket.connected && this._currentRoom()) {
      this.socket.emit('participant:ready', {
        roomCode: this._currentRoom(),
        participantId,
        isReady
      });
    }
  }

  /**
   * Emite evento de início de rodada (apenas para host)
   */
  startRound(roomCode: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('round:start', { roomCode });
    }
  }

  /**
   * Emite evento de finalização de rodada
   */
  finishRound(roomCode: string, roundId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('round:finish', { roomCode, roundId });
    }
  }

  /**
   * Envia mensagem personalizada
   */
  sendMessage(message: SocketMessage): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('message', message);
    }
  }

  /**
   * Verifica se está conectado
   */
  getConnectionStatus(): boolean {
    return this._isConnected();
  }

  /**
   * Obtém o código da sala atual
   */
  getCurrentRoomCode(): string | null {
    return this._currentRoom();
  }

  /**
   * Obtém o último evento recebido
   */
  getLastEvent(): SocketEvent | null {
    return this._lastEvent();
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
