import { Injectable } from '@angular/core';

export interface Usuario {
  id: number;
  nombre: string;
  edad: number;
  profesion: string;
  correo: string;
}
export type DatosUsuario = Omit<Usuario, 'id'>;
interface RoomBridge {
  ejecutar(accion: string, datos: unknown, exito: (resultado: any) => void, error: (mensaje: string) => void): void;
}
declare global {
  interface Window { MeridianRoom?: RoomBridge; cordova?: { platformId: string }; }
}

@Injectable({ providedIn: 'root' })
export class AcompanantesService {
  private disponible = new Promise<void>(resolve => {
    if (window.MeridianRoom) { resolve(); return; }
    document.addEventListener('deviceready', () => resolve(), { once: true });
  });

  private async ejecutar<T>(accion: string, datos?: unknown): Promise<T> {
    if (!window.cordova || window.cordova.platformId !== 'android') {
      throw new Error('Esta función guarda datos en Android. Abre la app instalada en tu teléfono o emulador.');
    }
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([this.disponible, new Promise<never>((_, reject) => {
        temporizador = setTimeout(() => reject(new Error('El almacenamiento local no está listo. Cierra y abre la app.')), 10000);
      })]);
    } finally { if (temporizador) clearTimeout(temporizador); }
    if (!window.MeridianRoom) throw new Error('Instala el plugin de almacenamiento y recompila Android.');
    return new Promise<T>((resolve, reject) => {
      window.MeridianRoom!.ejecutar(accion, datos, resolve, mensaje => reject(new Error(mensaje)));
    });
  }
  obtenerTodos(): Promise<Usuario[]> { return this.ejecutar('obtenerTodos'); }
  insertar(datos: DatosUsuario): Promise<Usuario> { return this.ejecutar('insertar', datos); }
  actualizar(usuario: Usuario): Promise<Usuario> { return this.ejecutar('actualizar', usuario); }
  eliminar(id: number): Promise<void> { return this.ejecutar('eliminar', { id }); }
}
