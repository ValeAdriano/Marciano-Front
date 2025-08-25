import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { CriarSalaService, CreateRoomRequest, Room, RoomReport, RoomStatus, RoomResults } from './criar-sala.service';
import { SocketService } from '../../@shared/services/socket.service';
import Swal from 'sweetalert2';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-criar-sala',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './criar-sala.html',
  styleUrls: ['./criar-sala.scss']
})
export class CriarSalaComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('resultsChartCanvas', { static: false }) resultsChartCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly criarSalaService = inject(CriarSalaService);
  private readonly socketService = inject(SocketService);

  // Formulário
  form!: FormGroup;

  // Signals
  readonly code = signal<string>('');
  readonly creating = signal<boolean>(false);
  readonly createdRoom = signal<Room | null>(null);
  readonly reports = signal<RoomReport[]>([]);
  readonly loadingReports = signal<boolean>(false);

  // Status das salas
  readonly roomStatuses = signal<Map<string, RoomStatus>>(new Map());
  readonly loadingStatuses = signal<Set<string>>(new Set());
  readonly expandedRooms = signal<Set<string>>(new Set());
  readonly lastUpdateTimes = signal<Map<string, Date>>(new Map());

  // Modal de resultados
  readonly showResultsModal = signal<boolean>(false);
  readonly currentResults = signal<RoomResults | null>(null);
  readonly loadingResults = signal<boolean>(false);
  private resultsChart: Chart | null = null;

  // Cache opcional de charts por participante (evita recriar caso gere mais de uma vez)
  private participantChartCache = new Map<number, string>();

  // Computed
  readonly displayName = computed(() => 'Usuário');

  // Timer para atualizações automáticas
  private updateTimer: any = null;

  ngOnInit(): void {
    this.initForm();
    this.generateCode();
    this.loadReports();
    this.setupSocketListeners();
    this.startAutoUpdate();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resultsChart) this.resultsChart.destroy();
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.socketService.disconnect();
    this.participantChartCache.clear();
  }

  // -------------------- Socket e Atualizações em Tempo Real --------------------

  private setupSocketListeners(): void {
    this.socketService.connect();

    this.socketService.onRoundFinished$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.round && event.round.roomId) this.updateRoomStatusByRoomId(event.round.roomId);
      });

    this.socketService.onRoundStarted$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.round && event.round.roomId) this.updateRoomStatusByRoomId(event.round.roomId);
      });

    this.socketService.onParticipantJoined$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateActiveRooms());

    this.socketService.onParticipantLeft$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateActiveRooms());

    this.socketService.onError$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => this.showSocketError(error));
  }

  private startAutoUpdate(): void {
    this.updateTimer = setInterval(() => this.updateActiveRooms(), 10000);
  }

  private updateActiveRooms(): void {
    const activeRooms = this.reports().filter(r => !this.isRoomFinished(r.code));
    activeRooms.forEach(room => this.loadRoomStatus(room.code));
  }

  private showSocketError(error: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Problema de Conexão',
      text: `Erro de comunicação: ${error}`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000
    });
  }

  private updateRoomStatusByRoomId(roomId: string): void {
    const room = this.reports().find(r => r.id.toString() === roomId);
    if (room) this.loadRoomStatus(room.code);
  }

  // -------------------- Form / Código --------------------

  private initForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]]
    });
  }

  generateRoomCode(): string {
    const alphabet = '23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  generateCode(): void {
    const newCode = this.generateRoomCode();
    this.code.set(newCode);
    Swal.fire({
      icon: 'success',
      title: 'Código Gerado!',
      text: `Novo código: ${newCode}`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }

  copyCode(): void {
    const codeValue = this.code();
    if (!codeValue) return;
    navigator.clipboard.writeText(codeValue).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Código Copiado!',
        text: `${codeValue} foi copiado para a área de transferência`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    }).catch((error) => {
      console.error('Erro ao copiar código:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao Copiar',
        text: 'Não foi possível copiar o código',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    });
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Copiado!',
        text: 'Texto copiado para a área de transferência',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    }).catch((error) => {
      console.error('Erro ao copiar texto:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao Copiar',
        text: 'Não foi possível copiar o texto',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    });
  }

  // -------------------- Criação / Ações --------------------

  onCreateRoom(): void {
    if (this.form.invalid || !this.code()) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulário Inválido',
        text: 'Por favor, preencha todos os campos obrigatórios corretamente',
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    this.creating.set(true);

    const request: CreateRoomRequest = {
      code: this.code().trim(),
      title: this.form.get('title')?.value.trim(),
      isAnonymous: false
    };

    this.criarSalaService.createRoom(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (room: Room) => {
          this.creating.set(false);
          this.createdRoom.set(room);
          Swal.fire({
            icon: 'success',
            title: 'Sala Criada com Sucesso!',
            text: `${room.title} foi criada com o código ${room.code}`,
            showConfirmButton: true,
            confirmButtonText: 'Ver Detalhes',
            confirmButtonColor: '#28a745',
            allowOutsideClick: false
          });
          this.loadReports();
        },
        error: (error: any) => {
          console.error('Erro ao criar sala:', error);
          this.creating.set(false);
          this.showCustomError(error);
        }
      });
  }

  loadRoomStatus(roomCode: string): void {
    if (this.loadingStatuses().has(roomCode)) return;
    this.loadingStatuses().add(roomCode);

    this.criarSalaService.getRoomStatus(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status: RoomStatus) => {
          const statuses = new Map(this.roomStatuses());
          statuses.set(roomCode, status);
          this.roomStatuses.set(statuses);

          const updateTimes = new Map(this.lastUpdateTimes());
          updateTimes.set(roomCode, new Date());
          this.lastUpdateTimes.set(updateTimes);

          this.loadingStatuses().delete(roomCode);
        },
        error: (error: any) => {
          console.error(`Erro ao carregar status da sala ${roomCode}:`, error);
          this.loadingStatuses().delete(roomCode);
        }
      });
  }

  refreshRoomStatus(roomCode: string): void {
    this.loadRoomStatus(roomCode);
    Swal.fire({
      icon: 'info',
      title: 'Atualizando Status',
      text: `Status da sala ${roomCode} sendo atualizado...`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  }

  advanceToNextRound(roomCode: string): void {
    Swal.fire({
      title: 'Avançar Etapa?',
      text: 'Tem certeza que deseja avançar para a próxima etapa da sala?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Avançar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.criarSalaService.advanceToNextRound(roomCode)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadRoomStatus(roomCode);
              Swal.fire({
                icon: 'success',
                title: 'Etapa Avançada!',
                text: 'A sala avançou para a próxima etapa com sucesso.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao avançar etapa:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Avançar',
                text: 'Não foi possível avançar para a próxima etapa. Tente novamente.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  openRoomReport(roomCode: string): void {
    this.criarSalaService.openRoomReport(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.reportUrl) {
            window.open(response.reportUrl, '_blank');
          } else {
            Swal.fire({
              icon: 'info',
              title: 'Relatório Indisponível',
              text: 'O relatório desta sala ainda não está disponível.',
              confirmButtonText: 'OK',
              confirmButtonColor: '#3085d6'
            });
          }
        },
        error: (error: any) => {
          console.error('Erro ao abrir relatório:', error);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Abrir Relatório',
            text: 'Não foi possível abrir o relatório da sala. Tente novamente.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  getRoomStatus(roomCode: string): RoomStatus | null {
    return this.roomStatuses().get(roomCode) || null;
  }

  isRoomFinished(roomCode: string): boolean {
    return this.getRoomStatus(roomCode)?.status === 'finalizado';
  }

  canAdvanceRoom(roomCode: string): boolean {
    const status = this.getRoomStatus(roomCode);
    return status ? status.status !== 'finalizado' : false;
  }

  getStatusDisplay(status: string | undefined): string {
    if (!status) return 'Carregando...';
    if (status === 'lobby') return '🔄 Lobby';
    if (status === 'finalizado') return '🏁 Finalizado';
    if (status.startsWith('rodada_')) {
      const roundNum = parseInt(status.replace('rodada_', ''), 10);
      return roundNum === 0 ? '🎯 Rodada 0 - Autoavaliação' : `🎯 Rodada ${roundNum}`;
    }
    return status;
  }

  getProgressPercentage(roomCode: string): number {
    const status = this.getRoomStatus(roomCode);
    if (!status) return 0;
    if (status.status === 'lobby' || status.status === 'finalizado') return 0;
    if (!status.round_progress) return 0;
    const { current_votes, expected_votes } = status.round_progress;
    if (expected_votes === 0) return 0;
    return Math.round(Math.min((current_votes / expected_votes) * 100, 100));
  }

  // -------------------- Métodos para Cartas por Rodada --------------------

  getVotesByRound(roomCode: string): Array<{ round: number; current: number; expected: number; percentage: number; status: string }> {
    const status = this.getRoomStatus(roomCode);
    if (!status) return [];

    const rounds: Array<{ round: number; current: number; expected: number; percentage: number; status: string }> = [];

    if (status.status === 'rodada_0' || status.current_round >= 0) {
      rounds.push({
        round: 0,
        current: status.round_progress?.current_votes || 0,
        expected: status.round_progress?.expected_votes || 0,
        percentage: this.calculateRoundPercentage(status.round_progress?.current_votes || 0, status.round_progress?.expected_votes || 0),
        status: status.status === 'rodada_0' ? 'ativa' : 'concluída'
      });
    }

    for (let i = 1; i <= status.max_rounds; i++) {
      const isCurrentRound = status.current_round === i;
      const isCompleted = status.current_round > i;

      if (isCurrentRound || isCompleted) {
        rounds.push({
          round: i,
          current: isCurrentRound ? (status.round_progress?.current_votes || 0) : (status.round_progress?.expected_votes || 0),
          expected: status.round_progress?.expected_votes || 0,
          percentage: isCurrentRound
            ? this.calculateRoundPercentage(status.round_progress?.current_votes || 0, status.round_progress?.expected_votes || 0)
            : 100,
          status: isCurrentRound ? 'ativa' : 'concluída'
        });
      }
    }

    return rounds;
  }

  private calculateRoundPercentage(current: number, expected: number): number {
    if (expected === 0) return 0;
    return Math.round(Math.min((current / expected) * 100, 100));
  }

  getRoundStatusBadge(round: { round: number; status: string; percentage: number }): string {
    if (round.status === 'concluída') return 'bg-green-100 text-green-800';
    if (round.status === 'ativa') {
      if (round.percentage >= 100) return 'bg-blue-100 text-blue-800';
      if (round.percentage >= 50) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  }

  getRoundDisplayName(roundNumber: number): string {
    if (roundNumber === 0) return '🎯 Rodada 0 - Autoavaliação';
    return `🗳️ Rodada ${roundNumber}`;
  }

  getRoundProgressColor(percentage: number): string {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  }

  getLastUpdateTime(roomCode: string): string {
    const lastUpdate = this.lastUpdateTimes().get(roomCode);
    if (!lastUpdate) return 'Nunca';

    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();

    if (diffMs < 60000) return 'Agora mesmo';
    if (diffMs < 300000) return 'Há poucos minutos';
    if (diffMs < 600000) return 'Há 5 minutos';
    if (diffMs < 1800000) return 'Há 15 minutos';
    if (diffMs < 3600000) return 'Há 30 minutos';

    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) return `Há ${hours} hora${hours > 1 ? 's' : ''}`;

    const days = Math.floor(hours / 24);
    return `Há ${days} dia${days > 1 ? 's' : ''}`;
  }

  getStatusBadgeColor(status: string | undefined): string {
    if (!status) return 'bg-gray-100 text-gray-800';
    if (status === 'lobby') return 'bg-blue-100 text-blue-800';
    if (status === 'finalizado') return 'bg-purple-100 text-purple-800';
    if (status.startsWith('rodada_')) {
      const roundNum = parseInt(status.replace('rodada_', ''), 10);
      if (roundNum === 0) return 'bg-yellow-100 text-yellow-800';
      if (roundNum === 1) return 'bg-green-100 text-green-800';
      if (roundNum === 2) return 'bg-indigo-100 text-indigo-800';
      return roundNum % 2 === 0 ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800';
    }
    return 'bg-gray-100 text-gray-800';
  }

  // -------------------- Ações administrativas --------------------

  deleteRoom(roomCode: string): void {
    Swal.fire({
      title: '⚠️ Deletar Sala?',
      html: `
        <p>Esta ação é <strong>IRREVERSÍVEL</strong>!</p>
        <p>A sala <strong>${roomCode}</strong> será deletada permanentemente junto com:</p>
        <ul style="text-align: left; margin-top: 1rem;">
          <li>• Todas as cartas</li>
          <li>• Todos os participantes</li>
          <li>• Todo o histórico</li>
          <li>• Todos os dados relacionados</li>
        </ul>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'SIM, DELETAR',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      focusCancel: true
    }).then((result) => {
      if (result.isConfirmed) this.executeDeleteRoom(roomCode);
    });
  }

  private executeDeleteRoom(roomCode: string): void {
    this.criarSalaService.deleteRoom(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const updatedReports = this.reports().filter(r => r.code !== roomCode);
          this.reports.set(updatedReports);
          const statuses = new Map(this.roomStatuses());
          statuses.delete(roomCode);
          this.roomStatuses.set(statuses);
          Swal.fire({
            icon: 'success',
            title: 'Sala Deletada!',
            text: `A sala ${roomCode} foi deletada permanentemente.`,
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
          });
        },
        error: (error: any) => {
          console.error('Erro ao deletar sala:', error);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Deletar',
            text: 'Não foi possível deletar a sala.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  resetRoom(roomCode: string): void {
    Swal.fire({
      title: 'Resetar Sala?',
      text: 'Esta ação irá resetar a sala para o estado inicial, limpando todas as cartas e resetando as rodadas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, Resetar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.criarSalaService.resetRoom(roomCode)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadRoomStatus(roomCode);
              Swal.fire({
                icon: 'success',
                title: 'Sala Resetada!',
                text: 'A sala foi resetada para o estado inicial.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao resetar sala:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Resetar Sala',
                text: 'Não foi possível resetar a sala.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  clearAllVotes(roomCode: string): void {
    Swal.fire({
      title: 'Limpar Todas as Cartas?',
      text: 'Esta ação irá remover todas as cartas da sala, mas manterá os participantes e o progresso das rodadas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Limpar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.criarSalaService.clearAllVotes(roomCode)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadRoomStatus(roomCode);
              Swal.fire({
                icon: 'success',
                title: 'Cartas Limpos!',
                text: 'Todas as cartas da sala foram removidas.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao limpar cartas:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Limpar Cartas',
                text: 'Não foi possível limpar as cartas da sala.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  forceFinishRound(roomCode: string): void {
    Swal.fire({
      title: 'Finalizar Rodada Forçadamente?',
      text: 'Esta ação irá finalizar a rodada atual mesmo que nem todos tenham enviado suas cartas.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Finalizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.criarSalaService.forceFinishRound(roomCode)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadRoomStatus(roomCode);
              Swal.fire({
                icon: 'success',
                title: 'Rodada Finalizada!',
                text: 'A rodada atual foi finalizada forçadamente.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao finalizar rodada:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Finalizar Rodada',
                text: 'Não foi possível finalizar a rodada.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  forceFinishRoom(roomCode: string): void {
    Swal.fire({
      title: 'Finalizar Sala Forçadamente?',
      text: 'Esta ação irá finalizar a sala completamente, tornando os resultados disponíveis.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Finalizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.criarSalaService.forceFinishRoom(roomCode)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadRoomStatus(roomCode);
              Swal.fire({
                icon: 'success',
                title: 'Sala Finalizada!',
                text: 'A sala foi finalizada forçadamente.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao finalizar sala:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Finalizar Sala',
                text: 'Não foi possível finalizar a sala.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  exportRoomData(roomCode: string, format: 'csv' | 'json' = 'json'): void {
    this.criarSalaService.exportRoomData(roomCode, format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `sala_${roomCode}_export.${format}`;
          link.click();
          window.URL.revokeObjectURL(url);
          Swal.fire({
            icon: 'success',
            title: 'Dados Exportados!',
            text: `Dados da sala ${roomCode} exportados como ${format.toUpperCase()}.`,
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
          });
        },
        error: (error: any) => {
          console.error('Erro ao exportar dados:', error);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Exportar',
            text: 'Não foi possível exportar os dados da sala.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  showRoomStats(roomCode: string): void {
    this.criarSalaService.getRoomStats(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats: any) => {
          Swal.fire({
            title: `📊 Estatísticas - ${roomCode}`,
            html: `
              <div style="text-align: left;">
                <p><strong>Participantes:</strong> ${stats.participants_count || 0}</p>
                <p><strong>Cartas totais:</strong> ${stats.total_votes || 0}</p>
                <p><strong>Rodada atual:</strong> ${stats.current_round || 0}/${stats.max_rounds || 0}</p>
                <p><strong>Status:</strong> ${this.getStatusDisplay(stats.status)}</p>
                <p><strong>Criada em:</strong> ${new Date(stats.created_at).toLocaleString()}</p>
                <p><strong>Última atividade:</strong> ${new Date(stats.last_activity).toLocaleString()}</p>
              </div>
            `,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#3085d6'
          });
        },
        error: (error: any) => {
          console.error('Erro ao carregar estatísticas:', error);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Carregar Estatísticas',
            text: 'Não foi possível carregar as estatísticas da sala.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  showAdminMenu(roomCode: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    Swal.fire({
      title: `⚙️ Ações Avançadas - ${roomCode}`,
      html: `
        <div class="grid grid-cols-1 gap-3 mt-4">
          <button id="force-finish-round" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-medium">
            ⏹️ Finalizar Rodada Atual
          </button>
          <button id="force-finish-room" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-medium">
            🏁 Finalizar Sala Completamente
          </button>
          <button id="clear-votes" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-medium">
            🗳️ Limpar Todas as Cartas
          </button>
          <button id="export-csv" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-medium">
            📄 Exportar CSV
          </button>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Fechar',
      cancelButtonColor: '#6c757d',
      didOpen: () => {
        document.getElementById('force-finish-round')?.addEventListener('click', () => {
          Swal.close(); this.forceFinishRound(roomCode);
        });
        document.getElementById('force-finish-room')?.addEventListener('click', () => {
          Swal.close(); this.forceFinishRoom(roomCode);
        });
        document.getElementById('clear-votes')?.addEventListener('click', () => {
          Swal.close(); this.clearAllVotes(roomCode);
        });
        document.getElementById('export-csv')?.addEventListener('click', () => {
          Swal.close(); this.exportRoomData(roomCode, 'csv');
        });
      }
    });
  }

  toggleRoomExpansion(roomCode: string): void {
    const newExpanded = new Set(this.expandedRooms());
    if (newExpanded.has(roomCode)) newExpanded.delete(roomCode);
    else {
      newExpanded.add(roomCode);
      this.loadRoomDetails(roomCode);
    }
    this.expandedRooms.set(newExpanded);
  }

  isRoomExpanded(roomCode: string): boolean {
    return this.expandedRooms().has(roomCode);
  }

  private loadRoomDetails(_roomCode: string): void {
    // detalhes extras se necessário
  }

  // -------------------- Erros --------------------

  private getCustomErrorMessage(error: any): { title: string; message: string; icon: 'error' | 'warning' | 'info' } {
    if (error.status === 0 || error.statusText === 'Unknown Error') {
      return { title: 'Erro de Conexão', message: 'Não foi possível conectar ao servidor. Verifique sua conexão.', icon: 'error' };
    }
    if (error.status === 400) {
      return { title: 'Dados Inválidos', message: error.error?.message || 'Os dados enviados não estão no formato correto.', icon: 'warning' };
    }
    if (error.status === 401) {
      return { title: 'Não Autorizado', message: 'Sua sessão expirou ou você não tem permissão para esta ação.', icon: 'warning' };
    }
    if (error.status === 403) {
      return { title: 'Acesso Negado', message: 'Você não tem permissão para esta ação.', icon: 'warning' };
    }
    if (error.status === 409) {
      return { title: 'Código Já Existe', message: 'Este código de sala já está em uso. Gere um novo.', icon: 'warning' };
    }
    if (error.status === 422) {
      const errs = error.error?.errors || [];
      if (errs.length > 0) {
        const msg = errs.map((e: any) => e.message).join('\n• ');
        return { title: 'Erro de Validação', message: `Os seguintes problemas foram encontrados:\n\n• ${msg}`, icon: 'warning' };
      }
      return { title: 'Erro de Validação', message: 'Os dados não passaram na validação do servidor.', icon: 'warning' };
    }
    if (error.status === 500) {
      return { title: 'Erro do Servidor', message: 'Erro interno. Tente novamente mais tarde.', icon: 'error' };
    }
    if (error.status === 503) {
      return { title: 'Serviço Indisponível', message: 'Tente novamente em alguns minutos.', icon: 'info' };
    }
    if (error.status === 408 || error.name === 'TimeoutError') {
      return { title: 'Tempo Esgotado', message: 'A requisição demorou muito. Verifique sua conexão e tente novamente.', icon: 'warning' };
    }
    if (error.error?.code === 'ROOM_CODE_EXISTS') {
      return { title: 'Código Duplicado', message: 'Este código de sala já existe. Gere outro.', icon: 'warning' };
    }
    if (error.error?.code === 'USER_ROOM_LIMIT_EXCEEDED') {
      return { title: 'Limite de Salas Atingido', message: 'Você já criou o número máximo de salas.', icon: 'warning' };
    }
    if (error.error?.code === 'ROOM_NAME_EXISTS') {
      return { title: 'Nome Duplicado', message: 'Já existe uma sala com este nome. Escolha outro.', icon: 'warning' };
    }
    if (error.error?.message) {
      return { title: 'Erro na Operação', message: error.error.message, icon: 'error' };
    }
    return { title: 'Erro Inesperado', message: `Ocorreu um erro inesperado (${error.status || 'desconhecido'}).`, icon: 'error' };
  }

  private showCustomError(error: any): void {
    const info = this.getCustomErrorMessage(error);
    Swal.fire({
      icon: info.icon,
      title: info.title,
      html: info.message.replace(/\n/g, '<br>'),
      confirmButtonText: 'Entendi',
      confirmButtonColor: info.icon === 'error' ? '#d33' : info.icon === 'warning' ? '#f39c12' : '#3085d6',
      showClass: { popup: 'animate__animated animate__fadeInDown' },
      hideClass: { popup: 'animate__animated animate__fadeOutUp' }
    });
  }

  resetForm(): void {
    Swal.fire({
      icon: 'question',
      title: 'Limpar Formulário?',
      text: 'Tem certeza que deseja limpar todos os dados?',
      showCancelButton: true,
      confirmButtonText: 'Sim, Limpar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.form.reset();
        this.code.set('');
        this.createdRoom.set(null);
        this.generateCode();
        Swal.fire({
          icon: 'success',
          title: 'Formulário Limpo!',
          text: 'Todos os dados foram removidos',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    });
  }

  // -------------------- Relatórios e Status --------------------

  loadReports(): void {
    this.loadingReports.set(true);
    this.criarSalaService.getRoomReports()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports: RoomReport[]) => {
          this.reports.set(reports);
          this.loadingReports.set(false);
          this.loadAllRoomStatuses(reports);
        },
        error: (error: any) => {
          console.error('Erro ao carregar relatórios:', error);
          this.loadingReports.set(false);
          this.reports.set([]);
        }
      });
  }

  private loadAllRoomStatuses(reports: RoomReport[]): void {
    reports.forEach(r => this.loadRoomStatus(r.code));
  }

  refreshReports(): void {
    this.loadReports();
    Swal.fire({
      icon: 'success',
      title: 'Relatórios Atualizados!',
      text: 'Lista de salas anteriores foi atualizada',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  }

  trackById(index: number, item: any): string {
    return item.id || index;
  }

  // -------------------- Resultados / Modal --------------------

  openRoomResults(roomCode: string): void {
    this.criarSalaService.getRoomResults(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results: RoomResults) => {
          if (results && results.participants_results && results.participants_results.length > 0) {
            this.openResultsModal(results);
          } else {
            Swal.fire({
              icon: 'info',
              title: 'Resultados Indisponíveis',
              text: 'Esta sala ainda não possui resultados disponíveis.',
              confirmButtonText: 'Entendi',
              confirmButtonColor: '#3085d6'
            });
          }
        },
        error: () => {
          Swal.fire({
            title: 'Ver Resultados',
            text: `Deseja visualizar os resultados da sala ${roomCode}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Ver Resultados',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d'
          }).then((res) => {
            if (res.isConfirmed) this.loadRoomResultsForModal(roomCode);
          });
        }
      });
  }

  private openResultsModal(results: RoomResults): void {
    this.currentResults.set(results);
    this.showResultsModal.set(true);
    setTimeout(() => this.createResultsChart(), 100);
  }

  private loadRoomResultsForModal(roomCode: string): void {
    this.loadingResults.set(true);
    this.criarSalaService.getRoomResults(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results: RoomResults) => {
          this.loadingResults.set(false);
          this.openResultsModal(results);
        },
        error: (error: any) => {
          console.error('Erro ao carregar resultados:', error);
          this.loadingResults.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Carregar Resultados',
            text: 'Não foi possível carregar os resultados da sala.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  closeResultsModal(): void {
    this.showResultsModal.set(false);
    this.currentResults.set(null);
    if (this.resultsChart) {
      this.resultsChart.destroy();
      this.resultsChart = null;
    }
    this.participantChartCache.clear();
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>> INÍCIO: BLOCO AJUSTADO PARA GRÁFICO/RELATÓRIO

  // Aguarda o gráfico estar totalmente pronto (render/resize)
  private async ensureChartReady(): Promise<void> {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise(r => setTimeout(r, 60));
    if (this.resultsChart) {
      this.resultsChart.update('none');
      await new Promise(r => setTimeout(r, 30));
    }
  }

  // Aguarda um chart "offscreen" terminar de renderizar
  private async ensureOffscreenChartReady(chart: Chart): Promise<void> {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    chart.update('none');
    await new Promise(r => setTimeout(r, 20));
  }

  // Ajusta altura do canvas conforme quantidade de barras
  private sizeResultsCanvasFor(labelsCount: number): void {
    if (!this.resultsChartCanvas?.nativeElement) return;
    const base = 260;
    const perBar = 34;
    const padding = 40;
    const target = Math.min(1800, Math.max(base, padding + labelsCount * perBar));
    const canvas = this.resultsChartCanvas.nativeElement;
    canvas.height = target;                 // altura real do canvas
    canvas.style.height = `${target}px`;    // altura CSS para layout
  }

  private createResultsChart(): void {
    if (!this.resultsChartCanvas || !this.currentResults()) return;
    const ctx = this.resultsChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.resultsChart) {
      this.resultsChart.destroy();
      this.resultsChart = null;
    }

    const results = this.currentResults()!;
    const aggregated = this.aggregateResultsByPlanet(results);

    // altura dinâmica p/ gráficos grandes
    this.sizeResultsCanvasFor(aggregated.length);

    this.resultsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: aggregated.map(r => r.planet),
        datasets: [{
          label: 'Total de Cartas',
          data: aggregated.map(r => r.totalCount),
          backgroundColor: aggregated.map(r => this.getColorFromPlanet(r.planet)),
          borderColor: aggregated.map(r => this.getColorFromPlanet(r.planet)),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          title: {
            display: true,
            text: `Resumo de Cartas por Planeta - ${results.room_title}`,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  private async captureChartAsImage(): Promise<string | null> {
    if (!this.resultsChart || !this.resultsChartCanvas) return null;
    await this.ensureChartReady();
    try {
      const asBase64 = (this.resultsChart as any).toBase64Image?.() as string | undefined;
      if (asBase64 && asBase64.startsWith('data:image')) return asBase64;
    } catch { /* fallback abaixo */ }

    try {
      const canvas = this.resultsChartCanvas.nativeElement;
      return canvas.toDataURL('image/png', 1.0);
    } catch (e) {
      console.error('Falha ao capturar canvas:', e);
      return null;
    }
  }

  // >>>>>>>>>>>>> NOVO: gera chart horizontal por participante (offscreen)
  private async createParticipantChartImage(participant: any): Promise<string> {
    const planets = this.getAllPlanets();
    const data = planets.map(p => this.getParticipantPlanetVotes(participant, p));
    const colors = planets.map(p => this.getColorFromPlanet(p));

    // Canvas offscreen
    const canvas = document.createElement('canvas');
    // Tamanho bom para PDF (mantendo proporção)
    canvas.width = 800;
    canvas.height = 350;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: planets,
        datasets: [{
          label: 'Cartas',
          data,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y' as const, // barras horizontais
        responsive: false,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          title: {
            display: true,
            text: `Distribuição por Planeta — ${this.cleanText(participant.name || '')}`,
            font: { size: 16, weight: 'bold' }
          },
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 } },
          y: { ticks: { autoSkip: false } }
        }
      }
    });

    await this.ensureOffscreenChartReady(chart);
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    chart.destroy();
    canvas.remove();
    return dataUrl;
  }

  // >>>>>>>>>>>>> NOVO: gera todos os charts por participante (com cache)
  private async buildParticipantCharts(results: RoomResults): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    for (let i = 0; i < results.participants_results.length; i++) {
      if (this.participantChartCache.has(i)) {
        map.set(i, this.participantChartCache.get(i)!);
        continue;
      }
      const img = await this.createParticipantChartImage(results.participants_results[i]);
      map.set(i, img);
      this.participantChartCache.set(i, img);
    }
    return map;
  }

  // <<< PDF programático com gráfico em alta (fallback para "print" da modal)
  downloadResultsReport(): void {
    const results = this.currentResults();
    if (!results) {
      Swal.fire({
        icon: 'warning',
        title: 'Nenhum Resultado Disponível',
        text: 'Não há resultados para gerar o relatório.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#f39c12'
      });
      return;
    }

    Swal.fire({
      title: 'Gerando Relatório...',
      text: 'Preparando os gráficos e o PDF em alta qualidade.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    (async () => {
      try {
        if (!this.resultsChart) this.createResultsChart();

        // 1) captura gráfico agregado
        const chartImgAgregado = await this.captureChartAsImage();
        // 2) gera gráficos por participante (offscreen)
        const chartsPorParticipante = await this.buildParticipantCharts(results);

        // 3) gera PDF com todos os gráficos
        this.generatePDFWithCharts(results, chartImgAgregado, chartsPorParticipante);

        Swal.close();
      } catch (err) {
        console.error('Erro ao gerar relatório:', err);
        Swal.close();
        // Fallback: captura da modal
        try {
          const modal = this.findResultsModalEl();
          if (!modal) throw new Error('Modal não encontrada para fallback');

          const imgData = await this.elementToPngDataUrl(modal);
          const fileName = `relatorio_resultados_${results.room_code}_${new Date().toISOString().split('T')[0]}.pdf`;
          await this.pngDataUrlToMultipagePdf(imgData, fileName);

          Swal.fire({
            icon: 'success',
            title: 'Relatório PDF Gerado!',
            text: 'Usamos o fallback de captura da modal por segurança.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#28a745'
          });
        } catch (fallbackErr) {
          console.error('Erro no fallback do relatório:', fallbackErr);
          Swal.fire({
            icon: 'error',
            title: 'Erro ao Gerar Relatório',
            text: 'Tente novamente. Se persistir, verifique se o gráfico está visível.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      }
    })();
  }

  // >>>>>>>>>>>>> ALTERADO: agora aceita gráficos por participante
  private generatePDFWithCharts(
    results: RoomResults,
    chartImageDataAgregado: string | null,
    chartsPorParticipante: Map<number, string>
  ): void {
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFont('helvetica');

    const primary: [number, number, number] = [59, 130, 246];
    const secondary: [number, number, number] = [107, 114, 128];
    const accent: [number, number, number] = [34, 197, 94];
    const lightBlue: [number, number, number] = [219, 234, 254];

    // Cabeçalho
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, 210, 40, 'F');
    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdf.text('RELATORIO DE RESULTADOS', 20, 25);

    // Info sala
    pdf.setFillColor(...lightBlue);
    pdf.rect(15, 45, 180, 30, 'F');
    pdf.setDrawColor(...primary);
    pdf.rect(15, 45, 180, 30, 'S');

    pdf.setFontSize(14);
    pdf.setTextColor(...primary);
    pdf.text('INFORMACOES DA SALA', 20, 55);
    pdf.setFontSize(12);
    pdf.setTextColor(...secondary);
    pdf.text(`Sala: ${this.cleanText(results.room_title)}`, 20, 64);
    pdf.text(`Codigo: ${results.room_code}`, 20, 70);
    pdf.text(`Participantes: ${results.total_participants} pessoas`, 110, 64);
    pdf.text(`Data: ${this.getCurrentDate()}`, 110, 70);

    let cursorY = 90;

    // Gráfico agregado (se disponível)
    if (chartImageDataAgregado) {
      pdf.setFontSize(18);
      pdf.setTextColor(...primary);
      pdf.text('GRAFICO DE RESULTADOS (GERAL)', 20, cursorY);
      cursorY += 5;

      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, cursorY, 180, 90, 'F');
      pdf.setDrawColor(...primary);
      pdf.rect(15, cursorY, 180, 90, 'S');

      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxW = pageW - margin * 2;
      const maxH = 80;

      const img = new Image();
      img.src = chartImageDataAgregado;
      const iw = img.width || 2000;
      const ih = img.height || 1000;
      const ratio = Math.min(maxW / iw, maxH / ih);
      const renderW = Math.max(10, iw * ratio);
      const renderH = Math.max(10, ih * ratio);

      pdf.addImage(chartImageDataAgregado, 'PNG', 20, cursorY + 5, renderW, renderH);
      cursorY += 95;

      // Resumo por cor/planeta
      this.renderResumoPorCor(pdf, results, primary, secondary, accent, lightBlue, cursorY);

      // nova página antes dos participantes
      pdf.addPage();
    } else {
      // sem gráfico agregado, já abre seção de participantes
      pdf.addPage();
    }

    // Seção: Detalhes + GRÁFICO por participante
    this.renderParticipantesDetalhados(pdf, results, primary, secondary, accent, chartsPorParticipante);

    // Estatísticas finais
    pdf.addPage();
    this.renderEstatisticasFinais(pdf, results, primary, secondary, accent);

    // Numeração
    this.addPageNumbers(pdf);

    const fileName = `relatorio_${results.room_code}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    Swal.fire({
      icon: 'success',
      title: 'Relatório PDF Gerado!',
      text: 'O relatório em PDF foi criado e baixado com sucesso!',
      confirmButtonText: 'OK',
      confirmButtonColor: '#28a745'
    });
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>> FIM: BLOCO AJUSTADO PARA GRÁFICO/RELATÓRIO

  private aggregateResultsByPlanet(results: RoomResults): Array<{ planet: string; totalCount: number }> {
    const planetMap = new Map<string, number>();
    const allPlanets = this.getAllPlanets();
    allPlanets.forEach(p => planetMap.set(p, 0));

    results.participants_results.forEach(p => {
      p.results_by_color.forEach((cr: any) => {
        const planetName = this.getPlanetNameFromColor(cr.color);
        if (planetName && planetMap.has(planetName)) {
          planetMap.set(planetName, (planetMap.get(planetName) || 0) + cr.count);
        }
      });
    });

    return Array.from(planetMap.entries())
      .map(([planet, totalCount]) => ({ planet, totalCount }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  // -------------------- PDF – Seções auxiliares --------------------

  private renderResumoPorCor(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number],
    lightBlue: [number, number, number],
    startY: number = 100
  ): void {
    let y = startY;
    pdf.setFontSize(18);
    pdf.setTextColor(...primary);
    pdf.text('RESUMO DE CARTAS POR PLANETA', 20, y);
    y += 15;

    const aggregated = this.aggregateResultsByPlanet(results);
    const boxHeight = (aggregated.length * 8) + 10;
    pdf.setFillColor(...lightBlue);
    pdf.rect(15, y - 5, 180, boxHeight, 'F');
    pdf.setDrawColor(...primary);
    pdf.rect(15, y - 5, 180, boxHeight, 'S');

    aggregated.forEach((p) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFontSize(12);
      pdf.setTextColor(...secondary);
      pdf.text(`${this.getPlanetName(p.planet)}:`, 25, y);
      pdf.setFontSize(14);
      pdf.setTextColor(...accent);
      pdf.text(`${p.totalCount} cartas`, 120, y);
      y += 8;
    });
  }

  // >>>>>>>>>>>>> ALTERADO: agora recebe os charts por participante e desenha cada um
  private renderParticipantesDetalhados(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number],
    chartsPorParticipante?: Map<number, string>
  ): void {
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, 210, 40, 'F');

    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('DETALHES DOS PARTICIPANTES', 20, 25);

    let y = 50;

    results.participants_results.forEach((p, idx) => {
      // Altura estimada por participante (título + infos + gráfico + linhas)
      const chartH = 70;
      const blockBaseH = 55;
      const blockH = blockBaseH + chartH;

      if (y + blockH > 280) {
        pdf.addPage();
        y = 20;
      }

      // Caixa do participante
      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, y - 5, 180, blockH, 'F');
      pdf.setDrawColor(...primary);
      pdf.rect(15, y - 5, 180, blockH, 'S');

      // Título + infos
      pdf.setFontSize(14);
      pdf.setTextColor(...primary);
      pdf.text(`${idx + 1}. ${this.cleanText(p.name)}`, 20, y);
      y += 8;

      pdf.setFontSize(12);
      pdf.setTextColor(...secondary);
      const envelopeColor = this.getColorNameFromHex(p.envelope_choice);
      pdf.text(`Planeta Escolhido: ${envelopeColor}`, 25, y);
      pdf.text(`Total de Cartas: ${p.total_votes}`, 110, y);
      y += 10;

      // Gráfico por participante (se disponível)
      const chartImg = chartsPorParticipante?.get(idx);
      if (chartImg) {
        // Centraliza dentro da caixa
        const pageW = pdf.internal.pageSize.getWidth();
        const marginX = 25;
        const maxW = pageW - marginX * 2; // ~160mm
        const renderW = maxW;
        const renderH = chartH;

        pdf.addImage(chartImg, 'PNG', marginX, y, renderW, renderH, undefined, 'FAST');
      }

      y += chartH + 10;

      // (Opcional) você ainda pode listar algumas cartas recebidas (resumo)
      if (p.detailed_votes?.length > 0) {
        pdf.setFontSize(11);
        pdf.setTextColor(...secondary);
        pdf.text('Algumas cartas recebidas:', 25, y);
        y += 6;

        p.detailed_votes.slice(0, 2).forEach((v: any) => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.setFontSize(10);
          pdf.text(`- ${this.cleanText(v.from_name)} -> ${v.card_color}`, 30, y);
          y += 5;

          const desc = this.cleanText(v.card_description);
          const shortDesc = desc.length > 80 ? desc.substring(0, 77) + '...' : desc;
          pdf.text(`  ${shortDesc}`, 35, y);
          y += 4;
        });

        if (p.detailed_votes.length > 2) {
          pdf.setFontSize(10);
          pdf.setTextColor(...accent);
          pdf.text(`... e mais ${p.detailed_votes.length - 2} cartas`, 30, y);
          y += 5;
        }
      }

      // Espaço antes do próximo
      y += 6;
    });
  }

  private renderEstatisticasFinais(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number]
  ): void {
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, 210, 40, 'F');

    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('ESTATISTICAS FINAIS', 20, 25);

    pdf.setFillColor(219, 234, 254);
    pdf.rect(15, 45, 180, 35, 'F');
    pdf.setDrawColor(...primary);
    pdf.rect(15, 45, 180, 35, 'S');

    pdf.setFontSize(14);
    pdf.setTextColor(...primary);
    pdf.text('RESUMO GERAL', 20, 55);

    const totalVotes = results.participants_results.reduce((sum, p) => sum + p.total_votes, 0);

    pdf.setFontSize(12);
    pdf.setTextColor(...secondary);
    pdf.text(`Total de Participantes: ${results.total_participants} pessoas`, 20, 65);
    pdf.text(`Total de Cartas: ${totalVotes} cartas`, 20, 72);

    const mostVoted = this.aggregateResultsByPlanet(results)[0];
    if (mostVoted) {
      pdf.setTextColor(...accent);
      pdf.text(`Planeta Mais Usado: ${mostVoted.planet} (${mostVoted.totalCount} cartas)`, 110, 65);
    }

    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, 90, 180, 120, 'F');
    pdf.setDrawColor(...primary);
    pdf.rect(15, 90, 180, 120, 'S');

    pdf.setFontSize(16);
    pdf.setTextColor(...primary);
    pdf.text('DISTRIBUICAO DE CARTAS POR PLANETA', 20, 105);

    let y = 125;
    const aggregated = this.aggregateResultsByPlanet(results);
    aggregated.forEach((p) => {
      const pct = totalVotes > 0 ? ((p.totalCount / totalVotes) * 100).toFixed(1) : '0.0';
      const barWidth = (p.totalCount / (mostVoted?.totalCount || 1)) * 120;
      pdf.setFillColor(...accent);
      pdf.rect(25, y - 3, barWidth, 6, 'F');

      pdf.setFontSize(12);
      pdf.setTextColor(...secondary);
      pdf.text(`${this.getPlanetName(p.planet)}:`, 25, y + 8);
      pdf.setTextColor(...accent);
      pdf.text(`${p.totalCount} cartas (${pct}%)`, 80, y + 8);
      y += 18;
    });

    pdf.setFontSize(10);
    pdf.setTextColor(...secondary);
    pdf.text('Este relatorio foi gerado automaticamente pelo sistema.', 20, 260);
    pdf.text(`Sala finalizada com ${results.total_participants} participantes ativos.`, 20, 270);
  }

  private addPageNumbers(pdf: jsPDF): void {
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Pagina ${i} de ${pageCount}`, 20, 287);
      pdf.text(`Gerado em ${this.getCurrentDate()}`, 120, 287);
    }
  }

  // -------------------- Captura da MODAL (Imagem/PDF) --------------------

  private findResultsModalEl(): HTMLElement | null {
    try {
      const canvas = this.resultsChartCanvas?.nativeElement;
      if (canvas) {
        const modal =
          canvas.closest<HTMLElement>('[data-results-modal]') ||
          canvas.closest<HTMLElement>('[role="dialog"]') ||
          canvas.closest<HTMLElement>('.results-modal') ||
          canvas.closest<HTMLElement>('.fixed.inset-0.z-50.overflow-y-auto');
        if (modal) return modal;
      }
    } catch { /* ignore */ }

    return (
      document.querySelector<HTMLElement>('[data-results-modal]') ||
      document.querySelector<HTMLElement>('[role="dialog"]') ||
      document.querySelector<HTMLElement>('.results-modal') ||
      document.querySelector<HTMLElement>('.fixed.inset-0.z-50.overflow-y-auto')
    );
  }

  // Ajustada para capturar conteúdo alto/largo sem cortes
  private async elementToPngDataUrl(el: HTMLElement): Promise<string> {
    el.setAttribute('data-capture', 'true');
    try {
      const html2canvas = await import('html2canvas');
      const canvas = await (html2canvas as any).default(el, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        foreignObjectRendering: false,
        removeContainer: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        width: el.scrollWidth,
        height: el.scrollHeight,
        onclone: (doc: Document) => {
          const target = doc.querySelector('[data-capture="true"]') as HTMLElement | null;
          if (target) {
            target.style.maxHeight = 'none';
            target.style.overflow = 'visible';
            target.style.position = 'static';
            target.style.transform = 'none';
            target.style.filter = 'none';
            target.style.width = `${el.scrollWidth}px`;
            target.style.height = `${el.scrollHeight}px`;
          }
        }
      });
      return canvas.toDataURL('image/png', 1.0);
    } finally {
      el.removeAttribute('data-capture');
    }
  }

  private pngDataUrlToMultipagePdf(imgDataUrl: string, fileName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const renderW = pageW - margin * 2;
        const renderH = renderW * (img.height / img.width);

        if (renderH <= pageH - margin * 2) {
          const yOffset = (pageH - renderH) / 2;
          pdf.addImage(imgDataUrl, 'PNG', margin, yOffset, renderW, renderH);
          pdf.save(fileName);
          resolve();
          return;
        }

        const pageCanvas = document.createElement('canvas');
        const ctx = pageCanvas.getContext('2d')!;
        const sliceHeightPx = Math.floor((img.width / renderW) * (pageH - margin * 2));

        pageCanvas.width = img.width;
        pageCanvas.height = sliceHeightPx;

        let y = 0;
        let first = true;

        while (y < img.height) {
          const h = Math.min(sliceHeightPx, img.height - y);
          ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);

          const sliceData = pageCanvas.toDataURL('image/png', 1.0);
          const sliceRenderH = (h / img.width) * renderW;

          if (!first) pdf.addPage();
          const xOffset = (pageW - renderW) / 2;
          pdf.addImage(sliceData, 'PNG', xOffset, margin, renderW, sliceRenderH);

          first = false;
          y += h;
        }

        pdf.save(fileName);
        resolve();
      };
      img.onerror = reject;
      img.src = imgDataUrl;
    });
  }

  // -------------------- Utilitários --------------------

  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '')
      .replace(/[\u2600-\u26FF]/g, '')
      .replace(/[\u2700-\u27BF]/g, '')
      .replace(/[áàâãäåæ]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõöø]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[ÁÀÂÃÄÅÆ]/g, 'A')
      .replace(/[ÉÈÊË]/g, 'E')
      .replace(/[ÍÌÎÏ]/g, 'I')
      .replace(/[ÓÒÔÕÖØ]/g, 'O')
      .replace(/[ÚÙÛÜ]/g, 'U')
      .replace(/[Ç]/g, 'C')
      .replace(/[Ñ]/g, 'N')
      .replace(/[^\w\s\-\.\,\!\?\(\)]/g, '')
      .trim();
  }

  private splitTextToFit(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    words.forEach(word => {
      if ((current + ' ' + word).length <= maxWidth) {
        current += (current ? ' ' : '') + word;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  getColorNameFromHex(hex: string): string {
    return this.getPlanetNameFromColor(hex);
  }

  getPlanetName(color: string): string {
    return this.getPlanetNameFromColor(color);
  }

  getColorHex(colorName: string): string {
    return this.getColorFromPlanet(colorName);
  }

  getAggregatedResults(results: RoomResults): Array<{ planet: string; totalCount: number }> {
    return this.aggregateResultsByPlanet(results);
  }

  getPlanetNameFromColor(color: string): string {
    const colorMap: Record<string, string> = {
      'roxo': 'Lua',
      'amarelo': 'Mercúrio',
      'verde': 'Vênus',
      'vermelho': 'Marte',
      'laranja': 'Jupiter',
      'azul': 'Saturno',
      '#8B5CF6': 'Lua',
      '#EAB308': 'Mercúrio',
      '#22C55E': 'Vênus',
      '#EF4444': 'Marte',
      '#F97316': 'Jupiter',
      '#3B82F6': 'Saturno',
      'purple': 'Lua',
      'yellow': 'Mercúrio',
      'green': 'Vênus',
      'red': 'Marte',
      'orange': 'Jupiter',
      'blue': 'Saturno'
    };

    const normalizedColor = color.toLowerCase().trim();
    return colorMap[normalizedColor] || color;
  }

  getColorFromPlanet(planet: string): string {
    const planetMap: Record<string, string> = {
      'Lua': '#8B5CF6',
      'Mercúrio': '#EAB308',
      'Vênus': '#22C55E',
      'Marte': '#EF4444',
      'Jupiter': '#F97316',
      'Saturno': '#3B82F6'
    };
    return planetMap[planet] || '#6B7280';
  }

  getParticipantPlanetVotes(participant: any, planet: string): number {
    let count = 0;
    participant.results_by_color.forEach((cr: any) => {
      if (this.getPlanetNameFromColor(cr.color) === planet) {
        count += cr.count;
      }
    });
    return count;
  }

  getParticipantPlanetPercentage(participant: any, planet: string): number {
    const planetVotes = this.getParticipantPlanetVotes(participant, planet);
    const totalVotes = participant.total_votes;
    if (totalVotes === 0) return 0;
    return Math.round((planetVotes / totalVotes) * 100);
  }

  getAllPlanets(): string[] {
    return ['Lua', 'Mercúrio', 'Vênus', 'Marte', 'Jupiter', 'Saturno'];
  }

  getCurrentDate(): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hour}:${minute}`;
  }
}
