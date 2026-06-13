using System.Linq;
using Microsoft.EntityFrameworkCore;
using MercadoVerde.Application.Abstractions;

namespace MercadoVerde.Application.Services;

public class ReporteService
{
    private readonly ITiendaDbContext _db;

    public ReporteService(ITiendaDbContext db)
    {
        _db = db;
    }

    public class FilaReporte
    {
        public int PedidoId { get; set; }
        public string Cliente { get; set; } = string.Empty;
        public int CantidadArticulos { get; set; }
        public decimal Total { get; set; }
    }

    // Genera el reporte de ventas de un rango de fechas.
    // En producción la tabla Pedidos tiene cientos de miles de filas.
    public List<FilaReporte> GenerarReporteVentas(DateTime desdeUtc, DateTime hastaUtc)
    {
        var pedidos = _db.Pedidos
            .Include(p => p.Cliente)
            .Include(p => p.Lineas)
            .Where(p => p.FechaUtc >= desdeUtc && p.FechaUtc <= hastaUtc)
            .ToList();

        var filas = new List<FilaReporte>();
        foreach (var pedido in pedidos)
        {
            filas.Add(new FilaReporte
            {
                PedidoId = pedido.Id,
                Cliente = pedido.Cliente?.Nombre ?? "(desconocido)",
                CantidadArticulos = pedido.Lineas.Sum(l => l.Cantidad),
                Total = pedido.Total
            });
        }

        return filas;
    }
}
