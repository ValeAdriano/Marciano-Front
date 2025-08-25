import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HomeService } from '../../pages/home/home.service';

export interface RoomStatus {
  status: string;
  current_round?: number;
  max_rounds?: number;
  round_progress?: any;
}

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private readonly router = inject(Router);
  private readonly homeService = inject(HomeService);

  /**
   * Navega para a tela correta baseada no status da sala
   * Evita redirecionamentos desnecessários ao recarregar a página
   */
  navigateToCorrectScreen(status: RoomStatus): void {
    const currentStatus = status.status;
    
    // Se estiver na rodada_0, ir para rodada-zero
    if (currentStatus === 'rodada_0') {
      if (this.router.url !== '/rodada-zero') {
        this.router.navigate(['/rodada-zero']);
      }
    }
    // Se estiver em qualquer rodada de Rodada (rodada_1, rodada_2, etc.), ir para rodada
    else if (currentStatus.startsWith('rodada_') && currentStatus !== 'rodada_0') {
      if (this.router.url !== '/rodada') {
        this.router.navigate(['/rodada']);
      }
    }
    // Se estiver no lobby, ir para lobby
    else if (currentStatus === 'lobby') {
      if (this.router.url !== '/lobby') {
        this.router.navigate(['/lobby']);
      }
    }
    // Se estiver finalizado, ir para resultados
    else if (currentStatus === 'finalizado') {
      const session = this.homeService.getSession();
      if (session) {
        this.router.navigate(['/resultados', session.roomCode, session.participantId]);
      }
    }
  }

  /**
   * Verifica se o usuário está na tela correta para o status atual
   */
  isOnCorrectScreen(status: RoomStatus): boolean {
    const currentStatus = status.status;
    const currentUrl = this.router.url;

    if (currentStatus === 'rodada_0' && currentUrl === '/rodada-zero') {
      return true;
    }
    if (currentStatus.startsWith('rodada_') && currentStatus !== 'rodada_0' && currentUrl === '/rodada') {
      return true;
    }
    if (currentStatus === 'lobby' && currentUrl === '/lobby') {
      return true;
    }
    if (currentStatus === 'finalizado' && currentUrl.startsWith('/resultados')) {
      return true;
    }

    return false;
  }

  /**
   * Navega para a próxima rodada quando necessário
   */
  navigateToNextRound(status: string): void {
    if (status === 'finalizado') {
      const session = this.homeService.getSession();
      if (session) {
        this.router.navigate(['/resultados', session.roomCode, session.participantId]);
      }
    } else if (status.startsWith('rodada_')) {
      const roundNumber = status.replace('rodada_', '');
      if (roundNumber === '0') {
        this.router.navigate(['/rodada-zero']);
      } else {
        this.router.navigate(['/rodada']);
      }
    }
  }
}
