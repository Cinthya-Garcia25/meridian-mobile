import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SupabaseService } from '../supabase.service';
import { ChatService } from './chat.service';

describe('Estado de conexión del chat', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('espera la confirmación de PostgreSQL antes de indicar tiempo real', () => {
    const escuchas: Record<string, (evento: any) => void> = {};
    let estadoCanal!: (estado: string) => void;
    const canal = {
      on: vi.fn((tipo: string, _filtro: unknown, callback: (evento: any) => void) => { escuchas[tipo] = callback; return canal; }),
      subscribe: vi.fn((callback: (estado: string) => void) => { estadoCanal = callback; return canal; }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { channel: () => canal } } }] });
    const servicio = TestBed.runInInjectionContext(() => new ChatService());
    const estado = vi.fn(); const cambio = vi.fn();
    servicio.escuchar('101', 'usuario', cambio, estado);
    estadoCanal('SUBSCRIBED'); expect(estado).toHaveBeenLastCalledWith(false);
    escuchas['system']({ status: 'ok' }); expect(estado).toHaveBeenLastCalledWith(true);
    estadoCanal('CHANNEL_ERROR'); expect(estado).toHaveBeenLastCalledWith(false);
    expect(cambio).toHaveBeenCalledTimes(2);
  });
});
