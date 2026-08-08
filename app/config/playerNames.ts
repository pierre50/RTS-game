export type PlayerNameGender = 'male' | 'female'

const CIVILIZATION_PLAYER_NAMES: Record<string, Record<PlayerNameGender, string[]>> = {
  Greek: {
    male: ['Alexios', 'Damon', 'Leonidas', 'Nikandros', 'Theron', 'Xenon'],
    female: ['Ariadne', 'Callista', 'Daphne', 'Helena', 'Lysandra', 'Thalia'],
  },
  Roman: {
    male: ['Cassius', 'Decimus', 'Gaius', 'Lucius', 'Marcus', 'Titus'],
    female: ['Aelia', 'Claudia', 'Cornelia', 'Flavia', 'Julia', 'Livia'],
  },
  Egyptian: {
    male: ['Ahmose', 'Hori', 'Khaemwaset', 'Menes', 'Nakht', 'Ramose'],
    female: ['Ahhotep', 'Henut', 'Iset', 'Merit', 'Nefret', 'Tia'],
  },
  Babylonian: {
    male: ['Amel-Marduk', 'Belshunu', 'Iddin', 'Nabu-zer', 'Nergal', 'Sin-iddin'],
    female: ['Amat-Nabu', 'Beltani', 'Damqatum', 'Lamassi', 'Ninaya', 'Tabni'],
  },
  Asian: {
    male: ['Akira', 'Jian', 'Kenji', 'Min-jun', 'Takumi', 'Wei'],
    female: ['Aiko', 'Hana', 'Mei', 'Sora', 'Yuna', 'Zhen'],
  },
  Celtic: {
    male: ['Aedan', 'Brennus', 'Caradoc', 'Cian', 'Lugus', 'Taran'],
    female: ['Aife', 'Brigid', 'Cartimandua', 'Epona', 'Maeve', 'Nessa'],
  },
  Nubian: {
    male: ['Akinidad', 'Amankhar', 'Arakamani', 'Harsiotef', 'Nastasen', 'Teriteqas'],
    female: ['Amanitore', 'Amanishakheto', 'Bartare', 'Kandake', 'Maletasen', 'Shanakdakhete'],
  },
}

const ALL_PLAYER_NAMES = new Set(
  Object.values(CIVILIZATION_PLAYER_NAMES).flatMap(namesByGender => [...namesByGender.male, ...namesByGender.female])
)

function normalizeGender(gender: string | null | undefined): PlayerNameGender {
  return gender === 'female' ? 'female' : 'male'
}

export function randomPlayerNameForCivilization(
  civilization: string | null | undefined,
  gender?: string | null
): string {
  const namesByGender = CIVILIZATION_PLAYER_NAMES[civilization || ''] ?? CIVILIZATION_PLAYER_NAMES.Greek
  const names = namesByGender[normalizeGender(gender)]
  return names[Math.floor(Math.random() * names.length)] || 'Alexios'
}

export function isGeneratedPlayerName(name: string | null | undefined): boolean {
  return ALL_PLAYER_NAMES.has(name || '')
}
