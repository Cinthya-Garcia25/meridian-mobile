import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { VolverArribaComponent } from '../shared/volver-arriba/volver-arriba.component';

// Mismo home que la web (meridian-travel/frontend/src/app/pages/home y
// shared/tarjetas-dom): carrusel de destinos, contadores y "Destinos Populares".

interface Slide {
  badge: string;
  titleWhite: string;
  titleTurquoise: string;
  subtitle: string;
  btnPrimary: string;
  btnSecondary: string;
  theme: string;
  image: string;
}

interface Stat {
  numericEnd: number;
  suffix: string;
  label: string;
  displayed: ReturnType<typeof signal<string>>;
}

interface Destino {
  nombre: string;
  pais: string;
  descripcion: string;
  descripcionLarga: string;
  imagen: string;
  etiqueta: string;
  temporada: string;
  precioDesde: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [VolverArribaComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(SupabaseService);

  activeSlide = signal(0);
  isTransitioning = signal(false);

  private carouselInterval: ReturnType<typeof setInterval> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  slides: Slide[] = [
    {
      badge: 'Los Cabos, México',
      titleWhite: 'El Lujo del',
      titleTurquoise: 'Pacífico Mexicano',
      subtitle: 'Mar de Cortés, acantilados dorados, resorts de clase mundial y atardeceres únicos en el mundo.',
      btnPrimary: 'Descubrir Los Cabos',
      btnSecondary: 'Ver paquetes',
      theme: 'cabos',
      image: 'images/cabos.jpg',
    },
    {
      badge: 'Hawaii, EE.UU.',
      titleWhite: 'El Paraíso',
      titleTurquoise: 'del Pacífico',
      subtitle: 'Volcanes, olas míticas, playas de arena negra y el espíritu Aloha en cada amanecer.',
      btnPrimary: 'Explorar Hawaii',
      btnSecondary: 'Ver itinerarios',
      theme: 'hawaii',
      image: 'images/hawaii.jpg',
    },
    {
      badge: 'Las Vegas, EE.UU.',
      titleWhite: 'La Ciudad que',
      titleTurquoise: 'Nunca Duerme',
      subtitle: 'Shows de talla mundial, casinos legendarios, gastronomía de lujo y entretenimiento sin límites.',
      btnPrimary: 'Ir a Las Vegas',
      btnSecondary: 'Ver paquetes',
      theme: 'vegas',
      image: 'images/vegas.jpg',
    },
  ];

  // displayed es signal() porque esta app corre sin zone.js: el conteo ocurre en
  // setInterval, que no actualiza la pantalla por sí solo.
  stats: Stat[] = [
    { numericEnd: 10000, suffix: 'K+', label: 'Viajeros felices', displayed: signal('0') },
    { numericEnd: 80, suffix: '+', label: 'Destinos', displayed: signal('0') },
    { numericEnd: 15, suffix: '', label: 'Años de experiencia', displayed: signal('0') },
    { numericEnd: 49, suffix: '', label: 'Estrellas promedio', displayed: signal('0') },
  ];

  destinos: Destino[] = [
    {
      nombre: 'Los Cabos',
      pais: 'México',
      descripcion: 'Acantilados dorados, mar de Cortés y resorts de lujo en Baja California.',
      descripcionLarga:
        'Los Cabos combina el desierto con el océano Pacífico: playas vírgenes, golf de clase mundial, avistamiento de ballenas y una gastronomía que fusiona mar y tierra.',
      imagen: 'images/cabos.jpg',
      etiqueta: 'Playa & Lujo',
      temporada: 'Nov – Abr',
      precioDesde: 23380,
    },
    {
      nombre: 'Hawái',
      pais: 'Estados Unidos',
      descripcion: 'Volcanes, playas de arena negra y el espíritu aloha del Pacífico.',
      descripcionLarga:
        'Las islas hawaianas ofrecen surf en Waikiki, el cráter del volcán Kilauea, selvas tropicales y atardeceres que pintan el cielo de naranja y púrpura.',
      imagen: 'images/hawaii.jpg',
      etiqueta: 'Isla Tropical',
      temporada: 'Abr – Oct',
      precioDesde: 34180,
    },
    {
      nombre: 'Las Vegas',
      pais: 'Estados Unidos',
      descripcion: 'Luces de neón, espectáculos y entretenimiento sin pausa en el desierto.',
      descripcionLarga:
        'La capital mundial del entretenimiento: casinos icónicos, shows de Cirque du Soleil, gastronomía de chefs estrella y excursiones al Gran Cañón a pocos minutos.',
      imagen: 'images/vegas.jpg',
      etiqueta: 'Ciudad & Diversión',
      temporada: 'Todo el año',
      precioDesde: 16180,
    },
  ];

  particles = Array.from({ length: 18 }, (_, i) => i);

  ngOnInit() {
    this.startCarousel();
    this.animateCounters();
  }

  ngOnDestroy() {
    if (this.carouselInterval) clearInterval(this.carouselInterval);
    this.timers.forEach((t) => clearTimeout(t));
  }

  private startCarousel() {
    this.carouselInterval = setInterval(() => {
      this.goToSlide((this.activeSlide() + 1) % this.slides.length);
    }, 5000);
  }

  goToSlide(index: number) {
    if (index === this.activeSlide()) return;
    this.isTransitioning.set(true);
    this.timers.push(
      setTimeout(() => {
        this.activeSlide.set(index);
        this.timers.push(setTimeout(() => this.isTransitioning.set(false), 50));
      }, 700)
    );
  }

  prevSlide() {
    this.reiniciarCarrusel((this.activeSlide() - 1 + this.slides.length) % this.slides.length);
  }

  nextSlide() {
    this.reiniciarCarrusel((this.activeSlide() + 1) % this.slides.length);
  }

  private reiniciarCarrusel(index: number) {
    if (this.carouselInterval) clearInterval(this.carouselInterval);
    this.goToSlide(index);
    this.startCarousel();
  }

  private animateCounters() {
    this.stats.forEach((stat, i) => {
      let current = 0;
      const duration = 2000;
      const steps = 60;
      const increment = stat.numericEnd / steps;
      this.timers.push(
        setTimeout(() => {
          const timer = setInterval(() => {
            current = Math.min(current + increment, stat.numericEnd);
            if (i === 0) {
              stat.displayed.set(Math.floor(current / 1000) + (current >= 10000 ? 'K+' : ''));
            } else if (i === 3) {
              stat.displayed.set((current / 10).toFixed(1));
            } else {
              stat.displayed.set(Math.floor(current) + stat.suffix);
            }
            if (current >= stat.numericEnd) clearInterval(timer);
          }, duration / steps);
        }, i * 200)
      );
    });
  }

  // En la web los botones del carrusel no llevan a ninguna página todavía (href="#");
  // en la app bajan a la sección de destinos.
  verDestinos() {
    document.getElementById('destinos')?.scrollIntoView({ behavior: 'smooth' });
  }

  verMas(destino: Destino) {
    alert(`${destino.nombre}\n\n${destino.descripcionLarga}`);
  }

  // Igual que la web: agendar requiere sesión. La app todavía no tiene la pantalla
  // de cotizar, así que con sesión solo se avisa.
  agendar(destino: Destino) {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    alert(`La cotización de ${destino.nombre} desde la app estará disponible próximamente.`);
  }
}
