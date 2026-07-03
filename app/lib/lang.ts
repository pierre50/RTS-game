import { TRANSLATIONS } from './i18n/translations'

export const LANG_STORAGE_KEY = 'lang'
export const LANG_CHANGE_EVENT = 'doe:langchange'
export const SUPPORTED_LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const

type LangCode = (typeof SUPPORTED_LANGS)[number]['code']
type TranslationMap = Record<LangCode, Record<string, string>>
type TranslationVars = Record<string, string | number>

function normalizeLang(lang: string | null): LangCode {
  return SUPPORTED_LANGS.some(({ code }) => code === lang) ? (lang as LangCode) : 'fr'
}

let currentLang = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY))

export function t(key: string, vars?: TranslationVars): string {
  const translations = TRANSLATIONS as TranslationMap
  let str = translations[currentLang][key] ?? translations.en[key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v))
    })
  }
  return str
}

export function setLang(lang: string): void {
  currentLang = normalizeLang(lang)
  localStorage.setItem(LANG_STORAGE_KEY, currentLang)
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { lang: currentLang } }))
}

export function getLang(): LangCode {
  return currentLang
}
