#!/usr/bin/env node
// limpiar-ctf.js <semilla> <rangos.json> <informe.json>
// Segunda pasada de preparar.py, con el compilador de TypeScript (require('typescript'), vía NODE_PATH).
// Quita la capa de juego de la app sin mover ninguna línea: el texto quitado se cambia por espacios.
//   1. Todos los comentarios (salvo @ts-… y eslint-…): eran pistas o explicaban el fallo.
//   2. El código que da flags al lado de cada fallo: variables con prisma.flag o con «flag» en el nombre, asignaciones
//      a ellas, if que solo sirven para darlas (o cuya condición las nombra), propiedades `flag` en respuestas y tipos.
//   3. Importaciones y JSX de los componentes del juego que se borran, y enlaces a sus páginas.
//   4. Variables que quedan sin uso porque solo servían para eso (los detectores: «¿hay UNION en la consulta?»).
// Nunca toca líneas de un rango puntuable del ground truth (rangos.json): lo que caería ahí se apunta y se deja.
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const [raiz, rangosF, informeF] = process.argv.slice(2);
const rangos = JSON.parse(fs.readFileSync(rangosF, "utf8")); // {fichero: [[ini, fin], ...]}
const BORRADOS = /components\/(FlagChecker|FlagCheckerWrapper|FlagDisplay|FlagToast|HintPanel|HintPanelWrapper|OnboardingGuide|ConsoleWelcome)\b/;
const PAGINAS = /^\/(flags|player-dashboard|hall-of-fame|vulnerabilities|about|terms)(\/|$|\?|#)/;
const FLAG = /flag/i;
const EXCLUIR = /^(app\/api\/flags\/|prisma\/|lib\/generated\/|node_modules\/)/;
const informe = { ficheros: {}, protegidos: [] };

function ficheros(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".next", "generated"].includes(e.name)) ficheros(p, out); }
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function blanquea(texto, tramos) {
  const c = texto.split("");
  for (const [a, b] of tramos) for (let i = a; i < b; i++) if (c[i] !== "\n" && c[i] !== "\r") c[i] = " ";
  // Las líneas que quedan en blanco, vacías; espacios al final de una línea tocada, fuera
  const lineasAntes = texto.split("\n");
  return c.join("").split("\n").map((l, i) => (l !== lineasAntes[i] ? l.replace(/\s+$/, "") : l)).join("\n");
}

function linea(sf, pos) { return sf.getLineAndCharacterOfPosition(pos).line + 1; }

function protegido(rel, sf, a, b) {
  const r = rangos[rel] || [];
  const la = linea(sf, a), lb = linea(sf, Math.max(a, b - 1));
  return r.some(([i, f]) => la <= f && lb >= i);
}

// Comentarios: recorre todos los nodos y tokens y junta los rangos de comentarios
function comentarios(sf) {
  const t = sf.getFullText(), vistos = new Map();
  const mira = (pos) => {
    for (const f of [ts.getLeadingCommentRanges, ts.getTrailingCommentRanges])
      for (const r of f(t, pos) || []) vistos.set(r.pos, r);
  };
  const anda = (n) => { mira(n.getFullStart()); mira(n.getEnd()); n.getChildren(sf).forEach(anda); };
  anda(sf);
  return [...vistos.values()]
    .filter((r) => !/^\/[/*]\s*(@ts-|eslint-|@jsx|webpackIgnore|prettier-ignore)/.test(t.slice(r.pos, r.end)))
    .map((r) => [r.pos, r.end]);
}

function nombre(n) { return n && n.name && ts.isIdentifier(n.name) ? n.name.text : null; }
function nombresDecl(vs) {
  const out = [];
  for (const d of vs.declarationList.declarations) {
    if (ts.isIdentifier(d.name)) out.push(d.name.text);
    else d.name.elements?.forEach((e) => e && e.name && ts.isIdentifier(e.name) && out.push(e.name.text));
  }
  return out;
}
const texto = (sf, n) => n.getText(sf);
const esFlagNombre = (s) => FLAG.test(s) && !/featureflag|feature_flag/i.test(s);

function analiza(rel, src, sospechosos, previos) {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const tramos = [], motivos = [];
  const candidatos = [];
  // Nombres que declara un nodo (si se quita y siguen usándose fuera, se deshace)
  const declara = (n) => {
    if (ts.isVariableStatement(n)) return nombresDecl(n);
    if (ts.isImportDeclaration(n)) {
      const c = n.importClause, out = [];
      if (c?.name) out.push(c.name.text);
      c?.namedBindings?.elements?.forEach((e) => out.push(e.name.text));
      return out;
    }
    if (ts.isPropertySignature(n) && nombre(n)) return [nombre(n)];
    return [];
  };
  const quita = (n, motivo, extra = 0) => {
    const a = n.getStart(sf), b = n.getEnd() + extra;
    if (protegido(rel, sf, a, b)) { informe.protegidos.push({ f: rel, l: linea(sf, a), motivo, t: texto(sf, n).slice(0, 100) }); return false; }
    candidatos.push({ a, b, motivo: `${linea(sf, a)}: ${motivo}`, nombres: declara(n), n });
    return true;
  };
  // Deshace los borrados de declaraciones cuyo nombre se sigue usando en lo que queda
  const filtra = () => {
    for (let cambio = true; cambio; ) {
      cambio = false;
      const restos = blanquea(src, candidatos.map((c) => [c.a, c.b]));
      const usados = new Set();
      const anda = (x) => {
        if (ts.isIdentifier(x) && !(x.parent && (ts.isVariableDeclaration(x.parent) || ts.isImportSpecifier(x.parent) || ts.isImportClause(x.parent) || ts.isPropertySignature(x.parent)) && x.parent.name === x)) usados.add(x.text);
        x.forEachChild(anda);
      };
      anda(ts.createSourceFile(rel, restos, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
      for (let i = candidatos.length - 1; i >= 0; i--)
        if (candidatos[i].nombres.some((x) => usados.has(x))) { candidatos.splice(i, 1); cambio = true; }
    }
    for (const c of candidatos) {
      tramos.push([c.a, c.b]); motivos.push(c.motivo);
      for (const m of texto(sf, c.n).matchAll(/[A-Za-z_$][\w$]*/g)) sospechosos.add(m[0]);
    }
    candidatos.length = 0;
  };
  const importadosBorrados = new Set();

  // ¿Este nodo es «solo flag»?
  const soloFlag = (n) => {
    if (ts.isBlock(n)) return n.statements.length > 0 && n.statements.every(soloFlag);
    if (ts.isVariableStatement(n)) return nombresDecl(n).every(esFlagNombre) || n.declarationList.declarations.every((d) => d.initializer && /^(await\s+)?prisma\.flag\b/.test(texto(sf, d.initializer)));
    if (ts.isExpressionStatement(n)) {
      const e = n.expression;
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken) return esFlagNombre(texto(sf, e.left));
      return /^(await\s+)?prisma\.flag\b/.test(texto(sf, e));
    }
    if (ts.isIfStatement(n)) return !n.elseStatement && (condFlag(n.expression) || soloFlag(n.thenStatement));
    if (ts.isReturnStatement(n)) return false;
    return false;
  };
  const condFlag = (e) => {
    let si = false;
    const anda = (n) => { if (ts.isIdentifier(n) && esFlagNombre(n.text)) si = true; n.forEachChild(anda); };
    anda(e);
    return si;
  };

  const visita = (n) => {
    // Importaciones de componentes borrados o de nombres de flag
    if (ts.isImportDeclaration(n)) {
      const mod = n.moduleSpecifier.text;
      const nombres = [];
      const c = n.importClause;
      if (c?.name) nombres.push(c.name.text);
      c?.namedBindings?.elements?.forEach((e) => nombres.push(e.name.text));
      if (BORRADOS.test(mod) || (nombres.length && nombres.every(esFlagNombre))) {
        nombres.forEach((x) => importadosBorrados.add(x));
        quita(n, `import ${mod}`);
      }
      return;
    }
    // JSX de componentes borrados o enlaces a páginas borradas
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const ap = ts.isJsxElement(n) ? n.openingElement : n;
      const tag = ap.tagName.getText(sf);
      const href = ap.attributes.properties.find((p) => p.name?.getText(sf) === "href");
      const hrefTxt = href?.initializer && ts.isStringLiteral(href.initializer) ? href.initializer.text : "";
      const propsFlag = ap.attributes.properties.some((p) => p.initializer && condFlag(p.initializer));
      if (importadosBorrados.has(tag) || /^Flag|^HintPanel|^Onboarding|^ConsoleWelcome/.test(tag) || PAGINAS.test(hrefTxt) || propsFlag) {
        // Sube hasta un contenedor {…} hijo de JSX, o hasta un hijo directo de JSX
        let x = n;
        while (x.parent && (ts.isParenthesizedExpression(x.parent) || ts.isBinaryExpression(x.parent) || ts.isConditionalExpression(x.parent))) x = x.parent;
        if (ts.isJsxExpression(x.parent)) x = x.parent;
        if (ts.isJsxElement(x.parent) || ts.isJsxFragment(x.parent) || ts.isJsxExpression(x)) { quita(x, `JSX <${tag}>`); return; }
        informe.protegidos.push({ f: rel, l: linea(sf, n.getStart(sf)), motivo: "JSX fuera de contexto", t: tag });
      }
    }
    if (ts.isJsxExpression(n) && n.expression && condFlag(n.expression) && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      quita(n, "JSX {flag…}"); return;
    }
    // Sentencias
    if (ts.isVariableStatement(n) || ts.isExpressionStatement(n) || ts.isIfStatement(n)) {
      if (ts.isIfStatement(n) && n.elseStatement) { n.forEachChild(visita); return; }
      if (soloFlag(n) || (ts.isIfStatement(n) && condFlag(n.expression))) {
        if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) { n.forEachChild(visita); return; }
        quita(n, ts.SyntaxKind[n.kind]); return;
      }
    }
    // Propiedades `flag` en objetos y en tipos
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n) || ts.isPropertySignature(n)) && nombre(n) && esFlagNombre(nombre(n))) {
      const t = sf.getFullText();
      let fin = n.getEnd();
      const m = /^\s*[,;]/.exec(t.slice(fin));
      quita(n, `propiedad ${nombre(n)}`, m ? m[0].length : 0);
      return;
    }
    // Spreads condicionales: ...(flag ? { flag } : {})
    if (ts.isSpreadAssignment(n) && condFlag(n.expression)) {
      const t = sf.getFullText(); const m = /^\s*,/.exec(t.slice(n.getEnd()));
      quita(n, "spread flag", m ? m[0].length : 0); return;
    }
    n.forEachChild(visita);
  };
  visita(sf);
  filtra();

  // Variables que se quedan sin uso tras quitar lo anterior (los detectores)
  const usos = new Map();
  const cuenta = (n) => { if (ts.isIdentifier(n)) usos.set(n.text, (usos.get(n.text) || 0) + 1); n.forEachChild(cuenta); };
  const textoTras = blanquea(src, tramos);
  cuenta(ts.createSourceFile(rel, textoTras, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  const sinUso = (n) => {
    if (ts.isVariableStatement(n) && !n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      const ns = nombresDecl(n);
      const t = texto(sf, n);
      const funcion = n.declarationList.declarations.every((d) => d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)));
      if (ns.length && ns.every((x) => sospechosos.has(x) && (usos.get(x) || 0) <= 1) && (funcion || !/\bawait\b|prisma\.|\+\+|--|=\s*new\s/.test(t.replace(/^[^=]*=/, "=")))
          && !tramos.some(([a, b]) => n.getStart(sf) >= a && n.getEnd() <= b)) {
        quita(n, `sin uso: ${ns.join(",")}`); return;
      }
    }
    // R1: variables locales que solo se escriben (los detectores: let detectado = false; … detectado = esSQL(x))
    if (ts.isVariableStatement(n) && !n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) && !ts.isSourceFile(n.parent)) {
      const ns = nombresDecl(n);
      if (ns.length === 1 && sospechosos.has(ns[0]) && lecturas(ns[0]) === 0 && !/\bawait\b/.test(texto(sf, n))) {
        quita(n, `solo se escribe: ${ns[0]}`);
        escrituras(ns[0]).forEach((st) => quita(st, `escritura de ${ns[0]}`));
        return;
      }
    }
    // R2: if sin else que ha quedado vacío, con una condición sin efectos
    if (ts.isIfStatement(n) && !n.elseStatement && ts.isBlock(n.thenStatement) && n.thenStatement.statements.length === 0
        && !/\bawait\b|\+\+|--|[^=!<>]=[^=]/.test(texto(sf, n.expression))) {
      quita(n, "if vacío"); return;
    }
    // R4: if sin else cuyo único return es igual a otro return de la misma función (la rama premiaba y ya no)
    if (ts.isIfStatement(n) && !n.elseStatement && ts.isBlock(n.thenStatement) && n.thenStatement.statements.length === 1
        && ts.isReturnStatement(n.thenStatement.statements[0]) && !/\bawait\b/.test(texto(sf, n.expression))) {
      const norma = (x) => texto(sf, x).replace(/\s+/g, "").replace(/,([}\])])/g, "$1");
      const r = norma(n.thenStatement.statements[0]);
      let f = n.parent; while (f && !ts.isFunctionLike(f)) f = f.parent;
      let igual = false;
      const busca = (x) => { if (x !== n.thenStatement.statements[0] && ts.isReturnStatement(x) && norma(x) === r) igual = true; x.forEachChild(busca); };
      if (f) busca(f);
      const dentro = previos.some(([x, y]) => x >= n.thenStatement.getStart(sf) && y <= n.thenStatement.getEnd());
      if (igual && dentro) { quita(n, "if que devuelve lo mismo que el camino normal"); return; }
    }
    // R3: funciones sin uso que solo servían a lo quitado
    if (ts.isFunctionDeclaration(n) && n.name && sospechosos.has(n.name.text) && (usos.get(n.name.text) || 0) <= 1
        && !n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      quita(n, `función sin uso: ${n.name.text}`); return;
    }
    n.forEachChild(sinUso);
  };
  // Lecturas y escrituras de un nombre en el texto que queda
  const sfTras = ts.createSourceFile(rel, textoTras, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const esEscritura = (id) => id.parent && ts.isBinaryExpression(id.parent) && id.parent.left === id && id.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  const lecturas = (x) => {
    let c = 0;
    const anda = (m) => {
      if (ts.isIdentifier(m) && m.text === x && !esEscritura(m) && !(ts.isVariableDeclaration(m.parent) && m.parent.name === m)) c++;
      m.forEachChild(anda);
    };
    anda(sfTras); return c;
  };
  const escrituras = (x) => {
    const out = [];
    const anda = (m) => {
      if (ts.isExpressionStatement(m) && ts.isBinaryExpression(m.expression) && m.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isIdentifier(m.expression.left) && m.expression.left.text === x) out.push(m);
      m.forEachChild(anda);
    };
    anda(sf); return out;
  };
  sinUso(sf);
  filtra();
  return { tramos, motivos };
}

for (const p of ficheros(raiz)) {
  const rel = path.relative(raiz, p).split(path.sep).join("/");
  let src = fs.readFileSync(p, "utf8");
  const n0 = src.split("\n").length;
  const sf0 = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const com = comentarios(sf0).filter(([a, b]) => !protegido(rel, sf0, a, b) || true);
  src = blanquea(src, com);
  const motivos = com.length ? [`${com.length} comentarios`] : [];
  if (!EXCLUIR.test(rel)) {
    const sospechosos = new Set(), previos = [];
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const r = analiza(rel, src, sospechosos, previos);
      if (!r.tramos.length) break;
      previos.push(...r.tramos);
      src = blanquea(src, r.tramos); motivos.push(...r.motivos);
    }
  }
  if (src.split("\n").length !== n0) throw new Error(`${rel}: cambia el número de líneas`);
  if (motivos.length) { fs.writeFileSync(p, src); informe.ficheros[rel] = motivos; }
}
fs.writeFileSync(informeF, JSON.stringify(informe, null, 1));
console.log(`ficheros tocados: ${Object.keys(informe.ficheros).length} · dejados por caer en un rango puntuable: ${informe.protegidos.length}`);
