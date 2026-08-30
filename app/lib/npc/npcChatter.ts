import { getLang } from '../lang'
import { pickRandomItem } from '../random'
import type { UnitEntity } from '../../types/entities'

// Flavor-only lines shown in the npc orders panel when the hero talks to one of their own
// units. Not part of TRANSLATIONS since these are lists to pick from, not a single string to
// look up.
const NPC_CHATTER_LINES: Record<string, string[]> = {
  fr: [
    "Tu crois que le chef a déjà mangé aujourd'hui ?",
    "J'ai encore rêvé de sangliers cette nuit.",
    "Il paraît que la pierre là-bas porte malheur.",
    "Franchement, cette hache a une drôle de tête.",
  ],
  en: [
    'Think the chief has eaten today?',
    'Had another dream about wild boars last night.',
    "They say that rock over there's bad luck.",
    'Honestly, that axe looks kind of weird.',
  ],
}

export function pickNpcChatterLine(): string {
  const lines = NPC_CHATTER_LINES[getLang()] ?? NPC_CHATTER_LINES.fr
  return pickRandomItem(lines)
}

type ForeignNpcMood = 'wary' | 'neutral' | 'friendly'

const FOREIGN_NPC_CHATTER_LINES: Record<string, Record<ForeignNpcMood, string[]>> = {
  fr: {
    wary: [
      'Gardez vos armes baissées, étranger.',
      'Notre village vous regarde.',
      "Un pas de travers, et les choses changeront vite.",
      "Si vous cherchez la paix, parlez d'abord au chef.",
    ],
    neutral: [
      'Nous ne cherchons pas les ennuis.',
      "Vous êtes loin de chez vous, étranger.",
      'Le chef écoute ceux qui respectent nos terres.',
      'Nos champs ont déjà vu assez de soldats.',
    ],
    friendly: [
      'Votre aide serait bien reçue ici.',
      'Le chef dit que vous n’êtes peut-être pas une menace.',
      'Nos portes restent ouvertes tant que la paix tient.',
      'Certains ici pensent que nous pourrions vous faire confiance.',
    ],
  },
  en: {
    wary: [
      'Keep your weapons lowered, stranger.',
      'Our village is watching you.',
      'One wrong step, and things will change quickly.',
      'If you seek peace, speak to the chief first.',
    ],
    neutral: [
      'We are not looking for trouble.',
      'You are far from home, stranger.',
      'The chief listens to those who respect our land.',
      'Our fields have seen enough soldiers already.',
    ],
    friendly: [
      'Your help would be welcome here.',
      'The chief says you may not be a threat.',
      'Our gates stay open while peace holds.',
      'Some here think we could trust you.',
    ],
  },
}

function getForeignNpcMood(unit?: UnitEntity | null): ForeignNpcMood {
  const factionId = unit?.owner?.factionId
  const relationState = factionId ? unit?.context?.getCampaignFactions?.()?.[factionId]?.relationState : null
  if (relationState === 'wary') return 'wary'
  if (relationState === 'friendly' || relationState === 'allied') return 'friendly'
  return 'neutral'
}

export function pickForeignNpcChatterLine(unit?: UnitEntity | null): string {
  const mood = getForeignNpcMood(unit)
  const linesByMood = FOREIGN_NPC_CHATTER_LINES[getLang()] ?? FOREIGN_NPC_CHATTER_LINES.fr
  return pickRandomItem(linesByMood[mood])
}

// Shown instead of NPC_CHATTER_LINES when the unit is actually commandable — a more deferential,
// in-character greeting addressed to the player, rather than idle chatter.
const NPC_GREETING_LINES: Record<string, string[]> = {
  fr: [
    'Que puis-je faire pour vous, {name} ?',
    'Vous avez besoin de moi, {name} ?',
    'Un ordre à me donner, {name} ?',
    'Que souhaitez-vous, {name} ?',
  ],
  en: [
    'What can I do for you, {name}?',
    'Need something, {name}?',
    'Awaiting your orders, {name}?',
    'What do you need, {name}?',
  ],
}

export function pickNpcGreetingLine(name: string): string {
  const lines = NPC_GREETING_LINES[getLang()] ?? NPC_GREETING_LINES.fr
  return pickRandomItem(lines).replace('{name}', name)
}

// Shown when the hero talks to one of their own sleeping units — a short in-character half-asleep
// mumble, addressed to the chief since this is a real (if groggy) wake-up, not just a peek.
const NPC_SLEEPING_CHATTER_LINES: Record<string, string[]> = {
  fr: [
    'Zzz... hein ? Quoi, chef ?',
    'Mmh... déjà, chef ?',
    'Zzz... encore cinq minutes, chef...',
    'Hmm... zzz... j’arrive, chef...',
    'Zzz... ah, c’est vous, chef.',
  ],
  en: [
    'Zzz... mm, what, chief?',
    'Mmh... already, chief?',
    'Zzz... five more minutes, chief...',
    'Hmm... zzz... coming, chief...',
    "Zzz... oh, it's you, chief.",
  ],
}

export function pickNpcSleepingChatterLine(): string {
  const lines = NPC_SLEEPING_CHATTER_LINES[getLang()] ?? NPC_SLEEPING_CHATTER_LINES.fr
  return pickRandomItem(lines)
}

// Shown for a foreign/neutral sleeper — not the hero's chief, so they stay asleep: plain
// in-character sleep-talk, not addressed to the hero at all.
const FOREIGN_NPC_SLEEPING_CHATTER_LINES: Record<string, string[]> = {
  fr: [
    'Zzz... zzz...',
    'Mmh... des moutons...',
    'Zzz... pas maintenant...',
    '...zzz... du pain...',
    'Mmh... zzz zzz...',
  ],
  en: [
    'Zzz... zzz...',
    'Mmh... sheep...',
    'Zzz... not now...',
    '...zzz... bread...',
    'Mmh... zzz zzz...',
  ],
}

export function pickForeignNpcSleepingChatterLine(): string {
  const lines = FOREIGN_NPC_SLEEPING_CHATTER_LINES[getLang()] ?? FOREIGN_NPC_SLEEPING_CHATTER_LINES.fr
  return pickRandomItem(lines)
}
