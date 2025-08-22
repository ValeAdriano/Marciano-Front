import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { RodadaZeroComponent } from './rodada-zero';
import { RodadaZeroApiService } from './rodada-zero.service';

describe('RodadaZeroComponent', () => {
  let component: RodadaZeroComponent;
  let fixture: ComponentFixture<RodadaZeroComponent>;
  let apiService: jasmine.SpyObj<RodadaZeroApiService>;

  beforeEach(async () => {
    const apiSpy = jasmine.createSpyObj('RodadaZeroApiService', [
      'connectSocket', 
      'getRoomStatus', 
      'sendSelfVote'
    ], {
      socketEvents$: jasmine.createSpyObj('Observable', ['subscribe']),
      connected: jasmine.createSpyObj('Signal', ['asReadonly'])
    });

    await TestBed.configureTestingModule({
      imports: [
        RodadaZeroComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        DragDropModule
      ],
      providers: [
        { provide: RodadaZeroApiService, useValue: apiSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RodadaZeroComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(RodadaZeroApiService) as jasmine.SpyObj<RodadaZeroApiService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct rodada number', () => {
    expect(component.rodadaNumero).toBe(0);
  });

  it('should have cards with planet information', () => {
    const cards = component.hand();
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].planeta).toBeDefined();
  });

  it('should have correct color mapping', () => {
    expect(component.colorHex['Azul']).toBe('#0067b1');
    expect(component.colorHex['Vermelho']).toBe('#ef4444');
  });

  it('should get status display correctly', () => {
    expect(component.getStatusDisplay('lobby')).toBe('🔄 Lobby');
    expect(component.getStatusDisplay('rodada_0')).toBe('🎯 Rodada 0 - Autoavaliação');
    expect(component.getStatusDisplay('finalizado')).toBe('🏁 Finalizado');
    expect(component.getStatusDisplay(undefined)).toBe('Carregando...');
  });
});
