import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  // Propriedades do componente
  isMenuOpen = false;
  isAuthenticated = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.updateAuthStatus();
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

  // Mostra modal de login
  async showLogin(): Promise<void> {
    const success = await this.authService.showLoginModal();
    if (success) {
      this.updateAuthStatus();
    }
  }

  // Atualiza o status de autenticação
  updateAuthStatus(): void {
    this.isAuthenticated = this.authService.isAuthenticated();
  }
}
