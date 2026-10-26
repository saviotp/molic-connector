// Geometria pura (sem API do Figma), para poder ser testada fora do Figma.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Route = "straight" | "orthogonal" | "curve";
export type Side = "left" | "right" | "top" | "bottom";
export type SideChoice = Side | "auto";

/** Onde a seta encosta numa caixa: um lado e a posição ao longo dele (0 = início, 1 = fim). */
export interface AnchorChoice {
  side: SideChoice;
  t: number;
}

/** Um trecho do caminho: reta até `to`, ou curva cúbica com controles c1 e c2. */
export interface Segment {
  from: Point;
  to: Point;
  c1?: Point;
  c2?: Point;
}

export interface Path {
  points: Point[]; // vértices, na ordem
  segments: Segment[];
  label: Point; // onde o rótulo fica
  startSide: Side;
  endSide: Side;
}

const STUB = 24; // quanto a rota ortogonal "sai" da caixa antes de virar

const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

const clamp01 = (t: number) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0.5));

/** Ponto num lado da caixa. Em cima/embaixo, t vai da esquerda para a direita; nos lados, de cima para baixo. */
export function anchor(r: Rect, side: Side, t = 0.5): Point {
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

const opposite: Record<Side, Side> = { left: "right", right: "left", top: "bottom", bottom: "top" };

const direction: Record<Side, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const isHorizontal = (s: Side) => s === "left" || s === "right";

/**
 * Escolhe automaticamente de que lado a seta sai da origem `a` e por qual chega em `b`.
 * Se há espaço horizontal entre as caixas e a distância horizontal domina, usa os lados;
 * senão, usa cima/baixo.
 */
export function chooseSides(a: Rect, b: Rect): { start: Side; end: Side } {
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;

  const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
  const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));

  let horizontal: boolean;
  if (gapX > 0 && gapY <= 0) horizontal = true;
  else if (gapY > 0 && gapX <= 0) horizontal = false;
  else horizontal = Math.abs(dx) >= Math.abs(dy);

  const start: Side = horizontal ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
  return { start, end: opposite[start] };
}

/** Lado de chegada automático quando o de saída foi fixado (e vice-versa). */
function autoFacing(fixedPoint: Point, other: Rect): Side {
  const c = center(other);
  const dx = fixedPoint.x - c.x;
  const dy = fixedPoint.y - c.y;
  // Lado de `other` voltado para o ponto, ponderado pelas proporções da caixa.
  if (Math.abs(dx) / Math.max(other.width, 1) >= Math.abs(dy) / Math.max(other.height, 1)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function resolveSides(a: Rect, b: Rect, start: AnchorChoice, end: AnchorChoice): { s: Side; e: Side } {
  const auto = chooseSides(a, b);
  if (start.side === "auto" && end.side === "auto") return { s: auto.start, e: auto.end };
  if (start.side !== "auto" && end.side !== "auto") return { s: start.side, e: end.side };
  if (start.side !== "auto") {
    const s = start.side;
    return { s, e: autoOther(s, anchor(a, s, start.t), b) };
  }
  const e = end.side as Side;
  return { s: autoOther(e, anchor(b, e, end.t), a), e };
}

/**
 * Lado automático da outra caixa quando um lado foi fixado.
 * Se a outra caixa está inteira na direção para onde a seta aponta, usa o lado oposto
 * (sai pelo topo → chega por baixo); senão, o lado voltado para o ponto fixo.
 */
function autoOther(fixed: Side, p: Point, other: Rect): Side {
  const ahead =
    (fixed === "right" && other.x >= p.x) ||
    (fixed === "left" && other.x + other.width <= p.x) ||
    (fixed === "bottom" && other.y >= p.y) ||
    (fixed === "top" && other.y + other.height <= p.y);
  return ahead ? opposite[fixed] : autoFacing(p, other);
}

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const same = (p: Point, q: Point) => Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5;

function bezierAt(s: Segment, t: number): Point {
  const c1 = s.c1 ?? s.from;
  const c2 = s.c2 ?? s.to;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * s.from.x + b * c1.x + c * c2.x + d * s.to.x,
    y: a * s.from.y + b * c1.y + c * c2.y + d * s.to.y,
  };
}

/** Tira pontos repetidos e pontos no meio de uma reta (colineares). */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && same(out[out.length - 1], p)) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const collinear = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - p.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - p.y) < 0.5);
      if (collinear) out.pop();
    }
    out.push(p);
  }
  return out;
}

/** Ponto na metade do comprimento de uma linha poligonal. */
function halfway(points: Point[]): Point {
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

/** Rota ortogonal genérica entre dois pontos de saída/chegada. */
function orthogonal(p0: Point, s: Side, p3: Point, e: Side): Point[] {
  const d0 = direction[s];
  const d1 = direction[e];
  // Pequenos "tocos" saindo das caixas, para a seta não colar na borda ao virar.
  const a: Point = { x: p0.x + d0.x * STUB, y: p0.y + d0.y * STUB };
  const b: Point = { x: p3.x + d1.x * STUB, y: p3.y + d1.y * STUB };

  let middle: Point[];
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

  // Quando o caminho natural é direto (lados frente a frente), os tocos somem na simplificação.
  return simplify([p0, a, ...middle, b, p3]);
}

export function computePath(
  a: Rect,
  b: Rect,
  route: Route,
  start: AnchorChoice = { side: "auto", t: 0.5 },
  end: AnchorChoice = { side: "auto", t: 0.5 },
): Path {
  const { s, e } = resolveSides(a, b, start, end);
  const p0 = anchor(a, s, start.side === "auto" ? 0.5 : start.t);
  const p3 = anchor(b, e, end.side === "auto" ? 0.5 : end.t);

  if (route === "curve") {
    const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const k = Math.max(30, dist / 2);
    const d0 = direction[s];
    const d1 = direction[e];
    const seg: Segment = {
      from: p0,
      to: p3,
      c1: { x: p0.x + d0.x * k, y: p0.y + d0.y * k },
      c2: { x: p3.x + d1.x * k, y: p3.y + d1.y * k },
    };
    return { points: [p0, p3], segments: [seg], label: bezierAt(seg, 0.5), startSide: s, endSide: e };
  }

  const points = route === "straight" ? [p0, p3] : orthogonal(p0, s, p3, e);
  return {
    points,
    segments: points.slice(1).map((to, i) => ({ from: points[i], to })),
    label: halfway(points),
    startSide: s,
    endSide: e,
  };
}

/** Menor x/y de todos os pontos, incluindo os de controle (para posicionar o vetor). */
export function minCorner(path: Path): Point {
  const all: Point[] = [];
  for (const s of path.segments) {
    all.push(s.from, s.to);
    if (s.c1) all.push(s.c1);
    if (s.c2) all.push(s.c2);
  }
  return {
    x: Math.min(...all.map((p) => p.x)),
    y: Math.min(...all.map((p) => p.y)),
  };
}

/** Monta as linhas do rótulo seguindo a notação MoLIC. */
export function labelLines(speaker: "u" | "d", text: string, precond: string): string[] {
  const lines: string[] = [];
  if (precond.trim()) lines.push(`precond: ${precond.trim()}`);
  lines.push(`${speaker}: ${text.trim()}`);
  return lines;
}
