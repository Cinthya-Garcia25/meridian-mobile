import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClimaService } from './clima.service';

describe('ClimaService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('usa la ubicación del destino y presenta temperaturas y fechas locales', async () => {
    const clima = firstValueFrom(TestBed.inject(ClimaService).consultar('Cancún', 'México'));
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(req => req.url.endsWith('/search') && req.params.get('name') === 'Cancún, México').flush({
      results: [
        { name: 'Cancún', country: 'España', latitude: 42, longitude: -3 },
        { name: 'Cancún', country: 'México', latitude: 21.17, longitude: -86.85 },
      ],
    });
    http.expectOne(req => req.url.endsWith('/forecast') && req.params.get('latitude') === '21.17' &&
      req.params.get('timezone') === 'auto' && req.params.get('forecast_days') === '7').flush({
      current: { temperature_2m: 28 },
      daily: { time: ['2026-11-15', '2026-11-16'], temperature_2m_min: [22, null], temperature_2m_max: [30, null] },
    });
    expect(await clima).toEqual({
      ubicacion: 'Cancún',
      temperatura: 28,
      dias: [{ fecha: '2026-11-15', minima: 22, maxima: 30 }],
    });
  });

  it('evita mostrar el clima de otro país cuando no encuentra el destino', async () => {
    const clima = firstValueFrom(TestBed.inject(ClimaService).consultar('León', 'México'));
    TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/search')).flush({
      results: [{ name: 'León', country: 'España', latitude: 42.6, longitude: -5.57 }],
    });
    await expect(clima).rejects.toThrow('Ubicación no disponible');
  });
});
