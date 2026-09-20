import type { VillagerAutonomyJob } from '../../types/entities'

export type NpcAudience = 'ownChief' | 'ownPeer' | 'foreignChief' | 'visitor'
export type NpcRoutinePhase = 'morning' | 'evening' | 'work' | 'idle'
type Lines = [string, ...string[]]
type ForeignAudience = Extract<NpcAudience, 'foreignChief' | 'visitor'>
type RelationVariants = 'wary' | 'friendly'
type RoutineLines = {
  foreignRest: Record<RelationVariants, Record<'morning' | 'evening', Record<ForeignAudience, Lines>>>
  foreignChiefGreeting: Record<RelationVariants, Record<ForeignAudience, Lines>>
  rest: Record<'morning' | 'evening', Record<NpcAudience, Lines>>
  jobs: Record<VillagerAutonomyJob, Lines>
  chief: Record<NpcRoutinePhase, Lines>
  chiefGreeting: Record<NpcAudience, Lines>
  foreignWork: Record<'wary' | 'neutral' | 'friendly', Record<'foreignChief' | 'visitor', Lines>>
}

// {address} only addresses the speaker's own chief; foreign leaders receive a separate greeting.
export const NPC_ROUTINE_LINES: Record<'fr' | 'en', RoutineLines> = {
  fr: {
    foreignRest: {
      wary: {
        morning: {
          foreignChief: [
            'Le village se réveille. Votre titre ne vous autorise pas à troubler notre repos.',
            'Votre visite est bien matinale, chef. Gardez vos distances pendant que nous nous réveillons.',
          ],
          visitor: [
            'Nous venons de nous lever. Ne profitez pas du calme pour fouiner.',
            'Je me repose avant le travail. Passez votre chemin si vous cherchez des ennuis.',
          ],
        },
        evening: {
          foreignChief: [
            'Notre journée est finie. Respectez notre repos, même si vous êtes chef.',
            'Votre visite ne doit pas troubler la soirée des nôtres. Nous restons sur nos gardes.',
          ],
          visitor: [
            'Je prends mon repos, mais je vous garde à l’œil.',
            'Les outils sont rangés. Ce n’est pas une raison pour approcher de nos réserves.',
          ],
        },
      },
      friendly: {
        morning: {
          foreignChief: [
            'Bonjour, chef. Votre visite nous fait plaisir. Nous prenons encore un peu de repos avant le travail.',
            'Un chef ami de si bon matin ! Profitez avec nous du calme avant la journée.',
          ],
          visitor: [
            'Bonjour ! Venez profiter du calme du matin avec nous avant le travail.',
            'C’est agréable de vous voir au réveil. J’ai encore un peu de temps pour parler.',
          ],
        },
        evening: {
          foreignChief: [
            'Votre visite est la bienvenue, chef. La journée est finie, profitez de la soirée avec nous.',
            'Un chef ami peut bien partager notre repos. Le travail attendra demain.',
          ],
          visitor: [
            'La journée est finie. Restez donc bavarder un peu pendant mon repos.',
            'Vous tombez bien ! Je me repose avant la nuit et votre compagnie me fait plaisir.',
          ],
        },
      },
    },
    foreignChiefGreeting: {
      wary: {
        foreignChief: [
          'Vous dirigez votre peuple, pas le mien. Dites clairement ce qui vous amène.',
          'Entre chefs, la franchise s’impose. Je reste prudent sur vos intentions.',
        ],
        visitor: [
          'Ma confiance se mérite. Respectez les miens tant que vous êtes ici.',
          'Je vous écoute, mais mes gens garderont un œil sur vous.',
        ],
      },
      friendly: {
        foreignChief: [
          'Bienvenue, chef. Il est bon de parler avec un ami de notre peuple.',
          'Nos peuples s’entendent bien. Parlons entre chefs de ce que nous pouvons faire ensemble.',
        ],
        visitor: [
          'Votre présence est la bienvenue parmi les miens. Prenons le temps de parler.',
          'Vous avez des amis dans ce village. Je suis heureux de vous recevoir.',
        ],
      },
    },
    rest: {
      morning: {
        ownChief: [
          'Je me réveille doucement, chef. Je prendrai bientôt mes outils.',
          'Je prends un moment avant de commencer la journée, chef.',
        ],
        ownPeer: [
          'Je profite du calme du matin avant de reprendre le travail.',
          'Je finis de me réveiller. La journée commencera bien assez tôt.',
        ],
        foreignChief: [
          'Vous venez tôt pour un chef. Ici, nous prenons encore un peu de repos.',
          'Notre village se réveille à peine. Votre visite peut bien attendre un instant.',
        ],
        visitor: [
          'Bonjour. Nous profitons encore du calme avant le travail.',
          'Vous êtes matinal. Je prends un moment avant de commencer ma journée.',
        ],
      },
      evening: {
        ownChief: [
          'Je range mes outils pour ce soir, chef. Je souffle un peu avant de dormir.',
          'La journée est finie pour moi, chef. Je garde mes forces pour demain.',
        ],
        ownPeer: [
          'Je me repose un peu avant de dormir. Le travail attendra demain.',
          'Les outils sont rangés. Je profite de la soirée près des miens.',
        ],
        foreignChief: [
          'Même les visites des chefs arrivent à la fin de la journée. Nous nous reposons.',
          'Nos outils sont rangés pour ce soir. Vous trouverez notre village plus actif demain.',
        ],
        visitor: [
          'La journée est terminée. Je prends un peu de repos avant la nuit.',
          'Vous arrivez à l’heure du repos. Les outils attendront demain.',
        ],
      },
    },
    jobs: {
      food: [
        'Je m’occupe des provisions{address}. Il faut nourrir tout le monde.',
        'Je veille à ce que nos réserves de nourriture tiennent{address}.',
      ],
      wood: [
        'Je m’occupe du bois{address}. Il en faut pour les feux et les constructions.',
        'Les réserves de bois ne se remplissent pas toutes seules{address}.',
      ],
      stone: [
        'Je travaille à nos réserves de pierre{address}. Les bâtisseurs en auront besoin.',
        'Il faut de la bonne pierre pour des murs solides{address}.',
      ],
      gold: [
        'Je cherche de l’or pour nos réserves{address}. Chaque pépite compte.',
        'L’or demande de la patience{address}. Je garde l’œil ouvert.',
      ],
      copper: [
        'Je m’occupe du cuivre{address}. Les artisans attendent leur minerai.',
        'Le cuivre se mérite{address}. Je veille à en rapporter au village.',
      ],
      iron: [
        'Je m’occupe du fer{address}. Les outils et les armes en demandent toujours.',
        'Il nous faut du minerai de fer{address}. Les forges en auront besoin.',
      ],
      construction: [
        'Je m’occupe des constructions{address}. Il reste de quoi faire.',
        'Un bâtiment solide commence par du travail soigné{address}.',
      ],
      horseCapture: [
        'Je m’occupe de trouver des chevaux{address}. Il faut les approcher sans les effrayer.',
        'Avec les chevaux, la patience vaut mieux que la force{address}.',
      ],
    },
    chief: {
      morning: [
        'Je prends un moment avant de m’occuper du village.',
        'Le village se réveille. Les affaires attendront encore un peu.',
      ],
      evening: [
        'Je profite du calme de la soirée. Les affaires ordinaires attendront demain.',
        'Les miens se reposent. Je prends aussi un peu de repos avant la nuit.',
      ],
      work: [
        'Je veille aux besoins du village. Que souhaitez-vous me dire ?',
        'Il faut organiser les travaux et les réserves. Je vous écoute.',
      ],
      idle: ['Je veille sur les miens. Que vous amène-t-il ?', 'Parlez, je vous écoute.'],
    },
    chiefGreeting: {
      ownChief: ['Nous avons tous deux des responsabilités envers les nôtres.'],
      ownPeer: ['Vous pouvez me parler des besoins des nôtres.'],
      foreignChief: ['Parlons entre chefs, dans le respect de nos peuples.'],
      visitor: ['Vous êtes ici sur les terres de mon village.'],
    },
    foreignWork: {
      wary: {
        foreignChief: ['Votre titre ne vous donne pas autorité sur notre travail.'],
        visitor: ['Gardez vos distances avec nos réserves.'],
      },
      neutral: {
        foreignChief: ['Pour les affaires entre villages, adressez-vous à notre chef.'],
        visitor: ['Je peux vous parler un instant, mais ma tâche m’attend.'],
      },
      friendly: {
        foreignChief: ['Votre visite sera bien accueillie par notre chef.'],
        visitor: ['C’est agréable d’avoir un peu de compagnie pendant le travail.'],
      },
    },
  },
  en: {
    foreignRest: {
      wary: {
        morning: {
          foreignChief: [
            'The village is waking up. Your title does not give you leave to disturb our rest.',
            'Your visit is rather early, chief. Keep your distance while we wake up.',
          ],
          visitor: [
            'We have just got up. Do not use the quiet to snoop around.',
            'I am resting before work. Move along if you are looking for trouble.',
          ],
        },
        evening: {
          foreignChief: [
            'Our working day is over. Respect our rest, even if you are a chief.',
            'Your visit must not disturb our evening. We are keeping our guard up.',
          ],
          visitor: [
            'I am taking my rest, but I am keeping an eye on you.',
            'The tools are put away. That is no invitation to approach our supplies.',
          ],
        },
      },
      friendly: {
        morning: {
          foreignChief: [
            'Good morning, chief. It is good to see you. We are still resting before work.',
            'A friendly chief visiting so early! Enjoy the quiet with us before the day begins.',
          ],
          visitor: [
            'Good morning! Come enjoy the quiet with us before work.',
            'It is good to see you as the village wakes up. I still have a little time to talk.',
          ],
        },
        evening: {
          foreignChief: [
            'You are welcome here, chief. The day is over, so enjoy the evening with us.',
            'A friendly chief is welcome to share our rest. Work can wait until tomorrow.',
          ],
          visitor: [
            'The working day is over. Stay and chat while I rest.',
            'Good timing! I am resting before nightfall, and your company is welcome.',
          ],
        },
      },
    },
    foreignChiefGreeting: {
      wary: {
        foreignChief: [
          'You lead your people, not mine. Tell me plainly what brings you here.',
          'Chiefs should speak frankly. I remain cautious about your intentions.',
        ],
        visitor: [
          'My trust must be earned. Respect my people while you are here.',
          'I am listening, but my people will keep an eye on you.',
        ],
      },
      friendly: {
        foreignChief: [
          'Welcome, chief. It is good to speak with a friend of our people.',
          'Our peoples are on good terms. Let us discuss what we can do together as chiefs.',
        ],
        visitor: [
          'You are welcome among my people. Let us take the time to talk.',
          'You have friends in this village. I am glad to welcome you.',
        ],
      },
    },
    rest: {
      morning: {
        ownChief: [
          'I am waking up slowly, chief. I will pick up my tools soon.',
          'I am taking a moment before starting the day, chief.',
        ],
        ownPeer: [
          'I am enjoying the quiet morning before getting back to work.',
          'Let me wake up properly. The day will start soon enough.',
        ],
        foreignChief: [
          'An early visit for a chief. We are still taking a little rest here.',
          'Our village is barely awake. Your visit can wait a moment.',
        ],
        visitor: [
          'Good morning. We are enjoying the quiet before work.',
          'You are up early. I am taking a moment before starting my day.',
        ],
      },
      evening: {
        ownChief: [
          'I am putting my tools away for tonight, chief. A little rest before bed.',
          'My work is done for today, chief. I am saving my strength for tomorrow.',
        ],
        ownPeer: [
          'I am resting a little before bed. Work can wait until tomorrow.',
          'The tools are put away. I am spending the evening near my people.',
        ],
        foreignChief: [
          'Even chiefs visit at the end of the day. We are taking our rest.',
          'Our tools are put away for tonight. The village will be busier tomorrow.',
        ],
        visitor: [
          'The working day is over. I am resting before nightfall.',
          'You have arrived at resting time. The tools can wait until tomorrow.',
        ],
      },
    },
    jobs: {
      food: [
        'I am taking care of the provisions{address}. Everyone needs to eat.',
        'I am making sure our food reserves last{address}.',
      ],
      wood: [
        'I am gathering wood{address}. We need it for fires and building.',
        'The wood reserves will not fill themselves{address}.',
      ],
      stone: [
        'I am working on our stone reserves{address}. The builders will need them.',
        'Strong walls need good stone{address}.',
      ],
      gold: [
        'I am looking for gold for our reserves{address}. Every nugget counts.',
        'Gold takes patience{address}. I am keeping my eyes open.',
      ],
      copper: [
        'I am taking care of the copper{address}. The craftspeople need their ore.',
        'Copper takes effort{address}. I am making sure some reaches the village.',
      ],
      iron: [
        'I am taking care of the iron{address}. Tools and weapons always need more.',
        'We need iron ore{address}. The forges will need it.',
      ],
      construction: [
        'I am taking care of the building work{address}. There is plenty left to do.',
        'A sturdy building starts with careful work{address}.',
      ],
      horseCapture: [
        'I am looking for horses{address}. They need a gentle approach.',
        'With horses, patience works better than force{address}.',
      ],
    },
    chief: {
      morning: [
        'I am taking a moment before tending to the village.',
        'The village is waking up. Business can wait a little longer.',
      ],
      evening: [
        'I am enjoying the quiet evening. Ordinary business can wait until tomorrow.',
        'My people are resting. I am taking a little rest before nightfall too.',
      ],
      work: [
        'I am tending to the needs of the village. What would you like to tell me?',
        'Work and supplies need organizing. I am listening.',
      ],
      idle: ['I watch over my people. What brings you here?', 'Speak, I am listening.'],
    },
    chiefGreeting: {
      ownChief: ['We both have responsibilities towards our people.'],
      ownPeer: ['You may speak to me about the needs of our people.'],
      foreignChief: ['Let us speak as chiefs, with respect for our peoples.'],
      visitor: ['You are on the lands of my village.'],
    },
    foreignWork: {
      wary: {
        foreignChief: ['Your title gives you no authority over our work.'],
        visitor: ['Keep your distance from our supplies.'],
      },
      neutral: {
        foreignChief: ['For business between villages, speak to our chief.'],
        visitor: ['I can talk for a moment, but my task is waiting.'],
      },
      friendly: {
        foreignChief: ['Our chief will welcome your visit.'],
        visitor: ['It is good to have a little company while working.'],
      },
    },
  },
}
