import { Component, inject } from '@angular/core';
import { NotificacionesService } from './notificaciones.service';

@Component({
  selector: 'app-notificaciones',
  template: `
    @if (avisos.disponible()) {
      <div class="avisos">
        <button type="button" [disabled]="avisos.procesando()"
          (click)="avisos.activas() ? avisos.desactivar() : avisos.activar()">
          {{ avisos.activas() ? 'Desactivar avisos de cotización' : 'Activar avisos de cotización' }}
        </button>
        @if (avisos.mensaje(); as mensaje) {
          <p role="status">{{ mensaje }}</p>
        }
      </div>
    }
  `,
  styles: `
    .avisos { margin: 0 0 1rem; }
    button {
      border: 1px solid #cedce7; border-radius: 10px; background: white;
      color: #163050; padding: 10px 14px; font: inherit; font-size: .85rem; cursor: pointer;
    }
    button:disabled { opacity: .6; }
    p { margin: .5rem 0 0; color: #526c80; font-size: .85rem; }
  `,
})
export class NotificacionesComponent {
  readonly avisos = inject(NotificacionesService);
}
