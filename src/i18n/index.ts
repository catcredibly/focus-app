import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import ja from "./ja";
import type { Locale } from "../settings";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
    "zh-TW": { translation: zhTW },
    ja: { translation: ja },
  },
  lng: "en",
  fallbackLng: "en",
  // Translation keys are complete UI phrases, including punctuation such as colons.
  nsSeparator: false,
  keySeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const localeCode = (language = i18n.resolvedLanguage): Locale =>
  (["zh-CN", "zh-TW", "ja"].includes(language ?? "") ? language : "en") as Locale;

export default i18n;
