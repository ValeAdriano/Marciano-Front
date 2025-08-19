import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { LobbyService, LobbyParticipant } from './lobby.service';
import { HomeService, UserSession } from '../home/home.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lobby.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class LobbyComponent {
  private readonly lobby = inject(LobbyService);
  private readonly home = inject(HomeService);
  private readonly router = inject(Router);

  // participantes (simulados enquanto não há socket)
  readonly participants = signal<LobbyParticipant[]>([]);
  readonly count = computed(() => this.participants().length);

  // sessão atual
  readonly session = signal<UserSession | null>(null);

  // dados da sala
  readonly roomCode = signal<string>('');

  constructor() {
    const s = this.home.getSession();
    if (!s) {
      this.router.navigateByUrl('/');
      return;
    }

    this.session.set(s);
    this.roomCode.set(s.roomCode);

    // popula participantes mock + eu
    this.lobby.initRoom(s.roomCode);
    this.lobby.listParticipants(s.roomCode).subscribe((list) => this.participants.set(list));

    // mantém sync com o service como se fosse socket
    effect(() => {
      this.participants.set(this.lobby.participants());
    });
  }

  // botão: copiar código da sala
  async copyRoomCode(): Promise<void> {
    const code = this.roomCode();
    const env = this.session()?.envelopeHex ?? '#0067b1';
    try {
      await navigator.clipboard.writeText(code);
      await Swal.fire({
        title: 'Código copiado!',
        text: `${code} foi copiado para a área de transferência.`,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: env,
        customClass: { popup: 'swal-copy-popup' },
        didOpen: () => {
          const popup = document.querySelector('.swal-copy-popup') as HTMLElement | null;
          if (popup) {
            popup.style.border = `3px solid ${env}`;
            popup.style.borderRadius = '1rem';
          }
        },
      });
    } catch {
      await Swal.fire({
        title: 'Falha ao copiar',
        text: 'Não foi possível copiar o código. Tente novamente.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: env,
      });
    }
  }

  // badge “Conectado/Desconectado”
  statusClasses(p: LobbyParticipant): string {
    return p.status === 'connected'
      ? 'inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1'
      : 'inline-flex items-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1';
  }
}
