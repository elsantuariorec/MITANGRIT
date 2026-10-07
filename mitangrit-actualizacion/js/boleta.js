/* Santuario Live — pantalla de pago y boleta (ES5) */
(function () {
  var vista = SL.$('#vista');
  var id = SL.param('id');
  var config = {};
  var pedido = null;
  var vistaActual = '';
  var sondeo = null;
  var reloj = null;

  SL.cintaDemo();

  if (!id) {
    vista.innerHTML = '<div class="estado-fin"><h1>Boleta no encontrada</h1><p>Este enlace está incompleto.</p>' +
      '<a class="boton" href="index.html">Ver eventos</a></div>';
    return;
  }

  function contactoOrg(texto) {
    if (!config.whatsapp) return '';
    return '<a href="' + SL.linkWhatsApp(config.whatsapp, texto) + '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>';
  }

  function estadoEfectivo(p) {
    if (p.estado === 'pendiente' && p.expira < Date.now()) return 'vencida';
    return p.estado;
  }

  function consultar() {
    SL.db.obtener('pedidos/' + id, null, function (e, p) {
      if (e && !pedido) {
        vista.innerHTML = '<div class="estado-fin"><h1>Sin conexión</h1><p>No pudimos cargar tu boleta. Revisa tu internet; la página vuelve a intentar sola.</p></div>';
        return;
      }
      if (e) return;
      if (!p) {
        vista.innerHTML = '<div class="estado-fin"><h1>Boleta no encontrada</h1><p>Revisa que el enlace esté completo.</p>' +
          '<a class="boton" href="index.html">Ver eventos</a></div>';
        detener();
        return;
      }
      p.id = id;
      pedido = p;
      pintar();
    });
  }

  function detener() {
    clearInterval(sondeo);
    clearInterval(reloj);
  }

  function pintar() {
    var est = estadoEfectivo(pedido);
    var clave = est + ':' + (pedido.usadas || 0);
    if (clave === vistaActual) return;
    var antes = vistaActual;
    vistaActual = clave;
    if (est === 'pendiente') return pintarPago();
    clearInterval(reloj);
    if (est === 'aprobada') {
      pintarBoleta(antes.indexOf('pendiente') === 0);
      return;
    }
    detener();
    if (est === 'vencida') {
      vista.innerHTML = '<div class="estado-fin"><h1>Tu reserva venció</h1>' +
        '<p>Pasó el tiempo para pagar y las boletas se liberaron. Si ya hiciste el pago, no te preocupes: ' +
        (contactoOrg('Hola, pagué la boleta del pedido ' + pedido.codigo + ' pero la reserva venció.') || 'escríbenos') +
        ' con tu código <strong>' + SL.esc(pedido.codigo) + '</strong>.</p>' +
        '<a class="boton" href="index.html#e=' + SL.esc(pedido.ev) + '">Volver a comprar</a></div>';
    } else {
      vista.innerHTML = '<div class="estado-fin"><h1>Pedido anulado</h1>' +
        '<p>El organizador anuló este pedido. ' + contactoOrg('Hola, tengo una pregunta sobre el pedido ' + pedido.codigo) + '</p>' +
        '<a class="boton" href="index.html">Ver eventos</a></div>';
    }
  }

  function pintarPago() {
    var p = pedido;
    var qr = config.qr ?
      '<img class="qr-nequi" src="' + config.qr + '" alt="Código QR de pago de ' + SL.esc(config.organizador || '') + '">' +
      '<a class="tipo-nota" href="' + config.qr + '" download="qr-pago.png">Descargar QR para leerlo desde la galería</a>' : '';
    var llave = config.llave ?
      '<div class="llave"><code>' + SL.esc(config.llave) + '</code>' +
      '<button type="button" class="boton claro chico" id="copiar-llave">Copiar llave</button></div>' : '';

    vista.innerHTML =
      '<section class="estado-pago">' +
        '<h1>Falta tu pago</h1>' +
        '<p>' + p.cant + ' × ' + SL.esc(p.tipoNombre) + ' para ' + SL.esc(p.evNombre) + '</p>' +
        '<div class="reloj" id="reloj">' + SL.cuentaAtras(p.expira - Date.now()) +
        '<small>para pagar antes de que se libere tu boleta</small></div>' +
      '</section>' +
      '<section class="monto-pagar">' +
        '<div style="font-weight:600">Paga exactamente</div>' +
        '<div class="total-cifra">' + SL.plata(p.total) + '</div>' +
        '<p>desde la cuenta de ' + SL.esc(p.titular) + '</p>' +
      '</section>' +
      '<ol class="pasos">' +
        '<li><div>Abre Nequi o la app de tu banco y paga por Bre-B a esta llave' + (config.qr ? ', o escanea el QR' : '') + '.' + llave + qr + '</div></li>' +
        '<li><div>Escribe el valor exacto: <strong>' + SL.plata(p.total) + '</strong>.</div></li>' +
        '<li><div>Deja esta página abierta. Tu boleta aparece sola cuando entre el pago, casi siempre en uno o dos minutos.</div></li>' +
      '</ol>' +
      '<div class="esperando"><span class="pulso"></span><span>Esperando tu pago. Código del pedido: <strong>' + SL.esc(p.codigo) + '</strong></span></div>' +
      '<p class="tipo-nota" style="margin-top:16px">¿Pagaste desde otra cuenta o pasaron más de 10 minutos? ' +
        (contactoOrg('Hola, ya pagué el pedido ' + p.codigo + ' (' + SL.plata(p.total) + ') y no me aparece la boleta.') || 'Contacta al organizador') + ' con tu código.</p>';

    var b = SL.$('#copiar-llave');
    if (b) b.onclick = function () { SL.copiar(config.llave, function () { SL.aviso('Llave copiada', 'ok'); }); };

    clearInterval(reloj);
    reloj = setInterval(function () {
      var falta = pedido.expira - Date.now();
      var r = SL.$('#reloj');
      if (r) r.firstChild.nodeValue = SL.cuentaAtras(falta);
      if (falta <= 0) {
        consultar();
      }
    }, 1000);
  }

  function pintarBoleta(recienAprobada) {
    var p = pedido;
    var entradas = p.entradas || p.cant || 1;
    var usadas = p.usadas || 0;
    var qr = qrcode(0, 'M');
    qr.addData('SL1:' + p.id);
    qr.make();
    var sello = '';
    if (usadas >= entradas) sello = '<div class="sello usada">Ya se usó para ingresar</div>';
    else if (usadas > 0) sello = '<div class="sello usada">Ingresaron ' + usadas + ' de ' + entradas + '</div>';
    else sello = '<div class="sello">Pago confirmado. Muestra este QR en la puerta.</div>';

    vista.innerHTML =
      '<article class="tiquete">' +
        '<div class="tiquete-cabeza"><h1>' + SL.esc(p.evNombre) + '</h1>' +
        '<p>' + SL.esc(SL.fechaLarga(p.evFecha)) + '</p></div>' +
        sello +
        '<div class="tiquete-qr">' + qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) + '</div>' +
        '<div class="tiquete-corte" aria-hidden="true"></div>' +
        '<div class="tiquete-datos">' +
          '<div class="dato grande"><span>Entradas</span><strong>' + entradas + '</strong></div>' +
          '<div class="dato grande"><span>Código</span><strong>' + SL.esc(p.codigo) + '</strong></div>' +
          '<div class="dato"><span>Nombre</span><strong>' + SL.esc(p.nombre) + '</strong></div>' +
          '<div class="dato"><span>Boleta</span><strong>' + SL.esc(p.cortesia ? 'Cortesía' : p.tipoNombre) + (p.cant > 1 ? ' × ' + p.cant : '') + '</strong></div>' +
        '</div>' +
        (p.grabado ? '<div class="tiquete-rec"><span class="punto-rec" aria-hidden="true"></span>Este evento se graba en audio y video</div>' : '') +
      '</article>' +
      '<div class="acciones">' +
        '<button class="boton negro" type="button" id="compartir">Guardar enlace de mi boleta</button>' +
        '<p class="tipo-nota" style="margin:0;text-align:center">También puedes tomarle pantallazo al QR.</p>' +
      '</div>';

    SL.$('#compartir').onclick = function () {
      var link = SL.linkBoleta(p.id);
      if (navigator.share) {
        navigator.share({ title: 'Mi boleta: ' + p.evNombre, url: link })['catch'](function () {});
      } else {
        SL.copiar(link, function () { SL.aviso('Enlace copiado', 'ok'); });
      }
    };
    if (recienAprobada) SL.aviso('¡Pago recibido! Aquí está tu boleta', 'ok');
    SL.guardarMiBoleta({ id: p.id, codigo: p.codigo, evento: p.evNombre });
  }

  SL.db.obtener('config', null, function (e, c) {
    config = c || {};
    consultar();
    sondeo = setInterval(function () {
      if (!document.hidden) consultar();
    }, 3000);
  });
})();
