import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './@shared/layout/header/header.component';
import { VoteStateService } from './@shared/services/vote-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent],
  template: `
    <div class="app-container">
      <app-header></app-header>
      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      width: 100%;
      display: flex;
      flex-direction: column;
    }
    
    main {
      flex: 1;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'Marciano Front';
  private readonly voteStateService = inject(VoteStateService);

  ngOnInit(): void {
    // Limpar estados de votação antigos ao inicializar o app
    this.voteStateService.cleanupOldVoteStates(24); // Limpar estados com mais de 24 horas
  }
} 