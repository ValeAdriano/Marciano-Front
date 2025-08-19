import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CriarSalaComponent } from './criar-sala';

describe('CriarSalaComponent', () => {
  let component: CriarSalaComponent;
  let fixture: ComponentFixture<CriarSalaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriarSalaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CriarSalaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
