import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HomeService } from '../../pages/home/home.service';
import { AuthService } from './auth.service';

/**
 * Guarda de rota que verifica se o usuário está autenticado
 * antes de permitir acesso às páginas protegidas.
 * 
 * Verifica:
 * 1. Se o usuário está logado (credenciais válidas)
 * 2. Se a sessão está completa com todos os dados necessários
 * 
 * Se algum desses dados estiver faltando, redireciona para a página inicial.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private readonly router = inject(Router);
  private readonly homeService = inject(HomeService);
  private readonly authService = inject(AuthService);

  async canActivate(): Promise<boolean> {
    // Primeiro verifica se o usuário está logado
    if (!this.authService.isAuthenticated()) {
      // Usuário não está logado, mostra modal de login
      const loginSuccess = await this.authService.showLoginModal();
      
      if (!loginSuccess) {
        // Login falhou ou foi cancelado, redireciona para home
        this.router.navigate(['/']);
        return false;
      }
    }

    // Agora verifica se a sessão está completa com todos os dados necessários
    if (!this.homeService.isSessionComplete()) {
      // Usuário não está completamente cadastrado, redireciona para home
      this.router.navigate(['/']);
      return false;
    }
    
    return true;
  }
}

// Função factory para usar com as rotas
export const authGuard: CanActivateFn = async (route, state) => {
  const guard = inject(AuthGuard);
  return await guard.canActivate();
};
