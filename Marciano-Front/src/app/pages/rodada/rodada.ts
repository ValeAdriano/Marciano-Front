import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rodada',
  imports: [CommonModule, RouterLink],
  templateUrl: './rodada.html',
  styleUrl: './rodada.scss'
})
export class RodadaComponent {

  confirmar() {
  const alvo = (document.querySelector('input[name="alvo"]:checked') as HTMLInputElement)?.value;
  const carta = (document.querySelector('input[name="carta"]:checked') as HTMLInputElement)?.value;
  if (!alvo || !carta) return;
  // TODO: enviar para API / state
}


}
