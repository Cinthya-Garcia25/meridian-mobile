import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { conReintentos } from '../core/reintento';

export interface AcompananteViaje { nombre: string; edad: number; }
export interface SolicitudViaje {
  destino: string; origen: string; salida: string; regreso: string;
  nombre: string; correo: string; telefono: string; comentarios: string;
  acompanantes: AcompananteViaje[];
}
export interface ViajeGuardado {
  id: string; destino: string; fecha_solicitud: string; estado: string;
  mensaje?: string; precio_estimado?: number; origen?: string;
  salida?: string; regreso?: string; nombre?: string; correo?: string;
  telefono?: string; comentarios?: string; adultos?: number; ninos?: number;
  acompanantes?: AcompananteViaje[];
}
export interface EstadoReserva {
  id: string;
  confirmada_en: string | null;
  puede_confirmar: boolean;
  salida?: string | null;
  regreso?: string | null;
}

export class ErrorViaje extends Error {
  /** transitorio: fallo de red, timeout o 5xx; es seguro reintentar (las escrituras llevan el mismo UUID). */
  constructor(mensaje: string, readonly resultadoIncierto = false, readonly transitorio = false) { super(mensaje); }
}
/** Tamaño de página de Mis solicitudes (el servidor limita a 100). */
export const TAMANO_PAGINA_VIAJES = 50;
const TIEMPO_INTENTO_MS = 15000;
const REINTENTOS = { maxIntentos: 3, baseMs: 1000, topeMs: 8000 };
const esTransitorio = (e: unknown) => e instanceof ErrorViaje && e.transitorio;
@Injectable({ providedIn: 'root' })
export class ViajesService {
  private readonly auth = inject(SupabaseService);
  async estadosReserva(ids: string[]): Promise<EstadoReserva[]> {
    if (!ids.length) return [];
    const { data, error } = await this.auth.client.rpc('movil_estado_reservas', { p_ids: ids })
      .abortSignal(AbortSignal.timeout(8000));
    if (error?.code === 'PGRST202') return [];
    if (error || !Array.isArray(data)) throw new Error('No se pudo consultar la confirmación de las reservas.');
    return data as EstadoReserva[];
  }

  async confirmarReserva(id: string): Promise<string> {
    const { data, error } = await this.auth.client.rpc('movil_confirmar_reserva', { p_id: id })
      .abortSignal(AbortSignal.timeout(8000));
    if (error?.code === '42501') throw new Error('No tienes permiso para confirmar esta reserva.');
    if (error?.code === 'P0001') throw new Error('Primero guarda una respuesta para la cotización.');
    if (error || typeof data !== 'string') throw new Error('No se pudo verificar la confirmación. Actualiza la lista o reintenta.');
    return data;
  }

  private async sesion(): Promise<void> {
    const { data, error } = await this.auth.getSession();
    if (error || !data.session) throw new ErrorViaje('Inicia sesión para guardar y consultar tus viajes.');
    if (!navigator.onLine) throw new ErrorViaje('No hay conexión. Conéctate a internet y vuelve a intentar.');
  }
  private mensaje(error: { code?: string; message?: string }, envio: boolean, estado?: number): ErrorViaje {
    if (estado === 401) return new ErrorViaje('Tu sesión venció. Inicia sesión nuevamente.');
    if (estado === 403) return new ErrorViaje('Tu cuenta no tiene permiso para realizar esta operación.');
    if (error.code === 'PGRST202' || error.code === '42883') return new ErrorViaje('El servicio de viajes todavía no está disponible. Inténtalo más tarde.');
    if (error.code === '28000' || error.code === 'PGRST301' || error.code === 'PGRST302') return new ErrorViaje('Tu sesión venció. Inicia sesión nuevamente.');
    if (error.code === '42501') return new ErrorViaje('Tu cuenta no tiene permiso para realizar esta operación.');
    if (error.code === 'P0001') return new ErrorViaje(error.message || 'Revisa los datos de la solicitud.');
    if (error.code?.startsWith('22')) return new ErrorViaje('Revisa las fechas y los datos de los viajeros.');
    const transitorio = !estado || estado >= 500 || estado === 408 || estado === 429;   // 0/sin estado = fallo de red
    return new ErrorViaje(envio ? 'No pudimos confirmar el envío. Reintenta con los mismos datos; no se duplicará tu solicitud.' : 'No fue posible cargar tus viajes. Revisa tu conexión e inténtalo de nuevo.', envio, transitorio);
  }
  /** Envía la solicitud. Cada intento reutiliza el mismo UUID: el servidor es idempotente, así que reintentar no duplica. */
  async guardar(datos: SolicitudViaje, solicitudId: string, alReintentar?: (intento: number, esperaMs: number) => void): Promise<string> {
    await this.sesion();
    return conReintentos(() => this.intentarGuardar(datos, solicitudId), { ...REINTENTOS, esTransitorio, alReintentar: (i, ms) => alReintentar?.(i, ms) });
  }
  private async intentarGuardar(datos: SolicitudViaje, solicitudId: string): Promise<string> {
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), TIEMPO_INTENTO_MS);
    try {
      const { data, error, status } = await this.auth.client.rpc('movil_crear_cotizacion', { p_datos: datos, p_solicitud: solicitudId }).abortSignal(control.signal);
      if (error) throw this.mensaje(error, true, status);
      if (typeof data !== 'string' || !/^\d+$/.test(data)) throw new ErrorViaje('No pudimos confirmar el envío. Vuelve a intentar.', true);
      return data;
    } catch (error) {
      if (error instanceof ErrorViaje) throw error;
      throw new ErrorViaje('No pudimos confirmar el envío. Reintenta con los mismos datos; no se duplicará tu solicitud.', true, true);
    } finally { clearTimeout(tiempo); }
  }
  /** Una página de solicitudes (más recientes primero). Para la siguiente, pasar el id de la última recibida. */
  async obtenerMios(antesId?: string): Promise<ViajeGuardado[]> {
    await this.sesion();
    return conReintentos(() => this.intentarObtener(antesId), { ...REINTENTOS, esTransitorio });
  }
  private async intentarObtener(antesId?: string): Promise<ViajeGuardado[]> {
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), TIEMPO_INTENTO_MS);
    try {
      const paginada = await this.auth.client.rpc('movil_mis_cotizaciones', { p_limite: TAMANO_PAGINA_VIAJES, p_antes_id: antesId ?? null }).abortSignal(control.signal);
      // Los despliegues anteriores todavía exponen la consulta sin parámetros.
      const usarAnterior = paginada.error?.code === 'PGRST202';
      const { data, error, status } = usarAnterior
        ? await this.auth.client.rpc('movil_mis_cotizaciones').abortSignal(control.signal)
        : paginada;
      if (error) throw this.mensaje(error, false, status);
      if (!Array.isArray(data)) throw new ErrorViaje('La información de tus viajes no está disponible.');
      const viajes = data as ViajeGuardado[];
      if (!usarAnterior) return viajes;
      const anteriores = antesId ? viajes.filter(viaje => BigInt(viaje.id) < BigInt(antesId)) : viajes;
      return anteriores.sort((a, b) => a.id === b.id ? 0 : BigInt(a.id) > BigInt(b.id) ? -1 : 1)
        .slice(0, TAMANO_PAGINA_VIAJES);
    } catch (error) {
      if (error instanceof ErrorViaje) throw error;
      throw new ErrorViaje('No fue posible cargar tus viajes. Revisa tu conexión e inténtalo de nuevo.', false, true);
    } finally { clearTimeout(tiempo); }
  }
}
