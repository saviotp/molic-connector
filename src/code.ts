// MoLIC Connector — falas de transição conectadas para diagramas MoLIC no Figma.
// Este arquivo roda no "sandbox" do Figma (tem acesso ao documento, não ao DOM).
// A interface (ui.html) roda num iframe e conversa com este arquivo por mensagens.

import { computePath, labelLines, minCorner, Path, Point, Route, SideChoice } from "./geometry";

type Kind = "transicao" | "ruptura";
type Speaker = "u" | "d";

/** O que o usuário escolhe na interface. */
interface Style {
  kind: Kind;
  speaker: Speaker;
  text: string;
  precond: string;
  route: Route;
  startSide: SideChoice;
  startT: number; // 0 a 1, posição ao longo do lado de saída
  endSide: SideChoice;
  endT: number;
}

/** O que fica guardado em cada seta. */
interface ConnectorData extends Style {
  from: string; // id do nó de origem
  to: string; // id do nó de destino
}

const KEY = "molic";
const FONT: FontName = { family: "Inter", style: "Regular" };
const BLACK: SolidPaint = { type: "SOLID", color: { r: 0, g: 0, b: 0 } };
const DASH = [6, 4];

const DEFAULTS: Style = {
  kind: "transicao",
  speaker: "u",
  text: "",
  precond: "",
  route: "orthogonal",
  startSide: "auto",
  startT: 0.5,
  endSide: "auto",
  endT: 0.5,
};
const STYLE_KEYS = Object.keys(DEFAULTS) as (keyof Style)[];

// Ids dos nós que o próprio plugin desenha (setas, rótulos, grupos).
// Mudanças neles não devem disparar um novo redesenho.
const ownIds = new Set<string>();
let autoUpdate = true;

// ---------------------------------------------------------------- leitura

function readData(node: BaseNode): ConnectorData | null {
  const raw = node.getPluginData(KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d.from || !d.to) return null;
    // Setas criadas por versões anteriores não têm os campos novos.
    return { ...DEFAULTS, ...d } as ConnectorData;
  } catch {
    return null;
  }
}

function connectorsOnPage(): GroupNode[] {
  return figma.currentPage.findAllWithCriteria({ types: ["GROUP"], pluginData: { keys: [KEY] } });
}

function isConnector(node: BaseNode): node is GroupNode {
  return node.type === "GROUP" && !!node.getPluginData(KEY);
}

function selectedConnectors(): GroupNode[] {
  return figma.currentPage.selection.filter(isConnector);
}

function registerOwn(group: GroupNode) {
  ownIds.add(group.id);
  for (const n of group.findAll()) ownIds.add(n.id);
}

/** Retângulo absoluto (coordenadas da página) de um nó. */
function boxOf(node: BaseNode | null): Rect | null {
  if (!node || node.removed || !("absoluteBoundingBox" in node)) return null;
  return (node as SceneNode).absoluteBoundingBox;
}

/** Origem do sistema de coordenadas onde `node` é posicionado (grupos não têm coordenadas próprias). */
function originFor(node: SceneNode): Point {
  let p: BaseNode | null = node.parent;
  while (p && (p.type === "GROUP" || p.type === "BOOLEAN_OPERATION")) p = p.parent;
  if (!p || p.type === "PAGE" || p.type === "DOCUMENT") return { x: 0, y: 0 };
  const t = (p as FrameNode).absoluteTransform;
  return { x: t[0][2], y: t[1][2] };
}

// ---------------------------------------------------------------- desenho

function shift(p: Point, o: Point): Point {
  return { x: p.x - o.x, y: p.y - o.y };
}

async function drawLine(vector: VectorNode, path: Path, kind: Kind, origin: Point) {
  const base = minCorner(path);
  const rel = (p: Point) => ({ x: p.x - base.x, y: p.y - base.y });

  const vertices: VectorVertex[] = path.points.map((p, i) => ({
    ...rel(p),
    strokeCap: i === path.points.length - 1 ? "ARROW_LINES" : "NONE",
    cornerRadius: i > 0 && i < path.points.length - 1 ? 8 : 0,
  }));

  const segments: VectorSegment[] = path.segments.map((s, i) => ({
    start: i,
    end: i + 1,
    tangentStart: s.c1 ? { x: s.c1.x - s.from.x, y: s.c1.y - s.from.y } : { x: 0, y: 0 },
    tangentEnd: s.c2 ? { x: s.c2.x - s.to.x, y: s.c2.y - s.to.y } : { x: 0, y: 0 },
  }));

  await vector.setVectorNetworkAsync({ vertices, segments });
  vector.strokes = [BLACK];
  vector.strokeWeight = 1;
  vector.dashPattern = kind === "ruptura" ? DASH : [];
  vector.fills = [];

  // O Figma pode reposicionar os vértices; corrigimos pela posição real do 1º vértice.
  const v0 = vector.vectorNetwork.vertices[0];
  const start = shift(path.points[0], origin);
  vector.x = start.x - v0.x;
  vector.y = start.y - v0.y;
}

function pageBackground(): Paint[] {
  const bg = figma.currentPage.backgrounds;
  return bg && bg.length ? [...bg] : [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
}

function drawLabel(frame: FrameNode, text: TextNode, data: ConnectorData, at: Point) {
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingLeft = frame.paddingRight = 6;
  frame.paddingTop = frame.paddingBottom = 2;
  // Mesmo fundo da página: a linha parece "interrompida" pelo texto.
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

/** Acha as partes de uma seta pelo tipo (não pelo nome, que o usuário pode mudar). */
function partsOf(group: GroupNode) {
  const vector = group.findChild((n) => n.type === "VECTOR") as VectorNode | null;
  const frame = group.findChild((n) => n.type === "FRAME") as FrameNode | null;
  const text = frame ? (frame.findOne((n) => n.type === "TEXT") as TextNode | null) : null;
  return { vector, frame, text };
}

function newVector() {
  const v = figma.createVector();
  v.name = "seta";
  return v;
}

function newLabel() {
  const frame = figma.createFrame();
  frame.name = "rótulo";
  const text = figma.createText();
  text.name = "fala";
  frame.appendChild(text);
  return { frame, text };
}

/**
 * Cria (group = null) ou atualiza uma fala de transição.
 * Lança um Error com mensagem legível se não puder desenhar.
 */
async function render(data: ConnectorData, group: GroupNode | null): Promise<GroupNode> {
  const a = boxOf(await figma.getNodeByIdAsync(data.from));
  const b = boxOf(await figma.getNodeByIdAsync(data.to));
  if (!a && !b) throw new Error("a origem e o destino foram apagados");
  if (!a) throw new Error("a origem foi apagada");
  if (!b) throw new Error("o destino foi apagado");

  const path = computePath(a, b, data.route, { side: data.startSide, t: data.startT }, { side: data.endSide, t: data.endT });

  let vector: VectorNode;
  let frame: FrameNode;
  let text: TextNode;

  if (group) {
    // Recria qualquer parte que esteja faltando, em vez de desistir.
    const parts = partsOf(group);
    vector = parts.vector ?? newVector();
    if (!parts.vector) group.appendChild(vector);
    if (parts.frame && parts.text) {
      frame = parts.frame;
      text = parts.text;
    } else {
      parts.frame?.remove();
      ({ frame, text } = newLabel());
      group.appendChild(frame);
    }
  } else {
    vector = newVector();
    ({ frame, text } = newLabel());
  }

  // Antes de agrupar, os nós novos estão na página (origem 0,0).
  const origin = group ? originFor(group) : { x: 0, y: 0 };

  await drawLine(vector, path, data.kind, origin);
  drawLabel(frame, text, data, shift(path.label, origin));

  if (!group) {
    group = figma.group([vector, frame], figma.currentPage);
    group.setRelaunchData({ edit: "Editar esta fala de transição" });
  }

  group.name = `MoLIC · ${data.speaker}: ${data.text}`;
  group.setPluginData(KEY, JSON.stringify(data));
  registerOwn(group);
  return group;
}

/** Redesenha um conjunto de setas e devolve as que falharam, com o motivo. */
async function renderAll(groups: GroupNode[], change?: (d: ConnectorData) => ConnectorData) {
  const failed: { group: GroupNode; reason: string }[] = [];
  let ok = 0;
  for (const g of groups) {
    const data = readData(g);
    if (!data) {
      failed.push({ group: g, reason: "dados da seta ilegíveis" });
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

function reportFailures(failed: { group: GroupNode; reason: string }[], ok: number, verb: string) {
  if (!failed.length) return;
  // Seleciona as setas com problema para o usuário encontrá-las.
  figma.currentPage.selection = failed.map((f) => f.group);
  const reasons = [...new Set(failed.map((f) => f.reason))].join("; ");
  figma.notify(`${ok} ${verb}. ${failed.length} com problema (selecionadas): ${reasons}.`, {
    error: true,
    timeout: 8000,
  });
}

// ---------------------------------------------------------------- atualização automática

let timer: ReturnType<typeof setTimeout> | null = null;
let busy = false;
const GEOMETRY: NodeChangeProperty[] = ["x", "y", "width", "height", "relativeTransform", "rotation"];

function onNodeChange(event: NodeChangeEvent) {
  if (!autoUpdate || busy) return;
  const relevant = event.nodeChanges.some(
    (c) => c.type === "PROPERTY_CHANGE" && !ownIds.has(c.node.id) && c.properties.some((p) => GEOMETRY.includes(p)),
  );
  if (!relevant) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    busy = true;
    try {
      await renderAll(connectorsOnPage()); // silencioso: setas quebradas são reportadas ao redesenhar manualmente
    } finally {
      busy = false;
    }
  }, 60);
}

let watchedPage: PageNode | null = null;
function watchCurrentPage() {
  if (watchedPage) watchedPage.off("nodechange", onNodeChange);
  watchedPage = figma.currentPage;
  watchedPage.on("nodechange", onNodeChange);
  ownIds.clear();
  for (const g of connectorsOnPage()) registerOwn(g);
}

// ---------------------------------------------------------------- seleção e interface

/** Junta os estilos de várias setas: campos iguais mantêm o valor, diferentes viram null ("vários"). */
function mergeStyles(list: ConnectorData[]): Partial<Record<keyof Style, unknown>> {
  const out: Partial<Record<keyof Style, unknown>> = {};
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
    const datas = conns.map(readData).filter((d): d is ConnectorData => !!d);
    figma.ui.postMessage({
      type: "selection",
      mode: "connectors",
      count: conns.length,
      style: datas.length ? mergeStyles(datas) : DEFAULTS,
    });
  } else if (sel.length === 2 && conns.length === 0) {
    figma.ui.postMessage({ type: "selection", mode: "two", names: [sel[0].name, sel[1].name] });
  } else {
    figma.ui.postMessage({ type: "selection", mode: "other", count: sel.length, mixed: conns.length > 0 });
  }
}

function validateText(text: string | undefined): void {
  // Fonte: "falas de transição não podem ser setas vazias, devem sempre indicar quem está falando".
  if (text !== undefined && !text.trim()) {
    throw new Error("Escreva a fala: na MoLIC, uma fala de transição não pode ficar vazia");
  }
}

function pick(patch: Partial<Style>): Partial<Style> {
  const out: Partial<Style> = {};
  for (const k of STYLE_KEYS) if (patch[k] !== undefined && patch[k] !== null) (out as any)[k] = patch[k];
  return out;
}

type Msg =
  | { type: "create"; style: Style }
  | { type: "apply"; patch: Partial<Style> }
  | { type: "swap" }
  | { type: "reroute" }
  | { type: "auto"; auto: boolean };

async function handle(msg: Msg) {
  if (msg.type === "create") {
    validateText(msg.style.text);
    const sel = figma.currentPage.selection;
    if (sel.length !== 2) throw new Error("Selecione exatamente dois elementos (origem e destino)");
    // A ordem de seleção define a direção: o primeiro selecionado é a origem.
    const data: ConnectorData = { ...DEFAULTS, ...pick(msg.style), from: sel[0].id, to: sel[1].id };
    const group = await render(data, null);
    figma.currentPage.selection = [group];
    figma.notify("Fala de transição criada.");
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
    const { ok, failed } = await renderAll(conns, (d) => ({ ...d, ...patch }));
    if (failed.length) reportFailures(failed, ok, ok === 1 ? "seta atualizada" : "setas atualizadas");
    else figma.notify(ok === 1 ? "Seta atualizada." : `${ok} setas atualizadas.`);
    postSelection();
    return;
  }

  if (msg.type === "swap") {
    const conns = selectedConnectors();
    if (!conns.length) throw new Error("Selecione uma ou mais setas para inverter");
    const { ok, failed } = await renderAll(conns, (d) => ({
      ...d,
      from: d.to,
      to: d.from,
      startSide: d.endSide,
      startT: d.endT,
      endSide: d.startSide,
      endT: d.startT,
    }));
    if (failed.length) reportFailures(failed, ok, ok === 1 ? "seta invertida" : "setas invertidas");
    else figma.notify(ok === 1 ? "Direção invertida." : `${ok} setas invertidas.`);
    postSelection();
    return;
  }

  if (msg.type === "reroute") {
    const all = connectorsOnPage();
    if (!all.length) {
      figma.notify("Não há setas do MoLIC Connector nesta página.");
      return;
    }
    const { ok, failed } = await renderAll(all);
    if (failed.length) reportFailures(failed, ok, "redesenhadas");
    else figma.notify(`${ok} setas redesenhadas.`);
    return;
  }

  if (msg.type === "auto") autoUpdate = msg.auto;
}

figma.ui.onmessage = async (msg: Msg) => {
  busy = true;
  try {
    await handle(msg);
  } catch (e) {
    figma.notify(e instanceof Error ? e.message + "." : String(e), { error: true, timeout: 6000 });
  } finally {
    busy = false;
  }
};

// ---------------------------------------------------------------- início

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
