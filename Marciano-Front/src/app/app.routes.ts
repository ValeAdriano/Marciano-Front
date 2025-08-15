// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LobbyComponent } from './pages/lobby/lobby';
import { RodadaComponent } from './pages/rodada/rodada'
import { ResultadosComponent } from './pages/resultados/resultados'

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'lobby', component: LobbyComponent },
  { path: 'rodada', component: RodadaComponent },
  { path: 'resultados', component: ResultadosComponent }
];
