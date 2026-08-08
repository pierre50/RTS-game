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
    # ── Skin tones ──────────────────────────────────────────────────────────
    "fair":        ["#1D1D21", "#453125", "#784C49", "#AE6B60", "#D89F75", "#EBBD9D"],
    "celtic_fair": ["#492129", "#633432", "#8A5258", "#BD7D64", "#EBBD9D", "#FEDFB1"],
    "olive":       ["#1D1D21", "#492129", "#885041", "#AD6E51", "#D58D6B", "#E59A7C"],
    "brown":       ["#1D1D21", "#49251C", "#662B29", "#9E6520", "#AD6E51", "#D58D6B"],
    "deep_brown":  ["#000000", "#1D1D21", "#222323", "#31222A", "#4A353C", "#5E4646"],
    "golden":      ["#431729", "#733D3B", "#AD6E51", "#D89F75", "#FFD59B", "#F7F4BF"],

    # ── Hair ────────────────────────────────────────────────────────────────
    "black":       ["#000000", "#1D1D21", "#222323", "#2D3136", "#434549", "#48474D"],
    "dark_brown":  ["#000000", "#1D1D21", "#372423", "#453125", "#633432", "#885041"],
    "brown_hair":  ["#000000", "#372423", "#583126", "#753B09", "#854F12", "#9E6520"],
    "light_brown": ["#1A0E04", "#301B07", "#60350F", "#7D4513", "#AE682A", "#C88D58"],

    # ── Player colours ──────────────────────────────────────────────────────
    "navy":          ["#1D1D21", "#2E1026", "#26233D", "#28335D", "#5165AE", "#5274C5"],
    "player_blue":   ["#1D1D21", "#26233D", "#28335D", "#5165AE", "#5274C5", "#55B1F1"],
    "player_red":    ["#5E0711", "#721C03", "#9C3327", "#B63C35", "#E45C5F", "#FF7676"],
    "player_yellow": ["#583126", "#614A3C", "#9E6520", "#BA882E", "#B4AA33", "#FFCF05"],
    "player_green":  ["#002219", "#003221", "#174A1B", "#4C5F33", "#58712C", "#6B842D"],
    "player_orange": ["#721C03", "#753B09", "#9C3327", "#B63C35", "#E98627", "#FFB108"],
    "player_grey":   ["#222323", "#3B303C", "#434549", "#75686E", "#848795", "#ABAEBE"],
    "player_cyan":   ["#002219", "#004051", "#004D5E", "#006B6D", "#008279", "#00A087"],
    "player_brown":  ["#222323", "#453125", "#583126", "#733D3B", "#885041", "#AD6E51"],

    # ── Metal tones ─────────────────────────────────────────────────────────
    "brass":  ["#1D1D21", "#453125", "#614A3C", "#BA882E", "#FFCE7F", "#FFF3D6"],
    "copper": ["#1D1D21", "#492129", "#583126", "#753B09", "#9E6520", "#F99B4E"],
    "bronze": ["#1D1D21", "#721C03", "#9C3327", "#B63C35", "#E98627", "#FBAA84"],
    "iron":   ["#000000", "#222323", "#3B303C", "#5A3C45", "#75686E", "#917A7B"],
    "steel":  ["#181F2F", "#48474D", "#73737F", "#917A7B", "#A6AEBA", "#EADBC9"],
    "silver": ["#181F2F", "#554769", "#73737F", "#A6AEBA", "#CDD2DA", "#EBF0F6"],
    "gold":   ["#2E1026", "#753B09", "#9E6520", "#D1AA39", "#EDD493", "#FFF3D6"],

    # ── Cloth ───────────────────────────────────────────────────────────────
    "white":       ["#2E1026", "#554769", "#917A7B", "#BBAFA4", "#EADBC9", "#F5F7FA"],
    "cloth_brown": ["#1D131E", "#411E05", "#4B2B13", "#62351C", "#744B30", "#996B4A"],
    "cloth_blue":  ["#180716", "#281E41", "#322D6A", "#3C49AD", "#466AC9", "#61A0EF"],
}

SKIN_TONES = {
    "fair": "Light skin used by Babylonian variants.",
    "celtic_fair": "Warm fair skin used by Celtic variants.",
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
    "celtic": {"skin": "celtic_fair", "hair": "brown_hair"},
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

# Hero outfit pieces. Unlike SHORTS/APRON_BROWN (pre-colored files picked by name),
# shortsleeve/pantaloons/shoes only ship one colorless template per animation
# upstream, so they're pixel-recolored to a fixed palette instead. Suspenders and
# the headband are the exception: suspenders only ships pre-colored per-animation
# files (like APRON_BROWN's "brown"), and the headband is recolored like a
# metal/hat piece (see HEADBAND above, just with a fixed "cloth_blue" instead of
# the player's team color).
SHORTSLEEVE_WHITE = DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", palette="white")
PANTALOONS_BROWN = DressItem("legs/pantaloons/male/{animation}.png", palette="cloth_brown")
SHOES_BLACK = DressItem("feet/shoes/basic/male/{animation}.png", palette="black")
SUSPENDERS_BLACK = DressItem("torso/aprons/suspenders/male/{animation}/black.png")
HEADBAND_BLUE = DressItem("hat/headband/tied", palette="cloth_blue")
HIJAB_TEAM = DressItem("hat/cloth/hijab/thin", team_colored=True)
FEMALE_TANKTOP = DressItem("torso/clothes/sleeveless/tanktop/female/{animation}/{color}.png")

@dataclass(frozen=True)
class UnitVariant:
    key: str
    body: str


# Baked output/asset genders. Visual sub-variants can be added under each
# gender later if we ever want multiple male/female looks per civilization.
UNIT_VARIANTS: tuple[UnitVariant, ...] = (
    UnitVariant("male", "male"),
    UnitVariant("female", "female"),
)


@dataclass(frozen=True)
class UnitLook:
    """The single source of truth for one unit type's appearance: body/face shape
    are the only things shared across units by default; hair, beard, hat and dress
    are what actually distinguish a villager from a clubman from an axeman, etc."""

    hair: str | None = None
    # Some hairstyles (e.g. ponytails) ship as separate bg/fg halves: bg tucks behind
    # the body/shoulders, fg sits at the normal in-front hair position.
    hair_split: bool = False
    # LPC hairstyle body folder. Existing synced hairstyles use "adult"; the
    # richer upstream female hairstyles live under "female".
    hair_body_type: str = "adult"
    body: str = "male"
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
    # A clasp/brooch drawn after the cape's front drape, at the collar (e.g. the
    # chief's cape clip).
    neck: DressItem | None = None
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
    # The ARPG hero's own signature look, distinct from a plain "villager": light
    # brown hair, a blue headband, and a white-shirt/brown-pantaloons/black-shoes
    # outfit with black suspenders on top. Baked like "villager" (see
    # hero_build_tasks() in build.py) for slash/shoot job-pose variety plus a
    # mounted "riding" sheet, since the hero can swap tools/weapons and ride.
    "hero": UnitLook(
        hair="plain",
        hat=HEADBAND_BLUE,
        dress=(SHORTS, SANDALS),
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
    # Same base as "villager" (plain hair, sandals), with the shorts swapped for
    # formal striped pants and a team-colored cape/clip added on top to mark it
    # as the player's leader — worn by both the starting chief and any villager
    # later promoted into one (see isChiefUnit() in app/lib/chief.ts).
    "chief": UnitLook(
        hair="plain",
        cape=DressItem("cape/solid", team_colored=True),
        neck=DressItem("neck/capeclip/male/{animation}/{color}.png"),
        dress=(
            DressItem("legs/formal_striped/male/{animation}.png", team_colored=True),
            SANDALS,
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
        "clubman": {"hair": "buzzcut"},
        "axeman": {"hair": "buzzcut"},
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


FEMALE_BASE_LOOK_OVERRIDES = {
    "head": "human/male_custom",
    "beard": None,
    "beard_palette": None,
    "hair_extension": None,
    "hair_split": False,
}


FEMALE_CIV_UNIT_LOOK_OVERRIDES: dict[str, dict[str, dict]] = {
    "babylonian": {
        "villager": {"hair": None, "hat": HIJAB_TEAM},
        "clubman": {"hair": "long_tied", "hair_body_type": "female", "hat": None},
        "axeman": {"hair": "braid", "hair_body_type": "female", "hat": None},
        "bowman": {"hair": "high_ponytail", "hair_body_type": "female", "hat": None},
        "improvedbowman": {"hair": "high_ponytail", "hair_body_type": "female", "hat": None},
        "compositebowman": {"hair": "long_center_part", "hair_body_type": "female", "hat": None},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "chief": {"hair": None, "hat": HIJAB_TEAM},
        "priest": {"hair": None, "hat": HIJAB_TEAM, "hair_palette": None},
    },
    "egyptian": {
        "villager": {"hair": "long_center_part", "hair_body_type": "female"},
        "clubman": {"hair": "long_tied", "hair_body_type": "female"},
        "axeman": {"hair": "braid", "hair_body_type": "female"},
        "bowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "improvedbowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "compositebowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "chief": {"hair": "long_center_part", "hair_body_type": "female"},
        "priest": {"hair": None, "hair_palette": None},
    },
    "greek": {
        "villager": {"hair": "braid", "hair_body_type": "female"},
        "clubman": {"hair": "long_tied", "hair_body_type": "female"},
        "axeman": {"hair": "wavy", "hair_body_type": "female"},
        "bowman": {"hair": "half_up", "hair_body_type": "female"},
        "improvedbowman": {"hair": "half_up", "hair_body_type": "female"},
        "compositebowman": {"hair": "half_up", "hair_body_type": "female"},
        "hero": {"hair": "braid", "hair_body_type": "female"},
        "chief": {"hair": "braid", "hair_body_type": "female"},
        "priest": {"hair": "curly_long", "hair_body_type": "female", "hair_palette": "white"},
    },
    "roman": {
        "villager": {"hair": "long_center_part", "hair_body_type": "female"},
        "clubman": {"hair": "long_tied", "hair_body_type": "female"},
        "axeman": {"hair": "braid", "hair_body_type": "female"},
        "bowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "improvedbowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "compositebowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "chief": {"hair": "long_center_part", "hair_body_type": "female"},
        "priest": {"hair": "long_tied", "hair_body_type": "female", "hair_palette": "white"},
    },
    "asian": {
        "villager": {"hair": "long_tied", "hair_body_type": "female"},
        "clubman": {"hair": "ponytail", "hair_body_type": "female"},
        "axeman": {"hair": "braid", "hair_body_type": "female"},
        "bowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "improvedbowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "compositebowman": {"hair": "high_ponytail", "hair_body_type": "female"},
        "hero": {"hair": "long_tied", "hair_body_type": "female"},
        "chief": {"hair": "long_tied", "hair_body_type": "female"},
        "priest": {"hair": "single", "hair_body_type": "female", "hair_palette": "white"},
    },
    "celtic": {
        "villager": {"hair": "wavy", "hair_body_type": "female"},
        "clubman": {"hair": "bangslong2", "hair_body_type": "female"},
        "axeman": {"hair": "unkempt", "hair_body_type": "female"},
        "bowman": {"hair": "braid2", "hair_body_type": "female"},
        "improvedbowman": {"hair": "braid2", "hair_body_type": "female"},
        "compositebowman": {"hair": "braid2", "hair_body_type": "female"},
        "hero": {"hair": "wavy", "hair_body_type": "female"},
        "chief": {"hair": "braid2", "hair_body_type": "female"},
        "priest": {"hair": "curly_long", "hair_body_type": "female", "hair_palette": "white"},
    },
    "nubian": {
        "villager": {"hair": "xlong", "hair_body_type": "female"},
        "clubman": {"hair": "dreadlocks_long", "hair_body_type": "female"},
        "axeman": {"hair": "dreadlocks_long", "hair_body_type": "female"},
        "bowman": {"hair": "braid2", "hair_body_type": "female"},
        "improvedbowman": {"hair": "braid2", "hair_body_type": "female"},
        "compositebowman": {"hair": "braid2", "hair_body_type": "female"},
        "hero": {"hair": "xlong", "hair_body_type": "female"},
        "chief": {"hair": "dreadlocks_long", "hair_body_type": "female"},
        "priest": {"hair": "dreadlocks_long", "hair_body_type": "female", "hair_palette": "white"},
    },
}


def unit_look_for_civ(unit: str, civ_key: str) -> UnitLook:
    look = UNIT_LOOKS[unit]
    overrides = CIV_UNIT_LOOK_OVERRIDES.get(civ_key, {}).get(unit)
    return replace(look, **overrides) if overrides else look


def variant_look_for_civ(unit: str, civ_key: str, variant: UnitVariant) -> UnitLook:
    look = replace(unit_look_for_civ(unit, civ_key), body=variant.body)
    if variant.body != "female":
        return look

    look = replace(look, **FEMALE_BASE_LOOK_OVERRIDES)
    overrides = FEMALE_CIV_UNIT_LOOK_OVERRIDES.get(civ_key, {}).get(unit)
    look = replace(look, **overrides) if overrides else look
    return replace(look, dress=(FEMALE_TANKTOP, *look.dress))


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
    Sheet("spellcast", "spellcast", 7, 3, keep_every_other_frame=False),
    Sheet("dying", "hurt", 6, 1, keep_every_other_frame=False),
    Sheet("corpse", "hurt", 6, 1, False, (5,)),
)
