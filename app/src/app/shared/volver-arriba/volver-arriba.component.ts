import { Component, HostListener, signal } from '@angular/core';

// Botón flotante para volver arriba en las pantallas largas (solo de la app, no está en la web).
@Component({
  selector: 'app-volver-arriba',
  standalone: true,
  template: `
    <button
      type="button"
      class="volver-arriba"
      [class.volver-arriba--visible]="visible()"
      (click)="subir()"
      aria-label="Volver arriba"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
  `,
  styles: `
    .volver-arriba {
      position: fixed;
      right: 18px;
      bottom: 22px;
      z-index: 900;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: none;
      background: #e8522a;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(232, 82, 42, 0.45);
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .volver-arriba svg {
      width: 20px;
      height: 20px;
    }

    .volver-arriba--visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  `
})
export class VolverArribaComponent {
  visible = signal(false);

  @HostListener('window:scroll')
  onScroll() {
    this.visible.set(window.scrollY > window.innerHeight * 0.6);
  }

  subir() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
