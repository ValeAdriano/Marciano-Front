import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const ErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ocorreu um erro inesperado';
      
      if (error.error instanceof ErrorEvent) {
        // Erro do cliente
        errorMessage = `Erro: ${error.error.message}`;
      } else {
        // Erro do servidor
        switch (error.status) {
          case 400:
            errorMessage = 'Dados inválidos enviados para o servidor';
            break;
          case 401:
            errorMessage = 'Não autorizado. Faça login novamente.';
            break;
          case 403:
            errorMessage = 'Acesso negado. Você não tem permissão para esta ação.';
            break;
          case 404:
            errorMessage = 'Recurso não encontrado';
            break;
          case 500:
            errorMessage = 'Erro interno do servidor';
            break;
          default:
            errorMessage = `Erro ${error.status}: ${error.message}`;
        }
      }
      
      console.error('HTTP Error:', error);
      return throwError(() => new Error(errorMessage));
    })
  );
};
