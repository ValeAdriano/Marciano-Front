import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HomeService } from '../../pages/home/home.service';

/**
 * Guarda de rota que verifica se o usuário está completamente cadastrado
 * antes de permitir acesso às páginas protegidas.
 * 
 * Verifica se existe no localStorage:
 * - Nome do participante
 * - Cor do envelope escolhida
 * - Código da sala
 * 
 * Se algum desses dados estiver faltando, redireciona para a página inicial.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private readonly router = inject(Router);
  private readonly homeService = inject(HomeService);

  canActivate(): boolean {
    // Verifica se a sessão está completa com todos os dados necessários
    if (!this.homeService.isSessionComplete()) {
      // Usuário não está completamente cadastrado, redireciona para home
      this.router.navigate(['/']);
      return false;
    }
    
    return true;
  }
}

// Função factory para usar com as rotas
export const authGuard: CanActivateFn = (route, state) => {
  const guard = inject(AuthGuard);
  return guard.canActivate();
};
