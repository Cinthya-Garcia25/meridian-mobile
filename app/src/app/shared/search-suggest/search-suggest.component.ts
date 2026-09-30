import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { coincideBusqueda, normalizarBusqueda } from '../../core/busqueda';

export interface SearchSuggestItem {
  /** Texto principal (ej. "Tokio, Japón"). */
  label: string;
  /** Texto secundario opcional (ej. nombre del paquete). */
  sublabel?: string;
  /** Valor que se coloca en el buscador al elegir la sugerencia. */
  query: string;
}

@Component({
  selector: 'app-search-suggest',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-suggest.component.html',
  styleUrl: './search-suggest.component.css',
})
export class SearchSuggestComponent {
  private readonly host = inject(ElementRef);

  readonly value = input('', { alias: 'value' });
  readonly items = input<SearchSuggestItem[]>([]);
  readonly placeholder = input('Buscar...');
  readonly buttonLabel = input('Buscar');
  readonly inputId = input('search-suggest-input');
  /** Si false, solo muestra input + lista (el botón lo pone el padre). */
  readonly showButton = input(true);

  readonly valueChange = output<string>();
  readonly search = output<string>();
  readonly pick = output<SearchSuggestItem>();

  readonly abiertas = signal(false);
  readonly activo = signal(-1);

  sugerenciasVisibles(): SearchSuggestItem[] {
    const q = normalizarBusqueda(this.value());
    if (q.length < 1) return [];
    return this.items()
      .filter(
        (it) =>
          coincideBusqueda(it.label, q) ||
          coincideBusqueda(it.query, q) ||
          (it.sublabel ? coincideBusqueda(it.sublabel, q) : false)
      )
      .slice(0, 6);
  }

  onInput(valor: string) {
    this.valueChange.emit(valor);
    this.activo.set(-1);
    this.abiertas.set(normalizarBusqueda(valor).length >= 1);
  }

  onFocus() {
    if (normalizarBusqueda(this.value()).length >= 1) {
      this.abiertas.set(true);
    }
  }

  elegir(item: SearchSuggestItem) {
    this.valueChange.emit(item.query);
    this.pick.emit(item);
    this.search.emit(item.query);
    this.abiertas.set(false);
    this.activo.set(-1);
  }

  confirmar() {
    const lista = this.sugerenciasVisibles();
    const idx = this.activo();
    if (idx >= 0 && lista[idx]) {
      this.elegir(lista[idx]);
      return;
    }
    this.search.emit(this.value());
    this.abiertas.set(false);
  }

  onKeydown(event: KeyboardEvent) {
    const lista = this.sugerenciasVisibles();
    if (!lista.length) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmar();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.abiertas.set(true);
      this.activo.set(Math.min(this.activo() + 1, lista.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activo.set(Math.max(this.activo() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmar();
    } else if (event.key === 'Escape') {
      this.abiertas.set(false);
      this.activo.set(-1);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.abiertas.set(false);
      this.activo.set(-1);
    }
  }
}
