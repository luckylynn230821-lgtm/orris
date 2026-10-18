import { createInstance, type i18n as I18n } from "i18next";
import { createContext, useContext, useMemo, useState } from "react";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { catalogs, type MessageKey } from "./translate";
import { phrase } from "./phrases";
import { htmlLang, writeLocaleCookie, type Locale } from "./locales";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
});

function makeI18n(locale: Locale): I18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: "en",
    resources: {
      en: { translation: catalogs.en },
      zh: { translation: catalogs.zh },
      "zh-Hant": { translation: catalogs["zh-Hant"] },
      ja: { translation: catalogs.ja },
      ko: { translation: catalogs.ko },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

export function I18nProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const [i18n] = useState(() => makeI18n(initial));
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        writeLocaleCookie(next);
        document.documentElement.lang = htmlLang(next);
        void i18n.changeLanguage(next);
        setLocaleState(next);
      },
    }),
    [i18n, locale],
  );
  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}

export function useT() {
  const { t } = useTranslation();
  const { locale, setLocale } = useContext(LocaleContext);
  return {
    locale,
    setLocale,
    t: (key: MessageKey, vars?: Record<string, string | number>) => String(t(key, vars)),
    tx: (key: string, vars?: Record<string, string | number>) => String(t(key, vars)),
    copy: (text: string) => phrase(locale, text),
  };
}
