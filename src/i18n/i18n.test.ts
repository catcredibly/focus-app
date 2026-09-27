import { describe, expect, it } from "vitest";
import en from "./en";
import ja from "./ja";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";

describe("translation resources", () => {
  it("preserves Unicode translations without replacement characters", () => {
    for (const locale of [en, zhCN, zhTW, ja]) {
      for (const [key, value] of Object.entries(locale)) expect(value, key).not.toMatch(/\?\?|\uFFFD/);
    }
  });
  it("keeps every locale aligned with the canonical English key set", () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(zhCN).sort()).toEqual(keys);
    expect(Object.keys(zhTW).sort()).toEqual(keys);
    expect(Object.keys(ja).sort()).toEqual(keys);
  });

  it("keeps interpolation placeholders aligned", () => {
    const placeholders = (value: string) => [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)].map((match) => match[1]).sort();
    for (const locale of [zhCN, zhTW, ja]) {
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(placeholders(locale[key]), key).toEqual(placeholders(en[key]));
      }
    }
  });

  it("does not silently inherit ordinary English UI copy", () => {
    const allowed = new Set(["English", "Shihen", "OK", "{{subject}} - {{duration}}"]);
    for (const locale of [zhCN, zhTW, ja]) {
      const untranslated = (Object.keys(en) as Array<keyof typeof en>).filter(
        (key) => locale[key] === en[key] && !allowed.has(en[key]),
      );
      expect(untranslated).toEqual([]);
    }
  });

  it("does not translate user-created names", () => {
    const subject = "数学 / Mathematics 101";
    expect(subject).toBe("数学 / Mathematics 101");
  });
});
