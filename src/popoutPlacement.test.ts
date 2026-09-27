import { describe, expect, it } from "vitest";
import {
  POPOUT_SIZE,
  clampFreePosition,
  cornerPosition,
  defaultEdgeForCorner,
  edgesForCorner,
  dockEdgeOffset,
  edgeOffset,
  nearestDockCorner,
  nearestEdge,
  type WorkArea,
} from "./popoutPlacement";

const work: WorkArea = { x: 100, y: 50, width: 1200, height: 800 };

describe("popout placement", () => {
  it("uses rectangle edges and DPI-scaled hysteresis on negative-coordinate displays", () => {
    const area = { x: -1920, y: -100, width: 1920, height: 1080 };
    const size = { width: 600, height: 250 };
    expect(nearestEdge({ x: -610, y: 718 }, area, size)).toBe("right");
    expect(nearestEdge({ x: -620, y: 725 }, area, size, "right", 1.5)).toBe("right");
    expect(nearestEdge({ x: -680, y: 725 }, area, size, "right", 1.5)).toBe("bottom");
    expect(edgeOffset({ x: -610, y: 315 }, area, size, "right")).toBe(0.5);
  });
  it.each([
    ["top-left", { x: 112, y: 62 }],
    ["top-right", { x: 928, y: 62 }],
    ["bottom-left", { x: 112, y: 668 }],
    ["bottom-right", { x: 928, y: 668 }],
  ] as const)("places and snaps to %s", (corner, expected) => {
    expect(cornerPosition(work, POPOUT_SIZE, corner)).toEqual(expected);
    expect(nearestDockCorner({ x: expected.x + 20, y: expected.y + 15 }, work, POPOUT_SIZE)).toBe(corner);
  });

  it("leaves distant windows free and clamps off-screen remembered positions", () => {
    expect(nearestDockCorner({ x: 500, y: 300 }, work, POPOUT_SIZE)).toBeNull();
    expect(clampFreePosition({ x: -900, y: 3000 }, work, POPOUT_SIZE)).toEqual({ x: 100, y: 680 });
  });

  it("maps dock corners to their reveal-tab edge", () => {
    expect(defaultEdgeForCorner("bottom-right", "top")).toBe("bottom");
    expect(nearestEdge({ x: 100, y: 300 }, work, POPOUT_SIZE)).toBe("left");
    expect(edgeOffset({ x: 500, y: 365 }, work, POPOUT_SIZE, "right")).toBe(0.5);
  });
});

describe("explicit dock reveal edges", () => {
  it.each([
    ["top-left", ["top", "left"]],
    ["top-right", ["top", "right"]],
    ["bottom-left", ["bottom", "left"]],
    ["bottom-right", ["bottom", "right"]],
  ] as const)("allows only adjacent edges for %s", (corner, edges) => {
    expect(edgesForCorner(corner)).toEqual(edges);
    for (const edge of edges) expect(defaultEdgeForCorner(corner, edge)).toBe(edge);
  });
  it("preserves the edge axis when switching corners", () => {
    expect(defaultEdgeForCorner("bottom-right", "right")).toBe("right");
    expect(defaultEdgeForCorner("bottom-right", "top")).toBe("bottom");
    expect(defaultEdgeForCorner("top-left", "right")).toBe("left");
    expect(defaultEdgeForCorner("top-left", "bottom")).toBe("top");
    expect(dockEdgeOffset("top-right", "top")).toBe(1);
    expect(dockEdgeOffset("top-right", "right")).toBe(0);
  });
});
