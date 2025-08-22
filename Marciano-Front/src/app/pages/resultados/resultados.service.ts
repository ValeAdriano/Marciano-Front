import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../../@shared/services/api.service';
import { RoomResults, ParticipantResult } from '../../@shared/types/api.types';
import { Observable, map, catchError, of } from 'rxjs';

export type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

export interface ParticipantRow {
  id: string;
  name: string;
  envelopeHex: string;
  votesByColor: Record<Cor, number>;
}

@Injectable({ providedIn: 'root' })
export class ResultadosService {
  private readonly apiService = inject(ApiService);

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

  /** Dados dos resultados da API */
  private readonly _roomResults = signal<RoomResults | null>(null);
  private readonly _currentParticipantId = signal<number | null>(null);

  /** Dados processados para o usuário atual */
  readonly receivedByColor = computed(() => {
    const results = this._roomResults();
    const currentId = this._currentParticipantId();
    
    console.log('🔍 receivedByColor computed:', { 
      results: results, 
      currentId: currentId,
      hasResults: results !== null,
      participantsCount: results?.participants_results?.length
    });
    
    if (!results || currentId === null) {
      console.log('❌ Dados ou ID não disponíveis');
      return this.getEmptyColorData();
    }

    if (!results.participants_results || results.participants_results.length === 0) {
      console.log('❌ Lista de participantes vazia');
      return this.getEmptyColorData();
    }

    const currentParticipant = results.participants_results.find((p: ParticipantResult) => p.participant_id === currentId);
    if (!currentParticipant) {
      console.log('❌ Participante atual não encontrado na lista:', {
        currentId,
        availableIds: results.participants_results.map(p => p.participant_id)
      });
      return this.getEmptyColorData();
    }

    console.log('✅ Participante encontrado:', currentParticipant);
    const processedData = this.processDetailedVotes(currentParticipant.detailed_votes);
    console.log('✅ Dados processados:', processedData);
    return processedData;
  });

  /** Tabela por participante (excluindo o usuário atual) */
  readonly participants = computed(() => {
    const results = this._roomResults();
    const currentId = this._currentParticipantId();
    if (!results || currentId === null) return [];

    return results.participants_results
      .filter((p: ParticipantResult) => p.participant_id !== currentId)
      .map((p: ParticipantResult) => this.mapToParticipantRow(p));
  });

  /** Total geral para o usuário atual */
  readonly total = computed(() =>
    (Object.values(this.receivedByColor()) as number[]).reduce((a, b) => a + b, 0)
  );

  /** Cor dominante para o usuário atual */
  readonly topColor = computed<Cor | null>(() => {
    const map = this.receivedByColor();
    let top: Cor | null = null;
    let max = -1;
    (Object.keys(map) as Cor[]).forEach((c) => {
      if (map[c] > max) { max = map[c]; top = c; }
    });
    return top;
  });

  /** Insight por cor */
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

  /** Carregar resultados da sala */
  loadRoomResults(roomCode: string, currentParticipantId: number): Observable<boolean> {
    console.log('🚀 Carregando resultados para sala:', roomCode, 'participante:', currentParticipantId);
    this._currentParticipantId.set(currentParticipantId);
    
    return this.apiService.getRoomResultsByCode(roomCode).pipe(
      map(results => {
        console.log('📊 Dados recebidos da API:', results);
        
        // Validação dos dados recebidos
        if (!results || !results.participants_results || results.participants_results.length === 0) {
          console.error('❌ Dados inválidos recebidos da API:', results);
          return false;
        }
        
        // Verifica se o participante atual está na lista
        const currentParticipant = results.participants_results.find(
          (p: ParticipantResult) => p.participant_id === currentParticipantId
        );
        
        if (!currentParticipant) {
          console.error('❌ Participante atual não encontrado nos resultados:', {
            currentParticipantId,
            availableIds: results.participants_results.map(p => p.participant_id)
          });
          return false;
        }
        
        console.log('✅ Dados válidos, participante encontrado:', currentParticipant);
        this._roomResults.set(results);
        console.log('✅ Dados armazenados no signal');
        return true;
      }),
      catchError(error => {
        console.error('❌ Erro ao carregar resultados:', error);
        return of(false);
      })
    );
  }

  /** Processar votos detalhados para calcular contagem por cor */
  private processDetailedVotes(detailedVotes: any[]): Record<Cor, number> {
    const result: Record<Cor, number> = this.getEmptyColorData();
    
    detailedVotes.forEach(vote => {
      const cor = this.mapColorNameToCor(vote.card_color);
      if (cor) {
        result[cor]++;
      }
    });
    
    return result;
  }

  /** Mapear participante da API para formato da interface */
  private mapToParticipantRow(participant: ParticipantResult): ParticipantRow {
    const votesByColor = this.processDetailedVotes(participant.detailed_votes);

    return {
      id: participant.participant_id.toString(),
      name: participant.name,
      envelopeHex: participant.envelope_choice, // Usar a cor hex real da API
      votesByColor
    };
  }

  /** Mapear nome da cor da API para enum Cor */
  private mapColorNameToCor(colorName: string): Cor | null {
    const colorMap: Record<string, Cor> = {
      'roxo': 'Roxo',
      'amarelo': 'Amarelo',
      'verde': 'Verde',
      'vermelho': 'Vermelho',
      'laranja': 'Laranja',
      'azul': 'Azul'
    };
    return colorMap[colorName.toLowerCase()] || null;
  }

  /** Dados vazios para cores */
  private getEmptyColorData(): Record<Cor, number> {
    return {
      Azul: 0,
      Amarelo: 0,
      Verde: 0,
      Laranja: 0,
      Vermelho: 0,
      Roxo: 0,
    };
  }

  /** Verificar se os resultados estão disponíveis */
  hasResults(): boolean {
    const results = this._roomResults();
    const hasResults = results !== null && 
                     results.participants_results && 
                     results.participants_results.length > 0;
    
    console.log('🔍 hasResults():', {
      hasResults,
      results: results,
      participantsCount: results?.participants_results?.length,
      currentParticipantId: this._currentParticipantId()
    });
    
    return hasResults;
  }

  /** Obter informações da sala */
  getRoomInfo() {
    return this._roomResults();
  }
}
