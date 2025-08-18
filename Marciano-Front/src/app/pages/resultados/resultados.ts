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

  // Mostra resultados somente quando TODAS as rodadas terminarem.
  // Substitua por estado real vindo do seu serviço.
  readonly allRoundsFinished = signal<boolean>(true);

  // Dados falsos: contagem de cartas recebidas pelo usuário por cor
  readonly receivedByColor = signal<Record<Cor, number>>({
    Laranja: 3,
    Verde: 5,
    Amarelo: 4,
    Azul: 7,
    Vermelho: 2,
    Roxo: 1,
  });

  // Derivados para uso limpo no template
  readonly ctLaranja = computed(() => this.receivedByColor().Laranja);
  readonly ctVerde = computed(() => this.receivedByColor().Verde);
  readonly ctAmarelo = computed(() => this.receivedByColor().Amarelo);
  readonly ctAzul = computed(() => this.receivedByColor().Azul);
  readonly ctVermelho = computed(() => this.receivedByColor().Vermelho);
  readonly ctRoxo = computed(() => this.receivedByColor().Roxo);
  readonly total = computed(
    () =>
      this.ctLaranja() +
      this.ctVerde() +
      this.ctAmarelo() +
      this.ctAzul() +
      this.ctVermelho() +
      this.ctRoxo(),
  );

  // Cores das barras (alinhadas com a UI)
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
  }

  private renderChart(dataset: Record<Cor, number>): void {
    this.destroyChart();

    const ctx = this.chartEl.nativeElement.getContext('2d');
    if (!ctx) return;

    // Ordem visual: destaque as principais e mantenha as demais
    const labels: Cor[] = ['Azul', 'Amarelo', 'Verde', 'Laranja', 'Vermelho', 'Roxo'];
    const values = labels.map((k) => dataset[k]);
    const colors = labels.map((k) => this.barColors[k]);

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cartas recebidas por cor',
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          x: {
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.formattedValue}`,
            },
          },
        },
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
