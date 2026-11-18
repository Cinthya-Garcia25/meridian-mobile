import { Routes } from '@angular/router';
import { ReservaComponent } from './reserva/reserva.component';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ConsultaComponent } from './consulta/consulta.component';
import { DestinosComponent } from './destinos/destinos.component';
import { FavoritosComponent } from './favoritos/favoritos.component';

// Igual que la web: el home es la pantalla principal y no requiere sesión.
// hideChrome oculta el navbar y el footer (ver app.ts).
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'destinos', component: DestinosComponent },
  { path: 'login', component: LoginComponent, data: { hideChrome: true } },
  { path: 'mis-viajes', component: ConsultaComponent },
  { path: 'favoritos', component: FavoritosComponent },
  { path: 'reservar', component: ReservaComponent },
  { path: 'acompanantes', redirectTo: 'destinos', pathMatch: 'full' },
  { path: 'chat/:id', loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent), data: { hideChrome: true } },
  { path: '**', redirectTo: '' },
];
