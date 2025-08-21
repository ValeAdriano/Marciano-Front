// Interfaces para API REST
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Interfaces para salas
export interface Room {
  id: string;
  code: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  maxParticipants: number;
  currentRound: number;
  totalRounds: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoomRequest {
  name: string;
  maxParticipants: number;
  totalRounds: number;
  code: string; // Código gerado no frontend
}

export interface JoinRoomRequest {
  roomCode: string;
  participantName: string;
  envelopeHex: string;
}

// Interfaces para participantes
export interface Participant {
  id: string;
  name: string;
  envelopeHex: string;
  status: 'connected' | 'disconnected' | 'ready';
  isHost: boolean;
  joinedAt: Date;
  lastSeen: Date;
}

// Interfaces para rodadas
export interface Round {
  id: string;
  roomId: string;
  roundNumber: number;
  status: 'waiting' | 'active' | 'finished';
  duration: number; // em segundos
  startedAt?: Date;
  finishedAt?: Date;
  participants: RoundParticipant[];
}

export interface RoundParticipant {
  participantId: string;
  participantName: string;
  envelopeHex: string;
  status: 'waiting' | 'ready' | 'finished';
  score?: number;
  timeSpent?: number;
}

// Interfaces para WebSocket
export interface SocketEvent {
  event: string;
  data: any;
  timestamp: Date;
}

export interface SocketMessage {
  type: 'join' | 'leave' | 'ready' | 'start' | 'finish' | 'error';
  payload: any;
  timestamp: Date;
}

// Eventos do WebSocket
export interface RoomJoinedEvent {
  room: Room;
  participants: Participant[];
}

export interface ParticipantJoinedEvent {
  participant: Participant;
}

export interface ParticipantLeftEvent {
  participantId: string;
}

export interface RoundStartedEvent {
  round: Round;
  duration: number;
}

export interface RoundFinishedEvent {
  round: Round;
  results: RoundParticipant[];
}

export interface ParticipantReadyEvent {
  participantId: string;
  isReady: boolean;
}

// Enums
export enum GameStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished'
}

export enum ParticipantStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  READY = 'ready'
}

export enum RoundStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  FINISHED = 'finished'
}
