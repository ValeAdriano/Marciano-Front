import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HomeService, UserSession } from '../home/home.service';
import { SocketService } from '../../@shared/services/socket.service';
import { takeUntil, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RodadaService implements OnDestroy {
  private readonly home = inject(HomeService);
  private readonly socket = inject(SocketService);
  private readonly destroy$ = new Subject<void>();

  // Sessão atual (do localStorage via HomeService)
  private readonly _session = signal<UserSession | null>(this.home.getSession());
  readonly session = this._session.asReadonly();

  // Código da sala derivado
  readonly roomCode = computed(() => this._session()?.roomCode ?? '');

  // ---- Timer (fake) ----
  private intervalId: number | null = null;
  private readonly _total = signal<number>(180);       // 3 minutos
  private readonly _remaining = signal<number>(this._total());

  readonly total = this._total.asReadonly();
  readonly remaining = this._remaining.asReadonly();

  // Progresso 0..1
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
    this._session.set(this.home.getSession());
    this.setupSocketListeners();
    this.startTimer(); // começa do total configurado
  }

  /** Inicia/reinicia o timer. */
  startTimer(totalSeconds?: number): void {
    if (typeof totalSeconds === 'number' && totalSeconds > 0) {
      this._total.set(totalSeconds);
      this._remaining.set(totalSeconds);
    } else {
      this._remaining.set(this._total());
    }
    this.clearTimer();
    this.intervalId = window.setInterval(() => {
      const next = this._remaining() - 1;
      this._remaining.set(next);
      if (next <= 0) this.clearTimer();
    }, 1000);
  }

  pauseTimer(): void {
    this.clearTimer();
  }

  resetTimer(): void {
    this.clearTimer();
    this._remaining.set(this._total());
  }

  /** Para chamar futuramente quando o socket emitir `round:started`. */
  onRoundStarted(totalSeconds: number): void {
    this.startTimer(totalSeconds);
  }

  /**
   * Configura listeners do WebSocket para eventos de rodada
   */
  private setupSocketListeners(): void {
    // Quando uma rodada é iniciada pelo servidor
    this.socket.onRoundStarted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        console.log('Rodada iniciada via WebSocket:', event);
        this.startTimer(event.duration);
      });

    // Quando uma rodada é finalizada pelo servidor
    this.socket.onRoundFinished$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        console.log('Rodada finalizada via WebSocket:', event);
        this.pauseTimer();
        // Aqui você pode navegar para a página de resultados
        // this.router.navigate(['/resultados']);
      });
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearTimer();
  }
}
