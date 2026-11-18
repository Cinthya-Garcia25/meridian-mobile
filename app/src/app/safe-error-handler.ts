import { ErrorHandler, Injectable } from '@angular/core';
@Injectable()
export class SafeErrorHandler implements ErrorHandler {
  handleError(_error: unknown): void {
    // Nunca registrar el objeto original, cabeceras, formularios o tokens.
    console.error('Ocurrió un error inesperado en la aplicación.');
  }
}
