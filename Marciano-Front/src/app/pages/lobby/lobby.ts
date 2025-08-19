import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-lobby',
  imports: [CommonModule, RouterLink],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss'
})
export class LobbyComponent {
  ngOnInit() {
  const session = localStorage.getItem('qa:userSession');
  console.log('Sessão salva:', session ? JSON.parse(session) : null);
}

}
