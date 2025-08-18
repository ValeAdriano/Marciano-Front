// rodada.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

type CartaEscolhida = { id: string; cor: string; texto: string };

@Component({
  selector: 'app-rodada',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rodada.html',
  styleUrl: './rodada.scss'
})
export class RodadaComponent {
  // Estado de seleção
  selectedAlvoId: string | null = null;
  selectedAlvoNome: string | null = null;
  selectedCarta: CartaEscolhida | null = null;

  selecionarAlvo(nome: string, id: string) {
    this.selectedAlvoNome = nome;
    this.selectedAlvoId = id;
  }

  selecionarCarta(cor: string, texto: string, id: string) {
    this.selectedCarta = { id, cor, texto };
  }

  limparSelecao() {
    this.selectedAlvoId = null;
    this.selectedAlvoNome = null;
    this.selectedCarta = null;
    // limpa radios visualmente
    document
      .querySelectorAll<HTMLInputElement>('input[name="alvo"], input[name="carta"]')
      .forEach(i => (i.checked = false));
  }

  async onConfirmar() {
    if (!this.selectedAlvoId || !this.selectedCarta || !this.selectedAlvoNome) {
      await Swal.fire({
        icon: 'warning',
        title: 'Seleção incompleta',
        text: 'Escolha um alvo e uma carta para confirmar.',
        confirmButtonText: 'OK'
      });
      return;
    }

    const resumoHtml =
      `<div style="text-align:left">
        <p><b>Alvo:</b> ${this.escapeHtml(this.selectedAlvoNome)}</p>
        <p><b>Carta:</b> ${this.escapeHtml(this.selectedCarta.texto)}</p>
        <p><b>Cor:</b>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:6px;${this.dotColor(this.selectedCarta.cor)}"></span>
          ${this.escapeHtml(this.selectedCarta.cor)}
        </p>
       </div>`;

    const confirm = await Swal.fire({
      title: 'Confirmar voto?',
      html: resumoHtml,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar voto',
      cancelButtonText: 'Voltar'
    });

    if (!confirm.isConfirmed) return;

    // TODO: enviar voto para API/estado global
    // await this.votosService.enviar({ alvoId: this.selectedAlvoId, carta: this.selectedCarta })

    // Modal bloqueante até próxima rodada
    await Swal.fire({
      title: 'Voto registrado',
      html: 'Aguarde os demais participantes votarem.<br>Esta janela fechará automaticamente quando a próxima rodada começar.',
      icon: 'success',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
        // Exemplo: feche quando receber o evento da próxima rodada:
        // this.socket.on('proxima-rodada', () => Swal.close());
      }
    });
  }

  // Utils
  private escapeHtml(s: string) {
    const div = document.createElement('div');
    div.innerText = s;
    return div.innerHTML;
  }
  private dotColor(cor: string) {
    const map: Record<string, string> = {
      Azul: 'background:#2563eb',
      Amarelo: 'background:#eab308',
      Verde: 'background:#22c55e',
      Laranja: 'background:#f97316',
      Vermelho: 'background:#ef4444',
      Roxo: 'background:#7c3aed',
    };
    return map[cor] ?? 'background:#999';
  }
}
