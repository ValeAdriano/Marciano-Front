import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { HomeService } from '../home/home.service';

export type ConnectionStatus = 'connected' | 'disconnected';

export interface LobbyParticipant {
  id: string;
  name: string;
  envelopeHex: string; // cor do envelope (hex)
  status: ConnectionStatus;
}

@Injectable({ providedIn: 'root' })
export class LobbyService {
  private readonly home = inject(HomeService);

  // estado local simulando os "sockets"
  private readonly _participants = signal<LobbyParticipant[]>([]);
  readonly participants = computed(() => this._participants());
  readonly count = computed(() => this._participants().length);

  /**
   * Inicializa a "sala": inclui o usuário atual (persistido pelo HomeService)
   * e alguns participantes fake, só para visual.
   */
initRoom(roomCode: string): void {
    const session = this.home.getSession();
    const me: LobbyParticipant | null = session
        ? {
                id: session.participantId,
                name: session.name,
                envelopeHex: session.envelopeHex,
                status: 'connected',
            }
        : null;

    // Se já inicializado, evita duplicar
    if (this._participants().length > 0) return;

    const seed: LobbyParticipant[] = [
        ...(me ? [me] : []),

        // MOCKS — podem ser removidos depois que houver backend/socket
        {
            id: crypto.randomUUID(),
            name: 'Maria Silva',
            envelopeHex: '#0067b1',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'João Pereira',
            envelopeHex: '#75b463',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Camila Rocha',
            envelopeHex: '#ecc500',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Lucas Almeida',
            envelopeHex: '#e57373',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Ana Costa',
            envelopeHex: '#ba68c8',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Pedro Santos',
            envelopeHex: '#4dd0e1',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Fernanda Lima',
            envelopeHex: '#ffd54f',
            status: 'connected',
        },
        {
            id: crypto.randomUUID(),
            name: 'Rafael Souza',
            envelopeHex: '#a1887f',
            status: 'connected',
        },
    ];

    this._participants.set(seed);
}

  /**
   * Retorna os participantes "como se viesse do socket".
   * Mantém uma pequena latência pra simular rede.
   */
  listParticipants(roomCode: string): Observable<LobbyParticipant[]> {
    // Em um futuro próximo, aqui você ouviria o socket:
    // this.socket.on('room:joined', ...);
    // this.socket.on('room:left', ...);
    return of(this._participants()).pipe(delay(250));
  }

  /**
   * Simula um novo participante entrando (apenas para debug/manual).
   */
  simulateJoin(name: string, envelopeHex: string): void {
    const next: LobbyParticipant = {
      id: crypto.randomUUID(),
      name,
      envelopeHex,
      status: 'connected',
    };
    this._participants.set([next, ...this._participants()]);
  }
}
