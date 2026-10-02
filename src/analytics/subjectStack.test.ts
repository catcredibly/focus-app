import { expect, it } from "vitest";
import { orderSubjectsForStack } from "./subjectStack";

const rows = (...colors: string[]) => colors.map((color, id) => ({ id, color, seconds: id + 1 }));
const adjacencies = (values: { color: string }[]) =>
  values.slice(1).filter((row, index) => row.color.toLowerCase() === values[index].color.toLowerCase()).length;

it("handles empty input and a single Subject", () => {
  expect(orderSubjectsForStack([])).toEqual([]);
  const input = rows("blue");
  expect(orderSubjectsForStack(input)).toEqual(input);
});
it("separates repeated colors when possible, without changing input rows or values", () => {
  const input = rows("blue", "red", "red", "orange", "red", "purple");
  input.forEach(Object.freeze);
  Object.freeze(input);
  const result = orderSubjectsForStack(input);
  expect(adjacencies(result)).toBe(0);
  expect(result.map((row) => row.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  result.forEach((row) => expect(row).toBe(input[row.id]));
  expect(result.filter((row) => row.color === "red").map((row) => row.id)).toEqual([1, 2, 4]);
  expect(orderSubjectsForStack(input)).toEqual(result);
});
it("prefers the largest remaining count, then the earliest next source row", () => {
  const input = rows("blue", "red", "green", "red", "blue", "red");
  expect(orderSubjectsForStack(input).map((row) => row.id)).toEqual([1, 0, 3, 2, 4, 5]);
});
it("minimizes unavoidable same-color boundaries", () => {
  const result = orderSubjectsForStack(rows("red", "red", "red", "red", "blue"));
  expect(result.map((row) => row.color)).toEqual(["red", "blue", "red", "red", "red"]);
  expect(adjacencies(result)).toBe(2);
});
it("groups hex case variants without rewriting stored colors", () => {
  const input = rows("#FF4D57", "#ff4d57", "#4da3ff");
  expect(orderSubjectsForStack(input)).toEqual([input[0], input[2], input[1]]);
});
it("achieves the minimum adjacency count across small color distributions", () => {
  for (let red = 0; red <= 5; red++)
    for (let blue = 0; blue <= 5; blue++)
      for (let green = 0; green <= 5; green++) {
        const input = rows(
          ...Array<string>(red).fill("red"),
          ...Array<string>(blue).fill("blue"),
          ...Array<string>(green).fill("green"),
        );
        const result = orderSubjectsForStack(input);
        const minimum = Math.max(0, 2 * Math.max(red, blue, green) - input.length - 1);
        expect(adjacencies(result)).toBe(minimum);
        for (const color of ["red", "blue", "green"])
          expect(result.filter((row) => row.color === color)).toEqual(input.filter((row) => row.color === color));
      }
});
