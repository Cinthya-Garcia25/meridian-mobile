import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// El contacto se consulta desde Inicio; el footer conserva la marca y la navegación.
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
