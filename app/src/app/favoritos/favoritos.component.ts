import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritosService } from '../favoritos.service';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './favoritos.component.html',
  styleUrls: ['./favoritos.component.css']
})
export class FavoritosComponent implements OnInit {
  readonly auth = inject(SupabaseService);
  readonly favoritos = inject(FavoritosService);

  ngOnInit() {
    void this.favoritos.cargar();
  }

  formatPrecio(precio: number): string { return precio.toLocaleString('es-MX'); }
  fondo(imagen: string | null): string | null { return imagen ? `url(${imagen})` : null; }
}
