import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { ViajeGuardado } from '../reserva/viajes.service';

export interface MensajeChat {
  id: string; secuencia: string; emisorId: string | null; emisorNombre: string;
  emisorRol: 'viajero' | 'asesor'; contenido: string; creadoEn: string;
}
export interface SalaChat {
  viajeId: string; destino: string; usuarioId: string; rolPropio: 'viajero' | 'asesor';
  nombrePropio: string; viajeroNombre: string; asesorNombre: string;
  mensajes: MensajeChat[]; contadorViajero: number; contadorAsesor: number;
}
export interface BandejaChat { esPersonal: boolean; casos: ViajeGuardado[]; }

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esRol(valor: unknown): valor is MensajeChat['emisorRol'] {
  return valor === 'viajero' || valor === 'asesor';
}

function esMensaje(valor: unknown): valor is MensajeChat {
  return esObjeto(valor) && typeof valor['id'] === 'string' && typeof valor['secuencia'] === 'string'
    && (valor['emisorId'] === null || typeof valor['emisorId'] === 'string')
    && typeof valor['emisorNombre'] === 'string' && esRol(valor['emisorRol'])
    && typeof valor['contenido'] === 'string' && typeof valor['creadoEn'] === 'string';
}

function esSala(valor: unknown): valor is SalaChat {
  return esObjeto(valor) && typeof valor['viajeId'] === 'string' && typeof valor['destino'] === 'string'
    && typeof valor['usuarioId'] === 'string' && esRol(valor['rolPropio'])
    && typeof valor['nombrePropio'] === 'string' && typeof valor['viajeroNombre'] === 'string'
    && typeof valor['asesorNombre'] === 'string' && typeof valor['contadorViajero'] === 'number'
    && typeof valor['contadorAsesor'] === 'number' && Array.isArray(valor['mensajes'])
    && valor['mensajes'].every(esMensaje);
}

function esBandeja(valor: unknown): valor is BandejaChat {
  return esObjeto(valor) && typeof valor['esPersonal'] === 'boolean' && Array.isArray(valor['casos'])
    && valor['casos'].every(caso => esObjeto(caso) && typeof caso['id'] === 'string'
      && typeof caso['destino'] === 'string' && typeof caso['fecha_solicitud'] === 'string'
      && typeof caso['estado'] === 'string' && (caso['nombre'] === undefined || typeof caso['nombre'] === 'string'));
}

export class ChatError extends Error {
  constructor(mensaje: string, readonly incierto = false) { super(mensaje); }
}
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly auth = inject(SupabaseService);
  private async llamar(nombre: string, datos: Record<string, unknown> = {}, envio = false): Promise<unknown> {
    const control = new AbortController();
    const tiempo = setTimeout(() => control.abort(), 20000);
    try {
      const { data, error } = await this.auth.client.rpc(nombre, datos).abortSignal(control.signal);
      if (error) {
        if (error.code === '42501' || error.code === '28000' || error.code === 'PGRST301') throw new ChatError('No tienes acceso a esta conversación. Revisa tu sesión o vuelve a Mis solicitudes.');
        if (error.code === 'PGRST202' || error.code === '42883') throw new ChatError('El chat todavía no está disponible. Inténtalo más tarde.');
        if (error.code === '22023') throw new ChatError('Escribe un mensaje de 1 a 1000 caracteres.');
        throw new ChatError(envio ? 'No pudimos confirmar el envío. Reintenta; el mensaje no se duplicará.' : 'No fue posible actualizar el chat. Revisa tu conexión y vuelve a intentar.', envio);
      }
      return data;
    } catch (error) {
      if (error instanceof ChatError) throw error;
      throw new ChatError(envio ? 'No pudimos confirmar el envío. Reintenta con el mismo mensaje.' : 'No fue posible conectar con el chat.', envio);
    } finally { clearTimeout(tiempo); }
  }
  async bandeja(): Promise<BandejaChat> {
    const data = await this.llamar('movil_chat_bandeja');
    if (!esBandeja(data)) throw new ChatError('El servidor devolvió una bandeja de chat inválida.');
    return data;
  }
  async sala(id: string): Promise<SalaChat> {
    const data = await this.llamar('movil_chat_sala', { p_viaje: id });
    if (!esSala(data)) throw new ChatError('El servidor devolvió una sala de chat inválida.');
    return data;
  }
  async enviar(viaje: string, id: string, texto: string): Promise<string> {
    if (!texto.trim() || texto.length > 1000) throw new ChatError('Escribe un mensaje de 1 a 1000 caracteres.');
    const data = await this.llamar('movil_chat_enviar', { p_viaje: viaje, p_id: id, p_texto: texto }, true);
    if (typeof data !== 'string' || data.toLowerCase() !== id.toLowerCase()) {
      throw new ChatError('No pudimos confirmar el envío. Reintenta con el mismo mensaje.', true);
    }
    return data;
  }
  async limpiar(id: string): Promise<void> {
    await this.llamar('movil_chat_limpiar', { p_viaje: id });
  }
  escuchar(id: string, usuario: string, cambio: () => void, estado: (conectado: boolean) => void): RealtimeChannel {
    let listo = false;
    return this.auth.client.channel(`viaje-${id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'movil_chat_mensajes', filter: `viaje_id=eq.${id}` }, cambio)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movil_chat_historial', filter: `usuario_id=eq.${usuario}` }, cambio)
      .on('system', {}, evento => {
        if (evento.status === 'ok') { listo = true; estado(true); cambio(); }
        else if (evento.status === 'error') { listo = false; estado(false); }
      })
      .subscribe(s => {
        if (s !== 'SUBSCRIBED') { listo = false; estado(false); }
        else { estado(listo); cambio(); }
      });
  }
  dejar(canal: RealtimeChannel): void { void this.auth.client.removeChannel(canal); }
}
