// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FilterSelect } from "./FilterSelect";
import { academicYearOptions, subjectOptions } from "../selectorOptions";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (text: string) => text }),
}));
const years = [
  { id: "old-b", name: "Old B", archived: true },
  { id: "b", name: "B", archived: false },
  { id: "old-a", name: "Old A", archived: true },
  { id: "a", name: "A", archived: false },
];
const subjects = years.map((year) => ({
  id: year.id + "-physics",
  name: "Physics",
  academicYearId: year.id,
  color: "red",
  archived: false,
}));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const click = async (node: Element) => act(async () => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const key = async (node: Element, value: string) =>
  act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
const menu = () => document.querySelector('[role="listbox"]') as HTMLElement;

it("keeps multi-selection open and makes All a valid selectable state", async () => {
  function Harness() {
    const [selection, setSelection] = useState<string[]>([]);
    return (
      <FilterSelect
        multiple
        label="Academic Year"
        value={selection}
        onChange={setSelection}
        options={[{ value: "", label: "All Years" }, ...academicYearOptions(years)]}
      />
    );
  }
  await act(async () => root.render(<Harness />));
  await click(host.querySelector("button")!);
  expect(menu().getAttribute("aria-multiselectable")).toBe("true");
  const options = () => [...menu().querySelectorAll('[role="option"]')];
  expect(options().map((node) => node.textContent)).toEqual(["All Years", "A", "B", "Old A", "Old B"]);
  await click(options()[1]);
  await click(options()[2]);
  expect(options().filter((node) => node.getAttribute("aria-selected") === "true")).toHaveLength(2);
  expect(host.querySelector("button")!.textContent).toContain("A, B");
  await click(options()[0]);
  expect(options()[0].getAttribute("aria-selected")).toBe("true");
  expect(
    options()
      .slice(1)
      .some((node) => node.getAttribute("aria-selected") === "true"),
  ).toBe(false);
  await key(menu(), "Escape");
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  expect(document.activeElement).toBe(host.querySelector("button"));
});

it("renders one archived separator and non-selectable headers, with keyboard navigation over Subjects", async () => {
  const changed = vi.fn();
  await act(async () =>
    root.render(<FilterSelect label="Subject" value="" onChange={changed} options={subjectOptions(years, subjects)} />),
  );
  await click(host.querySelector("button")!);
  expect(menu().querySelectorAll(".filter-archive-heading")).toHaveLength(1);
  expect([...menu().querySelectorAll(".filter-group-heading")].map((node) => node.textContent)).toEqual([
    "A",
    "B",
    "Old A",
    "Old B",
  ]);
  expect(menu().querySelectorAll('[role="option"]')).toHaveLength(4);
  await click(menu().querySelector(".filter-group-heading")!);
  expect(changed).not.toHaveBeenCalled();
  await key(menu(), "End");
  await key(menu(), "Enter");
  expect(changed).toHaveBeenCalledWith("old-b-physics");
  expect(document.querySelector('[role="listbox"]')).toBeNull();
});

it("omits archive separators when unnecessary and has no empty active section for archived-only choices", async () => {
  await act(async () =>
    root.render(
      <FilterSelect
        label="Year"
        value="a"
        onChange={() => {}}
        options={academicYearOptions(years.filter((year) => !year.archived))}
      />,
    ),
  );
  await click(host.querySelector("button")!);
  expect(menu().querySelector(".filter-archive-heading")).toBeNull();
  await act(async () =>
    root.render(
      <FilterSelect
        label="Year"
        value="old-a"
        onChange={() => {}}
        options={academicYearOptions(years.filter((year) => year.archived))}
      />,
    ),
  );
  expect(menu().firstElementChild!.textContent).toBe("Archived");
  expect(menu().querySelector(".filter-archive-heading")!.classList.contains("has-divider")).toBe(false);
});

it("constrains long grouped menus to the viewport and scrolls keyboard choices into view", async () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  const long = Array.from({ length: 80 }, (_, i) => ({
    value: String(i),
    label: `Subject ${i}`,
    group: `Year ${Math.floor(i / 10)}`,
    groupId: String(Math.floor(i / 10)),
  }));
  await act(async () => root.render(<FilterSelect label="Subject" value="0" onChange={() => {}} options={long} />));
  await click(host.querySelector("button")!);
  expect(parseFloat(menu().style.maxHeight)).toBeLessThanOrEqual(Math.min(320, window.innerHeight * 0.45));
  expect(menu().querySelectorAll(".filter-group-heading")).toHaveLength(8);
  await key(menu(), "End");
  expect(menu().getAttribute("aria-activedescendant")).toBe(menu().querySelectorAll('[role="option"]')[79].id);
  expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
});
