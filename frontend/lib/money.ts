// Utilidades de dinero para el panel de soporte.
//
// Finanzas pidió que el panel muestre un "resumen estimado" del pedido ANTES
// de enviarlo, para que el agente de soporte confirme el monto con el cliente.
// La tasa de impuesto debe coincidir con la del backend (IVA 13%).

export const TASA_IMPUESTO = 0.13;

export interface LineaResumen {
  precioUnitario: number;
  cantidad: number;
}

// Normaliza los montos a centavos para evitar artefactos de coma flotante.
export function redondearMoneda(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}

// Calcula el subtotal del pedido sumando línea por línea.
export function calcularSubtotal(lineas: LineaResumen[]): number {
  let subtotal = 0;
  for (const l of lineas) {
    subtotal = redondearMoneda(subtotal + redondearMoneda(l.precioUnitario * l.cantidad));
  }
  return redondearMoneda(subtotal);
}

// Calcula el total estimado a cobrar.
// porcentajeCupon llega como número 0..100 (ej. 10 para 10%).
export function calcularTotalEstimado(
  lineas: LineaResumen[],
  porcentajeCupon: number
): number {
  const subtotal = calcularSubtotal(lineas);
  const descuento = redondearMoneda(subtotal * (porcentajeCupon / 100));
  const baseImponible = redondearMoneda(subtotal - descuento);
  const impuesto = redondearMoneda(baseImponible * TASA_IMPUESTO);
  return redondearMoneda(baseImponible + impuesto);
}

// Formatea un monto para mostrarlo en la interfaz.
export function formatearMoneda(monto: number): string {
  return "$" + redondearMoneda(monto).toFixed(2);
}
