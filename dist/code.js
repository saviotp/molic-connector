"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/geometry.ts
  var STUB = 24;
  var center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  var clamp01 = (t) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0.5));
  function anchor(r, side, t = 0.5) {
    const k = clamp01(t);
    switch (side) {
      case "left":
        return { x: r.x, y: r.y + r.height * k };
      case "right":
        return { x: r.x + r.width, y: r.y + r.height * k };
      case "top":
        return { x: r.x + r.width * k, y: r.y };
      case "bottom":
        return { x: r.x + r.width * k, y: r.y + r.height };
    }
  }
  var opposite = { left: "right", right: "left", top: "bottom", bottom: "top" };
  var direction = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 }
  };
  var isHorizontal = (s) => s === "left" || s === "right";
  function chooseSides(a, b) {
    const ca = center(a);
    const cb = center(b);
    const dx = cb.x - ca.x;
    const dy = cb.y - ca.y;
    const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    let horizontal;
    if (gapX > 0 && gapY <= 0) horizontal = true;
    else if (gapY > 0 && gapX <= 0) horizontal = false;
    else horizontal = Math.abs(dx) >= Math.abs(dy);
    const start = horizontal ? dx >= 0 ? "right" : "left" : dy >= 0 ? "bottom" : "top";
    return { start, end: opposite[start] };
  }
  function autoFacing(fixedPoint, other) {
    const c = center(other);
    const dx = fixedPoint.x - c.x;
    const dy = fixedPoint.y - c.y;
    if (Math.abs(dx) / Math.max(other.width, 1) >= Math.abs(dy) / Math.max(other.height, 1)) {
      return dx >= 0 ? "right" : "left";
    }
    return dy >= 0 ? "bottom" : "top";
  }
  function resolveSides(a, b, start, end) {
    const auto = chooseSides(a, b);
    if (start.side === "auto" && end.side === "auto") return { s: auto.start, e: auto.end };
    if (start.side !== "auto" && end.side !== "auto") return { s: start.side, e: end.side };
    if (start.side !== "auto") {
      const s = start.side;
      return { s, e: autoOther(s, anchor(a, s, start.t), b) };
    }
    const e = end.side;
    return { s: autoOther(e, anchor(b, e, end.t), a), e };
  }
  function autoOther(fixed, p, other) {
    const ahead = fixed === "right" && other.x >= p.x || fixed === "left" && other.x + other.width <= p.x || fixed === "bottom" && other.y >= p.y || fixed === "top" && other.y + other.height <= p.y;
    return ahead ? opposite[fixed] : autoFacing(p, other);
  }
  var same = (p, q) => Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;
  function bezierAt(s, t) {
    var _a, _b;
    const c1 = (_a = s.c1) != null ? _a : s.from;
    const c2 = (_b = s.c2) != null ? _b : s.to;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * s.from.x + b * c1.x + c * c2.x + d * s.to.x,
      y: a * s.from.y + b * c1.y + c * c2.y + d * s.to.y
    };
  }
  function simplify(points) {
    const out = [];
    for (const p of points) {
      if (out.length && same(out[out.length - 1], p)) continue;
      if (out.length >= 2) {
        const a = out[out.length - 2];
        const b = out[out.length - 1];
        const collinear = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5 || Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5;
        if (collinear) out.pop();
      }
      out.push(p);
    }
    return out;
  }
  function halfway(points) {
    const lens = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let rest = lens.reduce((s, l) => s + l, 0) / 2;
    for (let i = 0; i < lens.length; i++) {
      if (rest <= lens[i] || i === lens.length - 1) {
        const k = lens[i] ? rest / lens[i] : 0;
        const p = points[i];
        const q = points[i + 1];
        return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      }
      rest -= lens[i];
    }
    return points[0];
  }
  function orthogonal(p0, s, p3, e) {
    const d0 = direction[s];
    const d1 = direction[e];
    const a = { x: p0.x + d0.x * STUB, y: p0.y + d0.y * STUB };
    const b = { x: p3.x + d1.x * STUB, y: p3.y + d1.y * STUB };
    let middle;
    if (isHorizontal(s) && isHorizontal(e)) {
      const mx = (a.x + b.x) / 2;
      middle = [{ x: mx, y: a.y }, { x: mx, y: b.y }];
    } else if (!isHorizontal(s) && !isHorizontal(e)) {
      const my = (a.y + b.y) / 2;
      middle = [{ x: a.x, y: my }, { x: b.x, y: my }];
    } else if (isHorizontal(s)) {
      middle = [{ x: b.x, y: a.y }];
    } else {
      middle = [{ x: a.x, y: b.y }];
    }
    return simplify([p0, a, ...middle, b, p3]);
  }
  function computePath(a, b, route, start = { side: "auto", t: 0.5 }, end = { side: "auto", t: 0.5 }) {
    const { s, e } = resolveSides(a, b, start, end);
    const p0 = anchor(a, s, start.side === "auto" ? 0.5 : start.t);
    const p3 = anchor(b, e, end.side === "auto" ? 0.5 : end.t);
    if (route === "curve") {
      const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const k = Math.max(30, dist / 2);
      const d0 = direction[s];
      const d1 = direction[e];
      const seg = {
        from: p0,
        to: p3,
        c1: { x: p0.x + d0.x * k, y: p0.y + d0.y * k },
        c2: { x: p3.x + d1.x * k, y: p3.y + d1.y * k }
      };
      return { points: [p0, p3], segments: [seg], label: bezierAt(seg, 0.5), startSide: s, endSide: e };
    }
    const points = route === "straight" ? [p0, p3] : orthogonal(p0, s, p3, e);
    return {
      points,
      segments: points.slice(1).map((to, i) => ({ from: points[i], to })),
      label: halfway(points),
      startSide: s,
      endSide: e
    };
  }
  function minCorner(path) {
    const all = [];
    for (const s of path.segments) {
      all.push(s.from, s.to);
      if (s.c1) all.push(s.c1);
      if (s.c2) all.push(s.c2);
    }
    return {
      x: Math.min(...all.map((p) => p.x)),
      y: Math.min(...all.map((p) => p.y))
    };
  }
  function labelLines(speaker, text, precond) {
    const lines = [];
    if (precond.trim()) lines.push(`precond: ${precond.trim()}`);
    lines.push(`${speaker}: ${text.trim()}`);
    return lines;
  }

  // src/code.ts
  var KEY = "molic";
  var FONT = { family: "Inter", style: "Regular" };
  var BLACK = { type: "SOLID", color: { r: 0, g: 0, b: 0 } };
  var DASH = [6, 4];
  var DEFAULTS = {
    kind: "transicao",
    speaker: "u",
    text: "",
    precond: "",
    route: "orthogonal",
    startSide: "auto",
    startT: 0.5,
    endSide: "auto",
    endT: 0.5
  };
  var STYLE_KEYS = Object.keys(DEFAULTS);
  var ownIds = /* @__PURE__ */ new Set();
  var autoUpdate = true;
  function readData(node) {
    const raw = node.getPluginData(KEY);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      if (!d.from || !d.to) return null;
      return __spreadValues(__spreadValues({}, DEFAULTS), d);
    } catch (e) {
      return null;
    }
  }
  function connectorsOnPage() {
    return figma.currentPage.findAllWithCriteria({ types: ["GROUP"], pluginData: { keys: [KEY] } });
  }
  function isConnector(node) {
    return node.type === "GROUP" && !!node.getPluginData(KEY);
  }
  function selectedConnectors() {
    return figma.currentPage.selection.filter(isConnector);
  }
  function registerOwn(group) {
    ownIds.add(group.id);
    for (const n of group.findAll()) ownIds.add(n.id);
  }
  function boxOf(node) {
    if (!node || node.removed || !("absoluteBoundingBox" in node)) return null;
    return node.absoluteBoundingBox;
  }
  function originFor(node) {
    let p = node.parent;
    while (p && (p.type === "GROUP" || p.type === "BOOLEAN_OPERATION")) p = p.parent;
    if (!p || p.type === "PAGE" || p.type === "DOCUMENT") return { x: 0, y: 0 };
    const t = p.absoluteTransform;
    return { x: t[0][2], y: t[1][2] };
  }
  function shift(p, o) {
    return { x: p.x - o.x, y: p.y - o.y };
  }
  async function drawLine(vector, path, kind, origin) {
    const base = minCorner(path);
    const rel = (p) => ({ x: p.x - base.x, y: p.y - base.y });
    const vertices = path.points.map((p, i) => __spreadProps(__spreadValues({}, rel(p)), {
      strokeCap: i === path.points.length - 1 ? "ARROW_LINES" : "NONE",
      cornerRadius: i > 0 && i < path.points.length - 1 ? 8 : 0
    }));
    const segments = path.segments.map((s, i) => ({
      start: i,
      end: i + 1,
      tangentStart: s.c1 ? { x: s.c1.x - s.from.x, y: s.c1.y - s.from.y } : { x: 0, y: 0 },
      tangentEnd: s.c2 ? { x: s.c2.x - s.to.x, y: s.c2.y - s.to.y } : { x: 0, y: 0 }
    }));
    await vector.setVectorNetworkAsync({ vertices, segments });
    vector.strokes = [BLACK];
    vector.strokeWeight = 1;
    vector.dashPattern = kind === "ruptura" ? DASH : [];
    vector.fills = [];
    const v0 = vector.vectorNetwork.vertices[0];
    const start = shift(path.points[0], origin);
    vector.x = start.x - v0.x;
    vector.y = start.y - v0.y;
  }
  function pageBackground() {
    const bg = figma.currentPage.backgrounds;
    return bg && bg.length ? [...bg] : [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  }
  function drawLabel(frame, text, data, at) {
    frame.layoutMode = "VERTICAL";
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = "AUTO";
    frame.counterAxisAlignItems = "CENTER";
    frame.paddingLeft = frame.paddingRight = 6;
    frame.paddingTop = frame.paddingBottom = 2;
    frame.fills = pageBackground();
    frame.clipsContent = false;
    text.fontName = FONT;
    text.fontSize = 14;
    text.textAlignHorizontal = "CENTER";
    text.fills = [BLACK];
    text.characters = labelLines(data.speaker, data.text, data.precond).join("\n");
    frame.x = at.x - frame.width / 2;
    frame.y = at.y - frame.height / 2;
  }
  function partsOf(group) {
    const vector = group.findChild((n) => n.type === "VECTOR");
    const frame = group.findChild((n) => n.type === "FRAME");
    const text = frame ? frame.findOne((n) => n.type === "TEXT") : null;
    return { vector, frame, text };
  }
  function newVector() {
    const v = figma.createVector();
    v.name = "seta";
    return v;
  }
  function newLabel() {
    const frame = figma.createFrame();
    frame.name = "r\xF3tulo";
    const text = figma.createText();
    text.name = "fala";
    frame.appendChild(text);
    return { frame, text };
  }
  async function render(data, group) {
    var _a, _b;
    const a = boxOf(await figma.getNodeByIdAsync(data.from));
    const b = boxOf(await figma.getNodeByIdAsync(data.to));
    if (!a && !b) throw new Error("a origem e o destino foram apagados");
    if (!a) throw new Error("a origem foi apagada");
    if (!b) throw new Error("o destino foi apagado");
    const path = computePath(a, b, data.route, { side: data.startSide, t: data.startT }, { side: data.endSide, t: data.endT });
    let vector;
    let frame;
    let text;
    if (group) {
      const parts = partsOf(group);
      vector = (_a = parts.vector) != null ? _a : newVector();
      if (!parts.vector) group.appendChild(vector);
      if (parts.frame && parts.text) {
        frame = parts.frame;
        text = parts.text;
      } else {
        (_b = parts.frame) == null ? void 0 : _b.remove();
        ({ frame, text } = newLabel());
        group.appendChild(frame);
      }
    } else {
      vector = newVector();
      ({ frame, text } = newLabel());
    }
    const origin = group ? originFor(group) : { x: 0, y: 0 };
    await drawLine(vector, path, data.kind, origin);
    drawLabel(frame, text, data, shift(path.label, origin));
    if (!group) {
      group = figma.group([vector, frame], figma.currentPage);
      group.setRelaunchData({ edit: "Editar esta fala de transi\xE7\xE3o" });
    }
    group.name = `MoLIC \xB7 ${data.speaker}: ${data.text}`;
    group.setPluginData(KEY, JSON.stringify(data));
    registerOwn(group);
    return group;
  }
  async function renderAll(groups, change) {
    const failed = [];
    let ok = 0;
    for (const g of groups) {
      const data = readData(g);
      if (!data) {
        failed.push({ group: g, reason: "dados da seta ileg\xEDveis" });
        continue;
      }
      try {
        await render(change ? change(data) : data, g);
        ok++;
      } catch (e) {
        failed.push({ group: g, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    return { ok, failed };
  }
  function reportFailures(failed, ok, verb) {
    if (!failed.length) return;
    figma.currentPage.selection = failed.map((f) => f.group);
    const reasons = [...new Set(failed.map((f) => f.reason))].join("; ");
    figma.notify(`${ok} ${verb}. ${failed.length} com problema (selecionadas): ${reasons}.`, {
      error: true,
      timeout: 8e3
    });
  }
  var timer = null;
  var busy = false;
  var GEOMETRY = ["x", "y", "width", "height", "relativeTransform", "rotation"];
  function onNodeChange(event) {
    if (!autoUpdate || busy) return;
    const relevant = event.nodeChanges.some(
      (c) => c.type === "PROPERTY_CHANGE" && !ownIds.has(c.node.id) && c.properties.some((p) => GEOMETRY.includes(p))
    );
    if (!relevant) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      busy = true;
      try {
        await renderAll(connectorsOnPage());
      } finally {
        busy = false;
      }
    }, 60);
  }
  var watchedPage = null;
  function watchCurrentPage() {
    if (watchedPage) watchedPage.off("nodechange", onNodeChange);
    watchedPage = figma.currentPage;
    watchedPage.on("nodechange", onNodeChange);
    ownIds.clear();
    for (const g of connectorsOnPage()) registerOwn(g);
  }
  function mergeStyles(list) {
    const out = {};
    for (const k of STYLE_KEYS) {
      const first = list[0][k];
      out[k] = list.every((d) => d[k] === first) ? first : null;
    }
    return out;
  }
  function postSelection() {
    const sel = figma.currentPage.selection;
    const conns = sel.filter(isConnector);
    if (sel.length > 0 && conns.length === sel.length) {
      const datas = conns.map(readData).filter((d) => !!d);
      figma.ui.postMessage({
        type: "selection",
        mode: "connectors",
        count: conns.length,
        style: datas.length ? mergeStyles(datas) : DEFAULTS
      });
    } else if (sel.length === 2 && conns.length === 0) {
      figma.ui.postMessage({ type: "selection", mode: "two", names: [sel[0].name, sel[1].name] });
    } else {
      figma.ui.postMessage({ type: "selection", mode: "other", count: sel.length, mixed: conns.length > 0 });
    }
  }
  function validateText(text) {
    if (text !== void 0 && !text.trim()) {
      throw new Error("Escreva a fala: na MoLIC, uma fala de transi\xE7\xE3o n\xE3o pode ficar vazia");
    }
  }
  function pick(patch) {
    const out = {};
    for (const k of STYLE_KEYS) if (patch[k] !== void 0 && patch[k] !== null) out[k] = patch[k];
    return out;
  }
  async function handle(msg) {
    if (msg.type === "create") {
      validateText(msg.style.text);
      const sel = figma.currentPage.selection;
      if (sel.length !== 2) throw new Error("Selecione exatamente dois elementos (origem e destino)");
      const data = __spreadProps(__spreadValues(__spreadValues({}, DEFAULTS), pick(msg.style)), { from: sel[0].id, to: sel[1].id });
      const group = await render(data, null);
      figma.currentPage.selection = [group];
      figma.notify("Fala de transi\xE7\xE3o criada.");
      return;
    }
    if (msg.type === "apply") {
      const patch = pick(msg.patch);
      const conns = selectedConnectors();
      if (!conns.length) throw new Error("Selecione uma ou mais setas para aplicar");
      if (!Object.keys(patch).length) {
        figma.notify("Nada mudou: altere algum campo antes de aplicar.");
        return;
      }
      validateText(patch.text);
      const { ok, failed } = await renderAll(conns, (d) => __spreadValues(__spreadValues({}, d), patch));
      if (failed.length) reportFailures(failed, ok, ok === 1 ? "seta atualizada" : "setas atualizadas");
      else figma.notify(ok === 1 ? "Seta atualizada." : `${ok} setas atualizadas.`);
      postSelection();
      return;
    }
    if (msg.type === "swap") {
      const conns = selectedConnectors();
      if (!conns.length) throw new Error("Selecione uma ou mais setas para inverter");
      const { ok, failed } = await renderAll(conns, (d) => __spreadProps(__spreadValues({}, d), {
        from: d.to,
        to: d.from,
        startSide: d.endSide,
        startT: d.endT,
        endSide: d.startSide,
        endT: d.startT
      }));
      if (failed.length) reportFailures(failed, ok, ok === 1 ? "seta invertida" : "setas invertidas");
      else figma.notify(ok === 1 ? "Dire\xE7\xE3o invertida." : `${ok} setas invertidas.`);
      postSelection();
      return;
    }
    if (msg.type === "reroute") {
      const all = connectorsOnPage();
      if (!all.length) {
        figma.notify("N\xE3o h\xE1 setas do MoLIC Connector nesta p\xE1gina.");
        return;
      }
      const { ok, failed } = await renderAll(all);
      if (failed.length) reportFailures(failed, ok, "redesenhadas");
      else figma.notify(`${ok} setas redesenhadas.`);
      return;
    }
    if (msg.type === "auto") autoUpdate = msg.auto;
  }
  figma.ui.onmessage = async (msg) => {
    busy = true;
    try {
      await handle(msg);
    } catch (e) {
      figma.notify(e instanceof Error ? e.message + "." : String(e), { error: true, timeout: 6e3 });
    } finally {
      busy = false;
    }
  };
  async function main() {
    await figma.loadFontAsync(FONT);
    figma.showUI(__html__, { width: 320, height: 640, themeColors: true });
    watchCurrentPage();
    figma.on("selectionchange", postSelection);
    figma.on("currentpagechange", () => {
      watchCurrentPage();
      postSelection();
    });
    postSelection();
  }
  main();
})();
