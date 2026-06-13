using System.Linq;
using Microsoft.EntityFrameworkCore;
using MercadoVerde.Application.Abstractions;
using MercadoVerde.Domain;

namespace MercadoVerde.Infrastructure.Data;

public class ProductoRepository : IProductoRepository
{
    private readonly TiendaDbContext _db;

    public ProductoRepository(TiendaDbContext db)
    {
        _db = db;
    }

    // Búsqueda de productos por nombre para el catálogo público.
    // Usa LINQ para que EF Core parametrice el valor automáticamente (sin inyección SQL).
    public List<Producto> BuscarPorNombre(string termino)
    {
        var terminoLower = termino.ToLower();
        return _db.Productos
            .Where(p => p.Activo && p.Nombre.ToLower().Contains(terminoLower))
            .ToList();
    }

    public Producto? ObtenerPorId(int id) => _db.Productos.FirstOrDefault(p => p.Id == id);
}
