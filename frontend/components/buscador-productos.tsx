"use client";

import { useEffect, useRef, useState } from "react";
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

function stockBadgeVariant(stock: number) {
  if (stock <= 2) return "warning";
  return "success";
}

function stockBadgeLabel(stock: number) {
  if (stock <= 0) return "Sin stock";
  if (stock <= 2) return "Stock bajo";
  return "En stock";
}

export function BuscadorProductos() {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Búsqueda "mientras escribes": se dispara con cada cambio del término para
  // que los resultados se sientan instantáneos.
  useEffect(() => {
    if (!termino) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      setResultados([]);
      setBuscado(false);
      setError(null);
      return;
    }

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCargando(true);
    debounceRef.current = window.setTimeout(() => {
      buscarProductos(termino, { signal: controller.signal })
        .then((productos) => {
          setResultados(productos);
          setBuscado(true);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }

          setResultados([]);
          setBuscado(true);
          setError(err instanceof Error ? err.message : "Error desconocido");
        })
        .finally(() => {
          if (abortRef.current === controller) {
            setCargando(false);
          }
        });
    }, 300);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      controller.abort();
    };
  }, [termino]);

  async function ejecutarBusqueda() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setCargando(true);
    try {
      const productos = await buscarProductos(termino, { signal: controller.signal });
      setResultados(productos);
      setBuscado(true);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setResultados([]);
      setBuscado(true);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      if (abortRef.current === controller) {
        setCargando(false);
      }
    }
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
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                No se pudo cargar el catálogo: {error}
              </p>
            ) : null}

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
                  <Badge variant={stockBadgeVariant(p.Stock)}>
                    {stockBadgeLabel(p.Stock)}: {p.Stock}
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
