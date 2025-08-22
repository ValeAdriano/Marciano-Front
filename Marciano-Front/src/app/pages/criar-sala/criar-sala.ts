import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { CriarSalaService, CreateRoomRequest, Room, RoomReport, RoomStatus, RoomResults, ColorResult } from './criar-sala.service';
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
  
  // Formulário reativo - mantendo o nome 'form' como no HTML
  form!: FormGroup;

  // Signals para o template - mantendo o padrão original
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


  // Computed values
  readonly displayName = computed(() => 'Usuário');

  ngOnInit(): void {
    this.initForm();
    this.generateCode(); // Gera código automaticamente
    this.loadReports(); // Carrega relatórios existentes
  }

  ngAfterViewInit(): void {
    // Inicialização após a view estar pronta
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Destruir gráfico se existir
    if (this.resultsChart) {
      this.resultsChart.destroy();
    }
  }

  /**
   * Inicializa o formulário
   */
  private initForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]]
    });
  }

  /**
   * Gera um código único para a sala
   * 6 caracteres alfanuméricos, evitando confusões (sem I/1/O/0)
   */
  generateRoomCode(): string {
    const alphabet = '23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  /**
   * Gera um novo código para a sala
   */
  generateCode(): void {
    const newCode = this.generateRoomCode();
    this.code.set(newCode);
    
    // Mostra notificação de sucesso
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

  /**
   * Copia o código da sala para a área de transferência
   */
  copyCode(): void {
    const codeValue = this.code();
    if (!codeValue) return;

    navigator.clipboard.writeText(codeValue).then(() => {
      // Notificação de sucesso
      Swal.fire({
        icon: 'success',
        title: 'Código Copiado!',
        text: `${codeValue} foi copiado para a área de transferência`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }).catch((error) => {
      console.error('Erro ao copiar código:', error);
      // Notificação de erro
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

  /**
   * Copia texto para a área de transferência
   */
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

  /**
   * Cria a sala
   */
  onCreateRoom(): void {
    if (this.form.invalid || !this.code()) {
      // Mostra erro de validação
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
      isAnonymous: false // Valor fixo por enquanto
    };

    this.criarSalaService.createRoom(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (room: Room) => {
          console.log('Sala criada com sucesso:', room);
          this.creating.set(false);
          this.createdRoom.set(room);
          
          // Mostra sucesso
          Swal.fire({
            icon: 'success',
            title: 'Sala Criada com Sucesso!',
            text: `${room.title} foi criada com o código ${room.code}`,
            showConfirmButton: true,
            confirmButtonText: 'Ver Detalhes',
            confirmButtonColor: '#28a745',
            allowOutsideClick: false
          });

          // Recarrega relatórios para incluir a nova sala
          this.loadReports();
        },
        error: (error: any) => {
          console.error('Erro ao criar sala:', error);
          this.creating.set(false);

          // Mostra erro customizado
          this.showCustomError(error);
        }
      });
  }

  /**
   * Carrega o status de uma sala específica
   */
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

  /**
   * Avança para a próxima etapa da sala
   */
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
            next: (response) => {
              console.log('Etapa avançada com sucesso:', response);
              
              // Recarrega o status da sala
              this.loadRoomStatus(roomCode);
              
              // Mostra sucesso
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
              
              // Mostra erro
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

  /**
   * Abre o relatório de uma sala
   */
  openRoomReport(roomCode: string): void {
    this.criarSalaService.openRoomReport(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.reportUrl) {
            // Abre o relatório em nova aba
            window.open(response.reportUrl, '_blank');
          } else {
            // Mostra mensagem se não houver relatório
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
          
          // Mostra erro
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

  /**
   * Obtém o status de uma sala
   */
  getRoomStatus(roomCode: string): RoomStatus | null {
    return this.roomStatuses().get(roomCode) || null;
  }

  /**
   * Verifica se uma sala está finalizada
   */
  isRoomFinished(roomCode: string): boolean {
    const status = this.getRoomStatus(roomCode);
    return status?.status === 'finalizado';
  }

  /**
   * Verifica se uma sala pode avançar para próxima etapa
   */
  canAdvanceRoom(roomCode: string): boolean {
    const status = this.getRoomStatus(roomCode);
    return status ? status.status !== 'finalizado' : false;
  }

  /**
   * Obtém o texto de exibição do status
   */
  getStatusDisplay(status: string | undefined): string {
    if (!status || status === '' || status === null || status === undefined) {
      return 'Carregando...';
    }
    
    // Mapeamento para status específicos
    if (status === 'lobby') return '🔄 Lobby';
    if (status === 'finalizado') return '🏁 Finalizado';
    
    // Formatação para rodadas (rodada_0, rodada_1, rodada_2, etc.)
    if (status.startsWith('rodada_')) {
      const roundNumber = status.replace('rodada_', '');
      const roundNum = parseInt(roundNumber);
      
      // Formatação especial para rodada 0
      if (roundNum === 0) {
        return '🎯 Rodada 0 - Autoavaliação';
      }
      
      // Formatação para outras rodadas
      return `🎯 Rodada ${roundNum} - Votação`;
    }
    
    // Para outros status não mapeados, retorna o status original
    return status;
  }

  /**
   * Calcula a porcentagem de progresso da votação (máximo 100%)
   */
  getProgressPercentage(roomCode: string): number {
    const status = this.getRoomStatus(roomCode);
    if (!status) return 0;
    
    // Só mostrar progresso se estiver em uma rodada ativa
    if (status.status === 'lobby' || status.status === 'finalizado') return 0;
    
    if (!status.round_progress) return 0;
    
    // Calcular porcentagem baseada na rodada atual
    const currentVotes = status.round_progress.current_votes;
    const expectedVotes = status.round_progress.expected_votes;
    
    if (expectedVotes === 0) return 0;
    
    // Garantir que a porcentagem não exceda 100%
    const percentage = Math.min((currentVotes / expectedVotes) * 100, 100);
    return Math.round(percentage);
  }

  /**
   * Obtém a cor do badge de status
   */
  getStatusBadgeColor(status: string | undefined): string {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Mapeamento para status específicos
    if (status === 'lobby') return 'bg-blue-100 text-blue-800';
    if (status === 'finalizado') return 'bg-purple-100 text-purple-800';
    
    // Formatação para rodadas (rodada_0, rodada_1, rodada_2, etc.)
    if (status.startsWith('rodada_')) {
      const roundNumber = status.replace('rodada_', '');
      const roundNum = parseInt(roundNumber);
      
      // Cores diferentes para cada tipo de rodada
      if (roundNum === 0) {
        return 'bg-yellow-100 text-yellow-800'; // Rodada 0 - Autoavaliação
      } else if (roundNum === 1) {
        return 'bg-green-100 text-green-800';   // Rodada 1 - Primeira votação
      } else if (roundNum === 2) {
        return 'bg-indigo-100 text-indigo-800'; // Rodada 2 - Segunda votação
      } else {
        // Para rodadas 3+, usar cores alternadas
        return roundNum % 2 === 0 ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800';
      }
    }
    
    // Para outros status não mapeados
    return 'bg-gray-100 text-gray-800';
  }

    // ===== FUNCIONALIDADES ADMINISTRATIVAS =====

  /**
   * Deleta uma sala permanentemente
   */
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
      if (result.isConfirmed) {
        this.executeDeleteRoom(roomCode);
      }
    });
  }

  /**
   * Executa a deleção da sala
   */
  private executeDeleteRoom(roomCode: string): void {
    this.criarSalaService.deleteRoom(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Sala deletada com sucesso:', response);
          
          // Remove da lista local
          const currentReports = this.reports();
          const updatedReports = currentReports.filter(r => r.code !== roomCode);
          this.reports.set(updatedReports);
          
          // Remove do status cache
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

  /**
   * Reseta uma sala
   */
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
            next: (response) => {
              console.log('Sala resetada com sucesso:', response);
              
              // Recarrega o status da sala
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
                title: 'Erro ao Resetar',
                text: 'Não foi possível resetar a sala.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#d33'
              });
            }
          });
      }
    });
  }

  /**
   * Limpa todos os votos de uma sala
   */
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
            next: (response) => {
              console.log('Votos limpos com sucesso:', response);
              
              // Recarrega o status da sala
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

  /**
   * Finaliza rodada forçadamente
   */
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
            next: (response) => {
              console.log('Rodada finalizada com sucesso:', response);
              
              // Recarrega o status da sala
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

  /**
   * Finaliza sala forçadamente
   */
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
            next: (response) => {
              console.log('Sala finalizada com sucesso:', response);
              
              // Recarrega o status da sala
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

  /**
   * Exporta dados de uma sala
   */
  exportRoomData(roomCode: string, format: 'csv' | 'json' = 'json'): void {
    this.criarSalaService.exportRoomData(roomCode, format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          // Criar download do arquivo
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

  /**
   * Mostra estatísticas de uma sala
   */
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

  /**
   * Mostra menu administrativo para uma sala
   */
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
        // Adicionar event listeners aos botões
        document.getElementById('force-finish-round')?.addEventListener('click', () => {
          Swal.close();
          this.forceFinishRound(roomCode);
        });

        document.getElementById('force-finish-room')?.addEventListener('click', () => {
          Swal.close();
          this.forceFinishRoom(roomCode);
        });

        document.getElementById('clear-votes')?.addEventListener('click', () => {
          Swal.close();
          this.clearAllVotes(roomCode);
        });

        document.getElementById('export-csv')?.addEventListener('click', () => {
          Swal.close();
          this.exportRoomData(roomCode, 'csv');
        });
      }
    });
  }

  /**
   * Alterna a expansão de uma sala
   */
  toggleRoomExpansion(roomCode: string): void {
    const currentExpanded = this.expandedRooms();
    const newExpanded = new Set(currentExpanded);
    
    if (newExpanded.has(roomCode)) {
      newExpanded.delete(roomCode);
    } else {
      newExpanded.add(roomCode);
      // Carregar detalhes da sala quando expandir
      this.loadRoomDetails(roomCode);
    }
    
    this.expandedRooms.set(newExpanded);
  }

  /**
   * Verifica se uma sala está expandida
   */
  isRoomExpanded(roomCode: string): boolean {
    return this.expandedRooms().has(roomCode);
  }

  /**
   * Carrega detalhes adicionais da sala
   */
  private loadRoomDetails(roomCode: string): void {
    // Sempre carregar status da sala quando expandir para garantir dados atualizados
    this.loadRoomStatus(roomCode);
  }

  /**
   * Obtém mensagem de erro customizada baseada no tipo de erro
   */
  private getCustomErrorMessage(error: any): { title: string; message: string; icon: 'error' | 'warning' | 'info' } {
    // Erro de rede/conexão
    if (error.status === 0 || error.statusText === 'Unknown Error') {
      return {
        title: 'Erro de Conexão',
        message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
        icon: 'error'
      };
    }

    // Erros de validação do backend
    if (error.status === 400) {
      if (error.error?.message) {
        return {
          title: 'Dados Inválidos',
          message: error.error.message,
          icon: 'warning'
        };
      }
      return {
        title: 'Dados Inválidos',
        message: 'Os dados enviados não estão no formato correto. Verifique as informações e tente novamente.',
        icon: 'warning'
      };
    }

    // Erro de autorização
    if (error.status === 401) {
      return {
        title: 'Não Autorizado',
        message: 'Sua sessão expirou ou você não tem permissão para esta ação. Faça login novamente.',
        icon: 'warning'
      };
    }

    // Erro de acesso negado
    if (error.status === 403) {
      return {
        title: 'Acesso Negado',
        message: 'Você não tem permissão para criar salas. Entre em contato com o administrador.',
        icon: 'warning'
      };
    }

    // Erro de conflito (código já existe)
    if (error.status === 409) {
      return {
        title: 'Código Já Existe',
        message: 'Este código de sala já está em uso. Gere um novo código e tente novamente.',
        icon: 'warning'
      };
    }

    // Erro de validação específica
    if (error.status === 422) {
      const validationErrors = error.error?.errors || [];
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map((err: any) => err.message).join('\n• ');
        return {
          title: 'Erro de Validação',
          message: `Os seguintes problemas foram encontrados:\n\n• ${errorMessages}`,
          icon: 'warning'
        };
      }
      return {
        title: 'Erro de Validação',
        message: 'Os dados enviados não passaram na validação do servidor.',
        icon: 'warning'
      };
    }

    // Erro interno do servidor
    if (error.status === 500) {
      return {
        title: 'Erro do Servidor',
        message: 'Ocorreu um erro interno no servidor. Tente novamente em alguns minutos ou entre em contato com o suporte.',
        icon: 'error'
      };
    }

    // Serviço indisponível
    if (error.status === 503) {
      return {
        title: 'Serviço Indisponível',
        message: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.',
        icon: 'info'
      };
    }

    // Timeout
    if (error.status === 408 || error.name === 'TimeoutError') {
      return {
        title: 'Tempo Esgotado',
        message: 'A requisição demorou muito para responder. Verifique sua conexão e tente novamente.',
        icon: 'warning'
      };
    }

    // Erro de código duplicado específico
    if (error.error?.code === 'ROOM_CODE_EXISTS') {
      return {
        title: 'Código Duplicado',
        message: 'Este código de sala já existe. Gere um novo código único.',
        icon: 'warning'
      };
    }

    // Erro de limite de salas
    if (error.error?.code === 'USER_ROOM_LIMIT_EXCEEDED') {
      return {
        title: 'Limite de Salas Atingido',
        message: 'Você já criou o número máximo de salas permitidas.',
        icon: 'warning'
      };
    }

    // Erro de nome duplicado
    if (error.error?.code === 'ROOM_NAME_EXISTS') {
      return {
        title: 'Nome Duplicado',
        message: 'Já existe uma sala com este nome. Escolha um nome diferente.',
        icon: 'warning'
      };
    }

    // Erro genérico com mensagem do backend
    if (error.error?.message) {
      return {
        title: 'Erro na Operação',
        message: error.error.message,
        icon: 'error'
      };
    }

    // Erro padrão para códigos desconhecidos
    return {
      title: 'Erro Inesperado',
      message: `Ocorreu um erro inesperado (${error.status || 'desconhecido'}). Tente novamente ou entre em contato com o suporte.`,
      icon: 'error'
    };
  }

  /**
   * Mostra alerta de erro customizado
   */
  private showCustomError(error: any): void {
    const errorInfo = this.getCustomErrorMessage(error);
    
    Swal.fire({
      icon: errorInfo.icon,
      title: errorInfo.title,
      html: errorInfo.message.replace(/\n/g, '<br>'),
      confirmButtonText: 'Entendi',
      confirmButtonColor: errorInfo.icon === 'error' ? '#d33' : 
                          errorInfo.icon === 'warning' ? '#f39c12' : '#3085d6',
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  }

  /**
   * Reseta o formulário
   */
  resetForm(): void {
    // Confirma antes de limpar
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
        this.generateCode(); // Gera novo código
        
        // Notificação de sucesso
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

  /**
   * Carrega os relatórios de salas anteriores
   */
  loadReports(): void {
    this.loadingReports.set(true);
    
    this.criarSalaService.getRoomReports()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports: RoomReport[]) => {
          this.reports.set(reports);
          this.loadingReports.set(false);
          
          // Não carrega status automaticamente - apenas quando expandir
        },
        error: (error: any) => {
          console.error('Erro ao carregar relatórios:', error);
          this.loadingReports.set(false);
          this.reports.set([]);
        }
      });
  }

  /**
   * Atualiza os relatórios
   */
  refreshReports(): void {
    this.loadReports();
    
    // Mostra notificação
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

  /**
   * Track by para o ngFor
   */
  trackById(index: number, item: any): string {
    return item.id || index;
  }

  /**
   * Abre os resultados de uma sala específica
   */
  openRoomResults(roomCode: string): void {
    // Primeiro verifica se a sala tem resultados disponíveis
    this.criarSalaService.getRoomResults(roomCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results: RoomResults) => {
          // Se tem resultados, abre a modal
          if (results && results.participants_results && results.participants_results.length > 0) {
            this.openResultsModal(results);
          } else {
            // Se não tem resultados, mostra mensagem
            Swal.fire({
              icon: 'info',
              title: 'Resultados Indisponíveis',
              text: 'Esta sala ainda não possui resultados disponíveis. Os resultados aparecem após a finalização das rodadas.',
              confirmButtonText: 'Entendi',
              confirmButtonColor: '#3085d6'
            });
          }
        },
        error: (error: any) => {
          console.error('Erro ao verificar resultados:', error);
          
          // Se der erro, tenta abrir a modal mesmo assim
          Swal.fire({
            title: 'Ver Resultados',
            text: `Deseja visualizar os resultados da sala ${roomCode}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Ver Resultados',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d'
          }).then((result) => {
            if (result.isConfirmed) {
              // Tenta buscar os resultados novamente
              this.loadRoomResultsForModal(roomCode);
            }
          });
        }
      });
  }

  /**
   * Abre a modal de resultados
   */
  private openResultsModal(results: RoomResults): void {
    this.currentResults.set(results);
    this.showResultsModal.set(true);
    
    // Aguarda um pouco para a modal renderizar antes de criar o gráfico
    setTimeout(() => {
      this.createResultsChart();
    }, 100);
  }

  /**
   * Carrega resultados para a modal
   */
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
            text: 'Não foi possível carregar os resultados da sala. Tente novamente.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  /**
   * Fecha a modal de resultados
   */
  closeResultsModal(): void {
    this.showResultsModal.set(false);
    this.currentResults.set(null);
    
    // Destruir gráfico
    if (this.resultsChart) {
      this.resultsChart.destroy();
      this.resultsChart = null;
    }
  }

  /**
   * Cria o gráfico de resultados
   */
  private createResultsChart(): void {
    if (!this.resultsChartCanvas || !this.currentResults()) return;

    const ctx = this.resultsChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Destruir gráfico anterior se existir
    if (this.resultsChart) {
      this.resultsChart.destroy();
    }

    const results = this.currentResults()!;
    const aggregatedResults = this.aggregateResultsByColor(results);

    this.resultsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: aggregatedResults.map(r => r.color),
        datasets: [{
          label: 'Total de Votos',
          data: aggregatedResults.map(r => r.totalCount),
          backgroundColor: [
            '#8B5CF6', // Roxo
            '#EAB308', // Amarelo
            '#22C55E', // Verde
            '#EF4444', // Vermelho
            '#F97316', // Laranja
            '#3B82F6'  // Azul
          ],
          borderColor: [
            '#7C3AED', // Roxo
            '#CA8A04', // Amarelo
            '#16A34A', // Verde
            '#DC2626', // Vermelho
            '#EA580C', // Laranja
            '#2563EB'  // Azul
          ],
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
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  /**
   * Agrega resultados por cor
   */
  private aggregateResultsByColor(results: RoomResults): Array<{color: string, totalCount: number}> {
    const colorMap = new Map<string, number>();
    
    // Inicializar contadores para todas as cores
    const allColors = ['Roxo', 'Amarelo', 'Verde', 'Vermelho', 'Laranja', 'Azul'];
    allColors.forEach(color => colorMap.set(color, 0));
    
    // Somar votos de todos os participantes
    results.participants_results.forEach(participant => {
      participant.results_by_color.forEach(colorResult => {
        const currentCount = colorMap.get(colorResult.color) || 0;
        colorMap.set(colorResult.color, currentCount + colorResult.count);
      });
    });
    
    // Converter para array e ordenar por total de votos
    return Array.from(colorMap.entries())
      .map(([color, totalCount]) => ({ color, totalCount }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }

  /**
   * Baixa o relatório em formato PDF
   */
  downloadResultsReport(): void {
    const results = this.currentResults();
    if (!results) return;

    try {
      // Capturar o gráfico como imagem antes de gerar o PDF
      this.captureChartAsImage().then((chartImageData) => {
        this.generatePDFWithChart(results, chartImageData);
      }).catch((error) => {
        console.error('Erro ao capturar gráfico:', error);
        // Se não conseguir capturar o gráfico, gera PDF sem ele
        this.generatePDFWithChart(results, null);
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

  /**
   * Captura o gráfico como imagem
   */
  private async captureChartAsImage(): Promise<string | null> {
    if (!this.resultsChart || !this.resultsChartCanvas) {
      return null;
    }

    try {
      // Capturar o canvas como imagem
      const canvas = this.resultsChartCanvas.nativeElement;
      const imageData = canvas.toDataURL('image/png', 1.0);
      return imageData;
    } catch (error) {
      console.error('Erro ao capturar gráfico:', error);
      return null;
    }
  }

  /**
   * Gera o PDF com o gráfico incluído
   */
  private generatePDFWithChart(results: RoomResults, chartImageData: string | null): void {
    try {
      // Criar novo documento PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Configurações de fonte
      pdf.setFont('helvetica');
      
      // Cores para o PDF (definidas como tuples para evitar erros de TypeScript)
      const primaryColor: [number, number, number] = [59, 130, 246]; // Azul
      const secondaryColor: [number, number, number] = [107, 114, 128]; // Cinza
      const accentColor: [number, number, number] = [34, 197, 94]; // Verde
      
      // Título principal
      pdf.setFontSize(24);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('📊 Relatório de Resultados', 20, 30);
      
      // Informações da sala
      pdf.setFontSize(16);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.text(`Sala: ${results.room_title}`, 20, 45);
      pdf.text(`Código: ${results.room_code}`, 20, 55);
      pdf.text(`Participantes: ${results.total_participants}`, 20, 65);
      pdf.text(`Data: ${this.getCurrentDate()}`, 20, 75);
      
      // Linha separadora
      pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.setLineWidth(0.5);
      pdf.line(20, 85, 190, 85);
      
      // Gráfico de resultados (se disponível)
      if (chartImageData) {
        pdf.setFontSize(18);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text('📈 Gráfico de Resultados', 20, 100);
        
        // Adicionar a imagem do gráfico
        try {
          // Calcular dimensões para o gráfico (largura máxima 170mm, altura proporcional)
          const maxWidth = 170;
          const maxHeight = 80;
          
          // Adicionar imagem do gráfico
          pdf.addImage(chartImageData, 'PNG', 20, 110, maxWidth, maxHeight);
          
          // Posição Y após o gráfico
          let yPosition = 110 + maxHeight + 20;
          
          // Resumo por cor após o gráfico
          pdf.setFontSize(18);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text('🎨 Resumo de Votos por Cor', 20, yPosition);
          
          yPosition += 15;
          
          const aggregatedResults = this.aggregateResultsByColor(results);
          
          aggregatedResults.forEach((colorResult, index) => {
            if (yPosition > 250) {
              pdf.addPage();
              yPosition = 20;
            }
            
            pdf.setFontSize(12);
            pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            pdf.text(`${colorResult.color}:`, 25, yPosition);
            
            pdf.setFontSize(14);
            pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            pdf.text(`${colorResult.totalCount} votos`, 120, yPosition);
            
            yPosition += 8;
          });
          
        } catch (imageError) {
          console.error('Erro ao adicionar gráfico ao PDF:', imageError);
          // Se der erro na imagem, continua sem ela
          let yPosition = 100;
          
          // Resumo por cor
          pdf.setFontSize(18);
          pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          pdf.text('🎨 Resumo de Votos por Cor', 20, yPosition);
          
          yPosition += 15;
          
          const aggregatedResults = this.aggregateResultsByColor(results);
          
          aggregatedResults.forEach((colorResult, index) => {
            if (yPosition > 250) {
              pdf.addPage();
              yPosition = 20;
            }
            
            pdf.setFontSize(12);
            pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            pdf.text(`${colorResult.color}:`, 25, yPosition);
            
            pdf.setFontSize(14);
            pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
            pdf.text(`${colorResult.totalCount} votos`, 120, yPosition);
            
            yPosition += 8;
          });
        }
      } else {
        // Se não tiver gráfico, mostra apenas o resumo por cor
        let yPosition = 100;
        
        // Resumo por cor
        pdf.setFontSize(18);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text('🎨 Resumo de Votos por Cor', 20, yPosition);
        
        yPosition += 15;
        
        const aggregatedResults = this.aggregateResultsByColor(results);
        
        aggregatedResults.forEach((colorResult, index) => {
          if (yPosition > 250) {
            pdf.addPage();
            yPosition = 20;
          }
          
          pdf.setFontSize(12);
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          pdf.text(`${colorResult.color}:`, 25, yPosition);
          
          pdf.setFontSize(14);
          pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
          pdf.text(`${colorResult.totalCount} votos`, 120, yPosition);
          
          yPosition += 8;
        });
      }
      
      // Nova página para detalhes dos participantes
      pdf.addPage();
      
      // Título da seção de participantes
      pdf.setFontSize(18);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('👥 Detalhes dos Participantes', 20, 30);
      
      let yPosition = 45;
      
      results.participants_results.forEach((participant, participantIndex) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }
        
        // Nome do participante
        pdf.setFontSize(14);
        pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pdf.text(`${participantIndex + 1}. ${participant.name}`, 20, yPosition);
        
        yPosition += 8;
        
        // Cor escolhida
        pdf.setFontSize(12);
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        const envelopeColor = this.getColorNameFromHex(participant.envelope_choice);
        pdf.text(`Cor Escolhida: ${envelopeColor}`, 25, yPosition);
        pdf.text(`Total de Votos: ${participant.total_votes}`, 25, yPosition + 6);
        
        yPosition += 15;
        
        // Votos detalhados
        if (participant.detailed_votes.length > 0) {
          pdf.setFontSize(11);
          pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          pdf.text('Votos Recebidos:', 25, yPosition);
          
          yPosition += 6;
          
          participant.detailed_votes.forEach((vote, voteIndex) => {
            if (yPosition > 250) {
              pdf.addPage();
              yPosition = 20;
            }
            
            pdf.setFontSize(10);
            pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            pdf.text(`• ${vote.from_name} → ${vote.card_color}`, 30, yPosition);
            
            yPosition += 5;
            
            // Descrição da carta (quebrar linha se necessário)
            const description = vote.card_description;
            if (description.length > 60) {
              const lines = this.splitTextToFit(description, 60);
              lines.forEach(line => {
                if (yPosition > 250) {
                  pdf.addPage();
                  yPosition = 20;
                }
                pdf.text(`  ${line}`, 35, yPosition);
                yPosition += 4;
              });
            } else {
              pdf.text(`  ${description}`, 35, yPosition);
              yPosition += 4;
            }
            
            yPosition += 2;
          });
        }
        
        yPosition += 10;
        
        // Linha separadora entre participantes
        if (participantIndex < results.participants_results.length - 1) {
          pdf.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
          pdf.setLineWidth(0.2);
          pdf.line(20, yPosition, 190, yPosition);
          yPosition += 5;
        }
      });
      
      // Adicionar página de estatísticas finais
      pdf.addPage();
      
      // Título da página de estatísticas
      pdf.setFontSize(18);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('📈 Estatísticas Finais', 20, 30);
      
      // Estatísticas gerais
      pdf.setFontSize(14);
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.text(`Total de Participantes: ${results.total_participants}`, 20, 50);
      
      const totalVotes = results.participants_results.reduce((sum, p) => sum + p.total_votes, 0);
      pdf.text(`Total de Votos: ${totalVotes}`, 20, 65);
      
      const mostVotedColor = this.aggregateResultsByColor(results)[0];
      if (mostVotedColor) {
        pdf.text(`Cor Mais Votada: ${mostVotedColor.color} (${mostVotedColor.totalCount} votos)`, 20, 80);
      }
      
      // Distribuição de cores
      pdf.setFontSize(16);
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text('Distribuição de Votos por Cor:', 20, 100);
      
      yPosition = 115;
      const aggregatedResults = this.aggregateResultsByColor(results);
      aggregatedResults.forEach((colorResult, index) => {
        const percentage = ((colorResult.totalCount / totalVotes) * 100).toFixed(1);
        pdf.setFontSize(12);
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.text(`${colorResult.color}: ${colorResult.totalCount} votos (${percentage}%)`, 25, yPosition);
        yPosition += 8;
      });
      
      // Rodapé
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        pdf.text(`Página ${i} de ${pageCount}`, 20, 287);
        pdf.text(`Gerado em ${this.getCurrentDate()}`, 120, 287);
      }
      
      // Salvar o PDF
      const fileName = `resultados_${results.room_code}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      // Mostrar confirmação
      Swal.fire({
        icon: 'success',
        title: 'Relatório PDF Baixado!',
        text: 'O relatório em PDF foi gerado e baixado com sucesso, incluindo o gráfico!',
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

  /**
   * Quebra texto para caber na largura do PDF
   */
  private splitTextToFit(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).length <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    });
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * Converte código hexadecimal para nome da cor
   */
  getColorNameFromHex(hex: string): string {
    const colorMap: { [key: string]: string } = {
      '#8B5CF6': 'Roxo',
      '#EAB308': 'Amarelo',
      '#22C55E': 'Verde',
      '#EF4444': 'Vermelho',
      '#F97316': 'Laranja',
      '#3B82F6': 'Azul'
    };
    
    return colorMap[hex] || hex;
  }

  /**
   * Converte nome da cor para código hexadecimal
   */
  getColorHex(colorName: string): string {
    const colorMap: { [key: string]: string } = {
      'Roxo': '#8B5CF6',
      'Amarelo': '#EAB308',
      'Verde': '#22C55E',
      'Vermelho': '#EF4444',
      'Laranja': '#F97316',
      'Azul': '#3B82F6'
    };
    
    return colorMap[colorName] || '#6B7280';
  }

  /**
   * Método público para usar no template
   */
  getAggregatedResults(results: RoomResults): Array<{color: string, totalCount: number}> {
    return this.aggregateResultsByColor(results);
  }

  /**
   * Retorna a data atual formatada para o template
   */
  getCurrentDate(): string {
    return new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

