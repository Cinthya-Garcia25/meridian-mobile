import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { credencialesValidas } from './auth-validation';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_SESION = 'sb-cqlproylbbzisqlsdxne-auth-token';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  private sesion = signal<Session | null>(null);
  readonly usuarioSesion = computed(() => this.sesion()?.user.id ?? null);
  readonly isAuthenticated = computed(() => this.sesion() !== null);
  readonly sesionLista = signal(false);
  readonly enLinea = signal(navigator.onLine);
  private readonly usuarioGuardado = signal(this.leerUsuarioGuardado());
  // La identidad guardada solo habilita la copia local de favoritos.
  readonly usuarioFavoritos = computed(() =>
    this.sesion()?.user.id ?? (this.enLinea() ? null : this.usuarioGuardado())
  );

  constructor() {
    this.client = createClient(
      'https://cqlproylbbzisqlsdxne.supabase.co',
      'sb_publishable_oZbasbPVBTkU8KxmQDNTAw_AJ17_Qia',
      { auth: { debug: false, storageKey: STORAGE_SESION } }
    );
    const actualizarConexion = () => {
      this.enLinea.set(navigator.onLine);
      if (navigator.onLine && !this.sesion()) {
        void this.client.auth.getSession().then(({ data }) => {
          if (data.session) this.sesion.set(data.session);
        });
      }
    };
    window.addEventListener('online', actualizarConexion);
    window.addEventListener('offline', actualizarConexion);
    document.addEventListener('resume', actualizarConexion);
    const { data: { subscription } } = this.client.auth.onAuthStateChange((_evento, sesion) => {
      this.sesion.set(sesion);
      this.usuarioGuardado.set(sesion?.user.id ?? this.leerUsuarioGuardado());
      this.sesionLista.set(true);
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      window.removeEventListener('online', actualizarConexion);
      window.removeEventListener('offline', actualizarConexion);
      document.removeEventListener('resume', actualizarConexion);
    });
  }

  private leerUsuarioGuardado(): string | null {
    try {
      const sesion = JSON.parse(localStorage.getItem(STORAGE_SESION) ?? 'null') as Session | null;
      return typeof sesion?.user?.id === 'string' ? sesion.user.id : null;
    } catch {
      return null;
    }
  }

  async signIn(email: string, password: string) {
    if (!credencialesValidas(email, password)) throw new Error('Datos de acceso no válidos.');
    return await this.client.auth.signInWithPassword({ email: email.trim(), password });
  }

  async signUp(email: string, password: string, datos: { nombre: string; apellidos: string; telefono: string }) {
    if (!credencialesValidas(email, password)) throw new Error('Datos de registro no válidos.');
    return await this.client.auth.signUp({ email: email.trim(), password, options: { data: datos } });
  }

  async signOut() {
    return await this.client.auth.signOut();
  }

  async getSession() {
    return await this.client.auth.getSession();
  }
}
