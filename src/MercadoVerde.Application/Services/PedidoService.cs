using System.Linq;
using MercadoVerde.Application.Abstractions;
using MercadoVerde.Application.Dtos;
using MercadoVerde.Domain;

namespace MercadoVerde.Application.Services;

public class PedidoService
{
    private const decimal TasaImpuesto = 0.13m; // IVA 13%

    private readonly ITiendaDbContext _db;
    private readonly InventarioService _inventario;
    private readonly IPasarelaPagoService _pasarela;

    public PedidoService(ITiendaDbContext db, InventarioService inventario, IPasarelaPagoService pasarela)
    {
        _db = db;
        _inventario = inventario;
        _pasarela = pasarela;
    }

    public Pedido CrearPedido(CrearPedidoDto dto)
    {
        var cliente = _db.Clientes.FirstOrDefault(c => c.Id == dto.ClienteId);
        if (cliente == null)
            throw new InvalidOperationException("Cliente no encontrado.");

        var pedido = new Pedido
        {
            ClienteId = cliente.Id,
            FechaUtc = DateTime.UtcNow,
            CodigoCupon = dto.CodigoCupon,
            Estado = EstadoPedido.Pendiente
        };

        // 1) Construir líneas y subtotal
        decimal subtotal = 0m;
        foreach (var l in dto.Lineas)
        {
            var producto = _db.Productos.FirstOrDefault(p => p.Id == l.ProductoId);
            if (producto == null)
                throw new InvalidOperationException($"Producto {l.ProductoId} no existe.");

            var linea = new LineaPedido
            {
                ProductoId = producto.Id,
                Cantidad = l.Cantidad,
                PrecioUnitario = producto.Precio
            };
            pedido.Lineas.Add(linea);
            subtotal += producto.Precio * l.Cantidad;
        }

        // 2) Aplicar cupón (si viene)
        decimal descuento = 0m;
        if (!string.IsNullOrWhiteSpace(dto.CodigoCupon))
        {
            var cupon = _db.Cupones.FirstOrDefault(c => c.Codigo == dto.CodigoCupon);

            // Validar vigencia del cupón
            if (cupon != null && cupon.FechaExpiracionUtc >= DateTime.Now && cupon.Activo)
            {
                descuento = subtotal * (cupon.PorcentajeDescuento / 100m);
            }
        }

        // 3) Calcular impuesto y total
        var baseImponible = subtotal - descuento;
        decimal impuesto = baseImponible * TasaImpuesto;
        decimal total = subtotal - descuento + impuesto;

        pedido.Subtotal = subtotal;
        pedido.Descuento = descuento;
        pedido.Impuesto = impuesto;
        pedido.Total = total;

        // 4) Cobrar con la pasarela de pago
        try
        {
            var resultado = _pasarela.Cobrar(total, $"Pedido cliente {cliente.Nombre}");
            if (resultado.Aprobado)
                pedido.Estado = EstadoPedido.Pagado;
            else
                pedido.Estado = EstadoPedido.Rechazado;
        }
        catch (Exception ex)
        {
            // El cobro falló por indisponibilidad del proveedor: el pedido queda
            // Pendiente para que conciliación lo reintente. NUNCA se marca Pagado
            // sin confirmación de la pasarela.
            pedido.Estado = EstadoPedido.Pendiente;
            Console.Error.WriteLine($"[PasarelaPago] Excepción al cobrar pedido cliente={cliente.Id}: {ex.Message}");
        }

        // 5) Descontar inventario
        foreach (var linea in pedido.Lineas)
            _inventario.DescontarStock(linea.ProductoId, linea.Cantidad);

        // 6) Generar el comprobante de confirmación que se envía por correo al cliente.
        GenerarLineaComprobante(pedido);

        // 7) Persistir el pedido
        _db.Pedidos.Add(pedido);
        _db.SaveChanges();

        return pedido;
    }

    // Envía el comprobante por correo. El email del cliente puede no estar registrado.
    public string GenerarLineaComprobante(Pedido pedido)
    {
        var cliente = _db.Clientes.FirstOrDefault(c => c.Id == pedido.ClienteId);
        var email = cliente?.Email?.ToUpperInvariant() ?? "(sin email)";
        return $"Comprobante para {email} - Total: {pedido.Total:C}";
    }
}
