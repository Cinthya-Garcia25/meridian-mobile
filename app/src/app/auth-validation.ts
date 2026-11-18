// Reglas compartidas por la interfaz y el servicio. No normalizar contraseñas.
export const LIMITE_CORREO = 254;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export function credencialesValidas(email: string, password: string): boolean {
  return email.length <= LIMITE_CORREO && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    && password.trim().length > 0 && password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}
