import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase.service';
import { ReservaComponent } from './reserva.component';

describe('Integración de ReservaComponent con ViajesService y el contrato RPC', () => {
  const respuestaValida = { data: '42', status: 200, error: null };
  const transporte = vi.fn();
  const rpc = vi.fn((_nombre: string, _argumentos: unknown) => ({ abortSignal: transporte }));
  let reserva: ReservaComponent;

  beforeEach(() => {
    vi.useFakeTimers();
    transporte.mockReset();
    rpc.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ destino: 'Cancún' }) } } },
        {
          provide: SupabaseService,
          useValue: { getSession: async () => ({ data: { session: { user: null } }, error: null }), client: { rpc } },
        },
      ],
    });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    reserva = TestBed.createComponent(ReservaComponent).componentInstance;
    Object.assign(reserva.datos, {
      origen: 'Querétaro', nombre: 'Ana', correo: 'ana@example.com', telefono: '4421234567',
      salida: reserva.hoy,
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('envía los datos a la RPC y confirma el identificador devuelto', async () => {
    transporte.mockResolvedValue(respuestaValida);
    await reserva.enviar();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('movil_crear_cotizacion', {
      p_datos: { ...reserva.datos, acompanantes: [] },
      p_solicitud: expect.stringMatching(/^[\da-f-]{36}$/i),
    });
    expect(reserva.guardadoId()).toBe('42');
    expect(reserva.error()).toBe('');
  });

  it('informa del vencimiento de sesión ante HTTP 401 y no reintenta', async () => {
    transporte.mockResolvedValue({ data: null, status: 401, error: { code: 'PGRST301' } });
    await reserva.enviar();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(reserva.guardadoId()).toBe('');
    expect(reserva.error()).toContain('Tu sesión venció');
    expect(reserva.enviando()).toBe(false);
  });

  it('usa los mismos datos y UUID al reenviar después de perder la respuesta', async () => {
    transporte.mockRejectedValue(new TypeError('Failed to fetch'));
    const envio = reserva.enviar();
    await vi.runAllTimersAsync();
    await envio;
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(reserva.guardadoId()).toBe('');
    expect(reserva.reintentoPendiente()).toBe(true);
    expect(reserva.error()).toContain('No pudimos confirmar el envío');

    reserva.datos.origen = 'Puebla';
    transporte.mockResolvedValue(respuestaValida);
    await reserva.enviar();
    expect(rpc).toHaveBeenCalledTimes(4);
    for (const llamada of rpc.mock.calls) {
      expect(llamada).toEqual(rpc.mock.calls[0]);
    }
    expect(reserva.guardadoId()).toBe('42');
    expect(reserva.reintentoPendiente()).toBe(false);
  });
});
