from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_ROOT.parents[1]
DEFAULT_SOURCE_ROOT = SCRIPT_ROOT / "spritesheets"
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "public/assets/graphics/lpc-baked"

FRAME_SIZE = 64
OUTPUT_SCALE = 1.0
LPC_ANIMATION_SPEED = 0.20
ANCHOR = {"x": 0.5, "y": 0.86}
ANCHORS_BY_OUTPUT_SIZE = {
    32: {"x": 0.5, "y": 0.86},
    64: {"x": 0.5, "y": 0.86},
    96: {"x": 0.5, "y": 0.74},
    128: {"x": 0.5, "y": 0.68},
    192: {"x": 0.5, "y": 0.62},
}

PALETTES: dict[str, list[str]] = {
    "fair": ["#2A1817", "#4A2C26", "#765044", "#A87962", "#D2A081", "#EDC0A0"],
    "olive": ["#271920", "#442725", "#7F4C31", "#AE6B3F", "#D38B59", "#E4A47C"],
    "brown": ["#23110E", "#432015", "#6F3A22", "#98562F", "#BC7543", "#D99559"],
    "deep_brown": ["#060608", "#141013", "#221C1A", "#322B28", "#423934", "#5A4E44"],
    "golden": ["#3B1725", "#71413B", "#BB7547", "#DBA463", "#F4D29C", "#FEF3C0"],
    "black": ["#020202", "#050505", "#0A0A0A", "#121212", "#1B1B1B", "#242424"],
    "dark_brown": ["#060403", "#19110B", "#2E2014", "#46301C", "#624326", "#7D5732"],
    "brown_hair": ["#080302", "#1B0B04", "#36190A", "#5A2D13", "#7C431F", "#A45D2E"],
    "navy": ["#180716", "#20102B", "#281E41", "#322D6A", "#3C49AD", "#466AC9"],
    "player_blue": ["#180716", "#281E41", "#322D6A", "#3C49AD", "#466AC9", "#61A0EF"],
    "player_red": ["#530B00", "#6F0B07", "#8F1F00", "#C71700", "#E30B00", "#FF2F2F"],
    "player_yellow": ["#4F3723", "#6B4B27", "#876727", "#A37317", "#C3A31B", "#DFCF0F"],
    "player_green": ["#0B1B0B", "#133313", "#1B431B", "#375F27", "#4B6B2B", "#637B2F"],
    "player_orange": ["#6F2300", "#872B00", "#9F3300", "#CF4300", "#F3770F", "#F78B17"],
    "player_grey": ["#232323", "#373737", "#474747", "#6B6B6B", "#8F8F8F", "#B3B3B3"],
    "player_cyan": ["#002327", "#003F43", "#004F4F", "#006F6B", "#00837B", "#00AB93"],
    "player_brown": ["#23231F", "#3F3723", "#5F331B", "#734727", "#8B5B37", "#A3734F"],
    # Metal tones for hats/armour pieces (helmets, bracers, ...) that ship as a single
    # undyed texture rather than pre-made color variants.
    "brass": ["#1B1313", "#3F371E", "#60492C", "#B08A36", "#FCD081", "#FCF6CB"],
    "copper": ["#1B1313", "#462825", "#603429", "#794118", "#A26118", "#E19D4D"],
    "bronze": ["#1B1313", "#6B1D16", "#94381D", "#B54936", "#EB7129", "#FFB187"],
    "iron": ["#000000", "#252025", "#392B34", "#52414A", "#6F6563", "#948081"],
    "steel": ["#1B192B", "#484152", "#726B7E", "#867E7F", "#A8B3B8", "#E3E7D3"],
    "silver": ["#182039", "#4A4C60", "#6B7588", "#A8B3B8", "#EBEDEB", "#E1F3F4"],
    "gold": ["#291821", "#794118", "#A26118", "#D19529", "#EFCD8C", "#FCF6CB"],
    # Undyed linen/cloth tone, sampled from the hand-colored "white" sash variant, for
    # cloth pieces (like cuffs) that only ship as a single undyed texture.
    "white": ["#281820", "#4D4A5D", "#958080", "#C4B59F", "#E5E6C7", "#FFFFFF"],
}

SKIN_TONES = {
    "fair": "Light skin used by Babylonian variants.",
    "olive": "Mediterranean olive skin used by Greek variants.",
    "brown": "Brown skin used by Egyptian variants.",
    "deep_brown": "Deep brown skin used by Nubian variants.",
    "golden": "Warm tan skin used by Asian variants.",
}

CIVS = {
    "greek": {"skin": "olive", "hair": "dark_brown"},
    "roman": {"skin": "olive", "hair": "dark_brown"},
    "egyptian": {"skin": "brown", "hair": "black"},
    "babylonian": {"skin": "fair", "hair": "black"},
    "asian": {"skin": "golden", "hair": "black"},
    "celtic": {"skin": "fair", "hair": "brown_hair"},
    "nubian": {"skin": "deep_brown", "hair": "black"},
}

PLAYER_SHORTS = {
    "blue": "blue",
    "red": "red",
    "yellow": "yellow",
    "green": "forest",
    "orange": "orange",
    "grey": "gray",
    "cyan": "teal",
    "brown": "walnut",
}


# Layer templates for dress/hat/hair-extension items, resolved per-frame with
# `{animation}` (walk/slash/shoot/hurt/...) and, for filename-colored items,
# `{color}` (this unit's player-color LPC name). `dress` order is z-order: later
# entries draw on top.
@dataclass(frozen=True)
class DressItem:
    path: str
    # Pixel-recolor to the unit's player-color palette at bake time. Use this for
    # assets that don't ship pre-made color variants (unlike shorts/tabard, which use
    # `{color}` in `path` to pick an already hand-colored file).
    team_colored: bool = False
    # Or pixel-recolor to a fixed named palette (e.g. "bronze", "steel", see the metal
    # tones in PALETTES above) — for hat/armour pieces where the team color doesn't
    # apply but the source art is still a single undyed texture.
    palette: str | None = None


SHORTS = DressItem("legs/shorts/shorts/male/{animation}/{color}.png")
SANDALS = DressItem("feet/sandals/male/{animation}.png")
BELT = DressItem("torso/waist/belt_leather/male/{animation}/brown.png")
BRACERS_PATH = "arms/bracers/male/{animation}.png"
BRACERS_BRASS = DressItem(BRACERS_PATH, palette="brass")
BRACERS_SILVER = DressItem(BRACERS_PATH, palette="silver")
HEADBAND = DressItem("hat/headband/tied", team_colored=True)
APRON_BROWN = DressItem("torso/aprons/suspenders/male/{animation}/brown.png")
CUFFS_WHITE = DressItem("arms/wrists/cuffs/male/{animation}.png", palette="white")
SASH_WHITE = DressItem("torso/waist/sash_narrow/male/{animation}/white.png")
# plain/legion skirts have no pre-made color variants, so they're pixel-recolored to
# the player palette instead of picking a hand-colored file.
SKIRT_PLAIN = DressItem("legs/skirts/plain/male/{animation}.png", team_colored=True)
SKIRT_LEGION_TEAM = DressItem("legs/skirts/legion/male/{animation}.png", team_colored=True)

# Baked output/asset variant key. Every unit ships one deterministic look per
# civilization, so this is a fixed constant rather than per-unit data.
VARIANT_KEY = "01"


@dataclass(frozen=True)
class UnitLook:
    """The single source of truth for one unit type's appearance: body/face shape
    are the only things shared across units by default; hair, beard, hat and dress
    are what actually distinguish a villager from a clubman from an axeman, etc."""

    hair: str | None = None
    # Some hairstyles (e.g. ponytails) ship as separate bg/fg halves: bg tucks behind
    # the body/shoulders, fg sits at the normal in-front hair position.
    hair_split: bool = False
    # Overrides the civilization's hair color (e.g. "white" for a gray-haired elder).
    hair_palette: str | None = None
    beard: str | None = None
    beard_palette: str | None = None
    head: str = "human/male_custom"
    eyebrows: bool = True
    # Defaults to the civilization's hair color if neither team_colored nor palette is set.
    hair_extension: DressItem | None = None
    hat: DressItem | None = None
    # Drawn after hat (e.g. a plume attached to a helmet).
    hat_accessory: DressItem | None = None
    # Ships as separate bg/fg halves, like a split hairstyle: bg drapes behind the
    # body/shoulders, fg drapes over the front, above the dress items.
    cape: DressItem | None = None
    dress: tuple[DressItem, ...] = ()


UNIT_LOOKS: dict[str, UnitLook] = {
    "villager": UnitLook(hair="plain", dress=(SHORTS, SANDALS)),
    "clubman": UnitLook(hair="long", hat=HEADBAND, dress=(SHORTS, SANDALS)),
    "axeman": UnitLook(
        hair="long",
        hat=HEADBAND,
        dress=(
            SHORTS,
            SANDALS,
            DressItem("torso/jacket/tabard/male/{animation}/{color}.png"),
            BELT,
            DressItem(BRACERS_PATH, palette="copper"),
        ),
    ),
    "bowman": UnitLook(
        hair="high_ponytail",
        hair_split=True,
        dress=(SHORTS, SANDALS),
    ),
    "shortswordman": UnitLook(
        hat=DressItem("hat/helmet/pointed", palette="brass"),
        dress=(
            SKIRT_LEGION_TEAM,
            SANDALS,
            APRON_BROWN,
            BELT,
            BRACERS_BRASS,
        ),
    ),
    "improvedbowman": UnitLook(
        hair="high_ponytail",
        hair_split=True,
        dress=(SKIRT_PLAIN, SANDALS, APRON_BROWN, CUFFS_WHITE),
    ),
    "compositebowman": UnitLook(
        hair="high_ponytail",
        hair_split=True,
        dress=(
            SKIRT_PLAIN,
            SANDALS,
            DressItem("torso/clothes/sleeveless/sleeveless/male/{animation}/{color}.png"),
            SASH_WHITE,
            CUFFS_WHITE,
        ),
    ),
    "broadswordman": UnitLook(
        hat=DressItem("hat/helmet/pointed", palette="brass"),
        hat_accessory=DressItem("hat/accessory/plumage_legion", team_colored=True),
        dress=(
            SKIRT_LEGION_TEAM,
            SANDALS,
            DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", team_colored=True),
            DressItem("torso/armour/legion/male/{animation}.png", palette="brass"),
            BRACERS_BRASS,
        ),
    ),
    "longswordman": UnitLook(
        hat=DressItem("hat/helmet/pointed", palette="silver"),
        hat_accessory=DressItem("hat/accessory/plumage_legion", team_colored=True),
        dress=(
            SKIRT_LEGION_TEAM,
            SANDALS,
            DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", team_colored=True),
            DressItem("torso/armour/legion/male/{animation}.png", palette="silver"),
            BRACERS_SILVER,
        ),
    ),
    "hoplite": UnitLook(
        hat=DressItem("hat/helmet/barbuta_simple", palette="brass"),
        hat_accessory=DressItem("hat/accessory/plumage_centurion", team_colored=True),
        dress=(
            SKIRT_LEGION_TEAM,
            SANDALS,
            DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", team_colored=True),
            DressItem("torso/armour/legion/male/{animation}.png", palette="brass"),
            BRACERS_BRASS,
        ),
    ),
    # Same as "hoplite", but silver instead of brass, like "longswordman" vs
    # "broadswordman".
    "phalanx": UnitLook(
        hat=DressItem("hat/helmet/barbuta_simple", palette="silver"),
        hat_accessory=DressItem("hat/accessory/plumage_centurion", team_colored=True),
        dress=(
            SKIRT_LEGION_TEAM,
            SANDALS,
            DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", team_colored=True),
            DressItem("torso/armour/legion/male/{animation}.png", palette="silver"),
            BRACERS_SILVER,
        ),
    ),
    "priest": UnitLook(
        hair="long",
        hair_palette="white",
        beard="beard/winter/male",
        beard_palette="white",
        head="human/male_elderly",
        cape=DressItem("cape/solid", team_colored=True),
        dress=(
            DressItem("legs/skirts/plain/male/{animation}.png", palette="white"),
            SANDALS,
            DressItem("torso/clothes/longsleeve/longsleeve/male/{animation}.png", palette="white"),
            DressItem("torso/waist/sash_narrow/male/{animation}/{color}.png", team_colored=True),
        ),
    ),
}

CIV_UNIT_LOOK_OVERRIDES: dict[str, dict[str, dict]] = {
    "greek": {
        "villager": {"hair": "page2", "beard": "beard/medium"},
        "clubman": {"hair": "long_messy", "beard": "beard/winter/male"},
        "axeman": {"hair": "long_messy", "beard": "beard/winter/male"},
        "bowman": {"hair": "curtains_long", "hair_split": False, "hair_extension": None, "beard": "beard/medium"},
        "improvedbowman": {"hair": "curtains_long", "hair_split": False, "beard": "beard/medium"},
        "compositebowman": {"hair": "curtains_long", "hair_split": False, "beard": "beard/medium"},
    },
    "roman": {
        "villager": {"hair": "plain"},
        "clubman": {"hair": "parted2"},
        "axeman": {"hair": "parted2"},
        "bowman": {"hair": "buzzcut", "hair_split": False, "hair_extension": None},
        "improvedbowman": {"hair": "buzzcut", "hair_split": False},
        "compositebowman": {"hair": "buzzcut", "hair_split": False},
    },
    "babylonian": {
        "villager": {"hair": "jewfro", "beard": "beard/winter/male"},
        "bowman": {"hair": "long_center_part", "hair_split": True, "hair_extension": None, "beard": "beard/winter/male"},
        "clubman": {"hair": "curly_short", "beard": "beard/winter/male"},
        "axeman": {"hair": "curly_short", "beard": "beard/winter/male"},
        "shortswordman": {"beard": "beard/winter/male"},
        "improvedbowman": {"hair": "long_center_part", "hair_split": True, "beard": "beard/winter/male"},
        "compositebowman": {"hair": "long_center_part", "hair_split": True, "beard": "beard/winter/male"},
        "broadswordman": {"beard": "beard/winter/male"},
        "longswordman": {"beard": "beard/winter/male"},
        "hoplite": {"beard": "beard/winter/male"},
        "phalanx": {"beard": "beard/winter/male"},
    },
    "asian": {
        "villager": {"hair": "ponytail", "hair_split": True},
        "clubman": {"hair": "ponytail2", "hair_split": True},
        "axeman": {"hair": "ponytail2", "hair_split": True},
        "bowman": {"hair": "high_ponytail", "hair_split": True, "hair_extension": None},
        "improvedbowman": {"hair": "high_ponytail", "hair_split": True, "hair_extension": None},
        "compositebowman": {"hair": "high_ponytail", "hair_split": True, "hair_extension": None},
    },
    "celtic": {
        "villager": {"hair": "swoop", "beard": "beard/basic"},
        "bowman": {"hair": "loose", "hair_split": False, "hair_extension": None, "beard": "beard/basic"},
        "clubman": {"hair": "bangslong", "beard": "beard/basic"},
        "axeman": {"hair": "bangslong", "beard": "beard/basic"},
        "shortswordman": {"beard": "beard/basic"},
        "improvedbowman": {"hair": "loose", "hair_split": False, "beard": "beard/basic"},
        "compositebowman": {"hair": "loose", "hair_split": False, "beard": "beard/basic"},
        "broadswordman": {"beard": "beard/basic"},
        "longswordman": {"beard": "beard/basic"},
        "hoplite": {"beard": "beard/basic"},
        "phalanx": {"beard": "beard/basic"},
        "priest": {"hair": "curly_long", "hair_palette": "white", "beard": "beard/winter/male", "beard_palette": "white"},
    },
    "egyptian": {
        "villager": {"hair": "bob"},
        "bowman": {"hair": None, "hair_split": False, "hair_extension": DressItem("hair/extensions/ponytails/topknot_short")},
        "clubman": {"hair": "buzzcut"},
        "axeman": {"hair": "buzzcut"},
        "improvedbowman": {"hair": None, "hair_split": False, "hair_extension": DressItem("hair/extensions/ponytails/topknot_short")},
        "compositebowman": {"hair": None, "hair_split": False, "hair_extension": DressItem("hair/extensions/ponytails/topknot_short")},
        "priest": {"hair": None, "hair_palette": None, "beard": None, "beard_palette": None},
    },
    "nubian": {
        "villager": {"hair": "cornrows"},
        "bowman": {"hair": "dreadlocks_long", "hair_split": False, "hair_extension": None},
        "clubman": {"hair": "dreadlocks_short"},
        "axeman": {"hair": "dreadlocks_short"},
        "improvedbowman": {"hair": "dreadlocks_long", "hair_split": False},
        "compositebowman": {"hair": "dreadlocks_long", "hair_split": False},
        "priest": {"hair": None, "hair_palette": None, "beard": None, "beard_palette": None},
    },
}


def unit_look_for_civ(unit: str, civ_key: str) -> UnitLook:
    look = UNIT_LOOKS[unit]
    overrides = CIV_UNIT_LOOK_OVERRIDES.get(civ_key, {}).get(unit)
    return replace(look, **overrides) if overrides else look


@dataclass(frozen=True)
class Sheet:
    key: str
    source_animation: str
    columns: int
    rows: int
    keep_every_other_frame: bool = True
    frame_indices: tuple[int, ...] | None = None


# Rows are up/left/down in source-row order; the LPC source's 4th row (right) is
# dropped here since it's a near-mirror of left — the runtime mirrors left frames
# for east-facing sprites instead (see getSpriteFrameSelection in app/lib/extra.ts).
SHEETS: tuple[Sheet, ...] = (
    Sheet(
        "walking",
        "walk",
        9,
        4,
        frame_indices=(0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26),
    ),
    Sheet("action", "slash", 6, 3, keep_every_other_frame=False),
    Sheet(
        "shoot",
        "shoot",
        13,
        4,
        frame_indices=(0, 2, 3, 5, 7, 9, 10, 12, 13, 15, 16, 18, 20, 22, 23, 25, 26, 28, 29, 31, 33, 35, 36, 38),
    ),
    Sheet("thrust", "thrust", 8, 3, keep_every_other_frame=False),
    Sheet("spellcast", "spellcast", 7, 3, keep_every_other_frame=False),
    Sheet("dying", "hurt", 6, 1, keep_every_other_frame=False),
    Sheet("corpse", "hurt", 6, 1, False, (5,)),
)
