import { describe, it, expect, vi } from 'vitest';
import { conReintentos, esperaBackoff } from './reintento';

describe('Espera progresiva (exponential backoff)', () => {
  it('duplica el techo en cada intento y respeta el tope', () => {
    const techo = (n: number) => esperaBackoff(n, 1000, 8000, () => 1);
    expect([1, 2, 3, 4, 5].map(techo)).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
  it('el jitter mantiene la espera entre la mitad y el total del techo', () => {
    expect(esperaBackoff(3, 1000, 8000, () => 0)).toBe(2000);
    expect(esperaBackoff(3, 1000, 8000, () => 1)).toBe(4000);
  });
  it('reintenta solo fallos transitorios y se detiene en el máximo de intentos', async () => {
    const op = vi.fn().mockRejectedValue(new Error('red')); const esperar = vi.fn().mockResolvedValue(undefined);
    await expect(conReintentos(op, { maxIntentos: 3, baseMs: 10, topeMs: 100, esTransitorio: () => true, esperar, aleatorio: () => 1 })).rejects.toThrow('red');
    expect(op).toHaveBeenCalledTimes(3); expect(esperar.mock.calls.map(c => c[0])).toEqual([10, 20]);
  });
  it('no reintenta un fallo permanente', async () => {
    const op = vi.fn().mockRejectedValue(new Error('permiso')); const esperar = vi.fn();
    await expect(conReintentos(op, { maxIntentos: 3, baseMs: 10, topeMs: 100, esTransitorio: () => false, esperar })).rejects.toThrow('permiso');
    expect(op).toHaveBeenCalledTimes(1); expect(esperar).not.toHaveBeenCalled();
  });
});
