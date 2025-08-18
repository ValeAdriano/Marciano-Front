// results.component.ts (Angular 20+, standalone)
import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart, { ChartConfiguration } from 'chart.js/auto';
import { RouterLink } from '@angular/router';

type Cor = 'Laranja' | 'Verde' | 'Amarelo' | 'Azul' | 'Vermelho' | 'Roxo';

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen bg-white' },

  templateUrl: './resultados.html',
  styleUrl: './resultados.scss'
})
export class ResultadosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartEl', { static: false }) chartEl!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  readonly allRoundsFinished = signal<boolean>(true);

  // Exemplo de dados: votos por cor
  readonly receivedByColor = signal<Record<Cor, number>>({
    Laranja: 3,
    Verde: 5,
    Amarelo: 4,
    Azul: 7,
    Vermelho: 2,
    Roxo: 1,
  });

  readonly ctLaranja = computed(() => this.receivedByColor().Laranja);
  readonly ctVerde   = computed(() => this.receivedByColor().Verde);
  readonly ctAmarelo = computed(() => this.receivedByColor().Amarelo);
  readonly ctAzul    = computed(() => this.receivedByColor().Azul);
  readonly ctVermelho= computed(() => this.receivedByColor().Vermelho);
  readonly ctRoxo    = computed(() => this.receivedByColor().Roxo);
  readonly total = computed(
    () =>
      this.ctLaranja() +
      this.ctVerde() +
      this.ctAmarelo() +
      this.ctAzul() +
      this.ctVermelho() +
      this.ctRoxo(),
  );

  private readonly barColors: Record<Cor, string> = {
    Azul: '#2563eb',      // blue-600
    Amarelo: '#eab308',   // yellow-500
    Verde: '#22c55e',     // green-500
    Laranja: '#f97316',   // orange-500
    Vermelho: '#ef4444',  // red-500
    Roxo: '#7c3aed',      // violet-600
  };

  // Re-renderiza o gráfico quando o estado muda
  private renderEffect = effect(() => {
    const finished = this.allRoundsFinished();
    const data = this.receivedByColor();
    if (!finished) {
      this.destroyChart();
      return;
    }
    if (this.chartEl?.nativeElement) {
      this.renderChart(data);
    }
  });

  ngAfterViewInit(): void {
    if (this.allRoundsFinished()) {
      this.renderChart(this.receivedByColor());
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
    // Destroi o effect para evitar vazamento
    (this.renderEffect as any)?.destroy?.();
  }

  private renderChart(dataset: Record<Cor, number>): void {
    this.destroyChart();

    const canvas = this.chartEl.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ordem visual desejada no eixo Y (cada cor é uma categoria)
    const labels: Cor[] = ['Azul', 'Amarelo', 'Verde', 'Laranja', 'Vermelho', 'Roxo'];
    const values = labels.map((k) => dataset[k]);
    const colors = labels.map((k) => this.barColors[k]);

    // Ajuste de altura do canvas para caber todas as barras
    const rowHeight = 44; // px por barra (altura + espaçamento)
    canvas.height = Math.max(200, labels.length * rowHeight);

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Votos por cor',
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 6,
            // controla espessura das barras
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        // Tornar o gráfico horizontal
        indexAxis: 'y',

        scales: {
          // Agora o eixo X é o numérico (quantidade de votos)
          x: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
            title: { display: true, text: 'Votos' },
          },
          // Eixo Y são as categorias (cores)
          y: {
            grid: { display: false },
            title: { display: true, text: 'Cores' },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Ex.: "Azul: 7"
              label: (ctx) => `${ctx.label}: ${ctx.formattedValue}`,
            },
          },
        },
        animation: { duration: 250 },
      } as ChartConfiguration['options'],
    });
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
