"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { buscarProductos } from "@/lib/api";
import { formatearMoneda } from "@/lib/money";
import type { Producto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BuscadorProductos() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Búsqueda "mientras escribes": se dispara con cada cambio del término para
  // que los resultados se sientan instantáneos.
  useEffect(() => {
    if (!termino) {
      setResultados([]);
      setBuscado(false);
      return;
    }
    setCargando(true);
    buscarProductos(termino).then((productos) => {
      setResultados(productos);
      setBuscado(true);
      setCargando(false);
    });
  }, [termino]);

  async function ejecutarBusqueda() {
    setCargando(true);
    const productos = await buscarProductos(termino);
    setResultados(productos);
    setBuscado(true);
    setCargando(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscador de catálogo</CardTitle>
        <CardDescription>
          Busca productos por nombre, igual que el catálogo público de la tienda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Input
            placeholder="Ej. mouse, teclado, monitor…"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ejecutarBusqueda();
            }}
          />
          <Button onClick={ejecutarBusqueda} disabled={cargando}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {buscado && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Resultados para <span className="font-medium text-foreground">{termino}</span> — {resultados.length} producto(s).
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {resultados.map((p) => (
                <div
                  key={p.Id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{p.Nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatearMoneda(p.Precio)}
                    </p>
                  </div>
                  <Badge variant={p.Stock > 0 ? "success" : "warning"}>
                    {p.Stock} en stock
                  </Badge>
                </div>
              ))}
            </div>

            {resultados.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No se encontraron productos.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
