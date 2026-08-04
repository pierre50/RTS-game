import { getLang } from './lang'
import { pickRandomItem } from './random'

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
