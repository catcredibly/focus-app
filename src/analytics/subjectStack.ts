/** Display-only ordering; input rows and stored colors are never changed. */
export function orderSubjectsForStack<T extends { color: string }>(rows: readonly T[]): T[] {
  const groups = new Map<string, { items: { row: T; index: number }[]; next: number }>();
  rows.forEach((row, index) => {
    const color = row.color.toLowerCase();
    const group = groups.get(color) ?? { items: [], next: 0 };
    group.items.push({ row, index });
    groups.set(color, group);
  });
  const ordered: T[] = [];
  let previous: string | undefined;
  while (ordered.length < rows.length) {
    const remaining = [...groups.entries()].filter(([, group]) => group.next < group.items.length);
    const different = remaining.filter(([color]) => color !== previous);
    const eligible = different.length ? different : remaining;
    // Explicit source indices break every count tie, independent of Map order.
    eligible.sort(
      ([, a], [, b]) =>
        b.items.length - b.next - (a.items.length - a.next) || a.items[a.next].index - b.items[b.next].index,
    );
    const [color, group] = eligible[0];
    ordered.push(group.items[group.next++].row);
    previous = color;
  }
  return ordered;
}
