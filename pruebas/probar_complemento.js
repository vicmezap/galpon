/* =====================================================================
   probar_complemento.js — el complemento publicable

   LA PRUEBA QUE IMPORTA ES LA TERCERA.  Las dos primeras comprueban que el
   paquete se arma; la tercera EJECUTA LA PÁGINA ENTERA contra un DOM de
   juguete y comprueba que dibuja.

   Hace falta porque ya pasó, hoy, escribiendo esto: la plantilla llamaba a
   PERFILES.todos() como función y `todos` es un array.  El paquete se
   generaba perfecto, los 22 módulos cargaban, el inventario contestaba — y
   la página habría reventado en la primera línea al abrirla, con la pestaña
   en blanco y el error en una consola que nadie mira.  Ninguna de las otras
   1664 comprobaciones lo habría visto.

   Y la cuarta: que el navegador y Node den LOS MISMOS NÚMEROS.  Si el
   paquete horneado y los módulos sueltos divergen, el complemento enseña
   una cosa y las pruebas demuestran otra.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const BUNDLE = require("../src/bundle.js");
const MONTAJE = require("../src/montaje.js");

const DIR = path.join(__dirname, "..", "complemento");
const TASKPANE = path.join(DIR, "taskpane.html");

/* ================================================================
   0 · ESTÁ GENERADO Y NO ESTÁ RANCIO
   ================================================================ */
cierto("el complemento está generado", fs.existsSync(TASKPANE));
cierto("y la guarda alDiaOMuere() lo da por al día", BUNDLE.alDiaOMuere() === true);
cierto("la guarda vigila complemento/, que es para lo que nació",
  BUNDLE.SALIDAS.some((d) => /complemento$/.test(d)));
for (const f of ["manifest.xml", "index.html", "icono-16.png", "icono-32.png",
  "icono-80.png"]) {
  cierto("existe " + f, fs.existsSync(path.join(DIR, f)));
}

const html = fs.readFileSync(TASKPANE, "utf8");
cierto("la página pesa lo que pesa y se dice: más de 1 MB con el catálogo dentro",
  html.length > 1024 * 1024);
cierto("Office.js se carga desde el CDN de Microsoft, que es el único sitio del que puede venir",
  /appsforoffice\.microsoft\.com\/lib\/1\/hosted\/office\.js/.test(html));

/* Los dos bloques de <script>: primero los módulos horneados, luego la
   aplicación.  Se extraen igual que los leería el navegador. */
const bloques = [];
const re = /<script>\n([\s\S]*?)\n<\/script>/g;
let mm;
while ((mm = re.exec(html)) !== null) bloques.push(mm[1]);
comp("hay dos bloques de script: los módulos y la aplicación", bloques.length, 2);

/* ================================================================
   1 · LOS MÓDULOS, POR EL CAMINO DEL NAVEGADOR
   ================================================================ */
const win = {};
win.window = win;
win.self = win;
const ctx = vm.createContext(win);
let cargo = true, errCarga = "";
try { vm.runInContext(bloques[0], ctx, { filename: "taskpane-modulos.js" }); }
catch (e) { cargo = false; errCarga = e.message; }
cierto("el paquete carga en el camino del navegador" + (cargo ? "" : ": " + errCarga), cargo);

const ESPERADOS = ["INVENTARIO", "UNIDADES", "PROPIEDADES", "PERFILES", "E020",
  "VIENTO", "E030", "COMBINACIONES", "MODELO", "SOLVER", "ESTABILIDAD", "RIOSTRAS",
  "ACERO", "ELEMENTO", "BUCLE", "CORREAS", "TIJERAL", "COLUMNAS", "ARRIOSTRES",
  "GENERADOR", "MONTAJE", "VISTA3D", "VISTAS", "PLACABASE", "LIBRO", "PROYECTO"];
comp("los 26 módulos quedan colgados de window",
  ESPERADOS.filter((k) => !win[k]), []);
comp("y el orden de dependencia es correcto, o alguno habría recibido undefined",
  ESPERADOS.filter((k) => win[k] && typeof win[k] !== "object"), []);

cierto("el inventario viaja horneado dentro", Array.isArray(win.INVENTARIO_DATOS));
cierto("y los catálogos también", Array.isArray(win.CATALOGOS_DATOS));
cierto("y la tabla del TR-4", !!win.TR4_DATOS);
cierto("la página sabe cuándo se horneó", typeof win.GALPON_FECHA === "string");

/* ================================================================
   2 · EL NAVEGADOR Y NODE DICEN LO MISMO
   ================================================================ */
comp("el inventario del navegador es el mismo que el de Node",
  win.INVENTARIO.resumen(), require("../src/inventario.js").resumen());
comp("y el catálogo también",
  win.PERFILES.resumen().total, require("../src/perfiles.js").resumen().total);

const D = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const nav = win.MONTAJE.monta(D);
const nod = MONTAJE.monta(D);
comp("el mismo galpón da el mismo conteo en los dos caminos", nav.conteo, nod.conteo);
cerca("y el mismo metrado al milímetro",
  win.MONTAJE.metrado(nav).total_m, MONTAJE.metrado(nod).total_m, 1e-12);
comp("y el mismo camino de carga",
  nav.camino.recorridoMaximoAlero_m, nod.camino.recorridoMaximoAlero_m);

/* LAS GUARDAS NO SE ABLANDAN AL HORNEARSE. */
lanza("sin arriostre de techo, el paquete del navegador también se niega",
  () => win.MONTAJE.monta(Object.assign({}, D, { panosArriostradosTecho: [] })),
  "NO HAY ARRIOSTRE DE TECHO");
lanza("y el peralte sigue siendo obligatorio",
  () => win.GENERADOR.genera({ cuerdas: "dos_aguas", alma: "howe", luz_m: 20,
    paneles: 6, pendiente: 0.2 }), "OBLIGATORIO");

/* ================================================================
   3 · LA PÁGINA SE EJECUTA Y DIBUJA · un DOM de juguete
   ================================================================ */
function montaDom() {
  /* Los valores por omision salen de VISTAS.ENTRADAS, que es donde ahora se
     declaran: el formulario ya no esta escrito en el HTML, lo pinta la
     plantilla leyendo el modulo. Asi la prueba usa exactamente lo mismo que
     la pagina, y no una copia que se pudra. */
  const val = {};
  for (const e of win.VISTAS.ENTRADAS) {
    val["c_" + e.id] = {
      value: e.tipo === "si/no" ? "" : String(e.valor),
      checked: e.tipo === "si/no" ? !!e.valor : false
    };
  }

  const nodos = {};
  function nodo(id) {
    if (nodos[id]) return nodos[id];
    const n = {
      id: id, innerHTML: "", textContent: "", hidden: false,
      value: val[id] ? val[id].value : "",
      checked: val[id] ? val[id].checked : false,
      _at: {},
      addEventListener: function (tipo, fn) { (this._ev = this._ev || {})[tipo] = fn; },
      setAttribute: function (k, v) { this._at[k] = v; },
      getAttribute: function (k) { return this._at[k] === undefined ? null : this._at[k]; },
      querySelectorAll: function () { return []; },
      closest: function () { return null; }
    };
    nodos[id] = n;
    return n;
  }
  return {
    doc: { getElementById: nodo, addEventListener: function () {} },
    nodos: nodos, valores: val
  };
}

const dom = montaDom();
win.document = dom.doc;
let corrio = true, errApp = "";
try { vm.runInContext(bloques[1], ctx, { filename: "taskpane-app.js" }); }
catch (e) { corrio = false; errApp = e.message; }
cierto("LA PÁGINA ENTERA SE EJECUTA SIN REVENTAR" + (corrio ? "" : ": " + errApp), corrio);

/* Si la página revienta, el nudo que iba a pintarse NO EXISTE en el DOM de
   juguete, y las comprobaciones de abajo se estrellarían con un TypeError
   en vez de salir como fallos.  Un fallo ilegible es medio fallo: el runner
   solo imprime al final, así que el proceso se moriría sin decir nada.
   Pasó probando esto con un mutante. */
function pinto(dm, id) {
  return dm.nodos[id] || { innerHTML: "", textContent: "", hidden: null };
}

/* Y ha dibujado de verdad: las tres vistas con SVG. */
const vPort = pinto(dom, "v-portico"), vPlan = pinto(dom, "v-planta"),
  vElev = pinto(dom, "v-elev"), vTres = pinto(dom, "v-tresd");
cierto("la vista del pórtico trae un SVG", /<svg /.test(vPort.innerHTML));
cierto("la planta de techo también", /<svg /.test(vPlan.innerHTML));
cierto("y la elevación longitudinal", /<svg /.test(vElev.innerHTML));
cierto("y las tres tienen líneas dibujadas, no un SVG vacío",
  (vPort.innerHTML.match(/<line /g) || []).length > 40 &&
  (vPlan.innerHTML.match(/<line /g) || []).length > 40 &&
  (vElev.innerHTML.match(/<line /g) || []).length > 10);

cierto("no hay problemas que mostrar con los datos por omisión",
  pinto(dom, "problemas").hidden === true);
cierto("los sellos dicen cuántas filas tiene el inventario",
  /388/.test(pinto(dom, "sellos").innerHTML));
cierto("y cuántos perfiles hay",
  /2408/.test(pinto(dom, "sellos").innerHTML));

/* ───── LA TESIS EN PANTALLA, Y AHORA EN SU FORMA FUERTE ─────
   No basta con que los botones de fuente apunten a filas que existen: eso
   ya pasaba en E6c y aun asi once de veintitres cifras se ensenaban sin
   decir de donde salian.  Lo que se comprueba es la CONVERSA: que NO HAYA
   NI UNA LINEA sin procedencia declarada (fila V.procedencia). */
const todoHtml = vPort.innerHTML + vPlan.innerHTML + vElev.innerHTML;
const lineas = (todoHtml.match(/<div class="ln">/g) || []).length;
const conFuente = (todoHtml.match(/data-fte="/g) || []).length;
const conOrigen = (todoHtml.match(/<span class="org">/g) || []).length;
cierto("hay lineas de verdad en las tres vistas", lineas >= 30);
comp("TODAS llevan o boton de fuente o procedencia escrita, sin excepcion",
  lineas, conFuente + conOrigen);

const fuentes = (todoHtml.match(/data-fte="([^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
const INV = require("../src/inventario.js");
comp("y todo boton de fuente apunta a una fila que existe",
  fuentes.filter((id) => !INV.existe(id)), []);
cierto("entre ellas la que sostiene el modulo de montaje",
  fuentes.indexOf("MT.no.diafragma") >= 0 && fuentes.indexOf("MT.termica") >= 0);
cierto("y la del conteo de Maxwell", fuentes.indexOf("G.maxwell") >= 0);

/* Y lo que NO es norma lleva su procedencia escrita, no un boton: colgarle
   una norma a un numero que salio de contar barras invita a creerselo. */
for (const et of ["dato", "geometria", "conteo", "medido"]) {
  cierto("se ve la procedencia «" + et + "» en pantalla",
    todoHtml.indexOf(">" + et + "<") >= 0);
}

/* La 3D ya dibuja, y declara si lo que dibuja se puede medir. */
cierto("la pestaña 3D trae su SVG", /<svg /.test(vTres.innerHTML));
cierto("con el galpón entero",
  (vTres.innerHTML.match(/<line /g) || []).length > 700);
cierto("y dice que en isométrica se puede medir",
  /puede medir/.test(vTres.innerHTML));
cierto("algunas líneas van atenuadas: eso es la profundidad",
  /stroke-opacity="0\./.test(vTres.innerHTML));

/* ================================================================
   4 · EL RECHAZO NO SE ABLANDA EN PANTALLA
   El motor LANZA.  La tentación al pintarlo bonito es dejar seguir con un
   aviso al lado; eso sería saltarse la guarda por la puerta de atrás.  Se
   comprueba que la vista se queda SIN DIBUJO.
   ================================================================ */
const dom2 = montaDom();
dom2.valores["c_at"].value = "";        /* sin arriostre de techo */
win.document = dom2.doc;
let corrio2 = true;
try { vm.runInContext(bloques[1], ctx, { filename: "taskpane-app-2.js" }); }
catch (e) { corrio2 = false; }
cierto("la página se ejecuta igual cuando el motor se niega", corrio2);
cierto("y entonces SÍ enseña el problema", pinto(dom2, "problemas").hidden === false);
cierto("con el mensaje entero del motor, sin recortar",
  /NO HAY ARRIOSTRE DE TECHO/.test(pinto(dom2, "problemas-p").textContent) &&
  /E\.020 Art\. 18/.test(pinto(dom2, "problemas-p").textContent));
cierto("y el título deja claro que no es un aviso",
  /no es un aviso/.test(pinto(dom2, "problemas-t").textContent));
cierto("Y NO DIBUJA NADA: ni un SVG en ninguna de las tres vistas",
  !/<svg /.test(pinto(dom2, "v-portico").innerHTML) &&
  !/<svg /.test(pinto(dom2, "v-planta").innerHTML) &&
  !/<svg /.test(pinto(dom2, "v-elev").innerHTML));
cierto("y lo dice con todas las letras",
  /puerta de atr[áa]s/.test(pinto(dom2, "v-portico").innerHTML));

/* ================================================================
   5 · EL MANIFIESTO
   ================================================================ */
const man = fs.readFileSync(path.join(DIR, "manifest.xml"), "utf8");
cierto("es XML y declara su codificación", /^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(man));
cierto("es un complemento de panel de tareas", /xsi:type="TaskPaneApp"/.test(man));
cierto("para Excel", /<Host Name="Workbook"\/>/.test(man));

const guid = /<Id>([^<]+)<\/Id>/.exec(man)[1];
cierto("el Id es un GUID bien formado",
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(guid));

const urls = (man.match(/DefaultValue="(https?:[^"]+)"/g) || [])
  .map((s) => s.replace(/.*="|"$/g, ""));
cierto("hay URL en el manifiesto", urls.length >= 5);
comp("TODAS son https, o Office no carga el complemento",
  urls.filter((u) => u.indexOf("https://") !== 0), []);
comp("y todas apuntan al sitio publicado",
  urls.filter((u) => u.indexOf("https://vicmezap.github.io/galpon") !== 0), []);
cierto("el panel apunta a taskpane.html", /SourceLocation DefaultValue="[^"]*taskpane\.html"/.test(man));
cierto("pide permiso de lectura y escritura del documento",
  /<Permissions>ReadWriteDocument<\/Permissions>/.test(man));
cierto("añade su propia pestaña en la cinta, que es lo que el proyecto quería",
  /<CustomTab id="mezap\.galpon\.tab">/.test(man));
cierto("con un botón que abre el panel", /xsi:type="ShowTaskpane"/.test(man));
for (const n of [16, 32, 80]) {
  cierto("declara el icono de " + n + " px",
    new RegExp('bt:Image id="icono' + n + '"').test(man));
}
cierto("la versión cambia con el día del horneado",
  /<Version>1\.0\.0\.\d{1,3}<\/Version>/.test(man));

/* Los iconos son PNG de verdad, con el tamaño que dice el manifiesto. */
for (const n of [16, 32, 80]) {
  const b = fs.readFileSync(path.join(DIR, "icono-" + n + ".png"));
  cierto("icono-" + n + ".png tiene firma PNG",
    b.slice(0, 8).toString("hex") === "89504e470d0a1a0a");
  comp("y mide " + n + " px de ancho", b.readUInt32BE(16), n);
  comp("y " + n + " de alto", b.readUInt32BE(20), n);
}

/* ================================================================
   6 · LA PORTADA Y EL GENERADOR
   ================================================================ */
const portada = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
cierto("la portada enlaza el complemento", /href="taskpane\.html"/.test(portada));
cierto("y el manifiesto, con las instrucciones para instalarlo",
  /href="manifest\.xml"/.test(portada) && /Cargar mi complemento/.test(portada));
cierto("y el inventario", /href="inventario\.html"/.test(portada));
cierto("y dice cuántas filas tiene", /388 filas/.test(portada));

/* NINGÚN MÓDULO SE QUEDA FUERA POR OLVIDO: el generador lleva la lista a
   mano porque el orden importa, y por eso comprueba que no falte ninguno. */
const gen = fs.readFileSync(path.join(__dirname, "..", "scripts", "gen_complemento.py"), "utf8");
/* `[ 	]*` y no `\s*`: con \s el `^` de una línea en blanco se come el salto
   y el nombre sale como "
bundle.js". Lo cazó la simulación del clon
   limpio, donde los finales de línea son LF y aquí son CRLF. */
const saca = (rx) => (gen.match(rx) || [])
  .map((s) => (/"([a-z0-9_]+\.js)"/.exec(s) || [])[1])
  .filter(Boolean);
const enLista = saca(/^[ 	]*"[a-z0-9_]+\.js",/gm);
const enFuera = saca(/^[ 	]*"[a-z0-9_]+\.js":/gm);
const enSrc = fs.readdirSync(path.join(__dirname, "..", "src"))
  .filter((f) => f.endsWith(".js"));
comp("todo módulo de src/ está en la lista o declarado fuera con su motivo",
  enSrc.filter((f) => enLista.indexOf(f) < 0 && enFuera.indexOf(f) < 0), []);
comp("el único que se queda fuera es la guarda de Node", enFuera, ["bundle.js"]);
comp("y los 26 que entran son los que la página necesita", enLista.length, 26);

fin();
