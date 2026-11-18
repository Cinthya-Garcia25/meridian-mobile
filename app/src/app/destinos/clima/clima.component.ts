import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import type { Destino } from '../catalogo.service';
import { ClimaService } from './clima.service';

@Component({
  selector: 'app-clima-destino',
  imports: [DatePipe, DecimalPipe],
  template: `
    <section class="clima" aria-label="Clima del destino">
      <h3>Clima del destino</h3>
      @if (estado(); as estado) {
        @if (estado.tipo === 'cargando') {
          <p role="status">Consultando el pronóstico…</p>
        } @else if (estado.tipo === 'error') {
          <p role="status">{{ estado.mensaje }}</p>
        } @else {
          <p>{{ estado.datos.ubicacion }} · Ahora <strong>{{ estado.datos.temperatura | number:'1.0-0' }} °C</strong></p>
          <ul aria-label="Pronóstico de los próximos días">
            @for (dia of estado.datos.dias; track dia.fecha) {
              <li>
                <time [attr.datetime]="dia.fecha">{{ dia.fecha + 'T12:00:00Z' | date:'EEE d MMM':'UTC':'es-MX' }}</time>
                <span>Mín. {{ dia.minima | number:'1.0-0' }} °C · Máx. {{ dia.maxima | number:'1.0-0' }} °C</span>
              </li>
            }
          </ul>
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Datos de Open-Meteo</a>
        }
      }
    </section>
  `,
  styles: `
    .clima { margin: 1rem 0; padding: 1rem; border-radius: 12px; background: #f2f7fc; color: #16304b; }
    h3 { margin: 0 0 .5rem; font-size: 1rem; }
    p { margin: .5rem 0; }
    ul { list-style: none; padding: 0; margin: .5rem 0; }
    li { display: flex; justify-content: space-between; flex-wrap: wrap; gap: .25rem 1rem; padding: .3rem 0; }
    a { font-size: .8rem; color: #245477; }
  `,
})
export class ClimaComponent {
  private readonly clima = inject(ClimaService);
  readonly destino = input.required<Pick<Destino, 'nombre' | 'pais'>>();
  readonly estado = toSignal(toObservable(this.destino).pipe(
    switchMap(({ nombre, pais }) => navigator.onLine
      ? this.clima.consultar(nombre, pais).pipe(
        map(datos => ({ tipo: 'listo' as const, datos })),
        catchError(() => of({ tipo: 'error' as const, mensaje: 'El pronóstico no está disponible para este destino.' })),
        startWith({ tipo: 'cargando' as const }),
      )
      : of({ tipo: 'error' as const, mensaje: 'Conéctate a internet para consultar el pronóstico.' })),
  ), { initialValue: { tipo: 'cargando' as const } });
}
