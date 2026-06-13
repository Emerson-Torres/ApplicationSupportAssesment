import type { CrearPedidoDto, FilaReporte, Pedido, Producto } from "./types";

// URL base de la API MercadoVerde.
// Configurable por entorno (NEXT_PUBLIC_API_BASE en .env.local); por defecto
// la API de .NET levanta en http://localhost:5080/swagger (ver README de la raíz).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5080";

// Cliente HTTP del panel de soporte.
// Centraliza las llamadas a la API para el catálogo, los pedidos y los reportes.

async function leerErrorRespuesta(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.title || data?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function buscarProductos(termino: string): Promise<Producto[]> {
  const res = await fetch(`${API_BASE}/api/productos/buscar?termino=${termino}`);
  if (!res.ok) {
    throw new Error(await leerErrorRespuesta(res));
  }

  const data = await res.json();
  return data as Producto[];
}

export async function crearPedido(dto: CrearPedidoDto): Promise<Pedido> {
  const res = await fetch(`${API_BASE}/api/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw new Error(await leerErrorRespuesta(res));
  }

  return (await res.json()) as Pedido;
}

export async function obtenerReporteVentas(
  desde: string,
  hasta: string
): Promise<FilaReporte[]> {
  const res = await fetch(
    `${API_BASE}/api/reportes/ventas?desde=${desde}&hasta=${hasta}`
  );

  if (!res.ok) {
    throw new Error(await leerErrorRespuesta(res));
  }

  const data = await res.json();
  return data as FilaReporte[];
}
