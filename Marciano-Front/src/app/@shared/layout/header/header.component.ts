import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { HomeService } from '../../../pages/home/home.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  // Propriedades do componente
  isMenuOpen = false;
  isAuthenticated = false;
  isSessionComplete = false;
  private touchStartTime = 0;
  private touchStartY = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private homeService: HomeService
  ) {}

  ngOnInit(): void {
    this.updateAuthStatus();
    // Atualizar status periodicamente para detectar mudanças na sessão
    this.startStatusCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Verificar status periodicamente
  private startStatusCheck(): void {
    const checkStatus = () => {
      if (!this.destroy$.closed) {
        this.updateAuthStatus();
        setTimeout(checkStatus, 1000); // Verificar a cada segundo
      }
    };
    checkStatus();
  }

  // Listener para fechar menu ao redimensionar tela
  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 768) {
      this.closeMenu();
    }
  }

  // Listener para fechar menu ao clicar fora
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('header') && this.isMenuOpen) {
      this.closeMenu();
    }
  }

  // Métodos
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  // Fechar menu ao clicar em um link
  onLinkClick(): void {
    this.closeMenu();
  }

  // Melhorar suporte para dispositivos touch
  onTouchStart(event: TouchEvent): void {
    this.touchStartTime = Date.now();
    this.touchStartY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent): void {
    const touchEndTime = Date.now();
    const touchEndY = event.changedTouches[0].clientY;
    const touchDuration = touchEndTime - this.touchStartTime;
    const touchDistance = Math.abs(touchEndY - this.touchStartY);

    // Se foi um toque rápido e sem movimento, considera como clique
    if (touchDuration < 300 && touchDistance < 10) {
      this.toggleMenu();
    }
  }

  // Mostra modal de login
  async showLogin(): Promise<void> {
    try {
      const success = await this.authService.showLoginModal();
      if (success) {
        this.updateAuthStatus();
      }
    } catch (error) {
      console.error('Erro ao mostrar login:', error);
    }
  }

  // Atualiza o status de autenticação e sessão
  updateAuthStatus(): void {
    try {
      this.isAuthenticated = this.authService.isAuthenticated();
      this.isSessionComplete = this.homeService.isSessionComplete();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      this.isAuthenticated = false;
      this.isSessionComplete = false;
    }
  }

  // Verifica se o usuário pode acessar criar sala
  canCreateRoom(): boolean {
    return this.isAuthenticated && this.isSessionComplete;
  }
}
