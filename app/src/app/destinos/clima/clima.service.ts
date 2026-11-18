import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, timeout } from 'rxjs';
import { normalizarBusqueda } from '../../core/busqueda';

interface Ubicacion {
  nombre: string;
  latitude: number;
  longitude: number;
}

interface RespuestaClima {
  current?: { temperature_2m: number | null };
  daily?: {
    time: string[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
  };
}

export interface Pronostico {
  ubicacion: string;
  temperatura: number;
  dias: { fecha: string; minima: number; maxima: number }[];
}

// Para regiones amplias, el nombre visible indica el punto de referencia del pronóstico.
const REFERENCIAS: Record<string, { pais: string; ubicacion: Ubicacion }> = {
  'maldivas': { pais: 'republica de maldivas', ubicacion: { nombre: 'Malé', latitude: 4.18, longitude: 73.51 } },
  'bali': { pais: 'indonesia', ubicacion: { nombre: 'Denpasar', latitude: -8.65, longitude: 115.22 } },
  'santorini': { pais: 'grecia', ubicacion: { nombre: 'Fira', latitude: 36.42, longitude: 25.43 } },
  'costa amalfitana': { pais: 'italia', ubicacion: { nombre: 'Amalfi', latitude: 40.63, longitude: 14.60 } },
  'patagonia': { pais: 'argentina', ubicacion: { nombre: 'El Calafate', latitude: -50.34, longitude: -72.27 } },
  'alpes suizos': { pais: 'suiza', ubicacion: { nombre: 'Zermatt', latitude: 46.02, longitude: 7.75 } },
  'machu picchu': { pais: 'peru', ubicacion: { nombre: 'Machu Picchu', latitude: -13.16, longitude: -72.55 } },
  'safari en kenia': { pais: 'kenia', ubicacion: { nombre: 'Masái Mara', latitude: -1.42, longitude: 35.00 } },
  'seychelles': { pais: 'seychelles', ubicacion: { nombre: 'Victoria', latitude: -4.62, longitude: 55.45 } },
  'islandia': { pais: 'islandia', ubicacion: { nombre: 'Reikiavik', latitude: 64.15, longitude: -21.94 } },
  'nepal': { pais: 'nepal', ubicacion: { nombre: 'Katmandú', latitude: 27.72, longitude: 85.32 } },
  'dubai': { pais: 'emiratos arabes', ubicacion: { nombre: 'Dubái', latitude: 25.20, longitude: 55.27 } },
  'nueva york': { pais: 'ee.uu.', ubicacion: { nombre: 'Nueva York', latitude: 40.71, longitude: -74.01 } },
  'galapagos': { pais: 'ecuador', ubicacion: { nombre: 'Puerto Ayora', latitude: -0.74, longitude: -90.31 } },
  'nueva zelanda': { pais: 'nueva zelanda', ubicacion: { nombre: 'Auckland', latitude: -36.85, longitude: 174.76 } },
};

@Injectable({ providedIn: 'root' })
export class ClimaService {
  private readonly http = inject(HttpClient);

  consultar(nombre: string, pais: string | null): Observable<Pronostico> {
    return this.ubicacion(nombre, pais).pipe(
      switchMap(ubicacion => this.http.get<RespuestaClima>('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: ubicacion.latitude,
          longitude: ubicacion.longitude,
          current: 'temperature_2m',
          daily: 'temperature_2m_min,temperature_2m_max',
          temperature_unit: 'celsius',
          timezone: 'auto',
          forecast_days: 7,
        },
      }).pipe(map(respuesta => {
        const temperatura = respuesta.current?.temperature_2m;
        const diario = respuesta.daily;
        if (typeof temperatura !== 'number' || !diario) throw new Error('Pronóstico incompleto.');
        const dias = diario.time.flatMap((fecha, indice) => {
          const minima = diario.temperature_2m_min[indice];
          const maxima = diario.temperature_2m_max[indice];
          return typeof minima === 'number' && typeof maxima === 'number' ? [{ fecha, minima, maxima }] : [];
        });
        if (!dias.length) throw new Error('Pronóstico incompleto.');
        return { ubicacion: ubicacion.nombre, temperatura, dias };
      }))),
      timeout(10000),
    );
  }

  private ubicacion(nombre: string, pais: string | null): Observable<Ubicacion> {
    const referencia = REFERENCIAS[normalizarBusqueda(nombre)];
    if (referencia?.pais === normalizarBusqueda(pais ?? '')) return of(referencia.ubicacion);

    return this.http.get<{ results?: { name: string; country?: string; latitude: number; longitude: number }[] }>(
      'https://geocoding-api.open-meteo.com/v1/search',
      { params: { name: [nombre, pais].filter(Boolean).join(', '), language: 'es', count: 10 } },
    ).pipe(map(({ results }) => {
      const lugar = results?.find(resultado =>
        normalizarBusqueda(resultado.name) === normalizarBusqueda(nombre) &&
        (!pais || normalizarBusqueda(resultado.country ?? '') === normalizarBusqueda(pais))
      );
      if (!lugar || !Number.isFinite(lugar.latitude) || !Number.isFinite(lugar.longitude)) {
        throw new Error('Ubicación no disponible.');
      }
      return { nombre: lugar.name, latitude: lugar.latitude, longitude: lugar.longitude };
    }));
  }
}
