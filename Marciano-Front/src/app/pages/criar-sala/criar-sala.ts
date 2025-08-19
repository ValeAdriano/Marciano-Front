import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import Swal from 'sweetalert2';

import { CriarSalaApiService, CreateRoomIn, RoomReport } from './criar-sala.service';
import { HomeService } from '../home/home.service';

@Component({
  selector: 'app-criar-sala',
  // standalone é padrão no Angular 20; não declarar standalone:true
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './criar-sala.html',
  styleUrl: './criar-sala.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CriarSalaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CriarSalaApiService);
  private readonly home = inject(HomeService);

  // Saudação — usa HomeService se existir; senão, "marciano"
  displayName = computed(() => this.home.getSession()?.name || 'marciano');

  // Formulário
  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
  });

  // Signals de UI
  code = signal<string>('');
  creating = signal<boolean>(false);
  createdRoom = signal<{ id: string; code: string; title: string; joinUrl?: string } | null>(null);

  // Relatórios
  reports = signal<RoomReport[]>([]);
  loadingReports = signal<boolean>(false);

  constructor() {
    // Carrega reports ao montar
    this.refreshReports();
  }

  generateCode(): void {
    this.code.set(this.api.generateRoomCode());
    this.toast('Código gerado!', 'success');
  }

  async copyCode(): Promise<void> {
    if (!this.code()) return;
    await this.copyText(this.code());
  }

  async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Copiado para a área de transferência', 'success');
    } catch {
      this.toast('Não foi possível copiar', 'error');
    }
  }

  resetForm(): void {
    this.form.reset();
    this.code.set('');
    this.createdRoom.set(null);
  }

  async onCreateRoom(): Promise<void> {
    if (this.form.invalid || !this.code()) {
      this.toast('Preencha o nome da sala e gere o código.', 'info');
      this.form.markAllAsTouched();
      return;
    }

    const payload: CreateRoomIn = {
      code: this.code(),
      title: this.form.controls.title.value.trim(),
      isAnonymous: true, // ajuste depois se precisar
    };

    this.creating.set(true);
    const res = await this.api.createRoom(payload);
    this.creating.set(false);

    if (!res.ok) {
      this.toast(`Erro ao criar sala: ${res.error}`, 'error');
      return;
    }

    this.createdRoom.set(res.data);
    this.toast('Sala criada com sucesso!', 'success');
    this.refreshReports();
  }

  async refreshReports(): Promise<void> {
    this.loadingReports.set(true);
    const res = await this.api.listMyRoomReports();
    this.loadingReports.set(false);
    if (!res.ok) {
      this.toast(`Não foi possível carregar relatórios: ${res.error}`, 'error');
      return;
    }
    this.reports.set(res.data);
  }

  trackById = (_: number, item: { id: string }) => item.id;

  private toast(title: string, icon: 'success'|'info'|'error'|'warning') {
    void Swal.fire({ toast: true, position: 'top', icon, title, timer: 1600, showConfirmButton: false });
  }
}
