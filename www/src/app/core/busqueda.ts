/** Quita acentos y pasa a minúsculas para comparar "tokio" con "Tokio", etc. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function coincideBusqueda(texto: string, queryNormalizada: string): boolean {
  if (!queryNormalizada) return true;
  return normalizarBusqueda(texto).includes(queryNormalizada);
}
