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
    "nordic_fair": ["#1D1D21", "#3B303C", "#76524E", "#B87A68", "#E6B58D", "#F8DEC0"],
    "olive":       ["#1D1D21", "#492129", "#885041", "#AD6E51", "#D58D6B", "#E59A7C"],
    "brown":       ["#1D1D21", "#49251C", "#662B29", "#9E6520", "#AD6E51", "#D58D6B"],
    "deep_brown":  ["#000000", "#1D1D21", "#222323", "#31222A", "#4A353C", "#5E4646"],
    "golden":      ["#431729", "#733D3B", "#AD6E51", "#D89F75", "#FFD59B", "#F7F4BF"],

    # ── Hair ────────────────────────────────────────────────────────────────
    "black":       ["#000000", "#1D1D21", "#222323", "#2D3136", "#434549", "#48474D"],
    "dark_brown":  ["#000000", "#1D1D21", "#372423", "#453125", "#633432", "#885041"],
    "brown_hair":  ["#000000", "#372423", "#583126", "#753B09", "#854F12", "#9E6520"],
    "light_brown": ["#1A0E04", "#301B07", "#60350F", "#7D4513", "#AE682A", "#C88D58"],
    "blond":       ["#2E2533", "#61482C", "#8E6A2F", "#C29443", "#E7C46F", "#FFF0B0"],

    # ── Player colours ──────────────────────────────────────────────────────
    "navy":          ["#1D1D21", "#2E1026", "#26233D", "#28335D", "#5165AE", "#5274C5"],
    # Keep aligned with changeSpriteColor's runtime SOURCE_COLORS in
    # app/lib/graphics/colors.ts for exact post-snap blue->team remapping.
    "player_blue": ["#6DCCFF", "#55B1F1", "#4097EA", "#105DA2", "#1476C0", "#07487C", "#03315F", "#001B40"],
    "player_red":    ["#5E0711", "#721C03", "#9C3327", "#B63C35", "#E45C5F", "#FF7676"],
    "player_yellow": ["#583126", "#614A3C", "#9E6520", "#BA882E", "#B4AA33", "#FFCF05"],
    "player_green":  ["#002219", "#003221", "#174A1B", "#4C5F33", "#58712C", "#6B842D"],
    "player_orange": ["#721C03", "#753B09", "#9C3327", "#B63C35", "#E98627", "#FFB108"],
    "player_grey":   ["#222323", "#3B303C", "#434549", "#75686E", "#848795", "#ABAEBE"],
    "player_cyan":   ["#002219", "#004051", "#004D5E", "#006B6D", "#008279", "#00A087"],
    "player_brown":  ["#222323", "#453125", "#583126", "#733D3B", "#885041", "#AD6E51"],

    # ── Metal tones ─────────────────────────────────────────────────────────
    # ULPC metal palettes from scripts/lpc/palettes/ulpc-metal-palettes.json.
    "brass":  ["#1A1213", "#2E2533", "#61482C", "#836332", "#AF8A35", "#FDD082", "#FDF5CC"],
    "ceramic": ["#181009", "#2B1C1D", "#32251A", "#594435", "#7D604D", "#BA9069", "#FBE3B0"],
    "copper": ["#662B29", "#94363A", "#B64D46", "#E37840", "#F99B4E"],
    "bronze": ["#4F2313", "#573726", "#6D4A00", "#966600", "#BF8200", "#E7A820", "#FBE3B0"],
    "iron_source": ["#000000", "#1D131E", "#1B192B", "#29253A", "#343043", "#484152", "#726B7E"],
    "iron":   ["#111216", "#1C1E24", "#2A2E36", "#3C414A", "#505762", "#67707A", "#838C98"],
    "steel":  ["#181F2F", "#48474D", "#73737F", "#917A7B", "#A6AEBA", "#EADBC9"],
    "silver": ["#181F2F", "#554769", "#73737F", "#A6AEBA", "#CDD2DA", "#EBF0F6"],
    "gold":   ["#2E1026", "#753B09", "#9E6520", "#D1AA39", "#EDD493", "#FFF3D6"],
    # Tool sheets mix wooden handles with metal heads, so this source palette
    # targets only the common ULPC metal pixels and leaves handle colors alone.
    "tool_metal_source": [
        "#1D131E",
        "#2E2533",
        "#31313E",
        "#4D4A5D",
        "#726B7E",
        "#867E7F",
        "#C4B59F",
        "#FFFFFF",
        "#4A5057",
        "#818B8B",
        "#8AAAAB",
        "#A9C9CA",
    ],
    "arrow_metal_source": [
        "#2E2533",
        "#4B444C",
        "#726B7E",
        "#7E7068",
        "#867E7F",
        "#748DA4",
        "#A9C9CA",
    ],
    "shield_round_metal_source": [
        "#302732",
        "#3A313A",
        "#4B444C",
        "#5E5252",
        "#726B7E",
        "#7E7068",
        "#867E7F",
        "#B19998",
        "#C4B59F",
        "#E5E6C7",
    ],

    # ── Cloth ───────────────────────────────────────────────────────────────
    "white":       ["#2E1026", "#554769", "#917A7B", "#BBAFA4", "#EADBC9", "#F5F7FA"],
    "cloth_brown": ["#1D131E", "#411E05", "#4B2B13", "#62351C", "#744B30", "#996B4A"],
    "cloth_blue":  ["#180716", "#281E41", "#322D6A", "#3C49AD", "#466AC9", "#61A0EF"],
}

SKIN_TONES = {
    "fair": "Light skin used by Babylonian variants.",
    "celtic_fair": "Warm fair skin used by Celtic variants.",
    "nordic_fair": "Cool fair skin used by Nordic variants.",
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
    "nordic": {"skin": "nordic_fair", "hair": "blond"},
    "nubian": {"skin": "deep_brown", "hair": "black"},
}

BANDIT_CIV = {"skin": "olive", "hair": "dark_brown"}

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


SHORTS = DressItem("legs/shorts/shorts/male/{animation}/{color}.png", team_colored=True)
SLIT_SKIRT = DressItem("legs/skirts/slit/female/{animation}/{color}.png", team_colored=True)
SANDALS = DressItem("feet/sandals/male/{animation}.png", palette="cloth_brown")
SANDALS_FEMALE = DressItem("feet/sandals/female/{animation}.png", palette="cloth_brown")
BELT = DressItem("torso/waist/belt_leather/male/{animation}/brown.png")
BELT_FEMALE = DressItem("torso/waist/belt_leather/female/{animation}/brown.png")
BRACERS_PATH = "arms/bracers/male/{animation}.png"
BRACERS_BRASS = DressItem(BRACERS_PATH, palette="brass")
BRACERS_SILVER = DressItem(BRACERS_PATH, palette="silver")
HEADBAND = DressItem("hat/headband/tied", team_colored=True)
APRON_BROWN = DressItem("torso/aprons/suspenders/male/{animation}/brown.png")
APRON_BROWN_FEMALE = DressItem("torso/aprons/suspenders/female/{animation}/brown.png")
CUFFS_WHITE = DressItem("arms/wrists/cuffs/male/{animation}.png", palette="white")
CUFFS_LEATHER = DressItem("arms/wrists/cuffs/male/{animation}/leather.png")
SASH_WHITE = DressItem("torso/waist/sash_narrow/male/{animation}/white.png")
SASH_WHITE_FEMALE = DressItem("torso/waist/sash_narrow/female/{animation}/white.png")
SASH = DressItem("torso/waist/sash_narrow/male/{animation}/{color}.png", team_colored=True)
SASH_FEMALE = DressItem("torso/waist/sash_narrow/female/{animation}/{color}.png", team_colored=True)
# plain/legion skirts have no pre-made color variants, so they're pixel-recolored to
# the player palette instead of picking a hand-colored file.
SKIRT_PLAIN = DressItem("legs/skirts/plain/male/{animation}.png", team_colored=True)
SKIRT_PLAIN_FEMALE = DressItem("legs/skirts/plain/female/{animation}.png", team_colored=True)
SKIRT_LEGION_TEAM = DressItem("legs/skirts/legion/male/{animation}.png", team_colored=True)
SKIRT_LEGION_TEAM_FEMALE = DressItem("legs/skirts/legion/female/{animation}.png", team_colored=True)
SKIRT_SHORT = DressItem("legs/skirts/short/male/{animation}.png", team_colored=True)
PANTS_TEAM = DressItem("legs/pants/male/{animation}/{color}.png", team_colored=True)
STRIPED_PANTS = DressItem("legs/formal_striped/male/{animation}.png", team_colored=True)
STRIPED_PANTS_RED = DressItem("legs/formal_striped/male/{animation}/red.png")
STRIPED_PANTS_FOREST = DressItem("legs/formal_striped/male/{animation}/forest.png")
BASIC_SHOES_LEATHER = DressItem("feet/shoes/male/{animation}/leather.png")
BASIC_SHOES_LEATHER_FEMALE = DressItem("feet/shoes/female/{animation}/leather.png")
SLEEVELESS_SHIRT = DressItem("torso/clothes/sleeveless/sleeveless/male/{animation}/{color}.png", team_colored=True)
KIMONO = DressItem("dress/kimono/normal/universal/female/{animation}/{color}.png", team_colored=True)
KIMONO_LONGSLEEVE = DressItem("dress/kimono/sleeves/universal/female/{animation}/{color}.png", team_colored=True)
KIMONO_LONGSLEEVE_FRONT = DressItem(
    "dress/kimono/sleeves/universal/female_front/{animation}/{color}.png",
    team_colored=True,
)
SLIT_DRESS = DressItem("dress/slit/female/{animation}/{color}.png", team_colored=True)

MALE_SHORT_SKIRT_SLEEVELESS = (SANDALS, SKIRT_SHORT, SLEEVELESS_SHIRT)
MALE_LONG_SKIRT_SLEEVELESS = (SANDALS, SKIRT_PLAIN, SLEEVELESS_SHIRT)
MALE_SLIT_SKIRT_NO_SHIRT = (SANDALS, SLIT_SKIRT)
MALE_NUBIAN_SLIT_SKIRT_NO_SHIRT = (SLIT_SKIRT,)

FEMALE_KIMONO_SANDALS = (SANDALS_FEMALE, KIMONO)
FEMALE_KIMONO_LONGSLEEVE_SANDALS = (SANDALS_FEMALE, KIMONO, KIMONO_LONGSLEEVE, KIMONO_LONGSLEEVE_FRONT)
FEMALE_SLIT_DRESS_SANDALS = (SANDALS_FEMALE, SLIT_DRESS)
FEMALE_KIMONO_LONGSLEEVE_SHOES = (
    BASIC_SHOES_LEATHER_FEMALE,
    KIMONO,
    KIMONO_LONGSLEEVE,
    KIMONO_LONGSLEEVE_FRONT,
)
FEMALE_NUBIAN_SLIT_DRESS = (SLIT_DRESS,)

# Hero outfit pieces. Unlike SHORTS/APRON_BROWN (pre-colored files picked by name),
# shortsleeve/pantaloons/shoes only ship one colorless template per animation
# upstream, so they're pixel-recolored to a fixed palette instead. Suspenders only
# ships pre-colored per-animation files (like APRON_BROWN's "brown"), while the
# headband uses the same team-color recoloring flow as other clothing (team-colored
# at bake time, then recolored per-player at runtime).
SHORTSLEEVE_WHITE = DressItem("torso/clothes/shortsleeve/shortsleeve/male/{animation}.png", palette="white")
SHORTSLEEVE_WHITE_FEMALE = DressItem("torso/clothes/shortsleeve/shortsleeve/female/{animation}.png", palette="white")
LONGSLEEVE_WHITE = DressItem("torso/clothes/longsleeve/longsleeve/male/{animation}.png", palette="white")
LONGSLEEVE_WHITE_FEMALE = DressItem("torso/clothes/longsleeve/longsleeve/female/{animation}.png", palette="white")
LONGSLEEVE_TEAM = DressItem("torso/clothes/longsleeve/longsleeve/male/{animation}.png", team_colored=True)
LONGSLEEVE_TEAM_FEMALE = DressItem("torso/clothes/longsleeve/longsleeve/female/{animation}.png", team_colored=True)
PANTALOONS_BROWN = DressItem("legs/pantaloons/male/{animation}.png", palette="cloth_brown")
SHOES_BLACK = DressItem("feet/shoes/basic/male/{animation}.png", palette="black")
SUSPENDERS_BLACK = DressItem("torso/aprons/suspenders/male/{animation}/black.png")
SUSPENDERS_BLACK_FEMALE = DressItem("torso/aprons/suspenders/female/{animation}/black.png")
HEADBAND_BLUE = DressItem("hat/headband/tied", team_colored=True)
HIJAB_TEAM = DressItem("hat/cloth/hijab/thin", team_colored=True)
FEMALE_TANKTOP = DressItem("torso/clothes/sleeveless/tanktop/female/{animation}/{color}.png", team_colored=True)
FEMALE_SLEEVELESS_VNECK = DressItem("torso/clothes/sleeveless/sleeveless2_vneck/female/{animation}/{color}.png", team_colored=True)

MALE_LONG_SKIRT_LONGSLEEVE = (BASIC_SHOES_LEATHER, SKIRT_PLAIN, LONGSLEEVE_TEAM)
MALE_STRIPED_PANTS_LONGSLEEVE = (BASIC_SHOES_LEATHER, STRIPED_PANTS, LONGSLEEVE_TEAM)
MALE_PANTS_LONGSLEEVE = (BASIC_SHOES_LEATHER, PANTS_TEAM, LONGSLEEVE_TEAM)

CHIEF_CAPE = DressItem("cape/solid", team_colored=True)
CAPE_SOLID_GRAY = DressItem("cape/solid", palette="player_grey")
CHIEF_CAPE_TRIM = DressItem("cape/trim/female/{animation}/white.png")
CHIEF_ACCESSORIES = (
    DressItem("shoulders/leather/{body}/{animation}/white.png"),
    DressItem("arms/bracers/{body}/{animation}/gold.png"),
    DressItem("neck/necklace/beaded_small/{body}/{animation}/gold.png"),
    DressItem("facial/earrings/moon/{body}/{animation}/gold.png"),
)

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
    are what actually distinguish a villager from an infantryman, priest, chief, etc."""

    hair: str | None = None
    # Some hairstyles (e.g. ponytails) ship as separate bg/fg halves: bg tucks behind
    # the body/shoulders, fg sits at the normal in-front hair position.
    hair_split: bool = False
    # LPC hairstyle body folder. Existing synced hairstyles use "adult"; the
    # richer upstream female hairstyles live under "female".
    hair_body_type: str = "adult"
    body: str = "male"
    # Overrides the civilization's skin tone for units that must keep one skin
    # color across every civ bake (e.g. map-spawned bandits).
    skin_palette: str | None = None
    # Uses one fixed render palette instead of producing one output per playable
    # civilization. The baked output path keeps only the variant key (male/female).
    fixed_civ: dict[str, str] | None = None
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
    # Single overlay drawn above the cape front, used for fixed cape trim.
    cape_trim: DressItem | None = None
    # A clasp/brooch drawn after the cape's front drape, at the collar (e.g. the
    # chief's cape clip).
    neck: DressItem | None = None
    dress: tuple[DressItem, ...] = ()
    variants: tuple[str, ...] | None = None


UNIT_LOOKS: dict[str, UnitLook] = {
    "villager": UnitLook(hair="plain", dress=(SANDALS, SLIT_SKIRT)),
    "infantry": UnitLook(hair="long", hat=HEADBAND, dress=(SANDALS, SKIRT_LEGION_TEAM)),
    "infantry_nohair": UnitLook(dress=(SANDALS, SKIRT_LEGION_TEAM)),
    # The ARPG hero's own signature look, distinct from a plain "villager": light
    # brown hair, a blue headband, and a white-shirt/brown-pantaloons/black-shoes
    # outfit with black suspenders on top. Baked like "villager" (see
    # hero_build_tasks() in build.py) for slash/shoot job-pose variety; mounted
    # legs are composed at runtime in Pixi.
    "hero": UnitLook(
        hair="plain",
        hat=HEADBAND_BLUE,
        dress=(SANDALS, SLIT_SKIRT),
    ),
    "priest": UnitLook(
        hair="long",
        hair_palette="white",
        beard="beard/winter/male",
        beard_palette="white",
        head="human/male_elderly",
        cape=DressItem("cape/solid", team_colored=True),
        dress=(
            SANDALS,
            SKIRT_PLAIN,
            LONGSLEEVE_WHITE,
            SASH,
        ),
    ),
    # The actual chief look derives from each civilization's villager base in
    # variant_look_for_civ(), then receives the fixed leader accessories below.
    "chief": UnitLook(),
    "bandit_chief": UnitLook(
        skin_palette="olive",
        beard="beard/winter/male",
        beard_palette="black",
        cape=CAPE_SOLID_GRAY,
        dress=(BASIC_SHOES_LEATHER, STRIPED_PANTS_RED),
        fixed_civ=BANDIT_CIV,
        variants=("male",),
    ),
    "bandit_sword": UnitLook(
        skin_palette="olive",
        beard="mustache/basic",
        dress=(BASIC_SHOES_LEATHER, STRIPED_PANTS_FOREST),
        fixed_civ=BANDIT_CIV,
        variants=("male",),
    ),
    "bandit_archer": UnitLook(
        skin_palette="olive",
        hair="plain",
        hair_palette="dark_brown",
        beard="beard/medium",
        beard_palette="dark_brown",
        dress=(BASIC_SHOES_LEATHER, STRIPED_PANTS_FOREST, CUFFS_LEATHER),
        fixed_civ=BANDIT_CIV,
        variants=("male",),
    ),
}


def variants_for_unit(unit: str) -> tuple[UnitVariant, ...]:
    variant_keys = UNIT_LOOKS[unit].variants
    if variant_keys is None:
        return UNIT_VARIANTS
    allowed = set(variant_keys)
    return tuple(variant for variant in UNIT_VARIANTS if variant.key in allowed)


def civs_for_unit(unit: str, selected_civs: dict[str, dict[str, str]] | None = None) -> dict[str, dict[str, str]]:
    fixed_civ = UNIT_LOOKS[unit].fixed_civ
    if fixed_civ is not None:
        return {"": fixed_civ}
    return selected_civs if selected_civs is not None else CIVS


CIV_UNIT_LOOK_OVERRIDES: dict[str, dict[str, dict]] = {
    "greek": {
        "villager": {"hair": "page2", "beard": "beard/medium", "dress": MALE_SHORT_SKIRT_SLEEVELESS},
        "infantry": {"hair": "long_messy", "beard": "beard/winter/male", "dress": MALE_SHORT_SKIRT_SLEEVELESS},
        "hero": {"hair": "page2"},
    },
    "roman": {
        "villager": {"hair": "plain", "dress": MALE_SHORT_SKIRT_SLEEVELESS},
        "infantry": {"hair": "buzzcut", "dress": MALE_SHORT_SKIRT_SLEEVELESS},
        "hero": {"hair": "buzzcut"},
    },
    "babylonian": {
        "villager": {"hair": "jewfro", "beard": "beard/winter/male", "dress": MALE_LONG_SKIRT_SLEEVELESS},
        "infantry": {"hair": "curly_short", "beard": "beard/winter/male", "dress": MALE_LONG_SKIRT_SLEEVELESS},
        "hero": {"hair": "jewfro", "beard": "beard/winter/male"},
    },
    "asian": {
        "villager": {"hair": "ponytail", "hair_split": True, "dress": MALE_LONG_SKIRT_LONGSLEEVE},
        "infantry": {"hair": "ponytail2", "hair_split": True, "dress": MALE_LONG_SKIRT_LONGSLEEVE},
        "hero": {"hair": "ponytail", "hair_split": True},
    },
    "celtic": {
        "villager": {"hair": "swoop", "beard": "beard/basic", "dress": MALE_STRIPED_PANTS_LONGSLEEVE},
        "infantry": {"hair": "bangslong", "beard": "beard/basic", "dress": MALE_STRIPED_PANTS_LONGSLEEVE},
        "hero": {"hair": "swoop", "beard": "beard/medium"},
        "priest": {"hair": "curly_long", "hair_palette": "white", "beard": "beard/winter/male", "beard_palette": "white"},
    },
    "nordic": {
        "villager": {"hair": "swoop", "beard": "beard/basic", "dress": MALE_PANTS_LONGSLEEVE},
        "infantry": {"hair": "bangslong", "beard": "beard/winter/male", "dress": MALE_PANTS_LONGSLEEVE},
        "hero": {"hair": "bob_side_part", "beard": "beard/basic"},
        "priest": {"hair": "curly_long", "hair_palette": "white", "beard": "beard/winter/male", "beard_palette": "white"},
    },
    "egyptian": {
        "villager": {"hair": "bob", "dress": MALE_SLIT_SKIRT_NO_SHIRT},
        "infantry": {"hair": "buzzcut", "dress": MALE_SLIT_SKIRT_NO_SHIRT},
        "hero": {"hair": "bob"},
        "priest": {"hair": None, "hair_palette": None, "beard": None, "beard_palette": None},
    },
    "nubian": {
        "villager": {"hair": "cornrows", "dress": MALE_NUBIAN_SLIT_SKIRT_NO_SHIRT},
        "infantry": {"hair": "dreadlocks_short", "dress": MALE_NUBIAN_SLIT_SKIRT_NO_SHIRT},
        "hero": {"hair": "cornrows", "beard": None},
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
        "villager": {"hair": None, "hat": HIJAB_TEAM, "dress": FEMALE_KIMONO_LONGSLEEVE_SANDALS},
        "infantry": {"hair": None, "hat": HIJAB_TEAM, "dress": FEMALE_KIMONO_LONGSLEEVE_SANDALS},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "priest": {"hair": None, "hat": HIJAB_TEAM, "hair_palette": None},
    },
    "egyptian": {
        "villager": {"hair": "long_center_part", "hair_body_type": "female", "dress": FEMALE_SLIT_DRESS_SANDALS},
        "infantry": {"hair": "long_tied", "hair_body_type": "female", "dress": FEMALE_SLIT_DRESS_SANDALS},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "priest": {"hair": None, "hair_palette": None},
    },
    "greek": {
        "villager": {"hair": "braid", "hair_body_type": "female", "dress": FEMALE_KIMONO_SANDALS},
        "infantry": {"hair": "long_tied", "hair_body_type": "female", "dress": FEMALE_KIMONO_SANDALS},
        "hero": {"hair": "braid", "hair_body_type": "female"},
        "priest": {"hair": "curly_long", "hair_body_type": "female", "hair_palette": "white"},
    },
    "roman": {
        "villager": {"hair": "long_center_part", "hair_body_type": "female", "dress": FEMALE_KIMONO_SANDALS},
        "infantry": {"hair": "long_tied", "hair_body_type": "female", "dress": FEMALE_KIMONO_SANDALS},
        "hero": {"hair": "long_center_part", "hair_body_type": "female"},
        "priest": {"hair": "long_tied", "hair_body_type": "female", "hair_palette": "white"},
    },
    "asian": {
        "villager": {"hair": "long_tied", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "infantry": {"hair": "ponytail", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "hero": {"hair": "long_tied", "hair_body_type": "female"},
        "priest": {"hair": "single", "hair_body_type": "female", "hair_palette": "white"},
    },
    "celtic": {
        "villager": {"hair": "wavy", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "infantry": {"hair": "bangslong2", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "hero": {"hair": "wavy", "hair_body_type": "female"},
        "priest": {"hair": "curly_long", "hair_body_type": "female", "hair_palette": "white"},
    },
    "nordic": {
        "villager": {"hair": "wavy", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "infantry": {"hair": "braid2", "hair_body_type": "female", "dress": FEMALE_KIMONO_LONGSLEEVE_SHOES},
        "hero": {"hair": "braid", "hair_body_type": "female"},
        "priest": {"hair": "curly_long", "hair_body_type": "female", "hair_palette": "white"},
    },
    "nubian": {
        "villager": {"hair": "xlong", "hair_body_type": "female", "dress": FEMALE_NUBIAN_SLIT_DRESS},
        "infantry": {"hair": "dreadlocks_long", "hair_body_type": "female", "dress": FEMALE_NUBIAN_SLIT_DRESS},
        "hero": {"hair": "xlong", "hair_body_type": "female"},
        "priest": {"hair": "dreadlocks_long", "hair_body_type": "female", "hair_palette": "white"},
    },
}


def remove_hair(look: UnitLook) -> UnitLook:
    return replace(
        look,
        hair=None,
        hair_split=False,
        hair_body_type="adult",
        hair_palette=None,
        hair_extension=None,
    )


def chief_look_from_villager(look: UnitLook) -> UnitLook:
    return replace(
        look,
        cape=CHIEF_CAPE,
        cape_trim=CHIEF_CAPE_TRIM,
        dress=(*look.dress, *CHIEF_ACCESSORIES),
    )


def unit_look_for_civ(unit: str, civ_key: str) -> UnitLook:
    if unit == "chief":
        return chief_look_from_villager(unit_look_for_civ("villager", civ_key))

    base_unit = "infantry" if unit == "infantry_nohair" else unit
    look = UNIT_LOOKS[base_unit]
    overrides = CIV_UNIT_LOOK_OVERRIDES.get(civ_key, {}).get(base_unit)
    look = replace(look, **overrides) if overrides else look
    return remove_hair(look) if unit == "infantry_nohair" else look


def variant_look_for_civ(unit: str, civ_key: str, variant: UnitVariant) -> UnitLook:
    if unit == "chief":
        return chief_look_from_villager(variant_look_for_civ("villager", civ_key, variant))

    look = replace(unit_look_for_civ(unit, civ_key), body=variant.body)
    if variant.body != "female":
        return look

    female_dress_map = {
        SANDALS: SANDALS_FEMALE,
        BELT: BELT_FEMALE,
        APRON_BROWN: APRON_BROWN_FEMALE,
        SASH: SASH_FEMALE,
        SKIRT_PLAIN: SKIRT_PLAIN_FEMALE,
        SKIRT_LEGION_TEAM: SKIRT_LEGION_TEAM_FEMALE,
        SHORTSLEEVE_WHITE: SHORTSLEEVE_WHITE_FEMALE,
        LONGSLEEVE_WHITE: LONGSLEEVE_WHITE_FEMALE,
        LONGSLEEVE_TEAM: LONGSLEEVE_TEAM_FEMALE,
        SUSPENDERS_BLACK: SUSPENDERS_BLACK_FEMALE,
    }

    look = replace(look, **FEMALE_BASE_LOOK_OVERRIDES)
    override_unit = "infantry" if unit == "infantry_nohair" else unit
    overrides = FEMALE_CIV_UNIT_LOOK_OVERRIDES.get(civ_key, {}).get(override_unit)
    look = replace(look, **overrides) if overrides else look
    female_top = FEMALE_SLEEVELESS_VNECK if unit == "villager" else FEMALE_TANKTOP
    if look.dress:
        look = replace(look, dress=tuple(female_dress_map.get(item, item) for item in look.dress))
    if overrides and "dress" in overrides:
        return remove_hair(look) if unit == "infantry_nohair" else look
    look = replace(look, dress=(female_top, *look.dress))
    return remove_hair(look) if unit == "infantry_nohair" else look


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
# for east-facing sprites instead. Keep each retained row's animation complete.
SHEETS: tuple[Sheet, ...] = (
    Sheet(
        "walking",
        "walk",
        9,
        4,
        keep_every_other_frame=False,
        frame_indices=tuple(range(0, 27)),
    ),
    Sheet("action", "slash", 6, 3, keep_every_other_frame=False),
    Sheet(
        "shoot",
        "shoot",
        13,
        4,
        keep_every_other_frame=False,
        frame_indices=tuple(range(0, 39)),
    ),
    Sheet("spellcast", "spellcast", 7, 3, keep_every_other_frame=False),
    Sheet("dying", "hurt", 6, 1, keep_every_other_frame=False),
    Sheet("corpse", "hurt", 6, 1, False, (5,)),
)
