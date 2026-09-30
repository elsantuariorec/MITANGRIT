# Santuario Live · Tiquetera de El Santuario

Boletería para eventos con pago por Nequi Negocios (llave o QR Bre-B) y **aprobación automática**: el celular Android de El Santuario recibe el SMS de Nequi, lo reenvía a un robot gratuito de Google, y el robot aprueba la boleta que coincide en monto y nombre. El comprador ve aparecer su QR sin que nadie toque nada.

## Qué hay en la carpeta

| Archivo | Para qué es |
|---|---|
| `index.html` | Página pública: cartelera, detalle del evento y compra |
| `boleta.html` | Pantalla de pago con cuenta regresiva, y luego la boleta con QR |
| `admin.html` | Panel del organizador: pedidos, pagos, eventos, cortesías, reporte y ajustes |
| `puerta.html` | Escáner de QR para el día del evento, con búsqueda por nombre de respaldo |
| `js/config.js` | Aquí van los datos de Firebase (paso 1) |
| `firebase-reglas.json` | Reglas de seguridad de la base de datos (paso 2) |
| `apps-script/` | El robot que lee los SMS (paso 5) |

## Cómo funciona una compra

1. La persona elige boleta, llena nombre, cédula y WhatsApp, y dice si paga desde su propia cuenta o desde la de otra persona.
2. La boleta queda apartada el tiempo que definas (30 minutos por defecto). La pantalla le muestra el valor exacto, tu llave y tu QR.
3. Paga por Nequi o cualquier banco con Bre-B. A tu Android llega el SMS: *"Tu negocio EL SANTUARIO recibio $30.000 de DIEGO FORERO…"*
4. El robot cruza monto + nombre con los pedidos pendientes. Si hay exactamente uno que coincide, lo aprueba. A la persona le aparece su boleta con QR en 1 o 2 minutos.
5. Si hay duda (dos pedidos iguales, nombre distinto, pago tardío), el pago queda en la pestaña **Pagos** del panel para que lo asignes con dos clics.
6. En la puerta, se escanea el QR. Una boleta de 3 entradas deja entrar a 3 personas, y la pantalla avisa si alguien intenta usarla dos veces.

---

## Paso 0 · Probarla ya, en modo demo

Mientras `js/config.js` esté vacío, todo funciona guardado solo en el navegador. Sube la carpeta a GitHub Pages (paso 4) o ábrela con un servidor local y prueba:

1. En `index.html` compra una boleta.
2. En otra pestaña abre `admin.html` (clave: `demo`), ve a **Pagos** y toca **Simular pago del último pedido** y luego **Leer SMS**.
3. Vuelve a la pestaña de la boleta: en 3 segundos aparece el QR.
4. Abre `puerta.html` y búscate por nombre para ver cómo se registra el ingreso.

## Paso 1 · Crear el proyecto en Firebase

Recomiendo un proyecto nuevo, separado del de La Ventana, para que las reglas de seguridad de una app no afecten a la otra.

1. En [console.firebase.google.com](https://console.firebase.google.com) crea el proyecto `santuario-live` (sin Analytics).
2. **Compilación › Realtime Database › Crear base de datos**. Ubicación: Estados Unidos. Empieza en **modo bloqueado**.
3. **Compilación › Authentication › Comenzar** y activa **Correo electrónico/contraseña**.
4. **Configuración del proyecto (engranaje) › General › Tus apps › Web (`</>`)**. Regístrala con cualquier nombre. De lo que aparece copia `apiKey` y `databaseURL` en `js/config.js`.

El plan gratuito (Spark) alcanza de sobra; no necesitas tarjeta.

## Paso 2 · Reglas de seguridad

En **Realtime Database › Reglas**, borra todo, pega el contenido de `firebase-reglas.json` y dale **Publicar**.

Estas reglas hacen que:
- Cualquiera pueda ver eventos y crear un pedido, pero solo en estado "esperando pago" y **con el precio real** de la boleta. Nadie puede crearse un pedido de $1.000 para una boleta de $30.000 y que el robot se lo apruebe.
- Solo los organizadores puedan ver la lista de compradores, aprobar, crear eventos o registrar ingresos.
- Cada comprador solo pueda ver su propia boleta (el enlace lleva un código imposible de adivinar).

## Paso 3 · Cuentas de organizador y del robot

1. En **Authentication › Usuarios › Agregar usuario** crea:
   - Tu cuenta de organizador (tu correo y una clave).
   - Una cuenta para el robot, por ejemplo `robot@elsantuario.co` con una clave larga. No tiene que ser un correo real.
   - Si alguien más va a manejar la puerta, créale su propia cuenta.
2. Copia el **UID** de cada usuario (columna "UID de usuario").
3. En **Realtime Database › Datos**, toca el **+** junto a la raíz y crea un nodo `admins`. Dentro, un hijo por cada UID con valor `true` (booleano, sin comillas):

```
admins
  ├─ Xk3...tu-uid : true
  └─ Pq9...uid-del-robot : true
```

## Paso 4 · Publicar en GitHub Pages

1. En la cuenta `elsantuariorec` crea un repositorio, por ejemplo `boletas`.
2. Sube **todo el contenido** de esta carpeta (con `js/config.js` ya lleno).
3. **Settings › Pages › Branch: main / (root) › Save**.
4. Queda en `https://elsantuariorec.github.io/boletas/`. El panel está en `/admin.html` y la puerta en `/puerta.html`.
5. Entra al panel con tu cuenta, ve a **Ajustes** y pon la llave de Nequi Negocios, la imagen del QR Negocios y el WhatsApp de atención. Luego crea tu primer evento en **Eventos** y usa **Copiar link** para compartirlo.

## Paso 5 · El robot que lee los SMS (Google Apps Script)

1. Con la cuenta de Google de El Santuario entra a [script.google.com](https://script.google.com) › **Nuevo proyecto**. Llámalo `Santuario Live SMS`.
2. Reemplaza el contenido de `Código.gs` por el de `apps-script/Codigo.gs`.
3. Crea otro archivo de secuencia de comandos (**+ › Secuencia de comandos**) llamado `Matcher` y pega `apps-script/Matcher.gs`.
4. **Configuración del proyecto (engranaje) › Propiedades del script › Agregar**:

| Propiedad | Valor |
|---|---|
| `API_KEY` | la misma apiKey de `js/config.js` |
| `DB_URL` | la misma databaseURL de `js/config.js` |
| `ROBOT_CORREO` | el correo del robot del paso 3 |
| `ROBOT_CLAVE` | la clave del robot |
| `TOKEN` | una palabra secreta larga que inventes, por ejemplo `santuario-7f3k9q2m` |

5. Vuelve al editor, elige la función `instalar` en el menú de arriba y dale **Ejecutar**. Google te pide autorización (es tu propio script: **Configuración avanzada › Ir a Santuario Live SMS**). En el registro debe salir "Listo".
6. **Implementar › Nueva implementación › tipo Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Copia la URL que termina en `/exec`.
7. Tu URL del webhook es esa URL + `?token=` + tu TOKEN:

```
https://script.google.com/macros/s/AKfy.../exec?token=santuario-7f3k9q2m
```

Si cambias el código más adelante, usa **Implementar › Administrar implementaciones › Editar › Nueva versión** para que la URL no cambie.

## Paso 6 · El celular Android de El Santuario

**a) Que le lleguen los SMS de Nequi.** Si la cuenta Nequi Negocios no está en ese celular, en la app Nequi registra el número del Android como uno de los hasta 3 números adicionales que reciben SMS de cada pago del negocio ([guía de Nequi](https://ayuda.nequi.com.co/hc/es/articles/47915840624525-Comparte-las-notificaciones-de-pagos-de-tu-Negocio-con-Nequi)).

**b) Instalar el reenviador.** La app es *SMS to URL Forwarder*, gratuita y de código abierto. No está en Play Store por las políticas de Google sobre SMS; se instala desde [F-Droid](https://f-droid.org/en/packages/tech.bogomolov.incomingsmsgateway/) o desde [GitHub](https://github.com/bogkonstantin/android_income_sms_gateway_webhook/releases).

1. Ábrela y dale permiso de leer SMS.
2. **Agregar**: remitente `*` (todos; el robot ignora lo que no sea un pago de Nequi). URL: tu URL del webhook. Deja la plantilla JSON por defecto.
3. En los ajustes de Android, quítale a la app la **optimización de batería** para que no la duerma.
4. Si la app muestra un error de "redirección" después de enviar, es normal: Google responde así, pero el SMS sí se procesó.

**c) Prueba real.** Crea un evento de prueba con una boleta de $1.000, cómprala y paga desde otro Nequi. En 1 o 2 minutos debe aparecer la boleta y en **Pagos** verás "aprobada automáticamente". Después desmarca "Visible en la página de boletas" para ocultarlo.

## El día del evento

- Abre `puerta.html` en el celular de quien controla el ingreso y entra con su cuenta. Toca **Encender cámara**.
- Verde con "Adelante": entra. Si la boleta es de varias personas, eliges cuántas entran ahora.
- Vino con "Ya entró": esa boleta ya se usó. Ámbar con "Sin pago": el pago no se ha confirmado.
- Si alguien no tiene el QR, búscalo por nombre o cédula en la misma pantalla.
- En **Reporte** puedes descargar la lista para la puerta como respaldo por si se cae el internet.

## Lo que conviene saber

- **Si pagan desde la cuenta de otra persona** y no lo avisaron en el formulario, el nombre no coincide y el pago queda en **Pagos** para que lo asignes a mano. El formulario ya pregunta por eso.
- **Pagos que no son de boletas** (un café, un taller) también llegan como SMS. Quedan en Pagos sin asignar; usa **No es de boletas**.
- **Si el Android se apaga o pierde internet**, la app reintenta sola cuando vuelve. Mientras tanto puedes pegar el SMS en **Pagos › Pegar un SMS de Nequi**.
- **Si Nequi cambia la redacción del SMS**, el robot deja de reconocerlo y los pagos quedan como "No se pudo leer". Mándame el SMS nuevo y se ajusta el lector (`js/matcher.js` y `apps-script/Matcher.gs` son el mismo archivo).
- Las reservas vencidas se liberan cada 5 minutos. Si alguien paga tarde, el pago queda para revisar y en el panel puedes usar **Aprobar igual**.
- Los compradores con WhatsApp reciben su boleta en pantalla; si la pierden, desde **Pedidos › WhatsApp** les mandas el enlace con un clic.
