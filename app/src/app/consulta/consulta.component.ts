import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { URL_CONSULTA } from './consulta.config';

interface Campo {
  nombre: string;
  valor: string;
}

@Component({
  selector: 'app-consulta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './consulta.component.html',
  styleUrls: ['./consulta.component.css']
})
export class ConsultaComponent {
  private http = inject(HttpClient);

  url = URL_CONSULTA;
  cargando = signal(false);
  error = signal('');
  campos = signal<Campo[]>([]);
  total = signal(0);

  consultar() {
    this.cargando.set(true);
    this.error.set('');
    this.campos.set([]);

    this.http.get<unknown>(this.url).subscribe({
      next: (respuesta) => {
        this.procesar(respuesta);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No fue posible obtener la información.');
        this.cargando.set(false);
      }
    });
  }

  // Convierte la respuesta JSON en una lista de campos para mostrarla en pantalla.
  // Si la respuesta es una lista, muestra el primer registro y el total.
  private procesar(respuesta: unknown) {
    const lista = Array.isArray(respuesta) ? respuesta : [respuesta];
    this.total.set(lista.length);

    const registro = lista[0];
    if (registro === null || typeof registro !== 'object') {
      this.campos.set([{ nombre: 'respuesta', valor: String(registro ?? '') }]);
      return;
    }

    this.campos.set(
      Object.entries(registro).map(([nombre, valor]) => ({
        nombre,
        valor: typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
      }))
    );
  }
}
