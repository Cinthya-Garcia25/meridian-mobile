import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { DESTINOS_LOCALES } from './destinos-locales';

// Mismo modelo que la web (meridian-travel/frontend/src/app/core/services/catalogo.service.ts).
export interface Destino {
  id: number;
  nombre: string;
  pais: string | null;
  descripcion: string | null;
  descripcionLarga: string | null;
  categoria: 'playa' | 'montaña' | 'ciudad' | 'aventura';
  temperatura: string | null;
  mejorEpoca: string | null;
  actividades: string[];
  precioDesde: number;
  rating: number;
  reviews: number;
  destacado: boolean;
  imagen: string | null;
  activo: boolean;
}

// La misma API que usa la web en producción.
const API_URL = 'https://meridian-travel.onrender.com/api';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private http = inject(HttpClient);

  // Pide el catálogo a la API de la web. Si no responde (el servidor gratuito de
  // Render se apaga cuando no se usa) o falla, usa la copia local del catálogo.
  destinos(): Observable<Destino[]> {
    return this.http.get<Destino[]>(`${API_URL}/destinos`).pipe(
      timeout(8000),
      catchError(() => of(DESTINOS_LOCALES)),
      map((lista) =>
        lista
          .filter((d) => d.activo)
          // Las rutas de imagen de la web empiezan con "/"; en la app van relativas.
          .map((d) => ({ ...d, imagen: d.imagen ? d.imagen.replace(/^\//, '') : null }))
      )
    );
  }
}
