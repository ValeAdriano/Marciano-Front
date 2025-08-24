import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { LobbyService, LobbyParticipant } from './lobby.service';
import { HomeService, UserSession } from '../home/home.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class LobbyComponent implements OnInit, OnDestroy {
  private readonly lobby = inject(LobbyService);
  private readonly home = inject(HomeService);
  private readonly router = inject(Router);

  // participantes (atualizados em tempo real via WebSocket)
  readonly participants = computed(() => this.lobby.participants());
  readonly count = computed(() => this.lobby.count());
  readonly isConnected = computed(() => this.lobby.isConnected());

  // Status da sala
  readonly roomStatus = computed(() => this.lobby.roomStatus());

  // sessão atual
  readonly session = signal<UserSession | null>(null);

  // dados da sala
  readonly roomCode = signal<string>('');

  ngOnInit(): void {
    const s = this.home.getSession();
    if (!s) {
      this.router.navigateByUrl('/');
      return;
    }

    console.log('🚀 Inicializando lobby com sessão:', s);
    this.session.set(s);
    this.roomCode.set(s.roomCode);

    // inicializa a sala e conecta ao WebSocket
    console.log('🔌 Inicializando WebSocket...');
    this.lobby.initRoom(s.roomCode);
    
    // Log adicional para debug
    console.log('🔍 Estado inicial dos signals:');
    console.log('  - participants:', this.participants());
    console.log('  - count:', this.count());
    console.log('  - roomStatus:', this.roomStatus());
    console.log('  - isConnected:', this.isConnected());
    
    // Log adicional para debug
    console.log('✅ Lobby inicializado com sucesso');
    console.log('🔍 Sessão configurada:', this.session());
    console.log('🔍 Código da sala configurado:', this.roomCode());
  }

  ngOnDestroy(): void {
    // Cleanup automático via service
    console.log('🛑 Destruindo componente do lobby...');
    console.log('✅ Cleanup automático via service');
  }

  // Calcula a porcentagem de progresso da votação (máximo 100%)
  getProgressPercentage(): number {
    const status = this.roomStatus();
    if (!status) return 0;
    
    // Só mostrar progresso se estiver em uma rodada ativa
    if (status.status === 'lobby' || status.status === 'finalizado') return 0;
    
    const progress = status.round_progress;
    if (!progress) return 0;
    
    // Calcular porcentagem baseada na rodada atual
    const currentVotes = progress.current_votes;
    const expectedVotes = progress.expected_votes;
    
    if (expectedVotes === 0) return 0;
    
    // Garantir que a porcentagem não exceda 100%
    const percentage = Math.min((currentVotes / expectedVotes) * 100, 100);
    const roundedPercentage = Math.round(percentage);
    
    // Log adicional para debug
    console.log('📊 Progresso da votação:', {
      currentVotes,
      expectedVotes,
      percentage,
      roundedPercentage
    });
    
    return roundedPercentage;
  }

  // Exibe o status da rodada de forma amigável
  getStatusDisplay(status: string | undefined): string {
    if (!status) return 'Carregando...';
    
    const statusMap: { [key: string]: string } = {
      'lobby': '🔄 Lobby - Aguardando início',
      'rodada_0': '🎯 Rodada 0 - Autoavaliação',
      'rodada_1': '🎯 Rodada 1 - Votação',
      'rodada_2': '🎯 Rodada 2 - Votação',
      'rodada_3': '🎯 Rodada 3 - Votação',
      'rodada_4': '🎯 Rodada 4 - Votação',
      'rodada_5': '🎯 Rodada 5 - Votação',
      'rodada_6': '🎯 Rodada 6 - Votação',
      'rodada_7': '🎯 Rodada 7 - Votação',
      'rodada_8': '🎯 Rodada 8 - Votação',
      'rodada_9': '🎯 Rodada 9 - Votação',
      'rodada_10': '🎯 Rodada 10 - Votação',
      'finalizado': '🏁 Jogo Finalizado'
    };
    
    // Se for uma rodada genérica (rodada_X), usar o padrão
    if (status.startsWith('rodada_')) {
      const rodadaNum = status.replace('rodada_', '');
      if (rodadaNum === '0') {
        return '🎯 Rodada 0 - Autoavaliação';
      } else {
        return `🎯 Rodada ${rodadaNum} - Votação`;
      }
    }
    
    const displayStatus = statusMap[status] || status;
    
    // Log adicional para debug
    console.log('🔍 Status da rodada:', { status, displayStatus });
    
    return displayStatus;
  }

  // Verifica se deve mostrar o botão de iniciar rodada
  canStartRound(): boolean {
    const status = this.roomStatus();
    const canStart = status?.status === 'lobby' && this.count() >= 2;
    
    // Log adicional para debug
    console.log('🔍 Pode iniciar rodada:', {
      status: status?.status,
      count: this.count(),
      canStart
    });
    
    return canStart;
  }

  // Verifica se deve mostrar mensagem de redirecionamento
  shouldShowRedirectMessage(): boolean {
    const status = this.roomStatus();
    const shouldShow = status?.status !== 'lobby' && status?.status !== 'finalizado' && status?.status !== undefined;
    
    // Log adicional para debug
    console.log('🔍 Deve mostrar mensagem de redirecionamento:', {
      status: status?.status,
      shouldShow
    });
    
    // Só mostrar mensagem se estiver em uma rodada ativa (não lobby e não finalizado)
    return shouldShow;
  }

  // botão: copiar código da sala
  async copyRoomCode(): Promise<void> {
    const code = this.roomCode();
    const env = this.session()?.envelopeHex ?? '#0067b1';
    
    // Log adicional para debug
    console.log('📋 Copiando código da sala:', { code, env });
    
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
      
      // Log adicional para debug
      console.log('✅ Código copiado com sucesso');
    } catch {
      await Swal.fire({
        title: 'Falha ao copiar',
        text: 'Não foi possível copiar o código. Tente novamente.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: env,
      });
      
      // Log adicional para debug
      console.log('❌ Falha ao copiar código');
    }
  }

  // badge "Conectado/Desconectado"
  statusClasses(p: LobbyParticipant): string {
    const isConnected = p.status === 'connected';
    const classes = isConnected
      ? 'inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1'
      : 'inline-flex items-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1';
    
    // Log adicional para debug
    console.log('🔍 Classes de status:', { participant: p.name, status: p.status, isConnected, classes });
    
    return classes;
  }

  // Inicia a rodada (apenas para facilitadores)
  startRound(): void {
    const roomCode = this.roomCode();
    if (!roomCode) return;

    // Log adicional para debug
    console.log('🚀 Iniciando rodada para sala:', roomCode);

    Swal.fire({
      title: 'Iniciar Rodada?',
      text: 'Tem certeza que deseja iniciar a votação?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Iniciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.lobby.startRound(roomCode);
        
        // Mostra mensagem de sucesso
        Swal.fire({
          title: 'Rodada Iniciada!',
          text: 'A rodada foi iniciada com sucesso. Os participantes serão redirecionados automaticamente.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745'
        });
        
        console.log('✅ Rodada iniciada com sucesso!');
      } else {
        console.log('❌ Início da rodada cancelado pelo usuário');
      }
    });
  }

  // Sai da sala
  leaveRoom(): void {
    // Log adicional para debug
    console.log('🚪 Solicitando saída da sala...');

    Swal.fire({
      title: 'Sair da Sala?',
      text: 'Tem certeza que deseja sair?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Sair',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('✅ Usuário confirmou saída da sala');
        this.lobby.leaveRoom();
        this.router.navigateByUrl('/');
      } else {
        console.log('❌ Saída da sala cancelada pelo usuário');
      }
    });
  }

  // Força atualização da lista de participantes
  refreshParticipants(): void {
    console.log('🔄 Atualizando lista de participantes...');
    console.log('🔍 Sala atual:', this.roomCode());
    console.log('📊 Participantes atuais:', this.count());
    this.lobby.forceRefreshParticipants();
    
    // Log adicional para debug
    console.log('✅ Atualização de participantes solicitada');
  }
}
