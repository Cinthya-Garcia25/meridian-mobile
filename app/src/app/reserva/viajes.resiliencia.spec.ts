// Practica 12 - Fase 5: matriz de resiliencia RES-01 a RES-08 sobre ViajesService real, con RPC simulado.
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { SupabaseService } from '../supabase.service';
import { ErrorViaje, SolicitudViaje, TAMANO_PAGINA_VIAJES, ViajesService } from './viajes.service';

const datos: SolicitudViaje = { destino: 'Cancún', origen: 'Querétaro', salida: '2027-01-10', regreso: '2027-01-17', nombre: 'Cyn', correo: 'a@b.co', telefono: '4421234567', comentarios: '', acompanantes: [] };
type Resp = { data: unknown; error: { code?: string; message?: string } | null; status: number };
const ok = (data: unknown): Resp => ({ data, error: null, status: 200 });
const falla = (status: number, code = '', message = 'error'): Resp => ({ data: null, error: { code, message }, status });
const sinRed = (): Resp => falla(0, '', 'TypeError: Failed to fetch');

/** Servidor simulado idempotente: guarda cada p_solicitud una sola vez, aunque la respuesta se pierda. */
function montar(comportamiento: (n: number, args: any, servidor: Map<string, string>) => Promise<Resp>, enLinea = true) {
  const servidor = new Map<string, string>(); const llamadas: any[] = []; let n = 0;
  const rpc = vi.fn((nombre: string, args: any) => {
    llamadas.push({ nombre, args }); const intento = ++n;
    return { abortSignal: (senal: AbortSignal) => new Promise<Resp>((resolver, rechazar) => {
      senal.addEventListener('abort', () => rechazar(new DOMException('Aborted', 'AbortError')));
      comportamiento(intento, args, servidor).then(resolver, rechazar);
    }) };
  });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { rpc }, getSession: async () => ({ data: { session: {} }, error: null }) } }] });
  Object.defineProperty(navigator, 'onLine', { value: enLinea, configurable: true });
  return { servicio: TestBed.runInInjectionContext(() => new ViajesService()), rpc, llamadas, servidor };
}
const guardarYAvanzar = async <T>(p: Promise<T>, ms: number) => {
  const r = p.then(v => ({ v }), e => ({ e: e as ErrorViaje })); await vi.advanceTimersByTimeAsync(ms); return r;
};
const registra = (servidor: Map<string, string>, args: any) => { if (!servidor.has(args.p_solicitud)) servidor.set(args.p_solicitud, String(100 + servidor.size)); return servidor.get(args.p_solicitud)!; };

describe('Resiliencia de ViajesService (RES-01 a RES-08)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(1); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('RES-01 pérdida de Internet en una consulta: error controlado tras 3 intentos con espera progresiva', async () => {
    const { servicio, rpc } = montar(async () => sinRed());
    const p = servicio.obtenerMios().then(() => null, e => e as ErrorViaje);
    await vi.advanceTimersByTimeAsync(999); expect(rpc).toHaveBeenCalledTimes(1);          // espera 1 s antes del 2.º intento
    await vi.advanceTimersByTimeAsync(1); expect(rpc).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000); const e = await p;                              // espera 2 s antes del 3.º
    expect(rpc).toHaveBeenCalledTimes(3); expect(e).toBeInstanceOf(ErrorViaje); expect(e!.message).toContain('No fue posible cargar tus viajes');
  });

  it('RES-02 pérdida de Internet en una escritura: nunca confirma falsamente', async () => {
    const sin = montar(async () => sinRed(), false);                                         // el sistema ya sabe que no hay red
    const a = await guardarYAvanzar(sin.servicio.guardar(datos, 'u-1'), 100);
    expect((a as any).e.message).toContain('No hay conexión'); expect(sin.rpc).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const cae = montar(async () => sinRed());                                                // onLine=true pero el transporte falla
    const b = await guardarYAvanzar(cae.servicio.guardar(datos, 'u-2'), 10000);
    expect('v' in b).toBe(false); expect((b as any).e.resultadoIncierto).toBe(true); expect(cae.servidor.size).toBe(0);
  });

  it('RES-03 servidor sin respuesta: timeout de 15 s por intento y fin controlado (~48 s en total)', async () => {
    const { servicio, rpc } = montar(() => new Promise<Resp>(() => {}));
    const r = await guardarYAvanzar(servicio.guardar(datos, 'u-3'), 15000 + 1000 + 15000 + 2000 + 15000);
    expect(rpc).toHaveBeenCalledTimes(3); expect((r as any).e).toBeInstanceOf(ErrorViaje); expect((r as any).e.resultadoIncierto).toBe(true);
  });

  it('RES-04 HTTP 500: muestra error, reintenta y la app sigue estable para la siguiente operación', async () => {
    let falloSiempre = true;
    const { servicio, rpc } = montar(async (_n, args, srv) => falloSiempre ? falla(500, 'XX000', 'Internal') : ok(registra(srv, args)));
    const r = await guardarYAvanzar(servicio.guardar(datos, 'u-4'), 10000);
    expect(rpc).toHaveBeenCalledTimes(3); expect((r as any).e.message).toContain('No pudimos confirmar el envío');
    falloSiempre = false; const siguiente = await guardarYAvanzar(servicio.guardar(datos, 'u-4'), 100);
    expect((siguiente as any).v).toBe('100');
  });

  it('RES-05 HTTP 401 y 403: gestiona sesión y permisos sin reintentar', async () => {
    const a = montar(async () => falla(401, 'PGRST301', 'JWT expired'));
    const r401 = await guardarYAvanzar(a.servicio.guardar(datos, 'u-5'), 10000);
    expect((r401 as any).e.message).toContain('sesión venció'); expect(a.rpc).toHaveBeenCalledTimes(1); expect((r401 as any).e.transitorio).toBe(false);
    TestBed.resetTestingModule();
    const b = montar(async () => falla(403, '42501', 'permission denied'));
    const r403 = await guardarYAvanzar(b.servicio.obtenerMios(), 10000);
    expect((r403 as any).e.message).toContain('no tiene permiso'); expect(b.rpc).toHaveBeenCalledTimes(1);
  });

  it('RES-06 recuperación de conexión: el 3.er intento tiene éxito', async () => {
    const { servicio, rpc } = montar(async (n, args, srv) => n < 3 ? sinRed() : ok(registra(srv, args)));
    const r = await guardarYAvanzar(servicio.guardar(datos, 'u-6'), 10000);
    expect((r as any).v).toBe('100'); expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('RES-07 reintento de una escritura cuya respuesta se perdió: no genera duplicados', async () => {
    const { servicio, llamadas, servidor } = montar(async (n, args, srv) => { const id = registra(srv, args); return n === 1 ? sinRed() : ok(id); });   // el servidor guardó, la respuesta no llegó
    const r = await guardarYAvanzar(servicio.guardar(datos, 'u-7'), 10000);
    expect((r as any).v).toBe('100'); expect(servidor.size).toBe(1);
    expect(new Set(llamadas.map(l => l.args.p_solicitud))).toEqual(new Set(['u-7']));       // todos los intentos usaron el mismo UUID
  });

  it('RES-08 respuesta tardía: la respuesta del intento ya vencido no altera el resultado ni duplica', async () => {
    const { servicio, servidor } = montar((n, args, srv) => n === 1
      ? new Promise<Resp>(res => setTimeout(() => res(ok(registra(srv, args))), 20000))      // responde a los 20 s, después del timeout de 15 s
      : Promise.resolve(ok(registra(srv, args))));
    const resultados: string[] = []; const p = servicio.guardar(datos, 'u-8').then(v => { resultados.push(v); return v; });
    await vi.advanceTimersByTimeAsync(40000); await p;
    expect(resultados).toEqual(['100']); expect(servidor.size).toBe(1);                      // una sola resolución y un solo registro
  });

  it('paginación: el cliente pide 50 y envía el cursor de la última solicitud recibida', async () => {
    const { servicio, llamadas } = montar(async () => ok([]));
    await servicio.obtenerMios(); await servicio.obtenerMios('4321');
    expect(llamadas[0].args).toEqual({ p_limite: TAMANO_PAGINA_VIAJES, p_antes_id: null });
    expect(llamadas[1].args).toEqual({ p_limite: 50, p_antes_id: '4321' });
  });

  it('paginación: conserva orden y cursor si el servidor solo admite la consulta anterior', async () => {
    const { servicio, llamadas } = montar(async (_n, args) => args
      ? falla(404, 'PGRST202')
      : ok([{ id: '1' }, { id: '3' }, { id: '2' }]));
    expect((await servicio.obtenerMios()).map(viaje => viaje.id)).toEqual(['3', '2', '1']);
    expect((await servicio.obtenerMios('3')).map(viaje => viaje.id)).toEqual(['2', '1']);
    expect(llamadas[1].args).toBeUndefined();
  });
});
