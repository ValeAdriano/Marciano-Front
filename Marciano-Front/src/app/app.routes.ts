// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LobbyComponent } from './pages/lobby/lobby';
import { RodadaComponent } from './pages/rodada/rodada'
import { ResultadosComponent } from './pages/resultados/resultados'
import { RodadaZeroComponent } from './pages/rodada-zero/rodada-zero';
import { CriarSalaComponent } from './pages/criar-sala/criar-sala';
import { authGuard } from './@shared/services/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'criar-sala', component: CriarSalaComponent },
  { 
    path: 'lobby', 
    component: LobbyComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'rodada-zero', 
    component: RodadaZeroComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'rodada', 
    component: RodadaComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'resultados/:roomCode/:participantId', 
    component: ResultadosComponent, 
    canActivate: [authGuard] 
  }
];
