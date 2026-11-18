import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import type { Destino } from './destinos/catalogo.service';

export interface DestinoFavorito {
  id: number;
  nombre: string;
  pais: string | null;
  imagen: string | null;
  precio_desde: number;
  categoria: string;
}

interface FavoritosLocales {
  destinos: DestinoFavorito[];
  pendientes: Record<number, boolean>;
}

const VACIO: FavoritosLocales = { destinos: [], pendientes: {} };

@Injectable({ providedIn: 'root' })
export class FavoritosService {
  private readonly auth = inject(SupabaseService);
  private readonly cuentas = signal(new Map<string, FavoritosLocales>());
  private readonly sincronizaciones = new Map<string, Promise<void>>();
  private readonly cargandoCuenta = signal<string | null>(null);
  private readonly errorCuenta = signal<{ usuario: string; mensaje: string } | null>(null);

  readonly usuario = this.auth.usuarioFavoritos;
  readonly destinos = computed(() => {
    const usuario = this.usuario();
    return usuario ? this.estado(usuario).destinos : [];
  });
  readonly ids = computed(() => new Set(this.destinos().map(destino => destino.id)));
  readonly cargando = computed(() => this.usuario() !== null && this.usuario() === this.cargandoCuenta());
  readonly pendientes = computed(() => {
    const usuario = this.usuario();
    return usuario ? Object.keys(this.estado(usuario).pendientes).length : 0;
  });
  readonly error = computed(() => {
    const error = this.errorCuenta();
    return error?.usuario === this.usuario() ? error.mensaje : '';
  });

  constructor() {
    effect(() => {
      if (this.auth.enLinea() && this.auth.isAuthenticated()) {
        void this.cargar();
      }
    });
  }

  private clave(usuario: string): string {
    return `meridian:favoritos:v1:${usuario}`;
  }

  private estado(usuario: string): FavoritosLocales {
    const actual = this.cuentas().get(usuario);
    if (actual) return actual;
    try {
      const copia = JSON.parse(localStorage.getItem(this.clave(usuario)) ?? 'null') as FavoritosLocales | null;
      return copia && Array.isArray(copia.destinos) && copia.pendientes ? copia : VACIO;
    } catch {
      return VACIO;
    }
  }

  private guardar(usuario: string, estado: FavoritosLocales): void {
    localStorage.setItem(this.clave(usuario), JSON.stringify(estado));
    this.cuentas.update(cuentas => new Map(cuentas).set(usuario, estado));
  }

  esFavorito(id: number): boolean {
    return this.ids().has(id);
  }

  toggle(destino: Destino | DestinoFavorito): void {
    const usuario = this.usuario();
    if (!usuario) return;
    const estado = this.estado(usuario);
    const agregar = !estado.destinos.some(favorito => favorito.id === destino.id);
    const { id, nombre, pais, imagen, categoria } = destino;
    const precio_desde = 'precioDesde' in destino ? destino.precioDesde : destino.precio_desde;
    try {
      this.guardar(usuario, {
        destinos: agregar
          ? [...estado.destinos, { id, nombre, pais, imagen, categoria, precio_desde }]
          : estado.destinos.filter(favorito => favorito.id !== id),
        pendientes: { ...estado.pendientes, [id]: agregar },
      });
      this.errorCuenta.set(null);
      void this.cargar();
    } catch {
      this.errorCuenta.set({ usuario, mensaje: 'No se pudo guardar el cambio en el dispositivo.' });
    }
  }

  cargar(): Promise<void> {
    const usuario = this.usuario();
    if (!usuario || !this.puedeSincronizar(usuario)) return Promise.resolve();
    const activa = this.sincronizaciones.get(usuario);
    if (activa) return activa;

    const tarea = this.sincronizar(usuario).catch(() => {
      if (this.usuario() === usuario) {
        this.errorCuenta.set({ usuario, mensaje: 'No se pudieron sincronizar los favoritos.' });
      }
    }).finally(() => {
      this.sincronizaciones.delete(usuario);
      if (this.cargandoCuenta() === usuario) this.cargandoCuenta.set(null);
    });
    this.sincronizaciones.set(usuario, tarea);
    return tarea;
  }

  private puedeSincronizar(usuario: string): boolean {
    return this.usuario() === usuario && this.auth.enLinea() && this.auth.isAuthenticated();
  }

  private async sincronizar(usuario: string): Promise<void> {
    const db = this.auth.client;
    this.cargandoCuenta.set(usuario);
    this.errorCuenta.set(null);

    const favoritos = await db.from('favoritos').select('destino_id').eq('user_id', usuario)
      .abortSignal(AbortSignal.timeout(8000));
    if (favoritos.error) throw favoritos.error;
    if (!this.puedeSincronizar(usuario)) return;
    const idsRemotos = new Set<number>(favoritos.data.map(favorito => favorito.destino_id));
    const destinos = idsRemotos.size
      ? await db.from('destinos').select('id, nombre, pais, imagen, precio_desde, categoria')
        .in('id', [...idsRemotos]).abortSignal(AbortSignal.timeout(8000))
      : { data: [], error: null };
    if (!this.puedeSincronizar(usuario)) return;
    if (destinos.error) throw destinos.error;

    const estado = this.estado(usuario);
    const combinados = new Map<number, DestinoFavorito>(destinos.data.map(destino => [
      destino.id,
      { ...destino, imagen: destino.imagen?.replace(/^\//, '') ?? null },
    ]));
    for (const destino of estado.destinos) {
      if (estado.pendientes[destino.id] === true) combinados.set(destino.id, destino);
    }
    for (const [id, agregar] of Object.entries(estado.pendientes)) {
      if (!agregar) combinados.delete(Number(id));
    }
    this.guardar(usuario, { destinos: [...combinados.values()], pendientes: estado.pendientes });

    while (this.puedeSincronizar(usuario)) {
      const cambio = Object.entries(this.estado(usuario).pendientes)[0];
      if (!cambio) return;
      const [clave, agregar] = cambio;
      const id = Number(clave);
      if (idsRemotos.has(id) !== agregar) {
        const operacion = agregar
          ? db.from('favoritos').insert({ destino_id: id, user_id: usuario })
          : db.from('favoritos').delete().eq('destino_id', id).eq('user_id', usuario);
        const { error } = await operacion.abortSignal(AbortSignal.timeout(8000));
        if (error && !(agregar && error.code === '23505')) throw error;
        if (agregar) idsRemotos.add(id);
        else idsRemotos.delete(id);
      }

      // Una pulsación posterior puede haber invertido el cambio durante la petición.
      const actual = this.estado(usuario);
      if (actual.pendientes[id] === agregar) {
        const pendientes = { ...actual.pendientes };
        delete pendientes[id];
        this.guardar(usuario, { ...actual, pendientes });
      }
    }
  }
}
