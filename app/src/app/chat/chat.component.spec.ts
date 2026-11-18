import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase.service';
import { ChatComponent } from './chat.component';
import { ChatError, ChatService, SalaChat } from './chat.service';

const sala: SalaChat = { viajeId: '101', destino: 'Cancún', usuarioId: 'viajero', rolPropio: 'viajero', nombrePropio: 'Viajero', viajeroNombre: 'Viajero', asesorNombre: 'Asesor', mensajes: [], contadorViajero: 0, contadorAsesor: 0 };
describe('Envío del chat', () => {
  let componente: ChatComponent;
  let enviar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    enviar = vi.fn().mockResolvedValue('ok');
    TestBed.configureTestingModule({ providers: [
      { provide: ChatService, useValue: { enviar } },
      { provide: SupabaseService, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '101' }) } } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ] });
    componente = TestBed.runInInjectionContext(() => new ChatComponent());
    componente.sala.set(sala);
    vi.spyOn(componente, 'refrescar').mockResolvedValue();
    vi.stubGlobal('requestAnimationFrame', () => 0);
  });
  afterEach(() => { componente.ngOnDestroy(); vi.unstubAllGlobals(); TestBed.resetTestingModule(); });
  it('rechaza mensajes vacíos o con solo espacios sin enviarlos', async () => {
    componente.texto = '  \n\t'; await componente.enviar();
    expect(enviar).not.toHaveBeenCalled();
    expect(componente.error()).toContain('1 a 1000');
  });
  it('rechaza mensajes que exceden el límite', async () => {
    componente.texto = 'a'.repeat(1001); await componente.enviar();
    expect(enviar).not.toHaveBeenCalled();
  });
  it('impide duplicar el envío por una segunda pulsación', async () => {
    let resolver!: (id: string) => void;
    enviar.mockImplementation(() => new Promise<string>(resolve => { resolver = resolve; }));
    componente.texto = 'Hola'; const primero = componente.enviar(); await componente.enviar();
    expect(enviar).toHaveBeenCalledTimes(1); resolver('ok'); await primero;
    expect(componente.texto).toBe(''); expect(componente.aviso()).toContain('enviado');
  });
  it('quita el éxito anterior si el siguiente envío no tiene conexión', async () => {
    componente.aviso.set('Mensaje enviado correctamente.');
    componente.texto = 'Mensaje que sigue pendiente';
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await componente.enviar();
    expect(enviar).not.toHaveBeenCalled();
    expect(componente.aviso()).toBe('');
    expect(componente.error()).toContain('No hay conexión');
    expect(componente.texto).toBe('Mensaje que sigue pendiente');
    vi.restoreAllMocks();
  });
  it('conserva texto e identificador al reintentar un resultado incierto', async () => {
    enviar.mockRejectedValueOnce(new ChatError('Resultado incierto', true));
    componente.texto = 'Mensaje de prueba'; await componente.enviar();
    const identificador = enviar.mock.calls[0][1];
    expect(componente.incierto()).toBe(true); expect(componente.texto).toBe('Mensaje de prueba');
    await componente.enviar();
    expect(enviar.mock.calls[1]).toEqual(['101', identificador, 'Mensaje de prueba']);
    expect(componente.incierto()).toBe(false); expect(componente.texto).toBe('');
  });
});
