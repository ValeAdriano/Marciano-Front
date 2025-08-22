import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { LobbyComponent } from './lobby';
import { LobbyService } from './lobby.service';
import { HomeService } from '../home/home.service';

describe('LobbyComponent', () => {
  let component: LobbyComponent;
  let fixture: ComponentFixture<LobbyComponent>;
  let mockLobbyService: jasmine.SpyObj<LobbyService>;
  let mockHomeService: jasmine.SpyObj<HomeService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockLobbyService = jasmine.createSpyObj('LobbyService', [
      'getRoomParticipants', 'initRoom', 'startRound', 'leaveRoom'
    ]);
    mockHomeService = jasmine.createSpyObj('HomeService', ['getSession']);
    mockRouter = jasmine.createSpyObj('Router', ['navigateByUrl']);

    // Mock dos signals
    mockLobbyService.participants = jasmine.createSpy().and.returnValue([]);
    mockLobbyService.count = jasmine.createSpy().and.returnValue(0);
    mockLobbyService.isConnected = jasmine.createSpy().and.returnValue(true);
    mockLobbyService.roomStatus = jasmine.createSpy().and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        { provide: LobbyService, useValue: mockLobbyService },
        { provide: HomeService, useValue: mockHomeService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have computed properties', () => {
    expect(component.participants).toBeDefined();
    expect(component.count).toBeDefined();
    expect(component.isConnected).toBeDefined();
    expect(component.roomStatus).toBeDefined();
  });

  it('should have session and roomCode signals', () => {
    expect(component.session).toBeDefined();
    expect(component.roomCode).toBeDefined();
  });

  it('should calculate progress percentage correctly', () => {
    const percentage = component.getProgressPercentage();
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  it('should display status correctly', () => {
    const status = component.getStatusDisplay('lobby');
    expect(status).toContain('Lobby');
  });

  it('should check if can start round', () => {
    const canStart = component.canStartRound();
    expect(typeof canStart).toBe('boolean');
  });

  it('should check if should show redirect message', () => {
    const shouldShow = component.shouldShowRedirectMessage();
    expect(typeof shouldShow).toBe('boolean');
  });

  it('should have status classes method', () => {
    const mockParticipant = {
      id: '1',
      name: 'Test',
      envelope_choice: '#000000',
      status: 'connected' as const
    };
    
    const classes = component.statusClasses(mockParticipant);
    expect(classes).toContain('inline-flex');
  });
}); 