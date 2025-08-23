import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { CriarSalaService, CreateRoomRequest, Room, RoomReport, RoomStatus, RoomResults } from './criar-sala.service';
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

  // Modal de resultados
  readonly showResultsModal = signal<boolean>(false);
  readonly currentResults = signal<RoomResults | null>(null);
  readonly loadingResults = signal<boolean>(false);
  private resultsChart: Chart | null = null;

  // Computed
  readonly displayName = computed(() => 'Usuário');

  ngOnInit(): void {
    this.initForm();
    this.generateCode();
    this.loadReports();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resultsChart) this.resultsChart.destroy();
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
          this.loadingStatuses().delete(roomCode);
        },
        error: (error: any) => {
          console.error(`Erro ao carregar status da sala ${roomCode}:`, error);
          this.loadingStatuses().delete(roomCode);
        }
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
      return roundNum === 0 ? '🎯 Rodada 0 - Autoavaliação' : `🎯 Rodada ${roundNum} - Votação`;
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
          <li>• Todos os votos</li>
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
      text: 'Esta ação irá resetar a sala para o estado inicial, limpando todos os votos e resetando as rodadas.',
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
      title: 'Limpar Todos os Votos?',
      text: 'Esta ação irá remover todos os votos da sala, mas manterá os participantes e o progresso das rodadas.',
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
                title: 'Votos Limpos!',
                text: 'Todos os votos da sala foram removidos.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#28a745'
              });
            },
            error: (error: any) => {
              console.error('Erro ao limpar votos:', error);
              Swal.fire({
                icon: 'error',
                title: 'Erro ao Limpar Votos',
                text: 'Não foi possível limpar os votos da sala.',
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
      text: 'Esta ação irá finalizar a rodada atual mesmo que nem todos tenham votado.',
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
                <p><strong>Votos totais:</strong> ${stats.total_votes || 0}</p>
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
            🗳️ Limpar Todos os Votos
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
  }

  private createResultsChart(): void {
    if (!this.resultsChartCanvas || !this.currentResults()) return;
    const ctx = this.resultsChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.resultsChart) this.resultsChart.destroy();

    const results = this.currentResults()!;
    const aggregated = this.aggregateResultsByColor(results);

    this.resultsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: aggregated.map(r => r.color),
        datasets: [{
          label: 'Total de Votos',
          data: aggregated.map(r => r.totalCount),
          backgroundColor: ['#8B5CF6', '#EAB308', '#22C55E', '#EF4444', '#F97316', '#3B82F6'],
          borderColor: ['#7C3AED', '#CA8A04', '#16A34A', '#DC2626', '#EA580C', '#2563EB'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Resumo de Votos - ${results.room_title}`,
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

  private aggregateResultsByColor(results: RoomResults): Array<{ color: string; totalCount: number }> {
    const colorMap = new Map<string, number>();
    const allColors = ['Roxo', 'Amarelo', 'Verde', 'Vermelho', 'Laranja', 'Azul'];
    allColors.forEach(c => colorMap.set(c, 0));
    results.participants_results.forEach(p => {
      p.results_by_color.forEach(cr => {
        colorMap.set(cr.color, (colorMap.get(cr.color) || 0) + cr.count);
      });
    });
    return Array.from(colorMap.entries())
      .map(([color, totalCount]) => ({ color, totalCount }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  // -------------------- PDF de resultados (texto+gráfico) --------------------

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
      title: 'Gerando Relatório PDF...',
      text: 'Aguarde enquanto preparamos seu relatório completo.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      this.captureChartAsImage()
        .then((chartImg) => {
          this.generatePDFWithChart(results, chartImg);
          Swal.close();
        })
        .catch((error) => {
          console.error('Erro ao capturar gráfico:', error);
          this.generatePDFWithChart(results, null);
          Swal.close();
        });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Erro ao Gerar PDF',
        text: 'Não foi possível gerar o relatório em PDF. Tente novamente.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
    }
  }

  private async captureChartAsImage(): Promise<string | null> {
    if (!this.resultsChart || !this.resultsChartCanvas) {
      console.log('Gráfico ou canvas não disponível para captura');
      return null;
    }
    
    try {
      const canvas = this.resultsChartCanvas.nativeElement;
      if (!canvas) {
        console.log('Elemento canvas não encontrado');
        return null;
      }

      // Aguardar um pouco para garantir que o gráfico foi renderizado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      console.log('Gráfico capturado com sucesso');
      return dataUrl;
    } catch (e) {
      console.error('Erro ao capturar gráfico:', e);
      return null;
    }
  }

  private generatePDFWithChart(results: RoomResults, chartImageData: string | null): void {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFont('helvetica');

      // Cores do tema
      const primary: [number, number, number] = [59, 130, 246];    // Azul
      const secondary: [number, number, number] = [107, 114, 128]; // Cinza
      const accent: [number, number, number] = [34, 197, 94];      // Verde
      const lightBlue: [number, number, number] = [219, 234, 254]; // Azul claro

      // Cabeçalho com fundo colorido
      pdf.setFillColor(primary[0], primary[1], primary[2]);
      pdf.rect(0, 0, 210, 40, 'F');
      
      // Título do relatório
      pdf.setFontSize(24);
      pdf.setTextColor(255, 255, 255); // Branco
      pdf.text('RELATORIO DE RESULTADOS', 20, 25);

      // Caixa de informações da sala
      pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      pdf.rect(15, 45, 180, 30, 'F');
      pdf.setDrawColor(primary[0], primary[1], primary[2]);
      pdf.setLineWidth(0.5);
      pdf.rect(15, 45, 180, 30, 'S');

      // Informações da sala
      pdf.setFontSize(14);
      pdf.setTextColor(primary[0], primary[1], primary[2]);
      pdf.text('INFORMACOES DA SALA', 20, 55);
      
      pdf.setFontSize(12);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      pdf.text(`Sala: ${this.cleanText(results.room_title)}`, 20, 64);
      pdf.text(`Codigo: ${results.room_code}`, 20, 70);
      pdf.text(`Participantes: ${results.total_participants} pessoas`, 110, 64);
      pdf.text(`Data: ${this.getCurrentDate()}`, 110, 70);

      // Gráfico (se disponível)
      if (chartImageData) {
        pdf.setFontSize(18);
        pdf.setTextColor(primary[0], primary[1], primary[2]);
        pdf.text('GRAFICO DE RESULTADOS', 20, 90);

        try {
          // Caixa para o gráfico
          pdf.setFillColor(245, 245, 245); // Cinza muito claro
          pdf.rect(15, 95, 180, 90, 'F');
          pdf.setDrawColor(primary[0], primary[1], primary[2]);
          pdf.rect(15, 95, 180, 90, 'S');
          
          const maxWidth = 170;
          const maxHeight = 80;
          pdf.addImage(chartImageData, 'PNG', 20, 100, maxWidth, maxHeight);

          let y = 200;
          this.renderResumoPorCor(pdf, results, primary, secondary, accent, lightBlue, y);
        } catch (error) {
          console.error('Erro ao adicionar gráfico:', error);
          this.renderResumoPorCor(pdf, results, primary, secondary, accent, lightBlue, 90);
        }
      } else {
        this.renderResumoPorCor(pdf, results, primary, secondary, accent, lightBlue, 90);
      }

      // Página de participantes detalhados
      pdf.addPage();
      this.renderParticipantesDetalhados(pdf, results, primary, secondary, accent);

      // Página de estatísticas finais
      pdf.addPage();
      this.renderEstatisticasFinais(pdf, results, primary, secondary, accent);

      // Adicionar numeração de páginas
      this.addPageNumbers(pdf);

      // Salvar o PDF
      const fileName = `relatorio_${results.room_code}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      Swal.fire({
        icon: 'success',
        title: 'Relatório PDF Gerado!',
        text: 'O relatório em PDF foi criado e baixado com sucesso!',
        confirmButtonText: 'OK',
        confirmButtonColor: '#28a745'
      });

    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao Gerar PDF',
        text: 'Não foi possível gerar o relatório em PDF. Tente novamente.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
    }
  }

  // -------------------- Funções auxiliares para geração de PDF --------------------

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
    pdf.setTextColor(primary[0], primary[1], primary[2]);
    pdf.text('RESUMO DE VOTOS POR COR', 20, y);
    y += 15;

    // Caixa de fundo para o resumo
    const aggregated = this.aggregateResultsByColor(results);
    const boxHeight = (aggregated.length * 8) + 10;
    pdf.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    pdf.rect(15, y - 5, 180, boxHeight, 'F');
    pdf.setDrawColor(primary[0], primary[1], primary[2]);
    pdf.rect(15, y - 5, 180, boxHeight, 'S');

    aggregated.forEach((c) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFontSize(12);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      pdf.text(`${c.color}:`, 25, y);
      pdf.setFontSize(14);
      pdf.setTextColor(accent[0], accent[1], accent[2]);
      pdf.text(`${c.totalCount} votos`, 120, y);
      y += 8;
    });
  }

  private renderResumoPorCorFallback(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number],
    startY: number = 100
  ): void {
    let y = startY;
    pdf.setFontSize(18);
    pdf.setTextColor(primary[0], primary[1], primary[2]);
    pdf.text('RESUMO DE VOTOS POR COR', 20, y);
    y += 15;

    const aggregated = this.aggregateResultsByColor(results);
    aggregated.forEach((c) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFontSize(12);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      pdf.text(`${c.color}:`, 25, y);
      pdf.setFontSize(14);
      pdf.setTextColor(accent[0], accent[1], accent[2]);
      pdf.text(`${c.totalCount} votos`, 120, y);
      y += 8;
    });
  }

  private renderParticipantesDetalhados(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number]
  ): void {
    // Cabeçalho da página
    pdf.setFillColor(primary[0], primary[1], primary[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('DETALHES DOS PARTICIPANTES', 20, 25);

    let y = 50;
    results.participants_results.forEach((p, idx) => {
      if (y > 250) { 
        pdf.addPage(); 
        y = 20; 
      }

      // Caixa para cada participante
      const participantBoxHeight = Math.min(40 + (p.detailed_votes.length * 8), 60);
      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, y - 5, 180, participantBoxHeight, 'F');
      pdf.setDrawColor(primary[0], primary[1], primary[2]);
      pdf.rect(15, y - 5, 180, participantBoxHeight, 'S');

      pdf.setFontSize(14);
      pdf.setTextColor(primary[0], primary[1], primary[2]);
      pdf.text(`${idx + 1}. ${this.cleanText(p.name)}`, 20, y); 
      y += 8;

      pdf.setFontSize(12);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      const envelopeColor = this.getColorNameFromHex(p.envelope_choice);
      pdf.text(`Cor Escolhida: ${envelopeColor}`, 25, y);
      pdf.text(`Total de Votos: ${p.total_votes}`, 25, y + 6);
      y += 15;

      if (p.detailed_votes.length > 0) {
        pdf.setFontSize(11);
        pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
        pdf.text('Votos Recebidos:', 25, y); 
        y += 6;

        p.detailed_votes.slice(0, 3).forEach((v) => { // Mostra apenas 3 votos por participante para não ocupar muito espaço
          if (y > 250) { pdf.addPage(); y = 20; }
          pdf.setFontSize(10);
          pdf.text(`- ${this.cleanText(v.from_name)} -> ${v.card_color}`, 30, y); 
          y += 5;

          const desc = this.cleanText(v.card_description);
          const shortDesc = desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
          pdf.text(`  ${shortDesc}`, 35, y);
          y += 4;
        });
        
        if (p.detailed_votes.length > 3) {
          pdf.setFontSize(10);
          pdf.setTextColor(accent[0], accent[1], accent[2]);
          pdf.text(`... e mais ${p.detailed_votes.length - 3} votos`, 30, y);
          y += 5;
        }
      }

      y += participantBoxHeight - 15;
    });
  }

  private renderEstatisticasFinais(
    pdf: jsPDF,
    results: RoomResults,
    primary: [number, number, number],
    secondary: [number, number, number],
    accent: [number, number, number]
  ): void {
    // Cabeçalho da página
    pdf.setFillColor(primary[0], primary[1], primary[2]);
    pdf.rect(0, 0, 210, 40, 'F');
    
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('ESTATISTICAS FINAIS', 20, 25);

    // Caixa com resumo geral
    pdf.setFillColor(219, 234, 254); // Azul claro
    pdf.rect(15, 45, 180, 35, 'F');
    pdf.setDrawColor(primary[0], primary[1], primary[2]);
    pdf.rect(15, 45, 180, 35, 'S');

    pdf.setFontSize(14);
    pdf.setTextColor(primary[0], primary[1], primary[2]);
    pdf.text('RESUMO GERAL', 20, 55);

    const totalVotes = results.participants_results.reduce((sum, p) => sum + p.total_votes, 0);
    
    pdf.setFontSize(12);
    pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
    pdf.text(`Total de Participantes: ${results.total_participants} pessoas`, 20, 65);
    pdf.text(`Total de Votos: ${totalVotes} votos`, 20, 72);

    const mostVoted = this.aggregateResultsByColor(results)[0];
    if (mostVoted) {
      pdf.setTextColor(accent[0], accent[1], accent[2]);
      pdf.text(`Cor Mais Votada: ${mostVoted.color} (${mostVoted.totalCount} votos)`, 110, 65);
    }

    // Caixa com distribuição de votos
    pdf.setFillColor(245, 245, 245); // Cinza claro
    pdf.rect(15, 90, 180, 120, 'F');
    pdf.setDrawColor(primary[0], primary[1], primary[2]);
    pdf.rect(15, 90, 180, 120, 'S');

    pdf.setFontSize(16);
    pdf.setTextColor(primary[0], primary[1], primary[2]);
    pdf.text('DISTRIBUICAO DE VOTOS POR COR', 20, 105);

    let y = 125;
    const aggregated = this.aggregateResultsByColor(results);
    aggregated.forEach((c, index) => {
      const pct = totalVotes > 0 ? ((c.totalCount / totalVotes) * 100).toFixed(1) : '0.0';
      
      // Barra de progresso visual simples
      const barWidth = (c.totalCount / (mostVoted?.totalCount || 1)) * 120;
      pdf.setFillColor(accent[0], accent[1], accent[2]);
      pdf.rect(25, y - 3, barWidth, 6, 'F');
      
      pdf.setFontSize(12);
      pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
      pdf.text(`${c.color}:`, 25, y + 8);
      pdf.setTextColor(accent[0], accent[1], accent[2]);
      pdf.text(`${c.totalCount} votos (${pct}%)`, 80, y + 8);
      y += 18;
    });

    // Rodapé com informações adicionais
    pdf.setFontSize(10);
    pdf.setTextColor(secondary[0], secondary[1], secondary[2]);
    pdf.text('Este relatorio foi gerado automaticamente pelo sistema.', 20, 260);
    pdf.text(`Sala finalizada com ${results.total_participants} participantes ativos.`, 20, 270);
  }

  private addPageNumbers(pdf: jsPDF): void {
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128); // Cinza
      pdf.text(`Pagina ${i} de ${pageCount}`, 20, 287);
      pdf.text(`Gerado em ${this.getCurrentDate()}`, 120, 287);
    }
  }

  // -------------------- Captura da MODAL (Imagem/PDF) --------------------

  /** Encontra o elemento da modal de resultados (tente marcar o container no HTML com data-results-modal) */
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

  /** Converte um elemento visível em PNG (DataURL) sem passar nós clonados manualmente */
  private async elementToPngDataUrl(el: HTMLElement): Promise<string> {
    el.setAttribute('data-capture', 'true');
    try {
      // Importação dinâmica do html2canvas
      const html2canvas = await import('html2canvas');
      const canvas = await (html2canvas as any).default(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        foreignObjectRendering: false,
        removeContainer: true,
        onclone: (doc: Document) => {
          const target = doc.querySelector('[data-capture="true"]') as HTMLElement | null;
          if (target) {
            target.style.maxHeight = 'none';
            target.style.overflow = 'visible';
            target.style.position = 'relative';
            target.style.transform = 'none';
            target.style.filter = 'none';
          }
        }
      });
      return canvas.toDataURL('image/png', 1.0);
    } finally {
      el.removeAttribute('data-capture');
    }
  }

  /** Converte um PNG alto em PDF A4 múltiplas páginas automaticamente */
  private pngDataUrlToMultipagePdf(imgDataUrl: string, fileName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const renderW = pageW - margin * 2;
        const renderH = renderW * (img.height / img.width);

        if (renderH <= pageH - margin * 2) {
          pdf.addImage(imgDataUrl, 'PNG', margin, margin, renderW, renderH);
          pdf.save(fileName);
          resolve();
          return;
        }

        // multi-página: recorta o PNG em fatias verticais
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
          pdf.addImage(sliceData, 'PNG', margin, margin, renderW, sliceRenderH);

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

  /** Baixa a modal como **imagem PNG** */
  downloadModalAsImage(): void {
    const results = this.currentResults();
    if (!results) return;

    const modal = this.findResultsModalEl();
    if (!modal) {
      Swal.fire({
        icon: 'error',
        title: 'Modal não encontrada',
        text: 'Não foi possível localizar a modal de resultados visível.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
      return;
    }

    Swal.fire({
      title: 'Gerando imagem...',
      text: 'Capturando a modal completa.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // pequena espera para garantir layout estável (transições)
    setTimeout(async () => {
      try {
        const imgData = await this.elementToPngDataUrl(modal);
        const link = document.createElement('a');
        link.download = `resultados_${results.room_code}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: 'Imagem Baixada!',
          text: 'A modal foi capturada como PNG.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745'
        });
      } catch (e) {
        console.error('Erro ao capturar modal (PNG):', e);
        Swal.fire({
          icon: 'error',
          title: 'Erro ao Gerar Imagem',
          text: 'Não foi possível capturar a modal como imagem.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
      }
    }, 300);
  }

  /** Baixa a modal como **PDF A4 multipágina** */
  downloadModalAsPdf(): void {
    const results = this.currentResults();
    if (!results) return;

    const modal = this.findResultsModalEl();
    if (!modal) {
      Swal.fire({
        icon: 'error',
        title: 'Modal não encontrada',
        text: 'Não foi possível localizar a modal de resultados visível.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#d33'
      });
      return;
    }

    Swal.fire({
      title: 'Gerando PDF...',
      text: 'Capturando a modal completa e montando o PDF.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    setTimeout(async () => {
      try {
        const imgData = await this.elementToPngDataUrl(modal);
        const fileName = `resultados_${results.room_code}_${new Date().toISOString().split('T')[0]}.pdf`;
        await this.pngDataUrlToMultipagePdf(imgData, fileName);
        Swal.close();
        Swal.fire({
          icon: 'success',
          title: 'PDF Baixado!',
          text: 'A modal foi capturada e convertida em PDF.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745'
        });
      } catch (e) {
        console.error('Erro ao capturar modal (PDF):', e);
        Swal.fire({
          icon: 'error',
          title: 'Erro ao Gerar PDF',
          text: 'Não foi possível capturar a modal para PDF.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#d33'
        });
      }
    }, 300);
  }

  // -------------------- Utilitários --------------------

  private cleanText(text: string): string {
    if (!text) return '';
    
    // Remove emojis e caracteres especiais problemáticos
    return text
      .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '') // Remove emojis
      .replace(/[\u2600-\u26FF]/g, '')   // Símbolos diversos
      .replace(/[\u2700-\u27BF]/g, '')   // Dingbats
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
      .replace(/[^\w\s\-\.\,\!\?\(\)]/g, '') // Remove outros caracteres especiais
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
    const map: Record<string, string> = {
      '#8B5CF6': 'Roxo',
      '#EAB308': 'Amarelo',
      '#22C55E': 'Verde',
      '#EF4444': 'Vermelho',
      '#F97316': 'Laranja',
      '#3B82F6': 'Azul'
    };
    return map[hex] || hex;
  }

  getColorHex(colorName: string): string {
    const map: Record<string, string> = {
      'Roxo': '#8B5CF6',
      'Amarelo': '#EAB308',
      'Verde': '#22C55E',
      'Vermelho': '#EF4444',
      'Laranja': '#F97316',
      'Azul': '#3B82F6'
    };
    return map[colorName] || '#6B7280';
  }

  getAggregatedResults(results: RoomResults): Array<{ color: string; totalCount: number }> {
    return this.aggregateResultsByColor(results);
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
