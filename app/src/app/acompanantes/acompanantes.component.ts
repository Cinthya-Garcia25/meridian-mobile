import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcompanantesService, DatosUsuario, Usuario } from './acompanantes.service';

@Component({
  selector: 'app-acompanantes', standalone: true, imports: [FormsModule, RouterLink],
  templateUrl: './acompanantes.component.html', styleUrl: './acompanantes.component.css',
})
export class AcompanantesComponent {
  @Input() integrado = false;
  @Input() seleccionInicial: Usuario[] = [];
  @Output() seleccionChange = new EventEmitter<Usuario[]>();
  readonly seleccionados = signal<Usuario[]>([]);
  estaSeleccionado(id: number): boolean { return this.seleccionados().some(u => u.id === id); }
  seleccionar(usuario: Usuario): void {
    this.seleccionados.update(lista => this.estaSeleccionado(usuario.id) ? lista.filter(u => u.id !== usuario.id) : [...lista, usuario]);
    this.seleccionChange.emit(this.seleccionados());
  }
  ngOnInit(): void { this.seleccionados.set([...this.seleccionInicial]); }

  private readonly servicio = inject(AcompanantesService);
  readonly destino = inject(ActivatedRoute).snapshot.queryParamMap.get('destino') || 'Tu próximo destino';
  readonly usuarios = signal<Usuario[]>([]);
  readonly ocupado = signal(false);
  readonly consultado = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly editarId = signal<number | null>(null);
  readonly eliminarPendiente = signal<Usuario | null>(null);
  datos: DatosUsuario = this.vacio();
  private vacio(): DatosUsuario { return { nombre: '', edad: null as unknown as number, profesion: '', correo: '' }; }

  private async operacion(trabajo: () => Promise<void>): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set(''); this.mensaje.set('');
    try { await trabajo(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'No fue posible completar la operación.'); }
    finally { this.ocupado.set(false); }
  }
  private async cargar(): Promise<void> {
    const lista = await this.servicio.obtenerTodos();
    this.usuarios.set(lista); this.consultado.set(true);
    this.seleccionados.set(lista.filter(u => this.estaSeleccionado(u.id)));
    this.seleccionChange.emit(this.seleccionados());
  }
  consultar(): void { void this.operacion(() => this.cargar()); }
  guardar(form: NgForm): void {
    if (form.invalid || !this.datos.nombre.trim() || !Number.isInteger(this.datos.edad)) {
      form.control.markAllAsTouched(); this.error.set('Completa el nombre y una edad entera de 1 a 120 años.'); return;
    }
    const datos = { ...this.datos, nombre: this.datos.nombre.trim(), profesion: this.datos.profesion.trim(), correo: this.datos.correo.trim() };
    const id = this.editarId();
    void this.operacion(async () => {
      const guardado = id === null ? await this.servicio.insertar(datos) : await this.servicio.actualizar({ ...datos, id });
      if (this.integrado && !this.estaSeleccionado(guardado.id)) this.seleccionados.update(lista => [...lista, guardado]);
      this.cancelar(form);
      this.mensaje.set(id === null ? 'Acompañante registrado en este dispositivo.' : 'Datos actualizados.');
      await this.cargar();
    });
  }
  editar(usuario: Usuario, form: NgForm): void {
    this.editarId.set(usuario.id);
    this.datos = { nombre: usuario.nombre, edad: usuario.edad, profesion: usuario.profesion, correo: usuario.correo };
    form.resetForm(this.datos); this.error.set(''); this.mensaje.set('');
    document.getElementById('form-acompanante')?.scrollIntoView({ block: 'start' });
    document.getElementById('nombre-acompanante')?.focus({ preventScroll: true });
  }
  cancelar(form: NgForm): void {
    this.editarId.set(null); this.datos = this.vacio(); form.resetForm(this.datos);
  }
  eliminar(form: NgForm): void {
    const usuario = this.eliminarPendiente(); if (!usuario) return;
    void this.operacion(async () => {
      await this.servicio.eliminar(usuario.id);
      this.eliminarPendiente.set(null);
      if (this.editarId() === usuario.id) this.cancelar(form);
      this.mensaje.set('Acompañante eliminado.'); await this.cargar();
    });
  }
}
