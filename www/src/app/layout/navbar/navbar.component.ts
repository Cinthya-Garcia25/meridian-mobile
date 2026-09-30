import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SupabaseService } from '../../supabase.service';

// Mismo navbar que la web (meridian-travel/frontend/src/app/shared/navbar) en su
// versión móvil: logo + botón de menú que despliega un panel. Solo lleva los
// enlaces de las pantallas que existen en la app.
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  private router = inject(Router);
  readonly auth = inject(SupabaseService);

  navScrolled = signal(false);
  menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll() {
    this.navScrolled.set(window.scrollY > 60);
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    this.closeMenu();
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
    this.syncBodyScroll();
  }

  closeMenu() {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.syncBodyScroll();
  }

  async cerrarSesion() {
    await this.auth.signOut();
    this.closeMenu();
    this.router.navigateByUrl('/');
  }

  private syncBodyScroll() {
    document.body.style.overflow = this.menuOpen() ? 'hidden' : '';
  }
}
