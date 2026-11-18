import type { SolicitudViaje } from './viajes.service';

type DatosIniciales = Pick<SolicitudViaje, 'destino' | 'origen' | 'nombre' | 'salida' | 'regreso'>;

export function datosInicialesValidos(datos: DatosIniciales, hoy: string): boolean {
  return Boolean(
    datos.destino.trim() && datos.origen.trim() && datos.nombre.trim() &&
    datos.salida >= hoy && (!datos.regreso || datos.regreso >= datos.salida)
  );
}
