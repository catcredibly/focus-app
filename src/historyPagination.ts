export function historyPagination(total: number, size: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(0, Math.min(pages - 1, Math.trunc(requested) || 0));
  return { page, pages, start: total ? page * size + 1 : 0, end: Math.min(total, (page + 1) * size) };
}
export function enteredHistoryPage(draft: string, current: number, pages: number) {
  if (!/^[+-]?\d+$/.test(draft.trim())) return current;
  return Math.max(0, Math.min(pages - 1, Number(draft) - 1));
}
