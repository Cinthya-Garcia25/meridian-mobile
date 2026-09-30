import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ConsultaComponent } from './consulta.component';
import { URL_CONSULTA } from './consulta.config';

describe('ConsultaComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  function crear() {
    const fixture = TestBed.createComponent(ConsultaComponent);
    fixture.detectChanges();
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  async function presionarConsultar(fixture: ReturnType<typeof crear>['fixture'], html: HTMLElement) {
    html.querySelector('button')!.click();
    await fixture.whenStable();
  }

  it('RF01 y RF02: muestra el título y el botón CONSULTAR', () => {
    const { html } = crear();
    expect(html.querySelector('h2')?.textContent).toContain('Consulta de información');
    expect(html.querySelector('button')?.textContent).toContain('CONSULTAR');
  });

  it('Prueba 1: con conexión muestra "Consultando..." y luego la información', async () => {
    const { fixture, html } = crear();
    await presionarConsultar(fixture, html);

    const peticion = http.expectOne(URL_CONSULTA);
    expect(peticion.request.method).toBe('GET');
    expect(html.textContent).toContain('Consultando...');

    peticion.flush({ id: 1, title: 'Titulo de prueba', body: 'Contenido de prueba' });
    await fixture.whenStable();

    expect(html.textContent).not.toContain('Consultando...');
    expect(html.textContent).toContain('Titulo de prueba');
    expect(html.textContent).toContain('Contenido de prueba');
  });

  it('Prueba 2: sin conexión muestra el mensaje de error', async () => {
    const { fixture, html } = crear();
    await presionarConsultar(fixture, html);

    http.expectOne(URL_CONSULTA).error(new ProgressEvent('error'), { status: 0 });
    await fixture.whenStable();

    expect(html.textContent).not.toContain('Consultando...');
    expect(html.querySelector('.error')?.textContent).toContain('No fue posible obtener la información.');
  });

  it('Prueba 3: consulta la URL modificada', async () => {
    const { fixture, html } = crear();
    fixture.componentInstance.url = 'https://jsonplaceholder.typicode.com/users';
    await presionarConsultar(fixture, html);

    http.expectOne('https://jsonplaceholder.typicode.com/users').flush([{ name: 'Ana' }, { name: 'Luis' }]);
    await fixture.whenStable();

    expect(html.textContent).toContain('Se recibieron 2 registros');
    expect(html.textContent).toContain('Ana');
  });
});
