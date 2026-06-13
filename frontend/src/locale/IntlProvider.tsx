import { createIntl, createIntlCache } from "react-intl";
import langBg from "./src/bg.json";
import langDe from "./src/de.json";
import langPt from "./src/pt.json";
import langEn from "./src/en.json";
import langEs from "./src/es.json";
import langEt from "./src/et.json";
import langFr from "./src/fr.json";
import langGa from "./src/ga.json";
import langId from "./src/id.json";
import langIt from "./src/it.json";
import langJa from "./src/ja.json";
import langKo from "./src/ko.json";
import langNl from "./src/nl.json";
import langPl from "./src/pl.json";
import langRu from "./src/ru.json";
import langSk from "./src/sk.json";
import langCs from "./src/cs.json";
import langVi from "./src/vi.json";
import langZh from "./src/zh.json";
import langTr from "./src/tr.json";
import langHu from "./src/hu.json";
import langNo from "./src/no.json";
import langList from "./src/lang-list.json";

// first item of each array should be the language code,
// not the country code
// Remember when adding to this list, also update check-locales.js script
const localeOptions = [
  ["en", "en-US", langEn],
  ["de", "de-DE", langDe],
  ["es", "es-ES", langEs],
  ["et", "et-EE", langEt],
  ["pt", "pt-PT", langPt],
  ["fr", "fr-FR", langFr],
  ["ga", "ga-IE", langGa],
  ["ja", "ja-JP", langJa],
  ["it", "it-IT", langIt],
  ["nl", "nl-NL", langNl],
  ["pl", "pl-PL", langPl],
  ["ru", "ru-RU", langRu],
  ["sk", "sk-SK", langSk],
  ["cs", "cs-CZ", langCs],
  ["vi", "vi-VN", langVi],
  ["zh", "zh-CN", langZh],
  ["ko", "ko-KR", langKo],
  ["bg", "bg-BG", langBg],
  ["id", "id-ID", langId],
  ["tr", "tr-TR", langTr],
  ["hu", "hu-HU", langHu],
  ["no", "no-NO", langNo],
];

const loadMessages = (locale?: string): typeof langList & typeof langEn => {
  const thisLocale = (locale || "en").slice(0, 2);

  // ensure this lang exists in localeOptions above, otherwise fallback to en
  if (thisLocale === "en" || !localeOptions.some(([code]) => code === thisLocale)) {
    return Object.assign({}, langList, langEn);
  }

  return Object.assign({}, langList, langEn, localeOptions.find(([code]) => code === thisLocale)?.[2]);
};

const getFlagCodeForLocale = (locale?: string) => {
  const thisLocale = (locale || "en").slice(0, 2);

  // only add to this if your flag is different from the locale code
  const specialCases: Record<string, string> = {
    ja: "jp", // Japan
    zh: "cn", // China
    vi: "vn", // Vietnam
    ko: "kr", // Korea
    cs: "cz", // Czechia
    ga: "ie", // Ireland (Irish)
  };

  if (specialCases[thisLocale]) {
    return specialCases[thisLocale].toUpperCase();
  }
  return thisLocale.toUpperCase();
};

const getLocale = (short = false) => {
  let loc = window.localStorage.getItem("locale");
  if (!loc) {
    loc = document.documentElement.lang;
  }
  if (short) {
    return loc.slice(0, 2);
  }
  // finally, fallback
  if (!loc) {
    loc = "en";
  }
  return loc;
};

const cache = createIntlCache();

const initialMessages = loadMessages(getLocale()) as Record<string, string>;
let intl = createIntl({ locale: getLocale(), messages: initialMessages }, cache);

const changeLocale = (locale: string): void => {
  const messages = loadMessages(locale) as Record<string, string>;
  intl = createIntl({ locale, messages }, cache);
  window.localStorage.setItem("locale", locale);
  document.documentElement.lang = locale;
};

// This is a translation component that wraps the translation in a span with a data
// attribute so devs can inspect the element to see the translation ID
const T = ({
  id,
  data,
  tData,
}: {
  id: string;
  data?: Record<string, string | number | undefined>;
  tData?: Record<string, string>;
}) => {
  const translatedData: Record<string, string> = {};
  if (tData) {
    // iterate over tData and translate each value
    Object.entries(tData).forEach(([key, value]) => {
      translatedData[key] = intl.formatMessage({ id: value });
    });
  }
  return (
    <span data-translation-id={id}>
      {intl.formatMessage(
        { id },
        {
          ...data,
          ...translatedData,
        },
      )}
    </span>
  );
};

//console.log("L:", localeOptions);

export { localeOptions, getFlagCodeForLocale, getLocale, createIntl, changeLocale, intl, T };
