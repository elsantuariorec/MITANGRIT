/* Santuario Live — cartelera y compra (ES5) */
(function () {
  var vista = SL.$('#vista');
  var config = {};
  var eventos = {};

  SL.cintaDemo();

  function cargar() {
    SL.db.obtener('config', null, function (e1, c) {
      config = c || {};
      if (config.organizador) {
        SL.$('#organizador').textContent = 'Boletas de ' + config.organizador;
      }
      SL.db.obtener('eventos', null, function (e2, evs) {
        if (e2) {
          vista.innerHTML = '<div class="vacio" style="margin:48px 0">No pudimos cargar los eventos. Revisa tu conexión y recarga la página.</div>';
          return;
        }
        eventos = evs || {};
        router();
      });
    });
  }

  function router() {
    var id = SL.param('e', location.hash);
    if (id && eventos[id]) detalle(id);
    else cartelera();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', router);

  function eventosVisibles() {
    var limite = Date.now() - 12 * 3600000;
    var l = [];
    for (var id in eventos) {
      if (!eventos.hasOwnProperty(id)) continue;
      var ev = eventos[id];
      var f = SL.aFecha(ev.fecha);
      if (ev.publicado && f && f.getTime() > limite) {
        ev.id = id;
        l.push(ev);
      }
    }
    l.sort(function (a, b) { return SL.aFecha(a.fecha) - SL.aFecha(b.fecha); });
    return l;
  }

  function precioDesde(ev) {
    var min = null, ahora = Date.now();
    SL.tiposOrdenados(ev).forEach(function (t) {
      var fin = SL.aFecha(t.hasta);
      if (fin && ahora > fin.getTime()) return;
      if (min === null || t.precio < min) min = t.precio;
    });
    return min;
  }

  /* ---------- cartelera ---------- */

  function cartelera() {
    document.title = 'Santuario Live · Boletas';
    var l = eventosVisibles();
    var h = '<section class="portada"><h1>Próximos eventos</h1>' +
      '<p>Aparta tu entrada, paga con Nequi o Bre-B y tu boleta aparece aquí mismo en un par de minutos.</p></section>';

    var mias = SL.misBoletas();
    if (mias.length) {
      h += '<div class="caja" style="margin-bottom:24px"><h3>Tus boletas</h3>';
      mias.slice(0, 3).forEach(function (b) {
        h += '<div><a href="boleta.html?id=' + SL.esc(b.id) + '">' + SL.esc(b.evento) + ' (' + SL.esc(b.codigo) + ')</a></div>';
      });
      h += '</div>';
    }

    h += '<div class="lista-eventos">';
    if (!l.length) {
      h += '<div class="vacio">Por ahora no hay eventos a la venta. Vuelve pronto.</div>';
    }
    l.forEach(function (ev) {
      var f = SL.aFecha(ev.fecha);
      var desde = precioDesde(ev);
      h += '<a class="boleto" href="#e=' + SL.esc(ev.id) + '">' +
        '<div class="boleto-cuerpo">' +
          '<div class="fecha-bloque"><div class="fecha-dia">' + f.getDate() + '</div>' +
          '<div class="fecha-mes">' + SL.MESES_CORTOS[f.getMonth()] + '</div></div>' +
          '<div style="min-width:0"><h2 class="ev-nombre">' + SL.esc(ev.nombre) + '</h2>' +
          '<div class="ev-lugar">' + SL.esc(SL.DIAS[f.getDay()]) + ', ' + SL.hora(f) + ' en ' + SL.esc(ev.lugar || '') + '</div></div>' +
        '</div>' +
        '<div class="boleto-talon">' +
          (desde === null ? '<div class="talon-precio">Agotado</div>' :
            '<div class="talon-precio">' + (desde === 0 ? 'Gratis' : SL.plata(desde)) + '</div>') +
          '<div class="talon-accion">Comprar</div>' +
        '</div>' +
      '</a>';
    });
    h += '</div>';
    vista.innerHTML = h;
  }

  /* ---------- detalle y compra ---------- */

  var estado = null;

  function detalle(id) {
    var ev = eventos[id];
    ev.id = id;
    document.title = ev.nombre + ' · Santuario Live';
    estado = { ev: ev, tipo: null, cant: 1, usados: {}, flyer: null };
    pintarDetalle();
    SL.db.obtener('flyers/' + id, null, function (e, img) {
      if (img && estado && estado.ev.id === id) {
        estado.flyer = img;
        SL.$('#flyer').innerHTML = '<img src="' + img + '" alt="Flyer de ' + SL.esc(ev.nombre) + '">';
      }
    });
    refrescarCupos();
  }

  function refrescarCupos(cb) {
    var id = estado.ev.id;
    SL.db.obtener('ocupacion/' + id, null, function (e, oc) {
      if (!estado || estado.ev.id !== id) return;
      estado.usados = SL.ocupadas(oc, Date.now());
      pintarTipos();
      if (cb) cb(e);
    });
  }

  function pintarDetalle() {
    var ev = estado.ev;
    var f = SL.aFecha(ev.fecha);
    var h = '<a class="volver" href="#">‹ Todos los eventos</a>' +
      '<div class="detalle">' +
        '<div class="flyer" id="flyer"><div class="flyer-sin-imagen">' +
          '<div class="fecha-dia">' + f.getDate() + '</div>' +
          '<h2>' + SL.esc(ev.nombre) + '</h2></div></div>' +
        '<div class="detalle-info">' +
          '<h1>' + SL.esc(ev.nombre) + '</h1>' +
          '<div class="detalle-meta"><div>' + SL.esc(SL.fechaLarga(ev.fecha)) + '</div>' +
          '<div>' + SL.esc(ev.lugar || '') + (ev.direccion ? ', ' + SL.esc(ev.direccion) : '') + '</div></div>' +
          (ev.descripcion ? '<p class="detalle-desc">' + SL.esc(ev.descripcion) + '</p>' : '') +
          '<form class="bloque-compra" id="compra" novalidate>' +
            '<h2>Boletas</h2>' +
            '<div class="tipos" id="tipos"></div>' +
            '<div id="resto-compra" class="oculto">' +
              '<span style="display:block;font-weight:600;margin-bottom:6px">Cantidad</span>' +
              '<div class="cantidad"><button type="button" id="menos" aria-label="Menos">−</button>' +
              '<output id="cant">1</output><button type="button" id="mas" aria-label="Más">+</button></div>' +
              '<div class="fila-total"><div><div style="font-weight:600">Total</div><div class="tipo-nota" id="nota-total"></div></div>' +
              '<div class="total-cifra" id="total">$0</div></div>' +
              '<label class="campo"><span>Nombre completo</span><input id="f-nombre" autocomplete="name" required></label>' +
              '<div class="fila-campos">' +
                '<label class="campo"><span>Cédula</span><input id="f-doc" inputmode="numeric" autocomplete="off" required></label>' +
                '<label class="campo"><span>WhatsApp</span><input id="f-wa" inputmode="tel" autocomplete="tel" placeholder="300 123 4567" required></label>' +
              '</div>' +
              '<label class="check"><input type="checkbox" id="f-yo" checked> <span>Voy a pagar desde mi propia cuenta</span></label>' +
              '<label class="campo oculto" id="campo-titular"><span>¿A nombre de quién está la cuenta que paga?</span>' +
                '<input id="f-titular" autocomplete="off"><small>Así reconocemos tu pago automáticamente.</small></label>' +
              '<p class="error-form" id="error-compra" role="alert"></p>' +
              '<button class="boton ancho" type="submit" id="apartar">Apartar y pagar</button>' +
              '<p class="tipo-nota" style="margin-top:10px" id="nota-reserva"></p>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    vista.innerHTML = h;

    SL.$('#menos').onclick = function () { cambiarCant(-1); };
    SL.$('#mas').onclick = function () { cambiarCant(1); };
    SL.$('#f-yo').onchange = function () {
      SL.$('#campo-titular').className = this.checked ? 'campo oculto' : 'campo';
    };
    SL.$('#compra').onsubmit = function (e) { e.preventDefault(); apartar(); };
    SL.$('#nota-reserva').textContent = 'Tu entrada queda apartada ' + (config.minutosReserva || 30) +
      ' minutos mientras haces el pago.';
    pintarTipos();
  }

  function pintarTipos() {
    var cont = SL.$('#tipos');
    if (!cont) return;
    var ahora = Date.now();
    var tipos = SL.tiposOrdenados(estado.ev);
    var h = '';
    if (!tipos.length) h = '<div class="vacio">Las boletas todavía no están a la venta.</div>';
    tipos.forEach(function (t) {
      var st = SL.estadoTipo(t, estado.usados[t.id], ahora);
      var elegido = estado.tipo === t.id && st.abierta;
      var notas = [];
      if (t.personas > 1) notas.push('Entran ' + t.personas + ' personas');
      var fin = SL.aFecha(t.hasta);
      if (st.abierta && fin) notas.push('Hasta el ' + fin.getDate() + ' de ' + SL.MESES[fin.getMonth()]);
      if (st.texto) notas.push(st.texto);
      h += '<label class="tipo' + (elegido ? ' elegido' : '') + (st.abierta ? '' : ' cerrado') + '">' +
        '<input type="radio" name="tipo" value="' + SL.esc(t.id) + '"' + (elegido ? ' checked' : '') + (st.abierta ? '' : ' disabled') + '>' +
        '<span class="tipo-info"><span class="tipo-nombre">' + SL.esc(t.nombre) + '</span>' +
        (notas.length ? '<span class="tipo-nota" style="display:block">' + SL.esc(notas.join('. ')) + '</span>' : '') + '</span>' +
        '<span class="tipo-precio">' + (t.precio ? SL.plata(t.precio) : 'Gratis') + '</span></label>';
      if (estado.tipo === t.id && !st.abierta) estado.tipo = null;
    });
    cont.innerHTML = h;
    SL.$$('input[name=tipo]', cont).forEach(function (r) {
      r.onchange = function () {
        estado.tipo = this.value;
        estado.cant = 1;
        pintarTipos();
      };
    });
    SL.$('#resto-compra').className = estado.tipo ? '' : 'oculto';
    var tt = tipoActual();
    SL.$('#apartar').textContent = tt && !tt.precio ? 'Reservar gratis' : 'Apartar y pagar';
    actualizarTotal();
  }

  function tipoActual() { return estado.tipo ? estado.ev.tipos[estado.tipo] : null; }

  function maximo() {
    var t = tipoActual();
    if (!t) return 1;
    var st = SL.estadoTipo(t, estado.usados[estado.tipo], Date.now());
    return Math.max(1, Math.min(6, st.disponibles));
  }

  function cambiarCant(d) {
    estado.cant = Math.max(1, Math.min(maximo(), estado.cant + d));
    actualizarTotal();
  }

  function actualizarTotal() {
    var t = tipoActual();
    if (!t) return;
    if (estado.cant > maximo()) estado.cant = maximo();
    SL.$('#cant').textContent = estado.cant;
    SL.$('#menos').disabled = estado.cant <= 1;
    SL.$('#mas').disabled = estado.cant >= maximo();
    SL.$('#total').textContent = SL.plata(t.precio * estado.cant);
    var personas = (t.personas || 1) * estado.cant;
    SL.$('#nota-total').textContent = estado.cant + ' × ' + t.nombre + (personas !== estado.cant ? ', ' + personas + ' personas' : '');
  }

  function apartar() {
    var err = SL.$('#error-compra');
    err.textContent = '';
    var t = tipoActual();
    var nombre = SL.$('#f-nombre').value.replace(/\s+/g, ' ').trim();
    var doc = SL.soloDigitos(SL.$('#f-doc').value);
    var wa = SL.soloDigitos(SL.$('#f-wa').value);
    if (wa.length === 12 && wa.indexOf('57') === 0) wa = wa.slice(2);
    var yo = SL.$('#f-yo').checked;
    var titular = yo ? nombre : SL.$('#f-titular').value.replace(/\s+/g, ' ').trim();

    if (!t) return (err.textContent = 'Elige un tipo de boleta.');
    if (nombre.split(' ').length < 2) return (err.textContent = 'Escribe tu nombre y apellido.');
    if (doc.length < 5) return (err.textContent = 'Revisa el número de cédula.');
    if (wa.length !== 10) return (err.textContent = 'El WhatsApp debe tener 10 dígitos.');
    if (!titular) return (err.textContent = 'Escribe el nombre del titular de la cuenta que va a pagar.');

    var boton = SL.$('#apartar');
    boton.disabled = true;
    boton.textContent = 'Apartando…';

    refrescarCupos(function () {
      var st = SL.estadoTipo(t, estado.usados[estado.tipo], Date.now());
      if (!st.abierta || st.disponibles < estado.cant) {
        boton.disabled = false;
        boton.textContent = 'Apartar y pagar';
        err.textContent = st.abierta ? 'Solo quedan ' + st.disponibles + ' boletas de este tipo.' : 'Esta boleta ya no está disponible.';
        return;
      }
      var ahora = Date.now();
      var id = SL.nuevoId();
      var minutos = config.minutosReserva || 30;
      var gratis = !t.precio;
      var pedido = {
        codigo: SL.nuevoCodigo(),
        ev: estado.ev.id,
        evNombre: estado.ev.nombre,
        evFecha: estado.ev.fecha,
        tipo: estado.tipo,
        tipoNombre: t.nombre,
        cant: estado.cant,
        entradas: estado.cant * (t.personas || 1),
        precio: t.precio,
        total: t.precio * estado.cant,
        nombre: nombre,
        doc: doc,
        wa: wa,
        titular: titular,
        estado: gratis ? 'aprobada' : 'pendiente',
        creado: { '.sv': 'timestamp' },
        expira: ahora + minutos * 60000,
        usadas: 0
      };
      var cambios = {};
      cambios['pedidos/' + id] = pedido;
      cambios['ocupacion/' + estado.ev.id + '/' + id] = { t: estado.tipo, n: estado.cant, e: gratis ? 'a' : 'p', x: gratis ? 0 : pedido.expira };
      SL.db.actualizar(cambios, function (e) {
        if (e) {
          boton.disabled = false;
          boton.textContent = 'Apartar y pagar';
          err.textContent = 'No se pudo apartar la boleta. Intenta de nuevo en un momento.';
          return;
        }
        SL.guardarMiBoleta({ id: id, codigo: pedido.codigo, evento: estado.ev.nombre });
        location.href = 'boleta.html?id=' + id;
      });
    });
  }

  cargar();
})();
