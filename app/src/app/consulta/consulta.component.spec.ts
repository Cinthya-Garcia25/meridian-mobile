import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsultaComponent } from './consulta.component';
import { SupabaseService } from '../supabase.service';
import { ChatService } from '../chat/chat.service';
import { ViajesService } from '../reserva/viajes.service';

describe('Consulta actual: carga de solicitudes', () => {
  afterEach(() => TestBed.resetTestingModule());
  function crear() {
    const bandeja = vi.fn().mockResolvedValue({ esPersonal: false, casos: [] });
    const obtenerMios = vi.fn().mockResolvedValue([{ id: '101' }]);
    const estadosReserva = vi.fn().mockResolvedValue([]);
    const confirmarReserva = vi.fn().mockResolvedValue('2026-11-16T20:00:00Z');
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: SupabaseService, useValue: { getSession: async () => ({ data: { session: null }, error: null }) } },
      { provide: ChatService, useValue: { bandeja } },
      { provide: ViajesService, useValue: { obtenerMios, estadosReserva, confirmarReserva } },
      { provide: Router, useValue: { navigate } },
    ] });
    return { componente: TestBed.runInInjectionContext(() => new ConsultaComponent()), bandeja, obtenerMios, estadosReserva, confirmarReserva, navigate };
  }
  it('redirige al login si no existe sesión', async () => {
    const { componente, navigate, bandeja } = crear();
    await componente.ngOnInit();
    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(bandeja).not.toHaveBeenCalled();
  });
  it('carga viajes propios para viajeros', async () => {
    const { componente, obtenerMios } = crear();
    await componente.cargarCotizaciones();
    expect(obtenerMios).toHaveBeenCalledOnce();
    expect(componente.cotizaciones()).toEqual([{ id: '101' }]);
    expect(componente.cargandoCotizaciones()).toBe(false);
  });
  it('usa la bandeja para personal sin consultar viajes propios', async () => {
    const { componente, bandeja, obtenerMios } = crear();
    bandeja.mockResolvedValue({ esPersonal: true, casos: [{ id: '102' }] });
    await componente.cargarCotizaciones();
    expect(componente.esPersonal()).toBe(true);
    expect(componente.cotizaciones()).toEqual([{ id: '102' }]);
    expect(obtenerMios).not.toHaveBeenCalled();
  });
  it('recupera viajes aunque el chat no esté disponible', async () => {
    const { componente, bandeja } = crear();
    bandeja.mockRejectedValue(new Error('Chat no disponible'));
    await componente.cargarCotizaciones();
    expect(componente.cotizaciones()).toEqual([{ id: '101' }]);
    expect(componente.errorCotizaciones()).toBe('');
  });
  it('registra error y termina el indicador de carga', async () => {
    const { componente, obtenerMios } = crear();
    obtenerMios.mockRejectedValue(new Error('Sin conexión'));
    await componente.cargarCotizaciones();
    expect(componente.errorCotizaciones()).toBe('Sin conexión');
    expect(componente.cargandoCotizaciones()).toBe(false);
    expect(componente.cotizaciones()).toEqual([]);
  });
  it('confirma solo los casos autorizados y conserva la fecha devuelta por el servidor', async () => {
    const { componente, bandeja, estadosReserva, confirmarReserva } = crear();
    bandeja.mockResolvedValue({ esPersonal: true, casos: [{ id: '102' }] });
    estadosReserva.mockResolvedValue([{ id: '102', confirmada_en: null, puede_confirmar: true }]);
    await componente.cargarCotizaciones();
    componente.iniciarConfirmacion('103');
    await componente.confirmarReserva();
    expect(confirmarReserva).not.toHaveBeenCalled();

    componente.iniciarConfirmacion('102');
    await componente.confirmarReserva();
    expect(confirmarReserva).toHaveBeenCalledExactlyOnceWith('102');
    expect(componente.estadosReserva()['102']).toEqual({
      id: '102', confirmada_en: '2026-11-16T20:00:00Z', puede_confirmar: false,
    });
  });

});
