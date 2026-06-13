# HALLAZGOS.MD - Emerson Torres

## PARTE 0 - Conoce el sistema

### Pregunta 4: Flujo completo al crear un pedido
Primero es necesario entender que, levantado el contenedor, tenemos acceso a 3 contenedores, en el cual podemos observar la ejecucion de la DB, api y front respectivamente. Me gustaria antes analizar los datos nivel de base de datos, dado que tengo 3 tablas:

```sql
LINE 1: select * from Clientes;
                      ^
mercadoverde=# select * from "Clientes";
 Id |   Nombre   |      Email
----+------------+-----------------
  1 | Ana López  | ana@example.com
  2 | Bruno Díaz |
(2 rows)

mercadoverde=# select * from "Productos";
 Id |       Nombre        | Precio | Stock | Activo | RowVersion
----+---------------------+--------+-------+--------+------------
  1 | Audífonos Bluetooth |  25.00 |     5 | t      |
  2 | Teclado Mecánico    |  49.90 |     3 | t      |
  3 | Mouse Inalámbrico   |  15.50 |    10 | t      |
  4 | Monitor 24"         | 180.00 |     2 | t      |
(4 rows)

mercadoverde=# select * from "Cupones";
 Id |    Codigo    | PorcentajeDescuento |     FechaExpiracionUtc     | Activo
----+--------------+---------------------+----------------------------+--------
  1 | BIENVENIDA10 |                  10 | 2026-07-13 16:20:03.927503 | t
  2 | EXPIRADO     |                  20 | 2026-06-12 16:20:03.927562 | t
(2 rows)
```

Porque para mi es importante analizar la data para el endpoint http://localhost:5081/api/Pedidos?

Por todo comienza en la descripcion que el swagger nos hace para el mapeo del DTO, donde los parametros que solicita mapean este JSON:

```json
{
  "ClienteId": 0,
  "CodigoCupon": "string",
  "Lineas": [
    {
      "ProductoId": 0,
      "Cantidad": 0
    }
  ]
}
```

Donde antes, en este primer punto, solo tengo mapeados los accesos a pedidos, productos y reportes, pero no se por ningun endpoint cuales son los clientes y menos cuales son los cupones, campos que son solicitados en el DTO. Asi que todo inicia en entender lo que tenemos para este primer punto y saber como llenaremos los datos del DTO.

Ahora vamos por pasos:

#### Paso 1

En el swagger aperturar el endpoint api/pedidos, identificando el request body donde podemos agregar predidos con cupon y sin cupon. Anexo se deja mapeado ambas opciones para creacion de pedidos tanto con cupon como sin el:

Con cupon:

```json
{
  "ClienteId": 1,
  "CodigoCupon": "BIENVENIDA10",
  "Lineas": [
    {
      "ProductoId": 2,
      "Cantidad": 1
    },
    {
      "ProductoId": 3,
      "Cantidad": 2
    }
  ]
}
```

Sin cupon:

```json
{
  "ClienteId": 1,
  "CodigoCupon": null,
  "Lineas": [
    {
      "ProductoId": 2,
      "Cantidad": 1
    },
    {
      "ProductoId": 3,
      "Cantidad": 2
    }
  ]
}
```

#### Paso 2

La petición automaticamente llega a PedidosController donde se inyecta mediante su contructor al PedidoService, posteriormente llegando al metodo Crear, donde a partir del servicio inyectado enviamos al metodo CrearPedido, para que procese la data del DTO obtenido en la peticion.

#### Paso 3

LLegando al servicio en el cual establecemos la logica del negocio, realizamos varias acciones:

- Iniciamos obteniendo el cliente, validando su existencia y en caso que no devolviendo el error "Cliente no encontrado".
- Intancia el modelo del pedido para poderlo cargar con la data obtenida, en este caso el Id del cliente, la fecha actual, el codigo del cupon enviado y el estado del pedido como Pendiente.
- Luego recorre cada línea del pedido, buscando el producto, calcula el subtotal (precio × cantidad) y Acumula todo para saber cuánto vale el pedido sin impuestos.
- Si el usuario puso un código de cupón, el sistema lo busca y verifica que esté vigente. Si es válido, calcula el descuento sobre el subtotal.
- Ya con el sub total y el descuento calcula el descuento del 13% mediante la constante TasaImpuesto sobre el sub total, donde el total final se obtiene usando: total = subtotal - descuento + impuesto.
- Simula el pago usando IPasarelaPagoService, retornando la data con estos parametros:
  - Aprobado
  - MotivoRechazo
  - Referencia
- En caso Aprobado = true, cambiamos el estado a Pagado, de lo contrario Rechazado.
- Descontamos del inventario.
- Se genera el comprobante de confirmación que se envía por correo al cliente.
- Se persiste el pedido usando entity: _db.Pedidos.Add(pedido).
- Finalmente retornamos el pedido con el estatus de 200 en la peticion:

```json
{
  "Id": 2,
  "ClienteId": 1,
  "Cliente": {
    "Id": 1,
    "Nombre": "Ana López",
    "Email": "ana@example.com"
  },
  "FechaUtc": "2026-06-13T19:04:50.3876906Z",
  "CodigoCupon": "BIENVENIDA10",
  "Subtotal": 80.9,
  "Descuento": 8.09,
  "Impuesto": 10.517,
  "Total": 83.327,
  "Estado": 1,
  "Lineas": [
    {
      "Id": 2,
      "PedidoId": 2,
      "ProductoId": 2,
      "Producto": {
        "Id": 2,
        "Nombre": "Teclado Mecánico",
        "Precio": 49.9,
        "Stock": 2,
        "Activo": true,
        "RowVersion": null
      },
      "Cantidad": 1,
      "PrecioUnitario": 49.9
    },
    {
      "Id": 3,
      "PedidoId": 2,
      "ProductoId": 3,
      "Producto": {
        "Id": 3,
        "Nombre": "Mouse Inalámbrico",
        "Precio": 15.5,
        "Stock": 8,
        "Activo": true,
        "RowVersion": null
      },
      "Cantidad": 2,
      "PrecioUnitario": 15.5
    }
  ]
}
```

"Respuesta json de pedido con CUPON BIENVENIDA10"

### Pregunta 5: Capas y servicios que participan

- PedidosController -> Solo recibe y responde. No piensa, solo pasa el mensaje.
- PedidoService -> El que hace todo: valida, calcula, cobra y coordina.
- InventarioService -> Descuenta el stock después de cobrar.
- PasarelaPagoService -> dice si el pago pasó o no.

### Pregunta 6: Dónde vive cada lógica

En la api:

Esto se resume en estor archivos:

- Cobro -> PasarelaPagoService en el metodo Cobrar
- Inventario -> InventarioService método DescontarStock es el que resta productos del almacén.
- Impuestos (IVA 13%) -> PedidoService.cs usando TasaImpuesto = 0.13m;

En el front:

- Armar el pedido -> crear-pedido-form.tsx ahí se construye lo que se envía a la API.
- Armar el reporte -> reporte-ventas.tsx es quien junta las fechas, pide los datos y los muestra en una tabla.

## PARTE 1 - Triage y priorización

| Ticket | Severidad | Impacto | Urgencia | Contención inmediata | Escalar a |
|--------|-----------|---------|----------|---------------------|-----------|
| TICK-206/301 | CRÍTICA | Seguridad: exposición de BD | Inmediata | Bloquear endpoint o WAF | CISO, Compliance |
| TICK-205 | CRÍTICA | Financiero: cobro sin referencia | Inmediata | Congelar pedido, alertar Finanzas | Gerente Financiero |
| TICK-201 | ALTA | Operativo: stock negativo | Alta | Corregir stock manualmente | Operaciones, Logística |
| TICK-303 | ALTA | Cobros dobles a clientes | Alta | Deshabilitar botón post-clic | Atención al Cliente |
| TICK-202 | ALTA | Financiero: impuesto incorrecto | Alta | Alertar Finanzas para conciliar | Finanzas, Marketing |
| TICK-203 | ALTA | Ventas fallidas con cupón | Alta | Desactivar cupón PROMO50 | Marketing |
| TICK-305 | MEDIA-ALTA | Fallas ocultas en el panel | Media-Alta | Instruir agentes a verificar | Líder de Soporte |
| TICK-204/304 | MEDIA | Reporte lento/expira | Media | Limitar rango de fechas | Equipo de Reportes |
| TICK-309 | MEDIA | Pedidos inválidos (cantidad 0) | Media | Comunicar a agentes | Equipo técnico |
| TICK-302 | MEDIA | Montos confusos en UI | Media | Ninguna inmediata | - |
| TICK-306 | BAJA-MEDIA | Reporte incompleto (último día) | Baja | Ninguna inmediata | - |
| TICK-307 | BAJA | UX del buscador (race condition) | Baja | Ninguna inmediata | - |
| TICK-308 | BAJA | Badge de stock siempre verde | Baja | Ninguna inmediata | - |



## PARTE 2 — Diagnóstico a partir de evidencia

---

### TICK-203 — Error 500 con cupón inexistente (PROMO50) y con cliente sin email

**Síntoma (lo que ve el usuario):**
Al crear un pedido con el código de cupón `PROMO50`, o con el cliente ID 2 (Bruno Díaz, sin email registrado), la API devuelve un HTTP 500 sin mensaje útil.

**Causa raíz (lo que ocurre en el código):**
Hay dos NullReferenceException distintas en [`src/MercadoVerde.Application/Services/PedidoService.cs`](src/MercadoVerde.Application/Services/PedidoService.cs):

1. **Cupón inexistente:** en la línea que evalúa `cupon.FechaExpiracionUtc`, si el cupón no existe en la base de datos `FirstOrDefault` retorna `null`, y el código accede a sus propiedades sin validar.
2. **Cliente sin email:** en `GenerarLineaComprobante`, se llama a `cliente.Email.ToUpper()` sin verificar si `Email` es null.

**Evidencia:**
```
2026-06-02 10:02:55.531 ERROR [PedidosController] Unhandled exception
System.NullReferenceException: Object reference not set to an instance of an object.
   at MercadoVerde.Api.Services.PedidoService.CrearPedido(CrearPedidoDto dto) line 64

2026-06-02 09:31:07.244 ERROR [PedidosController] Unhandled exception
System.NullReferenceException: Object reference not set to an instance of an object.
   at MercadoVerde.Api.Services.PedidoService.GenerarLineaComprobante(Pedido pedido)
```

**Reproducción controlada:**
```json
POST /api/pedidos
{ "ClienteId": 1, "CodigoCupon": "PROMO50", "Lineas": [{ "ProductoId": 1, "Cantidad": 1 }] }
→ 500 (cupón inexistente)

POST /api/pedidos
{ "ClienteId": 2, "CodigoCupon": null, "Lineas": [{ "ProductoId": 1, "Cantidad": 1 }] }
→ 500 (Bruno Díaz no tiene email)
```

---

### TICK-205 — Pedido marcado como Pagado cuando la pasarela falló

**Síntoma (lo que ve el usuario):**
Conciliación encuentra pedidos con `Estado = Pagado` pero sin referencia de pasarela. El cobro nunca ocurrió pero el sistema registró el pedido como exitoso.

**Causa raíz (lo que ocurre en el código):**
En [`src/MercadoVerde.Application/Services/PedidoService.cs`](src/MercadoVerde.Application/Services/PedidoService.cs), el bloque `catch` al llamar a la pasarela traga la excepción (timeout/503) y asigna `EstadoPedido.Pagado` incondicionalmente:

```csharp
catch
{
    // El cobro falló por indisponibilidad del proveedor.
    pedido.Estado = EstadoPedido.Pagado;  // BUG: debería ser Pendiente o Rechazado
}
```

**Evidencia:**
```
2026-06-02 13:05:15.903 WARN [Conciliacion] Pedido 1190 marcado Pagado
pero la pasarela no devolvió referencia.
```

**Reproducción controlada:**
La pasarela simulada en `PasarelaPagoService` lanza `TimeoutException` con ~20% de probabilidad. Ejecutar múltiples veces `POST /api/pedidos` hasta que ocurra la excepción (observable en logs) y verificar que el pedido persiste como Pagado sin referencia.

---

### TICK-201 — Stock negativo por condición de carrera

**Síntoma (lo que ve el usuario):**
Logística detecta stock en `-1` tras dos pedidos concurrentes del mismo producto con stock = 1 restante.

**Causa raíz (lo que ocurre en el código):**
En [`src/MercadoVerde.Application/Services/InventarioService.cs`](src/MercadoVerde.Application/Services/InventarioService.cs), el descuento se hace en dos pasos separados: primero `FirstOrDefault` para leer el stock, luego se modifica. Sin bloqueo optimista ni transacción serializable, dos hilos pueden leer el mismo stock disponible simultáneamente, ambos pasan la validación y ambos descontan, dejando el stock negativo.

El campo `RowVersion` existe en [`src/MercadoVerde.Domain/Models.cs`](src/MercadoVerde.Domain/Models.cs) declarado en `Producto`, pero no está configurado como token de concurrencia en `TiendaDbContext` ni se usa en el flujo de descuento.

**Evidencia:**
```
2026-06-02 11:48:13.142 INFO  Pedido 1103 creado estado=Pagado
2026-06-02 11:48:13.160 WARN  [Inventario] Producto 4 (Monitor 24") Stock resultante = -1
```
Ambos pedidos (1102 y 1103) entraron en el mismo segundo (11:48:13).

**Reproducción controlada:**
Dejar el Monitor 24" con stock = 1. Lanzar dos peticiones simultáneas con herramienta como curl o Postman Runner:
```json
POST /api/pedidos
{ "ClienteId": 1, "Lineas": [{ "ProductoId": 4, "Cantidad": 1 }] }
```
Verificar en base de datos: `SELECT "Stock" FROM "Productos" WHERE "Id" = 4;` → resultado esperado del bug: `-1`.

---

### TICK-206 — Inyección SQL en el buscador de productos

**Síntoma (lo que ve el usuario):**
Al escribir ciertos caracteres especiales en el buscador, el sistema devuelve resultados inesperados o errores. Un payload como `' OR 1=1 --` devuelve todos los productos ignorando el filtro.

**Causa raíz (lo que ocurre en el código):**
En [`src/MercadoVerde.Infrastructure/Data/ProductoRepository.cs`](src/MercadoVerde.Infrastructure/Data/ProductoRepository.cs), la consulta SQL se construye concatenando directamente el input del usuario sin parametrizar:

```csharp
var sql = "SELECT * FROM \"Productos\" WHERE \"Activo\" = true AND LOWER(\"Nombre\") LIKE '%" 
          + termino.ToLower() + "%'";
return _db.Productos.FromSqlRaw(sql).ToList();
```

Cualquier carácter de comilla rompe la sintaxis SQL, y un payload malicioso puede extraer o manipular datos.

**Evidencia:**
- Ticket TICK-206: "el sistema devuelve resultados extraños o errores".
- El test `TICK206_Buscador_NoPermiteInyeccionNiRompeConComilla` en [`tests/MercadoVerde.Application.UnitTests/FixesEsperadosTests.cs`](tests/MercadoVerde.Application.UnitTests/FixesEsperadosTests.cs) documenta exactamente este comportamiento (actualmente en Skip).

**Reproducción controlada:**
```
GET /api/productos/buscar?termino=' OR 1=1 --
→ Devuelve todos los productos (ignora el filtro Activo y el nombre)

GET /api/productos/buscar?termino=x'
→ SqlException o error 500 por comilla sin cerrar
```

---

### TICK-202 — Impuesto calculado sobre subtotal bruto en lugar de base imponible

**Síntoma (lo que ve el usuario):**
Finanzas detecta que en pedidos con cupón válido, el IVA (13%) sale más alto de lo esperado y el total no coincide con sus hojas de cálculo.

**Causa raíz (lo que ocurre en el código):**
En [`src/MercadoVerde.Application/Services/PedidoService.cs`](src/MercadoVerde.Application/Services/PedidoService.cs), el impuesto se calcula sobre el `subtotal` bruto, antes de aplicar el descuento:

```csharp
decimal impuesto = subtotal * TasaImpuesto;           // BUG: debería ser (subtotal - descuento)
decimal total = subtotal - descuento + impuesto;
```

Lo correcto es: `impuesto = (subtotal - descuento) * TasaImpuesto`, gravando solo la base imponible real.

**Evidencia:**
- Ticket TICK-202: *"el impuesto sale más caro de lo que debería"*.
- El test `TICK202_Impuesto_SeCalculaSobreSubtotalConDescuento` en [`tests/MercadoVerde.Application.UnitTests/FixesEsperadosTests.cs`](tests/MercadoVerde.Application.UnitTests/FixesEsperadosTests.cs) confirma el cálculo esperado (actualmente en Skip):
  - Subtotal 100 · Descuento 10 · Base imponible 90 · IVA esperado 11.70 · Total 101.70
  - Bug actual produce: IVA 13.00 · Total 103.00

**Reproducción controlada:**
```json
POST /api/pedidos
{ "ClienteId": 1, "CodigoCupon": "BIENVENIDA10", "Lineas": [{ "ProductoId": 1, "Cantidad": 1 }] }
```
Verificar respuesta: `Impuesto` debería ser `(25.00 - 2.50) * 0.13 = 2.925`, pero el sistema devuelve `25.00 * 0.13 = 3.25`.

---



## PARTE 3 — Corrección de defectos

---

### TICK-206 — Inyección SQL en el buscador · `fix(TICK-206): reemplazar SQL dinámico con LINQ parametrizado`

**Síntoma:** Al enviar caracteres especiales como `'` o payloads como `' OR 1=1 --` en el buscador, la API devuelve resultados incorrectos o un error 500.

**Causa raíz:** `ProductoRepository.BuscarPorNombre` construía la consulta SQL concatenando directamente el input del usuario, permitiendo manipular la query.

**Antes:**
```csharp
// src/MercadoVerde.Infrastructure/Data/ProductoRepository.cs
var sql = "SELECT * FROM \"Productos\" WHERE \"Activo\" = true AND LOWER(\"Nombre\") LIKE '%"
          + termino.ToLower() + "%'";
return _db.Productos.FromSqlRaw(sql).ToList();
```

**Después:**
```csharp
// src/MercadoVerde.Infrastructure/Data/ProductoRepository.cs
var terminoLower = termino.ToLower();
return _db.Productos
    .Where(p => p.Activo && p.Nombre.ToLower().Contains(terminoLower))
    .ToList();
```

**Por qué es correcta:** EF Core traduce el LINQ a una consulta parametrizada (`@p0`), nunca interpola strings del usuario en el SQL. El comportamiento de búsqueda (insensible a mayúsculas, solo activos) se mantiene idéntico.

**Posibles efectos colaterales:** Ninguno. El test `TICK206_Buscador_NoPermiteInyeccionNiRompeConComilla` puede quitarse el `Skip` y debe pasar.

---

### TICK-205 — Pedido marcado Pagado cuando la pasarela falló · `fix(TICK-205): cambiar estado a Pendiente cuando falla pasarela`

**Síntoma:** Conciliación encuentra pedidos con `Estado = Pagado` pero sin referencia de pasarela. El dinero nunca entró.

**Causa raíz:** El bloque `catch` en `PedidoService.CrearPedido` asignaba `EstadoPedido.Pagado` cuando la pasarela lanzaba una excepción (timeout/503), confundiendo "falla técnica" con "cobro aprobado".

**Antes:**
```csharp
catch
{
    // El cobro falló por indisponibilidad del proveedor.
    pedido.Estado = EstadoPedido.Pagado;  // BUG
}
```

**Después:**
```csharp
catch (Exception ex)
{
    // El cobro falló: queda Pendiente para que conciliación lo reintente.
    // NUNCA se marca Pagado sin confirmación de la pasarela.
    pedido.Estado = EstadoPedido.Pendiente;
    Console.Error.WriteLine($"[PasarelaPago] Excepción al cobrar pedido cliente={cliente.Id}: {ex.Message}");
}
```

**Por qué es correcta:** Un fallo de pasarela no es una aprobación. El estado `Pendiente` permite a conciliación identificar el pedido y reintentarlo de forma controlada. Se agrega log de error para que la falla nunca quede invisible.

**Posibles efectos colaterales:** Los pedidos que antes aparecían como `Pagado` sin referencia ahora quedarán `Pendiente`. Conciliación deberá tener un proceso para reintentar o cancelar pedidos en ese estado.

---

### TICK-201 — Stock negativo por race condition · `fix(TICK-201): usar UPDATE atómico para evitar race condition`

**Síntoma:** Logística detecta stock en `-1` tras dos pedidos concurrentes del mismo producto con solo 1 unidad restante.

**Causa raíz:** `InventarioService.DescontarStock` hacía leer-validar-escribir en tres pasos separados. Sin atomicidad, dos hilos podían leer el mismo stock disponible, ambos pasar la validación y ambos descontar, dejando el stock negativo.

**Antes:**
```csharp
// Lee, valida y escribe en pasos separados — no es atómico
var producto = _db.Productos.FirstOrDefault(p => p.Id == productoId);
if (producto.Stock < cantidad)
    throw new InvalidOperationException(...);
producto.Stock = producto.Stock - cantidad;
_db.SaveChanges();
```

**Después:**
```csharp
// UPDATE condicional atómico: solo descuenta si Stock >= cantidad
var filasAfectadas = _db.Productos
    .Where(p => p.Id == productoId && p.Stock >= cantidad)
    .ExecuteUpdate(s => s.SetProperty(p => p.Stock, p => p.Stock - cantidad));

if (filasAfectadas == 0)
    throw new InvalidOperationException($"Stock insuficiente para el producto {productoId}.");
```

**Por qué es correcta:** `ExecuteUpdate` genera un `UPDATE ... WHERE Stock >= cantidad` que PostgreSQL ejecuta atómicamente. Si dos transacciones compiten, la segunda encontrará `filasAfectadas = 0` y lanzará la excepción correctamente. No requiere bloqueo pesimista adicional.

**Posibles efectos colaterales:** `ExecuteUpdate` no pasa por el change tracker de EF Core, por lo que el objeto `Producto` en memoria no se actualiza automáticamente. Dado que el descuento es la última operación antes de persistir el pedido, esto no genera regresión. En `InMemory` se usa un fallback equivalente para ejecutar los tests sin PostgreSQL.

---

### TICK-203 — NullReference con cupón inexistente y cliente sin email · `fix(TICK-203): validar cupon null y email null en comprobante`

**Síntoma:** Al crear un pedido con un cupón inexistente como `PROMO50`, o con un cliente sin email registrado, la API devolvía HTTP 500 por `NullReferenceException`.

**Causa raíz:** `PedidoService.CrearPedido` asumía que `cupon` siempre existía antes de leer `FechaExpiracionUtc`, y `GenerarLineaComprobante` asumía que `cliente.Email` nunca era null antes de llamar a `ToUpper()`.

**Antes:**
```csharp
if (cupon.FechaExpiracionUtc >= DateTime.Now && cupon.Activo)
{
  descuento = subtotal * (cupon.PorcentajeDescuento / 100m);
}

return $"Comprobante para {cliente.Email.ToUpper()} - Total: {pedido.Total:C}";
```

**Después:**
```csharp
if (cupon != null && cupon.FechaExpiracionUtc >= DateTime.Now && cupon.Activo)
{
  descuento = subtotal * (cupon.PorcentajeDescuento / 100m);
}

var email = cliente?.Email?.ToUpperInvariant() ?? "(sin email)";
return $"Comprobante para {email} - Total: {pedido.Total:C}";
```

**Por qué es correcta:** Un cupón ausente ya no rompe la creación del pedido; simplemente no aplica descuento. Si el cliente no tiene email, el comprobante sigue generándose con un valor visible y seguro en lugar de lanzar una excepción.

**Posibles efectos colaterales:** El comprobante ya no asume que el correo existe. Eso evita el 500 pero deja constancia explícita de que el cliente no tiene email.

---

### TICK-202 — IVA calculado sobre subtotal bruto · `fix(TICK-202): calcular IVA sobre base imponible (subtotal-descuento)`

**Síntoma:** Finanzas detectaba que el IVA salía más alto de lo esperado en pedidos con cupón válido, y el total no coincidía con su cálculo.

**Causa raíz:** `PedidoService.CrearPedido` calculaba el impuesto sobre `subtotal` bruto, antes de aplicar el descuento.

**Antes:**
```csharp
decimal impuesto = subtotal * TasaImpuesto;
decimal total = subtotal - descuento + impuesto;
```

**Después:**
```csharp
var baseImponible = subtotal - descuento;
decimal impuesto = baseImponible * TasaImpuesto;
decimal total = subtotal - descuento + impuesto;
```

**Por qué es correcta:** El IVA debe gravar la base imponible real, es decir, el subtotal menos el descuento. Con esto el total coincide con el cálculo de negocio y con el test esperado.

**Posibles efectos colaterales:** Si el descuento llegara a ser igual al subtotal, la base imponible queda en cero y el IVA también en cero, que es el comportamiento esperado.

---

### TICK-204 — Reporte lento por N+1 queries · `fix(TICK-204): usar Include() para evitar N+1 queries en reporte`

**Síntoma:** El reporte de ventas tardaba demasiado y a veces expiraba cuando el volumen de pedidos crecía.

**Causa raíz:** `ReporteService.GenerarReporteVentas` primero cargaba los pedidos y luego, dentro de un `foreach`, consultaba otra vez las líneas y el cliente de cada pedido. Eso generaba N+1 queries.

**Antes:**
```csharp
var pedidos = _db.Pedidos.Where(...).ToList();
foreach (var pedido in pedidos)
{
  var lineas = _db.LineasPedido.Where(l => l.PedidoId == pedido.Id).ToList();
  var cliente = _db.Clientes.FirstOrDefault(c => c.Id == pedido.ClienteId);
}
```

**Después:**
```csharp
var pedidos = _db.Pedidos
  .Include(p => p.Cliente)
  .Include(p => p.Lineas)
  .Where(...)
  .ToList();
```

**Por qué es correcta:** ahora se cargan en una sola consulta los pedidos junto con su cliente y sus líneas. El reporte sigue devolviendo la misma información, pero evita el patrón N+1.

**Posibles efectos colaterales:** La consulta trae más datos de una vez, pero reduce drásticamente el número de viajes a la base y es la forma correcta para este reporte.

---

### TICK-301 — El buscador del panel ejecuta HTML · `fix(TICK-301): eliminar dangerouslySetInnerHTML del buscador`

**Síntoma:** Al buscar textos con etiquetas HTML, el panel podía renderizar contenido no confiable en lugar de mostrarlo como texto.

**Causa raíz:** `BuscadorProductos` usaba `dangerouslySetInnerHTML` tanto para el texto del término como para el nombre del producto.

**Antes:**
```tsx
<p dangerouslySetInnerHTML={{ __html: `Resultados para <strong>${termino}</strong>...` }} />
<p dangerouslySetInnerHTML={{ __html: p.Nombre }} />
```

**Después:**
```tsx
<p>Resultados para <span className="font-medium text-foreground">{termino}</span>...</p>
<p className="font-medium">{p.Nombre}</p>
```

**Por qué es correcta:** React escapa el contenido por defecto, así que el texto del usuario se renderiza sin ejecutarse. Se conserva la misma información visual sin abrir la puerta a XSS.

**Posibles efectos colaterales:** Ninguno funcional; solo deja de interpretarse HTML en el buscador, que es justamente lo deseado.

---

### TICK-303 — Se crearon dos pedidos iguales · `fix(TICK-303): deshabilitar boton mientras se procesa pedido`

**Síntoma:** Si el agente hacía doble clic rápido en "Confirmar y cobrar pedido", el panel disparaba dos solicitudes y terminaba creando pedidos duplicados.

**Causa raíz:** `CrearPedidoForm` permitía volver a disparar `enviar()` mientras la primera petición todavía estaba en vuelo. No había bloqueo de UI durante el procesamiento.

**Antes:**
```tsx
<Button onClick={enviar}>Confirmar y cobrar pedido</Button>
```

**Después:**
```tsx
if (enviando) return;
...
<Button onClick={enviar} disabled={enviando} type="button">
  {enviando ? "Procesando..." : "Confirmar y cobrar pedido"}
</Button>
```

**Por qué es correcta:** El botón queda deshabilitado mientras la petición está en progreso y la función además hace guard clause si ya había una solicitud activa. Eso evita duplicar el pedido por doble clic o doble submit accidental.

**Posibles efectos colaterales:** El agente ve el botón en estado "Procesando..." hasta que la API responda, pero es el comportamiento esperado para evitar doble cobro/doble pedido.

---

### TICK-305 — El panel oculta errores del backend · `fix(TICK-305): mostrar errores del backend en el panel`

**Síntoma:** Si la API falla o devuelve error, el panel mostraba "0 resultados" o una pantalla vacía, haciendo creer al agente que no había datos.

**Causa raíz:** Los helpers de `frontend/lib/api.ts` atrapaban cualquier error y devolvían colecciones vacías. Además, los componentes no tenían un estado de error para mostrar la falla real.

**Antes:**
```ts
try {
  const res = await fetch(...);
  const data = await res.json();
  return data as Producto[];
} catch {
  return [];
}
```

**Después:**
```ts
const res = await fetch(...);
if (!res.ok) {
  throw new Error(await leerErrorRespuesta(res));
}
```

Y en los componentes se agregaron estados `error` visibles para buscador, reporte y creación de pedido.

**Por qué es correcta:** El panel deja de ocultar fallas de red/500 y muestra un mensaje explícito al agente. Eso mejora observabilidad y evita diagnósticos falsos.

**Posibles efectos colaterales:** Ahora el usuario ve errores reales del backend en vez de resultados vacíos. Es el comportamiento esperado para soporte.

---

### TICK-302 — Montos del panel con decimales raros · `fix(TICK-302): corregir calculo de total estimado y formateo`

**Síntoma:** En la pantalla de crear pedido, algunas líneas mostraban valores como `149.70000000000002` y el total estimado no siempre coincidía con la API.

**Causa raíz:** El panel hacía operaciones de dinero con `number` sin normalizar a centavos y renderizaba subtotales de línea como número crudo.

**Antes:**
```tsx
{linea.precioUnitario * linea.cantidad}
```

```ts
const impuesto = subtotal * TASA_IMPUESTO;
const descuento = subtotal * (porcentajeCupon / 100);
return subtotal + impuesto - descuento;
```

**Después:**
```tsx
{formatearMoneda(redondearMoneda(linea.precioUnitario * linea.cantidad))}
```

```ts
const descuento = redondearMoneda(subtotal * (porcentajeCupon / 100));
const baseImponible = redondearMoneda(subtotal - descuento);
const impuesto = redondearMoneda(baseImponible * TASA_IMPUESTO);
return redondearMoneda(baseImponible + impuesto);
```

**Por qué es correcta:** El panel normaliza cálculos a centavos antes de mostrar o comparar montos, evitando artefactos de coma flotante y alineando el resumen con el valor que termina cobrando la API.

**Posibles efectos colaterales:** Los importes ahora se redondean a 2 decimales en toda la vista, que es justo el formato esperado para dinero.

---

### TICK-309 — Pedidos con cantidades inválidas · `fix(TICK-309): validar cantidad mayor a 0 en pedidos`

**Síntoma:** El panel permitía confirmar pedidos con cantidad 0, negativa o vacía, y el total estimado terminaba mostrando valores sin sentido.

**Causa raíz:** El formulario no validaba las líneas antes de enviar el DTO a la API y el input numérico no estaba restringido en la UI.

**Antes:**
```tsx
<Input type="number" value={linea.cantidad} ... />
<Button onClick={enviar} disabled={enviando} type="button">
```

**Después:**
```tsx
<Input type="number" min={1} step={1} value={linea.cantidad} ... />

if (hayCantidadesInvalidas()) {
  setError("Cada línea del pedido debe tener una cantidad mayor a 0.");
  return;
}
```

**Por qué es correcta:** La UI ya no deja confirmar un pedido con cantidades inválidas, y además muestra una validación explícita antes de llamar a la API. Se evita enviar datos incoherentes al backend.

**Posibles efectos colaterales:** El botón queda deshabilitado cuando una línea no es válida; eso es deseado para evitar pedidos inconsistentes.

---

### TICK-308 — Badge de stock siempre verde · `fix(TICK-308): agregar umbral de stock bajo al badge`

**Síntoma:** El panel marcaba el stock en verde incluso cuando quedaban 1 o 2 unidades, lo que podía hacer creer al agente que aún había inventario cómodo.

**Causa raíz:** El badge solo distinguía entre `stock > 0` y `stock = 0`, sin representar el estado de stock bajo.

**Antes:**
```tsx
<Badge variant={p.Stock > 0 ? "success" : "warning"}>
  {p.Stock} en stock
</Badge>
```

**Después:**
```tsx
<Badge variant={stockBadgeVariant(p.Stock)}>
  {stockBadgeLabel(p.Stock)}: {p.Stock}
</Badge>
```

**Por qué es correcta:** ahora el panel diferencia `En stock`, `Stock bajo` y `Sin stock`, dando una señal visual útil para logística sin alterar los datos reales.

**Posibles efectos colaterales:** Ninguno funcional; solo mejora la lectura operativa del inventario.

---

### TICK-306 — El reporte no incluye el último día · `fix(TICK-306): incluir ultimo dia en rango de reporte`

**Síntoma:** Al pedir el reporte hasta una fecha concreta, los pedidos de ese mismo día no aparecían; había que poner la fecha del día siguiente para verlos.

**Causa raíz:** El panel enviaba fechas sin hora (`YYYY-MM-DD`). Al llegar al backend, `hasta` se interpretaba como el inicio del día (`00:00:00`), dejando fuera las ventas ocurridas más tarde ese mismo día.

**Antes:**
```ts
`${API_BASE}/api/reportes/ventas?desde=${desde}&hasta=${hasta}`
```

**Después:**
```ts
const desdeUtc = `${desde}T00:00:00`;
const hastaUtc = `${hasta}T23:59:59.999`;
```

**Por qué es correcta:** el rango ahora es inclusivo para todo el día final, sin depender de que el agente agregue manualmente la fecha siguiente.

**Posibles efectos colaterales:** Ninguno funcional; el reporte sigue usando el mismo filtro, pero con límites de tiempo correctos.

---

### TICK-307 — El buscador se comporta raro al escribir rápido · `fix(TICK-307): agregar debounce y abort controller al buscador`

**Síntoma:** Al teclear rápido en el buscador, aparecían resultados de una búsqueda anterior y además se disparaban demasiadas consultas a la API.

**Causa raíz:** `BuscadorProductos` lanzaba una request por cada cambio del input sin cancelar las anteriores ni esperar a que el usuario dejara de escribir.

**Antes:**
```tsx
useEffect(() => {
  buscarProductos(termino).then(...)
}, [termino]);
```

**Después:**
```tsx
debounceRef.current = window.setTimeout(() => {
  buscarProductos(termino, { signal: controller.signal })
    .then(...)
    .catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      ...
    });
}, 300);
```

**Por qué es correcta:** el buscador espera un breve debounce antes de consultar y cancela búsquedas obsoletas con `AbortController`, así el panel solo muestra resultados coherentes con el texto actual.

**Posibles efectos colaterales:** La búsqueda deja de ser estrictamente instantánea, pero gana estabilidad y reduce ruido de red, que es el comportamiento correcto para soporte.

































































































