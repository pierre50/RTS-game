import { TRANSLATIONS } from './i18n/translations'

export const LANG_STORAGE_KEY = 'lang'
export const LANG_CHANGE_EVENT = 'doe:langchange'
export const SUPPORTED_LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

function normalizeLang(lang) {
  return SUPPORTED_LANGS.some(({ code }) => code === lang) ? lang : 'fr'
}

let currentLang = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY))

export function t(key, vars) {
  let str = TRANSLATIONS[currentLang][key] ?? TRANSLATIONS.en[key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
  }
  return str
}

export function setLang(lang) {
  currentLang = normalizeLang(lang)
  localStorage.setItem(LANG_STORAGE_KEY, currentLang)
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { lang: currentLang } }))
}

export function getLang() {
  return currentLang
}
