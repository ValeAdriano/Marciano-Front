import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RodadaZeroComponent } from './rodada-zero.component';

describe('RodadaZeroComponent', () => {
  let component: RodadaZeroComponent;
  let fixture: ComponentFixture<RodadaZeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RodadaZeroComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RodadaZeroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
