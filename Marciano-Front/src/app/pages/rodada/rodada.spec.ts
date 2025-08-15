import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rodada } from './rodada';

describe('Rodada', () => {
  let component: Rodada;
  let fixture: ComponentFixture<Rodada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rodada]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Rodada);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
