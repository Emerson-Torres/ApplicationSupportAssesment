"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { crearPedido } from "@/lib/api";
import { calcularTotalEstimado, formatearMoneda, redondearMoneda } from "@/lib/money";
import type { Pedido } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LineaForm {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
}

// Precios de referencia del catálogo sembrado (ver SeedData).
const CATALOGO: Record<number, { nombre: string; precio: number }> = {
  1: { nombre: "Audífonos Bluetooth", precio: 25.0 },
  2: { nombre: "Teclado Mecánico", precio: 49.9 },
  3: { nombre: "Mouse Inalámbrico", precio: 15.5 },
  4: { nombre: 'Monitor 24"', precio: 180.0 },
};

export function CrearPedidoForm() {
  const [clienteId, setClienteId] = useState("1");
  const [codigoCupon, setCodigoCupon] = useState("");
  const [porcentajeCupon, setPorcentajeCupon] = useState("0");
  const [lineas, setLineas] = useState<LineaForm[]>([
    { productoId: 2, cantidad: 1, precioUnitario: 49.9 },
  ]);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function agregarLinea() {
    setLineas([...lineas, { productoId: 1, cantidad: 1, precioUnitario: 25.0 }]);
  }

  function eliminarLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index));
  }

  function actualizarLinea(index: number, productoId: number, cantidad: number) {
    const copia = [...lineas];
    copia[index] = {
      productoId,
      cantidad,
      precioUnitario: CATALOGO[productoId]?.precio ?? 0,
    };
    setLineas(copia);
  }

  function hayCantidadesInvalidas() {
    return lineas.some((linea) => !Number.isFinite(linea.cantidad) || linea.cantidad <= 0);
  }

  const totalEstimado = calcularTotalEstimado(
    lineas,
    Number(porcentajeCupon)
  );

  async function enviar() {
    if (enviando) return;

    if (hayCantidadesInvalidas()) {
      setError("Cada línea del pedido debe tener una cantidad mayor a 0.");
      return;
    }

    setError(null);
    setEnviando(true);
    try {
      const creado = await crearPedido({
        ClienteId: Number(clienteId),
        CodigoCupon: codigoCupon || null,
        Lineas: lineas.map((l) => ({
          ProductoId: l.productoId,
          Cantidad: l.cantidad,
        })),
      });
      setPedido(creado);
    } catch (err: unknown) {
      setPedido(null);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Crear pedido</CardTitle>
          <CardDescription>
            Registra un pedido a nombre de un cliente. Cobra y descuenta stock
            igual que el flujo real de la tienda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              No se pudo crear el pedido: {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clienteId">Cliente (ID)</Label>
              <Input
                id="clienteId"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cupon">Código de cupón (opcional)</Label>
              <Input
                id="cupon"
                placeholder="Ej. BIENVENIDA10"
                value={codigoCupon}
                onChange={(e) => setCodigoCupon(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Líneas del pedido</Label>
              <Button variant="outline" size="sm" onClick={agregarLinea}>
                <Plus className="mr-1 h-4 w-4" /> Agregar línea
              </Button>
            </div>

            {lineas.map((linea, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">Producto</span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={linea.productoId}
                    onChange={(e) =>
                      actualizarLinea(
                        index,
                        Number(e.target.value),
                        linea.cantidad
                      )
                    }
                  >
                    {Object.entries(CATALOGO).map(([id, info]) => (
                      <option key={id} value={id}>
                        {info.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24 space-y-1">
                  <span className="text-xs text-muted-foreground">Cantidad</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={linea.cantidad}
                    onChange={(e) =>
                      actualizarLinea(
                        index,
                        linea.productoId,
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="w-28 pb-2 text-right text-sm">
                  {formatearMoneda(
                    redondearMoneda(linea.precioUnitario * linea.cantidad)
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => eliminarLinea(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="porcentaje">
                % de descuento del cupón (para estimar)
              </Label>
              <Input
                id="porcentaje"
                type="number"
                value={porcentajeCupon}
                onChange={(e) => setPorcentajeCupon(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={enviar} disabled={enviando || hayCantidadesInvalidas()} type="button">
            {enviando ? "Procesando..." : "Confirmar y cobrar pedido"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estimado del panel</CardTitle>
            <CardDescription>
              Cálculo local para confirmar el monto con el cliente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total estimado</span>
              <span>{formatearMoneda(totalEstimado)}</span>
            </div>
          </CardContent>
        </Card>

        {pedido && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pedido #{pedido.Id}</CardTitle>
              <CardDescription>Respuesta de la API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatearMoneda(pedido.Subtotal)} />
              <Row label="Descuento" value={formatearMoneda(pedido.Descuento)} />
              <Row label="Impuesto" value={formatearMoneda(pedido.Impuesto)} />
              <Separator />
              <Row
                label="Total cobrado"
                value={formatearMoneda(pedido.Total)}
                bold
              />
              <div className="pt-2">
                <Badge
                  variant={
                    pedido.Estado === "Pagado" || pedido.Estado === 1
                      ? "success"
                      : "warning"
                  }
                >
                  {String(pedido.Estado)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "font-semibold" : ""
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
