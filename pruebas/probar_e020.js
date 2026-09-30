/* =====================================================================
   probar_e020.js — cargas de gravedad

   Lo que se comprueba no es que el código corra: es que devuelve lo que
   dice la E.020, en los puntos donde la norma CAMBIA de rama.  Un límite
   mal puesto —≤ 3° contra < 3°, ≤ 15 contra < 15— no se ve leyendo y
   cambia el número de golpe.  Así que se prueba a los dos lados de cada
   frontera, y encima del propio límite.

   Y se comprueba lo que tiene que PARAR, que es la mitad del módulo: la
   rama de nieve del Art. 7.1 d) y el hueco entre espesores del TR-4.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const E = require("../src/e020.js");

/* ---------- pesos específicos · Anexo 1 -------------------------------- */
comp("peso específico del acero", E.GAMMA_ACERO, 7850);
comp("peso específico del concreto armado", E.GAMMA_CONCRETO, 2400);

/* ---------- la cobertura · ficha del TR-4 ------------------------------ */
comp("cobertura 0,35 mm", E.pesoCobertura(0.35).peso_kgfm2, 3.35);
comp("cobertura 0,40 mm · mismo rango", E.pesoCobertura(0.40).peso_kgfm2, 3.35);
comp("cobertura 0,45 mm · rango siguiente", E.pesoCobertura(0.45).peso_kgfm2, 4.30);
comp("cobertura 0,50 mm", E.pesoCobertura(0.50).peso_kgfm2, 4.30);
comp("cobertura 0,60 mm", E.pesoCobertura(0.60).peso_kgfm2, 5.26);
comp("cobertura 0,80 mm", E.pesoCobertura(0.80).peso_kgfm2, 7.17);
/* LOS RANGOS NO SON CONTIGUOS y eso no es un descuido de la ficha: esa
   plancha no se fabrica. Interpolar daría el peso de un producto que no
   existe, con la misma cara de número bueno que los cuatro tabulados. */
lanza("un espesor en el hueco entre 0,40 y 0,45 PARA",
  () => E.pesoCobertura(0.42), "no hay peso tabulado");
lanza("y el hueco grande entre 0,60 y 0,75 también",
  () => E.pesoCobertura(0.70), "no hay peso tabulado");

/* ---------- carga viva de techo · Art. 7.1 ----------------------------- */
/* EL CASO DEL GALPÓN: cobertura liviana, 30 kgf/m² a cualquier pendiente.
   theta NO entra en este inciso, así que ni se pasa. */
comp("cobertura liviana · 30 a cualquier pendiente",
  E.vivaTecho({ tipo: "liviana", hayNieve: false }).Lo_kgfm2, 30);
comp("y cita el inciso d)",
  E.vivaTecho({ tipo: "liviana", hayNieve: false }).caso, "Art. 7.1 d)");
comp("techo curvo · 50", E.vivaTecho({ tipo: "curvo", hayNieve: false }).Lo_kgfm2, 50);

/* Las fronteras del inciso a) contra el b). El 3° pertenece a «≤ 3°». */
comp("θ = 0° · plano", E.vivaTecho({ tipo: "plano", theta_grad: 0, hayNieve: false }).Lo_kgfm2, 100);
comp("θ = 3° · TODAVÍA plano, el límite es ≤ 3",
  E.vivaTecho({ tipo: "plano", theta_grad: 3, hayNieve: false }).Lo_kgfm2, 100);
comp("θ = 3° por el inciso b) da lo mismo, 100 − 5·(3−3)",
  E.vivaTecho({ tipo: "inclinado", theta_grad: 3, hayNieve: false }).Lo_kgfm2, 100);
/* 100 − 5·(θ−3): en θ = 13° son 50 justos, y de ahí en adelante el piso. */
comp("θ = 8° · 100 − 5·5 = 75",
  E.vivaTecho({ tipo: "inclinado", theta_grad: 8, hayNieve: false }).Lo_kgfm2, 75);
comp("θ = 13° · 100 − 5·10 = 50, justo en el piso",
  E.vivaTecho({ tipo: "inclinado", theta_grad: 13, hayNieve: false }).Lo_kgfm2, 50);
comp("θ = 30° · la fórmula daría −35, el piso lo sube a 50",
  E.vivaTecho({ tipo: "inclinado", theta_grad: 30, hayNieve: false }).Lo_kgfm2, 50);
cierto("y avisa de que está en el piso",
  E.vivaTecho({ tipo: "inclinado", theta_grad: 30, hayNieve: false }).enPiso === true);

/* LA RAMA QUE NO SE PUEDE SUPONER · el Art. 7.1 d) exceptúa la cobertura
   liviana cuando puede acumularse nieve. No decirlo es decidir por el
   proyectista, y en la sierra el error va del lado inseguro. */
lanza("no decir si hay nieve PARA en vez de suponer que no",
  () => E.vivaTecho({ tipo: "liviana" }), "puede acumularse nieve");
comp("con nieve, no devuelve Lr: remite al Art. 11",
  E.vivaTecho({ tipo: "liviana", hayNieve: true }).manda, "nieve");
lanza("un tipo de techo que no es de los cuatro incisos PARA",
  () => E.vivaTecho({ tipo: "verde", hayNieve: false }), "no es un tipo de techo");
lanza("un techo inclinado sin inclinación PARA",
  () => E.vivaTecho({ tipo: "inclinado", hayNieve: false }), "necesita su inclinación");

/* ---------- reducción · Art. 10 ---------------------------------------- */
/* EL EJEMPLO RESUELTO QUE EL INVENTARIO YA DEJA ESCRITO en la fila
   Lr.red.k: pórticos a 6 m, luz 20 m → At = 120 m², k = 1, Ai = 120, y
   Lr = 30·(0,25 + 4,6/√120) ≈ 20 kgf/m². Un 33 % menos. */
const red = E.reduceViva({ Lo_kgfm2: 30, At_m2: 120 });
comp("k por defecto es el del tijeral liviano, Tabla 3", red.k, 1);
comp("Ai = k·At", red.Ai_m2, 120);
cerca("Lr del ejemplo del inventario ≈ 20 kgf/m²", red.Lr_kgfm2, 20.1, 0.02);
cierto("y queda por encima del piso de 0,50·Lo = 15", red.Lr_kgfm2 > 15);
cierto("está reducido", red.reducido === true);

/* El umbral del Art. 10 a): con Ai ≤ 40 NO se reduce, y el 40 no cuenta. */
comp("Ai = 40 exactamente · NO se reduce, el límite es Ai > 40",
  E.reduceViva({ Lo_kgfm2: 30, At_m2: 40 }).Lr_kgfm2, 30);
cierto("y dice por qué no redujo",
  /no pasa de 40/.test(E.reduceViva({ Lo_kgfm2: 30, At_m2: 40 }).motivo));
cierto("Ai = 41 sí reduce", E.reduceViva({ Lo_kgfm2: 30, At_m2: 41 }).reducido === true);

/* El piso de 0,50·Lo · limitaciones b) y g). Con Ai muy grande la fórmula
   tiende a 0,25·Lo, que es la MITAD del piso: sin el tope daría 7,5 en vez
   de 15, y sería la mitad de la carga viva. */
const gigante = E.reduceViva({ Lo_kgfm2: 30, At_m2: 100000 });
comp("con Ai enorme el piso 0,50·Lo manda", gigante.Lr_kgfm2, 15);
cierto("la fórmula sin tope habría dado menos", gigante.bruto_kgfm2 < 15);
cierto("y lo señala", gigante.enPiso === true);
lanza("reducir sin área tributaria PARA",
  () => E.reduceViva({ Lo_kgfm2: 30 }), "At_m2");

/* ---------- nieve · Art. 11 -------------------------------------------- */
comp("la nieve se considera carga viva · Art. 11.1", E.NIEVE_ES_VIVA, true);
/* Art. 11.1, TEXTUAL: «No será necesario incluir en el diseño el efecto
   simultáneo de viento y carga de nieve.» combinaciones.js tiene que leer
   esto de aquí, no volver a decidirlo. */
comp("nieve y viento NO son simultáneos · Art. 11.1", E.NIEVE_CON_VIENTO, false);

comp("Qs tiene mínimo 40 · retorno 50 años", E.nieveQs(10).Qs_kgfm2, 40);
cierto("y avisa de que se aplicó el mínimo", E.nieveQs(10).enMinimo === true);
comp("un Qs mayor se respeta", E.nieveQs(120).Qs_kgfm2, 120);

/* Las tres ramas del Art. 11.3 y sus fronteras. El 15 pertenece a «≤ 15». */
comp("θ = 10° · Qt = Qs", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 10 }).Qt_kgfm2, 100);
comp("θ = 15° · TODAVÍA Qt = Qs", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 15 }).Qt_kgfm2, 100);
comp("θ = 16° · ya entra el 0,80", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 16 }).Qt_kgfm2, 80);
comp("θ = 30° · sigue el 0,80", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 30 }).Qt_kgfm2, 80);
/* θ > 30: Cs = 1 − 0,025·(θ−30) sobre el 0,80·Qs */
cerca("θ = 50° · Cs = 0,5 sobre 0,80·Qs",
  E.nieveQt({ Qs_kgfm2: 100, theta_grad: 50 }).Qt_kgfm2, 40, 1e-12);
comp("y el Cs sale explícito", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 50 }).Cs, 0.5);
/* LA FÓRMULA SE ANULA SOLA EN θ = 70°. El cero no lo ponemos nosotros: es
   la raíz de la expresión de la norma. Lo que sí evitamos es que siga a
   negativo, porque nieve negativa no existe. */
comp("θ = 70° · la fórmula del Art. 11.3 c) se anula",
  E.nieveQt({ Qs_kgfm2: 100, theta_grad: 70 }).Qt_kgfm2, 0);
comp("θ = 80° · no pasa a negativo",
  E.nieveQt({ Qs_kgfm2: 100, theta_grad: 80 }).Qt_kgfm2, 0);
cierto("y lo dice", E.nieveQt({ Qs_kgfm2: 100, theta_grad: 80 }).seAnula === true);
/* Que Qt vaya sobre la PROYECCIÓN HORIZONTAL y no sobre el faldón importa:
   con θ = 30° el faldón mide un 15 % más que su proyección. */
comp("Qt va sobre la proyección horizontal · Art. 11.3 a)",
  E.nieveQt({ Qs_kgfm2: 100, theta_grad: 10 }).sobre, "proyección horizontal");

/* Nieve desbalanceada · Art. 11.3 d), obligatoria para θ > 15°. */
comp("θ ≤ 15° · no aplica",
  E.nieveDesbalanceada({ Qt_kgfm2: 100, semiluz_m: 10, theta_grad: 15 }).aplica, false);
const corto = E.nieveDesbalanceada({ Qt_kgfm2: 100, semiluz_m: 6, theta_grad: 20 });
comp("ℓ/2 ≤ 6 m · 1,3·Qt en un solo faldón", corto.faldonA_kgfm2, 130);
comp("y el otro faldón descargado", corto.faldonB_kgfm2, 0);
const largo = E.nieveDesbalanceada({ Qt_kgfm2: 100, semiluz_m: 10, theta_grad: 20 });
comp("ℓ/2 > 6 m · 1,5·Qt en un faldón", largo.faldonA_kgfm2, 150);
cerca("y 0,3·Qt en el otro", largo.faldonB_kgfm2, 30, 1e-12);
/* Que el faldón cargado lleve MÁS que Qt balanceada es el punto: en una
   armadura puede invertir el signo de las diagonales, así que este caso no
   es decorativo y tiene que llegar al solver. */
cierto("el caso desbalanceado supera la nieve balanceada", largo.faldonA_kgfm2 > 100);

/* ---------- las citas viajan con el número ----------------------------- */
cierto("cada resultado trae su artículo de la E.020",
  E.vivaTecho({ tipo: "liviana", hayNieve: false }).art.indexOf("E.020") >= 0 &&
  E.nieveQt({ Qs_kgfm2: 100, theta_grad: 10 }).art.indexOf("E.020") >= 0);

fin();
