import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map, timeout } from 'rxjs';
import { CONTACTO_URL } from './contacto.config';

interface Contacto {
  nombre: string;
  descripcion: string;
  telefono: string;
  correo: string;
  direccion: string;
  horario: string;
}

function procesarRespuesta(data: unknown): Contacto[] {
  if (!Array.isArray(data)) throw new Error('Respuesta no válida');
  return data.map((registro: unknown) => {
    if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
      throw new Error('Registro no válido');
    }
    const campos = registro as Record<string, unknown>;
    const texto = (campo: string): string => {
      const valor = campos[campo];
      return typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : '';
    };
    const contacto = {
      nombre: texto('nombre'), descripcion: texto('descripcion'),
      telefono: texto('telefono'), correo: texto('correo') || texto('email'),
      direccion: texto('direccion'), horario: texto('horario'),
    };
    if (!Object.values(contacto).some(Boolean)) throw new Error('Sin campos de contacto');
    return contacto;
  });
}

@Component({
  selector: 'app-contacto',
  standalone: true,
  templateUrl: './contacto.component.html',
  styleUrls: ['./contacto.component.css'],
})
export class ContactoComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly contactos = signal<Contacto[]>([]);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly consultado = signal(false);

  consultar(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(false);
    this.consultado.set(false);
    this.contactos.set([]);

    this.http.get<unknown>(CONTACTO_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    }).pipe(
      timeout(12000),
      map(procesarRespuesta),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: contactos => {
        this.contactos.set(contactos);
        this.consultado.set(true);
      },
      error: () => this.error.set(true),
    });
  }
}
