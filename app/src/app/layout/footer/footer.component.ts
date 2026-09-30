import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Mismo footer que la web (meridian-travel/frontend/src/app/shared/footer), sin la
// columna de navegación ni los enlaces legales: esas páginas no existen en la app.
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  year = new Date().getFullYear();
}
