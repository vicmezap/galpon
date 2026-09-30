/* =====================================================================
   bucle.js — el bucle de dimensionamiento, mostrado y no escondido

   En acero el dimensionamiento ES iterativo, y no por comodidad: si el
   diseño cambia una sección, cambian A e I, y el análisis del paso anterior
   YA NO VALE.  Las fuerzas de un pórtico dependen de las rigideces
   relativas, así que cambiar una columna cambia el momento de la viga.

   LA DECISIÓN DE ARQUITECTURA ES MOSTRAR LA PASADA, no ocultarla.  Un
   complemento que «calcula» en un solo golpe y no dice que hubo tres pasadas
   está escondiendo la parte del trabajo donde se equivoca la gente.  Aquí
   cada pasada se anota: qué elementos cambiaron, de qué a qué, y por qué.

   TRES FORMAS DE TERMINAR, y las tres se distinguen:

     · CONVERGIÓ · una pasada entera sin que cambie ninguna sección.  Es la
       única que vale.
     · OSCILA · el conjunto de secciones VUELVE a uno ya visto.  Pasa de
       verdad: A pide B, B pide A.  Sin esta guarda el bucle no termina, y
       con un tope de pasadas a secas terminaría diciendo «no convergió» sin
       explicar que el problema es un ciclo y no falta de pasadas.
     · SE AGOTÓ · llegó al tope sin repetir estado ni converger.  Eso sí es
       «hacen falta más pasadas», y se distingue del ciclo.

   NO DECIDE SECCIONES.  Eso es de correas.js, tijeral.js y compañía: este
   módulo solo lleva la cuenta, detecta el final y lo cuenta.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.BUCLE = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("bucle.js", ["E.tension.only", "E.C2.taub"]);

  /* Tope de pasadas.  Un pórtico de galpón converge en dos o tres; diez es
     holgura de sobra y a la vez un techo que no deja un bucle infinito. */
  const MAX_PASADAS = 10;

  function nuevo(d) {
    d = d || {};
    return {
      nombre: d.nombre || "dimensionamiento",
      pasada: 0,
      maxPasadas: d.maxPasadas || MAX_PASADAS,
      historial: [],
      estadosVistos: [],       /* firmas de conjuntos de secciones ya usados */
      terminado: false,
      resultado: null
    };
  }

  /* La firma de un conjunto de secciones adoptadas.  Ordenada por id para que
     el mismo conjunto dé siempre la misma firma. */
  function firma(secciones) {
    return Object.keys(secciones).sort()
      .map((k) => k + "=" + secciones[k]).join("|");
  }

  /* ---------- una pasada ------------------------------------------------ */
  /* `antes` y `despues` son mapas id -> nombre de sección adoptada.  `despues`
     es lo que el diseño pide después de analizar con `antes`. */
  function pasada(estado, d) {
    if (estado.terminado) {
      throw new Error(
        "bucle: «" + estado.nombre + "» ya terminó (" + estado.resultado + ").\n" +
        "  Empieza un bucle nuevo si quieres volver a dimensionar: reutilizar uno\n" +
        "  terminado mezclaría dos historiales y el informe dejaría de ser cierto.");
    }
    const antes = d.antes, despues = d.despues;
    if (!antes || !despues || typeof antes !== "object" || typeof despues !== "object") {
      throw new Error("bucle: pasada() necesita `antes` y `despues`, mapas id -> sección");
    }
    const idsAntes = Object.keys(antes).sort().join(",");
    const idsDespues = Object.keys(despues).sort().join(",");
    if (idsAntes !== idsDespues) {
      throw new Error(
        "bucle: el conjunto de elementos cambió entre antes y después.\n" +
        "  antes:   " + idsAntes + "\n" +
        "  después: " + idsDespues + "\n" +
        "  El bucle compara secciones de los MISMOS elementos. Si la estructura\n" +
        "  cambió de elementos, es otro dimensionamiento.");
    }

    estado.pasada++;
    const cambios = [];
    for (const id of Object.keys(antes)) {
      if (antes[id] !== despues[id]) {
        cambios.push({ id: id, de: antes[id], a: despues[id],
          motivo: (d.motivos && d.motivos[id]) || null });
      }
    }

    const f = firma(despues);
    const yaVisto = estado.estadosVistos.indexOf(f);

    const reg = {
      pasada: estado.pasada,
      cambios: cambios.length,
      detalle: cambios,
      firma: f,
      mensaje: cambios.length
        ? "Pasada " + estado.pasada + ": " + cambios.length +
          (cambios.length === 1 ? " elemento cambió" : " elementos cambiaron") +
          ", vuelve a analizar"
        : "Pasada " + estado.pasada + ": ninguna sección cambió · convergió"
    };
    estado.historial.push(reg);

    /* --- convergió --- */
    if (!cambios.length) {
      estado.terminado = true;
      estado.resultado = "convergió";
      return Object.assign(reg, { terminado: true, resultado: "convergió",
        seguir: false, secciones: despues });
    }

    /* --- OSCILA · el conjunto vuelve a uno ya visto ---
       Sin esto el bucle no acaba, y con un tope a secas acabaría diciendo
       «no convergió», que es cierto pero inútil: el problema no es que
       falten pasadas, es que hay un ciclo. */
    if (yaVisto >= 0) {
      estado.terminado = true;
      estado.resultado = "oscila";
      const ciclo = estado.estadosVistos.length - yaVisto;
      throw new Error(
        "bucle: EL DIMENSIONAMIENTO OSCILA, no convergerá por sí solo.\n" +
        "  En la pasada " + estado.pasada + " se volvió a un conjunto de secciones ya\n" +
        "  usado en la pasada " + (yaVisto + 1) + ": un ciclo de " + ciclo + " estado(s).\n" +
        "  Pasa cuando A pide B y B vuelve a pedir A, y suele significar que dos\n" +
        "  elementos se están peleando por la misma rigidez — típicamente una\n" +
        "  columna y la viga que la arriostra.\n" +
        "  Qué hacer: fijar a mano la sección de uno de los dos y volver a correr,\n" +
        "  o subir un escalón las dos de golpe. Más pasadas NO lo arreglan.\n" +
        "  Últimos cambios: " +
        cambios.map((c) => c.id + " " + c.de + "→" + c.a).join(", "));
    }
    estado.estadosVistos.push(f);

    /* --- se agotó --- */
    if (estado.pasada >= estado.maxPasadas) {
      estado.terminado = true;
      estado.resultado = "se agotó";
      throw new Error(
        "bucle: se llegó al tope de " + estado.maxPasadas + " pasadas sin converger y\n" +
        "  SIN repetir ningún conjunto de secciones, así que no es un ciclo: es que\n" +
        "  hacen falta más pasadas o el criterio de adopción está dando saltos muy\n" +
        "  pequeños.\n" +
        "  Historial: " + estado.historial.map((h) => "#" + h.pasada + "→" +
          h.cambios).join(" ") + " cambios por pasada.");
    }

    return Object.assign(reg, { terminado: false, seguir: true, secciones: despues });
  }

  /* ---------- el informe ------------------------------------------------ */
  function informe(estado) {
    return {
      nombre: estado.nombre,
      pasadas: estado.pasada,
      resultado: estado.terminado ? estado.resultado : "en curso",
      convergio: estado.resultado === "convergió",
      historial: estado.historial.map((h) => h.mensaje),
      cambiosPorPasada: estado.historial.map((h) => h.cambios),
      /* Que el número de cambios BAJE es la señal de que va a converger.
         Si no baja, o sube, conviene mirar antes de gastar pasadas. */
      convergiendo: (function () {
        const c = estado.historial.map((h) => h.cambios);
        for (let i = 1; i < c.length; i++) if (c[i] > c[i - 1]) return false;
        return true;
      })(),
      art: ART["E.C2.taub"],
      nota: "el bucle también lo pide el propio análisis: τb depende de Pr, que " +
            "depende del análisis, que depende de τb (fila E.C2.taub)"
    };
  }

  return { ART, MAX_PASADAS, nuevo, pasada, informe, firma };
});
