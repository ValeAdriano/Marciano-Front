import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

export interface LoginCredentials {
  usuario: string;
  senha: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'marciano_auth';
  private readonly DEFAULT_CREDENTIALS: LoginCredentials = {
    usuario: 'admin',
    senha: '123456'
  };

  constructor() {
    // Verificar se é a primeira execução e criar credenciais padrão
    if (!this.hasStoredCredentials()) {
      this.storeCredentials(this.DEFAULT_CREDENTIALS);
    }
  }

  /**
   * Verifica se o usuário está autenticado
   */
  isAuthenticated(): boolean {
    const credentials = this.getStoredCredentials();
    return credentials !== null;
  }

  /**
   * Exibe o modal de login
   */
  async showLoginModal(): Promise<boolean> {
    const result = await Swal.fire({
      title: '🔐 Login do Sistema',
      html: `
        <div class="text-left">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Usuário:</label>
            <input id="swal-input1" class="swal2-input" placeholder="Digite seu usuário" value="${this.getStoredCredentials()?.usuario || ''}">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Senha:</label>
            <input id="swal-input2" class="swal2-input" type="password" placeholder="Digite sua senha" value="${this.getStoredCredentials()?.senha || ''}">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Entrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      focusConfirm: false,
      preConfirm: () => {
        const usuario = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
        const senha = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
        
        if (!usuario || !senha) {
          Swal.showValidationMessage('Por favor, preencha todos os campos');
          return false;
        }
        
        return { usuario, senha };
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (result.isConfirmed && result.value) {
      const credentials = result.value as LoginCredentials;
      
      if (this.validateCredentials(credentials)) {
        this.storeCredentials(credentials);
        await Swal.fire({
          icon: 'success',
          title: '✅ Login realizado com sucesso!',
          text: `Bem-vindo, ${credentials.usuario}!`,
          timer: 1500,
          showConfirmButton: false
        });
        return true;
      } else {
        await Swal.fire({
          icon: 'error',
          title: '❌ Credenciais inválidas',
          text: 'Usuário ou senha incorretos. Tente novamente.',
          confirmButtonColor: '#dc2626'
        });
        return false;
      }
    }
    
    return false;
  }

  /**
   * Valida as credenciais fornecidas
   */
  private validateCredentials(credentials: LoginCredentials): boolean {
    // Credenciais padrão para demonstração
    const validCredentials = [
      { usuario: 'admin', senha: '123456' },
      { usuario: 'marciano', senha: '2024' },
      { usuario: 'teste', senha: 'teste123' }
    ];

    return validCredentials.some(valid => 
      valid.usuario === credentials.usuario && 
      valid.senha === credentials.senha
    );
  }

  /**
   * Armazena as credenciais no localStorage
   */
  private storeCredentials(credentials: LoginCredentials): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(credentials));
  }

  /**
   * Recupera as credenciais do localStorage
   */
  private getStoredCredentials(): LoginCredentials | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Verifica se existem credenciais armazenadas
   */
  private hasStoredCredentials(): boolean {
    return this.getStoredCredentials() !== null;
  }

  /**
   * Remove as credenciais do localStorage (logout)
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Retorna o usuário logado
   */
  getCurrentUser(): string | null {
    const credentials = this.getStoredCredentials();
    return credentials?.usuario || null;
  }
}
