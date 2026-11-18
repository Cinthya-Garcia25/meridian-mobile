import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase.service';
import { NotificacionesService } from './notificaciones.service';

function preparar() {
  const nativo = { configurado: true, permitido: true, usuario: '', abrir: false };
  const registro = { instalacion: 'instalacion', token: 'token-firebase' };
  const usuarioSesion = signal<string | null>('viajero');
  const llamar = vi.fn(async (accion: string, argumentos: string[]) => {
    if (accion === 'estado') return { ...nativo };
    if (accion === 'permiso') return nativo.permitido ? 1 : 0;
    if (accion === 'token') return registro;
    if (accion === 'activar') nativo.usuario = argumentos[0];
    if (accion === 'desactivar') {
      nativo.usuario = '';
      return registro.instalacion;
    }
    return undefined;
  });
  vi.stubGlobal('MeridianPush', { llamar });
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ error: null }) }));
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: SupabaseService, useValue: {
      client: { rpc }, usuarioSesion, sesionLista: signal(true), enLinea: signal(true),
    } }],
  });
  const router = TestBed.inject(Router);
  const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const servicio = TestBed.inject(NotificacionesService);
  TestBed.tick();
  return { servicio, nativo, llamar, rpc, navegar };
}

describe('NotificacionesService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('registra el dispositivo tras autorizar el permiso y lo desvincula al desactivar', async () => {
    const { servicio, nativo, rpc } = preparar();
    expect(rpc).not.toHaveBeenCalled();
    await servicio.activar();
    expect(nativo.usuario).toBe('viajero');
    expect(servicio.activas()).toBe(true);
    expect(rpc).toHaveBeenCalledWith('movil_push_registrar', {
      p_instalacion: 'instalacion', p_token: 'token-firebase',
    });
    await servicio.desactivar();
    expect(nativo.usuario).toBe('');
    expect(servicio.activas()).toBe(false);
    expect(rpc).toHaveBeenCalledWith('movil_push_desregistrar', { p_instalacion: 'instalacion' });
  });

  it('no registra el token si se deniega el permiso de Android', async () => {
    const { servicio, nativo, llamar, rpc } = preparar();
    nativo.permitido = false;
    await servicio.activar();
    expect(llamar).toHaveBeenCalledWith('permiso', []);
    expect(rpc).not.toHaveBeenCalled();
    expect(servicio.mensaje()).toContain('ajustes de Android');
  });

  it('abre Mis solicitudes desde una notificación de la cuenta activa', async () => {
    const { servicio, nativo, navegar } = preparar();
    await servicio.activar();
    nativo.abrir = true;
    document.dispatchEvent(new Event('meridianpushopen'));
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledOnce());
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(navegar.mock.calls[0][0] as ReturnType<Router['createUrlTree']>)).toBe('/mis-viajes');
  });
});
