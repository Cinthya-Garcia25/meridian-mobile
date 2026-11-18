import { describe, expect, it, vi } from 'vitest';
import { conReintentos } from '../core/reintento';
import { datosInicialesValidos } from './reserva-validacion';

describe('Validación de cotizaciones', () => {
  const hoy = '2027-01-10';
  const datos = { destino: 'Cancún', origen: 'Querétaro', nombre: 'Ana', salida: hoy, regreso: '2027-01-17' };

  it('acepta una salida el mismo día', () => {
    expect(datosInicialesValidos(datos, hoy)).toBe(true);
  });

  it('rechaza un destino vacío o en blanco', () => {
    expect(datosInicialesValidos({ ...datos, destino: '' }, hoy)).toBe(false);
    expect(datosInicialesValidos({ ...datos, destino: '   ' }, hoy)).toBe(false);
  });

  it('rechaza una salida anterior al día actual', () => {
    expect(datosInicialesValidos({ ...datos, salida: '2027-01-09' }, hoy)).toBe(false);
  });

  it('rechaza el regreso anterior a la salida', () => {
    expect(datosInicialesValidos({ ...datos, regreso: '2027-01-09' }, hoy)).toBe(false);
  });

  it('acepta una cotización sin fecha de regreso', () => {
    expect(datosInicialesValidos({ ...datos, regreso: '' }, hoy)).toBe(true);
  });
});

describe('Resultado de un reintento de cotización', () => {
  const error = new Error('Se perdió la respuesta');
  const opciones = {
    maxIntentos: 2,
    baseMs: 1000,
    topeMs: 1000,
    esTransitorio: (causa: unknown) => causa === error,
    esperar: async () => {},
  };

  it('devuelve el identificador tras recuperarse de una excepción transitoria', async () => {
    const enviar = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('42');
    await expect(conReintentos(enviar, opciones)).resolves.toBe('42');
    expect(enviar.mock.calls).toEqual([[1], [2]]);
  });

  it('propaga la excepción original cuando agota los intentos', async () => {
    const enviar = vi.fn().mockRejectedValue(error);
    await expect(conReintentos(enviar, opciones)).rejects.toBe(error);
    expect(enviar).toHaveBeenCalledTimes(2);
  });
});
