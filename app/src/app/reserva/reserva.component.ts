import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcompanantesComponent } from '../acompanantes/acompanantes.component';
import { Usuario } from '../acompanantes/acompanantes.service';
import { SupabaseService } from '../supabase.service';
import { datosInicialesValidos } from './reserva-validacion';
import { ErrorViaje, SolicitudViaje, ViajesService } from './viajes.service';

@Component({
  selector: 'app-reserva', standalone: true,
  imports: [FormsModule, RouterLink, AcompanantesComponent],
  templateUrl: './reserva.component.html', styleUrl: './reserva.component.css',
})
export class ReservaComponent {
  readonly destino = inject(ActivatedRoute).snapshot.queryParamMap.get('destino') || '';
  private readonly viajes = inject(ViajesService);
  private readonly solicitudId = crypto.randomUUID();
  private envioPendiente: SolicitudViaje | null = null;
  readonly enviando = signal(false);
  readonly guardadoId = signal('');
  readonly reintentoPendiente = signal(false);
  readonly paso = signal(1);
  readonly error = signal('');
  readonly conAcompanantes = signal(false);
  readonly acompanantes = signal<Usuario[]>([]);
  readonly hoy = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  datos = { destino: this.destino, origen: '', salida: '', regreso: '', nombre: '', correo: '', telefono: '', comentarios: '' };
  private readonly cambios = inject(ChangeDetectorRef);
  constructor() {
    void inject(SupabaseService).getSession().then(({ data }) => {
      const usuario = data.session?.user;
      if (!usuario) return;
      if (!this.datos.nombre) this.datos.nombre = [usuario.user_metadata['nombre'], usuario.user_metadata['apellidos']].filter(Boolean).join(' ');
      if (!this.datos.correo) this.datos.correo = usuario.email || '';
      if (!this.datos.telefono) this.datos.telefono = usuario.user_metadata['telefono'] || '';
      this.cambios.markForCheck();
    }).catch(() => { /* El formulario permite capturar los datos manualmente. */ });
  }
  continuar(form: NgForm): void {
    this.error.set('');
    if (form.invalid || !datosInicialesValidos(this.datos, this.hoy)) {
      form.control.markAllAsTouched();
      this.error.set('Completa los datos obligatorios y revisa que las fechas sean válidas.'); return;
    }
    this.ir(2);
  }
  elegir(conAcompanantes: boolean): void { this.conAcompanantes.set(conAcompanantes); this.error.set(''); }
  revisar(): void {
    if (this.conAcompanantes() && this.acompanantes().length === 0) {
      this.error.set('Selecciona al menos un acompañante o elige Viajo solo.'); return;
    }
    this.ir(3);
  }
  ir(paso: number): void {
    if (this.enviando() || this.guardadoId() || this.reintentoPendiente()) return;
    this.error.set(''); this.paso.set(paso);
    document.getElementById('pasos-viaje')?.scrollIntoView({ block: 'start' });
  }
  async enviar(): Promise<void> {
    if (this.enviando() || this.guardadoId()) return;
    this.error.set('');
    this.enviando.set(true);
    const datos = this.envioPendiente || {
      ...this.datos,
      acompanantes: this.conAcompanantes() ? this.acompanantes().map(({ nombre, edad }) => ({ nombre, edad })) : [],
    };
    this.envioPendiente = datos;
    try {
      this.guardadoId.set(await this.viajes.guardar(datos, this.solicitudId));
      this.reintentoPendiente.set(false);
    } catch (error) {
      this.reintentoPendiente.set(error instanceof ErrorViaje && error.resultadoIncierto);
      if (!this.reintentoPendiente()) this.envioPendiente = null;
      this.error.set(error instanceof Error ? error.message : 'No fue posible guardar la solicitud.');
    } finally { this.enviando.set(false); }
  }
  fecha(valor: string): string { return valor ? new Date(valor + 'T12:00:00').toLocaleDateString('es-MX') : 'Sin definir'; }
}
