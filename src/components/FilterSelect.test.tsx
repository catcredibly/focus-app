// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { FilterSelect } from "./FilterSelect";
import { academicYearOptions, subjectOptions, pruneSubjectSelection } from "../selectorOptions";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (text: string, data?: { count?: number }) => text.replace("{{count}}", String(data?.count ?? "")),
  }),
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
const panel = () => document.querySelector(".analytics-filter-menu") as HTMLElement;
const options = () => [...menu().querySelectorAll('[role="option"]')];
const toggle = () => panel().querySelector('[role="switch"]')!;
const trigger = (label = "Academic Year") => host.querySelector(`button[aria-label="${label}"]`)!;
const typeSearch = async (value: string) =>
  act(async () => {
    const field = panel().querySelector('input[type="search"]') as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
function Harness({ initial = [] }: { initial?: string[] }) {
  const [selection, setSelection] = useState(initial);
  return (
    <FilterSelect
      entity="academicYear"
      multiple
      label="Academic Year"
      value={selection}
      onChange={setSelection}
      options={[{ value: "", label: "All Academic Years" }, ...academicYearOptions(years)]}
    />
  );
}

it("defaults to compact single selection with search and a visible off toggle", async () => {
  await act(async () => root.render(<Harness />));
  expect(trigger().textContent).toBe("All Academic Years");
  expect(document.querySelector('input[type="search"]')).toBeNull();
  await click(trigger());
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(panel().querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  expect(document.activeElement).toBe(panel().querySelector('input[type="search"]'));
  await click(options()[1]);
  expect(trigger().textContent).toBe("A");
  expect(panel()).toBeNull();
  await click(trigger());
  await click(options()[2]);
  expect(trigger().textContent).toBe("B");
});

it("enabling Multi-select preserves the existing selection and adds real checkboxes", async () => {
  await act(async () => root.render(<Harness initial={["a"]} />));
  await click(trigger());
  await click(toggle());
  expect(trigger().textContent).toBe("A");
  expect(menu().getAttribute("aria-multiselectable")).toBe("true");
  expect((options()[1].querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
  await click(options()[2].querySelector('input[type="checkbox"]')!);
  expect(trigger().textContent).toBe("A, B");
  expect(options().filter((node) => node.getAttribute("aria-selected") === "true")).toHaveLength(2);
  await click(options()[0]);
  expect(trigger().textContent).toBe("All Academic Years");
  expect((options()[0].querySelector("input") as HTMLInputElement).checked).toBe(true);
  expect(
    options()
      .slice(1)
      .some((node) => node.getAttribute("aria-selected") === "true"),
  ).toBe(false);
});

it("disabling Multi-select resets multiple selections to All, preserving a lone selection", async () => {
  await act(async () => root.render(<Harness initial={["a", "b"]} />));
  await click(trigger());
  await click(toggle());
  expect(trigger().textContent).toBe("All Academic Years");
  expect(panel().querySelector('input[type="checkbox"]')).toBeNull();
  await click(options()[1]);
  await click(trigger());
  await click(toggle());
  await click(toggle());
  expect(trigger().textContent).toBe("A");
});

it("summarizes many selections while preserving full names in the trigger tooltip", async () => {
  await act(async () => root.render(<Harness initial={["a", "b", "old-a"]} />));
  expect(trigger().textContent).toBe("3 Academic Years");
  expect(trigger().getAttribute("title")).toBe("A, B, Old A");
});

it("search matches Subjects or group names, keeps All available, and preserves selected items", async () => {
  function Subjects() {
    const [selected, setSelected] = useState(["a-physics"]);
    return (
      <FilterSelect
        entity="subject"
        multiple
        label="Subject"
        value={selected}
        onChange={setSelected}
        options={[{ value: "", label: "All Subjects" }, ...subjectOptions(years, subjects)]}
      />
    );
  }
  await act(async () => root.render(<Subjects />));
  await click(trigger("Subject"));
  await click(toggle());
  await typeSearch("Old B");
  expect(options().map((node) => node.textContent)).toEqual(["All Subjects", "Physics"]);
  expect(menu().querySelector(".filter-group-heading")!.textContent).toBe("Old B");
  expect(trigger("Subject").textContent).toBe("Physics");
  await click(options()[1]);
  expect(trigger("Subject").textContent).toBe("Physics, Physics");
  await typeSearch("not present");
  expect(options()).toHaveLength(1);
  expect(menu().querySelector('[role="status"]')!.textContent).toBe("No results found");
  await typeSearch("physics");
  expect(options()).toHaveLength(5);
  await click(options()[0]);
  expect(trigger("Subject").textContent).toBe("All Subjects");
});

it("lets Enter select a search result instead of accidentally selecting All", async () => {
  await act(async () => root.render(<Harness />));
  await click(trigger());
  await typeSearch("Old B");
  await key(panel().querySelector('input[type="search"]')!, "Enter");
  expect(trigger().textContent).toBe("Old B");
  expect(panel()).toBeNull();
});

it("renders one archived separator and non-selectable grouped headings", async () => {
  const changed = vi.fn();
  await act(async () =>
    root.render(
      <FilterSelect
        entity="subject"
        label="Subject"
        value=""
        onChange={changed}
        options={subjectOptions(years, subjects)}
      />,
    ),
  );
  await click(trigger("Subject"));
  expect(menu().querySelectorAll(".filter-archive-heading")).toHaveLength(1);
  expect([...menu().querySelectorAll(".filter-group-heading")].map((node) => node.textContent)).toEqual([
    "A",
    "B",
    "Old A",
    "Old B",
  ]);
  await click(menu().querySelector(".filter-group-heading")!);
  expect(changed).not.toHaveBeenCalled();
  await key(menu(), "End");
  await key(menu(), "Enter");
  expect(changed).toHaveBeenCalledWith("old-b-physics");
  expect(panel()).toBeNull();
});

it("has no empty active section for archived-only options and hides unnecessary separators", async () => {
  await act(async () =>
    root.render(
      <FilterSelect
        entity="academicYear"
        label="Academic Year"
        value="a"
        onChange={() => {}}
        options={academicYearOptions(years.filter((year) => !year.archived))}
      />,
    ),
  );
  await click(trigger());
  expect(menu().querySelector(".filter-archive-heading")).toBeNull();
  await act(async () =>
    root.render(
      <FilterSelect
        entity="academicYear"
        label="Academic Year"
        value="old-a"
        onChange={() => {}}
        options={academicYearOptions(years.filter((year) => year.archived))}
      />,
    ),
  );
  expect(menu().firstElementChild!.textContent).toBe("Archived");
  expect(menu().querySelector(".filter-archive-heading")!.classList.contains("has-divider")).toBe(false);
});

it("keeps form controls 40px high and submits the selected year through FormData", async () => {
  const css = readFileSync("src/styles.css", "utf8");
  const style = document.createElement("style");
  style.textContent = css.match(/\.analytics-filter-select \{[^}]+\}/)![0];
  document.head.append(style);
  function Form() {
    const [value, setValue] = useState("a");
    return (
      <form className="form">
        <label style={{ display: "flex", flexDirection: "column" }}>
          Academic Year
          <FilterSelect
            entity="academicYear"
            label="Academic Year"
            name="year"
            value={value}
            onChange={setValue}
            options={academicYearOptions(years)}
          />
        </label>
      </form>
    );
  }
  await act(async () => root.render(<Form />));
  expect(getComputedStyle(trigger()).height).toBe("40px");
  expect(getComputedStyle(trigger()).flexBasis).toBe("auto");
  await click(trigger());
  expect((toggle() as HTMLButtonElement).disabled).toBe(true);
  expect(menu().querySelector('input[type="checkbox"]')).toBeNull();
  await click(options()[1]);
  expect(new FormData(host.querySelector("form")!).get("year")).toBe("b");
  style.remove();
});

it("prunes only invalid Subjects when year filters narrow and preserves them when scope expands to All", async () => {
  function Linked() {
    const [yearIds, setYearIds] = useState<string[]>([]),
      [subjectIds, setSubjectIds] = useState(["a-physics", "b-physics"]);
    useEffect(() => {
      setSubjectIds((selection) => {
        const next = pruneSubjectSelection(selection, subjects, yearIds);
        return next.length === selection.length ? selection : next;
      });
    }, [yearIds]);
    return (
      <>
        <FilterSelect
          entity="academicYear"
          multiple
          label="Academic Year"
          value={yearIds}
          onChange={setYearIds}
          options={[{ value: "", label: "All Academic Years" }, ...academicYearOptions(years)]}
        />
        <FilterSelect
          entity="subject"
          multiple
          label="Subject"
          value={subjectIds}
          onChange={setSubjectIds}
          options={[{ value: "", label: "All Subjects" }, ...subjectOptions(years, subjects, yearIds)]}
        />
      </>
    );
  }
  await act(async () => root.render(<Linked />));
  await click(trigger());
  await click(options()[1]);
  expect(trigger("Subject").textContent).toBe("Physics");
  await click(trigger("Subject"));
  expect(options()).toHaveLength(2);
  await key(menu(), "Escape");
  await click(trigger());
  await click(options()[0]);
  expect(trigger("Subject").textContent).toBe("Physics");
  await click(trigger());
  await click(options()[2]);
  expect(trigger("Subject").textContent).toBe("All Subjects");
});

it("scrolls grouped options separately from search and toggle controls", async () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  const long = Array.from({ length: 80 }, (_, i) => ({
    value: String(i),
    label: `Subject ${i}`,
    group: `Year ${Math.floor(i / 10)}`,
    groupId: String(Math.floor(i / 10)),
  }));
  await act(async () =>
    root.render(<FilterSelect entity="subject" label="Subject" value="0" onChange={() => {}} options={long} />),
  );
  await click(trigger("Subject"));
  expect(parseFloat(panel().style.maxHeight)).toBeLessThanOrEqual(Math.min(360, window.innerHeight * 0.6));
  expect(menu().contains(toggle())).toBe(false);
  expect(menu().querySelector('input[type="search"]')).toBeNull();
  expect(menu().querySelectorAll(".filter-group-heading")).toHaveLength(8);
  await key(menu(), "End");
  expect(menu().getAttribute("aria-activedescendant")).toBe(options()[79].id);
  expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  await key(menu(), "Escape");
  expect(panel()).toBeNull();
  expect(document.activeElement).toBe(trigger("Subject"));
});
