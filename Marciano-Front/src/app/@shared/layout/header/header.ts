import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';            // ← adicione
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],   // ← use CommonModule aqui
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class HeaderComponent {
  menuOpen = false;

  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  closeMenu(): void { this.menuOpen = false; }

  @HostListener('document:keydown.escape') onEscape(): void { this.closeMenu(); }
}
