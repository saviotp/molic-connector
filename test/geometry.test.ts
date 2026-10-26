import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseSides, computePath, labelLines } from "../src/geometry.ts";

// Cena "Área à Acessar" (à esquerda) e um processo do sistema (quadrado preto) acima, à direita.
const cena = { x: 0, y: 300, width: 400, height: 380 };
const processo = { x: 760, y: 0, width: 60, height: 60 };
const abaixo = { x: 100, y: 900, width: 200, height: 100 };

test("escolhe os lados pela posição relativa", () => {
  assert.deepEqual(chooseSides(cena, processo), { start: "right", end: "left" });
  assert.deepEqual(chooseSides(processo, cena), { start: "left", end: "right" });
  assert.deepEqual(chooseSides(cena, abaixo), { start: "bottom", end: "top" });
});

test("reta liga os pontos médios dos lados", () => {
  const p = computePath(cena, processo, "straight");
  assert.deepEqual(p.points, [{ x: 400, y: 490 }, { x: 760, y: 30 }]);
});

test("ortogonal faz cotovelo no meio, com segmentos só horizontais/verticais", () => {
  const p = computePath(cena, processo, "orthogonal");
  assert.equal(p.points.length, 4);
  for (const s of p.segments) assert.ok(s.from.x === s.to.x || s.from.y === s.to.y);
  assert.deepEqual(p.points[1], { x: 580, y: 490 });
  assert.deepEqual(p.label, { x: 580, y: 260 });
});

test("ortogonal vira reta quando as caixas estão alinhadas", () => {
  const p = computePath({ x: 0, y: 0, width: 100, height: 100 }, { x: 300, y: 0, width: 100, height: 100 }, "orthogonal");
  assert.equal(p.points.length, 2);
  assert.equal(p.points[0].y, p.points[1].y);
});

test("curva sai e chega na direção dos lados", () => {
  const p = computePath(cena, processo, "curve");
  const s = p.segments[0];
  assert.ok(s.c1!.x > s.from.x && s.c1!.y === s.from.y); // sai para a direita
  assert.ok(s.c2!.x < s.to.x && s.c2!.y === s.to.y); // chega pela esquerda
});

test("rótulo segue a notação: precond acima, depois quem fala", () => {
  assert.deepEqual(labelLines("u", " resposta ao processo ", ""), ["u: resposta ao processo"]);
  assert.deepEqual(labelLines("d", "código inválido", "estar cadastrado"), [
    "precond: estar cadastrado",
    "d: código inválido",
  ]);
});

test("ponto fixo: todas as setas saem do mesmo ponto da origem", () => {
  const start = { side: "right" as const, t: 0.5 };
  const p1 = computePath(cena, processo, "curve", start);
  const p2 = computePath(cena, abaixo, "curve", start);
  assert.deepEqual(p1.points[0], { x: 400, y: 490 });
  assert.deepEqual(p2.points[0], { x: 400, y: 490 });
  assert.equal(p2.startSide, "right");
});

test("posição ao longo do lado (t) e lado de chegada automático", () => {
  const p = computePath(cena, processo, "straight", { side: "top", t: 0.25 });
  assert.deepEqual(p.points[0], { x: 100, y: 300 });
  assert.equal(p.endSide, "bottom"); // processo está acima: chega por baixo
});

test("ortogonal com lados escolhidos só tem segmentos horizontais/verticais", () => {
  for (const s of ["top", "right", "bottom", "left"] as const) {
    for (const e of ["top", "right", "bottom", "left"] as const) {
      const p = computePath(cena, processo, "orthogonal", { side: s, t: 0.3 }, { side: e, t: 0.7 });
      for (const seg of p.segments) assert.ok(seg.from.x === seg.to.x || seg.from.y === seg.to.y, `${s}->${e}`);
      assert.ok(p.points.length >= 2);
    }
  }
});

test("dados antigos sem lado escolhido continuam funcionando (padrão automático)", () => {
  const a = computePath(cena, processo, "orthogonal");
  const b = computePath(cena, processo, "orthogonal", { side: "auto", t: 0.5 }, { side: "auto", t: 0.5 });
  assert.deepEqual(a, b);
});
