import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

interface EstadoNativo {
  configurado: boolean;
  permitido: boolean;
  usuario: string;
  abrir: boolean;
}

interface RegistroNativo { instalacion: string; token: string }

interface PuentePush {
  llamar(accion: 'estado', argumentos: [string]): Promise<EstadoNativo>;
  llamar(accion: 'permiso', argumentos: []): Promise<number>;
  llamar(accion: 'token', argumentos: []): Promise<RegistroNativo>;
  llamar(accion: 'activar', argumentos: [string]): Promise<void>;
  llamar(accion: 'desactivar', argumentos: []): Promise<string>;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly auth = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly puente = signal<PuentePush | undefined>(undefined);
  private operaciones = Promise.resolve();
  private ultimoRegistro?: RegistroNativo & { usuario: string };
  readonly disponible = signal(false);
  readonly activas = signal(false);
  readonly procesando = signal(false);
  readonly mensaje = signal('');

  constructor() {
    const raiz = window as Window & { MeridianPush?: PuentePush };
    const iniciar = () => this.puente.set(raiz.MeridianPush);
    const refrescar = () => this.encolar(() => this.refrescar());

    iniciar();
    document.addEventListener('deviceready', iniciar);
    document.addEventListener('resume', refrescar);
    document.addEventListener('meridianpushopen', refrescar);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('deviceready', iniciar);
      document.removeEventListener('resume', refrescar);
      document.removeEventListener('meridianpushopen', refrescar);
    });

    let usuarioAnterior: string | null = null;
    effect(() => {
      const puenteListo = this.puente();
      const sesionLista = this.auth.sesionLista();
      const usuario = this.auth.usuarioSesion();
      this.auth.enLinea();
      if (puenteListo && sesionLista) {
        if (usuarioAnterior && !usuario) {
          void this.encolar(async () => { await this.apagarNativo(puenteListo); });
        }
        void refrescar();
      }
      usuarioAnterior = usuario;
    });
  }

  private encolar(operacion: () => Promise<void>): Promise<void> {
    this.operaciones = this.operaciones.then(operacion).catch(() => {
      this.mensaje.set('No se pudo actualizar el estado de las notificaciones. Intenta de nuevo.');
    });
    return this.operaciones;
  }

  private async refrescar(): Promise<void> {
    const puente = this.puente();
    if (!puente || !this.auth.sesionLista()) return;

    const usuario = this.auth.usuarioSesion();
    const estado = await puente.llamar('estado', [usuario ?? '']);
    this.disponible.set(estado.configurado);
    this.activas.set(!!usuario && estado.usuario === usuario && estado.permitido);
    if (estado.usuario && usuario && estado.usuario !== usuario) {
      await this.apagarNativo(puente);
    }
    if (usuario && estado.abrir && usuario === this.auth.usuarioSesion()) {
      const ruta = this.router.createUrlTree(['/mis-viajes']);
      if (this.router.isActive(ruta, { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' })) {
        document.dispatchEvent(new Event('meridiancotizacionactualizada'));
      } else {
        await this.router.navigateByUrl(ruta);
      }
    }
    if (usuario && estado.usuario === usuario && estado.permitido && this.auth.enLinea()) {
      await this.registrar(puente, usuario);
    }
  }

  activar(): Promise<void> {
    return this.enviarAccion(async () => {
      const puente = this.puente();
      const usuario = this.auth.usuarioSesion();
      if (!puente || !usuario) return;
      if (!this.auth.enLinea()) {
        this.mensaje.set('Conéctate a internet para activar los avisos.');
        return;
      }
      if (!await puente.llamar('permiso', [])) {
        this.mensaje.set('Permite las notificaciones de Meridian Travel en los ajustes de Android.');
        return;
      }
      await this.registrar(puente, usuario);
      if (this.auth.usuarioSesion() !== usuario) return;
      await puente.llamar('activar', [usuario]);
      this.activas.set(true);
    });
  }

  desactivar(): Promise<void> {
    return this.enviarAccion(async () => {
      const puente = this.puente();
      if (!puente) return;
      const instalacion = await this.apagarNativo(puente);
      if (!instalacion || !this.auth.usuarioSesion()) return;
      const { error } = await this.auth.client.rpc('movil_push_desregistrar', { p_instalacion: instalacion })
        .abortSignal(AbortSignal.timeout(5_000));
      if (error) this.mensaje.set('Los avisos se apagaron en este teléfono. El registro remoto sigue pendiente.');
    });
  }

  private async apagarNativo(puente: PuentePush): Promise<string> {
    const instalacion = await puente.llamar('desactivar', []);
    this.activas.set(false);
    this.ultimoRegistro = undefined;
    return instalacion;
  }

  private enviarAccion(accion: () => Promise<void>): Promise<void> {
    this.procesando.set(true);
    return this.encolar(async () => {
      this.mensaje.set('');
      try {
        await accion();
      } finally {
        this.procesando.set(false);
      }
    });
  }

  private async registrar(puente: PuentePush, usuario: string): Promise<void> {
    const registro = await puente.llamar('token', []);
    if (usuario !== this.auth.usuarioSesion()) return;
    const ultimo = this.ultimoRegistro;
    if (ultimo?.usuario === usuario && ultimo.token === registro.token && ultimo.instalacion === registro.instalacion) return;
    const { error } = await this.auth.client.rpc('movil_push_registrar', {
      p_instalacion: registro.instalacion, p_token: registro.token,
    }).abortSignal(AbortSignal.timeout(8_000));
    if (error) throw error;
    this.ultimoRegistro = { ...registro, usuario };
  }
}
