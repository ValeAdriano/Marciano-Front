import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home';
import { HomeService } from './home.service';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let mockHomeService: jasmine.SpyObj<HomeService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockHomeService = jasmine.createSpyObj('HomeService', ['joinRoom']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [HomeComponent, ReactiveFormsModule],
      providers: [
        { provide: HomeService, useValue: mockHomeService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form initially', () => {
    expect(component.form.valid).toBeFalsy();
  });

  it('should validate required fields', () => {
    const form = component.form;
    expect(form.controls.roomCode.valid).toBeFalsy();
    expect(form.controls.name.valid).toBeFalsy();
    expect(form.controls.envelope.valid).toBeFalsy();
  });

  it('should validate room code length', () => {
    const roomCodeControl = component.form.controls.roomCode;
    
    roomCodeControl.setValue('ABC');
    expect(roomCodeControl.errors?.['minlength']).toBeTruthy();
    
    roomCodeControl.setValue('ABCDEFGH');
    expect(roomCodeControl.errors?.['maxlength']).toBeTruthy();
    
    roomCodeControl.setValue('ABC123');
    expect(roomCodeControl.errors).toBeFalsy();
  });

  it('should validate name length', () => {
    const nameControl = component.form.controls.name;
    
    nameControl.setValue('A');
    expect(nameControl.errors?.['minlength']).toBeTruthy();
    
    nameControl.setValue('A'.repeat(51));
    expect(nameControl.errors?.['maxlength']).toBeTruthy();
    
    nameControl.setValue('John Doe');
    expect(nameControl.errors).toBeFalsy();
  });

  it('should have envelope options', () => {
    expect(component.envelopeOptions.length).toBeGreaterThan(0);
    expect(component.envelopeOptions[0]).toHaveProperty('value');
    expect(component.envelopeOptions[0]).toHaveProperty('label');
  });
}); 