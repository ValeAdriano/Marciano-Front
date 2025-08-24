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
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import Chart, { ChartConfiguration, ChartType } from 'chart.js/auto';
import { ResultadosService, Cor } from './resultados.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-resultados',
  // standalone é padrão no Angular 20
  imports: [CommonModule],
  templateUrl: './resultados.html',
  styleUrl: './resultados.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen bg-white' },
})
export class ResultadosComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartEl', { static: false }) chartEl!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  private destroy$ = new Subject<void>();

  // services
  private readonly results = inject(ResultadosService);
  private readonly route = inject(ActivatedRoute);

  // view pronta
  private readonly viewReady = signal(false);

  // estado de carregamento
  readonly isLoading = signal(true);
  readonly hasError = signal(false);

  // disponibilidade dos resultados
  readonly allRoundsFinished = computed(() => this.results.hasResults());

  // tipo do gráfico
  readonly chartType = signal<ChartType>('bar'); // 'bar' | 'doughnut'

  // dados do serviço (signals)
  readonly dataByColor  = this.results.receivedByColor;
  readonly total        = this.results.total;
  readonly participants = this.results.participants;
  readonly colorHex     = this.results.colorHex;

  // informações da sala
  readonly roomInfo = computed(() => this.results.getRoomInfo());

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
    console.log('🎨 Effect executando:', {
      viewReady: this.viewReady(),
      allRoundsFinished: this.allRoundsFinished(),
      chartType: this.chartType(),
      dataByColor: this.dataByColor(),
      isLoading: this.isLoading()
    });
    
    if (!this.viewReady()) {
      console.log('⏳ View não está pronta ainda');
      return;
    }
    
    // Se ainda está carregando, aguarda
    if (this.isLoading()) {
      console.log('⏳ Ainda carregando, aguardando...');
      return;
    }
    
    const type = this.chartType();     // dependência
    const data = this.dataByColor();   // dependência
    
    // Se não há resultados, não renderiza mas também não destrói
    if (!this.allRoundsFinished()) {
      console.log('⏳ Resultados não disponíveis ainda');
      return;
    }

    // Verifica se há dados válidos para renderizar
    const totalVotes = Object.values(data).reduce((sum, count) => sum + count, 0);
    if (totalVotes === 0) {
      console.log('⚠️ Sem dados para renderizar (total de cartas: 0)');
      return;
    }

    console.log('🚀 Renderizando gráfico:', { type, data, totalVotes });
    
    // destrói instância anterior associada ao canvas
    const canvas = this.chartEl?.nativeElement;
    if (!canvas) {
      console.log('❌ Canvas não encontrado');
      return;
    }
    Chart.getChart(canvas)?.destroy();
    this.chart = null;

    // recria no próximo microtask
    queueMicrotask(() => this.renderChart(type, data));
  });

  ngOnInit(): void {
    console.log('🚀 ngOnInit executado');
    // Carregar resultados da sala
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      console.log('📋 Parâmetros da rota recebidos:', params);
      const roomCode = params['roomCode'];
      const participantId = params['participantId'];
      
      if (roomCode && participantId) {
        console.log('✅ Parâmetros válidos, carregando resultados');
        this.loadResults(roomCode, parseInt(participantId));
      } else {
        console.log('❌ Parâmetros inválidos');
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    console.log('🎯 ngAfterViewInit executado');
    this.viewReady.set(true);
    console.log('✅ viewReady definido como true');
    
    // Verifica se já pode renderizar o gráfico
    setTimeout(() => {
      if (this.allRoundsFinished() && !this.isLoading()) {
        console.log('🎯 View pronta e dados disponíveis, renderizando gráfico');
        this.forceChartRender();
      }
    }, 50);
  }

  ngOnDestroy(): void {
    console.log('🗑️ ngOnDestroy executado');
    this.destroy$.next();
    this.destroy$.complete();
    (this.renderFx as any)?.destroy?.();
    this.destroyChart();
  }

  private loadResults(roomCode: string, participantId: number): void {
    console.log('🔄 Componente: Carregando resultados para:', roomCode, participantId);
    this.isLoading.set(true);
    this.hasError.set(false);

    this.results.loadRoomResults(roomCode, participantId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (success) => {
        console.log('✅ Componente: Resultados carregados com sucesso:', success);
        this.isLoading.set(false);
        if (!success) {
          console.log('❌ Componente: Falha ao carregar resultados');
          this.hasError.set(true);
        } else {
          console.log('🎯 Componente: Dados carregados, verificando disponibilidade...');
          // Força uma verificação dos dados após carregamento
          setTimeout(() => {
            console.log('🔍 Verificação tardia:', {
              allRoundsFinished: this.allRoundsFinished(),
              dataByColor: this.dataByColor(),
              viewReady: this.viewReady()
            });
            // Força a execução do effect após o carregamento dos dados
            this.forceChartRender();
          }, 100);
        }
      },
      error: (error) => {
        console.log('❌ Componente: Erro ao carregar resultados:', error);
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  // Método para forçar a renderização do gráfico
  private forceChartRender(): void {
    console.log('🔄 Forçando renderização do gráfico');
    console.log('🔍 Estado atual:', {
      viewReady: this.viewReady(),
      allRoundsFinished: this.allRoundsFinished(),
      isLoading: this.isLoading(),
      chartType: this.chartType(),
      dataByColor: this.dataByColor()
    });
    
    if (this.viewReady() && this.allRoundsFinished() && !this.isLoading()) {
      const type = this.chartType();
      const data = this.dataByColor();
      console.log('🚀 Renderizando gráfico forçado:', { type, data });
      
      // Verifica se há dados válidos
      const totalVotes = Object.values(data).reduce((sum, count) => sum + count, 0);
      if (totalVotes > 0) {
        this.renderChart(type, data);
      } else {
        console.log('⚠️ Sem dados para renderizar (total de cartas: 0)');
      }
    } else {
      console.log('⏳ Condições não atendidas para renderização:', {
        viewReady: this.viewReady(),
        allRoundsFinished: this.allRoundsFinished(),
        isLoading: this.isLoading()
      });
    }
  }

  setChart(type: ChartType) {
    console.log('🔄 setChart chamado:', type);
    if (type !== 'bar' && type !== 'doughnut') {
      console.log('❌ Tipo de gráfico inválido:', type);
      return;
    }
    if (this.chartType() === type) {
      console.log('⏭️ Mesmo tipo de gráfico, ignorando');
      return;
    }
    console.log('✅ Alterando tipo de gráfico para:', type);
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
    return parts.length ? `Distribuição por planeta — ${parts.join(', ')}` : 'Sem cartas';
  }

  // label de qualidade → planeta
  qualidadeLabel(cor: Cor): string {
    return this.planetByColor[cor];
  }

  // -------- Chart.js --------
  private renderChart(type: ChartType, dataset: Record<Cor, number>): void {
    console.log('🎨 renderChart chamado:', { type, dataset });
    
    const canvas = this.chartEl?.nativeElement;
    if (!canvas) {
      console.log('❌ Canvas não encontrado em renderChart');
      return;
    }

    // altura via CSS (mantemos responsive + maintainAspectRatio:false)
    canvas.style.height = `${this.chartHeight()}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('❌ Contexto 2D não encontrado');
      return;
    }

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
          label: type === 'bar' ? 'Cartas por planeta' : 'Proporção por planeta',
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
                    text: 'Cartas',
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
                    label: (ctx) => ` ${ctx.formattedValue} carta(s)`,
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
    console.log('✅ Gráfico criado com sucesso:', this.chart);
  }

  private destroyChart(): void {
    if (this.chart) {
      console.log('🗑️ Destruindo gráfico existente');
      this.chart.destroy();
      this.chart = null;
    }
  }
}
