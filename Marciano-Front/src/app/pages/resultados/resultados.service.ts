import { Injectable, signal, computed } from '@angular/core';

export type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

export interface ParticipantRow {
  id: string;
  name: string;
  envelopeHex: string;
  votesByColor: Record<Cor, number>;
}

@Injectable({ providedIn: 'root' })
export class ResultadosService {
  /** Paleta (tokens do DS) */
  readonly colorHex: Record<Cor, string> = {
    Azul: '#0067b1',
    Amarelo: '#ecc500',
    Verde: '#75b463',
    Laranja: '#f97316',
    Vermelho: '#ef4444',
    Roxo: '#7c3aed',
  };

  /** Mapeamento cor → planeta */
  readonly planetByColor: Record<Cor, string> = {
    Roxo: 'Lua',
    Amarelo: 'Mercúrio',
    Verde: 'Vênus',
    Vermelho: 'Marte',
    Laranja: 'Júpiter',
    Azul: 'Saturno',
  };

  /** Dados fake — substitua por API quando prontos */
  private readonly _receivedByColor = signal<Record<Cor, number>>({
    Laranja: 3,
    Verde: 5,
    Amarelo: 4,
    Azul: 7,
    Vermelho: 2,
    Roxo: 1,
  });

  /** Tabela por participante (fake) */
  private readonly _participants = signal<ParticipantRow[]>([
    {
      id: 'p1',
      name: 'Maria Silva',
      envelopeHex: '#75b463',
      votesByColor: { Azul: 2, Amarelo: 1, Verde: 1, Laranja: 0, Vermelho: 0, Roxo: 0 },
    },
    {
      id: 'p2',
      name: 'João Pereira',
      envelopeHex: '#0067b1',
      votesByColor: { Azul: 1, Amarelo: 1, Verde: 2, Laranja: 1, Vermelho: 1, Roxo: 0 },
    },
    {
      id: 'p3',
      name: 'Camila Rocha',
      envelopeHex: '#ecc500',
      votesByColor: { Azul: 3, Amarelo: 0, Verde: 1, Laranja: 1, Vermelho: 0, Roxo: 1 },
    },
  ]);

  readonly receivedByColor = this._receivedByColor.asReadonly();
  readonly participants = this._participants.asReadonly();

  /** Total geral */
  readonly total = computed(() =>
    (Object.values(this._receivedByColor()) as number[]).reduce((a, b) => a + b, 0)
  );

  /** Cor dominante */
  readonly topColor = computed<Cor | null>(() => {
    const map = this._receivedByColor();
    let top: Cor | null = null;
    let max = -1;
    (Object.keys(map) as Cor[]).forEach((c) => {
      if (map[c] > max) { max = map[c]; top = c; }
    });
    return top;
  });

  /** Insight por cor (mantém sua taxonomia, pode ajustar depois) */
  insightFor(color: Cor | null): string {
    if (!color) return 'Sem dados suficientes para gerar um insight.';
    const dict: Record<Cor, string> = {
      Azul: 'Perfil analítico e focado: prioriza profundidade, consistência e raciocínio crítico.',
      Amarelo: 'Perfil explorador e criativo: estimula mudanças, novas ideias e adaptação.',
      Verde: 'Perfil relacional: preserva a harmonia e o bem-estar do grupo.',
      Laranja: 'Perfil estratégico e organizador: ajuda a planejar e enxergar o todo.',
      Vermelho: 'Perfil de ação: iniciativa, decisão e foco em resultados.',
      Roxo: 'Perfil avaliador: acompanha processos e aprende com o passado.',
    };
    return dict[color];
  }
}
