using System.Linq;
using MercadoVerde.Application.Abstractions;

namespace MercadoVerde.Application.Services;

public class InventarioService
{
    private readonly ITiendaDbContext _db;

    public InventarioService(ITiendaDbContext db)
    {
        _db = db;
    }

    // Descuenta 'cantidad' unidades del stock del producto de forma atómica.
    // Delega en ITiendaDbContext.DescontarStockAtomico que genera un UPDATE condicional
    // (Stock >= cantidad). Si dos hilos compiten, solo uno afectará filas.
    public void DescontarStock(int productoId, int cantidad)
    {
        // Verificar primero que el producto existe (error de dominio distinto a stock insuficiente).
        var existe = _db.Productos.Any(p => p.Id == productoId);
        if (!existe)
            throw new InvalidOperationException($"Producto {productoId} no existe.");

        var filasAfectadas = _db.DescontarStockAtomico(productoId, cantidad);

        if (filasAfectadas == 0)
            throw new InvalidOperationException(
                $"Stock insuficiente para el producto {productoId}.");
    }
}
