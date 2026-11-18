import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FavoritosService } from './favoritos.service';
import { SupabaseService } from './supabase.service';
import { ChatError, ChatService } from './chat/chat.service';

const destino = { id: 42, nombre: 'Cancún', pais: 'México', imagen: null, precio_desde: 100, categoria: 'playa' };
const clave = 'meridian:favoritos:v1:usuario';

describe('Práctica 11: verificación de las correcciones', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(clave);
  });

  function preparar(from = vi.fn()) {
    const usuarioFavoritos = signal<string | null>('usuario');
    const enLinea = signal(false);
    const isAuthenticated = signal(true);
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: {
      usuarioFavoritos, enLinea, isAuthenticated, client: { from },
    } }] });
    const crear = () => TestBed.runInInjectionContext(() => new FavoritosService());
    return { crear, usuarioFavoritos, enLinea };
  }

  it('H-02 Favoritos: si falla la consulta al servidor, apaga el indicador de carga y conserva el favorito local', async () => {
    // Preparar un favorito local y simular que el servidor no responde.
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ abortSignal: () => Promise.reject(new TypeError('Failed to fetch')) }) }),
    }));
    const { crear, enLinea } = preparar(from);
    const servicio = crear();
    servicio.toggle(destino);
    enLinea.set(true);
    // Reintentar la sincronización y comprobar que el fallo se informa.
    await servicio.cargar();
    expect(servicio.error()).toBe('No se pudieron sincronizar los favoritos.');
    expect(servicio.destinos()).toEqual([destino]);
    expect(servicio.pendientes()).toBe(1);
    expect(servicio.cargando()).toBe(false);
  });

  it('H-03 Favoritos: muestra la copia local al reabrir y la oculta al cambiar de cuenta o quedarse sin sesión', () => {
    const { crear, usuarioFavoritos } = preparar();
    crear().toggle(destino);
    const reabierto = crear();
    expect(reabierto.destinos()).toEqual([destino]);
    usuarioFavoritos.set('otra-cuenta');
    expect(reabierto.destinos()).toEqual([]);
    usuarioFavoritos.set(null);
    expect(reabierto.esFavorito(42)).toBe(false);
  });

  it('Favoritos: al recuperar la conexión, guarda en el servidor el favorito agregado sin red', async () => {
    const insertar = vi.fn(() => ({ abortSignal: async () => ({ error: null }) }));
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ abortSignal: async () => ({ data: [], error: null }) }) }),
      insert: insertar,
    }));
    const { crear, enLinea } = preparar(from);
    const servicio = crear();
    servicio.toggle(destino);
    expect(from).not.toHaveBeenCalled();
    enLinea.set(true);
    TestBed.tick();
    await servicio.cargar();
    expect(insertar).toHaveBeenCalledExactlyOnceWith({ user_id: 'usuario', destino_id: 42 });
    expect(servicio.pendientes()).toBe(0);
    expect(servicio.destinos()).toEqual([destino]);
  });

  it('Favoritos: después de reabrir la app, sincroniza el favorito eliminado sin red', async () => {
    localStorage.setItem(clave, JSON.stringify({ destinos: [destino], pendientes: {} }));
    const eliminar = vi.fn(async () => ({ error: null }));
    const { crear, enLinea } = preparar(vi.fn(tabla => tabla === 'favoritos' ? {
      select: () => ({ eq: () => ({ abortSignal: async () => ({ data: [{ destino_id: 42 }], error: null }) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ abortSignal: eliminar }) }) }),
    } : {
      select: () => ({ in: () => ({ abortSignal: async () => ({ data: [destino], error: null }) }) }),
    }));
    crear().toggle(destino);
    const reabierto = crear();
    expect(reabierto.destinos()).toEqual([]);
    expect(reabierto.pendientes()).toBe(1);
    enLinea.set(true);
    await reabierto.cargar();
    expect(eliminar).toHaveBeenCalledOnce();
    expect(reabierto.pendientes()).toBe(0);
    expect(reabierto.destinos()).toEqual([]);
  });

  it.each([
    { caso: 'la respuesta es null', data: null },
    { caso: 'faltan campos obligatorios de la sala', data: { mensajes: [] } },
  ])('H-04 Chat: devuelve un error controlado si $caso', async ({ data }) => {
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: {
      rpc: () => ({ abortSignal: async () => ({ data, error: null }) }),
    } } }] });
    const servicio = TestBed.runInInjectionContext(() => new ChatService());
    const abrirSala = servicio.sala('101');
    await expect(abrirSala).rejects.toBeInstanceOf(ChatError);
    await expect(abrirSala).rejects.toThrow('El servidor devolvió una sala de chat inválida.');
  });
});
