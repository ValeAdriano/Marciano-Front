import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntil, Subject } from 'rxjs';
import { CriarSalaService, CreateRoomRequest, Room, RoomReport, RoomStatus } from './criar-sala.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-criar-sala',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './criar-sala.html',
  styleUrls: ['./criar-sala.scss']
})
export class CriarSalaComponent implements OnInit, OnDestroy {
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



  // Computed values
  readonly displayName = computed(() => 'Usuário');

  ngOnInit(): void {
    this.initForm();
    this.generateCode(); // Gera código automaticamente
    this.loadReports(); // Carrega relatórios existentes
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
}

