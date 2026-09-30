import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ConsultaComponent } from './consulta/consulta.component';
import { DestinosComponent } from './destinos/destinos.component';

// Igual que la web: el home es la pantalla principal y no requiere sesión.
// hideChrome oculta el navbar y el footer (ver app.ts).
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'destinos', component: DestinosComponent },
  { path: 'login', component: LoginComponent, data: { hideChrome: true } },
  { path: 'consulta', component: ConsultaComponent, data: { hideChrome: true } },
  { path: '**', redirectTo: '' },
];
