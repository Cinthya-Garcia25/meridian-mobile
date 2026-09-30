import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { coincideBusqueda, normalizarBusqueda } from '../core/busqueda';
import { SupabaseService } from '../supabase.service';
import { CatalogoService, Destino } from './catalogo.service';
import { SearchSuggestComponent, SearchSuggestItem } from '../shared/search-suggest/search-suggest.component';
import { VolverArribaComponent } from '../shared/volver-arriba/volver-arriba.component';

// Misma página de Destinos que la web (meridian-travel/frontend/src/app/pages/destinos).
@Component({
  selector: 'app-destinos',
  standalone: true,
  imports: [DecimalPipe, SearchSuggestComponent, VolverArribaComponent],
  templateUrl: './destinos.component.html',
  styleUrls: ['./destinos.component.css']
})
export class DestinosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(SupabaseService);
  private destroyRef = inject(DestroyRef);
  private catalogoService = inject(CatalogoService);

  // Todo con signal(): esta app corre sin zone.js y varios cambios ocurren en
  // setTimeout o al llegar la respuesta HTTP.
  readonly searchQuery = signal('');
  readonly filtroActivo = signal('todos');
  readonly destinoSeleccionado = signal<Destino | null>(null);
  readonly modalVisible = signal(false);
  readonly modalAnimando = signal(false);
  readonly cardsAnimadas = signal(false);

  filtros = [
    { key: 'todos',    label: 'Todos'    },
    { key: 'playa',    label: 'Playa'    },
    { key: 'montaña',  label: 'Montaña'  },
    { key: 'ciudad',   label: 'Ciudad'   },
    { key: 'aventura', label: 'Aventura' },
  ];

  readonly cargando = signal(true);
  readonly todosLosDestinos = signal<Destino[]>([]);
  readonly destinoDestacado = computed<Destino | null>(
    () => this.todosLosDestinos().find((d) => d.destacado) ?? this.todosLosDestinos()[0] ?? null
  );
  readonly destinosFiltrados = signal<Destino[]>([]);

  readonly sugerenciasBusqueda = computed<SearchSuggestItem[]>(() =>
    this.todosLosDestinos().map((d) => ({ label: d.nombre, sublabel: d.pais ?? undefined, query: d.nombre }))
  );

  private queryParamsPendientes: ParamMap | null = null;

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (this.cargando()) {
        this.queryParamsPendientes = params;
      } else {
        this.aplicarQueryParams(params);
      }
    });

    this.catalogoService.destinos().subscribe((lista) => {
      this.todosLosDestinos.set(lista);
      this.cargando.set(false);
      this.aplicarQueryParams(this.queryParamsPendientes ?? this.route.snapshot.queryParamMap);
    });

    setTimeout(() => this.cardsAnimadas.set(true), 100);
  }

  private aplicarQueryParams(params: ParamMap): void {
    const q = params.get('q');
    const categoria = params.get('categoria');
    if (q) this.searchQuery.set(q);
    if (categoria && this.filtros.some((f) => f.key === categoria)) {
      this.filtroActivo.set(categoria);
    }
    this.destinosFiltrados.set(this.buscar(this.porCategoria()));
    if (categoria) {
      setTimeout(() => document.querySelector('.filtros-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  estrellas(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  aplicarFiltro(filtro: string) {
    this.filtroActivo.set(filtro);
    this.refrescarLista(true);
  }

  verTodos() {
    this.searchQuery.set('');
    this.aplicarFiltro('todos');
  }

  onSearchQuery(valor: string) {
    this.searchQuery.set(valor);
    this.refrescarLista(false);
  }

  onSearch(valor?: string) {
    if (typeof valor === 'string') this.searchQuery.set(valor);
    this.refrescarLista(true);
  }

  private porCategoria(): Destino[] {
    return this.filtroActivo() === 'todos'
      ? this.todosLosDestinos()
      : this.todosLosDestinos().filter((d) => d.categoria === this.filtroActivo());
  }

  private refrescarLista(scrollAResultados: boolean) {
    this.cardsAnimadas.set(false);
    this.destinosFiltrados.set(this.buscar(this.porCategoria()));
    queueMicrotask(() => this.cardsAnimadas.set(true));
    if (scrollAResultados && this.searchQuery().trim()) {
      queueMicrotask(() =>
        document.querySelector('.grid-seccion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  }

  private buscar(lista: Destino[]): Destino[] {
    const q = normalizarBusqueda(this.searchQuery());
    if (!q) return [...lista];
    return lista.filter(
      (d) =>
        coincideBusqueda(d.nombre, q) ||
        coincideBusqueda(d.pais ?? '', q) ||
        coincideBusqueda(d.descripcion ?? '', q) ||
        coincideBusqueda(d.categoria, q)
    );
  }

  abrirModal(destino: Destino) {
    this.destinoSeleccionado.set(destino);
    this.modalVisible.set(true);
    // Un frame después para que se vea la animación de entrada.
    requestAnimationFrame(() => this.modalAnimando.set(true));
    document.body.style.overflow = 'hidden';
  }

  cerrarModal() {
    this.modalAnimando.set(false);
    setTimeout(() => {
      this.modalVisible.set(false);
      this.destinoSeleccionado.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  // Igual que la web: agendar requiere sesión. La app todavía no tiene la pantalla
  // de cotizar, así que con sesión solo se avisa.
  agendarDestino(destino: Destino, event?: Event) {
    event?.stopPropagation();
    if (this.modalVisible()) this.cerrarModal();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    alert(`La cotización de ${destino.nombre} desde la app estará disponible próximamente.`);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.modalVisible()) this.cerrarModal();
  }

  getCardDelay(i: number): string {
    return `${i * 100}ms`;
  }

  formatPrecio(precio: number): string {
    return precio.toLocaleString('es-MX');
  }

  fondo(imagen: string | null): string | null {
    return imagen ? `url(${imagen})` : null;
  }
}
