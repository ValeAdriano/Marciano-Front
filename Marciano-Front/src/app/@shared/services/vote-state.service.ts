import { Injectable, inject } from '@angular/core';
import { HomeService } from '../../pages/home/home.service';

export interface VoteState {
  roomCode: string;
  roundStatus: string;
  hasVoted: boolean;
  voteData?: {
    cardColor: string;
    cardDescription: string;
    targetId?: string;
  };
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class VoteStateService {
  private readonly homeService = inject(HomeService);
  private readonly STORAGE_KEY = 'qa:voteState';

  /**
   * Verifica se o usuário já votou na rodada atual
   */
  hasVotedInCurrentRound(roomCode: string, roundStatus: string): boolean {
    const voteState = this.getVoteState(roomCode, roundStatus);
    return voteState?.hasVoted || false;
  }

  /**
   * Marca que o usuário votou na rodada atual
   */
  markAsVoted(roomCode: string, roundStatus: string, voteData: {
    cardColor: string;
    cardDescription: string;
    targetId?: string;
  }): void {
    const voteState: VoteState = {
      roomCode,
      roundStatus,
      hasVoted: true,
      voteData,
      timestamp: Date.now()
    };

    this.saveVoteState(roomCode, roundStatus, voteState);
  }

  /**
   * Obtém os dados do voto atual (se existir)
   */
  getCurrentVoteData(roomCode: string, roundStatus: string): {
    cardColor: string;
    cardDescription: string;
    targetId?: string;
  } | null {
    const voteState = this.getVoteState(roomCode, roundStatus);
    return voteState?.voteData || null;
  }

  /**
   * Limpa o estado de votação (útil quando uma nova rodada começa)
   */
  clearVoteState(roomCode: string, roundStatus: string): void {
    this.removeVoteState(roomCode, roundStatus);
  }

  /**
   * Verifica se o estado de votação ainda é válido (não muito antigo)
   */
  isVoteStateValid(roomCode: string, roundStatus: string, maxAgeHours: number = 24): boolean {
    const voteState = this.getVoteState(roomCode, roundStatus);
    if (!voteState) return false;

    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    return (now - voteState.timestamp) < maxAgeMs;
  }

  /**
   * Obtém o estado de votação do localStorage
   */
  private getVoteState(roomCode: string, roundStatus: string): VoteState | null {
    try {
      const key = this.getStorageKey(roomCode, roundStatus);
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const voteState: VoteState = JSON.parse(stored);
      
      // Verificar se o estado ainda é válido (não muito antigo)
      if (!this.isVoteStateValid(roomCode, roundStatus)) {
        this.removeVoteState(roomCode, roundStatus);
        return null;
      }

      return voteState;
    } catch (error) {
      console.warn('Erro ao carregar estado de votação:', error);
      return null;
    }
  }

  /**
   * Salva o estado de votação no localStorage
   */
  private saveVoteState(roomCode: string, roundStatus: string, voteState: VoteState): void {
    try {
      const key = this.getStorageKey(roomCode, roundStatus);
      localStorage.setItem(key, JSON.stringify(voteState));
    } catch (error) {
      console.warn('Erro ao salvar estado de votação:', error);
    }
  }

  /**
   * Remove o estado de votação do localStorage
   */
  private removeVoteState(roomCode: string, roundStatus: string): void {
    try {
      const key = this.getStorageKey(roomCode, roundStatus);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Erro ao remover estado de votação:', error);
    }
  }

  /**
   * Gera uma chave única para o localStorage baseada no código da sala e status da rodada
   */
  private getStorageKey(roomCode: string, roundStatus: string): string {
    const session = this.homeService.getSession();
    const participantId = session?.participantId || 'unknown';
    return `${this.STORAGE_KEY}:${roomCode}:${roundStatus}:${participantId}`;
  }

  /**
   * Limpa todos os estados de votação antigos (útil para limpeza periódica)
   */
  cleanupOldVoteStates(maxAgeHours: number = 24): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_KEY)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const voteState: VoteState = JSON.parse(stored);
              if ((now - voteState.timestamp) > maxAgeMs) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Se não conseguir parsear, remover a chave inválida
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Erro ao limpar estados de votação antigos:', error);
    }
  }
}
