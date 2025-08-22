// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LobbyComponent } from './pages/lobby/lobby';
import { RodadaComponent } from './pages/rodada/rodada'
import { ResultadosComponent } from './pages/resultados/resultados'
import { RodadaZeroComponent } from './pages/rodada-zero/rodada-zero';
import { CriarSalaComponent } from './pages/criar-sala/criar-sala';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'lobby', component: LobbyComponent },
  { path: 'rodada-zero', component: RodadaZeroComponent },
  { path: 'rodada', component: RodadaComponent },
  { path: 'resultados/:roomCode/:participantId', component: ResultadosComponent },
  { path: 'criar-sala', component: CriarSalaComponent }
];
