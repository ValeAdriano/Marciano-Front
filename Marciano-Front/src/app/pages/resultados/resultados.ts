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
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import Chart, { ChartConfiguration, ChartType } from 'chart.js/auto';
import { ResultadosService, Cor } from './resultados.service';

@Component({
  selector: 'app-resultados',
  // standalone é padrão no Angular 20
  imports: [CommonModule, RouterLink],
  templateUrl: './resultados.html',
  styleUrl: './resultados.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen bg-white' },
})
export class ResultadosComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartEl', { static: false }) chartEl!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  // service
  private readonly results = inject(ResultadosService);

  // view pronta
  private readonly viewReady = signal(false);

  // disponibilidade dos resultados
  readonly allRoundsFinished = signal<boolean>(true);

  // tipo do gráfico
  readonly chartType = signal<ChartType>('bar'); // 'bar' | 'doughnut'

  // dados do serviço (signals)
  readonly dataByColor  = this.results.receivedByColor;
  readonly total        = this.results.total;
  readonly participants = this.results.participants;
  readonly colorHex     = this.results.colorHex;

  // mapeamento cor -> planeta (UX)
  private readonly planetByColor = this.results.planetByColor;

  // contagens individuais
  readonly ctAzul     = computed(() => this.dataByColor().Azul);
  readonly ctAmarelo  = computed(() => this.dataByColor().Amarelo);
  readonly ctVerde    = computed(() => this.dataByColor().Verde);
  readonly ctLaranja  = computed(() => this.dataByColor().Laranja);
  readonly ctVermelho = computed(() => this.dataByColor().Vermelho);
  readonly ctRoxo     = computed(() => this.dataByColor().Roxo);

  // insight
  readonly topColor = this.results.topColor;
  readonly insight  = computed(() => this.results.insightFor(this.topColor()));

  // ordem canônica de cores
  private readonly order: Cor[] = ['Azul', 'Amarelo', 'Verde', 'Laranja', 'Vermelho', 'Roxo'];

  // altura dinâmica do container
  readonly chartHeight = computed(() =>
    this.chartType() === 'bar' ? Math.max(240, this.order.length * 44) : 320
  );

  // efeito: re-render quando view pronta + resultados disponíveis + tipo/dados mudarem
  private readonly renderFx = effect(() => {
    if (!this.viewReady()) return;
    if (!this.allRoundsFinished()) { this.destroyChart(); return; }

    const type = this.chartType();     // dependência
    const data = this.dataByColor();   // dependência

    // destrói instância anterior associada ao canvas
    const canvas = this.chartEl?.nativeElement;
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();
    this.chart = null;

    // recria no próximo microtask
    queueMicrotask(() => this.renderChart(type, data));
  });

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    (this.renderFx as any)?.destroy?.();
    this.destroyChart();
  }

  setChart(type: ChartType) {
    if (type !== 'bar' && type !== 'doughnut') return;
    if (this.chartType() === type) return;
    this.chartType.set(type);
  }

  // barra empilhada por participante (tabela)
  barGradient(votesByColor: Record<Cor, number>): string {
    const total = (Object.values(votesByColor) as number[]).reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const stops: string[] = [];
    for (const c of this.order) {
      const val = votesByColor[c] || 0;
      if (val <= 0) continue;
      const start = (acc / total) * 100;
      acc += val;
      const end = (acc / total) * 100;
      const hex = this.colorHex[c];
      stops.push(`${hex} ${start}% ${end}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  // aria da barra agregada (acessibilidade)
  barAria(votesByColor: Record<Cor, number>): string {
    const parts: string[] = [];
    for (const c of this.order) {
      const v = votesByColor[c] || 0;
      if (v > 0) parts.push(`${this.planetByColor[c]}: ${v}`);
    }
    return parts.length ? `Distribuição por planeta — ${parts.join(', ')}` : 'Sem votos';
  }

  // label de qualidade → planeta
  qualidadeLabel(cor: Cor): string {
    return this.planetByColor[cor];
  }
  // -------- Chart.js --------
  private renderChart(type: ChartType, dataset: Record<Cor, number>): void {
    const canvas = this.chartEl?.nativeElement;
    if (!canvas) return;

    // altura via CSS (mantemos responsive + maintainAspectRatio:false)
    canvas.style.height = `${this.chartHeight()}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labelsColors = this.order;
    const values = labelsColors.map((c) => dataset[c]);
    // Menos viva: aplica transparência nas cores
    const colors = labelsColors.map((c) => this.colorHex[c] + 'CC'); // 'CC' = ~80% opacidade
    const planetLabels = labelsColors.map((c) => this.planetByColor[c]); // rótulos exibidos

    const config: ChartConfiguration = {
      type,
      data: {
        labels: planetLabels,
        datasets: [{
          label: type === 'bar' ? 'Votos por planeta' : 'Proporção por planeta',
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          ...(type === 'bar' ? { borderRadius: 6, maxBarThickness: 32 } : {}),
        } as any],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(type === 'bar'
          ? {
              indexAxis: 'x' as const,
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: { 
                    precision: 0,
                    color: '#696969ff', // mais escuro
                    font: { size: 16, weight: 'bold' }, // maior e viva
                  },
                  grid: { color: 'rgba(0,0,0,0.06)' },
                  title: { 
                    display: true, 
                    text: 'Votos',
                    color: '#4b4b4bff', // mais escuro
                    font: { size: 18, weight: 'bold' }, // maior e viva
                  },
                },
                y: {
                  ticks: { 
                    color: '#696969ff', // mais escuro
                    font: { size: 16, weight: 'bold' }, // maior e viva
                  },
                  grid: { display: false },
                  title: { 
                    display: true, 
                    text: 'Planetas',
                    color: '#4b4b4bff', // mais escuro
                    font: { size: 18, weight: 'bold' }, // maior e viva
                  },
                },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => items[0]?.label ?? '',
                    label: (ctx) => ` ${ctx.formattedValue} voto(s)`,
                  },
                },
              },
              animation: { duration: 250 },
            }
          : {
              plugins: {
                legend: { 
                  position: 'bottom', 
                  labels: { 
                    usePointStyle: true,
                    color: '#696969ff', // mais escuro
                    font: { size: 16, weight: 'bold' }, // maior e viva
                  } 
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const colorIndex = ctx.dataIndex;
                      const cor = labelsColors[colorIndex];
                      const planeta = planetLabels[colorIndex];
                      const v = ctx.formattedValue;
                      return ` ${planeta} (${cor}): ${v}`;
                    },
                  },
                },
              },
              animation: { duration: 250 },
            }),
      } as ChartConfiguration['options'],
    };

    this.chart = new Chart(ctx, config);
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
