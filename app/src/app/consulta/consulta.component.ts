import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotificacionesComponent } from '../notificaciones/notificaciones.component';
import { ChatService } from '../chat/chat.service';
import { SupabaseService } from '../supabase.service';
import { EstadoReserva, TAMANO_PAGINA_VIAJES, ViajeGuardado, ViajesService } from '../reserva/viajes.service';

interface DestinoSugerido {
  nombre: string;
  pais: string;
  imagen: string | null;
  precioDesde: number;
  categoria: string;
}

@Component({
  selector: 'app-consulta',
  standalone: true,
  imports: [RouterLink, NotificacionesComponent],
  templateUrl: './consulta.component.html',
  styleUrls: ['./consulta.component.css']
})
export class ConsultaComponent implements OnInit {
  private get supabase() { return this.auth.client; }
  private auth = inject(SupabaseService);
  private router = inject(Router);
  private viajes = inject(ViajesService);
  private chat = inject(ChatService);
  readonly esPersonal = signal(false);
  readonly estadosReserva = signal<Record<string, EstadoReserva>>({});
  readonly confirmarFolio = signal<string | null>(null);
  readonly confirmandoReserva = signal(false);
  readonly errorReserva = signal('');

  readonly cotizaciones = signal<ViajeGuardado[]>([]);
  readonly cargandoCotizaciones = signal(true);
  readonly errorCotizaciones = signal('');
  readonly hayMasCotizaciones = signal(false);
  readonly cargandoMasCotizaciones = signal(false);
  readonly errorMasCotizaciones = signal('');

  // Geolocalización
  readonly ciudadDetectada = signal<string | null>(null);
  readonly paisDetectado = signal<string | null>(null);
  readonly cargandoGeo = signal(false);
  readonly errorGeo = signal<string | null>(null);
  readonly destinosSugeridos = signal<DestinoSugerido[]>([]);

  // Todos los destinos cargados desde Supabase
  private todosDestinos: DestinoSugerido[] = [];

  constructor() {
  }

  async ngOnInit() {
    const { data, error } = await this.auth.getSession();
    if (error || !data.session) {
      this.router.navigate(['/login']); return;
    }
    void this.cargarCotizaciones();
    void this.cargarDestinos();
  }

  @HostListener('document:meridiancotizacionactualizada')
  actualizarDesdeAviso() {
    if (!this.cargandoCotizaciones()) void this.cargarCotizaciones();
  }

  async cargarCotizaciones() {
    if (this.confirmandoReserva()) return;
    if (!this.cargandoCotizaciones()) this.cargandoCotizaciones.set(true);
    this.errorCotizaciones.set('');
    try {
      // Una migración pendiente del chat no debe bloquear los viajes existentes.
      const bandeja = await this.chat.bandeja().catch(() => null);
      this.esPersonal.set(bandeja?.esPersonal ?? false);
      const lista = bandeja?.esPersonal ? bandeja.casos : await this.viajes.obtenerMios();
      await this.cargarEstadosReserva(lista);
      this.cotizaciones.set(lista);
      this.errorMasCotizaciones.set('');
      this.hayMasCotizaciones.set(!bandeja?.esPersonal && lista.length === TAMANO_PAGINA_VIAJES);
    } catch (error) {
      this.errorCotizaciones.set(error instanceof Error ? error.message : 'No fue posible cargar tus viajes.');
    } finally { this.cargandoCotizaciones.set(false); }
  }

  async cargarMasCotizaciones() {
    const actuales = this.cotizaciones(); const ultima = actuales.at(-1);
    if (this.cargandoMasCotizaciones() || !ultima) return;
    this.cargandoMasCotizaciones.set(true); this.errorMasCotizaciones.set('');
    try {
      const mas = await this.viajes.obtenerMios(ultima.id);
      await this.cargarEstadosReserva(mas);
      this.cotizaciones.set([...actuales, ...mas]);
      this.hayMasCotizaciones.set(mas.length === TAMANO_PAGINA_VIAJES);
    } catch (error) {
      this.errorMasCotizaciones.set(error instanceof Error ? error.message : 'No fue posible cargar más solicitudes.');
    } finally { this.cargandoMasCotizaciones.set(false); }
  }

  private async cargarEstadosReserva(lista: ViajeGuardado[]) {
    this.errorReserva.set('');
    try {
      const estados = await this.viajes.estadosReserva(lista.map(viaje => viaje.id));
      this.estadosReserva.update(actual => ({ ...actual, ...Object.fromEntries(estados.map(estado => [estado.id, estado])) }));
    } catch {
      this.errorReserva.set('No se pudo consultar el estado de confirmación de las reservas.');
    }
  }

  iniciarConfirmacion(id: string) {
    if (!this.esPersonal() || !this.estadosReserva()[id]?.puede_confirmar || this.confirmandoReserva()) return;
    this.errorReserva.set('');
    this.confirmarFolio.set(id);
  }

  async confirmarReserva() {
    const id = this.confirmarFolio();
    if (!id || !this.esPersonal() || !this.estadosReserva()[id]?.puede_confirmar || this.confirmandoReserva()) return;
    this.confirmandoReserva.set(true);
    this.errorReserva.set('');
    try {
      const fecha = await this.viajes.confirmarReserva(id);
      this.estadosReserva.update(estados => ({
        ...estados, [id]: { ...estados[id], id, confirmada_en: fecha, puede_confirmar: false },
      }));
      this.confirmarFolio.set(null);
    } catch (error) {
      this.errorReserva.set(error instanceof Error ? error.message : 'No se pudo verificar la confirmación.');
    } finally {
      this.confirmandoReserva.set(false);
    }
  }

  private async cargarDestinos() {
    const { data } = await this.supabase
      .from('destinos')
      .select('nombre, pais, imagen, precio_desde, categoria');

    if (data) {
      this.todosDestinos = data.map((d: any) => ({
        nombre: d.nombre,
        pais: d.pais ?? 'México',
        imagen: d.imagen ?? null,
        precioDesde: d.precio_desde,
        categoria: d.categoria,
      }));
    }

    // Una vez que tenemos los destinos, detectar ubicación
    this.detectarUbicacion();
  }

  detectarUbicacion() {
    if (!navigator.geolocation) {
      this.sugerirDestinosPorDefecto();
      return;
    }
    this.cargandoGeo.set(true);
    this.errorGeo.set(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await this.obtenerCiudad(latitude, longitude);
        this.cargandoGeo.set(false);
      },
      () => {
        // Fallback silencioso sin mostrar error rojo en emuladores o entornos sin GPS
        this.cargandoGeo.set(false);
        this.ciudadDetectada.set('México');
        this.sugerirDestinosPorDefecto();
      },
      { timeout: 5000, maximumAge: 300000 }
    );
  }

  private async obtenerCiudad(lat: number, lon: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`
      );
      const data = await res.json();
      const ciudad =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.state ||
        'tu ubicación';
      const pais = data.address?.country ?? null;
      this.ciudadDetectada.set(ciudad);
      this.paisDetectado.set(pais);
      this.sugerirDestinos(ciudad, pais);
    } catch {
      this.ciudadDetectada.set('tu ubicación');
      this.sugerirDestinosPorDefecto();
    }
  }

  private sugerirDestinos(ciudad: string, pais: string | null) {
    const ciudadLower = ciudad.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const paisLower = (pais ?? '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    // Querétaro → destinos del estado (categoría aventura, pais México)
    if (ciudadLower.includes('queretaro')) {
      const qro = ['Pinal de Amoles', 'Peñamiller', 'Amealco de Bonfil', 'Tolimán'];
      const sugeridos = this.todosDestinos.filter(d => qro.includes(d.nombre));
      this.destinosSugeridos.set(sugeridos.length ? sugeridos : this.todosDestinoPorDefecto());
      return;
    }

    // Mismo país → sugerir destinos de ese mismo país (viaje doméstico)
    if (paisLower) {
      const mismoP = this.todosDestinos.filter(d =>
        d.pais.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === paisLower
      );
      if (mismoP.length >= 2) {
        this.destinosSugeridos.set(mismoP.slice(0, 5));
        return;
      }
    }

    // País sin destinos en catálogo → mostrar los más populares (México)
    this.destinosSugeridos.set(this.todosDestinoPorDefecto());
  }

  private todosDestinoPorDefecto(): DestinoSugerido[] {
    const mexico = this.todosDestinos.filter(d => d.pais === 'México' && d.categoria === 'playa');
    return (mexico.length ? mexico : this.todosDestinos).slice(0, 4);
  }

  private sugerirDestinosPorDefecto() {
    this.destinosSugeridos.set(this.todosDestinoPorDefecto());
  }

  etiquetaEstado(estado: string): string {
    const map: Record<string, string> = {
      enviada: 'Pendiente de revisión',
      en_revision: 'En revisión',
      respondida: 'Respondida',
      agendada: 'Agendada',
      cerrada: 'Cerrada',
      pendiente: 'Pendiente de revisión',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
      en_proceso: 'En proceso',
    };
    return map[estado] ?? estado;
  }

  formatFecha(fecha: string): string {
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha + 'T12:00:00' : fecha).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatPrecio(precio: number): string {
    return precio.toLocaleString('es-MX');
  }

  irADestinos() {
    this.router.navigate(['/destinos']);
  }
}
