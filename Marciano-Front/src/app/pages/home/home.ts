import { Component, ChangeDetectionStrategy, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { HomeService } from './home.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class HomeComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private home = inject(HomeService);

  private _submitting = signal(false);
  submitting = computed(() => this._submitting());

  // Paleta (hex) para o select
  envelopeOptions = [
    { value: '#ecc500', label: 'Amarelo' }, // brand.yellow
    { value: '#0067b1', label: 'Azul' },    // brand.blue
    { value: '#75b463', label: 'Verde' },   // brand.green
    { value: '#00a5d3', label: 'Ciano' },   // brand.cyan
    { value: '#009eb8', label: 'Teal' },    // brand.teal
    { value: '#ecb500', label: 'Amarelo Escuro' }, // brand.yellowDark
  ];

  form = this.fb.nonNullable.group({
    roomCode: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(10), Validators.pattern(/^[A-Za-z0-9]+$/)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    envelope: ['', [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await Swal.fire({
        icon: 'error',
        title: 'Campos inválidos',
        text: 'Verifique os campos destacados e tente novamente.',
        confirmButtonText: 'Ok',
        confirmButtonColor: '#0067b1'
      });
      return;
    }

    // Capitaliza o código da sala sem alterar o controle visual (classe 'uppercase' cuida da UI)
    const rawRoom = this.form.controls.roomCode.value;
    const roomCode = rawRoom.toUpperCase();
    const { name, envelope } = this.form.getRawValue();

    const result = await Swal.fire({
      title: 'Confirmar entrada na sala?',
      html: `
        <div style="text-align:left">
          <p><strong>Código da Sala:</strong> ${roomCode}</p>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Envelope:</strong>
            <span style="display:inline-block;width:16px;height:16px;background:${envelope};border-radius:3px;margin-right:4px;"></span>
            ${this.labelForEnvelope(envelope)}
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Editar',
      confirmButtonColor: envelope,  // botão na cor escolhida
      cancelButtonColor: '#a8a8a8',
      customClass: { popup: 'custom-swal-popup' },
      didOpen: () => {
        const popup = document.querySelector('.custom-swal-popup') as HTMLElement | null;
        if (popup) {
          popup.style.border = `3px solid ${envelope}`;     // contorno na cor do envelope
          popup.style.borderRadius = '1rem';
        }
      }
    });

    if (!result.isConfirmed) return;

    try {
      this._submitting.set(true);

      // Chamada de API + persistência automática no localStorage pelo service
      this.home.joinRoom(roomCode, { name, envelopeHex: envelope }).subscribe({
        next: (session) => {
          // ✅ igual ao front antigo: manda room_id e participant_id
          this.router.navigate(['/lobby'], {
            queryParams: {
              room_id: session.roomCode,          // o código da sala (numérico em string)
              participant_id: session.participantId, // veio do backend no join
            },
          });
        },
        error: async (err) => {
          await Swal.fire({
            icon: 'error',
            title: 'Falha ao entrar',
            text: err?.message || 'Não foi possível entrar na sala.',
            confirmButtonColor: envelope
          });
        },
        complete: () => this._submitting.set(false),
      });
    } catch {
      this._submitting.set(false);
    }
  }

  private labelForEnvelope(value: string): string {
    return this.envelopeOptions.find(o => o.value === value)?.label ?? value;
    }
}
