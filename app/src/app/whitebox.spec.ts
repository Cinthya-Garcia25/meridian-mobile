import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { credencialesValidas } from './auth-validation';
import { coincideBusqueda, normalizarBusqueda } from './core/busqueda';
import { ChatError, ChatService } from './chat/chat.service';
import { SupabaseService } from './supabase.service';

describe('Práctica 11: validación y condiciones con cortocircuito', () => {
  it.each([
    ['a@b.co', '12345678', true],
    ['a'.repeat(249) + '@b.co', '12345678', true],
    ['a'.repeat(250) + '@b.co', '12345678', false],
    ['incorrecto', '12345678', false],
    ['', '12345678', false],
    ['a@b.co', '        ', false],
    ['a@b.co', '1234567', false],
    ['a@b.co', 'x'.repeat(128), true],
    ['a@b.co', 'x'.repeat(129), false],
    ['  a@b.co  ', '12345678', true],
  ])('correo=%s, longitud password=%s => %s', (correo, clave, esperado) => {
    expect(credencialesValidas(correo, clave)).toBe(esperado);
  });
});

describe('Práctica 11: procesamiento de búsquedas', () => {
  it.each([['  CANCÚN  ', 'cancun'], ['ÁÉÍÓÚ ü ñ', 'aeiou u n'], ['', ''], ['東京', '東京']])(
    'normaliza %s => %s', (entrada, esperado) => expect(normalizarBusqueda(entrada)).toBe(esperado),
  );
  it.each([['Cancún', '', true], ['Viaje a Cancún', 'cancun', true], ['Tokio', 'cancun', false]])(
    'busca %s con %s => %s', (texto, query, esperado) => expect(coincideBusqueda(texto, query)).toBe(esperado),
  );
});

describe('Práctica 11: comunicación RPC simulada; no mide HTTP', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });
  function crear(resolver: (signal: AbortSignal) => Promise<unknown>) {
    const abortSignal = vi.fn(resolver);
    const rpc = vi.fn(() => ({ abortSignal }));
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }] });
    return { servicio: TestBed.runInInjectionContext(() => new ChatService()), rpc, abortSignal };
  }
  it.each(['', '   ', 'x'.repeat(1001)])('rechaza entradas inválidas antes de la red', async texto => {
    const { servicio, rpc } = crear(async () => ({ data: 'id', error: null }));
    await expect(servicio.enviar('101', 'id', texto)).rejects.toBeInstanceOf(ChatError);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(['x', 'x'.repeat(1000)])('acepta límites válidos y conserva el identificador', async texto => {
    const { servicio, rpc } = crear(async () => ({ data: 'id', error: null }));
    expect(await servicio.enviar('101', 'id', texto)).toBe('id');
    expect(rpc).toHaveBeenCalledWith('movil_chat_enviar', { p_viaje: '101', p_id: 'id', p_texto: texto });
  });
  it.each([
    ['42501', 'No tienes acceso'], ['28000', 'No tienes acceso'], ['PGRST301', 'No tienes acceso'],
    ['PGRST202', 'todavía no está disponible'], ['42883', 'todavía no está disponible'],
    ['22023', '1 a 1000'], ['XX000', 'No fue posible actualizar'],
  ])('traduce el error %s sin filtrar detalles internos', async (code, mensaje) => {
    const { servicio } = crear(async () => ({ data: null, error: { code, message: 'SECRETO_INTERNO' } }));
    await expect(servicio.sala('101')).rejects.toThrow(mensaje);
  });
  it('marca envío incierto ante error del servidor', async () => {
    const { servicio } = crear(async () => ({ data: null, error: { code: 'XX000' } }));
    await expect(servicio.enviar('101', 'id', 'Hola')).rejects.toMatchObject({ incierto: true });
  });
  it.each([false, true])('controla desconexión; envío=%s', async envio => {
    const { servicio } = crear(async () => { throw new TypeError('Failed to fetch'); });
    await expect(envio ? servicio.enviar('101', 'id', 'Hola') : servicio.sala('101'))
      .rejects.toMatchObject({ incierto: envio });
  });
  it('aborta a los 20 segundos y libera su temporizador', async () => {
    vi.useFakeTimers();
    const { servicio, abortSignal } = crear(signal => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
    }));
    const resultado = expect(servicio.enviar('101', 'id', 'Hola')).rejects.toMatchObject({ incierto: true });
    await vi.advanceTimersByTimeAsync(20000);
    await resultado;
    expect(abortSignal.mock.calls[0][0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('libera el temporizador tras respuesta correcta', async () => {
    vi.useFakeTimers();
    const { servicio } = crear(async () => ({ data: { esPersonal: false, casos: [] }, error: null }));
    expect(await servicio.bandeja()).toEqual({ esPersonal: false, casos: [] });
    expect(vi.getTimerCount()).toBe(0);
  });
});
