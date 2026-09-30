import { Injectable, computed, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  // Sesión actual como signal, para que el navbar cambie entre "Ingresar" y
  // "Cerrar sesión" en cuanto el usuario entra o sale.
  private sesion = signal<Session | null>(null);
  readonly isAuthenticated = computed(() => this.sesion() !== null);

  constructor() {
    this.supabase = createClient(
      'https://cqlproylbbzisqlsdxne.supabase.co',
      'sb_publishable_oZbasbPVBTkU8KxmQDNTAw_AJ17_Qia'
    );
    this.supabase.auth.getSession().then(({ data }) => this.sesion.set(data.session));
    this.supabase.auth.onAuthStateChange((_evento, sesion) => this.sesion.set(sesion));
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string, datos: { nombre: string; apellidos: string; telefono: string }) {
    // Los datos van como metadata del usuario; el trigger de public.profiles de la
    // web los copia a la tabla de perfiles al crear la cuenta.
    return await this.supabase.auth.signUp({ email, password, options: { data: datos } });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async getSession() {
    return await this.supabase.auth.getSession();
  }
}
