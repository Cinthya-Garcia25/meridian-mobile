import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { coincideBusqueda, normalizarBusqueda } from '../core/busqueda';
import { SupabaseService } from '../supabase.service';
import { FavoritosService } from '../favoritos.service';
import { ClimaComponent } from './clima/clima.component';
import { CatalogoService, Destino } from './catalogo.service';
import { SearchSuggestComponent, SearchSuggestItem } from '../shared/search-suggest/search-suggest.component';
import { VolverArribaComponent } from '../shared/volver-arriba/volver-arriba.component';

// Misma página de Destinos que la web (meridian-travel/frontend/src/app/pages/destinos).
@Component({
  selector: 'app-destinos',
  standalone: true,
  imports: [ClimaComponent, DecimalPipe, SearchSuggestComponent, VolverArribaComponent],
  templateUrl: './destinos.component.html',
  styleUrls: ['./destinos.component.css']
})
export class DestinosComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(SupabaseService);
  readonly favoritos = inject(FavoritosService);
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
  // Cordova deriva los enlaces HTTPS externos a Android mediante allow-intent.
  // En el navegador abrimos otra pestaña para conservar el catálogo.
  readonly destinoMapaTarget = 'cordova' in window ? '_self' : '_blank';

  ubicacionUrl(destino: Destino): string {
    const lugar = [destino.nombre.trim(), destino.pais?.trim()].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`;
  }

  filtros = [
    { key: 'todos',     label: 'Todos'     },
    { key: 'playa',     label: 'Playa'     },
    { key: 'montaña',   label: 'Montaña'   },
    { key: 'ciudad',    label: 'Ciudad'    },
    { key: 'aventura',  label: 'Aventura'  },
    { key: 'favoritos', label: 'Favoritos' },
  ];

  readonly cargando = signal(true);
  readonly todosLosDestinos = signal<Destino[]>([]);
  readonly destinoDestacado = computed<Destino | null>(
    () => this.todosLosDestinos().find((d) => d.destacado) ?? this.todosLosDestinos()[0] ?? null
  );
  readonly destinosFiltrados = computed<Destino[]>(() => {
    this.favoritos.ids();
    const f = this.filtroActivo();
    let lista: Destino[];
    if (f === 'todos') {
      lista = this.todosLosDestinos();
    } else if (f === 'favoritos') {
      lista = this.todosLosDestinos().filter((d) => this.favoritos.esFavorito(d.id));
    } else {
      lista = this.todosLosDestinos().filter((d) => d.categoria === f);
    }
    return this.buscar(lista);
  });

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
    void this.favoritos.cargar();
  }

  private aplicarQueryParams(params: ParamMap): void {
    const q = params.get('q');
    const categoria = params.get('categoria');
    if (q) this.searchQuery.set(q);
    if (categoria && this.filtros.some((f) => f.key === categoria)) {
      if (categoria === 'favoritos' && !this.favoritos.usuario()) {
        this.router.navigate(['/login']);
        return;
      }
      this.filtroActivo.set(categoria);
    }
    if (categoria) {
      setTimeout(() => document.querySelector('.filtros-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  estrellas(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  aplicarFiltro(filtro: string) {
    if (filtro === 'favoritos' && !this.favoritos.usuario()) {
      this.router.navigate(['/login']);
      return;
    }
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
    const f = this.filtroActivo();
    if (f === 'todos') return this.todosLosDestinos();
    if (f === 'favoritos') return this.todosLosDestinos().filter((d) => this.favoritos.esFavorito(d.id));
    return this.todosLosDestinos().filter((d) => d.categoria === f);
  }

  private refrescarLista(scrollAResultados: boolean) {
    this.cardsAnimadas.set(false);
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

  // Inicia una solicitud de cotización para el destino elegido.
  agendarDestino(destino: Destino, event?: Event) {
    event?.stopPropagation();
    if (this.modalVisible()) this.cerrarModal();
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { destinoReserva: destino.nombre } });
      return;
    }
    this.router.navigate(['/reservar'], { queryParams: { destino: destino.nombre } });
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

  esFavorito(id: number): boolean {
    return this.favoritos.esFavorito(id);
  }

  toggleFavorito(destino: Destino, event?: Event) {
    event?.stopPropagation();
    if (!this.favoritos.usuario()) {
      this.router.navigate(['/login']);
      return;
    }
    this.favoritos.toggle(destino);
  }
}
