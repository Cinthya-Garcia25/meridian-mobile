/** Reintento controlado con espera progresiva (exponential backoff) y jitter. */
export interface OpcionesReintento {
  /** Intentos totales, incluido el primero. */
  maxIntentos: number;
  baseMs: number;
  topeMs: number;
  /** Solo se reintentan los fallos transitorios (red, timeout, 5xx); nunca los de sesión o validación. */
  esTransitorio: (error: unknown) => boolean;
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
  alReintentar?: (intentoFallido: number, esperaMs: number, error: unknown) => void;
}

/** Espera tras el intento fallido n: entre la mitad y el total de min(tope, base * 2^(n-1)) ("equal jitter"). */
export function esperaBackoff(intentoFallido: number, baseMs: number, topeMs: number, aleatorio: () => number = Math.random): number {
  const techo = Math.min(topeMs, baseMs * 2 ** (intentoFallido - 1));
  return Math.round(techo / 2 + aleatorio() * (techo / 2));
}

export async function conReintentos<T>(operacion: (intento: number) => Promise<T>, o: OpcionesReintento): Promise<T> {
  const esperar = o.esperar ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  for (let intento = 1; ; intento++) {
    try { return await operacion(intento); }
    catch (error) {
      if (intento >= o.maxIntentos || !o.esTransitorio(error)) throw error;
      const espera = esperaBackoff(intento, o.baseMs, o.topeMs, o.aleatorio);
      o.alReintentar?.(intento, espera, error);
      await esperar(espera);
    }
  }
}
