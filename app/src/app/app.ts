import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { FooterComponent } from './layout/footer/footer.component';

@Component({
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Las rutas con data.hideChrome (login) se muestran sin navbar ni footer, como en la web.
  protected readonly ocultarChrome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        return !!r.snapshot.data['hideChrome'];
      })
    ),
    { initialValue: true }
  );
}
