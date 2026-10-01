/* =====================================================================
   probar_complemento.js — las dos páginas publicables

   Son DOS, y la separación es el proyecto entero en miniatura:

     panel.html       el lanzador · 3 módulos · estado del libro y botones
     modelador.html   la aplicación · 27 módulos · en un diálogo de 88 × 88

   Antes había UNA sola página de cuatro pestañas de solo mirar, registrada
   como panel de tareas: salía aplastada en una franja de 320 px y no
   escribía una celda. Se tiró.

   LAS DOS SE EJECUTAN AQUÍ CONTRA UN DOM DE JUGUETE, y hace falta porque
   ya pasó: una llamada a una función que no existía reventaba la página en
   la primera línea, y ninguna de las otras comprobaciones lo veía.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const BUNDLE = require("../src/bundle.js");
const INV = require("../src/inventario.js");

const DIR = path.join(__dirname, "..", "complemento");
const leer = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

/* ================================================================
   0 · ESTÁ GENERADO Y NO ESTÁ RANCIO
   ================================================================ */
cierto("la guarda alDiaOMuere() lo da por al día", BUNDLE.alDiaOMuere() === true);
for (const f of ["panel.html", "modelador.html", "manifest.xml", "index.html",
  "icono-16.png", "icono-32.png", "icono-80.png"]) {
  cierto("existe " + f, fs.existsSync(path.join(DIR, f)));
}
cierto("la página vieja de cuatro pestañas ya no está",
  !fs.existsSync(path.join(DIR, "taskpane.html")));
cierto("ni su plantilla",
  !fs.existsSync(path.join(__dirname, "..", "scripts", "complemento.plantilla.html")));

const panelHtml = leer("panel.html");
const modeHtml = leer("modelador.html");

/* EL LANZADOR ES PEQUEÑO, Y NO POR OPTIMIZAR: no calcula, así que no lleva
   el catálogo de 2408 perfiles. */
cierto("el panel pesa mucho menos que el modelador",
  panelHtml.length < modeHtml.length / 4);
cierto("y no lleva el catálogo dentro", panelHtml.indexOf("CATALOGOS_DATOS") < 0);
cierto("el modelador sí", modeHtml.indexOf("CATALOGOS_DATOS") >= 0);
for (const [n, h] of [["panel", panelHtml], ["modelador", modeHtml]]) {
  cierto(n + " carga Office.js del CDN de Microsoft",
    /appsforoffice\.microsoft\.com\/lib\/1\/hosted\/office\.js/.test(h));
  cierto(n + " lleva su sello de build", /window\.GALPON_BUILD = "/.test(h));
}

/* ---------- el DOM de juguete ---------- */
function montaDom(win) {
  const val = {};
  if (win.VISTAS) {
    for (const e of win.VISTAS.ENTRADAS) {
      val["c_" + e.id] = {
        value: e.tipo === "si/no" ? "" : String(e.valor),
        checked: e.tipo === "si/no" ? !!e.valor : false
      };
    }
  }
  const nodos = {};
  function nodo(id) {
    if (nodos[id]) return nodos[id];
    const n = {
      id: id, innerHTML: "", textContent: "", hidden: false, className: "",
      value: val[id] ? val[id].value : "",
      checked: val[id] ? val[id].checked : false,
      _at: {}, onclick: null,
      addEventListener: function (t, fn) { (this._ev = this._ev || {})[t] = fn; },
      setAttribute: function (k, v) { this._at[k] = v; },
      getAttribute: function (k) { return this._at[k] === undefined ? null : this._at[k]; },
      querySelectorAll: function () { return []; },
      closest: function () { return null; }
    };
    nodos[id] = n;
    return n;
  }
  return { doc: { getElementById: nodo, addEventListener: function () {} },
    nodos: nodos, valores: val };
}
const pinto = (dm, id) => (dm && dm.nodos[id]) ||
  { innerHTML: "", textContent: "", hidden: null };

function carga(html, conDom) {
  const b = [];
  const re = /<script>\n([\s\S]*?)\n<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) b.push(m[1]);
  const win = {};
  win.window = win; win.self = win;
  win.alert = function () {};
  const ctx = vm.createContext(win);
  let err = null;
  try { vm.runInContext(b[0], ctx, { filename: "modulos.js" }); }
  catch (e) { err = e; }
  let dom = null, errApp = null;
  if (!err && conDom) {
    dom = montaDom(win);
    win.document = dom.doc;
    try { vm.runInContext(b[1], ctx, { filename: "app.js" }); }
    catch (e) { errApp = e; }
  }
  return { win: win, dom: dom, bloques: b.length, err: err, errApp: errApp };
}

/* ================================================================
   1 · EL LANZADOR
   ================================================================ */
const P = carga(panelHtml, true);
comp("el panel tiene dos bloques de script", P.bloques, 2);
cierto("sus módulos cargan" + (P.err ? ": " + P.err.message : ""), !P.err);
comp("y son los tres que necesita",
  ["INVENTARIO", "LIBRO", "PANEL"].filter((k) => !P.win[k]), []);
cierto("no lleva los de cálculo: no es su trabajo",
  !P.win.ACERO && !P.win.MONTAJE && !P.win.VISTAS);
cierto("LA PÁGINA DEL PANEL SE EJECUTA SIN REVENTAR" +
  (P.errApp ? ": " + P.errApp.message : ""), !P.errApp);

cierto("pinta la ficha del libro", /class="ln"/.test(pinto(P.dom, "ficha").innerHTML));
cierto("pinta los tres botones",
  (pinto(P.dom, "botones").innerHTML.match(/<button/g) || []).length === 3);

/* LA GUARDA EN PANTALLA: Guardar nace apagado y dice por qué */
const bot = pinto(P.dom, "botones").innerHTML;
cierto("«Abrir modelador» es el botón principal", /class="b pri"/.test(bot));
cierto("y Guardar nace deshabilitado", /id="btn-guardar" disabled/.test(bot));
cierto("con la razón escrita debajo", /abre el modelador primero/.test(bot));
cierto("el estado dice que el libro venía vacío",
  /no tra[íi]a ning[úu]n modelo/.test(pinto(P.dom, "estado").textContent));
cierto("y los tres pasos del cómo se usa están",
  (pinto(P.dom, "uso").innerHTML.match(/<li>/g) || []).length === 3);

/* Abre el diálogo como Retícula, y por las razones de Retícula */
cierto("abre el diálogo a 88 × 88", /height:\s*88,\s*width:\s*88/.test(panelHtml));
cierto("y fuera de iframe, que es lo que lo hace grande",
  /displayInIframe:\s*false/.test(panelHtml));
cierto("con el sello de minuto contra la caché de WebView2",
  /Math\.floor\(Date\.now\(\) \/ 60000\)/.test(panelHtml));
cierto("apuntando al modelador", /modelador\.html/.test(panelHtml));
cierto("escribe en la hoja MUY oculta, no solo oculta", /veryHidden/.test(panelHtml));
cierto("y usa el rango y el troceado de libro.js",
  /LIBRO\.RANGO/.test(panelHtml) && /LIBRO\.paraElRango/.test(panelHtml));
cierto("valida lo que llega de la ventana ANTES de escribirlo",
  /PANEL\.recibeDeLaVentana/.test(panelHtml));

/* ================================================================
   2 · EL MODELADOR
   ================================================================ */
const M = carga(modeHtml, true);
comp("el modelador tiene dos bloques", M.bloques, 2);
cierto("sus módulos cargan" + (M.err ? ": " + M.err.message : ""), !M.err);
const ESPERADOS = ["INVENTARIO", "UNIDADES", "PROPIEDADES", "PERFILES", "E020",
  "VIENTO", "E030", "COMBINACIONES", "MODELO", "SOLVER", "ESTABILIDAD", "RIOSTRAS",
  "ACERO", "ELEMENTO", "BUCLE", "CORREAS", "TIJERAL", "COLUMNAS", "ARRIOSTRES",
  "PLACABASE", "GENERADOR", "MONTAJE", "VISTA3D", "VISTAS", "LIBRO", "PANEL",
  "PROYECTO"];
comp("los 27 módulos quedan colgados de window",
  ESPERADOS.filter((k) => !M.win[k]), []);
cierto("LA PÁGINA DEL MODELADOR SE EJECUTA SIN REVENTAR" +
  (M.errApp ? ": " + M.errApp.message : ""), !M.errApp);

/* LA BARRA DE PASOS */
const pasos = pinto(M.dom, "pasos").innerHTML;
comp("hay once botones de paso", (pasos.match(/data-paso=/g) || []).length, 11);
cierto("agrupados por ESTADO, PASO n y SALIDA",
  /Estado/.test(pasos) && /Paso 2 · Modelo/.test(pasos) && /Salida/.test(pasos));
cierto("los que no tienen pantalla se marcan en vez de fingirse",
  /class="falta"/.test(pasos));
cierto("y entre ellos están Hojas Excel y AutoCAD",
  /Hojas Excel/.test(pasos) && /AutoCAD/.test(pasos));

/* LAS VISTAS Y EL LIENZO */
const vistas = pinto(M.dom, "vistas").innerHTML;
comp("cuatro vistas", (vistas.match(/data-v=/g) || []).length, 4);
cierto("Pórtico, Planta de techo, Elevación y 3D",
  /Pórtico/.test(vistas) && /Planta de techo/.test(vistas) &&
  /Elevación/.test(vistas) && />3D</.test(vistas));

const centro = pinto(M.dom, "centro").innerHTML;
cierto("EL LIENZO DIBUJA", /<svg /.test(centro));
cierto("con el galpón entero, no cuatro líneas",
  (centro.match(/<line /g) || []).length > 40);
cierto("y con su leyenda", /class="leyenda"/.test(centro));

/* LAS MÉTRICAS VIVAS */
const met = pinto(M.dom, "metricas").innerHTML;
cierto("la barra de métricas trae la luz y el largo",
  /Luz/.test(met) && /Largo/.test(met));
cierto("los pórticos y el acero medido", /Pórticos/.test(met) && /Acero/.test(met));
cierto("LA PASADA, que es de Galpón y no de Retícula", /Pasada/.test(met));
cierto("y el selector de combinación", /Combinación/.test(met));

/* EL PANEL DERECHO · la tesis */
const der = pinto(M.dom, "derecha").innerHTML;
cierto("el panel derecho trae fichas", /class="tarj/.test(der));
const lineas = (der.match(/<div class="ln">/g) || []).length;
const conFuente = (der.match(/data-fte="/g) || []).length;
const conOrigen = (der.match(/<span class="org">/g) || []).length;
cierto("con líneas de verdad", lineas >= 8);
comp("y TODAS declaran su procedencia, sin excepción",
  lineas, conFuente + conOrigen);
const fuentes = (der.match(/data-fte="([^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
comp("todo botón de fuente apunta a una fila que existe",
  fuentes.filter((id) => !INV.existe(id)), []);

/* LAS HERRAMIENTAS, QUE TODAVÍA NO DIBUJAN Y LO DICEN */
const herr = pinto(M.dom, "herr").innerHTML;
cierto("la paleta de herramientas está", (herr.match(/data-h=/g) || []).length >= 7);
cierto("con el arriostre entre ellas", /Arriostre/.test(herr));
cierto("y el código avisa de que todavía no editan",
  /Esa herramienta todavía no dibuja/.test(modeHtml));
cierto("explicando que lo que se ve SÍ es real",
  /generador\.js la monta/.test(modeHtml));
cierto("y qué pasará cuando edite: capas sobre lo paramétrico",
  /se guardará como CAPA/.test(modeHtml));

/* LOS PASOS QUE NO ESTÁN NO SE FINGEN */
cierto("un paso sin pantalla lo dice y nombra lo que falta",
  /Todavía no hay pantalla/.test(modeHtml) && /El motor:/.test(modeHtml));
cierto("y explica por qué no se pone una maqueta",
  /engaña más que una que avisa/.test(modeHtml));

/* EL CANAL */
cierto("el modelador pide el modelo al abrir", /a: "pide"/.test(modeHtml));
cierto("contesta por messageParent", /messageParent/.test(modeHtml));
cierto("y trocea lo que manda", /LIBRO\.troceaMensaje/.test(modeHtml));
cierto("escucha al panel por DialogParentMessageReceived",
  /DialogParentMessageReceived/.test(modeHtml));

/* ================================================================
   3 · EL MISMO GALPÓN EN LAS DOS Y EN NODE
   ================================================================ */
const D = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const MON = require("../src/montaje.js");
const nav = M.win.MONTAJE.monta(D);
const nod = MON.monta(D);
comp("el modelador y Node dan el mismo conteo", nav.conteo, nod.conteo);
cerca("y el mismo metrado al milímetro",
  M.win.MONTAJE.metrado(nav).total_m, MON.metrado(nod).total_m, 1e-12);
comp("el inventario servido es el mismo", M.win.INVENTARIO.resumen(), INV.resumen());
comp("y el del panel también", P.win.INVENTARIO.resumen(), INV.resumen());
lanza("las guardas siguen negándose dentro del paquete horneado",
  () => M.win.MONTAJE.monta(Object.assign({}, D, { panosArriostradosTecho: [] })),
  "NO HAY ARRIOSTRE DE TECHO");

/* ================================================================
   4 · EL MANIFIESTO
   ================================================================ */
const man = leer("manifest.xml");
cierto("es XML y lo declara", /^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(man));
cierto("es un panel de tareas de Excel",
  /xsi:type="TaskPaneApp"/.test(man) && /<Host Name="Workbook"\/>/.test(man));
cierto("APUNTA AL PANEL, no al modelador: el modelador lo abre el panel",
  /SourceLocation DefaultValue="[^"]*\/panel\.html"/.test(man));
cierto("PIDE DialogApi 1.2, sin el cual no puede contestarle a la ventana",
  /<Set Name="DialogApi" MinVersion="1\.2"\/>/.test(man));
cierto("y explica para qué en un comentario", /messageChild/.test(man));
const guid = /<Id>([^<]+)<\/Id>/.exec(man)[1];
cierto("el Id es un GUID bien formado",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid));
const urls = (man.match(/DefaultValue="(https?:[^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
comp("todas las URL son https y van al sitio",
  urls.filter((u) => u.indexOf("https://vicmezap.github.io/galpon") !== 0), []);
cierto("añade la pestaña Galpón en la cinta",
  /<CustomTab id="mezap\.galpon\.tab">/.test(man));
for (const n of [16, 32, 80]) {
  const b = fs.readFileSync(path.join(DIR, "icono-" + n + ".png"));
  comp("icono-" + n + ".png mide " + n + " px", b.readUInt32BE(16), n);
}

/* ================================================================
   5 · LA PORTADA Y EL GENERADOR
   ================================================================ */
const portada = leer("index.html");
cierto("la portada enlaza el modelador", /href="modelador\.html"/.test(portada));
cierto("y el manifiesto con las instrucciones", /href="manifest\.xml"/.test(portada));
cierto("y dice cuántas filas tiene el inventario", /390 filas/.test(portada));

const gen = fs.readFileSync(path.join(__dirname, "..", "scripts",
  "gen_complemento.py"), "utf8");
const saca = (rx) => (gen.match(rx) || [])
  .map((s) => (/"([a-z0-9_]+\.js)"/.exec(s) || [])[1]).filter(Boolean);
const enLista = saca(/^[ \t]*"[a-z0-9_]+\.js",/gm);
const enFuera = saca(/^[ \t]*"[a-z0-9_]+\.js":/gm);
const enSrc = fs.readdirSync(path.join(__dirname, "..", "src"))
  .filter((f) => f.endsWith(".js"));
comp("todo módulo de src/ está en la lista o declarado fuera con su motivo",
  enSrc.filter((f) => enLista.indexOf(f) < 0 && enFuera.indexOf(f) < 0), []);
comp("el único que se queda fuera es la guarda de Node", enFuera, ["bundle.js"]);
cierto("el panel se hornea con una lista corta y propia",
  /MODULOS_PANEL = \["inventario\.js", "libro\.js", "panel\.js"\]/.test(gen));

fin();
