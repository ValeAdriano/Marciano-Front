import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { SocketService } from './socket.service';
import { ApiService } from './api.service';
import { HomeService } from '../../pages/home/home.service';
import { 
  Room, 
  Participant, 
  Round, 
  RoundStartedEvent, 
  RoundFinishedEvent,
  ParticipantReadyEvent
} from '../types/api.types';

export interface GameState {
  room: Room | null;
  currentRound: Round | null;
  participants: Participant[];
  isHost: boolean;
  isReady: boolean;
  gameStatus: 'waiting' | 'playing' | 'finished';
}

@Injectable({
  providedIn: 'root'
})
export class GameStateService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly socket = inject(SocketService);
  private readonly api = inject(ApiService);
  private readonly home = inject(HomeService);
  private readonly destroy$ = new Subject<void>();

  // Estado global do jogo
  private readonly _gameState = signal<GameState>({
    room: null,
    currentRound: null,
    participants: [],
    isHost: false,
    isReady: false,
    gameStatus: 'waiting'
  });

  // Computed values para facilitar o acesso
  readonly gameState = this._gameState.asReadonly();
  readonly room = computed(() => this._gameState().room);
  readonly currentRound = computed(() => this._gameState().currentRound);
  readonly participants = computed(() => this._gameState().participants);
  readonly isHost = computed(() => this._gameState().isHost);
  readonly isReady = computed(() => this._gameState().isReady);
  readonly gameStatus = computed(() => this._gameState().gameStatus);
  readonly participantCount = computed(() => this._gameState().participants.length);

  constructor() {
    this.setupSocketListeners();
  }

  /**
   * Configura listeners do WebSocket para sincronizar o estado
   */
  private setupSocketListeners(): void {
    // Quando entra em uma sala
    this.socket.onRoomJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.updateGameState({
          room: event.room,
          participants: event.participants,
          isHost: event.participants.some(p => p.isHost),
          gameStatus: event.room.status
        });
      });

    // Quando uma rodada é iniciada
    this.socket.onRoundStarted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.updateGameState({
          currentRound: event.round,
          gameStatus: 'playing'
        });
        
        // Navega para a página de rodada
        this.router.navigate(['/rodada']);
      });

    // Quando uma rodada é finalizada
    this.socket.onRoundFinished$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.updateGameState({
          currentRound: event.round,
          gameStatus: 'finished'
        });
        
        // Navega para a página de resultados com parâmetros corretos
        this.redirectToResults();
      });

    // Quando um participante marca como pronto
    this.socket.onParticipantReady$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.updateParticipantReady(event.participantId, event.isReady);
      });

    // Quando um participante entra
    this.socket.onParticipantJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.addParticipant(event.participant);
      });

    // Quando um participante sai
    this.socket.onParticipantLeft$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.removeParticipant(event.participantId);
      });
  }

  /**
   * Atualiza o estado do jogo
   */
  private updateGameState(updates: Partial<GameState>): void {
    this._gameState.update(current => ({ ...current, ...updates }));
  }

  /**
   * Adiciona um participante à lista
   */
  private addParticipant(participant: Participant): void {
    this._gameState.update(current => ({
      ...current,
      participants: [...current.participants, participant]
    }));
  }

  /**
   * Remove um participante da lista
   */
  private removeParticipant(participantId: string): void {
    this._gameState.update(current => ({
      ...current,
      participants: current.participants.filter(p => p.id !== participantId)
    }));
  }

  /**
   * Atualiza o status de "pronto" de um participante
   */
  private updateParticipantReady(participantId: string, isReady: boolean): void {
    this._gameState.update(current => ({
      ...current,
      participants: current.participants.map(p => 
        p.id === participantId ? { ...p, status: isReady ? 'ready' : 'connected' } : p
      )
    }));
  }

  /**
   * Marca o usuário atual como pronto
   */
  setReady(isReady: boolean): void {
    const room = this._gameState().room;
    if (!room) return;

    // Atualiza estado local
    this.updateGameState({ isReady });

    // Envia para o servidor via WebSocket
    this.socket.setReady('current-user-id', isReady); // Ajuste para obter o ID real do usuário
  }

  /**
   * Inicia uma rodada (apenas para host)
   */
  startRound(): void {
    const room = this._gameState().room;
    if (!room || !this._gameState().isHost) return;

    this.socket.startRound(room.code);
  }

  /**
   * Finaliza a rodada atual
   */
  finishRound(): void {
    const room = this._gameState().room;
    const round = this._gameState().currentRound;
    if (!room || !round) return;

    this.socket.finishRound(room.code, round.id);
  }

  /**
   * Limpa o estado do jogo
   */
  clearGameState(): void {
    this._gameState.set({
      room: null,
      currentRound: null,
      participants: [],
      isHost: false,
      isReady: false,
      gameStatus: 'waiting'
    });
  }

  /**
   * Verifica se todos os participantes estão prontos
   */
  areAllParticipantsReady(): boolean {
    const participants = this._gameState().participants;
    return participants.length > 0 && participants.every(p => p.status === 'ready');
  }

  /**
   * Verifica se pode iniciar a rodada
   */
  canStartRound(): boolean {
    return this._gameState().isHost && 
           this._gameState().gameStatus === 'waiting' && 
           this.areAllParticipantsReady();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Redireciona para a tela de resultados com os parâmetros corretos
   */
  private redirectToResults(): void {
    const session = this.home.getSession();
    if (session) {
      this.router.navigate(['/resultados', session.roomCode, session.participantId]);
    } else {
      console.error('Sessão não encontrada para redirecionamento');
      this.router.navigate(['/']);
    }
  }
}
