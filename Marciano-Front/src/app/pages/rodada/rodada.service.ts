import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { takeUntil, Subject } from 'rxjs';
import { HomeService, UserSession } from '../home/home.service';

@Injectable({
  providedIn: 'root'
})
export class RodadaService implements OnDestroy {
  private readonly home = inject(HomeService);
  private readonly destroy$ = new Subject<void>();

  // Sessão atual (do localStorage via HomeService)
  private readonly _session = signal<UserSession | null>(this.home.getSession());
  readonly session = this._session.asReadonly();

  // Código da sala derivado
  readonly roomCode = computed(() => this._session()?.roomCode ?? '');

  // Timer
  private intervalId: number | null = null;
  private readonly _total = signal(300); // 5 minutos padrão
  private readonly _remaining = signal(300);

  // Signals expostos
  readonly total = this._total.asReadonly();
  readonly remaining = this._remaining.asReadonly();

  // Computed
  readonly progress = computed(() => {
    const t = this._total();
    const r = this._remaining();
    return t > 0 ? Math.max(0, Math.min(1, 1 - r / t)) : 0;
  });

  // Rótulo MM:SS
  readonly timeLabel = computed(() => {
    const s = Math.max(0, this._remaining());
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });

  /** Inicializa/retoma a sessão e o timer. */
  init(): void {
    console.log('🚀 RodadaService.init chamado');
    // Verificar se já existe uma sessão ativa
    const currentSession = this.home.getSession();
    if (currentSession) {
      this._session.set(currentSession);
      console.log('👤 Sessão carregada para usuário:', currentSession.name, 'na sala:', currentSession.roomCode);
    } else {
      console.log('⚠️ Nenhuma sessão encontrada');
    }
    
    // Só iniciar timer se não houver um ativo
    if (!this.intervalId) {
      console.log('⏰ Iniciando timer padrão...');
      this.startTimer(); // começa do total configurado
    } else {
      console.log('⏰ Timer já está ativo com ID:', this.intervalId);
    }
  }

  /** Inicia/reinicia o timer. */
  startTimer(totalSeconds?: number): void {
    console.log('⏰ RodadaService.startTimer chamado com:', totalSeconds);
    if (typeof totalSeconds === 'number' && totalSeconds > 0) {
      this._total.set(totalSeconds);
      this._remaining.set(totalSeconds);
      console.log('⏰ Timer configurado para:', totalSeconds, 'segundos');
    } else {
      this._remaining.set(this._total());
      console.log('⏰ Timer usando valor padrão:', this._total(), 'segundos');
    }
    this.clearTimer();
    this.intervalId = window.setInterval(() => {
      const next = this._remaining() - 1;
      this._remaining.set(next);
      if (next <= 0) this.clearTimer();
    }, 1000);
    console.log('⏰ Timer iniciado com ID:', this.intervalId);
  }

  pauseTimer(): void {
    console.log('⏸️ RodadaService.pauseTimer chamado');
    this.clearTimer();
  }

  resetTimer(): void {
    console.log('🔄 RodadaService.resetTimer chamado');
    this.clearTimer();
    this._remaining.set(this._total());
  }

  /** Para chamar futuramente quando o socket emitir `round:started`. */
  onRoundStarted(totalSeconds: number): void {
    console.log('🎯 RodadaService.onRoundStarted chamado com:', totalSeconds, 'segundos');
    this.startTimer(totalSeconds);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      console.log('🛑 RodadaService.clearTimer: limpando timer com ID:', this.intervalId);
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      console.log('🛑 RodadaService.clearTimer: nenhum timer ativo para limpar');
    }
  }

  ngOnDestroy(): void {
    console.log('💀 RodadaService.ngOnDestroy chamado');
    this.destroy$.next();
    this.destroy$.complete();
    this.clearTimer();
  }
}
