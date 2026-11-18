import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { ChatError, ChatService, SalaChat } from './chat.service';

@Component({ selector: 'app-chat', standalone: true, imports: [FormsModule, RouterLink], templateUrl: './chat.component.html', styleUrl: './chat.component.css' })
export class ChatComponent implements OnInit, OnDestroy {
  private readonly servicio = inject(ChatService);
  private readonly auth = inject(SupabaseService);
  private readonly router = inject(Router);
  readonly viajeId = inject(ActivatedRoute).snapshot.paramMap.get('id') || '';
  @ViewChild('lista') private lista?: ElementRef<HTMLElement>;
  @ViewChild('dialogo') private dialogo?: ElementRef<HTMLDialogElement>;
  readonly sala = signal<SalaChat | null>(null);
  readonly conectado = signal(false);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly limpiando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly incierto = signal(false);
  readonly dispositivo = computed(() => this.sala()?.rolPropio === 'viajero' ? 'A' : 'B');
  texto = '';
  private pendiente: { id: string; texto: string } | null = null;
  private canal?: RealtimeChannel;
  private intervalo?: ReturnType<typeof setInterval>;
  private enCarga = false;
  private repetir = false;
  private destruido = false;
  private readonly alReconectar = () => { void this.refrescar(); };

  async ngOnInit(): Promise<void> {
    if (!/^[1-9]\d*$/.test(this.viajeId)) { this.error.set('No se encontró la conversación.'); this.cargando.set(false); return; }
    try {
      const { data } = await this.auth.getSession();
      if (this.destruido) return;
      if (!data.session) {
        await this.router.navigate(['/login'], { queryParams: { chatViaje: this.viajeId } }); return;
      }
      await this.refrescar();
      if (this.destruido || !this.sala()) return;

    } catch { this.error.set('No fue posible iniciar el chat. Revisa tu conexión.'); this.cargando.set(false); }
  }
  async refrescar(): Promise<void> {
    if (this.destruido) return;
    if (this.enCarga) { this.repetir = true; return; }
    this.enCarga = true;
    try {
      do {
        this.repetir = false;
        const previa = this.sala();
        const lista = this.lista?.nativeElement;
        const cercaDelFinal = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 100;
        const siguiente = await this.servicio.sala(this.viajeId);
        if (this.destruido) return;
        const ultimo = siguiente.mensajes.at(-1);
        const esNuevo = !!ultimo && !!previa && ultimo.id !== previa.mensajes.at(-1)?.id;
        this.sala.set(siguiente);
        if (!this.canal) {
          this.canal = this.servicio.escuchar(this.viajeId, siguiente.usuarioId, () => { void this.refrescar(); }, ok => this.conectado.set(ok));
          this.intervalo = setInterval(() => { if (navigator.onLine) void this.refrescar(); }, 30000);
          window.addEventListener('online', this.alReconectar);
        }
        this.error.set('');
        if (esNuevo && ultimo.emisorId !== siguiente.usuarioId) this.aviso.set('Recibiste un mensaje nuevo.');
        if (cercaDelFinal || !previa) this.bajar();
      } while (this.repetir && !this.destruido);
    } catch (error) {
      if (!this.destruido) this.error.set(error instanceof Error ? error.message : 'No fue posible actualizar el chat.');
    } finally { this.enCarga = false; this.cargando.set(false); }
  }
  async enviar(): Promise<void> {
    if (this.enviando() || this.limpiando() || !this.sala()) return;
    // Cada intento reemplaza la confirmación del envío anterior, incluso sin red.
    this.aviso.set('');
    const texto = this.pendiente?.texto ?? this.texto.trim();
    if (!texto || this.texto.length > 1000) { this.error.set('Escribe un mensaje de 1 a 1000 caracteres.'); return; }
    if (!navigator.onLine) { this.error.set('No hay conexión. Tu mensaje sigue aquí para reintentar.'); return; }
    this.enviando.set(true); this.error.set(''); this.aviso.set('');
    this.pendiente ??= { id: crypto.randomUUID(), texto };
    try {
      await this.servicio.enviar(this.viajeId, this.pendiente.id, this.pendiente.texto);
      if (this.destruido) return;
      this.pendiente = null; this.incierto.set(false); this.texto = '';
      this.aviso.set('Mensaje enviado correctamente.');
      await this.refrescar(); this.bajar();
    } catch (error) {
      this.incierto.set(error instanceof ChatError && error.incierto);
      if (!this.incierto()) this.pendiente = null;
      this.error.set(error instanceof Error ? error.message : 'No fue posible enviar el mensaje.');
    } finally { this.enviando.set(false); }
  }
  confirmarLimpiar(): void { if (!this.enviando() && !this.incierto()) this.dialogo?.nativeElement.showModal(); }
  cancelarLimpiar(): void { if (!this.limpiando()) this.dialogo?.nativeElement.close(); }
  async limpiar(): Promise<void> {
    if (this.limpiando() || this.enviando()) return;
    this.limpiando.set(true); this.error.set('');
    try {
      await this.servicio.limpiar(this.viajeId);
      if (this.destruido) return;
      this.dialogo?.nativeElement.close();
      this.aviso.set('Historial limpiado para tu cuenta.');
      await this.refrescar();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'No fue posible limpiar el historial.'); this.dialogo?.nativeElement.close(); }
    finally { this.limpiando.set(false); }
  }
  hora(fecha: string): string { return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
  fecha(fecha: string): string { return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); }
  private bajar(): void { requestAnimationFrame(() => { if (!this.destruido && this.lista) this.lista.nativeElement.scrollTop = this.lista.nativeElement.scrollHeight; }); }
  ngOnDestroy(): void {
    this.destruido = true;
    if (this.canal) this.servicio.dejar(this.canal);
    if (this.intervalo) clearInterval(this.intervalo);
    window.removeEventListener('online', this.alReconectar);
  }
}
