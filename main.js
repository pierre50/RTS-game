"use strict";
(self["webpackChunkdawn_of_empires"] = self["webpackChunkdawn_of_empires"] || []).push([[792],{

/***/ 6854
(__unused_webpack_module, __unused_webpack___webpack_exports__, __webpack_require__) {


// EXTERNAL MODULE: ./node_modules/.pnpm/pixi.js@8.18.1/node_modules/pixi.js/lib/index.mjs + 54 modules
var lib = __webpack_require__(9014);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js
var injectStylesIntoStyleTag = __webpack_require__(4368);
var injectStylesIntoStyleTag_default = /*#__PURE__*/__webpack_require__.n(injectStylesIntoStyleTag);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/styleDomAPI.js
var styleDomAPI = __webpack_require__(2769);
var styleDomAPI_default = /*#__PURE__*/__webpack_require__.n(styleDomAPI);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/insertBySelector.js
var insertBySelector = __webpack_require__(4987);
var insertBySelector_default = /*#__PURE__*/__webpack_require__.n(insertBySelector);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js
var setAttributesWithoutAttributes = __webpack_require__(5344);
var setAttributesWithoutAttributes_default = /*#__PURE__*/__webpack_require__.n(setAttributesWithoutAttributes);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/insertStyleElement.js
var insertStyleElement = __webpack_require__(1740);
var insertStyleElement_default = /*#__PURE__*/__webpack_require__.n(insertStyleElement);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.107.2/node_modules/style-loader/dist/runtime/styleTagTransform.js
var styleTagTransform = __webpack_require__(4633);
var styleTagTransform_default = /*#__PURE__*/__webpack_require__.n(styleTagTransform);
// EXTERNAL MODULE: ./node_modules/.pnpm/css-loader@7.1.4_webpack@5.107.2/node_modules/css-loader/dist/cjs.js!./app/styles.css
var styles = __webpack_require__(7172);
;// ./app/styles.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());
options.insert = insertBySelector_default().bind(null, "head");
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(styles/* default */.A, options);




       /* harmony default export */ const app_styles = (styles/* default */.A && styles/* default */.A.locals ? styles/* default */.A.locals : undefined);

;// ./app/lib/lang.js
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var TRANSLATIONS = {
  fr: {
    newGame: 'Nouvelle Partie',
    loadGame: 'Charger une Partie',
    configuration: 'Configuration',
    players: 'Joueurs',
    addOpponent: '+ Ajouter un adversaire',
    mapSettings: 'Paramètres de la Carte',
    back: '← Retour',
    startGame: 'Lancer la Partie',
    computer: 'Ordinateur',
    you: 'Vous',
    colName: 'Nom',
    colCiv: 'Civilisation',
    colColor: 'Couleur',
    mapSizeLabel: 'Taille de carte',
    mapTypeLabel: 'Type de carte',
    mapTypePlain: 'Plaine',
    mapTypeContinent: 'Continent',
    mapTypeLac: 'Lac central',
    mapTypeIlot: 'Îlots',
    aiDifficulty: 'Difficulté IA',
    startingResourcesLabel: 'Ressources de départ',
    devMode: 'Mode dev (instant build)',
    revealAll: 'Tout révéler',
    revealTerrain: 'Révéler le terrain',
    removePlayer: 'Retirer ce joueur',
    colorSwatch: 'Couleur : {color} (cliquer pour changer)',
    diffEasy: 'Facile  — IA lente, pop réduite',
    diffMedium: 'Moyen   — IA standard',
    diffHard: 'Difficile — IA rapide, pop accrue',
    resLow: 'Bas      — 100 / 150 / 50 / 0',
    resStandard: 'Standard — 200 / 200 / 150 / 0',
    resHigh: 'Élevé    — 500 / 500 / 300 / 0',
    resVeryHigh: 'Très élevé — 1000 / 1000 / 750 / 100',
    civGreek: 'Grecque',
    menuBtn: 'Menu',
    save: 'Sauvegarder',
    load: 'Charger',
    quit: 'Quitter',
    cancel: 'Annuler',
    pause: 'Pause',
    wood: 'bois',
    food: 'nourriture',
    stone: 'pierre',
    gold: 'or',
    needMore: 'Vous avez besoin de plus de {resource} !',
    loadingConfig: 'Chargement config..',
    loadingInterface: 'Chargement interface..',
    loadingTerrain: 'Chargement terrain..',
    loadingBorder: 'Chargement bordures..',
    loadingGraphics: 'Chargement graphismes..',
    loadingSounds: 'Chargement sons..',
    stoneAge: 'Âge de Pierre',
    toolAge: 'Âge des Outils',
    bronzeAge: 'Âge de Bronze',
    ironAge: 'Âge de Fer',
    needHouses: 'Vous devez construire plus de maisons',
    // Types affichés dynamiquement dans bottombar-info
    Greek: 'Grecque',
    Tree: 'Arbre',
    Berrybush: 'Buisson de baies',
    Stone: 'Pierre',
    Gold: 'Or',
    Salmon: 'Saumon',
    House: 'Maison',
    Dock: 'Quai',
    TownCenter: 'Centre-ville',
    Farm: 'Ferme',
    StoragePit: 'Entrepôt',
    Granary: 'Grenier',
    Barracks: 'Caserne',
    Market: 'Marché',
    ArcheryRange: "Champ de tir",
    Stable: 'Écurie',
    Academy: 'Académie',
    WatchTower: 'Tour de guet',
    SentryTower: 'Tour sentinelle',
    Villager: 'Villageois',
    Priest: 'Prêtre',
    Clubman: 'Gourdinier',
    fisher: 'Pêcheur',
    hunter: 'Chasseur',
    farmer: 'Fermier',
    forager: 'Cueilleur',
    woodcutter: 'Bûcheron',
    stoneminer: 'Mineur (pierre)',
    goldminer: 'Mineur (or)',
    builder: 'Constructeur',
    attacker: 'Attaquant',
    healer: 'Guérisseur'
  },
  en: {
    newGame: 'New Game',
    loadGame: 'Load Game',
    configuration: 'Configuration',
    players: 'Players',
    addOpponent: '+ Add opponent',
    mapSettings: 'Map Settings',
    back: '← Back',
    startGame: 'Start Game',
    computer: 'Computer',
    you: 'You',
    colName: 'Name',
    colCiv: 'Civilization',
    colColor: 'Color',
    mapSizeLabel: 'Map size',
    mapTypeLabel: 'Map type',
    mapTypePlain: 'Plain',
    mapTypeContinent: 'Continent',
    mapTypeLac: 'Central lake',
    mapTypeIlot: 'Islands',
    aiDifficulty: 'AI Difficulty',
    startingResourcesLabel: 'Starting Resources',
    devMode: 'Dev mode (instant build)',
    revealAll: 'Reveal everything',
    revealTerrain: 'Reveal terrain',
    removePlayer: 'Remove player',
    colorSwatch: 'Color: {color} (click to change)',
    diffEasy: 'Easy   — Slow AI, reduced pop',
    diffMedium: 'Medium — Standard AI',
    diffHard: 'Hard   — Fast AI, increased pop',
    resLow: 'Low      — 100 / 150 / 50 / 0',
    resStandard: 'Standard — 200 / 200 / 150 / 0',
    resHigh: 'High     — 500 / 500 / 300 / 0',
    resVeryHigh: 'Very High — 1000 / 1000 / 750 / 100',
    civGreek: 'Greek',
    menuBtn: 'Menu',
    save: 'Save',
    load: 'Load',
    quit: 'Quit',
    cancel: 'Cancel',
    pause: 'Pause',
    wood: 'wood',
    food: 'food',
    stone: 'stone',
    gold: 'gold',
    needMore: 'You need more {resource}!',
    loadingConfig: 'Loading config..',
    loadingInterface: 'Loading interface..',
    loadingTerrain: 'Loading terrain..',
    loadingBorder: 'Loading border..',
    loadingGraphics: 'Loading graphics..',
    loadingSounds: 'Loading sounds..',
    stoneAge: 'Stone Age',
    toolAge: 'Tool Age',
    bronzeAge: 'Bronze Age',
    ironAge: 'Iron Age',
    needHouses: 'You need to build more houses',
    // Types displayed dynamically in bottombar-info
    Greek: 'Greek',
    Tree: 'Tree',
    Berrybush: 'Berrybush',
    Stone: 'Stone',
    Gold: 'Gold',
    Salmon: 'Salmon',
    House: 'House',
    Dock: 'Dock',
    TownCenter: 'Town Center',
    Farm: 'Farm',
    StoragePit: 'Storage Pit',
    Granary: 'Granary',
    Barracks: 'Barracks',
    Market: 'Market',
    ArcheryRange: 'Archery Range',
    Stable: 'Stable',
    Academy: 'Academy',
    WatchTower: 'Watch Tower',
    SentryTower: 'Sentry Tower',
    Villager: 'Villager',
    Priest: 'Priest',
    Clubman: 'Clubman',
    fisher: 'Fisher',
    hunter: 'Hunter',
    farmer: 'Farmer',
    forager: 'Forager',
    woodcutter: 'Woodcutter',
    stoneminer: 'Stone Miner',
    goldminer: 'Gold Miner',
    builder: 'Builder',
    attacker: 'Attacker',
    healer: 'Healer'
  }
};
var currentLang = localStorage.getItem('lang') || 'fr';
function t(key, vars) {
  var _ref, _TRANSLATIONS$current;
  var str = (_ref = (_TRANSLATIONS$current = TRANSLATIONS[currentLang][key]) !== null && _TRANSLATIONS$current !== void 0 ? _TRANSLATIONS$current : TRANSLATIONS.en[key]) !== null && _ref !== void 0 ? _ref : key;
  if (vars) {
    Object.entries(vars).forEach(function (_ref2) {
      var _ref3 = _slicedToArray(_ref2, 2),
        k = _ref3[0],
        v = _ref3[1];
      str = str.replace("{".concat(k, "}"), v);
    });
  }
  return str;
}
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
}
function getLang() {
  return currentLang;
}
// EXTERNAL MODULE: ./node_modules/.pnpm/@pixi+sound@6.0.1_pixi.js@8.18.1/node_modules/@pixi/sound/lib/index.mjs + 29 modules
var sound_lib = __webpack_require__(2250);
;// ./app/constants/index.js
var CELL_WIDTH = 64;
var CELL_HEIGHT = 32;
var CELL_DEPTH = 16;
var ACCELERATOR = 1.5;
var STEP_TIME = 20;
var BUCKET_SIZE = 8;
var IS_MOBILE = window.innerWidth <= 800 && window.innerHeight <= 600;
var LONG_CLICK_DURATION = 200;
var RESOURCE_TYPES = {
  tree: 'Tree',
  berrybush: 'Berrybush',
  stone: 'Stone',
  gold: 'Gold',
  salmon: 'Salmon'
};
var BUILDING_TYPES = {
  house: 'House',
  dock: 'Dock',
  townCenter: 'TownCenter',
  farm: 'Farm',
  storagePit: 'StoragePit',
  granary: 'Granary',
  barracks: 'Barracks',
  market: 'Market',
  archeryRange: 'ArcheryRange',
  stable: 'Stable',
  academy: 'Academy',
  watchTower: 'WatchTower',
  sentryTower: 'SentryTower'
};
var UNIT_TYPES = {
  villager: 'Villager',
  priest: 'Priest',
  clubman: 'Clubman'
};
var MENU_INFO_IDS = {
  loading: 'loading',
  hitPoints: 'hit-points',
  population: 'population',
  populationText: 'population-text',
  quantity: 'quantity',
  quantityText: 'quantity-text',
  loadingText: 'loading-text',
  type: 'type',
  civ: 'civ',
  icon: 'icon'
};
var LABEL_TYPES = {
  sprite: 'sprite',
  color: 'color',
  deco: 'deco',
  fire: 'fire',
  selection: 'selection',
  buildingFog: 'building',
  mouseBuilding: 'mouseBuilding',
  floor: 'floor',
  set: 'set',
  dither: 'dither',
  fogOverlay: 'fogOverlay'
};
var SHEET_TYPES = {
  walking: 'walkingSheet',
  action: 'actionSheet',
  standing: 'standingSheet',
  corpse: 'corpseSheet',
  dying: 'dyingSheet',
  harvest: 'harvestSheet'
};
var PLAYER_TYPES = {
  human: 'Human',
  ai: 'AI',
  gaia: 'Gaia'
};
var FAMILY_TYPES = {
  animal: 'animal',
  building: 'building',
  cell: 'cell',
  projectile: 'projectile',
  resource: 'resource',
  unit: 'unit',
  player: 'player'
};
var WORK_TYPES = {
  fisher: 'fisher',
  hunter: 'hunter',
  farmer: 'farmer',
  forager: 'forager',
  woodcutter: 'woodcutter',
  stoneminer: 'stoneminer',
  goldminer: 'goldminer',
  builder: 'builder',
  attacker: 'attacker',
  healer: 'healer'
};
var ACTION_TYPES = {
  delivery: 'delivery',
  takemeat: 'takemeat',
  hunt: 'hunt',
  attack: 'attack',
  fishing: 'fishing',
  build: 'build',
  farm: 'farm',
  forageberry: 'forageberry',
  minegold: 'minegold',
  minestone: 'minestone',
  chopwood: 'chopwood',
  heal: 'heal'
};
var LOADING_TYPES = {
  meat: 'meat',
  wheat: 'wheat',
  berry: 'berry',
  fish: 'fish',
  stone: 'stone',
  gold: 'gold',
  wood: 'wood'
};
var WORK_FOOD_TYPES = [WORK_TYPES.fisher, WORK_TYPES.hunter, WORK_TYPES.farmer, WORK_TYPES.forager];
var LOADING_FOOD_TYPES = [LOADING_TYPES.meat, LOADING_TYPES.wheat, LOADING_TYPES.berry, LOADING_TYPES.fish];
var COLOR_WHITE = 0xffffff;
var COLOR_BLACK = 0x000000;
var COLOR_GREY = 0x808080;
var COLOR_RED = 0xff0000;
var COLOR_ORANGE = 0xffa500;
var COLOR_YELLOW = 0xffff00;
var COLOR_GREEN = 0x008000;
var COLOR_BLUE = 0x0000ff;
var COLOR_INDIGO = 0x4b0082;
var COLOR_VIOLET = 0xee82ee;
var COLOR_BONE = 0xe2dac2;
var COLOR_SHIP_GREY = 0x3c3b3d;
var COLOR_FOG = 0x999999;
var COLOR_FLASHY_GREEN = 0x00ff00;
var COLOR_ARROW = 0xe8e3df;
var TYPE_ACTION = {
  Stone: ACTION_TYPES.minestone,
  Gold: ACTION_TYPES.minegold,
  Berrybush: ACTION_TYPES.forageberry,
  Tree: ACTION_TYPES.chopwood,
  Fish: ACTION_TYPES.fishing
};
var CORPSE_TIME = 120;
var RUBBLE_TIME = 120;
var MAX_SELECT_UNITS = 10;
var POPULATION_MAX = 200;
// EXTERNAL MODULE: ./node_modules/.pnpm/pixi-filters@6.1.5_pixi.js@8.18.1/node_modules/pixi-filters/lib/multi-color-replace/MultiColorReplaceFilter.mjs + 4 modules
var MultiColorReplaceFilter = __webpack_require__(2973);
;// ./app/lib/graphics.js
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function graphics_slicedToArray(r, e) { return graphics_arrayWithHoles(r) || graphics_iterableToArrayLimit(r, e) || graphics_unsupportedIterableToArray(r, e) || graphics_nonIterableRest(); }
function graphics_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function graphics_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return graphics_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? graphics_arrayLikeToArray(r, a) : void 0; } }
function graphics_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function graphics_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function graphics_arrayWithHoles(r) { if (Array.isArray(r)) return r; }




function getIconPath(name) {
  var id = name.split('_')[1];
  var index = name.split('_')[0];
  return "assets/interface/".concat(id, "/").concat(index, "_").concat(id, ".png");
}
function getBuildingTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_256';
    case 2:
      return '000_258';
    case 3:
      return '000_261';
  }
}
function getBuildingRubbleTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_153';
    case 2:
      return '000_154';
    case 3:
      return '000_155';
  }
}
function getBuildingAsset(type, owner, assets) {
  var _path$owner$age, _path, _path2, _path$;
  var path = assets.cache.get(owner.civ.toLowerCase()).buildings;
  if ((_path$owner$age = path[owner.age]) !== null && _path$owner$age !== void 0 && _path$owner$age[type]) {
    return path[owner.age][type];
  } else if (owner.age >= 1 && (_path = path[owner.age - 1]) !== null && _path !== void 0 && _path[type]) {
    return path[owner.age - 1][type];
  } else if (owner.age >= 2 && (_path2 = path[owner.age - 2]) !== null && _path2 !== void 0 && _path2[type]) {
    return path[owner.age - 2][type];
  } else if ((_path$ = path[0]) !== null && _path$ !== void 0 && _path$[type]) {
    return path[0][type];
  }
}

/**
 * Retrieve a texture from the assets cache based on its name.
 *
 * @param {string} name - The name of the texture, formatted as 'index_id'.
 * @param {object} assets - The assets object containing the cache of textures.
 * @returns {object} - The requested texture from the spritesheet.
 * @throws {Error} - If the texture cannot be found in the spritesheet.
 */
function getTexture(name, assets) {
  var _name$split = name.split('_'),
    _name$split2 = graphics_slicedToArray(_name$split, 2),
    index = _name$split2[0],
    id = _name$split2[1];
  var spritesheet = assets.cache.get(id);
  if (!spritesheet || !spritesheet.textures) {
    throw new Error("Spritesheet for ID \"".concat(id, "\" not found in assets."));
  }
  var textureName = "".concat(index, "_").concat(id, ".png");
  var texture = spritesheet.textures[textureName];
  if (!texture) {
    throw new Error("Texture \"".concat(textureName, "\" not found in spritesheet."));
  }

  // Set the hit area for the texture
  texture.hitArea = spritesheet.data.frames[textureName].hitArea;
  return texture;
}
var colors = ['blue', 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan'];

// Shared source colors (blue palette to replace)
var SOURCE_COLORS = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057];

// Shared target color palettes per color name
var COLOR_PALETTES = {
  red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
  yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
  brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
  orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
  green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
  grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
  cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327]
};
var HEX_COLOR_MAP = {
  blue: '#3f5f9f',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#ef6307',
  green: '#4b6b2b',
  grey: '#8f8f8f',
  cyan: '#00837b'
};

/**
 * Get the hex color code for a given color name.
 * @param {string} name - The name of the color.
 * @returns {string} The hex color code, or '#ffffff' if the color is not found.
 */
function getHexColor(name) {
  return HEX_COLOR_MAP[name] || '#ffffff';
}

/**
 * Change the color of a sprite directly by manipulating its texture.
 * @param {object} sprite - The sprite to change the color of.
 * @param {string} color - The new color to apply to the sprite.
 */
// Cache for recolored textures: key = `${textureName}_${color}`
var recoloredTextureCache = new Map();
function changeSpriteColorDirectly(sprite, color) {
  var _sprite$texture$textu, _sprite$texture$textu2;
  if (color === 'blue') return;
  var targetColors = COLOR_PALETTES[color];
  if (!targetColors) {
    throw new Error('Invalid color selected.');
  }
  var frame = sprite.texture.frame;
  var cacheKey = "".concat((_sprite$texture$textu = (_sprite$texture$textu2 = sprite.texture.textureCacheIds) === null || _sprite$texture$textu2 === void 0 ? void 0 : _sprite$texture$textu2[0]) !== null && _sprite$texture$textu !== void 0 ? _sprite$texture$textu : "".concat(frame.x, "_").concat(frame.y), "_").concat(color);
  if (recoloredTextureCache.has(cacheKey)) {
    sprite.texture = recoloredTextureCache.get(cacheKey);
    return;
  }
  var baseTexture = sprite.texture.source.resource;
  var canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(baseTexture, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var sourceColorMap = new Map(SOURCE_COLORS.map(function (src, i) {
    return [src, targetColors[i]];
  }));
  for (var i = 0; i < data.length; i += 4) {
    var rgb = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
    var targetColor = sourceColorMap.get(rgb);
    if (targetColor !== undefined) {
      data[i] = targetColor >> 16 & 0xff;
      data[i + 1] = targetColor >> 8 & 0xff;
      data[i + 2] = targetColor & 0xff;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  var newTexture = lib/* Texture */.gPd.from(canvas);
  recoloredTextureCache.set(cacheKey, newTexture);
  sprite.texture = newTexture;
}

/**
 * Change the color of a sprite based on the specified color.
 *
 * @param {object} sprite - The sprite object whose color will be changed.
 * @param {string} color - The target color. Supported colors: 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan'.
 * @returns {void}
 */
// Cache for MultiColorReplaceFilter instances, one per color
var colorFilterCache = new Map();
function changeSpriteColor(sprite, color) {
  if (color === 'blue') return;
  if (!COLOR_PALETTES[color]) return;
  if (!colorFilterCache.has(color)) {
    var replacements = SOURCE_COLORS.map(function (src, i) {
      return [src, COLOR_PALETTES[color][i]];
    });
    colorFilterCache.set(color, new MultiColorReplaceFilter/* MultiColorReplaceFilter */.N({
      replacements: replacements,
      tolerance: 0.1
    }));
  }
  sprite.filters = [colorFilterCache.get(color)];
}

/**
 * Draws a blinking selection around the given instance.
 * @param {object} instance - The instance to draw the selection around.
 */
function drawInstanceBlinkingSelection(instance) {
  var selection = new lib/* Graphics */.A1g();
  selection.label = LABEL_TYPES.selection;
  selection.zIndex = 3;

  // Define the path for the selection
  var path = [-32 * instance.size, 0, 0, -16 * instance.size, 32 * instance.size, 0, 0, 16 * instance.size];
  selection.poly(path);
  selection.stroke(COLOR_FLASHY_GREEN);
  instance.addChildAt(selection, 0);

  // Helper function for blinking effect
  var blink = function blink(alpha, duration) {
    return new Promise(function (resolve) {
      selection.alpha = alpha;
      setTimeout(resolve, duration);
    });
  };
  var blinkSequence = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
      return _regenerator().w(function (_context) {
        while (1) switch (_context.n) {
          case 0:
            _context.n = 1;
            return blink(1, 500);
          case 1:
            _context.n = 2;
            return blink(0, 300);
          case 2:
            _context.n = 3;
            return blink(1, 300);
          case 3:
            _context.n = 4;
            return blink(0, 300);
          case 4:
            _context.n = 5;
            return blink(1, 300);
          case 5:
            // Show
            instance.removeChild(selection); // Clean up
          case 6:
            return _context.a(2);
        }
      }, _callee);
    }));
    return function blinkSequence() {
      return _ref.apply(this, arguments);
    };
  }();
  blinkSequence();
}
/**
 * Draw a filled rectangle on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the rectangle's top-left corner.
 * @param {number} y - The y-coordinate of the rectangle's top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @param {string} color - The fill color for the rectangle.
 */
function canvasDrawRectangle(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

/**
 * Draw a stroked rectangle on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the rectangle's top-left corner.
 * @param {number} y - The y-coordinate of the rectangle's top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @param {string} color - The stroke color for the rectangle.
 */
function canvasDrawStrokeRectangle(context, x, y, width, height, color) {
  context.strokeStyle = color;
  context.strokeRect(x, y, width, height);
}

/**
 * Draw a diamond shape on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the diamond's center.
 * @param {number} y - The y-coordinate of the diamond's center.
 * @param {number} width - The width of the diamond.
 * @param {number} height - The height of the diamond.
 * @param {string} color - The fill color for the diamond.
 */
function canvasDrawDiamond(context, x, y, width, height, color) {
  context.save();
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - width / 2, y + height / 2);
  context.lineTo(x, y + height);
  context.lineTo(x + width / 2, y + height / 2);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore(); // Restore the context state
}

/**
 * Execute a callback when a sprite reaches a specific frame.
 * @param {object} sprite - The sprite to monitor.
 * @param {number} frame - The target frame to trigger the callback.
 * @param {function} cb - The callback to execute.
 */
function onSpriteLoopAtFrame(sprite, frame, cb) {
  var prev = sprite.onFrameChange;
  sprite.onFrameChange = function (currentFrame) {
    prev === null || prev === void 0 || prev(currentFrame);
    if (currentFrame === frame) cb();
  };
}
;// ./app/lib/accounting.js
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/**
 * Refunds costs to the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to refund.
 */
function refundCost(player, cost) {
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') return;
  for (var prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      player[prop] = (player[prop] || 0) + cost[prop];
    }
  }
}

/**
 * Deducts costs from the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to pay.
 */
function payCost(player, cost) {
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') return;
  for (var prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      player[prop] = (player[prop] || 0) - cost[prop];
    }
  }
}

/**
 * Checks if the player can afford the given costs.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to check.
 * @returns {boolean} - True if the player can afford the costs, false otherwise.
 */
function canAfford(player, cost) {
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') return false;
  for (var prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      if ((player[prop] || 0) < cost[prop]) return false;
    }
  }
  return true;
}
;// ./app/lib/maths.js
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || maths_unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function maths_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return maths_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? maths_arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return maths_arrayLikeToArray(r); }
function maths_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }

var HALF_CELL_WIDTH = CELL_WIDTH / 2;
var HALF_CELL_HEIGHT = CELL_HEIGHT / 2;
var DEG_TO_RAD = Math.PI / 180;

/**
 * Generate a version 4 UUID.
 * @returns {string} - A random UUID.
 */
function uuidv4() {
  var bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 0x0f | 0x40;
  bytes[8] = bytes[8] & 0x3f | 0x80;
  return _toConsumableArray(bytes).map(function (b, i) {
    return ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Format a number with three character
 * @param {number} nbr
 */
function formatNumber(nbr) {
  return ('00' + nbr).slice(-3);
}

/**
 * Convert cartesian to isometric
 * @param {number} x
 * @param {number} y
 */
function cartesianToIsometric(x, y) {
  return [Math.floor((x - y) * CELL_WIDTH / 2), Math.floor((x + y) * CELL_HEIGHT / 2)];
}

/**
 * Convert isometric position to cartesian
 * @param {number} x
 * @param {number} y
 */
function isometricToCartesian(x, y) {
  return [Math.round((x / HALF_CELL_WIDTH + y / HALF_CELL_HEIGHT) / 2), Math.round((y / HALF_CELL_HEIGHT - x / HALF_CELL_WIDTH) / 2)];
}

/**
 * Get percentage with two numbers
 * @param {number} a
 * @param {number} b
 */
function getPercentage(a, b) {
  return Math.floor(a / b * 100);
}

/**
 * Get value of percentage
 * @param {number} a
 * @param {number} b
 */
function getValuePercentage(val, perc) {
  return Math.floor(perc * val / 100);
}

/**
 * Get average between two numbers
 * @param {number} a
 * @param {number} b
 */
function average(a, b) {
  return (a + b) / 2;
}

/**
 * Check if point is between two points can be used with line thickness
 * @param {object} line1
 * @param {object} line2
 * @param {object} pnt
 * @param {number} lineThickness
 */
/**
 * Check if a point is within a certain distance from a line segment
 * @param {{x:number, y:number}} line1 - Start point of the line
 * @param {{x:number, y:number}} line2 - End point of the line
 * @param {{x:number, y:number}} pnt - Point to check
 * @param {number} lineThickness - Maximum allowed distance from the line
 * @returns {boolean}
 */
function pointIsBetweenTwoPoint(line1, line2, pnt, lineThickness) {
  var dx = line2.x - line1.x;
  var dy = line2.y - line1.y;
  var L2 = dx * dx + dy * dy;
  if (L2 === 0) {
    // line1 == line2
    var dist = Math.hypot(line1.x - pnt.x, line1.y - pnt.y);
    return dist <= lineThickness;
  }

  // Projection parameter
  var r = ((pnt.x - line1.x) * dx + (pnt.y - line1.y) * dy) / L2;
  if (r < 0) {
    return Math.hypot(line1.x - pnt.x, line1.y - pnt.y) <= lineThickness;
  } else if (r > 1) {
    return Math.hypot(line2.x - pnt.x, line2.y - pnt.y) <= lineThickness;
  } else {
    // Perpendicular distance from point to line
    var s = ((line1.y - pnt.y) * dx - (line1.x - pnt.x) * dy) / L2;
    return s * s * L2 <= lineThickness * lineThickness;
  }
}

/**
 * Get a random number between two numbers
 * @param {number} min
 * @param {number} max
 */
function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Get a random item from a array
 * @param {array} array
 */
function maths_randomItem() {
  var array = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get distance between two instances, can use iso (x, y) or cartesian (i, j)
 * @param {object} a
 * @param {object} b
 * @param {boolean} useCartesian
 */
function instancesDistance(a, b) {
  var useCartesian = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  return useCartesian ? pointsDistance(a.i, a.j, b.i, b.j) : pointsDistance(a.x, a.y, b.x, b.y);
}

/**
 * Get the instance zIndex according to his position
 * @param {object} instance
 */
function getInstanceZIndex(instance) {
  var pos = isometricToCartesian(instance.x, instance.y + instance.z * CELL_DEPTH);
  return pos[0] + pos[1];
}

/**
 * Get the difference between two number
 * @param {number} a
 * @param {number} b
 */
function diff(a, b) {
  return Math.abs(a - b);
}

/**
 * Get degree of instance according to a point
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 */
function getInstanceDegree(instance, x, y) {
  return getPointsDegree(instance.x, instance.y, x, y);
}

/**
 * Get the degree from one point to another.
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @returns {number} - The angle in degrees from the first point to the second.
 */
function getPointsDegree(x1, y1, x2, y2) {
  var tX = x2 - x1;
  var tY = y2 - y1;
  return Math.round(Math.atan2(tY, tX) * 180 / Math.PI + 180);
}

/**
 * Convert degrees to radians.
 * @param {number} degrees - The angle in degrees.
 * @returns {number} - The angle in radians.
 */
function degreesToRadians(degrees) {
  return degrees * DEG_TO_RAD;
}

/**
 * Get distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function pointsDistance(x1, y1, x2, y2) {
  var a = x1 - x2;
  var b = y1 - y2;
  return Math.floor(Math.sqrt(a * a + b * b));
}

/**
 * Check if point is in a rectangle or not
 * @param {number} x
 * @param {number} y
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 */
function pointInRectangle(x, y, left, top, width, height) {
  var allDirection = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : false;
  return allDirection ? x > left && x < left + width && y > top && y < top + height || x < left && x > left + width && y < top && y > top + height || x > left && x < left + width && y < top && y > top + height || x < left && x > left + width && y > top && y < top + height : x > left && x < left + width && y > top && y < top + height;
}

/**
 * Check if two instance are on diagonal axes
 * @param {object} instance
 * @param {object} instance
 */
function cellIsDiag(src, target) {
  return Math.abs(target.i - src.i) === Math.abs(target.j - src.j);
}
function degreeToDirection(degree) {
  if (degree > 67.5 && degree < 112.5) {
    return 'north';
  } else if (degree > 247.5 && degree < 292.5) {
    return 'south';
  } else if (degree > 337.5 || degree < 22.5) {
    return 'west';
  } else if (degree >= 22.5 && degree <= 67.5) {
    return 'northwest';
  } else if (degree >= 292.5 && degree <= 337.5) {
    return 'southwest';
  } else if (degree > 157.5 && degree < 202.5) {
    return 'east';
  } else if (degree > 112.5 && degree < 157.5) {
    return 'northeast';
  } else if (degree > 202.5 && degree < 247.5) {
    return 'southeast';
  }
}
;// ./app/services/FogOfWar.js
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = FogOfWar_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function FogOfWar_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return FogOfWar_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? FogOfWar_arrayLikeToArray(r, a) : void 0; } }
function FogOfWar_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }

function getPlainCellsAroundPoint(startX, startY, grid) {
  var dist = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var callback = arguments.length > 4 ? arguments[4] : undefined;
  var result = [];
  if (dist === 0) {
    var row = grid[startX];
    if (row) {
      var cell = row[startY];
      if (cell && (!callback || callback(cell))) result.push(cell);
    }
    return result;
  }
  var minX = Math.max(startX - dist, 0);
  var maxX = Math.min(startX + dist, grid.length - 1);
  for (var i = minX; i <= maxX; i++) {
    var _row = grid[i];
    if (!_row) continue;
    var minY = Math.max(startY - dist, 0);
    var maxY = Math.min(startY + dist, _row.length - 1);
    for (var j = minY; j <= maxY; j++) {
      var _cell = _row[j];
      if (_cell && (!callback || callback(_cell))) result.push(_cell);
    }
  }
  return result;
}
function updateAIKnowledge(globalCell, cell, instance) {
  var owner = instance.owner;
  if (globalCell.has && (!cell.has || cell.has.label !== globalCell.has.label)) {
    cell.has = globalCell.has;
    var has = globalCell.has;
    if (has.quantity > 0) {
      var _owner$foundedFish;
      if (has.type === RESOURCE_TYPES.tree) owner.foundedTrees.add(has);
      if (has.type === RESOURCE_TYPES.berrybush) owner.foundedBerrybushs.add(has);
      if (has.type === RESOURCE_TYPES.stone) owner.foundedStones.add(has);
      if (has.type === RESOURCE_TYPES.gold) owner.foundedGolds.add(has);
      if (has.type === RESOURCE_TYPES.salmon) (_owner$foundedFish = owner.foundedFish) === null || _owner$foundedFish === void 0 || _owner$foundedFish.add(has);
    }
    if (has.family === FAMILY_TYPES.animal && !has.isDead && owner.foundedAnimals) {
      owner.foundedAnimals.add(has);
    }
    if (has.family === FAMILY_TYPES.building && has.hitPoints > 0 && has.owner.label !== owner.label) {
      owner.foundedEnemyBuildings.add(has);
    }
    if (has.family === FAMILY_TYPES.unit && has.hitPoints > 0 && has.owner && has.owner.label !== owner.label) {
      owner.foundedEnemyUnits.add(has);
    }
  }
}
function updateVisibility(instance) {
  var _instance$visibleCell, _instance$_visibleScr;
  var cx = instance.i,
    cy = instance.j,
    sight = instance.sight,
    owner = instance.owner,
    context = instance.context,
    isDead = instance.isDead;
  var map = context.map;
  var player = context.player;
  var sightSq = sight * sight;
  var prevVisible = (_instance$visibleCell = instance.visibleCells) !== null && _instance$visibleCell !== void 0 ? _instance$visibleCell : new Set();
  var newVisible = (_instance$_visibleScr = instance._visibleScratch) !== null && _instance$_visibleScr !== void 0 ? _instance$_visibleScr : new Set();
  newVisible.clear();
  if (!isDead) {
    getPlainCellsAroundPoint(cx, cy, owner.views, sight, function (cell) {
      var dx = cell.i - cx;
      var dy = cell.j - cy;
      if (dx * dx + dy * dy <= sightSq) {
        newVisible.add(cell);
      }
    });
  }
  var _iterator = _createForOfIteratorHelper(prevVisible),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var cell = _step.value;
      if (!newVisible.has(cell)) {
        var playerCell = player.views[cell.i][cell.j];
        var globalCell = map.grid[cell.i][cell.j];
        globalCell.viewBy["delete"](instance);
        cell.viewBy["delete"](instance);
        if (!playerCell.viewBy.size && !map.revealEverything) {
          globalCell.setFog();
        }
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  var _iterator2 = _createForOfIteratorHelper(newVisible),
    _step2;
  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var _cell2 = _step2.value;
      if (!prevVisible.has(_cell2)) {
        var _globalCell = map.grid[_cell2.i][_cell2.j];
        _globalCell.updateVisible();
        _globalCell.viewBy.add(instance);
        _cell2.viewBy.add(instance);
        if (!_cell2.viewed) {
          var _cell2$onViewed;
          owner.cellViewed++;
          (_cell2$onViewed = _cell2.onViewed) === null || _cell2$onViewed === void 0 || _cell2$onViewed.call(_cell2);
          _cell2.viewed = true;
        }
        if (!map.revealEverything && owner.isPlayed) {
          _globalCell.removeFog();
        } else if (owner.type === PLAYER_TYPES.ai) {
          updateAIKnowledge(_globalCell, _cell2, instance);
        }
        if (_globalCell.has && _globalCell.has.sight && typeof _globalCell.has.detect === 'function') {
          var distSq = Math.pow(cx - _globalCell.has.i, 2) + Math.pow(cy - _globalCell.has.j, 2);
          if (distSq <= Math.pow(_globalCell.has.sight, 2)) {
            _globalCell.has.detect(instance);
          }
        }
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }
  instance.visibleCells = newVisible;
  instance._visibleScratch = prevVisible;
}
;// ./app/services/Pathfinding.js
function Pathfinding_slicedToArray(r, e) { return Pathfinding_arrayWithHoles(r) || Pathfinding_iterableToArrayLimit(r, e) || Pathfinding_unsupportedIterableToArray(r, e) || Pathfinding_nonIterableRest(); }
function Pathfinding_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function Pathfinding_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function Pathfinding_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function Pathfinding_toConsumableArray(r) { return Pathfinding_arrayWithoutHoles(r) || Pathfinding_iterableToArray(r) || Pathfinding_unsupportedIterableToArray(r) || Pathfinding_nonIterableSpread(); }
function Pathfinding_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function Pathfinding_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return Pathfinding_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? Pathfinding_arrayLikeToArray(r, a) : void 0; } }
function Pathfinding_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function Pathfinding_arrayWithoutHoles(r) { if (Array.isArray(r)) return Pathfinding_arrayLikeToArray(r); }
function Pathfinding_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }

var pathStamp = 0;
var heapData = [];
var openSet = new Set();
var closedSet = new Set();
function getNeighbourCells(startX, startY, grid, dist, callback) {
  var _grid$startX;
  var result = [];
  var startCell = (_grid$startX = grid[startX]) === null || _grid$startX === void 0 ? void 0 : _grid$startX[startY];
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell);
    return result;
  }
  for (var dx = -dist; dx <= dist; dx++) {
    var x = startX + dx;
    var row = grid[x];
    if (!row) continue;
    var dyMax = dist - Math.abs(dx);
    for (var dy = -dyMax; dy <= dyMax; dy++) {
      var y = startY + dy;
      var cell = row[y];
      if (!cell) continue;
      if (!callback || callback(cell)) result.push(cell);
    }
  }
  return result;
}
function heapPush(f, node) {
  heapData.push([f, node]);
  var i = heapData.length - 1;
  while (i > 0) {
    var parent = i - 1 >> 1;
    if (heapData[parent][0] <= heapData[i][0]) break;
    var _ref = [heapData[i], heapData[parent]];
    heapData[parent] = _ref[0];
    heapData[i] = _ref[1];
    i = parent;
  }
}
function heapPop() {
  var top = heapData[0];
  var last = heapData.pop();
  if (heapData.length > 0) {
    heapData[0] = last;
    var i = 0;
    while (true) {
      var l = 2 * i + 1;
      var r = 2 * i + 2;
      var s = i;
      if (l < heapData.length && heapData[l][0] < heapData[s][0]) s = l;
      if (r < heapData.length && heapData[r][0] < heapData[s][0]) s = r;
      if (s === i) break;
      var _ref2 = [heapData[i], heapData[s]];
      heapData[s] = _ref2[0];
      heapData[i] = _ref2[1];
      i = s;
    }
  }
  return top;
}
function findInstancePath(instance, x, y, map) {
  var maxZone = 10;
  var end = map.grid[x][y];
  var start = map.grid[instance.i][instance.j];
  var minX = Math.max(Math.min(start.i, end.i) - maxZone, 0);
  var maxX = Math.min(Math.max(start.i, end.i) + maxZone, map.size);
  var minY = Math.max(Math.min(start.j, end.j) - maxZone, 0);
  var maxY = Math.min(Math.max(start.j, end.j) + maxZone, map.size);
  var stamp = ++pathStamp;
  function initCell(cell) {
    if (cell._ps !== stamp) {
      cell._ps = stamp;
      cell._g = Infinity;
      cell._h = 0;
      cell._f = Infinity;
      cell._prev = null;
    }
    return cell;
  }
  function isCellReachable(cell) {
    if (cell.solid) return false;
    var allowWaterCellCategory = instance.category === 'Boat';
    return allowWaterCellCategory ? cell.category === 'Water' : cell.category !== 'Water';
  }
  var startCell = initCell(start);
  var endCell = initCell(end);
  heapData.length = 0;
  openSet.clear();
  closedSet.clear();
  startCell._g = 0;
  startCell._h = instancesDistance(startCell, endCell);
  startCell._f = startCell._h;
  heapPush(startCell._f, startCell);
  openSet.add(startCell);
  var path = [];
  var _loop = function _loop() {
      var _heapPop = heapPop(),
        _heapPop2 = Pathfinding_slicedToArray(_heapPop, 2),
        pushedF = _heapPop2[0],
        current = _heapPop2[1];
      if (pushedF !== current._f || closedSet.has(current)) return 0; // continue
      if (current === endCell) {
        path = [endCell];
        var temp = current;
        while (temp._prev) {
          path.push(temp._prev);
          temp = temp._prev;
        }
        return 1; // break
      }
      openSet["delete"](current);
      closedSet.add(current);
      getNeighbourCells(current.i, current.j, map.grid, 1, function (neighbour) {
        if (neighbour.i < minX || neighbour.i > maxX || neighbour.j < minY || neighbour.j > maxY) return;
        initCell(neighbour);
        var validDiag = !cellIsDiag(current, neighbour) || isCellReachable(map.grid[current.i][neighbour.j]) && isCellReachable(map.grid[neighbour.i][current.j]);
        if (!closedSet.has(neighbour) && isCellReachable(neighbour) && validDiag) {
          var tempG = current._g + instancesDistance(neighbour, current);
          if (!openSet.has(neighbour)) {
            neighbour._g = tempG;
            neighbour._h = instancesDistance(neighbour, endCell);
            neighbour._f = neighbour._g + neighbour._h;
            neighbour._prev = current;
            openSet.add(neighbour);
            heapPush(neighbour._f, neighbour);
          } else if (tempG < neighbour._g) {
            neighbour._g = tempG;
            neighbour._f = neighbour._g + neighbour._h;
            neighbour._prev = current;
            heapPush(neighbour._f, neighbour);
          }
        }
      });
    },
    _ret;
  while (heapData.length > 0) {
    _ret = _loop();
    if (_ret === 0) continue;
    if (_ret === 1) break;
  }
  path.pop();
  return Pathfinding_toConsumableArray(path);
}
;// ./app/lib/grid.js
function grid_toConsumableArray(r) { return grid_arrayWithoutHoles(r) || grid_iterableToArray(r) || grid_unsupportedIterableToArray(r) || grid_nonIterableSpread(); }
function grid_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function grid_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function grid_arrayWithoutHoles(r) { if (Array.isArray(r)) return grid_arrayLikeToArray(r); }
function grid_slicedToArray(r, e) { return grid_arrayWithHoles(r) || grid_iterableToArrayLimit(r, e) || grid_unsupportedIterableToArray(r, e) || grid_nonIterableRest(); }
function grid_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function grid_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function grid_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function grid_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = grid_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function grid_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return grid_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? grid_arrayLikeToArray(r, a) : void 0; } }
function grid_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }





/**
 * Check if two instances are in contact.
 *
 * @param {object} a - The first instance. Should have properties like `x`, `y`, and `size`.
 * @param {object} b - The second instance. Should have properties like `x`, `y`, `size`, and `isDestroyed`.
 * @returns {boolean} - True if instance `a` is in contact with instance `b`, false otherwise.
 */
function instanceContactInstance(a, b) {
  // Check if the distance between instances is less than or equal to (b.size - 1) and b is not destroyed
  return Math.floor(instancesDistance(a, b)) <= (b.size - 1 || 1) && !b.isDestroyed;
}

/**
 * Move an instance towards a specific point (x, y) at a given speed.
 *
 * @param {object} instance - The instance to move. Should have properties like `x`, `y`, and `degree`.
 * @param {number} x - The target x-coordinate to move towards.
 * @param {number} y - The target y-coordinate to move towards.
 * @param {number} speed - The speed at which the instance should move.
 */
function moveTowardPoint(instance, x, y, speed) {
  var dist = pointsDistance(x, y, instance.x, instance.y);
  if (dist === 0) return; // Prevent division by zero

  // Calculate the direction vector from the instance to the target point
  var tX = x - instance.x;
  var tY = y - instance.y;

  // Calculate the velocity based on the speed and distance
  var velX = tX / dist * (speed * ACCELERATOR);
  var velY = tY / dist * (speed * ACCELERATOR);

  // Update the instance's degree (rotation) to face the target point
  instance.degree = getInstanceDegree(instance, x, y);

  // Update the instance's position by adding the velocity components
  instance.x += velX;
  instance.y += velY;
}

/**
 * Get the first free cell coordinate around a point
 * @param {number} x - The x-coordinate of the starting point
 * @param {number} y - The y-coordinate of the starting point
 * @param {number} size - The starting search radius
 * @param {object} grid - The grid to search in
 * @param {function} condition - A function to test if a cell is free
 * @returns {object|null} - The coordinates of the first free cell or null if none found
 */
function getFreeCellAroundPoint(x, y, size, grid, condition) {
  var maxDistance = 50;
  for (var distance = size; distance < maxDistance; distance++) {
    var cells = getCellsAroundPoint(x, y, grid, distance, condition);
    if (cells.length > 0) {
      return maths_randomItem(cells);
    }
  }
  return null;
}

/**
 * Get the closest available path for an instance to a destination
 * @param {object} instance - The instance seeking a path
 * @param {object} target - The target object to reach
 * @param {object} map - The map containing grid information
 * @returns {Array} - The shortest path to a free cell or an empty array if none found
 */
function getInstanceClosestFreeCellPath(instance, target, map) {
  var size = target.size || target.has && target.has.size || 1;
  var distance = size === 3 ? 2 : 1;
  var candidates = getCellsAroundPoint(target.i, target.j, map.grid, distance);
  candidates.sort(function (a, b) {
    return Math.abs(a.i - instance.i) + Math.abs(a.j - instance.j) - (Math.abs(b.i - instance.i) + Math.abs(b.j - instance.j));
  });
  var best = [];
  var _iterator = grid_createForOfIteratorHelper(candidates),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var cell = _step.value;
      if (best.length && Math.abs(cell.i - instance.i) + Math.abs(cell.j - instance.j) >= best.length) break;
      var path = getInstancePath(instance, cell.i, cell.j, map);
      if (path.length && (!best.length || path.length < best.length)) best = path;
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return best;
}

/**
 * Get the shortest path for a instance to a destination
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 * @param {object} map
 */
function getInstancePath(instance, x, y, map) {
  return findInstancePath(instance, x, y, map);
}

/**
 * Find a sized zone in the grid that meets a condition.
 *
 * This function searches within a given zone in the grid for a region of the specified `size`,
 * and checks whether all cells within that region meet a specified condition.
 *
 * @param {object} zone - An object containing the boundaries of the search area (minX, maxX, minY, maxY).
 * @param {object[][]} grid - A 2D grid representing the map.
 * @param {number} size - The size of the area to check around each grid point.
 * @param {function} condition - A callback function that evaluates whether a cell is valid.
 * @returns {object|null} The coordinates {i, j} of the first valid zone found, or null if none are found.
 */
function getZoneInGridWithCondition(zone, grid, size, condition) {
  // Iterate over the specified zone in the grid
  for (var i = zone.minX; i <= zone.maxX; i++) {
    if (!grid[i]) continue; // Skip if out of bounds

    for (var j = zone.minY; j <= zone.maxY; j++) {
      var _grid$i;
      var cell = (_grid$i = grid[i]) === null || _grid$i === void 0 ? void 0 : _grid$i[j];
      if (!cell) continue; // Skip if cell doesn't exist

      // Assume the area around (i, j) is free initially
      var isFree = true;

      // Check the surrounding cells of size `size` to ensure they all meet the condition
      var surroundingCells = grid_getPlainCellsAroundPoint(i, j, grid, size);
      var _iterator2 = grid_createForOfIteratorHelper(surroundingCells),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var surroundingCell = _step2.value;
          if (!condition(surroundingCell)) {
            isFree = false;
            break; // Exit early if a cell does not meet the condition
          }
        }

        // Return the first valid {i, j} coordinates if the area is free
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      if (isFree) {
        return {
          i: i,
          j: j
        };
      }
    }
  }

  // Return null if no valid zone is found
  return null;
}

/**
 * Finds all instances within the sight range of a given instance that meet a specific condition.
 *
 * @param {object} instance - The instance whose sight is being processed. Should have properties like `i`, `j`, `sight`, and `parent.grid`.
 * @param {function} condition - A callback function that receives an instance and returns `true` if the instance matches the desired condition.
 * @returns {Array} - List of instances that are within the sight range and match the condition.
 */
function findInstancesInSight(instance, condition) {
  var instX = instance.i,
    instY = instance.j,
    sight = instance.sight,
    map = instance.context.map;
  var instanceBuckets = map.instanceBuckets;
  if (!instanceBuckets) return [];
  var sightSq = sight * sight;
  var instances = [];
  var minBi = Math.max(Math.floor((instX - sight) / BUCKET_SIZE), 0);
  var maxBi = Math.min(Math.floor((instX + sight) / BUCKET_SIZE), instanceBuckets.length - 1);
  var minBj = Math.max(Math.floor((instY - sight) / BUCKET_SIZE), 0);
  var maxBj = Math.min(Math.floor((instY + sight) / BUCKET_SIZE), instanceBuckets[0].length - 1);
  for (var bi = minBi; bi <= maxBi; bi++) {
    for (var bj = minBj; bj <= maxBj; bj++) {
      var _iterator3 = grid_createForOfIteratorHelper(instanceBuckets[bi][bj]),
        _step3;
      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var target = _step3.value;
          var dx = target.i - instX,
            dy = target.j - instY;
          if (dx * dx + dy * dy <= sightSq && condition(target)) {
            instances.push(target);
          }
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
    }
  }
  return instances;
}

/**
 * Updates the cells within a instance's line of sight.
 * Handles fog, viewBy, and visibility efficiently by diffing old vs new cells.
 *
 * @param {object} instance - The instance instance with properties i, j, sight, owner, parent, context.
 */
function updateInstanceVisibility(instance) {
  return updateVisibility(instance);
}

/**
 * Randomly finds a valid position in the grid within a specified zone and size, considering certain conditions.
 *
 * This function attempts to find a valid cell in the grid around the specified zone by randomly generating coordinates
 * and checking if they meet specific conditions, such as avoiding inclined, solid, or border cells.
 *
 * @param {object} zone - The area of the grid to search within (must have properties `minX`, `minY`, `maxX`, `maxY`).
 * @param {object[][]} grid - The grid representing the map, where each cell contains coordinates and attributes.
 * @param {number} size - The size of the instance for which we are finding space.
 * @param {function} condition - A function that returns true if the cell meets the conditions, false otherwise.
 * @param {number} attempts - The number of random attempts to find a valid cell.
 * @returns {object|null} The position {i, j} of a valid cell or null if no valid cell is found.
 */
function getRandomZoneInGridWithCondition(zone, grid, size, condition) {
  var attempts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 100;
  for (var attempt = 0; attempt < attempts; attempt++) {
    var _grid$randomX;
    // Generate random coordinates within the zone
    var randomX = Math.floor(Math.random() * (zone.maxX - zone.minX + 1)) + zone.minX;
    var randomY = Math.floor(Math.random() * (zone.maxY - zone.minY + 1)) + zone.minY;
    var cell = (_grid$randomX = grid[randomX]) === null || _grid$randomX === void 0 ? void 0 : _grid$randomX[randomY];
    if (!cell) continue; // Skip if cell doesn't exist

    // Assume the area around (randomX, randomY) is free initially
    var isFree = true;

    // Check the surrounding cells of size `size` to ensure they all meet the condition
    var surroundingCells = grid_getPlainCellsAroundPoint(randomX, randomY, grid, size);
    var _iterator4 = grid_createForOfIteratorHelper(surroundingCells),
      _step4;
    try {
      for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
        var surroundingCell = _step4.value;
        if (!condition(surroundingCell)) {
          isFree = false;
          break; // Exit early if a cell does not meet the condition
        }
      }

      // If the area is free, return the valid cell
    } catch (err) {
      _iterator4.e(err);
    } finally {
      _iterator4.f();
    }
    if (isFree) {
      return {
        i: randomX,
        j: randomY
      };
    }
  }

  // Return null if no valid cells found after all attempts
  return null;
}

/**
 * Find a valid position in the grid around an instance within a specified space range.
 *
 * This function searches for a position around a given instance within the grid, considering a range of space,
 * the size of the object, and additional conditions like avoiding inclined, solid, or border cells. It can
 * use either a random zone search or a fixed zone search depending on the `random` parameter.
 *
 * @param {object} instance - The instance around which to search (must have properties `i`, `j`, and `parent` grid).
 * @param {object[][]} grid - The grid representing the map, where each cell contains coordinates and attributes.
 * @param {number[]} space - An array [minSpace, maxSpace] that defines the distance range to search within.
 * @param {number} size - The size of the instance for which we are finding space.
 * @param {boolean} [allowInclined=false] - Whether to allow inclined cells in the search.
 * @param {function} [extraCondition] - An optional callback for extra conditions that a valid cell must meet.
 * @param {boolean} [random=true] - If `true`, uses `getRandomZoneInGridWithCondition`; otherwise, uses `getZoneInGridWithCondition`.
 * @returns {object|null} The position {i, j} of a valid cell or null if no valid cell is found.
 */
function getPositionInGridAroundInstance(instance, grid, space, size) {
  var allowInclined = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var extraCondition = arguments.length > 5 ? arguments[5] : undefined;
  var random = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : true;
  var _space = grid_slicedToArray(space, 2),
    minSpace = _space[0],
    maxSpace = _space[1];

  // Define the search zone based on instance's position and maxSpace
  var zone = {
    minX: Math.max(instance.i - maxSpace, 0),
    minY: Math.max(instance.j - maxSpace, 0),
    maxX: Math.min(instance.i + maxSpace, instance.parent.size - 1),
    maxY: Math.min(instance.j + maxSpace, instance.parent.size - 1)
  };

  // Condition to check if the cell is valid based on space, solid, inclined, etc.
  var cellCondition = function cellCondition(cell) {
    var distance = instancesDistance(instance, cell, true);
    return distance >= minSpace &&
    // Ensure it's at least the minimum distance away
    distance <= maxSpace &&
    // Ensure it's within the maximum distance
    !cell.solid &&
    // Ensure the cell is not solid
    !cell.border && (
    // Ensure the cell is not at the border
    allowInclined || !cell.inclined) && (
    // Check inclined condition
    !extraCondition || extraCondition(cell)) // Apply any additional conditions
;
  };

  // Use either the random zone search or fixed zone search based on the 'random' flag
  var pos;
  if (random) {
    pos = getRandomZoneInGridWithCondition(zone, grid, size, cellCondition);
  } else {
    pos = getZoneInGridWithCondition(zone, grid, size, cellCondition);
  }

  // Return the found position or null if none is found
  return pos || null;
}

/**
 * Instance is in a player sight
 * @param {object} instance
 * @param {object} player
 */
function instanceIsInPlayerSight(instance, player) {
  if (!(player !== null && player !== void 0 && player.views)) return false;
  var dist = instance.size === 3 ? 1 : 0;
  var cells = grid_getPlainCellsAroundPoint(instance.i, instance.j, player.views, dist);
  return cells.some(function (cell) {
    return cell.viewBy.size > 0;
  });
}

/**
 * Get all the coordinates around a point within a maximum distance.
 *
 * @param {number} startX - The X coordinate of the center point.
 * @param {number} startY - The Y coordinate of the center point.
 * @param {number} dist - The maximum distance from the center point.
 * @param {object[][]} grid - 2D array representing the grid.
 * @param {function} [callback] - Optional callback function to filter cells. If provided, it should return true for valid cells.
 * @returns {object[]} - Array of valid cells around the point within the distance.
 */
function grid_getPlainCellsAroundPoint(startX, startY, grid) {
  var dist = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var callback = arguments.length > 4 ? arguments[4] : undefined;
  var result = [];

  // Handle single-cell case
  if (dist === 0) {
    var row = grid[startX];
    if (row) {
      var cell = row[startY];
      if (cell && (!callback || callback(cell))) result.push(cell);
    }
    return result;
  }
  var minX = Math.max(startX - dist, 0);
  var maxX = Math.min(startX + dist, grid.length - 1);
  for (var i = minX; i <= maxX; i++) {
    var _row = grid[i];
    if (!_row) continue;
    var minY = Math.max(startY - dist, 0);
    var maxY = Math.min(startY + dist, _row.length - 1);
    for (var j = minY; j <= maxY; j++) {
      var _cell = _row[j];
      if (_cell && (!callback || callback(_cell))) result.push(_cell);
    }
  }
  return result;
}

/**
 * Get the coordinates around a point within a Manhattan distance (safe for irregular grids)
 * @param {number} startX
 * @param {number} startY
 * @param {Array} grid
 * @param {number} dist
 * @param {Function} callback
 * @returns {Array} Array of cells that match the criteria
 */
function getCellsAroundPoint(startX, startY, grid, dist, callback) {
  var _grid$startX;
  var result = [];

  // Special case: distance 0
  var startCell = (_grid$startX = grid[startX]) === null || _grid$startX === void 0 ? void 0 : _grid$startX[startY];
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell);
    return result;
  }

  // Iterate over Manhattan distance
  for (var dx = -dist; dx <= dist; dx++) {
    var x = startX + dx;
    var row = grid[x];
    if (!row) continue; // Skip if row does not exist

    var dyMax = dist - Math.abs(dx);
    for (var dy = -dyMax; dy <= dyMax; dy++) {
      var y = startY + dy;
      var cell = row[y];
      if (!cell) continue; // Skip if cell does not exist

      if (!callback || callback(cell)) result.push(cell);
    }
  }
  return result;
}

/**
 * Get the closest instance to a given instance.
 *
 * @param {object} instance - The reference instance. Should have properties like `x`, `y`.
 * @param {Array<object>} instances - The array of other instances to check. Each should have properties like `x`, `y`.
 * @returns {object|boolean} - The closest instance or false if no instances are found.
 */
function getClosestInstance(instance, instances) {
  var closestInstance = null;
  var closestDistance = Infinity;

  // Iterate through the instances to find the one with the minimum distance to the reference instance
  var _iterator5 = grid_createForOfIteratorHelper(instances),
    _step5;
  try {
    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
      var targetInstance = _step5.value;
      var distance = instancesDistance(instance, targetInstance);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestInstance = targetInstance;
      }
    }

    // Return the closest instance, or false if no valid instance was found
  } catch (err) {
    _iterator5.e(err);
  } finally {
    _iterator5.f();
  }
  return closestInstance || false;
}

/**
 * Get the closest instance with a valid path.
 *
 * This function calculates the closest instance that can be reached by a valid path
 * from the given `instance`. It checks all provided `instances` and computes the path
 * to each of them, then returns the instance with the shortest valid path.
 *
 * @param {object} instance - The current instance trying to reach other instances.
 * @param {Array<object>} instances - An array of target instances to find the closest reachable one.
 * @returns {object|null} The closest instance with its path or null if no valid path is found.
 */
function getClosestInstanceWithPath(instance, instances) {
  var maxCandidates = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 6;
  // Sort by Euclidean distance first so we try nearby targets first
  var sorted = grid_toConsumableArray(instances).sort(function (a, b) {
    return instancesDistance(instance, a) - instancesDistance(instance, b);
  });
  var closest = null;
  var attempts = 0;
  var _iterator6 = grid_createForOfIteratorHelper(sorted),
    _step6;
  try {
    for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
      var target = _step6.value;
      // A* path length >= straight-line distance, so skip if already longer than best
      if (closest && instancesDistance(instance, target) >= closest.path.length) break;
      // Cap A* calls — if the N nearest by Euclidean distance are all blocked, farther ones likely are too
      if (attempts++ >= maxCandidates) break;
      var path = getInstanceClosestFreeCellPath(instance, target, instance.parent);
      if (path.length && (!closest || path.length < closest.path.length)) {
        closest = {
          instance: target,
          path: path
        };
      }
    }
  } catch (err) {
    _iterator6.e(err);
  } finally {
    _iterator6.f();
  }
  return closest;
}
;// ./app/lib/extra.js
function extra_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = extra_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function extra_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return extra_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? extra_arrayLikeToArray(r, a) : void 0; } }
function extra_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function extra_typeof(o) { "@babel/helpers - typeof"; return extra_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, extra_typeof(o); }



function setUnitTexture(sheet, instance, ACCELERATOR) {
  var _ref, _instance$sheet$data$;
  var animationSpeed = {
    standingSheet: 0.15,
    corpseSheet: 0
  };
  var paused = instance.context.paused;
  if (paused) {
    return;
  }
  var sheetToReset = [SHEET_TYPES.action, SHEET_TYPES.dying, SHEET_TYPES.corpse];
  // Sheet don't exist we just block the current sheet
  if (!instance[sheet]) {
    if (instance.currentSheet !== SHEET_TYPES.walking && instance.walkingSheet) {
      instance.sprite.textures = [instance.walkingSheet.textures[Object.keys(instance.walkingSheet.textures)[0]]];
    } else {
      instance.sprite.textures = [instance.sprite.textures[instance.sprite.currentFrame]];
    }
    instance.currentSheet = SHEET_TYPES.walking;
    instance.sprite.stop();
    instance.sprite.anchor.set(instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.x, instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.y);
    return;
  }
  // Reset action loop
  if (!sheetToReset.includes(sheet)) {
    instance.sprite.onLoop = null;
    instance.sprite.onFrameChange = null;
  }
  var _goto = instance.currentSheet === sheet && instance.sprite.currentFrame;
  instance.currentSheet = sheet;
  var direction = degreeToDirection(instance.degree);
  switch (direction) {
    case 'southeast':
      instance.sprite.scale.x = -1;
      instance.sprite.textures = instance[sheet].animations['southwest'];
      break;
    case 'northeast':
      instance.sprite.scale.x = -1;
      instance.sprite.textures = instance[sheet].animations['northwest'];
      break;
    case 'east':
      instance.sprite.scale.x = -1;
      instance.sprite.textures = instance[sheet].animations['west'];
      break;
    default:
      instance.sprite.scale.x = 1;
      instance.sprite.textures = instance[sheet].animations[direction];
  }
  instance.sprite.animationSpeed = ((_ref = (_instance$sheet$data$ = instance[sheet].data.animationSpeed) !== null && _instance$sheet$data$ !== void 0 ? _instance$sheet$data$ : animationSpeed[sheet]) !== null && _ref !== void 0 ? _ref : 0.3) * ACCELERATOR;
  _goto && _goto < instance.sprite.textures.length ? instance.sprite.gotoAndPlay(_goto) : instance.sprite.play();
}

/**
 * Filters an object by the specified keys.
 * @param {object} obj - The object to filter.
 * @param {Array<string>} keys - The keys to retain in the new object.
 * @returns {object} - The filtered object.
 */
function filterObject(obj, keys) {
  if (extra_typeof(obj) !== 'object' || obj === null) {
    throw new Error('Expected an object to filter.');
  }
  return keys.reduce(function (acc, key) {
    if (obj.hasOwnProperty(key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

/**
 * Modal constructor for displaying content in a modal dialog.
 * @param {HTMLElement} content - The content to display inside the modal.
 */
var Modal = function Modal(content) {
  if (!(content instanceof HTMLElement)) {
    throw new Error('Content must be an HTML element.');
  }
  var id = uuidv4();
  this.open = function () {
    var modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    var modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.appendChild(content);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    return modal;
  };
  this.close = function () {
    var modal = document.getElementById(id);
    if (modal) {
      modal.remove();
    }
  };
  this.open();
};

/**
 * Custom timeout implementation with pause and resume functionality.
 * @param {function} callback - The function to execute after the delay.
 * @param {number} delay - The delay in milliseconds.
 */
var CustomTimeout = function CustomTimeout(callback, delay) {
  var _this = this;
  if (typeof callback !== 'function' || typeof delay !== 'number') {
    throw new Error('Invalid arguments for CustomTimeout.');
  }
  var timerId,
    start,
    remaining = delay;
  this.pause = function () {
    window.clearTimeout(timerId);
    timerId = null;
    remaining -= Date.now() - start;
    return remaining;
  };
  this.resume = function () {
    if (timerId) {
      return; // Already running
    }
    start = Date.now();
    timerId = window.setTimeout(callback, remaining);
  };
  this.reset = function () {
    _this.pause();
    remaining = delay;
    _this.resume();
  };
  this.resume(); // Start the timer immediately
};

/**
 * Throttles a function to ensure it only executes once within a specified time frame.
 * @param {Function} callback - The function to throttle.
 * @param {number} wait - The time frame in milliseconds to throttle calls.
 * @param {boolean} [immediate=false] - If true, trigger the function on the leading edge instead of the trailing.
 * @returns {Function} - The throttled function.
 */
function throttle(callback, wait) {
  var immediate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.');
  }
  var timeout = null;
  var initialCall = true;
  return function () {
    var _this2 = this;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var callNow = immediate && initialCall;
    var next = function next() {
      callback.apply(_this2, args);
      timeout = null;
    };
    if (callNow) {
      initialCall = false;
      next();
    }
    if (!timeout) {
      timeout = setTimeout(next, wait);
    }
  };
}

/**
 * Debounces a function to ensure it only executes after a specified delay.
 * @param {Function} callback - The function to debounce.
 * @param {number} wait - The delay in milliseconds before the function can be called again.
 * @returns {Function} - The debounced function.
 */
var debounce = function debounce(callback, wait) {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.');
  }
  var timeoutId = null;
  return function () {
    var _this3 = this;
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(function () {
      callback.apply(_this3, args);
    }, wait);
  };
};

/**
 * Maps loading types to their corresponding work roles.
 * @param {string} loadingType - The type of resource being loaded.
 * @returns {string} - The corresponding work role for the loading type.
 */
function getWorkWithLoadingType(loadingType) {
  var workMapping = {
    wheat: WORK_TYPES.farmer,
    wood: WORK_TYPES.woodcutter,
    berry: WORK_TYPES.forager,
    stone: WORK_TYPES.stoneminer,
    gold: WORK_TYPES.goldminer,
    meat: WORK_TYPES.hunter,
    fish: WORK_TYPES.fisher
  };
  return workMapping[loadingType] || 'default'; // Fallback to 'default' if loadingType is not found
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} string - The input string to capitalize.
 * @returns {string} - The string with the first letter capitalized.
 */
function capitalizeFirstLetter(string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }
  return string.length > 0 ? string.charAt(0).toUpperCase() + string.slice(1) : '';
}

/**
 * Calculates the damage dealt by a source to a target.
 * @param {object} source - The attacking unit with attack attributes.
 * @param {object} target - The defending unit with armor attributes.
 * @returns {number} The calculated damage, at least 1.
 */
function getDamage(source, target) {
  var meleeAttack = source.meleeAttack || 0;
  var pierceAttack = source.pierceAttack || 0;
  var meleeArmor = target.meleeArmor || 0;
  var pierceArmor = target.pierceArmor || 0;

  // Calculate damage considering armor
  return Math.max(1, Math.max(0, meleeAttack - meleeArmor) + Math.max(0, pierceAttack - pierceArmor));
}

/**
 * Calculates the remaining hit points of a target after taking damage.
 * @param {object} source - The attacking unit (for damage calculation).
 * @param {object} target - The defending unit with hit points.
 * @param {number} [defaultDamage] - An optional damage value.
 * @returns {number} The remaining hit points of the target, at least 0.
 */
function getHitPointsWithDamage(source, target, defaultDamage) {
  var damage = defaultDamage || getDamage(source, target);
  return Math.max(0, target.hitPoints - damage);
}

/**
 * Updates a nested property in an object based on the specified operation.
 * @param {Object} target - The object to be updated.
 * @param {Object} operation - An object describing the update operation.
 * @param {string} operation.key - The key representing the path to the property.
 * @param {string} operation.op - The operation to perform ('*' or '+').
 * @param {number} operation.value - The value to use in the operation.
 */
var updateObject = function updateObject(target, operation) {
  if (extra_typeof(target) !== 'object' || target === null) {
    throw new Error('Target must be a non-null object.');
  }
  if (!operation || !operation.key || !operation.op || typeof operation.value !== 'number') {
    throw new Error('Invalid operation: key, op, and value are required.');
  }
  function setToValue(obj, value, path) {
    var keys = path.split('.');
    for (var i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        throw new Error("Path not found: ".concat(keys.slice(0, i + 1).join('.')));
      }
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }
  var keys = operation.key.split('.');
  var result = target;

  // Navigate to the specified path
  var _iterator = extra_createForOfIteratorHelper(keys),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var key = _step.value;
      if (result[key] === undefined) {
        throw new Error("Key not found: ".concat(operation.key));
      }
      result = result[key];
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  switch (operation.op) {
    case '*':
      setToValue(target, result * Number(operation.value), operation.key);
      break;
    case '+':
      setToValue(target, result + Number(operation.value), operation.key);
      break;
    default:
      throw new Error("Invalid operation: ".concat(operation.op));
  }
};
var canUpdateMinimap = function canUpdateMinimap(instance, player) {
  var _instance$context;
  if ((_instance$context = instance.context) !== null && _instance$context !== void 0 && (_instance$context = _instance$context.map) !== null && _instance$context !== void 0 && _instance$context.revealEverything) return true;
  return instance.owner.isPlayed || player.label !== instance.owner.label && instanceIsInPlayerSight(instance, player);
};

/**
 * Checks if a given condition is valid based on specified values.
 * @param {Object} condition - The condition object containing operation, key, and value.
 * @param {Object} values - The values to evaluate against.
 * @returns {boolean} - True if the condition is valid, false otherwise.
 */
var isValidCondition = function isValidCondition(condition, values) {
  if (!condition) {
    return true; // No condition means it's always valid
  }
  var op = condition.op,
    key = condition.key,
    value = condition.value;
  var expectedValue = values[key];
  if (expectedValue === undefined) {
    throw new Error("Key not found in values: ".concat(key));
  }
  switch (op) {
    case '=':
    case '!=':
      {
        var result = Array.isArray(value) ? arraysEqual(value, expectedValue) : value === expectedValue;
        return op === '!=' ? !result : result;
      }
    case '<':
      return expectedValue < value;
    case '<=':
      return expectedValue <= value;
    case '>=':
      return expectedValue >= value;
    case '>':
      return expectedValue > value;
    case 'includes':
      return expectedValue.includes(value);
    case 'notincludes':
      return !expectedValue.includes(value);
    default:
      throw new Error("Invalid condition operation provided: ".concat(op));
  }
};

/**
 * Compares two arrays for equality, disregarding order.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {boolean} - True if arrays are equal, false otherwise.
 */
var arraysEqual = function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  var sortedA = a.slice().sort();
  var sortedB = b.slice().sort();
  return sortedA.every(function (val, index) {
    return val === sortedB[index];
  });
};
var extra_getActionCondition = function getActionCondition(source, target, action, props) {
  if (!action) {
    return false;
  }
  var conditions = {
    delivery: function delivery(props) {
      return source.loading > 0 && target.hitPoints > 0 && target.isBuilt && (!props || props.buildingTypes.includes(target.type));
    },
    takemeat: function takemeat() {
      return source.type === UNIT_TYPES.villager && target.family === FAMILY_TYPES.animal && target.quantity > 0 && target.isDead && !target.isDestroyed;
    },
    fishing: function fishing() {
      return target.category === 'Fish' && target.allowAction.includes(source.type) && target.quantity > 0 && !target.isDestroyed;
    },
    hunt: function hunt() {
      return source.type === UNIT_TYPES.villager && target.family === FAMILY_TYPES.animal && target.quantity > 0 && target.hitPoints > 0 && !target.isDead;
    },
    chopwood: function chopwood() {
      return source.type === UNIT_TYPES.villager && target.type === RESOURCE_TYPES.tree && target.quantity > 0 && !target.isDead;
    },
    farm: function farm() {
      var _target$owner;
      return source.type === UNIT_TYPES.villager && target.type === BUILDING_TYPES.farm && target.hitPoints > 0 && ((_target$owner = target.owner) === null || _target$owner === void 0 ? void 0 : _target$owner.label) === source.owner.label && target.quantity > 0 && (!target.isUsedBy || target.isUsedBy === source) && !target.isDead;
    },
    forageberry: function forageberry() {
      return source.type === UNIT_TYPES.villager && target.type === RESOURCE_TYPES.berrybush && target.quantity > 0 && !target.isDead;
    },
    minestone: function minestone() {
      return source.type === UNIT_TYPES.villager && target.type === RESOURCE_TYPES.stone && target.quantity > 0 && !target.isDead;
    },
    minegold: function minegold() {
      return source.type === UNIT_TYPES.villager && target.type === RESOURCE_TYPES.gold && target.quantity > 0 && !target.isDead;
    },
    build: function build() {
      var _target$owner2;
      return source.type === UNIT_TYPES.villager && ((_target$owner2 = target.owner) === null || _target$owner2 === void 0 ? void 0 : _target$owner2.label) === source.owner.label && target.family === FAMILY_TYPES.building && target.hitPoints > 0 && (!target.isBuilt || target.hitPoints < target.totalHitPoints) && !target.isDead;
    },
    attack: function attack() {
      var _target$owner3;
      return target && ((_target$owner3 = target.owner) === null || _target$owner3 === void 0 ? void 0 : _target$owner3.label) !== source.owner.label && [FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family) && target.hitPoints > 0 && !target.isDead;
    },
    heal: function heal() {
      var _target$owner4;
      return target && ((_target$owner4 = target.owner) === null || _target$owner4 === void 0 ? void 0 : _target$owner4.label) === source.owner.label && target.family === FAMILY_TYPES.unit && target.hitPoints > 0 && target.hitPoints < target.totalHitPoints && !target.isDead;
    }
  };
  return target && target !== source && source.hitPoints > 0 && !source.isDead && conditions[action](props);
};
;// ./app/lib/index.js





;// ./app/classes/Instance.js
function Instance_typeof(o) { "@babel/helpers - typeof"; return Instance_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, Instance_typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == Instance_typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != Instance_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != Instance_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == Instance_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }



var Instance = /*#__PURE__*/function (_Container) {
  function Instance(context) {
    var _this;
    _classCallCheck(this, Instance);
    _this = _callSuper(this, Instance);
    _this.context = context;
    _this.label = uuidv4();
    _this.selected = false;
    _this.isDead = false;
    _this.isDestroyed = false;
    _this.interval = null;
    _this.timeoutId = null;
    return _this;
  }
  _inherits(Instance, _Container);
  return _createClass(Instance, [{
    key: "startInterval",
    value: function startInterval(callback, time) {
      var immediate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      this.stopInterval();
      if (immediate) callback();
      this.interval = this.context.scheduler.add(callback, time);
    }
  }, {
    key: "stopInterval",
    value: function stopInterval() {
      if (this.interval) {
        this.context.scheduler.remove(this.interval);
        this.interval = null;
      }
    }
  }, {
    key: "stopTimeout",
    value: function stopTimeout() {
      if (this.timeoutId != null) {
        this.context.scheduler.remove(this.timeoutId);
        this.timeoutId = null;
      }
    }
  }, {
    key: "pause",
    value: function pause() {
      var _this$sprite;
      (_this$sprite = this.sprite) === null || _this$sprite === void 0 || _this$sprite.stop();
    }
  }, {
    key: "resume",
    value: function resume() {
      var _this$sprite2;
      (_this$sprite2 = this.sprite) === null || _this$sprite2 === void 0 || _this$sprite2.play();
    }
  }, {
    key: "select",
    value: function select() {
      var _this$selectionFactor;
      if (this.selected) return;
      this.selected = true;
      var f = (_this$selectionFactor = this.selectionFactor) !== null && _this$selectionFactor !== void 0 ? _this$selectionFactor : this.size;
      var selection = new lib/* Graphics */.A1g();
      selection.label = LABEL_TYPES.selection;
      selection.zIndex = 3;
      selection.poly([-32 * f, 0, 0, -16 * f, 32 * f, 0, 0, 16 * f]);
      selection.stroke(COLOR_WHITE);
      this.addChildAt(selection, 0);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) return;
      this.selected = false;
      var selection = this.getChildByLabel(LABEL_TYPES.selection);
      if (selection) this.removeChild(selection);
    }
  }, {
    key: "step",
    value: function step() {
      if (this.hitPoints <= 0) {
        this.die();
      } else if (this.hasPath()) {
        this.moveToPath();
      }
    }
  }, {
    key: "getActionCondition",
    value: function getActionCondition(target) {
      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.action;
      return extra_getActionCondition(this, target, action);
    }
  }, {
    key: "setTextures",
    value: function setTextures(sheet) {
      setUnitTexture(sheet, this, ACCELERATOR);
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/ui/ResourceInterface.js
function ResourceInterface_typeof(o) { "@babel/helpers - typeof"; return ResourceInterface_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, ResourceInterface_typeof(o); }
function ResourceInterface_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function ResourceInterface_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, ResourceInterface_toPropertyKey(o.key), o); } }
function ResourceInterface_createClass(e, r, t) { return r && ResourceInterface_defineProperties(e.prototype, r), t && ResourceInterface_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function ResourceInterface_toPropertyKey(t) { var i = ResourceInterface_toPrimitive(t, "string"); return "symbol" == ResourceInterface_typeof(i) ? i : i + ""; }
function ResourceInterface_toPrimitive(t, r) { if ("object" != ResourceInterface_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != ResourceInterface_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var ResourceInterface = /*#__PURE__*/function () {
  function ResourceInterface(resource) {
    ResourceInterface_classCallCheck(this, ResourceInterface);
    this.resource = resource;
  }
  return ResourceInterface_createClass(ResourceInterface, [{
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var resource = this.resource;
      var menu = resource.context.menu;
      var typeDiv = document.createElement('div');
      typeDiv.id = MENU_INFO_IDS.type;
      typeDiv.textContent = t(resource.type);
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = MENU_INFO_IDS.icon;
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      if (resource.hitPoints) {
        var hitPointsDiv = document.createElement('div');
        hitPointsDiv.id = MENU_INFO_IDS.hitPoints;
        hitPointsDiv.textContent = resource.hitPoints + '/' + resource.totalHitPoints;
        element.appendChild(hitPointsDiv);
      }
      if (resource.quantity) {
        var quantityDiv = document.createElement('div');
        quantityDiv.id = MENU_INFO_IDS.quantity;
        quantityDiv.className = 'resource-quantity';
        var iconToUse;
        switch (resource.type) {
          case RESOURCE_TYPES.tree:
            iconToUse = menu.infoIcons['wood'];
            break;
          case RESOURCE_TYPES.salmon:
          case RESOURCE_TYPES.berrybush:
            iconToUse = menu.infoIcons['food'];
            break;
          case RESOURCE_TYPES.stone:
            iconToUse = menu.infoIcons['stone'];
            break;
          case RESOURCE_TYPES.gold:
            iconToUse = menu.infoIcons['gold'];
            break;
        }
        var smallIconImg = document.createElement('img');
        smallIconImg.src = iconToUse;
        smallIconImg.className = 'resource-quantity-icon';
        var textDiv = document.createElement('div');
        textDiv.id = MENU_INFO_IDS.quantityText;
        textDiv.textContent = resource.quantity;
        quantityDiv.appendChild(smallIconImg);
        quantityDiv.appendChild(textDiv);
        element.appendChild(quantityDiv);
      }
    }
  }]);
}();
;// ./app/classes/resource.js
function resource_typeof(o) { "@babel/helpers - typeof"; return resource_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, resource_typeof(o); }
function resource_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function resource_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, resource_toPropertyKey(o.key), o); } }
function resource_createClass(e, r, t) { return r && resource_defineProperties(e.prototype, r), t && resource_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function resource_toPropertyKey(t) { var i = resource_toPrimitive(t, "string"); return "symbol" == resource_typeof(i) ? i : i + ""; }
function resource_toPrimitive(t, r) { if ("object" != resource_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != resource_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function resource_callSuper(t, o, e) { return o = resource_getPrototypeOf(o), resource_possibleConstructorReturn(t, resource_isNativeReflectConstruct() ? Reflect.construct(o, e || [], resource_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function resource_possibleConstructorReturn(t, e) { if (e && ("object" == resource_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return resource_assertThisInitialized(t); }
function resource_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function resource_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (resource_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function resource_getPrototypeOf(t) { return resource_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, resource_getPrototypeOf(t); }
function resource_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && resource_setPrototypeOf(t, e); }
function resource_setPrototypeOf(t, e) { return resource_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, resource_setPrototypeOf(t, e); }






var Resource = /*#__PURE__*/function (_Instance) {
  function Resource(options, context) {
    var _this$quantity, _this$hitPoints;
    var _this;
    resource_classCallCheck(this, Resource);
    _this = resource_callSuper(this, Resource, [context]);
    var _this2 = _this,
      map = _this2.context.map;
    _this.family = FAMILY_TYPES.resource;
    _this.resourceInterface = new ResourceInterface(_this);
    _this.size = 1;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    var config = lib/* Assets */.sP.cache.get('config');
    Object.keys(config.resources[_this.type]).forEach(function (prop) {
      _this[prop] = config.resources[_this.type][prop];
    });
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.totalHitPoints;
    _this.x = map.grid[_this.i][_this.j].x;
    _this.y = map.grid[_this.i][_this.j].y;
    _this.z = map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.visible = false;

    // Set solid zone
    var cell = map.grid[_this.i][_this.j];
    cell.solid = true;
    cell.has = _this;
    _this.eventMode = 'auto';
    _this.allowClick = false;
    _this.allowMove = false;
    _this["interface"] = {
      info: function info(element) {
        var data = config.resources[_this.type];
        _this.setDefaultInterface(element, data);
      }
    };
    if (_this.isAnimated) {
      var spritesheetJump = lib/* Assets */.sP.cache.get(_this.assets);
      _this.sprite = new lib/* AnimatedSprite */.Dl5(spritesheetJump.animations.jump);
      _this.sprite.play();
      _this.sprite.animationSpeed = 0.2;
    } else {
      _this.textureName = _this.textureName || maths_randomItem(Array.isArray(_this.assets) ? _this.assets : _this.assets[cell.type]);
      var resourceName = _this.textureName.split('_')[1];
      var textureFile = _this.textureName + '.png';
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[textureFile];
      _this.sprite = lib/* Sprite */.kxk.from(texture);
      _this.sprite.hitArea = spritesheet.data.frames[textureFile].hitArea && new lib/* Polygon */.tS(spritesheet.data.frames[textureFile].hitArea);
    }
    _this.sprite.updateAnchor = true;
    _this.sprite.label = LABEL_TYPES.sprite;
    if (_this.sprite) {
      _this.sprite.allowMove = false;
      _this.sprite.eventMode = 'static';
      _this.sprite.roundPixels = true;
      _this.sprite.on('pointertap', function () {
        var _this3 = _this,
          _this3$context = _this3.context,
          player = _this3$context.player,
          menu = _this3$context.menu;
        if (!player.selectedUnits.length && (instanceIsInPlayerSight(_this, player) || map.revealEverything)) {
          player.unselectAll();
          _this.select();
          menu.setBottombar(_this);
          player.selectedOther = _this;
        }
      });
      _this.sprite.on('pointerup', function (evt) {
        var _this4 = _this,
          _this4$context = _this4.context,
          player = _this4$context.player,
          controls = _this4$context.controls;
        var action = TYPE_ACTION[_this.category || _this.type];
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return;
        }
        controls.mouse.prevent = true;
        // Send Villager to forage the berry
        var hasVillager = false;
        var hasOther = false;
        for (var i = 0; i < player.selectedUnits.length; i++) {
          var unit = player.selectedUnits[i];
          if (extra_getActionCondition(unit, _this, action)) {
            hasVillager = true;
            var sendToFunc = "sendTo".concat(_this.category || _this.type);
            typeof unit[sendToFunc] === 'function' ? unit[sendToFunc](_this) : unit.sendTo(_this);
          } else {
            hasOther = true;
            unit.sendTo(_this);
          }
        }
        if (hasVillager) {
          drawInstanceBlinkingSelection(_this);
        }
        if (hasOther) {
          var voice = maths_randomItem(['5075', '5076', '5128', '5164']);
          voice && sound_lib/* sound */.s3.play(voice);
        } else if (hasVillager) {
          var _voice = lib/* Assets */.sP.cache.get('config').units.Villager.sounds[action];
          _voice && sound_lib/* sound */.s3.play(_voice);
        }
      });
      _this.addChild(_this.sprite);
    }
    map.addToInstanceBucket(_this);
    return _this;
  }
  resource_inherits(Resource, _Instance);
  return resource_createClass(Resource, [{
    key: "die",
    value: function die(immediate) {
      if (this.isDead) {
        return;
      }
      var _this$context = this.context,
        player = _this$context.player,
        players = _this$context.players,
        map = _this$context.map,
        menu = _this$context.menu;
      if (this.selected && player.selectedOther === this) {
        player.unselectAll();
      }
      var listName = 'founded' + this.type + 's';
      for (var i = 0; i < players.length; i++) {
        if (players[i].type === PLAYER_TYPES.ai) {
          var list = players[i][listName];
          if (list) {
            list["delete"](this);
          }
        }
      }
      map.resources["delete"](this);
      menu.updateResourcesMiniMap();
      map.removeFromInstanceBucket(this);
      this.isDead = true;
      if (this.type === RESOURCE_TYPES.tree && !immediate) {
        this.onTreeDie();
      } else {
        this.clear();
      }
    }
  }, {
    key: "setCuttedTreeTexture",
    value: function setCuttedTreeTexture() {
      var sprite = this.sprite;
      var spritesheet = lib/* Assets */.sP.cache.get('636');
      this.textureName = "00".concat(randomRange(0, 3), "_636.png");
      var texture = spritesheet.textures[this.textureName];
      sprite.texture = texture;
      var points = [-CELL_WIDTH / 2, 0, 0, -CELL_HEIGHT / 2, CELL_WIDTH / 2, 0, 0, CELL_HEIGHT / 2];
      sprite.hitArea = new lib/* Polygon */.tS(points);
      sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y);
    }
  }, {
    key: "onTreeDie",
    value: function onTreeDie() {
      var map = this.context.map;
      var spritesheet = lib/* Assets */.sP.cache.get('623');
      this.textureName = "00".concat(randomRange(0, 3), "_623.png");
      var texture = spritesheet.textures[this.textureName];
      var sprite = this.sprite;
      sprite.texture = texture;
      sprite.eventMode = 'none';
      this.zIndex--;
      if (map.grid[this.i][this.j].has === this) {
        map.grid[this.i][this.j].has = null;
        map.grid[this.i][this.j].corpses.add(this);
        map.grid[this.i][this.j].solid = false;
      }
    }
  }, {
    key: "clear",
    value: function clear() {
      if (this.isDestroyed) {
        return;
      }
      var map = this.context.map;
      this.isDestroyed = true;
      if (map.grid[this.i][this.j].has === this) {
        map.grid[this.i][this.j].has = null;
        map.grid[this.i][this.j].solid = false;
      }
      map.grid[this.i][this.j].corpses["delete"](this);
      map.removeChild(this);
      this.destroy({
        child: true,
        texture: true
      });
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      return this.resourceInterface.setDefaultInterface(element, data);
    }
  }]);
}(Instance);
;// ./app/ui/BuildingInterface.js
function BuildingInterface_typeof(o) { "@babel/helpers - typeof"; return BuildingInterface_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BuildingInterface_typeof(o); }
function BuildingInterface_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BuildingInterface_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BuildingInterface_toPropertyKey(o.key), o); } }
function BuildingInterface_createClass(e, r, t) { return r && BuildingInterface_defineProperties(e.prototype, r), t && BuildingInterface_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BuildingInterface_toPropertyKey(t) { var i = BuildingInterface_toPrimitive(t, "string"); return "symbol" == BuildingInterface_typeof(i) ? i : i + ""; }
function BuildingInterface_toPrimitive(t, r) { if ("object" != BuildingInterface_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BuildingInterface_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var BuildingInterface = /*#__PURE__*/function () {
  function BuildingInterface(building) {
    BuildingInterface_classCallCheck(this, BuildingInterface);
    this.building = building;
  }
  return BuildingInterface_createClass(BuildingInterface, [{
    key: "renderInfo",
    value: function renderInfo(element, data) {
      var building = this.building;
      this.setDefaultInterface(element, data);
      if (building.displayPopulation && building.owner.isPlayed && building.isBuilt) {
        element.appendChild(this.getPopulationElement());
      }
      element.appendChild(this.getLoadingElement());
    }
  }, {
    key: "getPopulationElement",
    value: function getPopulationElement() {
      var building = this.building;
      var populationDiv = document.createElement('div');
      populationDiv.id = MENU_INFO_IDS.population;
      var populationIcon = document.createElement('img');
      var populationSpan = document.createElement('span');
      populationSpan.id = MENU_INFO_IDS.populationText;
      populationSpan.textContent = building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.population_max);
      populationIcon.src = getIconPath('004_50731');
      populationDiv.appendChild(populationIcon);
      populationDiv.appendChild(populationSpan);
      return populationDiv;
    }
  }, {
    key: "updateLoading",
    value: function updateLoading() {
      var _this = this;
      var building = this.building;
      var menu = building.context.menu;
      if (building.owner.isPlayed && building.owner.selectedBuilding === building) {
        if (building.loading === 10) {
          menu.updateInfo(MENU_INFO_IDS.loading, function (element) {
            return element.innerHTML = _this.getLoadingElement().innerHTML;
          });
        } else if (building.loading > 10) {
          menu.updateInfo(MENU_INFO_IDS.loadingText, building.loading + '%');
        } else {
          menu.updateInfo(MENU_INFO_IDS.loading, function (element) {
            return element.innerHTML = '';
          });
        }
      }
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      var building = this.building;
      var loadingDiv = document.createElement('div');
      loadingDiv.className = 'building-loading';
      loadingDiv.id = MENU_INFO_IDS.loading;
      if (building.loading && building.owner.isPlayed) {
        var iconImg = document.createElement('img');
        iconImg.className = 'building-loading-icon';
        iconImg.src = getIconPath('009_50731');
        var textDiv = document.createElement('div');
        textDiv.id = MENU_INFO_IDS.loadingText;
        textDiv.textContent = building.loading + '%';
        loadingDiv.appendChild(iconImg);
        loadingDiv.appendChild(textDiv);
      }
      return loadingDiv;
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var building = this.building;
      var menu = building.context.menu;
      var civDiv = document.createElement('div');
      civDiv.id = MENU_INFO_IDS.civ;
      civDiv.textContent = t(building.owner.civ);
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = MENU_INFO_IDS.type;
      typeDiv.textContent = t(building.type);
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = MENU_INFO_IDS.icon;
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      if (building.owner && building.owner.isPlayed) {
        var hitPointsDiv = document.createElement('div');
        hitPointsDiv.id = MENU_INFO_IDS.hitPoints;
        hitPointsDiv.textContent = building.hitPoints + '/' + building.totalHitPoints;
        element.appendChild(hitPointsDiv);
        if (building.isBuilt && building.quantity) {
          var quantityDiv = document.createElement('div');
          quantityDiv.id = MENU_INFO_IDS.quantity;
          quantityDiv.className = 'resource-quantity';
          var smallIconImg = document.createElement('img');
          smallIconImg.src = menu.icons['food'];
          smallIconImg.className = 'resource-quantity-icon';
          var textDiv = document.createElement('div');
          textDiv.id = MENU_INFO_IDS.quantityText;
          textDiv.textContent = building.quantity;
          quantityDiv.appendChild(smallIconImg);
          quantityDiv.appendChild(textDiv);
          element.appendChild(quantityDiv);
        }
      }
    }
  }]);
}();
;// ./app/classes/building/BuildingLifecycle.js
function BuildingLifecycle_typeof(o) { "@babel/helpers - typeof"; return BuildingLifecycle_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BuildingLifecycle_typeof(o); }
function BuildingLifecycle_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BuildingLifecycle_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BuildingLifecycle_toPropertyKey(o.key), o); } }
function BuildingLifecycle_createClass(e, r, t) { return r && BuildingLifecycle_defineProperties(e.prototype, r), t && BuildingLifecycle_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BuildingLifecycle_toPropertyKey(t) { var i = BuildingLifecycle_toPrimitive(t, "string"); return "symbol" == BuildingLifecycle_typeof(i) ? i : i + ""; }
function BuildingLifecycle_toPrimitive(t, r) { if ("object" != BuildingLifecycle_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BuildingLifecycle_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var BuildingLifecycle = /*#__PURE__*/function () {
  function BuildingLifecycle(building) {
    BuildingLifecycle_classCallCheck(this, BuildingLifecycle);
    this.building = building;
  }
  return BuildingLifecycle_createClass(BuildingLifecycle, [{
    key: "die",
    value: function die() {
      var building = this.building;
      if (building.isDead) {
        return;
      }
      var _building$context = building.context,
        map = _building$context.map,
        player = _building$context.player,
        players = _building$context.players,
        menu = _building$context.menu;
      clearTimeout(building.visibilityTimeout);
      building.stopInterval();
      building.isDead = true;
      map.removeFromInstanceBucket(building);
      if (building.selected && player) {
        player.unselectAll();
      }
      var index = building.owner.buildings.indexOf(building);
      if (index >= 0) {
        building.owner.buildings.splice(index, 1);
      }
      for (var i = 0; i < players.length; i++) {
        if (players[i].type === PLAYER_TYPES.ai) {
          players[i].foundedEnemyBuildings["delete"](building);
        }
      }
      var color = building.getChildByLabel(LABEL_TYPES.color);
      color && color.destroy();
      var deco = building.getChildByLabel(LABEL_TYPES.deco);
      deco && deco.destroy();
      var fire = building.getChildByLabel(LABEL_TYPES.fire);
      fire && fire.destroy();
      var rubbleSheet = getBuildingRubbleTextureNameWithSize(building.size, lib/* Assets */.sP);
      if (building.type === BUILDING_TYPES.farm) {
        rubbleSheet = '000_239';
      }
      building.sprite.texture = getTexture(rubbleSheet, lib/* Assets */.sP);
      building.sprite.allowMove = false;
      building.sprite.eventMode = 'none';
      building.sprite.allowClick = false;
      building.zIndex--;
      if (building.type === BUILDING_TYPES.farm) {
        changeSpriteColorDirectly(building.sprite, building.owner.color);
      }
      updateInstanceVisibility(building);
      var dist = building.size === 3 ? 1 : 0;
      grid_getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, function (cell) {
        if (cell.has === building) {
          cell.has = null;
          cell.solid = false;
          cell.corpses.add(building);
        }
      });
      building.startTimeout(function () {
        return building.clear();
      }, RUBBLE_TIME);
      canUpdateMinimap(building, player) && menu.updatePlayerMiniMapEvt(building.owner);
    }
  }, {
    key: "clear",
    value: function clear() {
      var building = this.building;
      if (building.isDestroyed) {
        return;
      }
      clearTimeout(building.visibilityTimeout);
      var map = building.context.map;
      var dist = building.size === 3 ? 1 : 0;
      grid_getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, function (cell) {
        cell.corpses["delete"](building);
      });
      building.isDestroyed = true;
      building.destroy({
        child: true,
        texture: false
      });
    }
  }]);
}();
;// ./app/classes/building/BuildingProduction.js
function BuildingProduction_typeof(o) { "@babel/helpers - typeof"; return BuildingProduction_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BuildingProduction_typeof(o); }
function BuildingProduction_slicedToArray(r, e) { return BuildingProduction_arrayWithHoles(r) || BuildingProduction_iterableToArrayLimit(r, e) || BuildingProduction_unsupportedIterableToArray(r, e) || BuildingProduction_nonIterableRest(); }
function BuildingProduction_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function BuildingProduction_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return BuildingProduction_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? BuildingProduction_arrayLikeToArray(r, a) : void 0; } }
function BuildingProduction_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function BuildingProduction_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function BuildingProduction_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = BuildingProduction_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function BuildingProduction_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BuildingProduction_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BuildingProduction_toPropertyKey(o.key), o); } }
function BuildingProduction_createClass(e, r, t) { return r && BuildingProduction_defineProperties(e.prototype, r), t && BuildingProduction_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BuildingProduction_toPropertyKey(t) { var i = BuildingProduction_toPrimitive(t, "string"); return "symbol" == BuildingProduction_typeof(i) ? i : i + ""; }
function BuildingProduction_toPrimitive(t, r) { if ("object" != BuildingProduction_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BuildingProduction_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }




var BuildingProduction = /*#__PURE__*/function () {
  function BuildingProduction(building) {
    BuildingProduction_classCallCheck(this, BuildingProduction);
    this.building = building;
  }
  return BuildingProduction_createClass(BuildingProduction, [{
    key: "placeUnit",
    value: function placeUnit(type, extra) {
      var building = this.building;
      var _building$context = building.context,
        map = _building$context.map,
        menu = _building$context.menu;
      var spawnCell;
      var config = building.owner.config.units[type];
      if (config.category === 'Boat') {
        spawnCell = getFreeCellAroundPoint(building.i, building.j, building.size, map.grid, function (cell) {
          return cell.category === 'Water' && !cell.solid;
        });
      } else {
        spawnCell = getFreeCellAroundPoint(building.i, building.j, building.size, map.grid, function (cell) {
          return cell.category !== 'Water' && !cell.solid;
        });
      }
      if (!spawnCell) {
        return;
      }
      building.owner.population++;
      var unitExtra = extra || building.owner.getUnitExtraOptions && building.owner.getUnitExtraOptions(type) || {};
      building.owner.createUnit(_objectSpread({
        i: spawnCell.i,
        j: spawnCell.j,
        type: type
      }, unitExtra));
      if (building.owner.isPlayed && building.owner.selectedBuilding && building.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo(MENU_INFO_IDS.populationText, building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.population_max));
      }
    }
  }, {
    key: "buyUnit",
    value: function buyUnit(type) {
      var alreadyPaid = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var force = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var extra = arguments.length > 3 ? arguments[3] : undefined;
      var building = this.building;
      var _building$context2 = building.context,
        menu = _building$context2.menu,
        map = _building$context2.map;
      var success = false;
      var unit = building.owner.config.units[type];
      if (building.isBuilt && !building.isDead && (canAfford(building.owner, unit.cost) || alreadyPaid)) {
        if (!alreadyPaid) {
          if (building.owner.type === PLAYER_TYPES.ai) {
            if (!building.queue.length && building.loading === null) {
              payCost(building.owner, unit.cost);
              building.queue.push(type);
              success = true;
            }
          } else {
            payCost(building.owner, unit.cost);
            building.queue.push(type);
            if (building.selected && building.owner.isPlayed) {
              menu.updateButtonContent(type, building.queue.filter(function (q) {
                return q === type;
              }).length);
            }
            building.owner.isPlayed && menu.updateTopbar();
            success = true;
          }
        }
        if (building.loading === null && building.queue[0] || force) {
          var hasShowedMessage = false;
          building.loading = force ? building.loading : 0;
          if (building.selected && building.owner.isPlayed) {
            building.updateInterfaceLoading();
          }
          building.startInterval(function () {
            if (building.queue[0] !== type) {
              building.stopInterval();
              building.loading = null;
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true);
              }
              hasShowedMessage = false;
              if (building.selected && building.owner.isPlayed) {
                var still = building.queue.filter(function (q) {
                  return q === type;
                }).length;
                menu.updateButtonContent(type, still || '');
                if (still === 0) menu.toggleButtonCancel(type, false);
                building.updateInterfaceLoading();
              }
            } else if (building.loading >= 100 || map.devMode) {
              building.stopInterval();
              building.placeUnit(type, extra);
              building.loading = null;
              building.queue.shift();
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true);
              }
              hasShowedMessage = false;
              if (building.selected && building.owner.isPlayed) {
                var _still = building.queue.filter(function (q) {
                  return q === type;
                }).length;
                menu.updateButtonContent(type, _still || '');
                if (_still === 0) menu.toggleButtonCancel(type, false);
                building.updateInterfaceLoading();
              }
            } else if (building.loading < 100) {
              if (building.owner.population < Math.min(POPULATION_MAX, building.owner.population_max)) {
                building.loading += 10;
              } else if (building.owner.isPlayed && !hasShowedMessage) {
                menu.showMessage(t('needHouses'));
                hasShowedMessage = true;
              }
              if (building.selected && building.owner.isPlayed) {
                building.updateInterfaceLoading();
              }
            }
          }, unit.trainingTime);
        }
        return success;
      }
    }
  }, {
    key: "cancelTechnology",
    value: function cancelTechnology() {
      var building = this.building;
      var _building$context3 = building.context,
        player = _building$context3.player,
        menu = _building$context3.menu;
      building.stopInterval();
      refundCost(player, building.technology.cost);
      building.technology = null;
      building.loading = null;
      if (building.owner.isPlayed) {
        menu.updateBottombar();
        menu.updateTopbar();
      }
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      var building = this.building;
      var data = building.owner.config.buildings[type];
      building.type = type;
      building.hitPoints = data.totalHitPoints - (building.totalHitPoints - building.hitPoints);
      for (var _i = 0, _Object$entries = Object.entries(data); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = BuildingProduction_slicedToArray(_Object$entries[_i], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];
        building[key] = value;
      }
      var assets = getBuildingAsset(building.type, building.owner, lib/* Assets */.sP);
      building.sprite.texture = getTexture(assets.images["final"], lib/* Assets */.sP);
      building.sprite.anchor.set(building.sprite.texture.defaultAnchor.x, building.sprite.texture.defaultAnchor.y);
      var color = building.getChildByLabel(LABEL_TYPES.color);
      color === null || color === void 0 || color.destroy();
      if (assets.images.color) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(assets.images.color, lib/* Assets */.sP));
        spriteColor.label = LABEL_TYPES.color;
        changeSpriteColorDirectly(spriteColor, building.owner.color);
        building.addChild(spriteColor);
      } else {
        changeSpriteColorDirectly(building.sprite, building.owner.color);
      }
    }
  }, {
    key: "buyTechnology",
    value: function buyTechnology(type, alreadyPaid, force) {
      var building = this.building;
      var _building$context4 = building.context,
        menu = _building$context4.menu,
        map = _building$context4.map;
      var success = false;
      var config = building.owner.techs[type];
      if (!building.queue.length && building.isBuilt && (force || building.loading === null) && !building.isDead && (alreadyPaid || canAfford(building.owner, config.cost))) {
        !alreadyPaid && payCost(building.owner, config.cost);
        success = true;
        if (building.owner.isPlayed) {
          menu.updateTopbar();
        }
        building.loading = force ? building.loading : 0;
        building.technology = {
          config: config,
          type: type
        };
        if (building.selected && building.owner.selectedBuilding === building) {
          menu.setBottombar(building);
        }
        building.startInterval(function () {
          var _building$technology = building.technology,
            config = _building$technology.config,
            type = _building$technology.type;
          if (building.loading >= 100 || map.devMode) {
            building.stopInterval();
            building.loading = null;
            building.technology = null;
            if (Array.isArray(building.owner[config.key])) {
              building.owner[config.key].push(config.value || type);
            } else {
              building.owner[config.key] = config.value || type;
            }
            if (config.action) {
              switch (config.action.type) {
                case 'upgradeUnit':
                  for (var i = 0; i < building.owner.units.length; i++) {
                    var unit = building.owner.units[i];
                    if (unit.type === config.action.source) {
                      unit.upgrade(config.action.target);
                    }
                  }
                  break;
                case 'upgradeBuilding':
                  for (var _i2 = 0; _i2 < building.owner.buildings.length; _i2++) {
                    var target = building.owner.buildings[_i2];
                    if (target.type === config.action.source) {
                      target.upgrade(config.action.target);
                    }
                  }
                  break;
                case 'improve':
                  building.owner.updateConfig(config.action.operations);
                  break;
              }
            }
            var functionName = "on".concat(capitalizeFirstLetter(config.key), "Change");
            typeof building.owner[functionName] === 'function' && building.owner[functionName](config.value);
            if (building.owner.isPlayed) {
              menu.updateBottombar();
              menu.updateTopbar();
            }
          } else if (building.loading < 100) {
            building.loading += 10;
            if (building.owner.isPlayed && building.owner.selectedBuilding === building) {
              building.updateInterfaceLoading();
            }
          }
        }, config.researchTime);
      }
      return success;
    }
  }]);
}();
;// ./app/classes/projectile.js
function projectile_typeof(o) { "@babel/helpers - typeof"; return projectile_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, projectile_typeof(o); }
function projectile_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function projectile_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, projectile_toPropertyKey(o.key), o); } }
function projectile_createClass(e, r, t) { return r && projectile_defineProperties(e.prototype, r), t && projectile_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function projectile_toPropertyKey(t) { var i = projectile_toPrimitive(t, "string"); return "symbol" == projectile_typeof(i) ? i : i + ""; }
function projectile_toPrimitive(t, r) { if ("object" != projectile_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != projectile_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function projectile_callSuper(t, o, e) { return o = projectile_getPrototypeOf(o), projectile_possibleConstructorReturn(t, projectile_isNativeReflectConstruct() ? Reflect.construct(o, e || [], projectile_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function projectile_possibleConstructorReturn(t, e) { if (e && ("object" == projectile_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return projectile_assertThisInitialized(t); }
function projectile_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function projectile_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (projectile_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function projectile_getPrototypeOf(t) { return projectile_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, projectile_getPrototypeOf(t); }
function projectile_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && projectile_setPrototypeOf(t, e); }
function projectile_setPrototypeOf(t, e) { return projectile_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, projectile_setPrototypeOf(t, e); }




var Projectile = /*#__PURE__*/function (_Container) {
  function Projectile(options, context) {
    var _this;
    projectile_classCallCheck(this, Projectile);
    _this = projectile_callSuper(this, Projectile);
    _this.context = context;
    _this.label = uuidv4();
    _this.family = FAMILY_TYPES.projectile;
    Object.assign(_this, options);
    Object.assign(_this, _this.owner.owner.config.projectiles[_this.type]);
    _this.x = _this.owner.x;
    _this.y = _this.owner.y - _this.owner.sprite.height / 2;
    var targetPoint = _this.destination || _this.target;
    if (!targetPoint) {
      _this.isDead = true;
      return projectile_possibleConstructorReturn(_this);
    }
    var targetX = targetPoint.x,
      targetY = targetPoint.y;
    _this.context.controls.instanceInCamera(_this) && _this.sounds.start && sound_lib/* sound */.s3.play(Array.isArray(_this.sounds.start) ? maths_randomItem(_this.sounds.start) : _this.sounds.start);
    var degree = _this.degree || getPointsDegree(_this.x, _this.y, targetX, targetY);
    var sprite = new lib/* Graphics */.A1g();
    sprite.rect(1, 1, _this.size, 1);
    sprite.fill(COLOR_ARROW);
    sprite.rotation = degreesToRadians(degree);
    sprite.label = LABEL_TYPES.sprite;
    sprite.allowMove = false;
    sprite.eventMode = 'none';
    sprite.allowClick = false;
    sprite.roundPixels = true;
    _this.addChild(sprite);
    _this.interval = _this.context.scheduler.add(function () {
      if (pointsDistance(_this.x, _this.y, targetX, targetY) <= Math.max(_this.speed, _this.size)) {
        if (_this.target && !_this.target.isDead && !_this.target.isDestroyed && pointsDistance(targetX, targetY, _this.target.x, _this.target.y) <= average(_this.target.width, _this.target.height)) {
          _this.onHit(_this.target);
        }
        _this.die();
        return;
      }
      moveTowardPoint(_this, targetX, targetY, _this.speed);
    }, STEP_TIME);
    return _this;
  }
  projectile_inherits(Projectile, _Container);
  return projectile_createClass(Projectile, [{
    key: "onHit",
    value: function onHit(instance) {
      var _this$context = this.context,
        menu = _this$context.menu,
        player = _this$context.player;
      instance.hitPoints = getHitPointsWithDamage(this.owner, instance, this.damage);
      if (instance.selected && player.selectedOther === instance) {
        menu.updateInfo(MENU_INFO_IDS.hitPoints, instance.hitPoints + '/' + instance.totalHitPoints);
      }
      if (instance.hitPoints <= 0) {
        instance.die();
      } else {
        typeof instance.isAttacked === 'function' && instance.isAttacked(this.owner);
      }
    }
  }, {
    key: "die",
    value: function die() {
      this.isDead = true;
      this.context.scheduler.remove(this.interval);
      this.interval = null;
      this.destroy({
        child: true,
        texture: true
      });
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/classes/building/BuildingCombat.js
function BuildingCombat_typeof(o) { "@babel/helpers - typeof"; return BuildingCombat_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BuildingCombat_typeof(o); }
function BuildingCombat_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BuildingCombat_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BuildingCombat_toPropertyKey(o.key), o); } }
function BuildingCombat_createClass(e, r, t) { return r && BuildingCombat_defineProperties(e.prototype, r), t && BuildingCombat_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BuildingCombat_toPropertyKey(t) { var i = BuildingCombat_toPrimitive(t, "string"); return "symbol" == BuildingCombat_typeof(i) ? i : i + ""; }
function BuildingCombat_toPrimitive(t, r) { if ("object" != BuildingCombat_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BuildingCombat_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var BuildingCombat = /*#__PURE__*/function () {
  function BuildingCombat(building) {
    BuildingCombat_classCallCheck(this, BuildingCombat);
    this.building = building;
  }
  return BuildingCombat_createClass(BuildingCombat, [{
    key: "attackAction",
    value: function attackAction(target) {
      var building = this.building;
      var map = building.context.map;
      building.startAttackInterval(function () {
        if (extra_getActionCondition(building, target, ACTION_TYPES.attack) && instancesDistance(building, target) <= building.range) {
          var projectile = new Projectile({
            owner: building,
            type: building.projectile,
            target: target
          }, building.context);
          map.addChild(projectile);
        } else {
          building.stopAttackInterval();
        }
      }, building.rateOfFire);
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      var building = this.building;
      if (building.range && instance.family !== FAMILY_TYPES.animal && !building.attackIntervalId && extra_getActionCondition(building, instance, ACTION_TYPES.attack) && instancesDistance(building, instance) <= building.range) {
        this.attackAction(instance);
      }
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      var building = this.building;
      if (building.isDead) return;
      if (building.range && extra_getActionCondition(building, instance, ACTION_TYPES.attack) && instancesDistance(building, instance) <= building.range) {
        this.attackAction(instance);
      }
      building.updateHitPoints(ACTION_TYPES.attack);
    }
  }]);
}();
;// ./app/classes/building/index.js
function building_typeof(o) { "@babel/helpers - typeof"; return building_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, building_typeof(o); }
function building_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = building_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function building_toConsumableArray(r) { return building_arrayWithoutHoles(r) || building_iterableToArray(r) || building_unsupportedIterableToArray(r) || building_nonIterableSpread(); }
function building_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function building_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return building_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? building_arrayLikeToArray(r, a) : void 0; } }
function building_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function building_arrayWithoutHoles(r) { if (Array.isArray(r)) return building_arrayLikeToArray(r); }
function building_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function building_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function building_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, building_toPropertyKey(o.key), o); } }
function building_createClass(e, r, t) { return r && building_defineProperties(e.prototype, r), t && building_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function building_toPropertyKey(t) { var i = building_toPrimitive(t, "string"); return "symbol" == building_typeof(i) ? i : i + ""; }
function building_toPrimitive(t, r) { if ("object" != building_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != building_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function building_callSuper(t, o, e) { return o = building_getPrototypeOf(o), building_possibleConstructorReturn(t, building_isNativeReflectConstruct() ? Reflect.construct(o, e || [], building_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function building_possibleConstructorReturn(t, e) { if (e && ("object" == building_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return building_assertThisInitialized(t); }
function building_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function building_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (building_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _superPropGet(t, o, e, r) { var p = _get(building_getPrototypeOf(1 & r ? t.prototype : t), o, e); return 2 & r && "function" == typeof p ? function (t) { return p.apply(e, t); } : p; }
function _get() { return _get = "undefined" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function (e, t, r) { var p = _superPropBase(e, t); if (p) { var n = Object.getOwnPropertyDescriptor(p, t); return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value; } }, _get.apply(null, arguments); }
function _superPropBase(t, o) { for (; !{}.hasOwnProperty.call(t, o) && null !== (t = building_getPrototypeOf(t));); return t; }
function building_getPrototypeOf(t) { return building_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, building_getPrototypeOf(t); }
function building_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && building_setPrototypeOf(t, e); }
function building_setPrototypeOf(t, e) { return building_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, building_setPrototypeOf(t, e); }











var Building = /*#__PURE__*/function (_Instance) {
  function Building(options, context) {
    var _this$quantity, _this$hitPoints;
    var _this;
    building_classCallCheck(this, Building);
    _this = building_callSuper(this, Building, [context]);
    var map = context.map,
      controls = context.controls;
    _this.family = FAMILY_TYPES.building;
    _this.buildingInterface = new BuildingInterface(_this);
    _this.buildingLifecycle = new BuildingLifecycle(_this);
    _this.buildingProduction = new BuildingProduction(_this);
    _this.buildingCombat = new BuildingCombat(_this);
    _this.queue = [];
    _this.technology = null;
    _this.loading = null;
    _this.isUsedBy = null;
    Object.assign(_this, options);
    Object.assign(_this, _this.owner.config.buildings[_this.type]);
    _this.intervalId = null;
    _this.attackIntervalId = null;
    if (_this.queue.length) {
      _this.buyUnit(_this.queue[0], true, true);
    } else if (_this.technology) {
      _this.buyTechnology(_this.technology.type, true, true);
    }
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.isBuilt ? _this.totalHitPoints : 1;
    _this.x = map.grid[_this.i][_this.j].x;
    _this.y = map.grid[_this.i][_this.j].y;
    _this.z = map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.visible = map.revealEverything && controls.instanceInCamera(_this);
    var spriteSheet = getBuildingTextureNameWithSize(_this.size);
    if (_this.type === BUILDING_TYPES.house && _this.owner.age === 0) {
      spriteSheet = '000_489';
    } else if (_this.type === BUILDING_TYPES.dock) {
      spriteSheet = '000_356';
    }
    var texture = getTexture(spriteSheet, lib/* Assets */.sP);
    _this.sprite = lib/* Sprite */.kxk.from(texture);
    _this.sprite.updateAnchor = true;
    _this.sprite.label = LABEL_TYPES.sprite;
    _this.sprite.hitArea = texture.hitArea ? new lib/* Polygon */.tS(texture.hitArea) : new lib/* Polygon */.tS([-32 * _this.size, 0, 0, -16 * _this.size, 32 * _this.size, 0, 0, 16 * _this.size]);
    var units = (_this.units || []).map(function (key) {
      return context.menu.getUnitButton(key);
    });
    var technologies = (_this.technologies || []).map(function (key) {
      return context.menu.getTechnologyButton(key);
    });
    _this["interface"] = {
      info: function info(element) {
        var assets = getBuildingAsset(_this.type, _this.owner, lib/* Assets */.sP);
        _this.buildingInterface.renderInfo(element, assets);
      },
      menu: _this.owner.isPlayed || map.devMode ? [].concat(building_toConsumableArray(units), building_toConsumableArray(technologies)) : []
    };

    // Set solid zone
    var dist = _this.size === 3 ? 1 : 0;
    grid_getPlainCellsAroundPoint(_this.i, _this.j, map.grid, dist, function (cell) {
      var set = cell.getChildByLabel(LABEL_TYPES.set);
      if (set) {
        cell.removeChild(set);
      }
      var _iterator = building_createForOfIteratorHelper(cell.corpses),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var corpse = _step.value;
          typeof corpse.clear === 'function' && corpse.clear();
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      cell.has = _this;
      cell.solid = true;
      _this.owner.views[cell.i][cell.j].viewBy.add(_this);
      if (_this.owner.isPlayed && !map.revealEverything) {
        cell.removeFog();
      }
    });
    _this.allowMove = false;
    if (_this.sprite) {
      _this.sprite.allowMove = false;
      _this.sprite.eventMode = 'static';
      _this.sprite.roundPixels = true;
      _this.sprite.on('pointertap', function (evt) {
        var _this2 = _this,
          _this2$context = _this2.context,
          controls = _this2$context.controls,
          player = _this2$context.player,
          menu = _this2$context.menu;
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return;
        }
        var hasSentVillager = false;
        var hasSentOther = false;
        controls.mouse.prevent = true;
        if (_this.owner.isPlayed) {
          // Send Villager to build the building
          if (!_this.isBuilt) {
            for (var i = 0; i < player.selectedUnits.length; i++) {
              var unit = player.selectedUnits[i];
              if (unit.type === UNIT_TYPES.villager) {
                if (extra_getActionCondition(unit, _this, ACTION_TYPES.build)) {
                  hasSentVillager = true;
                  unit.sendToBuilding(_this);
                }
              } else {
                unit.sendTo(_this);
                hasSentOther = true;
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(_this);
            }
            if (hasSentOther) {
              var voice = maths_randomItem(['5075', '5076', '5128', '5164']);
              sound_lib/* sound */.s3.play(voice);
              return;
            } else if (hasSentVillager) {
              var _voice = lib/* Assets */.sP.cache.get('config').units.Villager.sounds.build;
              sound_lib/* sound */.s3.play(_voice);
              return;
            }
          } else if (player.selectedUnits) {
            // Send Villager to give loading of resources
            for (var _i = 0; _i < player.selectedUnits.length; _i++) {
              var _unit = player.selectedUnits[_i];
              var accept = _unit.category === 'Boat' ? _this.type === BUILDING_TYPES.dock : _this.type === BUILDING_TYPES.townCenter || _this.accept && _this.accept.includes(_unit.loadingType);
              if (_unit.type === UNIT_TYPES.villager && extra_getActionCondition(_unit, _this, ACTION_TYPES.build)) {
                hasSentVillager = true;
                _unit.previousDest = null;
                _unit.sendToBuilding(_this);
              } else if (_unit.type === UNIT_TYPES.villager && extra_getActionCondition(_unit, _this, ACTION_TYPES.farm)) {
                hasSentVillager = true;
                _unit.sendToFarm(_this);
              } else if (accept && extra_getActionCondition(_unit, _this, ACTION_TYPES.delivery, {
                buildingTypes: [_this.type]
              })) {
                hasSentVillager = true;
                _unit.previousDest = null;
                _unit.sendTo(_this, ACTION_TYPES.delivery);
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(_this);
              var _voice2 = lib/* Assets */.sP.cache.get('config').units.Villager.sounds.build;
              sound_lib/* sound */.s3.play(_voice2);
              return;
            }
          }
          if (_this.owner.selectedBuilding !== _this) {
            _this.owner.unselectAll();
            _this.select();
            menu.setBottombar(_this);
            _this.owner.selectedBuilding = _this;
          }
        } else if (player.selectedUnits.length) {
          drawInstanceBlinkingSelection(_this);
          for (var _i2 = 0; _i2 < player.selectedUnits.length; _i2++) {
            var playerUnit = player.selectedUnits[_i2];
            if (playerUnit.type === UNIT_TYPES.villager) {
              playerUnit.sendToAttack(_this);
            } else {
              playerUnit.sendTo(_this, ACTION_TYPES.attack);
            }
          }
        } else if (instanceIsInPlayerSight(_this, player) || map.revealEverything) {
          player.unselectAll();
          _this.select();
          menu.setBottombar(_this);
          player.selectedOther = _this;
        }
      });
      _this.addChild(_this.sprite);
    }
    if (_this.isBuilt) {
      _this.visibilityTimeout = setTimeout(function () {
        updateInstanceVisibility(_this);
      });
      _this.finalTexture();
      _this.onBuilt();
    }
    map.addToInstanceBucket(_this);
    return _this;
  }
  building_inherits(Building, _Instance);
  return building_createClass(Building, [{
    key: "attackAction",
    value: function attackAction(target) {
      return this.buildingCombat.attackAction(target);
    }
  }, {
    key: "startInterval",
    value: function startInterval(callback, time) {
      this.stopInterval();
      this.intervalId = this.context.scheduler.add(callback, time * 1000 / 10 / ACCELERATOR);
    }
  }, {
    key: "stopInterval",
    value: function stopInterval() {
      if (this.intervalId != null) {
        this.context.scheduler.remove(this.intervalId);
        this.intervalId = null;
      }
    }
  }, {
    key: "startAttackInterval",
    value: function startAttackInterval(callback, time) {
      this.stopAttackInterval();
      callback();
      this.attackIntervalId = this.context.scheduler.add(callback, time * 1000);
    }
  }, {
    key: "stopAttackInterval",
    value: function stopAttackInterval() {
      if (this.attackIntervalId != null) {
        this.context.scheduler.remove(this.attackIntervalId);
        this.attackIntervalId = null;
      }
    }
  }, {
    key: "startTimeout",
    value: function startTimeout(cb, time) {
      this.stopTimeout();
      this.timeoutId = this.context.scheduler.addOneShot(cb, time * 1000 / ACCELERATOR);
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      return this.buildingCombat.isAttacked(instance);
    }
  }, {
    key: "updateTexture",
    value: function updateTexture() {
      var menu = this.context.menu;
      var percentage = getPercentage(this.hitPoints, this.totalHitPoints);
      var buildSpritesheetId = this.sprite.texture.label.split('_')[1].split('.')[0];
      var buildSpritesheet = lib/* Assets */.sP.cache.get(buildSpritesheetId);
      if (percentage >= 25 && percentage < 50) {
        var textureName = "001_".concat(buildSpritesheetId, ".png");
        this.sprite.texture = buildSpritesheet.textures[textureName];
      } else if (percentage >= 50 && percentage < 75) {
        var _textureName = "002_".concat(buildSpritesheetId, ".png");
        this.sprite.texture = buildSpritesheet.textures[_textureName];
      } else if (percentage >= 75 && percentage < 99) {
        var _textureName2 = "003_".concat(buildSpritesheetId, ".png");
        this.sprite.texture = buildSpritesheet.textures[_textureName2];
      } else if (percentage >= 100) {
        this.finalTexture();
        if (!this.isBuilt) {
          if (this.owner.isPlayed && this.sounds && this.sounds.create && this.context.controls.instanceInCamera(this)) {
            sound_lib/* sound */.s3.play(this.sounds.create);
          }
          this.onBuilt();
        }
        this.isBuilt = true;
        if (!this.owner.hasBuilt.includes(this.type)) {
          this.owner.hasBuilt.push(this.type);
        }
        if (this.owner.isPlayed && this.selected) {
          menu.setBottombar(this);
        }
        updateInstanceVisibility(this);
      }
    }
  }, {
    key: "onBuilt",
    value: function onBuilt() {
      var menu = this.context.menu;
      if (this.increasePopulation) {
        // Increase player population and continue all unit creation that was paused
        this.owner.population_max += this.increasePopulation;
        // Update bottombar with population_max if house selected
        if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
          menu.updateInfo(MENU_INFO_IDS.populationText, this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.population_max));
        }
      }
      if (this.owner.isPlayed && this.selected) {
        menu.setBottombar(this);
      }
    }
  }, {
    key: "finalTexture",
    value: function finalTexture() {
      var assets = getBuildingAsset(this.type, this.owner, lib/* Assets */.sP);
      var texture = getTexture(assets.images["final"], lib/* Assets */.sP);
      this.sprite.texture = texture;
      this.sprite.hitArea = texture.hitArea ? new lib/* Polygon */.tS(texture.hitArea) : new lib/* Polygon */.tS([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size]);
      this.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y);
      var color = this.getChildByLabel(LABEL_TYPES.color);
      if (color) {
        color.destroy();
      }
      if (assets.images.color) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(assets.images.color, lib/* Assets */.sP));
        spriteColor.label = LABEL_TYPES.color;
        changeSpriteColorDirectly(spriteColor, this.owner.color);
        this.addChild(spriteColor);
      } else {
        changeSpriteColorDirectly(this.sprite, this.owner.color);
      }
      if (this.type === BUILDING_TYPES.house) {
        if (this.owner.age === 0) {
          var spritesheetFire = lib/* Assets */.sP.cache.get('347');
          var spriteFire = new lib/* AnimatedSprite */.Dl5(spritesheetFire.animations['fire']);
          spriteFire.label = LABEL_TYPES.deco;
          spriteFire.allowMove = false;
          spriteFire.allowClick = false;
          spriteFire.eventMode = 'none';
          spriteFire.roundPixels = true;
          spriteFire.x = 10;
          spriteFire.y = 5;
          spriteFire.play();
          spriteFire.animationSpeed = 0.2 * ACCELERATOR;
          this.addChild(spriteFire);
        } else {
          var fire = this.getChildByLabel(LABEL_TYPES.deco);
          if (fire) {
            fire.destroy();
          }
        }
      }
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      return this.buildingCombat.detect(instance);
    }
  }, {
    key: "updateHitPoints",
    value: function updateHitPoints(action) {
      if (this.hitPoints > this.totalHitPoints) {
        this.hitPoints = this.totalHitPoints;
      }
      var percentage = getPercentage(this.hitPoints, this.totalHitPoints);
      if (this.hitPoints <= 0) {
        this.die();
      }
      if (action === ACTION_TYPES.build && !this.isBuilt) {
        this.updateTexture();
      } else if (action === ACTION_TYPES.attack && this.isBuilt || action === ACTION_TYPES.build && this.isBuilt) {
        if (percentage > 0 && percentage < 25) {
          this.generateFire('450');
        } else if (percentage >= 25 && percentage < 50) {
          this.generateFire('452');
        } else if (percentage >= 50 && percentage < 75) {
          this.generateFire('347');
        } else if (percentage >= 75) {
          var fire = this.getChildByLabel(LABEL_TYPES.fire);
          if (fire) {
            this.removeChild(fire);
          }
        }
      }
    }
  }, {
    key: "generateFire",
    value: function generateFire(spriteId) {
      var fire = this.getChildByLabel(LABEL_TYPES.fire);
      var spritesheetFire = lib/* Assets */.sP.cache.get(spriteId);
      if (fire) {
        for (var i = 0; i < fire.children.length; i++) {
          fire.children[i].textures = spritesheetFire.animations['fire'];
          fire.children[i].play();
        }
      } else {
        var newFire = new lib/* Container */.mcf();
        newFire.label = LABEL_TYPES.fire;
        newFire.allowMove = false;
        newFire.allowClick = false;
        newFire.eventMode = 'none';
        var poses = [[0, 0]];
        if (this.size === 3) {
          poses = [[0, -32], [-64, 0], [0, 32], [64, 0]];
        }
        for (var _i3 = 0; _i3 < poses.length; _i3++) {
          var spriteFire = new lib/* AnimatedSprite */.Dl5(spritesheetFire.animations['fire']);
          spriteFire.allowMove = false;
          spriteFire.allowClick = false;
          spriteFire.eventMode = 'none';
          spriteFire.roundPixels = true;
          spriteFire.x = poses[_i3][0];
          spriteFire.y = poses[_i3][1];
          spriteFire.play();
          spriteFire.animationSpeed = 0.2 * ACCELERATOR;
          newFire.addChild(spriteFire);
        }
        this.addChild(newFire);
      }
    }
  }, {
    key: "die",
    value: function die() {
      return this.buildingLifecycle.die();
    }
  }, {
    key: "clear",
    value: function clear() {
      return this.buildingLifecycle.clear();
    }
  }, {
    key: "select",
    value: function select() {
      var _this$sounds;
      if (this.selected) return;
      var _this$context = this.context,
        menu = _this$context.menu,
        player = _this$context.player;
      if (this.owner.isPlayed && (_this$sounds = this.sounds) !== null && _this$sounds !== void 0 && _this$sounds.create) sound_lib/* sound */.s3.play(this.sounds.create);
      _superPropGet(Building, "select", this, 3)([]);
      if (this.loading && this.owner.isPlayed) this.updateInterfaceLoading();
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) return;
      _superPropGet(Building, "unselect", this, 3)([]);
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        player = _this$context2.player;
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "placeUnit",
    value: function placeUnit(type) {
      return this.buildingProduction.placeUnit(type);
    }
  }, {
    key: "buyUnit",
    value: function buyUnit(type) {
      var alreadyPaid = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var force = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var extra = arguments.length > 3 ? arguments[3] : undefined;
      return this.buildingProduction.buyUnit(type, alreadyPaid, force, extra);
    }
  }, {
    key: "updateInterfaceLoading",
    value: function updateInterfaceLoading() {
      this.buildingInterface.updateLoading();
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      return this.buildingInterface.getLoadingElement();
    }
  }, {
    key: "cancelTechnology",
    value: function cancelTechnology() {
      return this.buildingProduction.cancelTechnology();
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      return this.buildingProduction.upgrade(type);
    }
  }, {
    key: "buyTechnology",
    value: function buyTechnology(type, alreadyPaid, force) {
      return this.buildingProduction.buyTechnology(type, alreadyPaid, force);
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      this.buildingInterface.setDefaultInterface(element, data);
    }
  }, {
    key: "pause",
    value: function pause() {
      var fire = this.getChildByLabel(LABEL_TYPES.fire);
      if (fire) fire.children.forEach(function (s) {
        return s.stop();
      });
      var deco = this.getChildByLabel(LABEL_TYPES.deco);
      if (deco && typeof deco.stop === 'function') deco.stop();
    }
  }, {
    key: "resume",
    value: function resume() {
      var fire = this.getChildByLabel(LABEL_TYPES.fire);
      if (fire) fire.children.forEach(function (s) {
        return s.play();
      });
      var deco = this.getChildByLabel(LABEL_TYPES.deco);
      if (deco && typeof deco.play === 'function') deco.play();
    }
  }]);
}(Instance);
;// ./app/ui/UnitInterface.js
function UnitInterface_typeof(o) { "@babel/helpers - typeof"; return UnitInterface_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitInterface_typeof(o); }
function UnitInterface_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitInterface_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitInterface_toPropertyKey(o.key), o); } }
function UnitInterface_createClass(e, r, t) { return r && UnitInterface_defineProperties(e.prototype, r), t && UnitInterface_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitInterface_toPropertyKey(t) { var i = UnitInterface_toPrimitive(t, "string"); return "symbol" == UnitInterface_typeof(i) ? i : i + ""; }
function UnitInterface_toPrimitive(t, r) { if ("object" != UnitInterface_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitInterface_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var UnitInterface = /*#__PURE__*/function () {
  function UnitInterface(unit) {
    UnitInterface_classCallCheck(this, UnitInterface);
    this.unit = unit;
  }
  return UnitInterface_createClass(UnitInterface, [{
    key: "updateLoading",
    value: function updateLoading() {
      var unit = this.unit;
      var menu = unit.context.menu;
      if (unit.selected && unit.owner.isPlayed && unit.owner.selectedUnit === unit) {
        if (unit.loading === 1) {
          var iconSrc = menu.infoIcons[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType];
          menu.updateInfo(MENU_INFO_IDS.loading, function (element) {
            element.replaceChildren();
            var iconImg = document.createElement('img');
            iconImg.className = 'unit-loading-icon';
            iconImg.src = iconSrc;
            var textDiv = document.createElement('div');
            textDiv.id = MENU_INFO_IDS.loadingText;
            textDiv.textContent = unit.loading;
            element.appendChild(iconImg);
            element.appendChild(textDiv);
          });
        } else if (unit.loading > 1) {
          menu.updateInfo(MENU_INFO_IDS.loadingText, unit.loading);
        } else {
          menu.updateInfo(MENU_INFO_IDS.loading, function (element) {
            return element.innerHTML = '';
          });
        }
      }
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      var unit = this.unit;
      var menu = unit.context.menu;
      var loadingDiv = document.createElement('div');
      loadingDiv.className = 'unit-loading';
      loadingDiv.id = MENU_INFO_IDS.loading;
      if (unit.loading) {
        var iconImg = document.createElement('img');
        iconImg.className = 'unit-loading-icon';
        iconImg.src = menu.infoIcons[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType];
        var textDiv = document.createElement('div');
        textDiv.id = MENU_INFO_IDS.loadingText;
        textDiv.textContent = unit.loading;
        loadingDiv.appendChild(iconImg);
        loadingDiv.appendChild(textDiv);
      }
      return loadingDiv;
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var unit = this.unit;
      var civDiv = document.createElement('div');
      civDiv.id = MENU_INFO_IDS.civ;
      civDiv.textContent = t(unit.owner.civ);
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = MENU_INFO_IDS.type;
      typeDiv.textContent = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type);
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = MENU_INFO_IDS.icon;
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      var hitPointsDiv = document.createElement('div');
      hitPointsDiv.id = MENU_INFO_IDS.hitPoints;
      hitPointsDiv.textContent = unit.hitPoints + '/' + unit.totalHitPoints;
      element.appendChild(hitPointsDiv);
      var infosDiv = document.createElement('div');
      infosDiv.id = 'infos';
      var infos = [['meleeAttack', '007_50731'], ['pierceAttack', '006_50731'], ['meleeArmor', '008_50731'], ['pierceArmor', '010_50731']];
      for (var i = 0; i < infos.length; i++) {
        var info = infos[i];
        if (data[info[0]]) {
          var infoDiv = document.createElement('div');
          infoDiv.id = 'info';
          var attackImg = document.createElement('img');
          attackImg.src = getIconPath(info[1]);
          var attackDiv = document.createElement('div');
          attackDiv.id = info[0];
          attackDiv.textContent = data[info[0]];
          infoDiv.appendChild(attackImg);
          infoDiv.appendChild(attackDiv);
          infosDiv.appendChild(infoDiv);
        }
      }
      element.appendChild(infosDiv);
    }
  }]);
}();
;// ./app/classes/unit/UnitCommands.js
function UnitCommands_typeof(o) { "@babel/helpers - typeof"; return UnitCommands_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitCommands_typeof(o); }
function UnitCommands_slicedToArray(r, e) { return UnitCommands_arrayWithHoles(r) || UnitCommands_iterableToArrayLimit(r, e) || UnitCommands_unsupportedIterableToArray(r, e) || UnitCommands_nonIterableRest(); }
function UnitCommands_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function UnitCommands_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return UnitCommands_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? UnitCommands_arrayLikeToArray(r, a) : void 0; } }
function UnitCommands_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function UnitCommands_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function UnitCommands_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function UnitCommands_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitCommands_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitCommands_toPropertyKey(o.key), o); } }
function UnitCommands_createClass(e, r, t) { return r && UnitCommands_defineProperties(e.prototype, r), t && UnitCommands_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitCommands_toPropertyKey(t) { var i = UnitCommands_toPrimitive(t, "string"); return "symbol" == UnitCommands_typeof(i) ? i : i + ""; }
function UnitCommands_toPrimitive(t, r) { if ("object" != UnitCommands_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitCommands_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



function getActionSheet(work, action, unit) {
  if (!work) {
    return;
  }
  var actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action;
  return lib/* Assets */.sP.cache.get(unit.allAssets[work][actionSheet]);
}
var UnitCommands = /*#__PURE__*/function () {
  function UnitCommands(unit) {
    UnitCommands_classCallCheck(this, UnitCommands);
    this.unit = unit;
  }
  return UnitCommands_createClass(UnitCommands, [{
    key: "commonSendTo",
    value: function commonSendTo(target, work, action, keepPrevious) {
      var immediate = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
      var unit = this.unit;
      var menu = unit.context.menu;
      var workFromLoading = getWorkWithLoadingType(unit.loadingType);
      if (work !== WORK_TYPES.builder && work !== workFromLoading && !(WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(workFromLoading))) {
        unit.loading = 0;
        unit.loadingType = null;
        unit.updateInterfaceLoading();
      }
      if (unit.work !== work || unit.action !== action) {
        unit.work = work;
        unit.owner.isPlayed && unit.owner.selectedUnit === unit && menu.updateInfo(MENU_INFO_IDS.type, unit.work);
        if (unit.allAssets && unit.allAssets[work]) {
          unit.actionSheet = getActionSheet(work, action, unit);
          if (!unit.loading) {
            unit.standingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[work][SHEET_TYPES.standing]);
            unit.walkingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[work][SHEET_TYPES.walking]);
            unit.dyingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[work][SHEET_TYPES.dying]);
            unit.corpseSheet = lib/* Assets */.sP.cache.get(unit.allAssets[work][SHEET_TYPES.corpse]);
          }
        }
      }
      unit.previousDest = keepPrevious ? unit.previousDest : null;
      return immediate ? unit.sendToEvt(target, action) : unit.sendTo(target, action);
    }
  }, {
    key: "sendToWithCell",
    value: function sendToWithCell(target, arrivalCell, action) {
      var unit = this.unit;
      var map = unit.context.map;
      unit.handleChangeDest();
      unit.stopInterval();
      if (!target || target.isDestroyed || unit.isDead || !arrivalCell) return;
      if (unit.isUnitAtDest(action, target)) {
        unit.setDest(target);
        unit.action = action;
        unit.degree = getInstanceDegree(unit, target.x, target.y);
        unit.getAction(action);
        return;
      }
      var path = getInstancePath(unit, arrivalCell.i, arrivalCell.j, map);
      if (path.length) {
        unit.setDest(target);
        unit.action = action;
        unit.setPath(path);
      } else {
        unit.sendToEvt(target, action);
      }
    }
  }, {
    key: "sendToDelivery",
    value: function sendToDelivery() {
      var unit = this.unit;
      var map = unit.context.map;
      var buildingTypes = [];
      if (unit.category === 'Boat') {
        buildingTypes = [BUILDING_TYPES.dock];
      } else {
        buildingTypes = [BUILDING_TYPES.townCenter];
        var buildings = {
          Granary: unit.owner.config.buildings.Granary,
          StoragePit: unit.owner.config.buildings.StoragePit
        };
        for (var _i = 0, _Object$entries = Object.entries(buildings); _i < _Object$entries.length; _i++) {
          var _Object$entries$_i = UnitCommands_slicedToArray(_Object$entries[_i], 2),
            key = _Object$entries$_i[0],
            value = _Object$entries$_i[1];
          if (value.accept && value.accept.includes(unit.loadingType)) {
            buildingTypes.push(key);
            break;
          }
        }
      }
      var targets = unit.owner.buildings.filter(function (building) {
        return extra_getActionCondition(unit, building, ACTION_TYPES.delivery, {
          buildingTypes: buildingTypes
        });
      });
      var target = getClosestInstance(unit, targets);
      if (!target) {
        unit.stop();
        return;
      }
      if (unit.dest) {
        unit.previousDest = unit.dest;
      } else {
        unit.previousDest = map.grid[unit.i][unit.j];
      }
      unit.sendTo(target, ACTION_TYPES.delivery);
    }
  }, {
    key: "sendToFish",
    value: function sendToFish(target) {
      return this.commonSendTo(target, WORK_TYPES.fisher, ACTION_TYPES.fishing);
    }
  }, {
    key: "sendToAttack",
    value: function sendToAttack(target) {
      return this.commonSendTo(target, WORK_TYPES.attacker, ACTION_TYPES.attack, {
        resource: 'attack'
      });
    }
  }, {
    key: "sendToTakeMeat",
    value: function sendToTakeMeat(target) {
      var immediate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      return this.commonSendTo(target, WORK_TYPES.hunter, ACTION_TYPES.takemeat, {
        actionSheet: SHEET_TYPES.harvest
      }, immediate);
    }
  }, {
    key: "sendToHunt",
    value: function sendToHunt(target) {
      return this.commonSendTo(target, WORK_TYPES.hunter, ACTION_TYPES.hunt);
    }
  }, {
    key: "sendToBuilding",
    value: function sendToBuilding(target) {
      return this.commonSendTo(target, WORK_TYPES.builder, ACTION_TYPES.build);
    }
  }, {
    key: "sendToFarm",
    value: function sendToFarm(target) {
      return this.commonSendTo(target, WORK_TYPES.farmer, ACTION_TYPES.farm);
    }
  }, {
    key: "sendToTree",
    value: function sendToTree(target) {
      return this.commonSendTo(target, WORK_TYPES.woodcutter, ACTION_TYPES.chopwood);
    }
  }, {
    key: "sendToBerrybush",
    value: function sendToBerrybush(target) {
      return this.commonSendTo(target, WORK_TYPES.forager, ACTION_TYPES.forageberry);
    }
  }, {
    key: "sendToStone",
    value: function sendToStone(target) {
      return this.commonSendTo(target, WORK_TYPES.stoneminer, ACTION_TYPES.minestone);
    }
  }, {
    key: "sendToGold",
    value: function sendToGold(target) {
      return this.commonSendTo(target, WORK_TYPES.goldminer, ACTION_TYPES.minegold);
    }
  }]);
}();
;// ./app/classes/unit/UnitLifecycle.js
function UnitLifecycle_typeof(o) { "@babel/helpers - typeof"; return UnitLifecycle_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitLifecycle_typeof(o); }
function UnitLifecycle_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitLifecycle_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitLifecycle_toPropertyKey(o.key), o); } }
function UnitLifecycle_createClass(e, r, t) { return r && UnitLifecycle_defineProperties(e.prototype, r), t && UnitLifecycle_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitLifecycle_toPropertyKey(t) { var i = UnitLifecycle_toPrimitive(t, "string"); return "symbol" == UnitLifecycle_typeof(i) ? i : i + ""; }
function UnitLifecycle_toPrimitive(t, r) { if ("object" != UnitLifecycle_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitLifecycle_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var UnitLifecycle = /*#__PURE__*/function () {
  function UnitLifecycle(unit) {
    UnitLifecycle_classCallCheck(this, UnitLifecycle);
    this.unit = unit;
  }
  return UnitLifecycle_createClass(UnitLifecycle, [{
    key: "decompose",
    value: function decompose() {
      var unit = this.unit;
      var map = unit.context.map;
      unit.setTextures(SHEET_TYPES.corpse);
      unit.sprite.animationSpeed = 1 / (CORPSE_TIME * 1000) * ACCELERATOR;
      if (map.grid[unit.i][unit.j].has === unit) {
        map.grid[unit.i][unit.j].has = null;
        map.grid[unit.i][unit.j].corpses.add(unit);
        map.grid[unit.i][unit.j].solid = false;
      }
    }
  }, {
    key: "death",
    value: function death() {
      var _this = this;
      var unit = this.unit;
      unit.setTextures(SHEET_TYPES.dying);
      unit.zIndex--;
      unit.sprite.loop = false;
      unit.sprite.onComplete = function () {
        updateInstanceVisibility(unit);
        var index = unit.owner.corpses.indexOf(unit);
        if (index < 0) {
          unit.owner.corpses.push(unit);
        }
        _this.decompose();
      };
    }
  }, {
    key: "die",
    value: function die() {
      var unit = this.unit;
      if (unit.isDead) {
        return;
      }
      var _unit$context = unit.context,
        player = _unit$context.player,
        menu = _unit$context.menu;
      unit.sounds && unit.sounds.die && unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play(Array.isArray(unit.sounds.die) ? maths_randomItem(unit.sounds.die) : unit.sounds.die);
      unit.stopInterval();
      clearTimeout(unit.visibilityTimeout);
      if (unit.selected && player.selectedOther === unit) {
        player.unselectUnit(unit);
      }
      if (unit.dest && unit.dest.isUsedBy === unit) {
        unit.dest.isUsedBy = null;
      }
      unit.hitPoints = 0;
      unit.path = [];
      unit.action = null;
      unit.eventMode = 'none';
      unit.isDead = true;
      unit.context.map.removeFromInstanceBucket(unit);
      unit.unselect();
      if (unit.owner) {
        unit.owner.population--;
        if (unit.owner.isPlayed && unit.owner.selectedBuilding && unit.owner.selectedBuilding.displayPopulation) {
          menu.updateInfo(MENU_INFO_IDS.populationText, unit.owner.population + '/' + Math.min(POPULATION_MAX, unit.owner.population_max));
        }
        var index = unit.owner.units.indexOf(unit);
        if (index >= 0) {
          unit.owner.units.splice(index, 1);
        }
        if (unit.owner.selectedUnit === unit) {
          menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.hitPoints + '/' + unit.totalHitPoints);
        }
      }
      this.death();
      canUpdateMinimap(unit, player) && menu.updatePlayerMiniMapEvt(unit.owner);
    }
  }, {
    key: "clear",
    value: function clear() {
      var unit = this.unit;
      var map = unit.context.map;
      unit.isDestroyed = true;
      var index = unit.owner.corpses.indexOf(unit);
      if (index >= 0) {
        unit.owner.corpses.splice(index, 1);
      }
      map.grid[unit.i][unit.j].corpses["delete"](unit);
      map.removeChild(unit);
      unit.destroy({
        child: true,
        texture: true
      });
    }
  }]);
}();
;// ./app/classes/unit/UnitCombat.js
function UnitCombat_typeof(o) { "@babel/helpers - typeof"; return UnitCombat_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitCombat_typeof(o); }
function UnitCombat_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitCombat_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitCombat_toPropertyKey(o.key), o); } }
function UnitCombat_createClass(e, r, t) { return r && UnitCombat_defineProperties(e.prototype, r), t && UnitCombat_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitCombat_toPropertyKey(t) { var i = UnitCombat_toPrimitive(t, "string"); return "symbol" == UnitCombat_typeof(i) ? i : i + ""; }
function UnitCombat_toPrimitive(t, r) { if ("object" != UnitCombat_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitCombat_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }





var UnitCombat = /*#__PURE__*/function () {
  function UnitCombat(unit) {
    UnitCombat_classCallCheck(this, UnitCombat);
    this.unit = unit;
  }
  return UnitCombat_createClass(UnitCombat, [{
    key: "detect",
    value: function detect(instance) {
      var unit = this.unit;
      if (unit.work === WORK_TYPES.attacker && instance && instance.family === FAMILY_TYPES.unit && !unit.path.length && !unit.dest && unit.getActionCondition(instance, ACTION_TYPES.attack)) {
        unit.sendTo(instance, ACTION_TYPES.attack);
      }
    }
  }, {
    key: "handleAffectNewDestHunter",
    value: function handleAffectNewDestHunter() {
      var unit = this.unit;
      var firstTargets = findInstancesInSight(unit, function (instance) {
        return unit.getActionCondition(instance, ACTION_TYPES.takemeat);
      });
      if (firstTargets.length) {
        var target = getClosestInstanceWithPath(unit, firstTargets);
        if (target) {
          if (unit.action !== ACTION_TYPES.takemeat) {
            unit.action = ACTION_TYPES.takemeat;
            if (unit.allAssets[unit.work]) {
              unit.actionSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].harvestSheet);
            }
          }
          if (instanceContactInstance(unit, target)) {
            unit.degree = getInstanceDegree(unit, target.x, target.y);
            unit.getAction(unit.action);
            return true;
          }
          unit.setDest(target.instance);
          unit.setPath(target.path);
          return true;
        }
      }
      var secondTargets = findInstancesInSight(unit, function (instance) {
        return unit.getActionCondition(instance, ACTION_TYPES.hunt);
      });
      if (secondTargets.length) {
        var _target = getClosestInstanceWithPath(unit, secondTargets);
        if (_target) {
          if (unit.action !== ACTION_TYPES.hunt) {
            unit.action = ACTION_TYPES.hunt;
            if (unit.allAssets[unit.work]) {
              unit.actionSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].actionSheet);
            }
          }
          if (instanceContactInstance(unit, _target)) {
            unit.degree = getInstanceDegree(unit, _target.x, _target.y);
            unit.getAction(unit.action);
            return true;
          }
          unit.setDest(_target.instance);
          unit.setPath(_target.path);
          return true;
        }
      }
      return false;
    }
  }, {
    key: "syncMovingTargetDirection",
    value: function syncMovingTargetDirection() {
      var unit = this.unit;
      if (unit.destHasMoved()) {
        unit.realDest.i = unit.dest.i;
        unit.realDest.j = unit.dest.j;
        unit.realDest.x = unit.dest.x;
        unit.realDest.y = unit.dest.y;
        var oldDeg = unit.degree;
        unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y);
        if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
          unit.setTextures(SHEET_TYPES.action);
        }
      }
    }
  }, {
    key: "handleAttackAction",
    value: function handleAttackAction() {
      var _this = this;
      var unit = this.unit;
      var _unit$context = unit.context,
        map = _unit$context.map,
        menu = _unit$context.menu,
        player = _unit$context.player;
      if (!unit.getActionCondition(unit.dest)) {
        unit.affectNewDest();
        return;
      }
      unit.setTextures(SHEET_TYPES.action);
      if (unit.range && unit.type !== UNIT_TYPES.villager) {
        unit.sprite.onLoop = function () {
          if (!unit.getActionCondition(unit.dest)) {
            if (unit.dest && unit.dest.hitPoints <= 0) {
              unit.dest.die();
            }
            unit.affectNewDest();
            return;
          }
          if (!unit.isUnitAtDest(unit.action, unit.dest)) {
            unit.stop();
            return;
          }
          _this.syncMovingTargetDirection();
        };
        onSpriteLoopAtFrame(unit.sprite, 6, function () {
          if (!unit.getActionCondition(unit.dest) || !unit.realDest) return;
          var projectile = new Projectile({
            owner: unit,
            target: unit.dest,
            type: unit.projectile,
            destination: unit.realDest
          }, unit.context);
          map.addChild(projectile);
        });
      } else {
        unit.startInterval(function () {
          if (!unit.getActionCondition(unit.dest)) {
            if (unit.dest && unit.dest.hitPoints <= 0) {
              unit.dest.die();
            }
            unit.affectNewDest();
            return;
          }
          _this.syncMovingTargetDirection();
          if (!unit.isUnitAtDest(unit.action, unit.dest)) {
            unit.sendTo(unit.dest, ACTION_TYPES.attack);
            return;
          }
          if (unit.sounds && unit.sounds.hit) {
            unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play(Array.isArray(unit.sounds.hit) ? maths_randomItem(unit.sounds.hit) : unit.sounds.hit);
          }
          if (unit.dest.hitPoints > 0) {
            unit.dest.hitPoints = getHitPointsWithDamage(unit, unit.dest);
            if (unit.dest.selected && (player.selectedUnit === unit.dest || player.selectedBuilding === unit.dest || player.selectedOther === unit.dest)) {
              menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints);
            }
            unit.dest.isAttacked(unit);
            if (unit.dest.hitPoints <= 0) {
              unit.dest.die();
              unit.affectNewDest();
            }
          }
        }, unit.rateOfFire * 1000, false);
      }
    }
  }]);
}();
;// ./app/classes/unit/UnitActions.js
function UnitActions_typeof(o) { "@babel/helpers - typeof"; return UnitActions_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitActions_typeof(o); }
function UnitActions_slicedToArray(r, e) { return UnitActions_arrayWithHoles(r) || UnitActions_iterableToArrayLimit(r, e) || UnitActions_unsupportedIterableToArray(r, e) || UnitActions_nonIterableRest(); }
function UnitActions_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function UnitActions_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return UnitActions_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? UnitActions_arrayLikeToArray(r, a) : void 0; } }
function UnitActions_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function UnitActions_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function UnitActions_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function UnitActions_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitActions_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitActions_toPropertyKey(o.key), o); } }
function UnitActions_createClass(e, r, t) { return r && UnitActions_defineProperties(e.prototype, r), t && UnitActions_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitActions_toPropertyKey(t) { var i = UnitActions_toPrimitive(t, "string"); return "symbol" == UnitActions_typeof(i) ? i : i + ""; }
function UnitActions_toPrimitive(t, r) { if ("object" != UnitActions_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitActions_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }





var UnitActions = /*#__PURE__*/function () {
  function UnitActions(unit) {
    UnitActions_classCallCheck(this, UnitActions);
    this.unit = unit;
  }
  return UnitActions_createClass(UnitActions, [{
    key: "goBackToPrevious",
    value: function goBackToPrevious() {
      var unit = this.unit;
      var map = unit.context.map;
      if (!unit.previousDest) {
        unit.stop();
        return;
      }
      var dest = unit.previousDest;
      var type = dest.category || dest.type;
      unit.previousDest = null;
      if (dest.family === FAMILY_TYPES.animal) {
        if (unit.getActionCondition(dest, ACTION_TYPES.takemeat)) {
          unit.sendToTakeMeat(dest, true);
        } else {
          unit.sendToEvt(map.grid[dest.i][dest.j], ACTION_TYPES.hunt);
        }
      } else if (dest.family === FAMILY_TYPES.building) {
        if (unit.getActionCondition(dest, ACTION_TYPES.build)) {
          unit.sendToBuilding(dest);
        } else if (unit.getActionCondition(dest, ACTION_TYPES.farm)) {
          unit.sendToFarm(dest);
        } else {
          unit.sendTo(map.grid[dest.i][dest.j], ACTION_TYPES.build);
        }
      } else if (TYPE_ACTION[type]) {
        if (unit.getActionCondition(dest, TYPE_ACTION[type])) {
          var sendToFunc = "sendTo".concat(type);
          typeof unit[sendToFunc] === 'function' ? unit[sendToFunc](dest) : unit.stop();
        } else {
          unit.sendTo(map.grid[dest.i][dest.j], TYPE_ACTION[type]);
        }
      } else {
        unit.sendTo(map.grid[dest.i][dest.j]);
      }
    }
  }, {
    key: "startGathering",
    value: function startGathering(loadingType, soundId) {
      var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref$dieOnEmpty = _ref.dieOnEmpty,
        dieOnEmpty = _ref$dieOnEmpty === void 0 ? false : _ref$dieOnEmpty,
        _ref$checkOwner = _ref.checkOwner,
        checkOwner = _ref$checkOwner === void 0 ? false : _ref$checkOwner,
        _ref$updateTexture = _ref.updateTexture,
        updateTexture = _ref$updateTexture === void 0 ? false : _ref$updateTexture;
      var unit = this.unit;
      var menu = unit.context.menu;
      if (!unit.getActionCondition(unit.dest)) {
        unit.affectNewDest();
        return;
      }
      unit.setTextures(SHEET_TYPES.action);
      unit.startInterval(function () {
        if (!unit.getActionCondition(unit.dest)) {
          if (dieOnEmpty && unit.dest.quantity <= 0) {
            unit.dest.die();
          }
          unit.affectNewDest();
          return;
        }
        if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
          unit.sendToDelivery();
          return;
        }
        unit.loading++;
        unit.loadingType = loadingType;
        unit.updateInterfaceLoading();
        if (soundId) unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play(soundId);
        if (updateTexture) unit.dest.updateTexture();
        unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0);
        if (unit.dest.selected && (!checkOwner || unit.owner.isPlayed)) {
          menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity);
        }
        if (unit.dest.quantity <= 0) {
          if (dieOnEmpty) unit.dest.die();
          unit.affectNewDest();
        }
        if (unit.loading === 1) {
          if (unit.allAssets && unit.allAssets[unit.work]) {
            unit.walkingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].loadedSheet);
            unit.standingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].standingSheet);
          }
        }
      }, 1 / unit.gatheringRate[unit.work] * 1000, false);
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      var unit = this.unit;
      var data = unit.owner.config.units[type];
      unit.type = type;
      unit.hitPoints = data.totalHitPoints - (unit.totalHitPoints - unit.hitPoints);
      for (var _i = 0, _Object$entries = Object.entries(data); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = UnitActions_slicedToArray(_Object$entries[_i], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];
        unit[key] = value;
      }
      for (var _i2 = 0, _Object$entries2 = Object.entries(unit.assets); _i2 < _Object$entries2.length; _i2++) {
        var _Object$entries2$_i = UnitActions_slicedToArray(_Object$entries2[_i2], 2),
          _key = _Object$entries2$_i[0],
          _value = _Object$entries2$_i[1];
        unit[_key] = lib/* Assets */.sP.cache.get(_value);
      }
      if (unit.action && !unit.path.length) {
        unit.getAction(unit.action);
      } else {
        unit.setTextures(unit.currentSheet);
      }
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      var unit = this.unit;
      var _unit$context = unit.context,
        menu = _unit$context.menu,
        player = _unit$context.player,
        map = _unit$context.map;
      unit.sprite.onLoop = null;
      unit.sprite.onFrameChange = null;
      switch (name) {
        case ACTION_TYPES.delivery:
          if (!unit.getActionCondition(unit.dest, unit.action)) {
            unit.stop();
            return;
          }
          unit.owner[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType] += unit.loading;
          unit.owner.isPlayed && menu.updateTopbar();
          unit.loading = 0;
          unit.updateInterfaceLoading();
          if (unit.allAssets && unit.allAssets[unit.work]) {
            unit.standingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].standingSheet);
            unit.walkingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].walkingSheet);
          }
          if (unit.previousDest) {
            unit.goBackToPrevious();
          } else {
            unit.stop();
          }
          break;
        case ACTION_TYPES.farm:
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest();
            return;
          }
          unit.dest.isUsedBy = unit;
          unit.setTextures(SHEET_TYPES.action);
          unit.startInterval(function () {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.quantity <= 0) {
                unit.dest.die();
              }
              unit.affectNewDest();
              return;
            }
            unit.dest.isUsedBy = unit;
            if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
              unit.sendToDelivery();
              unit.dest.isUsedBy = null;
              return;
            }
            unit.loading++;
            unit.loadingType = LOADING_TYPES.wheat;
            unit.updateInterfaceLoading();
            unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play('5178');
            unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0);
            if (unit.dest.selected) {
              menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity);
            }
            if (unit.dest.quantity <= 0) {
              unit.dest.die();
              unit.affectNewDest();
            }
            if (unit.loading === 1) {
              if (unit.allAssets[unit.work]) {
                unit.walkingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].loadedSheet);
              }
              unit.standingSheet = null;
            }
          }, 1 / unit.gatheringRate[unit.work] * 1000, false);
          break;
        case ACTION_TYPES.chopwood:
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest();
            return;
          }
          unit.setTextures(SHEET_TYPES.action);
          unit.startInterval(function () {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.quantity <= 0) {
                unit.dest.die();
              }
              unit.affectNewDest();
              return;
            }
            if (unit.loading === unit.loadingMax[unit.loadingType] || !unit.dest) {
              unit.sendToDelivery();
              return;
            }
            unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play('5048');
            if (unit.dest.hitPoints > 0) {
              unit.dest.hitPoints = Math.max(unit.dest.hitPoints - 1, 0);
              if (unit.dest.selected) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints > 0 ? unit.dest.hitPoints + '/' + unit.dest.totalHitPoints : '');
              }
              if (unit.dest.hitPoints <= 0) {
                unit.dest.hitPoints = 0;
                unit.dest.setCuttedTreeTexture();
              }
            } else {
              unit.loading++;
              unit.loadingType = LOADING_TYPES.wood;
              unit.updateInterfaceLoading();
              unit.dest.quantity = Math.max(unit.dest.quantity - 1, 0);
              if (unit.dest.selected) {
                menu.updateInfo(MENU_INFO_IDS.quantityText, unit.dest.quantity);
              }
              if (unit.dest.quantity <= 0) {
                unit.dest.die();
                unit.affectNewDest();
              }
              if (unit.loading === 1) {
                if (unit.allAssets[unit.work]) {
                  unit.walkingSheet = lib/* Assets */.sP.cache.get(unit.allAssets[unit.work].loadedSheet);
                }
                unit.standingSheet = null;
              }
            }
          }, 1 / unit.gatheringRate[unit.work] * 1000, false);
          break;
        case ACTION_TYPES.forageberry:
          this.startGathering(LOADING_TYPES.berry, '5085', {
            dieOnEmpty: true
          });
          break;
        case ACTION_TYPES.minestone:
          this.startGathering(LOADING_TYPES.stone, '5159', {
            dieOnEmpty: true
          });
          break;
        case ACTION_TYPES.minegold:
          this.startGathering(LOADING_TYPES.gold, '5159');
          break;
        case ACTION_TYPES.build:
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest();
            return;
          }
          unit.setTextures(SHEET_TYPES.action);
          unit.startInterval(function () {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest.type === BUILDING_TYPES.farm && !unit.dest.isUsedBy) {
                unit.sendToFarm(unit.dest);
              }
              unit.affectNewDest();
              return;
            }
            if (unit.dest.hitPoints < unit.dest.totalHitPoints) {
              unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play('5107');
              unit.dest.hitPoints = Math.min(Math.round(unit.dest.hitPoints + unit.dest.totalHitPoints / unit.dest.constructionTime), unit.dest.totalHitPoints);
              if (unit.dest.selected && unit.owner.isPlayed) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints);
              }
              unit.dest.updateHitPoints(unit.action);
            } else {
              if (!unit.dest.isBuilt) {
                unit.dest.updateHitPoints(unit.action);
                unit.dest.isBuilt = true;
                if (unit.dest.type === BUILDING_TYPES.farm && !unit.dest.isUsedBy) {
                  unit.sendToFarm(unit.dest);
                }
              }
              unit.affectNewDest();
            }
          }, 1000, false);
          break;
        case ACTION_TYPES.attack:
          unit.unitCombat.handleAttackAction();
          break;
        case ACTION_TYPES.heal:
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest();
            return;
          }
          unit.setTextures(SHEET_TYPES.action);
          unit.sprite.onLoop = function () {
            if (!unit.getActionCondition(unit.dest)) {
              unit.affectNewDest();
              return;
            }
            if (unit.destHasMoved()) {
              unit.realDest.i = unit.dest.i;
              unit.realDest.j = unit.dest.j;
              unit.realDest.x = unit.dest.x;
              unit.realDest.y = unit.dest.y;
              var oldDeg = unit.degree;
              unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y);
              if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
                unit.setTextures(SHEET_TYPES.action);
              }
            }
            if (!unit.isUnitAtDest(unit.action, unit.dest)) {
              unit.sendTo(unit.dest, ACTION_TYPES.heal);
              return;
            }
            if (unit.dest.hitPoints < unit.dest.totalHitPoints) {
              unit.dest.hitPoints = Math.min(unit.dest.hitPoints + unit.healing, unit.dest.totalHitPoints);
              if (unit.dest.selected && player.selectedUnit === unit.dest) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints);
              }
            }
          };
          break;
        case ACTION_TYPES.takemeat:
          this.startGathering(LOADING_TYPES.meat, '5178', {
            checkOwner: true,
            updateTexture: true
          });
          break;
        case ACTION_TYPES.fishing:
          this.startGathering(LOADING_TYPES.fish, null, {
            checkOwner: true
          });
          if (unit.category !== 'Boat') {
            onSpriteLoopAtFrame(unit.sprite, 6, function () {
              unit.context.controls.instanceInCamera(unit) && sound_lib/* sound */.s3.play('5125');
            });
          }
          break;
        case ACTION_TYPES.hunt:
          if (!unit.getActionCondition(unit.dest)) {
            unit.affectNewDest();
            return;
          }
          if (unit.dest.isDead) {
            unit.previousDest ? unit.goBackToPrevious() : unit.sendToTakeMeat(unit.dest);
            return;
          }
          unit.setTextures(SHEET_TYPES.action);
          unit.sprite.onLoop = function () {
            if (!unit.getActionCondition(unit.dest)) {
              if (unit.dest && unit.dest.hitPoints <= 0) {
                unit.dest.die();
                unit.previousDest ? unit.goBackToPrevious() : unit.sendToTakeMeat(unit.dest);
                return;
              }
              unit.affectNewDest();
              return;
            }
            if (!unit.isUnitAtDest(unit.action, unit.dest)) {
              unit.stop();
              return;
            }
            if (unit.destHasMoved()) {
              unit.realDest.i = unit.dest.i;
              unit.realDest.j = unit.dest.j;
              unit.realDest.x = unit.dest.x;
              unit.realDest.y = unit.dest.y;
              var oldDeg = unit.degree;
              unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y);
              if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
                unit.setTextures(SHEET_TYPES.action);
              }
            }
          };
          onSpriteLoopAtFrame(unit.sprite, 6, function () {
            if (!unit.getActionCondition(unit.dest) || !unit.realDest) return;
            var projectile = new Projectile({
              owner: unit,
              target: unit.dest,
              type: 'Spear',
              destination: unit.realDest,
              damage: 4
            }, unit.context);
            map.addChild(projectile);
          });
          break;
        default:
          unit.stop();
      }
    }
  }]);
}();
;// ./app/classes/unit/UnitMovement.js
function UnitMovement_typeof(o) { "@babel/helpers - typeof"; return UnitMovement_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, UnitMovement_typeof(o); }
function UnitMovement_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function UnitMovement_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, UnitMovement_toPropertyKey(o.key), o); } }
function UnitMovement_createClass(e, r, t) { return r && UnitMovement_defineProperties(e.prototype, r), t && UnitMovement_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function UnitMovement_toPropertyKey(t) { var i = UnitMovement_toPrimitive(t, "string"); return "symbol" == UnitMovement_typeof(i) ? i : i + ""; }
function UnitMovement_toPrimitive(t, r) { if ("object" != UnitMovement_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != UnitMovement_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var UnitMovement = /*#__PURE__*/function () {
  function UnitMovement(unit) {
    UnitMovement_classCallCheck(this, UnitMovement);
    this.unit = unit;
  }
  return UnitMovement_createClass(UnitMovement, [{
    key: "sendToEvt",
    value: function sendToEvt(dest, action) {
      var _map$grid$unit$i$unit;
      var unit = this.unit;
      var map = unit.context.map;
      unit.handleChangeDest();
      unit.stopInterval();
      var path = [];
      if (!dest || dest.isDestroyed || unit.isDead) return;
      if (unit.isUnitAtDest(action, dest) && (!map.grid[unit.i][unit.j].solid || map.grid[unit.i][unit.j].solid && ((_map$grid$unit$i$unit = map.grid[unit.i][unit.j].has) === null || _map$grid$unit$i$unit === void 0 ? void 0 : _map$grid$unit$i$unit.label) === unit.label)) {
        unit.setDest(dest);
        unit.action = action;
        unit.degree = getInstanceDegree(unit, dest.x, dest.y);
        unit.getAction(action);
        return;
      }
      if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
        var allowWaterCellCategory = unit.category === 'Boat';
        if (map.grid[dest.i][dest.j].solid) {
          path = getInstanceClosestFreeCellPath(unit, dest, map);
          if (!path.length && unit.work) {
            unit.action = action;
            if (action === ACTION_TYPES.delivery) {
              unit.stop();
            } else {
              unit.affectNewDest();
            }
            return;
          }
        } else if (!allowWaterCellCategory && dest.category === 'Water') {
          var cell = getFreeCellAroundPoint(dest.i, dest.j, 1, map.grid, function (cell) {
            return cell.category !== 'Water' && !cell.solid;
          });
          unit.sendToEvt(cell);
          return;
        }
      }
      if (!path.length) {
        path = getInstancePath(unit, dest.i, dest.j, map);
      }
      if (path.length) {
        unit.setDest(dest);
        unit.action = action;
        unit.setPath(path);
      } else {
        unit.stop();
      }
    }
  }, {
    key: "isUnitAtDest",
    value: function isUnitAtDest(action, dest) {
      var unit = this.unit;
      if (!action) return false;
      if (!dest) {
        unit.affectNewDest();
        return false;
      }
      if ((unit.type !== UNIT_TYPES.villager || action === ACTION_TYPES.hunt) && unit.range && instancesDistance(unit, dest) <= unit.range) {
        return true;
      }
      return instanceContactInstance(unit, dest);
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      var unit = this.unit;
      return (unit.dest.i !== unit.realDest.i || unit.dest.j !== unit.realDest.j) && instancesDistance(unit, unit.dest) <= unit.sight;
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      var unit = this.unit;
      var map = unit.context.map;
      var next = unit.path[unit.path.length - 1];
      var nextCell = map.grid[next.i][next.j];
      if (!unit.dest || unit.dest.isDestroyed) {
        unit.affectNewDest();
        return;
      }
      if (nextCell.has && nextCell.has.family === FAMILY_TYPES.unit && nextCell.has.label !== unit.label && nextCell.has.hasPath() && instancesDistance(unit, nextCell.has) <= 1 && nextCell.has.sprite.playing) {
        unit.sprite.stop();
        return;
      }
      if (nextCell.solid && unit.dest) {
        unit.sendTo(unit.dest, unit.action);
        return;
      }
      if (!unit.sprite.playing) {
        unit.sprite.play();
      }
      if (instancesDistance(unit, nextCell, false) <= unit.speed) {
        var oldI = unit.i,
          oldJ = unit.j;
        unit.z = nextCell.z;
        unit.i = nextCell.i;
        unit.j = nextCell.j;
        unit.zIndex = getInstanceZIndex(unit);
        if (unit.currentCell.has === unit) {
          unit.currentCell.has = null;
          unit.currentCell.solid = false;
        }
        unit.currentCell = map.grid[unit.i][unit.j];
        if (unit.currentCell.has === null) {
          unit.currentCell.place(unit);
          unit.currentCell.solid = true;
        }
        map.updateInstanceBucket(unit, oldI, oldJ);
        updateInstanceVisibility(unit);
        unit.path.pop();
        if (unit.destHasMoved()) {
          unit.sendTo(unit.dest, unit.action);
          return;
        }
        if (unit.isUnitAtDest(unit.action, unit.dest)) {
          unit.path = [];
          unit.stopInterval();
          unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y);
          unit.getAction(unit.action);
          return;
        }
        if (!unit.path.length) {
          unit.stop();
        }
      } else {
        var _unit$context = unit.context,
          menu = _unit$context.menu,
          player = _unit$context.player;
        var oldDeg = unit.degree;
        var speed = unit.speed;
        if (unit.loading > 0) speed *= 0.8;
        moveTowardPoint(unit, nextCell.x, nextCell.y, speed);
        canUpdateMinimap(unit, player) && menu.updatePlayerMiniMap(unit.owner);
        if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
          unit.setTextures(SHEET_TYPES.walking);
        }
      }
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      var unit = this.unit;
      unit.stopInterval();
      if (unit.previousDest && unit.action !== ACTION_TYPES.delivery) {
        unit.goBackToPrevious();
        return;
      }
      var handleSuccess = false;
      if (unit.type === UNIT_TYPES.villager && (unit.action === ACTION_TYPES.takemeat || unit.action === ACTION_TYPES.hunt)) {
        handleSuccess = unit.handleAffectNewDestHunter();
      } else if (!unit.dest || unit.dest.family !== FAMILY_TYPES.animal) {
        var targets = findInstancesInSight(unit, function (instance) {
          return unit.getActionCondition(instance);
        });
        if (targets.length) {
          var target = getClosestInstanceWithPath(unit, targets);
          if (target) {
            if (instanceContactInstance(unit, target)) {
              unit.degree = getInstanceDegree(unit, target.x, target.y);
              unit.getAction(unit.action);
              return;
            }
            unit.setDest(target.instance);
            unit.setPath(target.path);
            return;
          }
        }
      }
      if (!handleSuccess) {
        var notDeliveryWork = [WORK_TYPES.builder, WORK_TYPES.attacker, WORK_TYPES.healer];
        if (unit.loading && !notDeliveryWork.includes(unit.work)) {
          unit.sendToDelivery();
        } else {
          unit.stop();
        }
      }
    }
  }, {
    key: "explore",
    value: function explore() {
      var unit = this.unit;
      var map = unit.context.map;
      var grid = map.grid;
      var views = unit.owner.views;
      for (var r = 1; r <= 50; r++) {
        for (var dx = -r; dx <= r; dx++) {
          var x = unit.i + dx;
          var row = grid[x];
          if (!row) continue;
          var dyMax = r - Math.abs(dx);
          for (var _i = 0, _arr = dyMax === 0 ? [0] : [-dyMax, dyMax]; _i < _arr.length; _i++) {
            var dy = _arr[_i];
            var cell = row[unit.j + dy];
            if (cell && !views[cell.i][cell.j].viewed && !cell.solid) {
              unit.sendTo(views[cell.i][cell.j]);
              return;
            }
          }
        }
      }
    }
  }, {
    key: "runaway",
    value: function runaway(instance) {
      var unit = this.unit;
      var map = unit.context.map;
      var di = unit.i - instance.i;
      var dj = unit.j - instance.j;
      var len = Math.sqrt(di * di + dj * dj) || 1;
      for (var dist = unit.sight; dist >= 1; dist--) {
        var _map$grid$ti$length, _map$grid$ti;
        var ti = Math.round(unit.i + di / len * dist);
        var tj = Math.round(unit.j + dj / len * dist);
        if (ti >= 0 && ti < map.grid.length && tj >= 0 && tj < ((_map$grid$ti$length = (_map$grid$ti = map.grid[ti]) === null || _map$grid$ti === void 0 ? void 0 : _map$grid$ti.length) !== null && _map$grid$ti$length !== void 0 ? _map$grid$ti$length : 0)) {
          var cell = map.grid[ti][tj];
          if (!cell.solid && !cell.border) {
            unit.sendTo(unit.owner.views[ti][tj]);
            return;
          }
        }
      }
      unit.stop();
    }
  }]);
}();
;// ./app/classes/unit/index.js
function unit_typeof(o) { "@babel/helpers - typeof"; return unit_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, unit_typeof(o); }
function unit_slicedToArray(r, e) { return unit_arrayWithHoles(r) || unit_iterableToArrayLimit(r, e) || unit_unsupportedIterableToArray(r, e) || unit_nonIterableRest(); }
function unit_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function unit_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return unit_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? unit_arrayLikeToArray(r, a) : void 0; } }
function unit_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function unit_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function unit_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function unit_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function unit_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, unit_toPropertyKey(o.key), o); } }
function unit_createClass(e, r, t) { return r && unit_defineProperties(e.prototype, r), t && unit_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function unit_toPropertyKey(t) { var i = unit_toPrimitive(t, "string"); return "symbol" == unit_typeof(i) ? i : i + ""; }
function unit_toPrimitive(t, r) { if ("object" != unit_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != unit_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function unit_callSuper(t, o, e) { return o = unit_getPrototypeOf(o), unit_possibleConstructorReturn(t, unit_isNativeReflectConstruct() ? Reflect.construct(o, e || [], unit_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function unit_possibleConstructorReturn(t, e) { if (e && ("object" == unit_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return unit_assertThisInitialized(t); }
function unit_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function unit_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (unit_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function unit_superPropGet(t, o, e, r) { var p = unit_get(unit_getPrototypeOf(1 & r ? t.prototype : t), o, e); return 2 & r && "function" == typeof p ? function (t) { return p.apply(e, t); } : p; }
function unit_get() { return unit_get = "undefined" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function (e, t, r) { var p = unit_superPropBase(e, t); if (p) { var n = Object.getOwnPropertyDescriptor(p, t); return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value; } }, unit_get.apply(null, arguments); }
function unit_superPropBase(t, o) { for (; !{}.hasOwnProperty.call(t, o) && null !== (t = unit_getPrototypeOf(t));); return t; }
function unit_getPrototypeOf(t) { return unit_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, unit_getPrototypeOf(t); }
function unit_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && unit_setPrototypeOf(t, e); }
function unit_setPrototypeOf(t, e) { return unit_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, unit_setPrototypeOf(t, e); }











function unit_getActionSheet(work, action, Assets, unit) {
  if (!work) {
    return;
  }
  var actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action;
  return Assets.cache.get(unit.allAssets[work][actionSheet]);
}
var Unit = /*#__PURE__*/function (_Instance) {
  function Unit(options, context) {
    var _this$x, _this$y, _this$z, _this$quantity, _this$hitPoints, _this$loop;
    var _this;
    unit_classCallCheck(this, Unit);
    _this = unit_callSuper(this, Unit, [context]);
    _this.selectionFactor = 0.5;
    var _this2 = _this,
      _this2$context = _this2.context,
      map = _this2$context.map,
      menu = _this2$context.menu;
    _this.family = FAMILY_TYPES.unit;
    _this.unitInterface = new UnitInterface(_this);
    _this.unitCommands = new UnitCommands(_this);
    _this.unitLifecycle = new UnitLifecycle(_this);
    _this.unitCombat = new UnitCombat(_this);
    _this.unitActions = new UnitActions(_this);
    _this.unitMovement = new UnitMovement(_this);
    _this.dest = null;
    _this.realDest = null;
    _this.previousDest = null;
    _this.path = [];
    _this.degree = randomRange(1, 360);
    _this.currentFrame = randomRange(0, 4);
    _this.action = null;
    _this.loading = 0;
    _this.loadingType = null;
    _this.currentSheet = SHEET_TYPES.standing;
    _this.inactif = true;
    _this.x = null;
    _this.y = null;
    _this.z = null;
    Object.assign(_this, options);
    Object.assign(_this, _this.owner.config.units[_this.type]);
    _this.size = 1;
    _this.visible = false;
    _this.visibleCells = new Set();
    _this.x = (_this$x = _this.x) !== null && _this$x !== void 0 ? _this$x : map.grid[_this.i][_this.j].x;
    _this.y = (_this$y = _this.y) !== null && _this$y !== void 0 ? _this$y : map.grid[_this.i][_this.j].y;
    _this.z = (_this$z = _this.z) !== null && _this$z !== void 0 ? _this$z : map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.totalHitPoints;
    _this.currentCell = map.grid[_this.i][_this.j];
    if (_this.currentSheet === SHEET_TYPES.corpse) {
      _this.owner.corpses.push(_this);
      map.grid[_this.i][_this.j].corpses.add(_this);
    } else if (!_this.isDead) {
      _this.currentCell.place(_this);
      _this.currentCell.solid = true;
      _this.owner.units.push(_this);
      map.addToInstanceBucket(_this);
    }
    switch (_this.type) {
      case UNIT_TYPES.villager:
        _this.work = _this.work || null;
        break;
      case 'Priest':
        _this.work = WORK_TYPES.healer;
        break;
      default:
        _this.work = WORK_TYPES.attacker;
    }
    if (_this.assets) {
      for (var _i = 0, _Object$entries = Object.entries(_this.assets); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = unit_slicedToArray(_Object$entries[_i], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];
        _this[key] = lib/* Assets */.sP.cache.get(value);
      }
    } else if (_this.allAssets) {
      for (var _i2 = 0, _Object$entries2 = Object.entries(_this.allAssets["default"]); _i2 < _Object$entries2.length; _i2++) {
        var _Object$entries2$_i = unit_slicedToArray(_Object$entries2[_i2], 2),
          _key = _Object$entries2$_i[0],
          _value = _Object$entries2$_i[1];
        _this[_key] = lib/* Assets */.sP.cache.get(_value);
      }
    }
    if (_this.owner.isPlayed && map.ready && _this.context.controls.instanceInCamera(_this)) {
      sound_lib/* sound */.s3.play(_this.sounds && _this.sounds.create || 5144);
    }
    _this["interface"] = {
      info: function info(element) {
        var data = _this.owner.config.units[_this.type];
        _this.setDefaultInterface(element, data);
        if (_this.showLoading && _this.owner.isPlayed) {
          element.appendChild(_this.getLoadingElement());
        }
      },
      menu: _this.showBuildings && _this.owner.isPlayed ? [{
        icon: 'assets/interface/50721/002_50721.png',
        children: Object.keys(_this.owner.config.buildings).map(function (key) {
          return menu.getBuildingButton(key);
        })
      }] : []
    };
    _this.allowMove = false;
    _this.eventMode = 'static';
    _this.actionSheet = _this.actionSheet || unit_getActionSheet(_this.work, _this.action, lib/* Assets */.sP, _this);
    _this.sprite = new lib/* AnimatedSprite */.Dl5(_this[SHEET_TYPES.standing].animations['south']);
    _this.sprite.label = LABEL_TYPES.sprite;
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'auto';
    _this.sprite.allowClick = false;
    _this.sprite.roundPixels = true;
    _this.sprite.loop = (_this$loop = _this.loop) !== null && _this$loop !== void 0 ? _this$loop : true;
    if (_this.isDead) {
      _this.currentSheet === SHEET_TYPES.corpse ? _this.decompose() : _this.death();
    } else if (_this.loading > 0) {
      _this.walkingSheet = lib/* Assets */.sP.cache.get(_this.allAssets[getWorkWithLoadingType(_this.loadingType)].loadedSheet);
      _this.standingSheet = lib/* Assets */.sP.cache.get(_this.allAssets[getWorkWithLoadingType(_this.loadingType)].standingSheet);
    }
    _this.setTextures(_this.currentSheet);
    _this.sprite.currentFrame = Math.min(_this.currentFrame, _this.sprite.textures.length - 1);
    _this.sprite.updateAnchor = true;
    _this.addChild(_this.sprite);
    _this.sendTo = throttle(_this.sendToEvt, _this.owner.isPlayed ? 100 : 1000, true);
    _this.on('pointerdown', function (evt) {
      var _this3 = _this,
        _this3$context = _this3.context,
        controls = _this3$context.controls,
        player = _this3$context.player;
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return;
      }
      if (controls.clicked) {
        if (_this.owner.isPlayed) {
          controls.getCellOnCamera(function (cell) {
            if (player.selectedUnits.length < MAX_SELECT_UNITS && cell.has && cell.has.owner && cell.has.owner.label === _this.owner.label && cell.has.type === _this.type) {
              cell.has.select();
              player.selectedUnits.push(cell.has);
            }
          });
        }
        controls.doubleClicked = true;
      }
      controls.clicked = false;
    });
    _this.on('pointerup', function (evt) {
      var _this4 = _this,
        _this4$context = _this4.context,
        controls = _this4$context.controls,
        player = _this4$context.player,
        menu = _this4$context.menu;
      if (controls.doubleClicked || controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return;
      }
      controls.mouse.prevent = true;
      controls.clicked = true;
      controls["double"] = setTimeout(function () {
        controls.clicked = false;
        controls.doubleClicked = false;
      }, 600);
      if (_this.owner.isPlayed) {
        var hasSentHealer = false;
        if (player.selectedUnits.length) {
          for (var i = 0; i < player.selectedUnits.length; i++) {
            var playerUnit = player.selectedUnits[i];
            if (playerUnit.work === WORK_TYPES.healer && _this.getActionCondition(playerUnit, ACTION_TYPES.heal)) {
              hasSentHealer = true;
              playerUnit.sendTo(_this, ACTION_TYPES.heal);
            }
          }
        }
        if (hasSentHealer) {
          drawInstanceBlinkingSelection(_this);
        } else if (player.selectedUnit !== _this) {
          _this.owner.unselectAll();
          _this.select();
          menu.setBottombar(_this);
          player.selectedUnit = _this;
          player.selectedUnits = [_this];
        }
      } else {
        var hasSentAttacker = false;
        if (player.selectedUnits.length) {
          for (var _i3 = 0; _i3 < player.selectedUnits.length; _i3++) {
            var _playerUnit = player.selectedUnits[_i3];
            if (_this.getActionCondition(_playerUnit, ACTION_TYPES.attack)) if (_playerUnit.type === UNIT_TYPES.villager) {
              hasSentAttacker = true;
              _playerUnit.sendToAttack(_this);
            } else if (_playerUnit.work === WORK_TYPES.attacker) {
              hasSentAttacker = true;
              _playerUnit.sendTo(_this, ACTION_TYPES.attack);
            }
          }
        }
        if (hasSentAttacker) {
          drawInstanceBlinkingSelection(_this);
        } else if (player.selectedOther !== _this && instanceIsInPlayerSight(_this, player) || map.revealEverything) {
          player.unselectAll();
          _this.select();
          menu.setBottombar(_this);
          player.selectedOther = _this;
        }
      }
    });
    changeSpriteColor(_this.sprite, _this.owner.color);
    _this.visibilityTimeout = setTimeout(function () {
      if (!_this.isDestroyed) updateInstanceVisibility(_this);
    });
    return _this;
  }
  unit_inherits(Unit, _Instance);
  return unit_createClass(Unit, [{
    key: "select",
    value: function select() {
      if (this.selected) return;
      unit_superPropGet(Unit, "select", this, 3)([]);
      var _this$context = this.context,
        menu = _this$context.menu,
        player = _this$context.player;
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) return;
      unit_superPropGet(Unit, "unselect", this, 3)([]);
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        player = _this$context2.player;
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "hasPath",
    value: function hasPath() {
      return this.path.length > 0;
    }
  }, {
    key: "setDest",
    value: function setDest(dest) {
      if (!dest || dest.isDestroyed) {
        this.stop();
        return;
      }
      this.handleSetDest && this.handleSetDest(dest, this);
      this.dest = dest;
      this.realDest = {
        i: dest.i,
        j: dest.j,
        x: dest.x,
        y: dest.y,
        label: dest.label
      };
    }
  }, {
    key: "setPath",
    value: function setPath(path) {
      var _this5 = this;
      if (!path.length) {
        this.stop();
        return;
      }
      this.setTextures(SHEET_TYPES.walking);
      this.inactif = false;
      this.path = path;
      this.startInterval(function () {
        return _this5.step();
      }, STEP_TIME);
    }
  }, {
    key: "handleChangeDest",
    value: function handleChangeDest() {
      if (this.dest && this.dest.isUsedBy === this) {
        this.dest.isUsedBy = null;
      }
    }
  }, {
    key: "sendToEvt",
    value: function sendToEvt(dest, action) {
      return this.unitMovement.sendToEvt(dest, action);
    }
  }, {
    key: "goBackToPrevious",
    value: function goBackToPrevious() {
      return this.unitActions.goBackToPrevious();
    }
  }, {
    key: "startGathering",
    value: function startGathering(loadingType, soundId, opts) {
      return this.unitActions.startGathering(loadingType, soundId, opts);
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      return this.unitActions.getAction(name);
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      return this.unitCombat.detect(instance);
    }
  }, {
    key: "handleAffectNewDestHunter",
    value: function handleAffectNewDestHunter() {
      return this.unitCombat.handleAffectNewDestHunter();
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      return this.unitActions.upgrade(type);
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      return this.unitMovement.affectNewDest();
    }
  }, {
    key: "isUnitAtDest",
    value: function isUnitAtDest(action, dest) {
      return this.unitMovement.isUnitAtDest(action, dest);
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      return this.unitMovement.destHasMoved();
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      return this.unitMovement.moveToPath();
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      var _this$handleIsAttacke;
      if (!instance || this.dest === instance || this.isDead) {
        return;
      }
      if ((_this$handleIsAttacke = this.handleIsAttacked) !== null && _this$handleIsAttacke !== void 0 && _this$handleIsAttacke.call(this, instance, this)) return;
      var currentDest = this.dest;
      if (this.type === UNIT_TYPES.villager) {
        if (instance.family === FAMILY_TYPES.animal) {
          this.sendToHunt(instance);
        } else {
          this.sendToAttack(instance);
        }
      } else {
        this.sendTo(instance, ACTION_TYPES.attack);
      }
      this.previousDest = currentDest;
    }
  }, {
    key: "stop",
    value: function stop() {
      var _this$currentCell$has;
      if (((_this$currentCell$has = this.currentCell.has) === null || _this$currentCell$has === void 0 ? void 0 : _this$currentCell$has.label) !== this.label && this.currentCell.solid) {
        this.sendTo(this.currentCell);
        return;
      }
      this.handleChangeDest();
      this.inactif = true;
      this.action = null;
      this.dest = null;
      this.realDest = null;
      this.currentCell.place(this);
      this.currentCell.solid = true;
      this.path = [];
      this.stopInterval();
      this.setTextures(SHEET_TYPES.standing);
    }
  }, {
    key: "startInterval",
    value: function startInterval(callback, time) {
      var immediate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      if (this.isDead) {
        return;
      }
      this.stopInterval();
      if (immediate) callback();
      this.interval = this.context.scheduler.add(callback, time);
    }
  }, {
    key: "explore",
    value: function explore() {
      return this.unitMovement.explore();
    }
  }, {
    key: "runaway",
    value: function runaway(instance) {
      return this.unitMovement.runaway(instance);
    }
  }, {
    key: "decompose",
    value: function decompose() {
      return this.unitLifecycle.decompose();
    }
  }, {
    key: "death",
    value: function death() {
      return this.unitLifecycle.death();
    }
  }, {
    key: "die",
    value: function die() {
      return this.unitLifecycle.die();
    }
  }, {
    key: "clear",
    value: function clear() {
      return this.unitLifecycle.clear();
    }
  }, {
    key: "updateInterfaceLoading",
    value: function updateInterfaceLoading() {
      this.unitInterface.updateLoading();
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      return this.unitInterface.getLoadingElement();
    }
  }, {
    key: "commonSendTo",
    value: function commonSendTo(target, work, action, keepPrevious) {
      var immediate = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
      return this.unitCommands.commonSendTo(target, work, action, keepPrevious, immediate);
    }

    // Navigate to arrivalCell but set target as the attack dest.
    // Avoids the N×M A* calls getInstanceClosestFreeCellPath makes when multiple
    // units are sent to the same solid target — each unit gets exactly one A* call.
  }, {
    key: "sendToWithCell",
    value: function sendToWithCell(target, arrivalCell, action) {
      return this.unitCommands.sendToWithCell(target, arrivalCell, action);
    }
  }, {
    key: "sendToDelivery",
    value: function sendToDelivery() {
      return this.unitCommands.sendToDelivery();
    }
  }, {
    key: "sendToFish",
    value: function sendToFish(target) {
      return this.unitCommands.sendToFish(target);
    }
  }, {
    key: "sendToAttack",
    value: function sendToAttack(target) {
      return this.unitCommands.sendToAttack(target);
    }
  }, {
    key: "sendToTakeMeat",
    value: function sendToTakeMeat(target) {
      var immediate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      return this.unitCommands.sendToTakeMeat(target, immediate);
    }
  }, {
    key: "sendToHunt",
    value: function sendToHunt(target) {
      return this.unitCommands.sendToHunt(target);
    }
  }, {
    key: "sendToBuilding",
    value: function sendToBuilding(target) {
      return this.unitCommands.sendToBuilding(target);
    }
  }, {
    key: "sendToFarm",
    value: function sendToFarm(target) {
      return this.unitCommands.sendToFarm(target);
    }
  }, {
    key: "sendToTree",
    value: function sendToTree(target) {
      return this.unitCommands.sendToTree(target);
    }
  }, {
    key: "sendToBerrybush",
    value: function sendToBerrybush(target) {
      return this.unitCommands.sendToBerrybush(target);
    }
  }, {
    key: "sendToStone",
    value: function sendToStone(target) {
      return this.unitCommands.sendToStone(target);
    }
  }, {
    key: "sendToGold",
    value: function sendToGold(target) {
      return this.unitCommands.sendToGold(target);
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      this.unitInterface.setDefaultInterface(element, data);
    }
  }]);
}(Instance);
;// ./app/classes/players/player.js
function player_typeof(o) { "@babel/helpers - typeof"; return player_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, player_typeof(o); }
function player_toConsumableArray(r) { return player_arrayWithoutHoles(r) || player_iterableToArray(r) || player_unsupportedIterableToArray(r) || player_nonIterableSpread(); }
function player_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function player_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return player_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? player_arrayLikeToArray(r, a) : void 0; } }
function player_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function player_arrayWithoutHoles(r) { if (Array.isArray(r)) return player_arrayLikeToArray(r); }
function player_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function player_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function player_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? player_ownKeys(Object(t), !0).forEach(function (r) { player_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : player_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function player_defineProperty(e, r, t) { return (r = player_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function player_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function player_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, player_toPropertyKey(o.key), o); } }
function player_createClass(e, r, t) { return r && player_defineProperties(e.prototype, r), t && player_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function player_toPropertyKey(t) { var i = player_toPrimitive(t, "string"); return "symbol" == player_typeof(i) ? i : i + ""; }
function player_toPrimitive(t, r) { if ("object" != player_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != player_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }






var Player = /*#__PURE__*/function () {
  function Player(options, context) {
    var _this = this;
    player_classCallCheck(this, Player);
    this.family = FAMILY_TYPES.player;
    this.context = context;
    var map = context.map;
    this.label = uuidv4();
    this.parent = map;
    var res = map.startingResources;
    this.wood = res.wood;
    this.food = res.food;
    this.stone = res.stone;
    this.gold = res.gold;
    this.corpses = [];
    this.units = [];
    this.buildings = [];
    this.population = 0;
    this.technologies = [];
    this.cellViewed = 0;
    this.age = 0;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    this.population_max = this.population_max || (map.devMode ? POPULATION_MAX : 0);
    this.colorHex = getHexColor(this.color);
    this.config = player_objectSpread({}, lib/* Assets */.sP.cache.get('config'));
    this.techs = player_objectSpread({}, lib/* Assets */.sP.cache.get('technology'));
    this.hasBuilt = this.hasBuilt || (map.devMode ? Object.keys(this.config.buildings).map(function (key) {
      return key;
    }) : []);
    var cloneGrid = [];
    var _loop = function _loop(i) {
      var _loop2 = function _loop2(j) {
        var _this$views$i$j$viewB, _this$views, _this$views$i$j$viewe, _this$views2;
        if (cloneGrid[i] == null) {
          cloneGrid[i] = [];
        }
        cloneGrid[i][j] = {
          i: i,
          j: j,
          viewBy: new Set((_this$views$i$j$viewB = (_this$views = _this.views) === null || _this$views === void 0 ? void 0 : _this$views[i][j].viewBy) !== null && _this$views$i$j$viewB !== void 0 ? _this$views$i$j$viewB : []),
          onViewed: function onViewed() {
            var _this$context = _this.context,
              menu = _this$context.menu,
              map = _this$context.map;
            if (_this.isPlayed && !map.revealEverything) {
              menu.updateTerrainMiniMap(i, j);
            }
          },
          viewed: (_this$views$i$j$viewe = (_this$views2 = _this.views) === null || _this$views2 === void 0 ? void 0 : _this$views2[i][j].viewed) !== null && _this$views$i$j$viewe !== void 0 ? _this$views$i$j$viewe : _this.isPlayed && _this.type === PLAYER_TYPES.human && map.revealTerrain || false
        };
      };
      for (var j = 0; j <= map.size; j++) {
        _loop2(j);
      }
    };
    for (var i = 0; i <= map.size; i++) {
      _loop(i);
    }
    this.views = cloneGrid;
  }
  return player_createClass(Player, [{
    key: "spawnBuilding",
    value: function spawnBuilding(options) {
      var building = this.createBuilding(options);
      if (this.isPlayed) {
        var hasSentVillager = false;
        var hasSentOther = false;
        for (var i = 0; i < this.selectedUnits.length; i++) {
          var unit = this.selectedUnits[i];
          if (unit.type === UNIT_TYPES.villager) {
            if (extra_getActionCondition(unit, building, ACTION_TYPES.build)) {
              hasSentVillager = true;
              unit.sendToBuilding(building);
            }
          } else {
            unit.sendTo(building);
            hasSentOther = true;
          }
        }
        if (hasSentVillager) {
          drawInstanceBlinkingSelection(building);
        }
        if (hasSentOther) {
          var voice = randomItem(['5075', '5076', '5128', '5164']);
          sound_lib/* sound */.s3.play(voice);
          return;
        } else if (hasSentVillager) {
          var _voice = this.config.units.Villager.sounds.build;
          sound_lib/* sound */.s3.play(_voice);
          return;
        }
      }
      return building;
    }
  }, {
    key: "onAgeChange",
    value: function onAgeChange() {
      var _this$context2 = this.context,
        players = _this$context2.players,
        menu = _this$context2.menu;
      if (this.isPlayed) {
        sound_lib/* sound */.s3.play('5169');
      }
      for (var i = 0; i < this.buildings.length; i++) {
        var building = this.buildings[i];
        if (building.isBuilt && !building.isDead) {
          building.finalTexture();
        }
      }
      for (var _i = 0; _i < players.length; _i++) {
        var player = players[_i];
        if (player.type === PLAYER_TYPES.human) {
          if (player.selectedUnit && player.selectedUnit.owner.label === this.label) {
            menu.setBottombar(player.selectedUnit);
          } else if (player.selectedBuilding && player.selectedBuilding.owner.label === this.label) {
            menu.setBottombar(player.selectedBuilding);
          } else if (player.selectedOther && player.selectedOther.owner.label === this.label) {
            menu.setBottombar(player.selectedOther);
          }
        }
      }
    }
  }, {
    key: "otherPlayers",
    value: function otherPlayers() {
      var players = this.context.players;
      var others = player_toConsumableArray(players);
      others.splice(players.indexOf(this), 1);
      return others;
    }
  }, {
    key: "updateConfig",
    value: function updateConfig(operations) {
      for (var i = 0; i < operations.length; i++) {
        var operation = operations[i];
        var types = Array.isArray(operation.type) ? operation.type : [operation.type];
        for (var j = 0; j < types.length; j++) {
          var type = types[j];
          if (Object.keys(this.config.buildings).includes(type)) {
            this.config.buildings[type] && updateObject(this.config.buildings[type], operation);
          } else if (Object.keys(this.config.units).includes(type)) {
            this.config.units[type] && updateObject(this.config.units[type], operation);
          }
        }
      }
    }
  }, {
    key: "buyBuilding",
    value: function buyBuilding(i, j, type) {
      var _this2 = this;
      var _this$context3 = this.context,
        menu = _this$context3.menu,
        map = _this$context3.map;
      var config = this.config.buildings[type];
      if (canAfford(this, config.cost) && (!config.conditions || config.conditions.every(function (condition) {
        return isValidCondition(condition, _this2);
      }))) {
        this.spawnBuilding({
          i: i,
          j: j,
          type: type,
          isBuilt: map.devMode
        });
        payCost(this, config.cost);
        this.isPlayed && menu.updateTopbar();
        return true;
      }
      return false;
    }
  }, {
    key: "createUnit",
    value: function createUnit(options) {
      var context = this.context;
      var unit = context.map.addChild(new Unit(player_objectSpread(player_objectSpread({}, options), {}, {
        owner: this
      }), context));
      canUpdateMinimap(unit, context.player) && context.menu.updatePlayerMiniMapEvt(this);
      return unit;
    }
  }, {
    key: "createBuilding",
    value: function createBuilding(options) {
      var context = this.context;
      var building = context.map.addChild(new Building(player_objectSpread(player_objectSpread({}, options), {}, {
        owner: this
      }), context));
      this.buildings.push(building);
      canUpdateMinimap(building, context.player) && context.menu.updatePlayerMiniMapEvt(this);
      return building;
    }
  }]);
}();
;// ./app/ai/AIMilitary.js
function AIMilitary_typeof(o) { "@babel/helpers - typeof"; return AIMilitary_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AIMilitary_typeof(o); }
function AIMilitary_toConsumableArray(r) { return AIMilitary_arrayWithoutHoles(r) || AIMilitary_iterableToArray(r) || AIMilitary_unsupportedIterableToArray(r) || AIMilitary_nonIterableSpread(); }
function AIMilitary_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function AIMilitary_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function AIMilitary_arrayWithoutHoles(r) { if (Array.isArray(r)) return AIMilitary_arrayLikeToArray(r); }
function AIMilitary_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = AIMilitary_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function AIMilitary_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return AIMilitary_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? AIMilitary_arrayLikeToArray(r, a) : void 0; } }
function AIMilitary_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function AIMilitary_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AIMilitary_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AIMilitary_toPropertyKey(o.key), o); } }
function AIMilitary_createClass(e, r, t) { return r && AIMilitary_defineProperties(e.prototype, r), t && AIMilitary_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AIMilitary_toPropertyKey(t) { var i = AIMilitary_toPrimitive(t, "string"); return "symbol" == AIMilitary_typeof(i) ? i : i + ""; }
function AIMilitary_toPrimitive(t, r) { if ("object" != AIMilitary_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AIMilitary_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var AIMilitary = /*#__PURE__*/function () {
  function AIMilitary(ai, strategy) {
    AIMilitary_classCallCheck(this, AIMilitary);
    this.ai = ai;
    this.strategy = strategy;
  }
  return AIMilitary_createClass(AIMilitary, [{
    key: "sendToAttack",
    value: function sendToAttack(soldiers, target) {
      var _map$grid$target$i;
      var debug = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      if (debug) console.log('Sending soldiers to attack:', target);
      soldiers.forEach(function (c) {
        c.assault = true;
      });
      var map = this.ai.context.map;
      var targetCell = (_map$grid$target$i = map.grid[target.i]) === null || _map$grid$target$i === void 0 ? void 0 : _map$grid$target$i[target.j];
      if (soldiers.length > 1 && targetCell !== null && targetCell !== void 0 && targetCell.solid) {
        var _targetCell$has;
        var size = target.size || ((_targetCell$has = targetCell.has) === null || _targetCell$has === void 0 ? void 0 : _targetCell$has.size) || 1;
        var dist = size === 3 ? 2 : 1;
        var candidates = getCellsAroundPoint(target.i, target.j, map.grid, dist, function (cell) {
          return !cell.solid && cell.category !== 'Water';
        });
        var taken = new Set();
        var _iterator = AIMilitary_createForOfIteratorHelper(soldiers),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var soldier = _step.value;
            var best = null,
              bestDist = Infinity;
            var _iterator2 = AIMilitary_createForOfIteratorHelper(candidates),
              _step2;
            try {
              for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                var cell = _step2.value;
                if (taken.has(cell)) continue;
                var d = Math.abs(cell.i - soldier.i) + Math.abs(cell.j - soldier.j);
                if (d < bestDist) {
                  bestDist = d;
                  best = cell;
                }
              }
            } catch (err) {
              _iterator2.e(err);
            } finally {
              _iterator2.f();
            }
            if (best) {
              taken.add(best);
              soldier.sendToWithCell(target, best, ACTION_TYPES.attack);
            } else {
              soldier.sendTo(target, ACTION_TYPES.attack);
            }
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
      } else {
        soldiers.forEach(function (c) {
          return c.sendTo(target, ACTION_TYPES.attack);
        });
      }
    }
  }, {
    key: "getBestEnemyTarget",
    value: function getBestEnemyTarget() {
      var foundedEnemyBuildings = this.ai.foundedEnemyBuildings;
      return AIMilitary_toConsumableArray(foundedEnemyBuildings).find(function (b) {
        return b.type === BUILDING_TYPES.townCenter;
      }) || foundedEnemyBuildings.values().next().value;
    }
  }, {
    key: "handleActions",
    value: function handleActions(_ref) {
      var waitingMilitary = _ref.waitingMilitary,
        inactifMilitary = _ref.inactifMilitary,
        howManySoldiersBeforeAttack = _ref.howManySoldiersBeforeAttack,
        _ref$debug = _ref.debug,
        debug = _ref$debug === void 0 ? false : _ref$debug;
      var ai = this.ai;
      var difficultyConfig = this.strategy.difficultyConfig;
      var map = ai.context.map;
      var actions = 0;
      var availableMilitary = AIMilitary_toConsumableArray(waitingMilitary);
      if (ai.foundedEnemyUnits.size > 0 && availableMilitary.length > 0) {
        var enemyUnit = AIMilitary_toConsumableArray(ai.foundedEnemyUnits).find(function (u) {
          return u.hitPoints > 0;
        });
        if (enemyUnit) {
          if (debug) console.log('Enemy units spotted! Defending...');
          this.sendToAttack(availableMilitary.splice(0), enemyUnit, debug);
          actions++;
        }
      }
      var raidThreshold = difficultyConfig.raidThreshold;
      var raidSize = difficultyConfig.raidSize;
      if (raidThreshold > 0 && ai.phase === 'military_build' && availableMilitary.length >= raidThreshold) {
        var raidTarget = AIMilitary_toConsumableArray(ai.foundedEnemyUnits).find(function (u) {
          return u.hitPoints > 0 && u.type === UNIT_TYPES.villager;
        }) || ai.foundedEnemyBuildings.values().next().value;
        if (raidTarget) {
          if (debug) console.log("Early raid! Sending ".concat(raidSize, " soldiers to harass."));
          this.sendToAttack(availableMilitary.splice(0, raidSize), raidTarget, debug);
          actions++;
        }
      }
      if (ai.phase === 'attack' && availableMilitary.length >= howManySoldiersBeforeAttack) {
        var defenderCount = Math.max(2, Math.floor(availableMilitary.length * difficultyConfig.defenderRatio));
        var attackers = availableMilitary.slice(defenderCount);
        if (attackers.length > 0) {
          var target = this.getBestEnemyTarget() || map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)];
          if (debug) console.log("Launching attack wave! ".concat(attackers.length, " attackers, ").concat(defenderCount, " defenders. Target:"), target);
          this.sendToAttack(attackers, target, debug);
          actions++;
        }
      }
      if (inactifMilitary.length && ai.foundedEnemyBuildings.size) {
        var _target = this.getBestEnemyTarget();
        if (_target) {
          if (debug) console.log('Redirecting assault soldiers to:', _target);
          this.sendToAttack(inactifMilitary, _target, debug);
          actions++;
        }
      }
      return actions;
    }
  }]);
}();
;// ./app/ai/AIStrategy.js
function AIStrategy_typeof(o) { "@babel/helpers - typeof"; return AIStrategy_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AIStrategy_typeof(o); }
function AIStrategy_slicedToArray(r, e) { return AIStrategy_arrayWithHoles(r) || AIStrategy_iterableToArrayLimit(r, e) || AIStrategy_unsupportedIterableToArray(r, e) || AIStrategy_nonIterableRest(); }
function AIStrategy_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function AIStrategy_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function AIStrategy_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function AIStrategy_toConsumableArray(r) { return AIStrategy_arrayWithoutHoles(r) || AIStrategy_iterableToArray(r) || AIStrategy_unsupportedIterableToArray(r) || AIStrategy_nonIterableSpread(); }
function AIStrategy_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function AIStrategy_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function AIStrategy_arrayWithoutHoles(r) { if (Array.isArray(r)) return AIStrategy_arrayLikeToArray(r); }
function AIStrategy_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = AIStrategy_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function AIStrategy_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return AIStrategy_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? AIStrategy_arrayLikeToArray(r, a) : void 0; } }
function AIStrategy_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function AIStrategy_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AIStrategy_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AIStrategy_toPropertyKey(o.key), o); } }
function AIStrategy_createClass(e, r, t) { return r && AIStrategy_defineProperties(e.prototype, r), t && AIStrategy_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AIStrategy_defineProperty(e, r, t) { return (r = AIStrategy_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function AIStrategy_toPropertyKey(t) { var i = AIStrategy_toPrimitive(t, "string"); return "symbol" == AIStrategy_typeof(i) ? i : i + ""; }
function AIStrategy_toPrimitive(t, r) { if ("object" != AIStrategy_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AIStrategy_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var DIFFICULTIES = {
  easy: {
    stepDelayBase: 6000,
    popCapMultiplier: 0.7,
    attackThreshold: 8,
    defenderRatio: 0.5,
    econToMilVillagers: 16,
    raidThreshold: 0,
    raidSize: 0
  },
  medium: {
    stepDelayBase: 4000,
    popCapMultiplier: 1.0,
    attackThreshold: 5,
    defenderRatio: 0.3,
    econToMilVillagers: 12,
    raidThreshold: 0,
    raidSize: 0
  },
  hard: {
    stepDelayBase: 2500,
    popCapMultiplier: 1.3,
    attackThreshold: 3,
    defenderRatio: 0.2,
    econToMilVillagers: 8,
    raidThreshold: 4,
    raidSize: 3
  }
};
var NEXT_AGE = {
  1: 'ToolAge',
  2: 'BronzeAge',
  3: 'IronAge'
};
var MAX_VILLAGER_PER_AGE = {
  0: 16,
  1: 24,
  2: 40,
  3: 50
};
var VILLAGE_TARGET_PERCENTAGE_BY_AGE = {
  0: {
    wood: 40,
    food: 60,
    gold: 0,
    stone: 0
  },
  1: {
    wood: 45,
    food: 45,
    gold: 10,
    stone: 0
  },
  2: {
    wood: 35,
    food: 35,
    gold: 20,
    stone: 10
  },
  3: {
    wood: 30,
    food: 30,
    gold: 25,
    stone: 15
  }
};
var MAX_BUILDING_BY_AGE = {
  0: {
    StoragePit: 1,
    Granary: 1,
    Barracks: 1,
    Market: 1
  },
  1: {
    StoragePit: 2,
    Granary: 2,
    Farm: 4,
    Barracks: 1,
    Market: 1,
    ArcheryRange: 1,
    Stable: 1,
    WatchTower: 2
  },
  2: {
    StoragePit: 3,
    Granary: 3,
    Farm: 6,
    Barracks: 2,
    Market: 1,
    ArcheryRange: 1,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 2
  },
  3: {
    StoragePit: 4,
    Granary: 4,
    Farm: 10,
    Barracks: 2,
    Market: 1,
    ArcheryRange: 2,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 3
  }
};
var TECH_PRIORITY_BY_BUILDING = AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty({}, BUILDING_TYPES.barracks, ['BattleAxe', 'ShortSword', 'BroadSword', 'LongSword']), BUILDING_TYPES.archeryRange, ['ImprovedBow', 'CompositeBow']), BUILDING_TYPES.storagePit, ['Toolworking', 'LeatherArmorInfantry', 'Metalworking', 'ScaleArmorInfantry', 'Metallurgy', 'ChainmailInfantry', 'BronzeShield', 'IronShield']), BUILDING_TYPES.market, ['Woodworking', 'GoldMining', 'StoneMining', 'Domestication']), BUILDING_TYPES.granary, ['ResearchWatchTower', 'ResearchSentryTower']);
var AIStrategy = /*#__PURE__*/function () {
  function AIStrategy(ai) {
    var difficulty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'medium';
    AIStrategy_classCallCheck(this, AIStrategy);
    this.ai = ai;
    this.difficulty = difficulty;
    this.difficultyConfig = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    this.nextAge = NEXT_AGE;
    this.maxVillagerPerAge = MAX_VILLAGER_PER_AGE;
    this.villageTargetPercentageByAge = VILLAGE_TARGET_PERCENTAGE_BY_AGE;
    this.maxBuildingByAge = MAX_BUILDING_BY_AGE;
    this.maxInfantryByAge = {
      0: 8,
      1: 8,
      2: 10,
      3: 12
    };
    this.maxArcherByAge = {
      0: 0,
      1: 4,
      2: 6,
      3: 8
    };
    this.maxCavalryByAge = {
      0: 0,
      1: 3,
      2: 4,
      3: 5
    };
    this.maxHopliteByAge = {
      0: 0,
      1: 0,
      2: 2,
      3: 4
    };
    this.techPriorityByBuilding = TECH_PRIORITY_BY_BUILDING;
    this.military = new AIMilitary(ai, this);
  }
  return AIStrategy_createClass(AIStrategy, [{
    key: "applyConfig",
    value: function applyConfig(target) {
      target.difficultyConfig = this.difficultyConfig;
      target.nextAge = this.nextAge;
      target.maxVillagerPerAge = this.maxVillagerPerAge;
      target.villageTargetPercentageByAge = this.villageTargetPercentageByAge;
      target.maxBuildingByAge = this.maxBuildingByAge;
      target.maxInfantryByAge = this.maxInfantryByAge;
      target.maxArcherByAge = this.maxArcherByAge;
      target.maxCavalryByAge = this.maxCavalryByAge;
      target.maxHopliteByAge = this.maxHopliteByAge;
      target.techPriorityByBuilding = this.techPriorityByBuilding;
    }
  }, {
    key: "canResearchTech",
    value: function canResearchTech(techKey) {
      var ai = this.ai;
      var tech = ai.techs[techKey];
      if (!(tech !== null && tech !== void 0 && tech.conditions)) return true;
      return tech.conditions.every(function (cond) {
        if (cond.key === 'age') {
          if (cond.op === '>=') return ai.age >= cond.value;
          if (cond.op === '=') return ai.age === cond.value;
        }
        if (cond.key === 'technologies') {
          if (cond.op === 'includes') return ai.technologies.includes(cond.value);
          if (cond.op === 'notincludes') return !ai.technologies.includes(cond.value);
        }
        return true;
      });
    }
  }, {
    key: "getBestInfantryUnit",
    value: function getBestInfantryUnit() {
      var technologies = this.ai.technologies;
      if (technologies.includes('LongSword')) return 'LongSwordsman';
      if (technologies.includes('BroadSword')) return 'BroadSwordsman';
      if (technologies.includes('ShortSword')) return 'ShortSwordsman';
      if (technologies.includes('BattleAxe')) return 'Axeman';
      return 'Clubman';
    }
  }, {
    key: "getBestArcherUnit",
    value: function getBestArcherUnit() {
      var technologies = this.ai.technologies;
      if (technologies.includes('CompositeBow')) return 'CompositeBowman';
      if (technologies.includes('ImprovedBow')) return 'ImprovedBowman';
      return 'Bowman';
    }
  }, {
    key: "updatePhase",
    value: function updatePhase(villagersCount, militaryCount) {
      var ai = this.ai,
        difficultyConfig = this.difficultyConfig;
      if (ai.phase === 'economy' && villagersCount >= difficultyConfig.econToMilVillagers) {
        ai.phase = 'military_build';
        return 'military_build';
      }
      if (ai.phase === 'military_build' && militaryCount >= difficultyConfig.attackThreshold) {
        ai.phase = 'attack';
        return 'attack';
      }
      if (ai.phase === 'attack' && militaryCount < Math.ceil(difficultyConfig.attackThreshold * 0.4)) {
        ai.phase = 'military_build';
        return 'military_build';
      }
      return ai.phase;
    }
  }, {
    key: "handleMilitaryActions",
    value: function handleMilitaryActions(options) {
      return this.military.handleActions(options);
    }
  }, {
    key: "buyUnits",
    value: function buyUnits(currentCount, maxCount, buildingList, unitType, extra) {
      var debug = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
      var unitsNeeded = maxCount - currentCount;
      var unitsBought = 0;
      if (unitsNeeded <= 0) return 0;
      var _iterator = AIStrategy_createForOfIteratorHelper(buildingList),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var building = _step.value;
          if (unitsBought >= unitsNeeded) break;
          if (building && building.buyUnit(unitType, false, false, extra)) {
            unitsBought++;
            if (debug) console.log("Buying ".concat(unitType, " from ").concat(building.type, ", Total Bought: ").concat(unitsBought));
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      return unitsBought;
    }
  }, {
    key: "handleProductionActions",
    value: function handleProductionActions(snapshot) {
      var debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var villagers = snapshot.villagers,
        maxVillagers = snapshot.maxVillagers,
        towncenters = snapshot.towncenters,
        infantry = snapshot.infantry,
        maxInfantry = snapshot.maxInfantry,
        barracks = snapshot.barracks,
        infantryUnit = snapshot.infantryUnit,
        archers = snapshot.archers,
        maxArcher = snapshot.maxArcher,
        archeryRanges = snapshot.archeryRanges,
        archerUnit = snapshot.archerUnit,
        cavalry = snapshot.cavalry,
        maxCavalry = snapshot.maxCavalry,
        stables = snapshot.stables,
        hoplites = snapshot.hoplites,
        maxHoplite = snapshot.maxHoplite,
        academies = snapshot.academies;
      var actions = 0;
      actions += this.buyUnits(villagers.length, maxVillagers, towncenters, UNIT_TYPES.villager, undefined, debug);
      actions += this.buyUnits(infantry.length, maxInfantry, barracks, infantryUnit, undefined, debug);
      actions += this.buyUnits(archers.length, maxArcher, archeryRanges, archerUnit, undefined, debug);
      actions += this.buyUnits(cavalry.length, maxCavalry, stables, 'Scout', undefined, debug);
      actions += this.buyUnits(hoplites.length, maxHoplite, academies, 'Hoplite', undefined, debug);
      return actions;
    }
  }, {
    key: "buyBuildingIfNeeded",
    value: function buyBuildingIfNeeded(condition, buildingType, buildingsByType, positionCallback) {
      var debug = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
      var ai = this.ai;
      var building = ai.config.buildings[buildingType];
      if (condition && canAfford(ai, building.cost) && ai.hasNotReachBuildingLimit(buildingType, buildingsByType[buildingType])) {
        var pos = positionCallback();
        if (pos && ai.buyBuilding(pos.i, pos.j, buildingType)) {
          if (debug) console.log("Buying building: ".concat(buildingType, " at position:"), pos);
          return true;
        }
      }
      return false;
    }
  }, {
    key: "handleBuildingActions",
    value: function handleBuildingActions(snapshot) {
      var _buildingsByType,
        _this = this;
      var debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var ai = this.ai;
      var map = snapshot.map,
        otherPlayers = snapshot.otherPlayers,
        towncenters = snapshot.towncenters,
        houses = snapshot.houses,
        farms = snapshot.farms,
        barracks = snapshot.barracks,
        granarys = snapshot.granarys,
        storagepits = snapshot.storagepits,
        markets = snapshot.markets,
        archeryRanges = snapshot.archeryRanges,
        stables = snapshot.stables,
        academies = snapshot.academies,
        watchTowers = snapshot.watchTowers,
        sentryTowers = snapshot.sentryTowers,
        notBuiltHouses = snapshot.notBuiltHouses;
      var buildingsByType = (_buildingsByType = {}, AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(_buildingsByType, BUILDING_TYPES.house, houses), BUILDING_TYPES.farm, farms), BUILDING_TYPES.barracks, barracks), BUILDING_TYPES.granary, granarys), BUILDING_TYPES.storagePit, storagepits), BUILDING_TYPES.market, markets), BUILDING_TYPES.archeryRange, archeryRanges), BUILDING_TYPES.stable, stables), BUILDING_TYPES.academy, academies), BUILDING_TYPES.watchTower, watchTowers), AIStrategy_defineProperty(_buildingsByType, BUILDING_TYPES.sentryTower, sentryTowers));
      var isEnemyFacing = function isEnemyFacing(origin) {
        return function (cell) {
          return otherPlayers.every(function (player) {
            return instancesDistance(cell, player) <= instancesDistance(origin, player);
          });
        };
      };
      var buy = function buy(condition, buildingType, positionCallback) {
        return _this.buyBuildingIfNeeded(condition, buildingType, buildingsByType, positionCallback, debug);
      };
      var actions = 0;
      if (buy(ai.population + 2 > ai.population_max && !notBuiltHouses.length, BUILDING_TYPES.house, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0);
      })) actions++;
      if (buy(ai.phase !== 'economy', BUILDING_TYPES.barracks, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(markets.length === 0, BUILDING_TYPES.market, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(barracks.length > 0, BUILDING_TYPES.archeryRange, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(barracks.length > 0, BUILDING_TYPES.stable, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(stables.some(function (s) {
        return s.isBuilt;
      }), BUILDING_TYPES.academy, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(true, BUILDING_TYPES.farm, function () {
        var buildings = [].concat(AIStrategy_toConsumableArray(granarys), AIStrategy_toConsumableArray(towncenters));
        var _iterator2 = AIStrategy_createForOfIteratorHelper(buildings),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var building = _step2.value;
            var position = getPositionInGridAroundInstance(building, map.grid, [2, 10], 2, false, isEnemyFacing(building), false);
            if (position) return position;
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
        return null;
      })) actions++;
      if (buy(ai.technologies.includes('ResearchWatchTower'), BUILDING_TYPES.watchTower, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      if (buy(ai.technologies.includes('ResearchSentryTower'), BUILDING_TYPES.sentryTower, function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 15], 2, false, isEnemyFacing(towncenters[0]));
      })) actions++;
      return actions;
    }
  }, {
    key: "buyTechnology",
    value: function buyTechnology(buildingList, technologyType) {
      var debug = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var bought = 0;
      var _iterator3 = AIStrategy_createForOfIteratorHelper(buildingList),
        _step3;
      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var building = _step3.value;
          if (building && building.buyTechnology(technologyType)) {
            if (debug) console.log("Buying ".concat(technologyType, " from ").concat(building.type));
            bought++;
          }
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
      return bought;
    }
  }, {
    key: "handleTechnologyActions",
    value: function handleTechnologyActions(snapshot) {
      var debug = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var ai = this.ai;
      var maxVillagers = snapshot.maxVillagers,
        towncenters = snapshot.towncenters,
        barracks = snapshot.barracks,
        archeryRanges = snapshot.archeryRanges,
        storagepits = snapshot.storagepits,
        markets = snapshot.markets,
        granarys = snapshot.granarys;
      var actions = 0;
      var ageUpCosts = {
        1: {
          food: 500
        },
        2: {
          food: 800
        },
        3: {
          food: 1000,
          gold: 800
        }
      };
      var ageUpBuffers = {
        1: {
          food: 200
        },
        2: {
          food: 200
        },
        3: {
          food: 200,
          gold: 200
        }
      };
      var nextAgeKey = ai.age + 1;
      if (ai.nextAge[nextAgeKey]) {
        var cost = ageUpCosts[nextAgeKey] || {};
        var buffer = ageUpBuffers[nextAgeKey] || {};
        var popReady = ai.population >= Math.floor(maxVillagers * 0.8);
        var resReady = Object.entries(cost).every(function (_ref) {
          var _ref2 = AIStrategy_slicedToArray(_ref, 2),
            res = _ref2[0],
            amount = _ref2[1];
          return ai[res] >= amount + (buffer[res] || 0);
        });
        if (popReady && resReady) {
          actions += this.buyTechnology(towncenters, ai.nextAge[nextAgeKey], debug);
        }
      }
      var buildingListByType = AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty(AIStrategy_defineProperty({}, BUILDING_TYPES.barracks, barracks), BUILDING_TYPES.archeryRange, archeryRanges), BUILDING_TYPES.storagePit, storagepits), BUILDING_TYPES.market, markets), BUILDING_TYPES.granary, granarys);
      for (var _i = 0, _Object$entries = Object.entries(ai.techPriorityByBuilding); _i < _Object$entries.length; _i++) {
        var _Object$entries$_i = AIStrategy_slicedToArray(_Object$entries[_i], 2),
          buildingType = _Object$entries$_i[0],
          techList = _Object$entries$_i[1];
        var buildings = buildingListByType[buildingType];
        if (!(buildings !== null && buildings !== void 0 && buildings.length)) continue;
        var _iterator4 = AIStrategy_createForOfIteratorHelper(techList),
          _step4;
        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var tech = _step4.value;
            if (ai.technologies.includes(tech)) continue;
            if (!this.canResearchTech(tech)) continue;
            var bought = this.buyTechnology(buildings, tech, debug);
            if (bought) {
              actions += bought;
              break;
            }
          }
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
      }
      return actions;
    }
  }]);
}();
;// ./app/ai/AIEconomy.js
function AIEconomy_typeof(o) { "@babel/helpers - typeof"; return AIEconomy_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AIEconomy_typeof(o); }
function AIEconomy_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = AIEconomy_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function AIEconomy_toConsumableArray(r) { return AIEconomy_arrayWithoutHoles(r) || AIEconomy_iterableToArray(r) || AIEconomy_unsupportedIterableToArray(r) || AIEconomy_nonIterableSpread(); }
function AIEconomy_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function AIEconomy_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return AIEconomy_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? AIEconomy_arrayLikeToArray(r, a) : void 0; } }
function AIEconomy_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function AIEconomy_arrayWithoutHoles(r) { if (Array.isArray(r)) return AIEconomy_arrayLikeToArray(r); }
function AIEconomy_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function AIEconomy_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AIEconomy_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AIEconomy_toPropertyKey(o.key), o); } }
function AIEconomy_createClass(e, r, t) { return r && AIEconomy_defineProperties(e.prototype, r), t && AIEconomy_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AIEconomy_toPropertyKey(t) { var i = AIEconomy_toPrimitive(t, "string"); return "symbol" == AIEconomy_typeof(i) ? i : i + ""; }
function AIEconomy_toPrimitive(t, r) { if ("object" != AIEconomy_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AIEconomy_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var AIEconomy = /*#__PURE__*/function () {
  function AIEconomy(ai) {
    AIEconomy_classCallCheck(this, AIEconomy);
    this.ai = ai;
  }
  return AIEconomy_createClass(AIEconomy, [{
    key: "getWorkerSnapshot",
    value: function getWorkerSnapshot(villagers) {
      var villagersByWork = function villagersByWork(works) {
        return villagers.filter(function (v) {
          return !v.inactif && works.includes(v.work);
        });
      };
      var inactifVillagers = villagers.filter(function (v) {
        return v.inactif && v.action !== ACTION_TYPES.attack;
      });
      var villagersForaging = villagersByWork([WORK_TYPES.forager]);
      var villagersFarming = villagersByWork([WORK_TYPES.farmer]);
      var villagersHunting = villagersByWork([WORK_TYPES.hunter]);
      var villagersFishing = villagersByWork([WORK_TYPES.fisher]);
      var villagersOnFood = [].concat(AIEconomy_toConsumableArray(villagersForaging), AIEconomy_toConsumableArray(villagersFarming), AIEconomy_toConsumableArray(villagersHunting), AIEconomy_toConsumableArray(villagersFishing));
      var villagersOnWood = villagersByWork([WORK_TYPES.woodcutter]);
      var villagersOnGold = villagersByWork([WORK_TYPES.goldminer]);
      var villagersOnStone = villagersByWork([WORK_TYPES.stoneminer]);
      var builderVillagers = villagersByWork([WORK_TYPES.builder]);
      return {
        inactifVillagers: inactifVillagers,
        villagersForaging: villagersForaging,
        villagersOnFood: villagersOnFood,
        villagersOnWood: villagersOnWood,
        villagersOnGold: villagersOnGold,
        villagersOnStone: villagersOnStone,
        builderVillagers: builderVillagers
      };
    }
  }, {
    key: "getResourceTargets",
    value: function getResourceTargets(villagersCount) {
      var ai = this.ai;
      var woodBoost = ai.wood < 50 ? 15 : 0;
      var foodBoost = ai.food < 50 ? 15 : 0;
      return {
        maxVillagersOnFood: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['food'] + foodBoost),
        maxVillagersOnWood: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['wood'] + woodBoost),
        maxVillagersOnGold: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['gold']),
        maxVillagersOnStone: getValuePercentage(villagersCount, ai.villageTargetPercentageByAge[ai.age]['stone'])
      };
    }
  }, {
    key: "updateScout",
    value: function updateScout(inactifVillagers) {
      var ai = this.ai;
      if (!ai.scout || ai.scout.isDead || ai.scout.hitPoints <= 0) {
        ai.scout = inactifVillagers[inactifVillagers.length - 1] || null;
      }
      if (ai.scout && ai.scout.inactif) {
        ai.scout.explore();
      }
    }
  }, {
    key: "assignVillagersToResource",
    value: function assignVillagersToResource(availableVillagers, villagersOnResource, resourceList, maxVillagersForResource, actionCallback) {
      for (var i = maxVillagersForResource; i < villagersOnResource.length; i++) {
        villagersOnResource[i].stop();
      }
      if (resourceList.size === 0) return 0;
      var needed = Math.max(0, maxVillagersForResource - villagersOnResource.length);
      var toAssign = Math.min(needed, availableVillagers.length);
      for (var _i = 0; _i < toAssign; _i++) {
        var villager = availableVillagers.shift();
        var resource = getClosestInstance(villager, resourceList);
        actionCallback(villager, resource);
      }
      return toAssign;
    }
  }, {
    key: "discoverDeadAnimals",
    value: function discoverDeadAnimals(map) {
      var ai = this.ai;
      var _iterator = AIEconomy_createForOfIteratorHelper(map.gaia.units),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var animal = _step.value;
          if (animal.isDead && !animal.isDestroyed && animal.quantity > 0) {
            ai.foundedDeadAnimals.add(animal);
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }, {
    key: "assignFoodSources",
    value: function assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms) {
      var ai = this.ai;
      var villagersForaging = workerSnapshot.villagersForaging,
        villagersOnFood = workerSnapshot.villagersOnFood;
      var maxVillagersOnFood = targets.maxVillagersOnFood;
      var actions = 0;
      var foodWorkersAssigned = villagersOnFood.length;
      if (ai.foundedDeadAnimals.size > 0) {
        var toAssign = Math.min(Math.max(0, maxVillagersOnFood - foodWorkersAssigned), availableVillagers.length);
        for (var i = 0; i < toAssign; i++) {
          var animal = getClosestInstance(availableVillagers[0], ai.foundedDeadAnimals);
          if (!animal) break;
          availableVillagers.shift().sendToTakeMeat(animal);
          foodWorkersAssigned++;
          actions++;
        }
      }
      var berriesAssigned = this.assignVillagersToResource(availableVillagers, villagersForaging, ai.foundedBerrybushs, maxVillagersOnFood, function (villager, bush) {
        villager.sendToBerrybush(bush);
      });
      foodWorkersAssigned += berriesAssigned;
      actions += berriesAssigned;
      if (ai.foundedAnimals.size > 0) {
        var maxHunters = Math.min(2, availableVillagers.length);
        for (var _i2 = 0; _i2 < maxHunters; _i2++) {
          if (foodWorkersAssigned >= maxVillagersOnFood) break;
          var _animal = getClosestInstance(availableVillagers[0], ai.foundedAnimals);
          if (!_animal) break;
          availableVillagers.shift().sendToHunt(_animal);
          foodWorkersAssigned++;
          actions++;
        }
      }
      if (ai.foundedFish.size > 0) {
        var maxFishers = Math.min(3, availableVillagers.length);
        for (var _i3 = 0; _i3 < maxFishers; _i3++) {
          if (foodWorkersAssigned >= maxVillagersOnFood) break;
          var fish = getClosestInstance(availableVillagers[0], ai.foundedFish);
          if (!fish) break;
          availableVillagers.shift().sendToFish(fish);
          foodWorkersAssigned++;
          actions++;
        }
      }
      var foodShortfall = Math.max(0, maxVillagersOnFood - foodWorkersAssigned);
      for (var _i4 = 0; _i4 < emptyFarms.length && _i4 < foodShortfall && availableVillagers.length > 0; _i4++) {
        var villager = availableVillagers.shift();
        villager.sendToFarm(emptyFarms[_i4]);
        actions++;
      }
      return actions;
    }
  }, {
    key: "assignBuilders",
    value: function assignBuilders(availableVillagers, notBuiltBuildings, builderVillagers, maxVillagersOnConstruction) {
      var debug = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
      var actions = 0;
      if (!notBuiltBuildings.length) return actions;
      var _iterator2 = AIEconomy_createForOfIteratorHelper(notBuiltBuildings),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var building = _step2.value;
          if (builderVillagers.length >= maxVillagersOnConstruction) break;
          if (availableVillagers.length === 0) break;
          var villager = getClosestInstance(building, availableVillagers);
          if (villager) {
            if (debug) console.log('Villager sent to build:', building);
            villager.sendToBuilding(building);
            availableVillagers.splice(availableVillagers.indexOf(villager), 1);
            actions++;
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      return actions;
    }
  }, {
    key: "handleVillagerActions",
    value: function handleVillagerActions(_ref) {
      var _this = this;
      var villagers = _ref.villagers,
        map = _ref.map,
        farms = _ref.farms,
        notBuiltBuildings = _ref.notBuiltBuildings,
        maxVillagersOnConstruction = _ref.maxVillagersOnConstruction,
        _ref$debug = _ref.debug,
        debug = _ref$debug === void 0 ? false : _ref$debug;
      var workerSnapshot = this.getWorkerSnapshot(villagers);
      var targets = this.getResourceTargets(villagers.length);
      var emptyFarms = farms.filter(function (_ref2) {
        var isUsedBy = _ref2.isUsedBy;
        return !isUsedBy;
      });
      if (debug) console.log("Food: ".concat(workerSnapshot.villagersOnFood.length, "/").concat(targets.maxVillagersOnFood, ", Wood: ").concat(workerSnapshot.villagersOnWood.length, "/").concat(targets.maxVillagersOnWood, ", Stone: ").concat(workerSnapshot.villagersOnStone.length, "/").concat(targets.maxVillagersOnStone, ", Gold: ").concat(workerSnapshot.villagersOnGold.length, "/").concat(targets.maxVillagersOnGold, ", Builders: ").concat(workerSnapshot.builderVillagers.length));
      this.updateScout(workerSnapshot.inactifVillagers);
      var availableVillagers = workerSnapshot.inactifVillagers.filter(function (v) {
        return v !== _this.ai.scout;
      });
      var actions = 0;
      this.discoverDeadAnimals(map);
      actions += this.assignFoodSources(availableVillagers, workerSnapshot, targets, emptyFarms);
      actions += this.assignVillagersToResource(availableVillagers, workerSnapshot.villagersOnWood, this.ai.foundedTrees, targets.maxVillagersOnWood, function (villager, tree) {
        villager.sendToTree(tree);
      });
      actions += this.assignVillagersToResource(availableVillagers, workerSnapshot.villagersOnStone, this.ai.foundedStones, targets.maxVillagersOnStone, function (villager, stone) {
        villager.sendToStone(stone);
      });
      actions += this.assignVillagersToResource(availableVillagers, workerSnapshot.villagersOnGold, this.ai.foundedGolds, targets.maxVillagersOnGold, function (villager, gold) {
        villager.sendToGold(gold);
      });
      actions += this.assignBuilders(availableVillagers, notBuiltBuildings, workerSnapshot.builderVillagers, maxVillagersOnConstruction, debug);
      return actions;
    }
  }]);
}();
;// ./app/classes/players/ai.js
function ai_typeof(o) { "@babel/helpers - typeof"; return ai_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, ai_typeof(o); }
function ai_toConsumableArray(r) { return ai_arrayWithoutHoles(r) || ai_iterableToArray(r) || ai_unsupportedIterableToArray(r) || ai_nonIterableSpread(); }
function ai_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function ai_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function ai_arrayWithoutHoles(r) { if (Array.isArray(r)) return ai_arrayLikeToArray(r); }
function ai_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = ai_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function ai_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return ai_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? ai_arrayLikeToArray(r, a) : void 0; } }
function ai_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ai_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function ai_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ai_ownKeys(Object(t), !0).forEach(function (r) { ai_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ai_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function ai_defineProperty(e, r, t) { return (r = ai_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _objectDestructuringEmpty(t) { if (null == t) throw new TypeError("Cannot destructure " + t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ai_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function ai_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, ai_toPropertyKey(o.key), o); } }
function ai_createClass(e, r, t) { return r && ai_defineProperties(e.prototype, r), t && ai_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function ai_toPropertyKey(t) { var i = ai_toPrimitive(t, "string"); return "symbol" == ai_typeof(i) ? i : i + ""; }
function ai_toPrimitive(t, r) { if ("object" != ai_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != ai_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function ai_callSuper(t, o, e) { return o = ai_getPrototypeOf(o), ai_possibleConstructorReturn(t, ai_isNativeReflectConstruct() ? Reflect.construct(o, e || [], ai_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function ai_possibleConstructorReturn(t, e) { if (e && ("object" == ai_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return ai_assertThisInitialized(t); }
function ai_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function ai_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (ai_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function ai_getPrototypeOf(t) { return ai_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, ai_getPrototypeOf(t); }
function ai_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && ai_setPrototypeOf(t, e); }
function ai_setPrototypeOf(t, e) { return ai_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, ai_setPrototypeOf(t, e); }





var DEBUG = false;
var AI = /*#__PURE__*/function (_Player) {
  function AI(_ref, context) {
    var _this;
    var props = _extends({}, (_objectDestructuringEmpty(_ref), _ref));
    ai_classCallCheck(this, AI);
    _this = ai_callSuper(this, AI, [ai_objectSpread(ai_objectSpread({}, props), {}, {
      isPlayed: false,
      type: PLAYER_TYPES.ai
    }), context]);
    _this.foundedTrees = new Set();
    _this.foundedBerrybushs = new Set();
    _this.foundedGolds = new Set();
    _this.foundedStones = new Set();
    _this.foundedAnimals = new Set();
    _this.foundedDeadAnimals = new Set();
    _this.foundedFish = new Set();
    _this.foundedEnemyBuildings = new Set();
    _this.foundedEnemyUnits = new Set();
    _this.difficulty = props.difficulty || 'medium';
    _this.strategy = new AIStrategy(_this, _this.difficulty);
    _this.economy = new AIEconomy(_this);
    _this.strategy.applyConfig(_this);
    _this.stepDelay = _this.difficultyConfig.stepDelayBase;
    _this._scheduleStep();
    _this.selectedUnits = [];
    _this.selectedUnit = null;
    _this.selectedBuilding = null;
    _this.selectedOther = null;
    _this.scout = null;
    _this.phase = 'economy'; // economy | military_build | attack
    return _this;
  }
  ai_inherits(AI, _Player);
  return ai_createClass(AI, [{
    key: "_scheduleStep",
    value: function _scheduleStep() {
      var _this2 = this;
      this._stepTaskId = this.context.scheduler.add(function () {
        var actions = _this2.step();
        var newDelay = actions > 0 ? _this2.difficultyConfig.stepDelayBase : Math.min(Math.round(_this2.stepDelay * 1.5), 5000);
        if (newDelay !== _this2.stepDelay) {
          _this2.stepDelay = newDelay;
          _this2.context.scheduler.update(_this2._stepTaskId, newDelay);
        }
      }, this.stepDelay);
    }
  }, {
    key: "hasNotReachBuildingLimit",
    value: function hasNotReachBuildingLimit(buildingType, buildings) {
      return !this.maxBuildingByAge[this.age][buildingType] || buildings.length < this.maxBuildingByAge[this.age][buildingType];
    }
  }, {
    key: "buildingsByTypes",
    value: function buildingsByTypes(types) {
      return this.buildings.filter(function (b) {
        return types.includes(b.type);
      });
    }

    // Remove depleted resources and destroyed buildings from tracked Sets
  }, {
    key: "cleanupSets",
    value: function cleanupSets() {
      var _iterator = ai_createForOfIteratorHelper(this.foundedTrees),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var r = _step.value;
          if (r.quantity <= 0 || r.isDead) this.foundedTrees["delete"](r);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      var _iterator2 = ai_createForOfIteratorHelper(this.foundedBerrybushs),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _r = _step2.value;
          if (_r.quantity <= 0 || _r.isDead) this.foundedBerrybushs["delete"](_r);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      var _iterator3 = ai_createForOfIteratorHelper(this.foundedStones),
        _step3;
      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var _r2 = _step3.value;
          if (_r2.quantity <= 0 || _r2.isDead) this.foundedStones["delete"](_r2);
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
      var _iterator4 = ai_createForOfIteratorHelper(this.foundedGolds),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var _r3 = _step4.value;
          if (_r3.quantity <= 0 || _r3.isDead) this.foundedGolds["delete"](_r3);
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
      var _iterator5 = ai_createForOfIteratorHelper(this.foundedAnimals),
        _step5;
      try {
        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
          var a = _step5.value;
          if (a.isDead || a.isDestroyed || a.hitPoints <= 0) this.foundedAnimals["delete"](a);
        }
      } catch (err) {
        _iterator5.e(err);
      } finally {
        _iterator5.f();
      }
      var _iterator6 = ai_createForOfIteratorHelper(this.foundedDeadAnimals),
        _step6;
      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var _a = _step6.value;
          if (_a.isDestroyed || _a.quantity <= 0) this.foundedDeadAnimals["delete"](_a);
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
      var _iterator7 = ai_createForOfIteratorHelper(this.foundedFish),
        _step7;
      try {
        for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
          var _r4 = _step7.value;
          if (_r4.quantity <= 0 || _r4.isDead) this.foundedFish["delete"](_r4);
        }
      } catch (err) {
        _iterator7.e(err);
      } finally {
        _iterator7.f();
      }
      var _iterator8 = ai_createForOfIteratorHelper(this.foundedEnemyBuildings),
        _step8;
      try {
        for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
          var b = _step8.value;
          if (b.isDead || b.isDestroyed) this.foundedEnemyBuildings["delete"](b);
        }
      } catch (err) {
        _iterator8.e(err);
      } finally {
        _iterator8.f();
      }
      var _iterator9 = ai_createForOfIteratorHelper(this.foundedEnemyUnits),
        _step9;
      try {
        for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
          var u = _step9.value;
          if (u.isDead || u.isDestroyed || u.hitPoints <= 0) this.foundedEnemyUnits["delete"](u);
        }
      } catch (err) {
        _iterator9.e(err);
      } finally {
        _iterator9.f();
      }
    }
  }, {
    key: "getUnitExtraOptions",
    value: function getUnitExtraOptions(type) {
      var me = this;
      var options = {
        handleSetDest: function handleSetDest(target) {
          var map = me.context.map;
          if (type === UNIT_TYPES.villager && target.family === FAMILY_TYPES.resource) {
            var buildingType = target.type === RESOURCE_TYPES.berrybush ? BUILDING_TYPES.granary : BUILDING_TYPES.storagePit;
            var buildings = me.buildingsByTypes([buildingType]);
            if (canAfford(me, me.config.buildings[buildingType].cost) && me.hasNotReachBuildingLimit(buildingType, buildings)) {
              var closestBuilding = getClosestInstance(target, [].concat(ai_toConsumableArray(buildings), ai_toConsumableArray(me.buildingsByTypes([BUILDING_TYPES.townCenter]))));
              if (!closestBuilding || instancesDistance(closestBuilding, target) > 5) {
                var pos = getPositionInGridAroundInstance(target, map.grid, [1, 5], 1);
                if (pos && me.buyBuilding(pos.i, pos.j, buildingType)) {
                  if (DEBUG) console.log("Building ".concat(buildingType, " at:"), pos);
                }
              }
            }
          }
        }
      };
      if (type === UNIT_TYPES.villager) {
        options.handleIsAttacked = function (attacker, unit) {
          if (attacker.family !== FAMILY_TYPES.animal) {
            unit.runaway(attacker);
            return true;
          }
          return false;
        };
      }
      return options;
    }
  }, {
    key: "canResearchTech",
    value: function canResearchTech(techKey) {
      return this.strategy.canResearchTech(techKey);
    }
  }, {
    key: "getBestInfantryUnit",
    value: function getBestInfantryUnit() {
      return this.strategy.getBestInfantryUnit();
    }
  }, {
    key: "getBestArcherUnit",
    value: function getBestArcherUnit() {
      return this.strategy.getBestArcherUnit();
    }
  }, {
    key: "step",
    value: function step() {
      var _this3 = this;
      var _this$context = this.context,
        map = _this$context.map,
        paused = _this$context.paused;
      if (paused) return 0;
      var actions = 0;
      var maxVillagers = Math.floor(this.maxVillagerPerAge[this.age] * this.difficultyConfig.popCapMultiplier);
      var maxVillagersOnConstruction = 2 + this.age * 2;
      var maxInfantry = this.maxInfantryByAge[this.age];
      var maxArcher = this.maxArcherByAge[this.age];
      var maxCavalry = this.maxCavalryByAge[this.age];
      var maxHoplite = this.maxHopliteByAge[this.age];
      var infantryUnit = this.getBestInfantryUnit();
      var archerUnit = this.getBestArcherUnit();
      var howManySoldiersBeforeAttack = this.difficultyConfig.attackThreshold;
      if (DEBUG) {
        console.log('----Step started');
        console.log("Age: ".concat(this.age, ", Wood: ").concat(this.wood, ", Food: ").concat(this.food, ", Stone: ").concat(this.stone, ", Gold: ").concat(this.gold, ", Population: ").concat(this.population, "/").concat(this.population_max));
      }
      var filterUnitsByType = function filterUnitsByType(type) {
        var condition = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (unit) {
          return unit.hitPoints > 0;
        };
        return _this3.units.filter(function (unit) {
          return unit.type === type && condition(unit);
        });
      };
      var villagers = filterUnitsByType(UNIT_TYPES.villager);
      var infantry = this.units.filter(function (u) {
        return u.hitPoints > 0 && ['Clubman', 'Axeman', 'ShortSwordsman', 'BroadSwordsman', 'LongSwordsman'].includes(u.type);
      });
      var archers = this.units.filter(function (u) {
        return u.hitPoints > 0 && ['Bowman', 'ImprovedBowman', 'CompositeBowman'].includes(u.type);
      });
      var cavalry = this.units.filter(function (u) {
        return u.hitPoints > 0 && u.type === 'Scout';
      });
      var hoplites = this.units.filter(function (u) {
        return u.hitPoints > 0 && u.type === 'Hoplite';
      });
      var military = [].concat(ai_toConsumableArray(infantry), ai_toConsumableArray(archers), ai_toConsumableArray(cavalry), ai_toConsumableArray(hoplites));
      if (DEBUG) console.log("Villagers: ".concat(villagers.length, "/").concat(maxVillagers, ", Infantry: ").concat(infantry.length, "/").concat(maxInfantry, " (").concat(infantryUnit, "), Archers: ").concat(archers.length, "/").concat(maxArcher, " (").concat(archerUnit, "), Cavalry: ").concat(cavalry.length, "/").concat(maxCavalry, ", Hoplites: ").concat(hoplites.length, "/").concat(maxHoplite));
      var previousPhase = this.phase;
      this.strategy.updatePhase(villagers.length, military.length);
      if (DEBUG && previousPhase !== this.phase) console.log("Phase: ".concat(previousPhase, " \u2192 ").concat(this.phase));
      if (DEBUG) console.log("Phase: ".concat(this.phase));
      var towncenters = this.buildingsByTypes([BUILDING_TYPES.townCenter]);
      var storagepits = this.buildingsByTypes([BUILDING_TYPES.storagePit]);
      var houses = this.buildingsByTypes([BUILDING_TYPES.house]);
      var granarys = this.buildingsByTypes([BUILDING_TYPES.granary]);
      var barracks = this.buildingsByTypes([BUILDING_TYPES.barracks]);
      var markets = this.buildingsByTypes([BUILDING_TYPES.market]);
      var farms = this.buildingsByTypes([BUILDING_TYPES.farm]);
      var archeryRanges = this.buildingsByTypes([BUILDING_TYPES.archeryRange]);
      var stables = this.buildingsByTypes([BUILDING_TYPES.stable]);
      var academies = this.buildingsByTypes([BUILDING_TYPES.academy]);
      var watchTowers = this.buildingsByTypes([BUILDING_TYPES.watchTower]);
      var sentryTowers = this.buildingsByTypes([BUILDING_TYPES.sentryTower]);
      if (DEBUG) console.log("Towncenters: ".concat(towncenters.length, ", Houses: ").concat(houses.length, ", StoragePits: ").concat(storagepits.length, ", Granaries: ").concat(granarys.length, ", Barracks: ").concat(barracks.length, ", Markets: ").concat(markets.length));
      var notBuiltBuildings = this.buildings.filter(function (b) {
        return !b.isBuilt || b.hitPoints > 0 && b.hitPoints < b.totalHitPoints;
      }).sort(function (a, b) {
        return a.type === BUILDING_TYPES.house ? -1 : b.type === BUILDING_TYPES.house ? 1 : 0;
      });
      var notBuiltHouses = notBuiltBuildings.filter(function (b) {
        return b.type === BUILDING_TYPES.house;
      });

      // Retreat: critically injured assault soldiers fall back and stop attacking
      var RETREAT_HP_RATIO = 0.3;
      military.filter(function (u) {
        return u.assault && u.hitPoints < u.totalHitPoints * RETREAT_HP_RATIO;
      }).forEach(function (u) {
        u.assault = false;
        u.stop();
      });

      // Soldiers: those already on assault vs those waiting at base (exclude low-HP from attack pool)
      var inactifMilitary = military.filter(function (c) {
        return c.inactif && c.action !== ACTION_TYPES.attack && c.assault;
      });
      var waitingMilitary = military.filter(function (c) {
        return c.inactif && c.action !== ACTION_TYPES.attack && !c.assault && c.hitPoints >= c.totalHitPoints * RETREAT_HP_RATIO;
      });
      if (DEBUG) console.log("Inactif Military: ".concat(inactifMilitary.length, ", Waiting Military: ").concat(waitingMilitary.length));

      // Player losing condition
      if (!this.buildings.length && !this.units.length) {
        if (DEBUG) console.log('Player has no buildings and units. Dying...');
        this.die();
        return 0;
      }

      // Remove depleted resources and destroyed enemies from tracked sets
      this.cleanupSets();

      // Cache otherPlayers once — used in multiple building placement filters below
      var otherPlayers = this.otherPlayers();
      actions += this.economy.handleVillagerActions({
        villagers: villagers,
        map: map,
        farms: farms,
        notBuiltBuildings: notBuiltBuildings,
        maxVillagersOnConstruction: maxVillagersOnConstruction,
        debug: DEBUG
      });
      actions += this.strategy.handleMilitaryActions({
        waitingMilitary: waitingMilitary,
        inactifMilitary: inactifMilitary,
        howManySoldiersBeforeAttack: howManySoldiersBeforeAttack,
        debug: DEBUG
      });
      var strategySnapshot = {
        map: map,
        otherPlayers: otherPlayers,
        villagers: villagers,
        maxVillagers: maxVillagers,
        towncenters: towncenters,
        infantry: infantry,
        maxInfantry: maxInfantry,
        barracks: barracks,
        infantryUnit: infantryUnit,
        archers: archers,
        maxArcher: maxArcher,
        archeryRanges: archeryRanges,
        archerUnit: archerUnit,
        cavalry: cavalry,
        maxCavalry: maxCavalry,
        stables: stables,
        hoplites: hoplites,
        maxHoplite: maxHoplite,
        academies: academies,
        houses: houses,
        farms: farms,
        granarys: granarys,
        storagepits: storagepits,
        markets: markets,
        watchTowers: watchTowers,
        sentryTowers: sentryTowers,
        notBuiltHouses: notBuiltHouses
      };
      actions += this.strategy.handleProductionActions(strategySnapshot, DEBUG);
      actions += this.strategy.handleBuildingActions(strategySnapshot, DEBUG);
      actions += this.strategy.handleTechnologyActions(strategySnapshot, DEBUG);
      if (DEBUG) console.log('----Step ended');
      return actions;
    }
  }, {
    key: "die",
    value: function die() {
      var players = this.context.players;
      this.context.scheduler.remove(this._stepTaskId);
      players.splice(players.indexOf(this), 1);
    }
  }]);
}(Player);
;// ./app/ui/AnimalInterface.js
function AnimalInterface_typeof(o) { "@babel/helpers - typeof"; return AnimalInterface_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AnimalInterface_typeof(o); }
function AnimalInterface_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AnimalInterface_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AnimalInterface_toPropertyKey(o.key), o); } }
function AnimalInterface_createClass(e, r, t) { return r && AnimalInterface_defineProperties(e.prototype, r), t && AnimalInterface_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AnimalInterface_toPropertyKey(t) { var i = AnimalInterface_toPrimitive(t, "string"); return "symbol" == AnimalInterface_typeof(i) ? i : i + ""; }
function AnimalInterface_toPrimitive(t, r) { if ("object" != AnimalInterface_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AnimalInterface_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var AnimalInterface = /*#__PURE__*/function () {
  function AnimalInterface(animal) {
    AnimalInterface_classCallCheck(this, AnimalInterface);
    this.animal = animal;
  }
  return AnimalInterface_createClass(AnimalInterface, [{
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var animal = this.animal;
      var menu = animal.context.menu;
      var civDiv = document.createElement('div');
      civDiv.id = MENU_INFO_IDS.civ;
      civDiv.textContent = '';
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = MENU_INFO_IDS.type;
      typeDiv.textContent = t(animal.type);
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = MENU_INFO_IDS.icon;
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      var hitPointsDiv = document.createElement('div');
      hitPointsDiv.id = MENU_INFO_IDS.hitPoints;
      hitPointsDiv.textContent = animal.hitPoints + '/' + animal.totalHitPoints;
      element.appendChild(hitPointsDiv);
      var quantityDiv = document.createElement('div');
      quantityDiv.id = MENU_INFO_IDS.quantity;
      quantityDiv.className = 'resource-quantity';
      var smallIconImg = document.createElement('img');
      smallIconImg.src = menu.icons['food'];
      smallIconImg.className = 'resource-quantity-icon';
      var textDiv = document.createElement('div');
      textDiv.id = MENU_INFO_IDS.quantityText;
      textDiv.textContent = animal.quantity;
      quantityDiv.appendChild(smallIconImg);
      quantityDiv.appendChild(textDiv);
      element.appendChild(quantityDiv);
    }
  }]);
}();
;// ./app/classes/animal/AnimalLifecycle.js
function AnimalLifecycle_typeof(o) { "@babel/helpers - typeof"; return AnimalLifecycle_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AnimalLifecycle_typeof(o); }
function AnimalLifecycle_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AnimalLifecycle_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AnimalLifecycle_toPropertyKey(o.key), o); } }
function AnimalLifecycle_createClass(e, r, t) { return r && AnimalLifecycle_defineProperties(e.prototype, r), t && AnimalLifecycle_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AnimalLifecycle_toPropertyKey(t) { var i = AnimalLifecycle_toPrimitive(t, "string"); return "symbol" == AnimalLifecycle_typeof(i) ? i : i + ""; }
function AnimalLifecycle_toPrimitive(t, r) { if ("object" != AnimalLifecycle_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AnimalLifecycle_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var AnimalLifecycle = /*#__PURE__*/function () {
  function AnimalLifecycle(animal) {
    AnimalLifecycle_classCallCheck(this, AnimalLifecycle);
    this.animal = animal;
  }
  return AnimalLifecycle_createClass(AnimalLifecycle, [{
    key: "die",
    value: function die() {
      var animal = this.animal;
      if (animal.isDead) return;
      if (animal.sounds && animal.context.controls.instanceInCamera(animal)) {
        animal.sounds.die && sound_lib/* sound */.s3.play(animal.sounds.die);
        animal.sounds.fall && sound_lib/* sound */.s3.play(animal.sounds.fall);
      }
      updateInstanceVisibility(animal);
      animal.owner.population--;
      animal.stopInterval();
      animal.stopTimeout();
      animal.isDead = true;
      animal.zIndex--;
      animal.path = [];
      animal.action = null;
      animal.death();
    }
  }, {
    key: "death",
    value: function death() {
      var animal = this.animal;
      animal.setTextures(SHEET_TYPES.dying);
      animal.zIndex--;
      animal.sprite.loop = false;
      animal.sprite.onComplete = function () {
        return animal.decompose();
      };
    }
  }, {
    key: "decompose",
    value: function decompose() {
      var animal = this.animal;
      var _animal$context = animal.context,
        player = _animal$context.player,
        menu = _animal$context.menu;
      animal.setTextures(SHEET_TYPES.corpse);
      animal.sprite.animationSpeed = 0;
      animal.startInterval(function () {
        if (animal.quantity > 0) {
          animal.quantity--;
          if (animal.selected && player.selectedOther === animal) {
            menu.updateInfo(MENU_INFO_IDS.quantityText, animal.quantity);
          }
        }
        animal.updateTexture();
      }, 5000);
    }
  }, {
    key: "updateTexture",
    value: function updateTexture() {
      var animal = this.animal;
      var _animal$context2 = animal.context,
        player = _animal$context2.player,
        map = _animal$context2.map;
      var percentage = getPercentage(animal.quantity, animal.totalQuantity);
      if (percentage > 25 && percentage < 50) {
        animal.sprite.currentFrame = 1;
      } else if (percentage > 0 && percentage <= 25) {
        animal.sprite.currentFrame = 2;
      } else if (percentage <= 0) {
        animal.stopInterval();
        if (map.grid[animal.i][animal.j].has === animal) {
          map.grid[animal.i][animal.j].has = null;
          map.grid[animal.i][animal.j].corpses.add(animal);
          map.grid[animal.i][animal.j].solid = false;
        }
        if (animal.selected && player.selectedOther === animal) {
          player.unselectAll();
        }
        animal.sprite.currentFrame = 3;
        animal.timeoutId = animal.context.scheduler.addOneShot(function () {
          return animal.clear();
        }, CORPSE_TIME * 1000);
      }
    }
  }, {
    key: "clear",
    value: function clear() {
      var animal = this.animal;
      var map = animal.context.map;
      animal.stopTimeout();
      animal.isDestroyed = true;
      map.grid[animal.i][animal.j].corpses["delete"](animal);
      map.removeChild(animal);
      animal.destroy({
        child: true,
        texture: true
      });
    }
  }]);
}();
;// ./app/classes/animal/AnimalMovement.js
function AnimalMovement_typeof(o) { "@babel/helpers - typeof"; return AnimalMovement_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AnimalMovement_typeof(o); }
function AnimalMovement_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AnimalMovement_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AnimalMovement_toPropertyKey(o.key), o); } }
function AnimalMovement_createClass(e, r, t) { return r && AnimalMovement_defineProperties(e.prototype, r), t && AnimalMovement_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AnimalMovement_toPropertyKey(t) { var i = AnimalMovement_toPrimitive(t, "string"); return "symbol" == AnimalMovement_typeof(i) ? i : i + ""; }
function AnimalMovement_toPrimitive(t, r) { if ("object" != AnimalMovement_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AnimalMovement_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var AnimalMovement = /*#__PURE__*/function () {
  function AnimalMovement(animal) {
    AnimalMovement_classCallCheck(this, AnimalMovement);
    this.animal = animal;
  }
  return AnimalMovement_createClass(AnimalMovement, [{
    key: "hasPath",
    value: function hasPath() {
      return this.animal.path.length > 0;
    }
  }, {
    key: "setDest",
    value: function setDest(dest) {
      var animal = this.animal;
      if (!dest) {
        animal.stop();
        return;
      }
      animal.dest = dest;
      animal.realDest = {
        i: dest.i,
        j: dest.j
      };
    }
  }, {
    key: "setPath",
    value: function setPath(path) {
      var animal = this.animal;
      if (!path.length) {
        animal.stop();
        return;
      }
      animal.setTextures(SHEET_TYPES.walking);
      animal.inactif = false;
      animal.path = path;
      animal.startInterval(function () {
        return animal.step();
      }, STEP_TIME, true);
    }
  }, {
    key: "isAnimalAtDest",
    value: function isAnimalAtDest(action, dest) {
      var animal = this.animal;
      if (!action) return false;
      if (!dest) {
        animal.affectNewDest();
        return false;
      }
      return instanceContactInstance(animal, dest);
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      var animal = this.animal;
      return (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) && instancesDistance(animal, animal.dest) <= animal.sight;
    }
  }, {
    key: "sendTo",
    value: function sendTo(dest, action) {
      var _map$grid$animal$i$an;
      var animal = this.animal;
      var map = animal.context.map;
      animal.stopInterval();
      if (!dest) {
        animal.stop();
        return;
      }
      if (this.isAnimalAtDest(action, dest) && (!map.grid[animal.i][animal.j].solid || map.grid[animal.i][animal.j].solid && ((_map$grid$animal$i$an = map.grid[animal.i][animal.j].has) === null || _map$grid$animal$i$an === void 0 ? void 0 : _map$grid$animal$i$an.label) === animal.label)) {
        animal.setDest(dest);
        animal.action = action;
        animal.degree = getInstanceDegree(animal, dest.x, dest.y);
        animal.getAction(action);
        return;
      }
      var path = [];
      if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
        path = getInstanceClosestFreeCellPath(animal, dest, map);
      } else {
        path = getInstancePath(animal, dest.i, dest.j, map);
      }
      if (path.length) {
        animal.setDest(dest);
        animal.action = action;
        animal.setPath(path);
      } else {
        animal.stop();
      }
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      var animal = this.animal;
      var map = animal.context.map;
      var next = animal.path[animal.path.length - 1];
      var nextCell = map.grid[next.i][next.j];
      if (!animal.dest || animal.dest.isDestroyed) {
        animal.affectNewDest();
        return;
      }
      if (nextCell.has && nextCell.has.family === FAMILY_TYPES.animal && nextCell.has.label !== animal.label && nextCell.has.hasPath() && instancesDistance(animal, nextCell.has) <= 1 && nextCell.has.sprite.playing) {
        animal.sprite.stop();
        return;
      }
      if (nextCell.solid && animal.dest) {
        animal.sendTo(animal.dest, animal.action);
        return;
      }
      if (!animal.sprite.playing) {
        animal.sprite.play();
      }
      animal.zIndex = getInstanceZIndex(animal);
      if (instancesDistance(animal, nextCell, false) < animal.speed) {
        var oldI = animal.i,
          oldJ = animal.j;
        animal.z = nextCell.z;
        animal.i = nextCell.i;
        animal.j = nextCell.j;
        if (animal.currentCell.has === animal) {
          animal.currentCell.has = null;
          animal.currentCell.solid = false;
        }
        animal.currentCell = map.grid[animal.i][animal.j];
        if (animal.currentCell.has === null) {
          animal.currentCell.place(animal);
          animal.currentCell.solid = true;
        }
        map.updateInstanceBucket(animal, oldI, oldJ);
        updateInstanceVisibility(animal);
        animal.path.pop();
        if (this.destHasMoved()) {
          animal.sendTo(animal.dest, animal.action);
          return;
        }
        if (this.isAnimalAtDest(animal.action, animal.dest)) {
          animal.path = [];
          animal.stopInterval();
          animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y);
          animal.getAction(animal.action);
          return;
        }
        if (!animal.path.length) {
          animal.stop();
        }
      } else {
        var oldDeg = animal.degree;
        moveTowardPoint(animal, nextCell.x, nextCell.y, animal.speed);
        if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
          animal.setTextures(SHEET_TYPES.walking);
        }
      }
    }
  }]);
}();
;// ./app/classes/animal/AnimalCombat.js
function AnimalCombat_typeof(o) { "@babel/helpers - typeof"; return AnimalCombat_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, AnimalCombat_typeof(o); }
function AnimalCombat_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function AnimalCombat_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, AnimalCombat_toPropertyKey(o.key), o); } }
function AnimalCombat_createClass(e, r, t) { return r && AnimalCombat_defineProperties(e.prototype, r), t && AnimalCombat_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function AnimalCombat_toPropertyKey(t) { var i = AnimalCombat_toPrimitive(t, "string"); return "symbol" == AnimalCombat_typeof(i) ? i : i + ""; }
function AnimalCombat_toPrimitive(t, r) { if ("object" != AnimalCombat_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != AnimalCombat_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var AnimalCombat = /*#__PURE__*/function () {
  function AnimalCombat(animal) {
    AnimalCombat_classCallCheck(this, AnimalCombat);
    this.animal = animal;
  }
  return AnimalCombat_createClass(AnimalCombat, [{
    key: "getReaction",
    value: function getReaction(instance) {
      var animal = this.animal;
      if (animal.strategy === 'runaway') {
        animal.runaway(instance);
      } else {
        animal.sendTo(instance, ACTION_TYPES.attack);
      }
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      var animal = this.animal;
      if (animal.strategy && instance && instance.family === FAMILY_TYPES.unit && !animal.isDead && !animal.path.length && !animal.dest) {
        this.getReaction(instance);
      }
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      var animal = this.animal;
      if (!instance || animal.dest || animal.isDead) return;
      this.getReaction(instance);
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      var animal = this.animal;
      animal.stopInterval();
      var targets = findInstancesInSight(animal, function (instance) {
        return animal.getActionCondition(instance);
      });
      if (targets.length) {
        var target = getClosestInstanceWithPath(animal, targets);
        if (target) {
          if (instanceContactInstance(animal, target)) {
            animal.degree = getInstanceDegree(animal, target.x, target.y);
            animal.getAction(animal.action);
            return;
          }
          animal.setDest(target.instance);
          animal.setPath(target.path);
          return;
        }
      }
      animal.stop();
    }
  }, {
    key: "runaway",
    value: function runaway(instance) {
      var animal = this.animal;
      var map = animal.context.map;
      var dest = null;
      getCellsAroundPoint(animal.i, animal.j, map.grid, animal.sight, function (cell) {
        if (!cell.solid && (!dest || pointsDistance(cell.i, cell.j, instance.i, instance.j) > pointsDistance(dest.i, dest.j, instance.i, instance.j))) {
          dest = animal.owner.views[cell.i][cell.j];
        }
      });
      if (dest) {
        animal.sendTo(dest);
      } else {
        animal.stop();
      }
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      var animal = this.animal;
      var _animal$context = animal.context,
        menu = _animal$context.menu,
        player = _animal$context.player;
      switch (name) {
        case ACTION_TYPES.attack:
          if (!animal.getActionCondition(animal.dest)) {
            animal.affectNewDest();
            return;
          }
          animal.setTextures(SHEET_TYPES.action);
          animal.startInterval(function () {
            if (!animal.getActionCondition(animal.dest)) {
              if (animal.dest && animal.dest.hitPoints <= 0) {
                animal.dest.die();
              }
              animal.affectNewDest();
              return;
            }
            if (animal.destHasMoved()) {
              animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y);
              animal.setTextures(SHEET_TYPES.action);
            }
            if (!instanceContactInstance(animal, animal.dest)) {
              animal.sendTo(animal.dest, ACTION_TYPES.attack);
              return;
            }
            animal.sounds && animal.sounds.hit && animal.context.controls.instanceInCamera(animal) && sound_lib/* sound */.s3.play(animal.sounds.hit);
            if (animal.dest.hitPoints > 0) {
              animal.dest.hitPoints = getHitPointsWithDamage(animal, animal.dest);
              if (animal.dest.selected && player && (player.selectedUnit === animal.dest || player.selectedBuilding === animal.dest)) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, animal.dest.hitPoints + '/' + animal.dest.totalHitPoints);
              }
              animal.dest.isAttacked(animal);
            }
            if (animal.dest.hitPoints <= 0) {
              animal.dest.die();
              animal.affectNewDest();
            }
          }, animal.rateOfFire * 1000, false);
          break;
        default:
          animal.stop();
      }
    }
  }]);
}();
;// ./app/classes/animal/index.js
function animal_typeof(o) { "@babel/helpers - typeof"; return animal_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, animal_typeof(o); }
function animal_slicedToArray(r, e) { return animal_arrayWithHoles(r) || animal_iterableToArrayLimit(r, e) || animal_unsupportedIterableToArray(r, e) || animal_nonIterableRest(); }
function animal_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function animal_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return animal_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? animal_arrayLikeToArray(r, a) : void 0; } }
function animal_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function animal_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function animal_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function animal_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function animal_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, animal_toPropertyKey(o.key), o); } }
function animal_createClass(e, r, t) { return r && animal_defineProperties(e.prototype, r), t && animal_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function animal_toPropertyKey(t) { var i = animal_toPrimitive(t, "string"); return "symbol" == animal_typeof(i) ? i : i + ""; }
function animal_toPrimitive(t, r) { if ("object" != animal_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != animal_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function animal_callSuper(t, o, e) { return o = animal_getPrototypeOf(o), animal_possibleConstructorReturn(t, animal_isNativeReflectConstruct() ? Reflect.construct(o, e || [], animal_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function animal_possibleConstructorReturn(t, e) { if (e && ("object" == animal_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return animal_assertThisInitialized(t); }
function animal_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function animal_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (animal_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function animal_getPrototypeOf(t) { return animal_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, animal_getPrototypeOf(t); }
function animal_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && animal_setPrototypeOf(t, e); }
function animal_setPrototypeOf(t, e) { return animal_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, animal_setPrototypeOf(t, e); }









var Animal = /*#__PURE__*/function (_Instance) {
  function Animal(options, context) {
    var _this$x, _this$y, _this$z, _this$hitPoints, _this$quantity, _this$loop;
    var _this;
    animal_classCallCheck(this, Animal);
    _this = animal_callSuper(this, Animal, [context]);
    _this.selectionFactor = 0.5;
    var _this2 = _this,
      map = _this2.context.map;
    _this.family = FAMILY_TYPES.animal;
    _this.animalInterface = new AnimalInterface(_this);
    _this.animalLifecycle = new AnimalLifecycle(_this);
    _this.animalMovement = new AnimalMovement(_this);
    _this.animalCombat = new AnimalCombat(_this);
    _this.dest = null;
    _this.realDest = null;
    _this.previousDest = null;
    _this.path = [];
    _this.degree = randomRange(1, 360);
    _this.action = null;
    _this.currentFrame = 0;
    _this.currentSheet = SHEET_TYPES.standing;
    _this.inactif = true;
    _this.x = null;
    _this.y = null;
    _this.z = null;
    Object.assign(_this, options);
    Object.assign(_this, _this.owner.config.animals[_this.type]);
    _this.size = 1;
    _this.visible = false;
    _this.visibleCells = new Set();
    _this.x = (_this$x = _this.x) !== null && _this$x !== void 0 ? _this$x : map.grid[_this.i][_this.j].x;
    _this.y = (_this$y = _this.y) !== null && _this$y !== void 0 ? _this$y : map.grid[_this.i][_this.j].y;
    _this.z = (_this$z = _this.z) !== null && _this$z !== void 0 ? _this$z : map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.currentCell = map.grid[_this.i][_this.j];
    _this.currentCell.place(_this);
    _this.currentCell.solid = true;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.totalHitPoints;
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
    map.addToInstanceBucket(_this);
    for (var _i = 0, _Object$entries = Object.entries(_this.assets); _i < _Object$entries.length; _i++) {
      var _Object$entries$_i = animal_slicedToArray(_Object$entries[_i], 2),
        key = _Object$entries$_i[0],
        value = _Object$entries$_i[1];
      _this[key] = lib/* Assets */.sP.cache.get(value);
    }
    _this["interface"] = {
      info: function info(element) {
        var data = _this.owner.config.animals[_this.type];
        _this.setDefaultInterface(element, data);
      }
    };
    _this.allowMove = false;
    _this.eventMode = 'static';
    _this.sprite = new lib/* AnimatedSprite */.Dl5(_this.standingSheet.animations['south']);
    _this.sprite.label = LABEL_TYPES.sprite;
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'auto';
    _this.sprite.allowClick = false;
    _this.sprite.roundPixels = true;
    _this.sprite.loop = (_this$loop = _this.loop) !== null && _this$loop !== void 0 ? _this$loop : true;
    if (_this.isDead) {
      _this.currentSheet === SHEET_TYPES.corpse ? _this.decompose() : _this.death();
    } else {
      _this.setTextures(_this.currentSheet);
    }
    _this.sprite.currentFrame = _this.currentFrame;
    _this.on('pointerup', function (evt) {
      var _this3 = _this,
        _this3$context = _this3.context,
        controls = _this3$context.controls,
        player = _this3$context.player,
        menu = _this3$context.menu;
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return;
      }
      controls.mouse.prevent = true;
      var drawDestinationRectangle = false;
      var hasSentVillager = false;
      var hasSentOther = false;
      if (player.selectedUnits.length) {
        for (var i = 0; i < player.selectedUnits.length; i++) {
          var playerUnit = player.selectedUnits[i];
          if (playerUnit.type === UNIT_TYPES.villager) {
            if (extra_getActionCondition(playerUnit, _this, ACTION_TYPES.hunt)) {
              playerUnit.sendToHunt(_this);
              hasSentVillager = true;
              drawDestinationRectangle = true;
            } else if (extra_getActionCondition(playerUnit, _this, ACTION_TYPES.takemeat)) {
              playerUnit.sendToTakeMeat(_this);
              hasSentVillager = true;
              drawDestinationRectangle = true;
            }
          } else if (extra_getActionCondition(playerUnit, _this, ACTION_TYPES.attack)) {
            playerUnit.sendTo(_this, ACTION_TYPES.attack);
            drawDestinationRectangle = true;
            hasSentOther = true;
          }
        }
      } else if (player.selectedBuilding && player.selectedBuilding.range) {
        if (extra_getActionCondition(player.selectedBuilding, _this, ACTION_TYPES.attack) && instancesDistance(player.selectedBuilding, _this) <= player.selectedBuilding.range) {
          player.selectedBuilding.attackAction(_this);
          drawDestinationRectangle = true;
        }
      } else if ((instanceIsInPlayerSight(_this, player) || map.revealEverything) && _this.quantity > 0) {
        player.unselectAll();
        _this.select();
        menu.setBottombar(_this);
        player.selectedOther = _this;
      }
      if (hasSentOther) {
        var voice = maths_randomItem(['5075', '5076', '5128', '5164']);
        sound_lib/* sound */.s3.play(voice);
      } else if (hasSentVillager) {
        var _voice = lib/* Assets */.sP.cache.get('config').units.Villager.sounds.hunt;
        sound_lib/* sound */.s3.play(_voice);
      }
      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(_this);
      }
    });
    _this.sprite.updateAnchor = true;
    _this.addChild(_this.sprite);
    setTimeout(function () {
      updateInstanceVisibility(_this);
    });
    return _this;
  }
  animal_inherits(Animal, _Instance);
  return animal_createClass(Animal, [{
    key: "stop",
    value: function stop() {
      if (this.currentCell.has && this.currentCell.has.label !== this.label && this.currentCell.solid) {
        this.sendTo(this.currentCell);
        return;
      }
      this.inactif = true;
      this.action = null;
      this.dest = null;
      this.realDest = null;
      this.currentCell.place(this);
      this.currentCell.solid = true;
      this.path = [];
      this.stopInterval();
      this.setTextures(SHEET_TYPES.standing);
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      return this.animalInterface.setDefaultInterface(element, data);
    }

    // AnimalLifecycle
  }, {
    key: "die",
    value: function die() {
      return this.animalLifecycle.die();
    }
  }, {
    key: "death",
    value: function death() {
      return this.animalLifecycle.death();
    }
  }, {
    key: "decompose",
    value: function decompose() {
      return this.animalLifecycle.decompose();
    }
  }, {
    key: "updateTexture",
    value: function updateTexture() {
      return this.animalLifecycle.updateTexture();
    }
  }, {
    key: "clear",
    value: function clear() {
      return this.animalLifecycle.clear();
    }

    // AnimalMovement
  }, {
    key: "hasPath",
    value: function hasPath() {
      return this.animalMovement.hasPath();
    }
  }, {
    key: "setDest",
    value: function setDest(dest) {
      return this.animalMovement.setDest(dest);
    }
  }, {
    key: "setPath",
    value: function setPath(path) {
      return this.animalMovement.setPath(path);
    }
  }, {
    key: "isAnimalAtDest",
    value: function isAnimalAtDest(action, dest) {
      return this.animalMovement.isAnimalAtDest(action, dest);
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      return this.animalMovement.destHasMoved();
    }
  }, {
    key: "sendTo",
    value: function sendTo(dest, action) {
      return this.animalMovement.sendTo(dest, action);
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      return this.animalMovement.moveToPath();
    }

    // AnimalCombat
  }, {
    key: "getReaction",
    value: function getReaction(instance) {
      return this.animalCombat.getReaction(instance);
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      return this.animalCombat.detect(instance);
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      return this.animalCombat.isAttacked(instance);
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      return this.animalCombat.affectNewDest();
    }
  }, {
    key: "runaway",
    value: function runaway(instance) {
      return this.animalCombat.runaway(instance);
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      return this.animalCombat.getAction(name);
    }
  }]);
}(Instance);
;// ./app/classes/players/gaia.js
function gaia_typeof(o) { "@babel/helpers - typeof"; return gaia_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, gaia_typeof(o); }
function gaia_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function gaia_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? gaia_ownKeys(Object(t), !0).forEach(function (r) { gaia_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : gaia_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function gaia_defineProperty(e, r, t) { return (r = gaia_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function gaia_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function gaia_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, gaia_toPropertyKey(o.key), o); } }
function gaia_createClass(e, r, t) { return r && gaia_defineProperties(e.prototype, r), t && gaia_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function gaia_toPropertyKey(t) { var i = gaia_toPrimitive(t, "string"); return "symbol" == gaia_typeof(i) ? i : i + ""; }
function gaia_toPrimitive(t, r) { if ("object" != gaia_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != gaia_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function gaia_callSuper(t, o, e) { return o = gaia_getPrototypeOf(o), gaia_possibleConstructorReturn(t, gaia_isNativeReflectConstruct() ? Reflect.construct(o, e || [], gaia_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function gaia_possibleConstructorReturn(t, e) { if (e && ("object" == gaia_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return gaia_assertThisInitialized(t); }
function gaia_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function gaia_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (gaia_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function gaia_getPrototypeOf(t) { return gaia_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, gaia_getPrototypeOf(t); }
function gaia_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && gaia_setPrototypeOf(t, e); }
function gaia_setPrototypeOf(t, e) { return gaia_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, gaia_setPrototypeOf(t, e); }



var Gaia = /*#__PURE__*/function (_Player) {
  function Gaia(context) {
    gaia_classCallCheck(this, Gaia);
    return gaia_callSuper(this, Gaia, [{
      i: 0,
      j: 0,
      type: PLAYER_TYPES.gaia
    }, context]);
  }
  gaia_inherits(Gaia, _Player);
  return gaia_createClass(Gaia, [{
    key: "createAnimal",
    value: function createAnimal(options) {
      var context = this.context;
      var unit = context.map.addChild(new Animal(gaia_objectSpread(gaia_objectSpread({}, options), {}, {
        owner: this
      }), context));
      this.units.push(unit);
      return unit;
    }
  }]);
}(Player);
;// ./app/classes/players/human.js
function human_typeof(o) { "@babel/helpers - typeof"; return human_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, human_typeof(o); }
function human_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function human_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? human_ownKeys(Object(t), !0).forEach(function (r) { human_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : human_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function human_defineProperty(e, r, t) { return (r = human_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function human_objectDestructuringEmpty(t) { if (null == t) throw new TypeError("Cannot destructure " + t); }
function human_extends() { return human_extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, human_extends.apply(null, arguments); }
function human_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function human_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, human_toPropertyKey(o.key), o); } }
function human_createClass(e, r, t) { return r && human_defineProperties(e.prototype, r), t && human_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function human_toPropertyKey(t) { var i = human_toPrimitive(t, "string"); return "symbol" == human_typeof(i) ? i : i + ""; }
function human_toPrimitive(t, r) { if ("object" != human_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != human_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function human_callSuper(t, o, e) { return o = human_getPrototypeOf(o), human_possibleConstructorReturn(t, human_isNativeReflectConstruct() ? Reflect.construct(o, e || [], human_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function human_possibleConstructorReturn(t, e) { if (e && ("object" == human_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return human_assertThisInitialized(t); }
function human_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function human_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (human_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function human_getPrototypeOf(t) { return human_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, human_getPrototypeOf(t); }
function human_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && human_setPrototypeOf(t, e); }
function human_setPrototypeOf(t, e) { return human_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, human_setPrototypeOf(t, e); }


var Human = /*#__PURE__*/function (_Player) {
  function Human(_ref, context) {
    var _this;
    var props = human_extends({}, (human_objectDestructuringEmpty(_ref), _ref));
    human_classCallCheck(this, Human);
    _this = human_callSuper(this, Human, [human_objectSpread(human_objectSpread({}, props), {}, {
      type: PLAYER_TYPES.human
    }), context]);
    _this.selectedUnits = [];
    _this.selectedUnit = null;
    _this.selectedBuilding = null;
    _this.selectedOther = null;
    return _this;
  }
  human_inherits(Human, _Player);
  return human_createClass(Human, [{
    key: "unselectUnit",
    value: function unselectUnit(unit) {
      var menu = this.context.menu;
      var index = this.selectedUnits.indexOf(unit);
      this.selectedUnits.splice(index, 1);
      if (!this.selectedUnits.length) {
        this.selectedUnit = null;
        this.selectedUnits = [];
        menu.setBottombar();
        return;
      }
      var nextVillager;
      if (this.selectedUnit === unit) {
        for (var i = 0; i < this.selectedUnits.length; i++) {
          if (this.selectedUnits[i].type === UNIT_TYPES.villager) {
            nextVillager = this.selectedUnits[i].type;
            break;
          }
        }
      }
      this.selectedUnit = nextVillager || this.selectedUnits[0];
      menu.setBottombar(this.selectedUnit);
    }
  }, {
    key: "unselectAllUnits",
    value: function unselectAllUnits() {
      var menu = this.context.menu;
      for (var i = 0; i < this.selectedUnits.length; i++) {
        this.selectedUnits[i].unselect();
      }
      this.selectedUnit = null;
      this.selectedUnits = [];
      menu.setBottombar();
    }
  }, {
    key: "unselectAll",
    value: function unselectAll() {
      if (this.selectedBuilding) {
        this.selectedBuilding.unselect();
        this.selectedBuilding = null;
      }
      if (this.selectedOther) {
        this.selectedOther.unselect();
        this.selectedOther = null;
      }
      this.unselectAllUnits();
    }
  }]);
}(Player);
;// ./app/classes/players/index.js



;// ./app/classes/cell/CellFog.js
/* unused harmony import specifier */ var Texture;
function CellFog_typeof(o) { "@babel/helpers - typeof"; return CellFog_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, CellFog_typeof(o); }
function CellFog_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = CellFog_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function CellFog_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return CellFog_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? CellFog_arrayLikeToArray(r, a) : void 0; } }
function CellFog_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function CellFog_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function CellFog_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, CellFog_toPropertyKey(o.key), o); } }
function CellFog_createClass(e, r, t) { return r && CellFog_defineProperties(e.prototype, r), t && CellFog_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function CellFog_toPropertyKey(t) { var i = CellFog_toPrimitive(t, "string"); return "symbol" == CellFog_typeof(i) ? i : i + ""; }
function CellFog_toPrimitive(t, r) { if ("object" != CellFog_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != CellFog_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }




var _fogTexture = null;
var _darknessTexture = null;
var _fogPatternTexture = null;
var _DW = 64;
var _DH = 32;
function _insideDiamond(px, py) {
  return px + 2 * py >= 32 && px - 2 * py <= 32 && px - 2 * py >= -32 && px + 2 * py <= 96;
}
function getFogTexture() {
  if (_fogTexture) return _fogTexture;
  var canvas = document.createElement('canvas');
  canvas.width = _DW;
  canvas.height = _DH;
  var ctx = canvas.getContext('2d');
  for (var px = 0; px < _DW; px++) {
    for (var py = 0; py < _DH; py++) {
      if (!_insideDiamond(px, py)) continue;
      if ((px + py) % 2 !== 0) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(px, py, 1, 1);
    }
  }
  _fogTexture = Texture.from(canvas);
  return _fogTexture;
}
function getFogPatternTexture() {
  if (_fogPatternTexture) return _fogPatternTexture;
  var canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  _fogPatternTexture = lib/* Texture */.gPd.from(canvas);
  return _fogPatternTexture;
}

// Solid black diamond for cells never explored
function getDarknessTexture() {
  if (_darknessTexture) return _darknessTexture;
  var canvas = document.createElement('canvas');
  canvas.width = _DW;
  canvas.height = _DH;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  for (var px = 0; px < _DW; px++) {
    for (var py = 0; py < _DH; py++) {
      if (_insideDiamond(px, py)) ctx.fillRect(px, py, 1, 1);
    }
  }
  _darknessTexture = Texture.from(canvas);
  return _darknessTexture;
}
var CellFog = /*#__PURE__*/function () {
  function CellFog(cell) {
    CellFog_classCallCheck(this, CellFog);
    this.cell = cell;
  }
  return CellFog_createClass(CellFog, [{
    key: "addFogBuilding",
    value: function addFogBuilding(textureSheet, colorSheet, colorName) {
      var cell = this.cell;
      if (cell.context.map.revealTerrain && !cell.context.map.revealEverything) return;
      var fogLayer = cell.context.map.fogLayer;
      var addToLayer = function addToLayer(sp) {
        sp.x = cell.x;
        sp.y = cell.y;
        sp.zIndex = 0;
        if (fogLayer) fogLayer.addChild(sp);else cell.addChild(sp);
      };
      var sprite = lib/* Sprite */.kxk.from(getTexture(textureSheet, lib/* Assets */.sP));
      sprite.label = LABEL_TYPES.buildingFog;
      sprite.tint = COLOR_FOG;
      sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
      sprite.cullable = true;
      addToLayer(sprite);
      cell.fogSprites.push({
        sprite: sprite,
        textureSheet: textureSheet,
        colorSheet: colorSheet,
        colorName: colorName
      });
      if (colorSheet) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(colorSheet, lib/* Assets */.sP));
        spriteColor.label = LABEL_TYPES.buildingFog;
        spriteColor.tint = COLOR_FOG;
        changeSpriteColorDirectly(spriteColor, colorName);
        addToLayer(spriteColor);
        cell.fogSprites.push({
          sprite: spriteColor,
          textureSheet: textureSheet,
          colorSheet: colorSheet,
          colorName: colorName
        });
      } else {
        changeSpriteColorDirectly(sprite, colorName);
      }
    }
  }, {
    key: "removeFogBuilding",
    value: function removeFogBuilding(instance) {
      var cell = this.cell;
      var map = cell.context.map;
      if (instance.owner && !instance.owner.isPlayed && instance.family === FAMILY_TYPES.building) {
        var localCell = map.grid[instance.i][instance.j];
        localCell.fogSprites.forEach(function (s) {
          var _s$sprite;
          return (_s$sprite = s.sprite) === null || _s$sprite === void 0 ? void 0 : _s$sprite.destroy();
        });
        localCell.fogSprites = [];
      }
    }
  }, {
    key: "setFogChildren",
    value: function setFogChildren(instance, init) {
      var cell = this.cell;
      var _cell$context = cell.context,
        player = _cell$context.player,
        map = _cell$context.map;
      if (!instanceIsInPlayerSight(instance, player)) {
        if (instance.owner && !instance.owner.isPlayed) {
          if (!init && instance.family === FAMILY_TYPES.building) {
            if (!map.revealTerrain) {
              var assets = getBuildingAsset(instance.type, instance.owner, lib/* Assets */.sP);
              var localCell = map.grid[instance.i][instance.j];
              localCell.addFogBuilding(assets.images["final"], assets.images.color, instance.owner.color);
            }
          }
          instance.visible = false;
        }
      }
    }
  }, {
    key: "_setRemoveChildren",
    value: function _setRemoveChildren(instance) {
      var cell = this.cell;
      var controls = cell.context.controls;
      if (controls.instanceInCamera(instance)) {
        instance.visible = true;
      }
      for (var i = 0; i < instance.children.length; i++) {
        if (instance.children[i].tint) {
          instance.children[i].tint = COLOR_WHITE;
        }
      }
    }
  }, {
    key: "_updateEdgeDither",
    value: function _updateEdgeDither() {
      var cell = this.cell;
      var fogLayer = cell.context.map.fogLayer;
      if (cell._ditherSprite) {
        if (fogLayer) fogLayer.removeChild(cell._ditherSprite);
        cell._ditherSprite.destroy();
        cell._ditherSprite = null;
      }
      cell._ditherKey = null;
    }
  }, {
    key: "setFog",
    value: function setFog(init) {
      var cell = this.cell;
      if (cell.has && !cell.has.isDead) {
        this.setFogChildren(cell.has, init);
      }
      if (!cell._hasFog) {
        cell._hasFog = true;
        var map = cell.context.map;
        if (map._fogQueue) {
          var _cell$context$player$, _cell$context$player$2;
          var viewed = (_cell$context$player$ = (_cell$context$player$2 = cell.context.player.views[cell.i]) === null || _cell$context$player$2 === void 0 || (_cell$context$player$2 = _cell$context$player$2[cell.j]) === null || _cell$context$player$2 === void 0 ? void 0 : _cell$context$player$2.viewed) !== null && _cell$context$player$ !== void 0 ? _cell$context$player$ : false;
          var isViewed = viewed || map.revealTerrain;
          // During init, chunks are already solid black — only queue if cell was viewed
          // (needs dotted pattern) or if init is already complete (re-fogging during gameplay)
          if (isViewed || map._fogInitComplete) {
            map._fogQueue.set(cell, isViewed ? 'fogViewed' : 'fog');
          }
        }
      }
      this._updateEdgeDither();
      var grid = cell.context.map.grid;
      for (var di = -1; di <= 1; di++) {
        for (var dj = -1; dj <= 1; dj++) {
          var _grid;
          if (di === 0 && dj === 0) continue;
          (_grid = grid[cell.i + di]) === null || _grid === void 0 || (_grid = _grid[cell.j + dj]) === null || _grid === void 0 || _grid.cellFog._updateEdgeDither();
        }
      }
    }
  }, {
    key: "removeFog",
    value: function removeFog() {
      var cell = this.cell;
      cell.visible = true;
      cell.zIndex = 0;
      if (cell._hasFog) {
        cell._hasFog = false;
        var map = cell.context.map;
        if (map._fogQueue) {
          map._fogQueue.set(cell, 'clear');
        }
      }
      this._updateEdgeDither();
      var grid = cell.context.map.grid;
      for (var di = -1; di <= 1; di++) {
        for (var dj = -1; dj <= 1; dj++) {
          var _grid2;
          if (di === 0 && dj === 0) continue;
          (_grid2 = grid[cell.i + di]) === null || _grid2 === void 0 || (_grid2 = _grid2[cell.j + dj]) === null || _grid2 === void 0 || _grid2.cellFog._updateEdgeDither();
        }
      }
      if (cell.has) {
        this.removeFogBuilding(cell.has);
        this._setRemoveChildren(cell.has);
      }
      var _iterator = CellFog_createForOfIteratorHelper(cell.corpses),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var corpse = _step.value;
          this._setRemoveChildren(corpse);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }]);
}();
;// ./app/classes/cell/CellTerrain.js
function CellTerrain_typeof(o) { "@babel/helpers - typeof"; return CellTerrain_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, CellTerrain_typeof(o); }
function CellTerrain_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function CellTerrain_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, CellTerrain_toPropertyKey(o.key), o); } }
function CellTerrain_createClass(e, r, t) { return r && CellTerrain_defineProperties(e.prototype, r), t && CellTerrain_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function CellTerrain_toPropertyKey(t) { var i = CellTerrain_toPrimitive(t, "string"); return "symbol" == CellTerrain_typeof(i) ? i : i + ""; }
function CellTerrain_toPrimitive(t, r) { if ("object" != CellTerrain_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != CellTerrain_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }




// Lookup table for setDesertBorder — indexed by cell sprite index, returns 4 border variants (W/N/S/E)
var _DESERT_VAL = Array.from({
  length: 25
}, function (_, i) {
  return i < 9 ? [0, 1, 2, 3] : Array.from({
    length: 4
  }, function (__, k) {
    return (i - 9) * 4 + k + 4;
  });
});
var CellTerrain = /*#__PURE__*/function () {
  function CellTerrain(cell) {
    CellTerrain_classCallCheck(this, CellTerrain);
    this.cell = cell;
  }
  return CellTerrain_createClass(CellTerrain, [{
    key: "setDesertBorder",
    value: function setDesertBorder(direction) {
      var cell = this.cell;
      var alreadySet = cell.children.some(function (c) {
        return c.type === 'border' && c.direction === direction;
      });
      if (alreadySet) return;
      var resourceName = '20002';
      var cellSpriteTextureName = cell.sprite.texture.label;
      var cellSpriteIndex = +cellSpriteTextureName.split('_')[0];
      var dirIndex = {
        west: 0,
        north: 1,
        south: 2,
        east: 3
      }[direction];
      var index = _DESERT_VAL[cellSpriteIndex][dirIndex];
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png'];
      var sprite = new lib/* Sprite */.kxk(texture);
      sprite.direction = direction;
      sprite.anchor.set(0.5, 0.5);
      sprite.type = 'border';
      cell.addChild(sprite);
    }
  }, {
    key: "setWaterBorder",
    value: function setWaterBorder(resourceName, index) {
      var cell = this.cell;
      var sprite = cell.sprite;
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      cell.border = true;
      cell.waterBorder = true;
      if (cell.has && typeof cell.has.die === 'function') {
        cell.has.die(true);
      }
      sprite.texture = texture;
    }
  }, {
    key: "setReliefBorder",
    value: function setReliefBorder(index) {
      var elevation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var cell = this.cell;
      var sprite = cell.sprite;
      var resourceName = sprite.texture.label.split('_')[1].split('.')[0];
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      if (elevation) {
        cell.y -= elevation;
      }
      cell.inclined = true;
      if (cell.has) {
        cell.has.zIndex = getInstanceZIndex(cell.has);
      }
      sprite.label = LABEL_TYPES.sprite;
      sprite.anchor.set(0.5, 0.5);
      sprite.texture = texture;
    }
  }, {
    key: "setWater",
    value: function setWater() {
      var cell = this.cell;
      var index = formatNumber(randomRange(0, 3));
      var resourceName = '15002';
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      cell.sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      cell.type = 'Water';
      cell.category = 'Water';
    }
  }, {
    key: "fillWaterCellsAroundCell",
    value: function fillWaterCellsAroundCell() {
      var cell = this.cell;
      var grid = cell.parent.grid;
      if (cell.type === 'Water' && !cell.sprite.texture.label.includes('15002')) {
        this.setWater();
      }
      getCellsAroundPoint(cell.i, cell.j, grid, 2, function (neighbor) {
        if (neighbor.type === 'Water' && cell.type === 'Water') {
          var dist = instancesDistance(cell, neighbor);
          var velX = Math.round((cell.i - neighbor.i) / dist);
          var velY = Math.round((cell.j - neighbor.j) / dist);
          if (grid[neighbor.i + velX] && grid[neighbor.i + velX][neighbor.j + velY]) {
            var target = grid[neighbor.i + velX][neighbor.j + velY];
            var aside = grid[cell.i + neighbor.i - target.i][cell.j + neighbor.j - target.j];
            if (target.type !== cell.type && aside.type !== cell.type) {
              if (Math.floor(dist) === 2) {
                neighbor.setWater();
                target.setWater();
              }
            }
          }
        }
      });
    }
  }, {
    key: "fillReliefCellsAroundCell",
    value: function fillReliefCellsAroundCell() {
      var cell = this.cell;
      var grid = cell.parent.grid;
      getCellsAroundPoint(cell.i, cell.j, grid, 2, function (neighbor) {
        if (neighbor.z === cell.z) {
          var dist = instancesDistance(cell, neighbor);
          var velX = Math.round((cell.i - neighbor.i) / dist);
          var velY = Math.round((cell.j - neighbor.j) / dist);
          if (grid[neighbor.i + velX] && grid[neighbor.i + velX][neighbor.j + velY]) {
            var target = grid[neighbor.i + velX][neighbor.j + velY];
            var aside = grid[cell.i + neighbor.i - target.i][cell.j + neighbor.j - target.j];
            if (target.category !== 'Water' && !target.waterBorder && target.z <= cell.z && target.z !== cell.z && aside.z !== cell.z) {
              if (Math.floor(dist) === 2) {
                target.setCellLevel(target.z + 1);
              }
            }
          }
        }
      });
    }
  }, {
    key: "setCellLevel",
    value: function setCellLevel(level) {
      var cpt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      var cell = this.cell;
      if (level === 0) {
        cell.y += CELL_DEPTH;
        cell.z = level;
        return;
      }
      var grid = cell.parent.grid;
      getCellsAroundPoint(cell.i, cell.j, grid, level - cpt, function (neighbor) {
        if (neighbor.z < cpt) {
          neighbor.y -= (cpt - neighbor.z) * CELL_DEPTH;
          neighbor.z = cpt;
          neighbor.fillReliefCellsAroundCell();
        }
      });
      if (cpt + 1 < level) {
        cell.setCellLevel(level, cpt + 1);
      }
      if (cell.has) {
        cell.has.zIndex = getInstanceZIndex(cell.has);
      }
    }
  }]);
}();
;// ./app/classes/cell/index.js
function cell_typeof(o) { "@babel/helpers - typeof"; return cell_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, cell_typeof(o); }
function cell_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = cell_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function cell_toConsumableArray(r) { return cell_arrayWithoutHoles(r) || cell_iterableToArray(r) || cell_unsupportedIterableToArray(r) || cell_nonIterableSpread(); }
function cell_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function cell_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return cell_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? cell_arrayLikeToArray(r, a) : void 0; } }
function cell_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function cell_arrayWithoutHoles(r) { if (Array.isArray(r)) return cell_arrayLikeToArray(r); }
function cell_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function cell_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function cell_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, cell_toPropertyKey(o.key), o); } }
function cell_createClass(e, r, t) { return r && cell_defineProperties(e.prototype, r), t && cell_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function cell_toPropertyKey(t) { var i = cell_toPrimitive(t, "string"); return "symbol" == cell_typeof(i) ? i : i + ""; }
function cell_toPrimitive(t, r) { if ("object" != cell_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != cell_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function cell_callSuper(t, o, e) { return o = cell_getPrototypeOf(o), cell_possibleConstructorReturn(t, cell_isNativeReflectConstruct() ? Reflect.construct(o, e || [], cell_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function cell_possibleConstructorReturn(t, e) { if (e && ("object" == cell_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return cell_assertThisInitialized(t); }
function cell_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function cell_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (cell_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function cell_getPrototypeOf(t) { return cell_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, cell_getPrototypeOf(t); }
function cell_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && cell_setPrototypeOf(t, e); }
function cell_setPrototypeOf(t, e) { return cell_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, cell_setPrototypeOf(t, e); }





var Cell = /*#__PURE__*/function (_Container) {
  function Cell(options, context) {
    var _this;
    cell_classCallCheck(this, Cell);
    _this = cell_callSuper(this, Cell);
    _this.context = context;
    var _this2 = _this,
      map = _this2.context.map;
    _this.family = FAMILY_TYPES.cell;
    _this.map = map;
    _this.solid = false;
    _this.visible = false;
    _this.zIndex = 0;
    _this.inclined = false;
    _this.border = false;
    _this.waterBorder = false;
    _this.z = 0;
    _this.viewed = false;
    _this.viewBy = new Set();
    _this.has = null;
    _this.corpses = new Set();
    _this.fogSprites = [];
    _this._ditherSprite = null;
    _this._ditherKey = null;
    _this._hasFog = false;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(lib/* Assets */.sP.cache.get('config').cells[_this.type]).forEach(function (prop) {
      _this[prop] = lib/* Assets */.sP.cache.get('config').cells[_this.type][prop];
    });
    var pos = cartesianToIsometric(_this.i, _this.j);
    _this.x = pos[0];
    _this.y = pos[1] - _this.z * CELL_DEPTH;
    var textureName = maths_randomItem(_this.assets);
    var resourceName = textureName.split('_')[1];
    var textureFile = textureName + '.png';
    var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
    var texture = spritesheet.textures[textureFile];
    _this.sprite = new lib/* Sprite */.kxk(texture);
    _this.sprite.label = LABEL_TYPES.sprite;
    _this.sprite.anchor.set(0.5, 0.5);
    _this.sprite.roundPixels = true;
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'none';
    _this.sprite.allowClick = false;
    _this.addChild(_this.sprite);
    _this.cellFog = new CellFog(_this);
    _this.cellTerrain = new CellTerrain(_this);

    // Replay fog building sprites for cells loaded from a save
    _this.fogSprites.forEach(function (s) {
      var _this$cellFog;
      return (_this$cellFog = _this.cellFog).addFogBuilding.apply(_this$cellFog, cell_toConsumableArray(Object.values(s)));
    });
    _this.eventMode = 'none';
    _this.allowMove = false;
    _this.allowClick = false;
    return _this;
  }
  cell_inherits(Cell, _Container);
  return cell_createClass(Cell, [{
    key: "_updateChild",
    value: function _updateChild(instance) {
      var _instance$owner;
      var _this$context = this.context,
        map = _this$context.map,
        player = _this$context.player;
      var isInPlayerSight = instanceIsInPlayerSight(instance, player);
      instance.visible = map.revealEverything || ((_instance$owner = instance.owner) === null || _instance$owner === void 0 ? void 0 : _instance$owner.isPlayed) || isInPlayerSight || instance.family === FAMILY_TYPES.resource || !map.revealTerrain && !instance.owner;
    }
  }, {
    key: "updateVisible",
    value: function updateVisible() {
      var _this$context2 = this.context,
        map = _this$context2.map,
        player = _this$context2.player;
      if (!map.revealEverything && !player.views[this.i][this.j].viewed) {
        return;
      }
      this.visible = true;
      if (this.has) {
        this._updateChild(this.has);
      }
      var _iterator = cell_createForOfIteratorHelper(this.corpses),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var corpse = _step.value;
          this._updateChild(corpse);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }, {
    key: "place",
    value: function place(entity) {
      this.has = entity;
      this.updateVisible();
    }

    // Fog delegates
  }, {
    key: "setFog",
    value: function setFog(init) {
      return this.cellFog.setFog(init);
    }
  }, {
    key: "removeFog",
    value: function removeFog() {
      return this.cellFog.removeFog();
    }
  }, {
    key: "addFogBuilding",
    value: function addFogBuilding(textureSheet, colorSheet, colorName) {
      return this.cellFog.addFogBuilding(textureSheet, colorSheet, colorName);
    }
  }, {
    key: "removeFogBuilding",
    value: function removeFogBuilding(instance) {
      return this.cellFog.removeFogBuilding(instance);
    }
  }, {
    key: "setFogChildren",
    value: function setFogChildren(instance, init) {
      return this.cellFog.setFogChildren(instance, init);
    }
  }, {
    key: "_updateEdgeDither",
    value: function _updateEdgeDither() {
      return this.cellFog._updateEdgeDither();
    }

    // Terrain delegates
  }, {
    key: "setDesertBorder",
    value: function setDesertBorder(direction) {
      return this.cellTerrain.setDesertBorder(direction);
    }
  }, {
    key: "setWaterBorder",
    value: function setWaterBorder(resourceName, index) {
      return this.cellTerrain.setWaterBorder(resourceName, index);
    }
  }, {
    key: "setReliefBorder",
    value: function setReliefBorder(index, elevation) {
      return this.cellTerrain.setReliefBorder(index, elevation);
    }
  }, {
    key: "setWater",
    value: function setWater() {
      return this.cellTerrain.setWater();
    }
  }, {
    key: "fillWaterCellsAroundCell",
    value: function fillWaterCellsAroundCell() {
      return this.cellTerrain.fillWaterCellsAroundCell();
    }
  }, {
    key: "fillReliefCellsAroundCell",
    value: function fillReliefCellsAroundCell() {
      return this.cellTerrain.fillReliefCellsAroundCell();
    }
  }, {
    key: "setCellLevel",
    value: function setCellLevel(level, cpt) {
      return this.cellTerrain.setCellLevel(level, cpt);
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/classes/map.js
function map_typeof(o) { "@babel/helpers - typeof"; return map_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, map_typeof(o); }
function map_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = map_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function map_slicedToArray(r, e) { return map_arrayWithHoles(r) || map_iterableToArrayLimit(r, e) || map_unsupportedIterableToArray(r, e) || map_nonIterableRest(); }
function map_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function map_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function map_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function map_toConsumableArray(r) { return map_arrayWithoutHoles(r) || map_iterableToArray(r) || map_unsupportedIterableToArray(r) || map_nonIterableSpread(); }
function map_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function map_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return map_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? map_arrayLikeToArray(r, a) : void 0; } }
function map_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function map_arrayWithoutHoles(r) { if (Array.isArray(r)) return map_arrayLikeToArray(r); }
function map_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function map_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function map_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? map_ownKeys(Object(t), !0).forEach(function (r) { map_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : map_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function map_defineProperty(e, r, t) { return (r = map_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function map_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function map_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, map_toPropertyKey(o.key), o); } }
function map_createClass(e, r, t) { return r && map_defineProperties(e.prototype, r), t && map_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function map_toPropertyKey(t) { var i = map_toPrimitive(t, "string"); return "symbol" == map_typeof(i) ? i : i + ""; }
function map_toPrimitive(t, r) { if ("object" != map_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != map_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function map_callSuper(t, o, e) { return o = map_getPrototypeOf(o), map_possibleConstructorReturn(t, map_isNativeReflectConstruct() ? Reflect.construct(o, e || [], map_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function map_possibleConstructorReturn(t, e) { if (e && ("object" == map_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return map_assertThisInitialized(t); }
function map_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function map_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (map_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function map_getPrototypeOf(t) { return map_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, map_getPrototypeOf(t); }
function map_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && map_setPrototypeOf(t, e); }
function map_setPrototypeOf(t, e) { return map_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, map_setPrototypeOf(t, e); }








/**
 * 
 *  Map size	      Tiny	      Small	    Medium	    Normal	    Large	
    Player count	  2	          3	        4	          6	          8
    Dimensions	    120×120	    144×144 	168×168	    200×200	    220×220
 */
var map_Map = /*#__PURE__*/function (_Container) {
  function Map(context) {
    var _this;
    map_classCallCheck(this, Map);
    _this = map_callSuper(this, Map);
    _this.context = context;
    _this.size;
    _this.reliefRange = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3];
    _this.chanceOfRelief = 0.06;
    _this.chanceOfSets = 0.02;
    _this.ready = false;
    _this.grid = [];
    _this.sortableChildren = true;
    _this.allTechnologies = false;
    _this.noAI = false;
    _this.devMode = false;
    _this.difficulty = 'medium';
    _this.startingResources = {
      wood: 200,
      food: 200,
      stone: 150,
      gold: 0
    };
    _this.revealEverything = false;
    _this.revealTerrain = false;
    _this.x = 0;
    _this.y = 0;
    _this.startingUnits = 3;
    _this.playersPos = [];
    _this.positionsCount = 2;
    _this.gaia = null;
    _this.resources = new Set();
    _this.instanceBuckets = null;
    _this.eventMode = 'auto';
    _this.allowMove = false;
    _this.allowClick = false;
    _this.totalCells;
    return _this;
  }
  map_inherits(Map, _Container);
  return map_createClass(Map, [{
    key: "setCoordinate",
    value: function setCoordinate(x, y) {
      this.x = x;
      this.y = y;
    }
  }, {
    key: "_ensureBuckets",
    value: function _ensureBuckets() {
      if (this.instanceBuckets) return;
      var bw = Math.ceil(this.grid.length / BUCKET_SIZE);
      var bh = Math.ceil(this.grid[0].length / BUCKET_SIZE);
      this.instanceBuckets = Array.from({
        length: bw
      }, function () {
        return Array.from({
          length: bh
        }, function () {
          return new Set();
        });
      });
    }
  }, {
    key: "addToInstanceBucket",
    value: function addToInstanceBucket(instance) {
      var _this$instanceBuckets;
      this._ensureBuckets();
      var bi = Math.floor(instance.i / BUCKET_SIZE);
      var bj = Math.floor(instance.j / BUCKET_SIZE);
      (_this$instanceBuckets = this.instanceBuckets[bi]) === null || _this$instanceBuckets === void 0 || (_this$instanceBuckets = _this$instanceBuckets[bj]) === null || _this$instanceBuckets === void 0 || _this$instanceBuckets.add(instance);
    }
  }, {
    key: "removeFromInstanceBucket",
    value: function removeFromInstanceBucket(instance) {
      var _this$instanceBuckets2;
      if (!this.instanceBuckets) return;
      var bi = Math.floor(instance.i / BUCKET_SIZE);
      var bj = Math.floor(instance.j / BUCKET_SIZE);
      (_this$instanceBuckets2 = this.instanceBuckets[bi]) === null || _this$instanceBuckets2 === void 0 || (_this$instanceBuckets2 = _this$instanceBuckets2[bj]) === null || _this$instanceBuckets2 === void 0 || _this$instanceBuckets2["delete"](instance);
    }
  }, {
    key: "updateInstanceBucket",
    value: function updateInstanceBucket(instance, oldI, oldJ) {
      if (!this.instanceBuckets) return;
      var oldBi = Math.floor(oldI / BUCKET_SIZE),
        oldBj = Math.floor(oldJ / BUCKET_SIZE);
      var newBi = Math.floor(instance.i / BUCKET_SIZE),
        newBj = Math.floor(instance.j / BUCKET_SIZE);
      if (oldBi !== newBi || oldBj !== newBj) {
        var _this$instanceBuckets3, _this$instanceBuckets4;
        (_this$instanceBuckets3 = this.instanceBuckets[oldBi]) === null || _this$instanceBuckets3 === void 0 || (_this$instanceBuckets3 = _this$instanceBuckets3[oldBj]) === null || _this$instanceBuckets3 === void 0 || _this$instanceBuckets3["delete"](instance);
        (_this$instanceBuckets4 = this.instanceBuckets[newBi]) === null || _this$instanceBuckets4 === void 0 || (_this$instanceBuckets4 = _this$instanceBuckets4[newBj]) === null || _this$instanceBuckets4 === void 0 || _this$instanceBuckets4.add(instance);
      }
    }
  }, {
    key: "generateFromJSON",
    value: function generateFromJSON(_ref) {
      var _this2 = this;
      var map = _ref.map,
        players = _ref.players,
        camera = _ref.camera,
        resources = _ref.resources,
        animals = _ref.animals;
      var classMap = {
        Human: Human,
        AI: AI
      };
      var _this$context = this.context,
        menu = _this$context.menu,
        controls = _this$context.controls;
      this.removeChildren();
      this.size = map.length - 1;
      this._initFogChunks();
      this.gaia = new Gaia(this.context);
      for (var i = 0; i <= this.size; i++) {
        var line = map[i];
        for (var j = 0; j <= this.size; j++) {
          if (!this.grid[i]) {
            this.grid[i] = [];
          }
          var cell = line[j];
          var newCell = new Cell({
            i: i,
            j: j,
            z: cell.z,
            type: cell.type,
            fogSprites: cell.fogSprites
          }, this.context);
          this.addChild(newCell);
          this.grid[i][j] = newCell;
        }
      }
      for (var _i = 0; _i <= this.size; _i++) {
        for (var _j = 0; _j <= this.size; _j++) {
          this.grid[_i][_j].fillWaterCellsAroundCell();
        }
      }
      this.resources = new Set(resources.map(function (resource) {
        return _this2.addChild(new Resource(resource, _this2.context));
      }));
      this.formatCellsWaterBorder();
      this.clampReliefAroundWater();
      this.formatCellsRelief();
      this.formatCellsDesert();
      if (!this.revealEverything) {
        for (var _i2 = 0; _i2 <= this.size; _i2++) {
          for (var _j2 = 0; _j2 <= this.size; _j2++) {
            this.grid[_i2][_j2].setFog();
          }
        }
      }
      this.context.players = players.map(function (player) {
        var p = new classMap[player.type](map_objectSpread(map_objectSpread({}, player), {}, {
          corpses: [],
          buildings: [],
          units: []
        }), _this2.context);
        if (player.isPlayed) {
          _this2.context.player = p;
        }
        return p;
      });
      controls.setCamera(camera.x, camera.y, true);
      menu.init();
      menu.updateResourcesMiniMap();
      this.context.players.forEach(function (player, index) {
        var _players$index = players[index],
          buildings = _players$index.buildings,
          units = _players$index.units,
          corpses = _players$index.corpses;
        player.buildings = buildings.map(function (building) {
          return player.createBuilding(building);
        });
        player.units = units.map(function (unit) {
          return player.createUnit(unit);
        });
        player.corpses = corpses.map(function (unit) {
          return player.createUnit(unit);
        });
      });
      animals.forEach(function (animal) {
        return _this2.gaia.createAnimal(animal);
      });
      function getDest(val, map) {
        if (val) {
          if (Array.isArray(val)) {
            return val[2] ? map.getChildByLabel(val[2]) : map.grid[val[0]][val[1]];
          } else {
            return map.getChildByLabel(val);
          }
        }
        return null;
      }
      function processUnit(unit, context) {
        if (unit.previousDest) {
          unit.previousDest = getDest(unit.previousDest, context);
        }
        if (unit.dest && !unit.isDead) {
          var dest = getDest(unit.dest, context);
          if (dest) {
            unit.commonSendTo ? unit.commonSendTo(dest, unit.work, unit.action, true) : unit.sendTo(dest, unit.action);
          } else {
            unit.stop();
          }
        }
      }
      this.gaia.units.forEach(function (animal) {
        return processUnit(animal, _this2);
      });
      this.context.players.forEach(function (player) {
        for (var _i3 = 0; _i3 <= _this2.size; _i3++) {
          var _line = player.views[_i3];
          for (var _j3 = 0; _j3 <= _this2.size; _j3++) {
            var _cell = _line[_j3];
            if (_cell.viewed) {
              _cell.onViewed();
            }
            _cell.viewBy = new Set(map_toConsumableArray(_cell.viewBy).map(function (name) {
              return getDest(name, _this2);
            }).filter(Boolean));
            if (player.isPlayed && _cell.viewed) {
              if (!_cell.viewBy.size) {
                _this2.grid[_i3][_j3].setFog(true);
              } else {
                _this2.grid[_i3][_j3].removeFog();
              }
            }
          }
        }
        player.units.forEach(function (unit) {
          return processUnit(unit, _this2);
        });
      });
      this._fogInitComplete = true;
      this._flushFogQueue();
      this.bakeTerrainToChunks();
      this.ready = true;
    }
  }, {
    key: "generateMap",
    value: function generateMap() {
      var positionsCountOverride = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var repeat = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      this.removeChildren();
      this.generateCells();
      switch (this.size) {
        case 120:
          this.positionsCount = 2;
          break;
        case 144:
          this.positionsCount = 3;
          break;
        case 168:
          this.positionsCount = 4;
          break;
        case 200:
          this.positionsCount = 6;
          break;
        case 220:
          this.positionsCount = 8;
          break;
        default:
          this.positionsCount = 2;
      }
      if (positionsCountOverride !== null) {
        this.positionsCount = positionsCountOverride;
      }
      this.totalCells = Math.pow(this.size + 1, 2);
      this.playersPos = this.findPlayerPlaces();
      if (this.playersPos.length < this.positionsCount) {
        if (repeat >= 10) {
          alert('Error while generating the map');
          return;
        }
        this.generateMap(positionsCountOverride, repeat + 1);
        return;
      }
      this.generateResourcesAroundPlayers(this.playersPos);
    }
  }, {
    key: "stylishMap",
    value: function stylishMap() {
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        player = _this$context2.player;
      this.gaia = new Gaia(this.context);
      this.generateAnimalsAroundPlayers(this.playersPos);
      this.generateMapRelief();
      this.formatCellsRelief();
      this.generateSets();
      this._initFogChunks();
      if (!this.revealEverything) {
        for (var i = 0; i <= this.size; i++) {
          for (var j = 0; j <= this.size; j++) {
            this.grid[i][j].setFog();
          }
        }
        for (var _i4 = 0; _i4 < player.buildings.length; _i4++) {
          var building = player.buildings[_i4];
          updateInstanceVisibility(building);
        }
        for (var _i5 = 0; _i5 < player.units.length; _i5++) {
          var unit = player.units[_i5];
          updateInstanceVisibility(unit);
        }
      }
      this._fogInitComplete = true;
      this._flushFogQueue();
      this.bakeTerrainToChunks();
      this.ready = true;
      menu.updateResourcesMiniMap();
    }
  }, {
    key: "generatePlayers",
    value: function generatePlayers() {
      var playersConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var context = this.context;
      var players = [];
      var poses = [];
      var randoms = Array.from(Array(this.playersPos.length).keys());
      for (var i = 0; i < this.playersPos.length; i++) {
        var pos = maths_randomItem(randoms);
        poses.push(pos);
        randoms.splice(randoms.indexOf(pos), 1);
      }
      for (var _i6 = 0; _i6 < this.positionsCount; _i6++) {
        var _this$playersPos$pose, _this$playersPos$pose2;
        var posI = (_this$playersPos$pose = this.playersPos[poses[_i6]]) === null || _this$playersPos$pose === void 0 ? void 0 : _this$playersPos$pose.i;
        var posJ = (_this$playersPos$pose2 = this.playersPos[poses[_i6]]) === null || _this$playersPos$pose2 === void 0 ? void 0 : _this$playersPos$pose2.j;
        if (posI && posJ) {
          var _playersConfig$_i6$co, _playersConfig$_i, _playersConfig$_i6$ci, _playersConfig$_i2;
          var color = (_playersConfig$_i6$co = playersConfig === null || playersConfig === void 0 || (_playersConfig$_i = playersConfig[_i6]) === null || _playersConfig$_i === void 0 ? void 0 : _playersConfig$_i.color) !== null && _playersConfig$_i6$co !== void 0 ? _playersConfig$_i6$co : colors[_i6];
          var civ = (_playersConfig$_i6$ci = playersConfig === null || playersConfig === void 0 || (_playersConfig$_i2 = playersConfig[_i6]) === null || _playersConfig$_i2 === void 0 ? void 0 : _playersConfig$_i2.civ) !== null && _playersConfig$_i6$ci !== void 0 ? _playersConfig$_i6$ci : 'Greek';
          if (!_i6) {
            players.push(new Human({
              i: posI,
              j: posJ,
              age: 0,
              civ: civ,
              color: color,
              isPlayed: true
            }, context));
          } else if (!this.noAI) {
            players.push(new AI({
              i: posI,
              j: posJ,
              age: 0,
              civ: civ,
              color: color,
              difficulty: this.difficulty
            }, context));
          }
        }
      }
      return players;
    }
  }, {
    key: "placePlayers",
    value: function placePlayers() {
      var players = this.context.players;

      // Place a town center
      for (var i = 0; i < players.length; i++) {
        var player = players[i];
        var towncenter = player.spawnBuilding({
          i: player.i,
          j: player.j,
          type: BUILDING_TYPES.townCenter,
          isBuilt: true
        });
        for (var _i7 = 0; _i7 < this.startingUnits; _i7++) {
          towncenter.placeUnit(UNIT_TYPES.villager);
        }
      }
    }
  }, {
    key: "generateForestAroundPlayer",
    value: function generateForestAroundPlayer(player, treeCount) {
      var _this3 = this;
      var clusterCount = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 12;
      var minClusterRadius = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 5;
      var maxClusterRadius = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 10;
      var safeDistance = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 20;
      var clearingProbability = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : 0.6;
      var grid = this.grid;
      var playerI = player.i,
        playerJ = player.j;
      var gridWidth = grid.length;
      var gridHeight = grid[0].length;
      var forestCells = [];
      var pathCells = new Set();

      // Larger range for lac so forests cover the sides between players around the lake
      var rangeFactor = this.mapType === 'lac' ? 0.55 : 0.40;
      var forestRange = Math.max(30, Math.floor(this.size * rangeFactor));

      // Squared distance — avoids Math.sqrt in hot loops; compare against safeDistance**2
      function distSq(x1, y1, x2, y2) {
        return Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
      }
      var safeDistanceSq = Math.pow(safeDistance, 2);

      // Function to create a circle of points within a grid, checking boundaries
      function createCircle(centerI, centerJ, radius) {
        var density = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0.7;
        var edgeNoise = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
        var circleCells = [];
        for (var x = -radius; x <= radius; x++) {
          for (var y = -radius; y <= radius; y++) {
            var noise = Math.random() * edgeNoise - edgeNoise / 2; // Random edge noise
            var effectiveRadius = radius - noise;
            if (effectiveRadius > 0 && x * x + y * y <= effectiveRadius * effectiveRadius) {
              // If within noisy circle
              var cellI = centerI + x;
              var cellJ = centerJ + y;
              if (cellI >= 0 && cellI < gridWidth &&
              // Ensure cell is within grid bounds
              cellJ >= 0 && cellJ < gridHeight && !grid[cellI][cellJ].solid &&
              // Ensure the cell is not solid
              grid[cellI][cellJ].category !== 'Water' &&
              // Ensure not water
              grid[cellI][cellJ].type !== 'Border' &&
              // Ensure not border
              !grid[cellI][cellJ].inclined &&
              // Ensure not inclined
              Math.random() < density // Tree density control
              ) {
                circleCells.push({
                  i: cellI,
                  j: cellJ
                });
              }
            }
          }
        }
        return circleCells;
      }

      // Create forest clusters
      for (var cluster = 0; cluster < clusterCount; cluster++) {
        var clusterCenterI = void 0,
          clusterCenterJ = void 0;
        var tries = 0;
        var clusterRadius = Math.floor(Math.random() * (maxClusterRadius - minClusterRadius + 1)) + minClusterRadius; // Random radius
        var clusterDensity = Math.random() * 0.5 + 0.5; // Density between 0.5 and 1
        var edgeNoise = Math.random() * 2; // Noise for organic shapes

        // Ensure the cluster is far from the player and within bounds
        do {
          clusterCenterI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange);
          clusterCenterJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange);
          tries++;
          if (tries > 100) break; // Safety exit
        } while (distSq(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistanceSq || clusterCenterI < 0 || clusterCenterI >= gridWidth || clusterCenterJ < 0 || clusterCenterJ >= gridHeight ||
        // Stay within grid bounds
        grid[clusterCenterI][clusterCenterJ].category === 'Water' ||
        // Avoid water cells
        grid[clusterCenterI][clusterCenterJ].solid ||
        // Avoid solid cells
        grid[clusterCenterI][clusterCenterJ].inclined // Avoid inclined cells
        );
        if (tries <= 100) {
          var treeCluster = createCircle(clusterCenterI, clusterCenterJ, clusterRadius, clusterDensity, edgeNoise);
          treeCluster.forEach(function (cell) {
            return forestCells.push(cell);
          });
        }
      }

      // Scattered solo trees (20% of total trees)
      var scatteredTreeCount = Math.floor(treeCount * 0.2);
      for (var i = 0; i < scatteredTreeCount; i++) {
        var soloI = void 0,
          soloJ = void 0;
        var _tries = 0;
        do {
          soloI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange);
          soloJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange);
          _tries++;
          if (_tries > 50) break; // Safety exit to avoid infinite loop
        } while (distSq(soloI, soloJ, playerI, playerJ) < safeDistanceSq || soloI < 0 || soloI >= gridWidth || soloJ < 0 || soloJ >= gridHeight ||
        // Stay within grid bounds
        grid[soloI][soloJ].category === 'Water' ||
        // Avoid water cells
        grid[soloI][soloJ].solid ||
        // Avoid solid cells
        grid[soloI][soloJ].inclined // Avoid inclined cells
        );
        if (_tries <= 50) {
          forestCells.push({
            i: soloI,
            j: soloJ
          });
        }
      }

      // Generate random clearings based on clearingProbability
      var _loop = function _loop() {
        if (Math.random() < clearingProbability) {
          var clearingCenterI, clearingCenterJ;
          var _tries2 = 0;
          var clearingRadius = Math.floor(Math.random() * 8) + 5; // Random clearing radius between 5 and 13
          var _edgeNoise = Math.random() * 1.5;
          do {
            clearingCenterI = playerI + Math.floor(Math.random() * forestRange * 2 - forestRange);
            clearingCenterJ = playerJ + Math.floor(Math.random() * forestRange * 2 - forestRange);
            _tries2++;
            if (_tries2 > 100) break;
          } while (distSq(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistanceSq || clearingCenterI < 0 || clearingCenterI >= gridWidth || clearingCenterJ < 0 || clearingCenterJ >= gridHeight ||
          // Stay within grid bounds
          grid[clearingCenterI][clearingCenterJ].category === 'Water' ||
          // Avoid water cells
          grid[clearingCenterI][clearingCenterJ].solid ||
          // Avoid solid cells
          grid[clearingCenterI][clearingCenterJ].inclined // Avoid inclined cells
          );
          if (_tries2 <= 100) {
            var clearingCells = createCircle(clearingCenterI, clearingCenterJ, clearingRadius, 0, _edgeNoise);
            var clearingSet = new Set(clearingCells.map(function (c) {
              return "".concat(c.i, ",").concat(c.j);
            }));
            forestCells = forestCells.filter(function (c) {
              return !clearingSet.has("".concat(c.i, ",").concat(c.j));
            });
          }
        }
      };
      for (var clearing = 0; clearing < clusterCount; clearing++) {
        _loop();
      }

      // Generate diagonal paths
      var pathLength = 20;
      var pathDirection = Math.random() > 0.5 ? 1 : -1; // Random path direction

      for (var step = 0; step < pathLength; step++) {
        var offsetX = step * pathDirection;
        var offsetY = step;
        var ni = playerI + offsetX;
        var nj = playerJ + offsetY;
        if (ni >= 0 && ni < gridWidth && nj >= 0 && nj < gridHeight && distSq(ni, nj, playerI, playerJ) >= safeDistanceSq) {
          var randOffsetX = Math.random() > 0.5 ? 1 : -1;
          var randOffsetY = Math.random() > 0.5 ? 1 : -1;
          pathCells.add("".concat(ni + randOffsetX, ",").concat(nj + randOffsetY));
        }
      }

      // Remove path cells from forestCells
      for (var idx = forestCells.length - 1; idx >= 0; idx--) {
        if (pathCells.has("".concat(forestCells[idx].i, ",").concat(forestCells[idx].j))) {
          forestCells.splice(idx, 1);
        }
      }

      // Select and place trees in the forest cells
      var cellsToPlace = [];
      for (var _i8 = 0; _i8 < treeCount; _i8++) {
        if (forestCells.length === 0) break;
        var itemIndex = Math.floor(Math.random() * forestCells.length);
        var cell = forestCells[itemIndex];
        cellsToPlace.push(cell);
        forestCells.splice(itemIndex, 1);
      }

      // Place the trees in the selected cells
      var _loop2 = function _loop2() {
        var cell = _cellsToPlace[_i9];
        // Ensure again that we're not placing trees on Water, Border, or Solid cells
        if (grid[cell.i][cell.j].category !== 'Water' && !grid[cell.i][cell.j].waterBorder && !grid[cell.i][cell.j].solid && !grid[cell.i][cell.j].inclined) {
          var isFree = true;
          grid_getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, function (cell) {
            var _cell$has;
            if ([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone].includes((_cell$has = cell.has) === null || _cell$has === void 0 ? void 0 : _cell$has.type)) {
              isFree = false;
            }
          });
          isFree && _this3.resources.add(_this3.addChild(new Resource({
            i: cell.i,
            j: cell.j,
            type: RESOURCE_TYPES.tree
          }, _this3.context)));
        }
      };
      for (var _i9 = 0, _cellsToPlace = cellsToPlace; _i9 < _cellsToPlace.length; _i9++) {
        _loop2();
      }
    }
  }, {
    key: "placeAnimalHerd",
    value: function placeAnimalHerd(player, quantity, range) {
      var grid = this.grid;
      var randomDistance = randomRange(range[0], range[1]);
      var centerI = player.i + maths_randomItem([-randomDistance, randomDistance]);
      var centerJ = player.j + maths_randomItem([-randomDistance, randomDistance]);
      var validCells = [];
      for (var dx = -3; dx <= 3; dx++) {
        for (var dy = -3; dy <= 3; dy++) {
          var _grid$newI;
          var newI = centerI + dx;
          var newJ = centerJ + dy;
          if ((_grid$newI = grid[newI]) !== null && _grid$newI !== void 0 && _grid$newI[newJ]) {
            var cell = grid[newI][newJ];
            if (!cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
              validCells.push({
                i: newI,
                j: newJ
              });
            }
          }
        }
      }
      var toPlace = Math.min(quantity, validCells.length);
      for (var i = 0; i < toPlace; i++) {
        var idx = Math.floor(Math.random() * validCells.length);
        var _cell2 = validCells.splice(idx, 1)[0];
        this.gaia.createAnimal({
          i: _cell2.i,
          j: _cell2.j,
          type: 'Gazelle'
        });
      }
    }
  }, {
    key: "generateAnimalsAroundPlayers",
    value: function generateAnimalsAroundPlayers(playersPos) {
      for (var i = 0; i < playersPos.length; i++) {
        this.placeAnimalHerd(playersPos[i], 5, [8, 14]);
        this.placeAnimalHerd(playersPos[i], 4, [16, 24]);
      }
    }
  }, {
    key: "generateResourcesAroundPlayers",
    value: function generateResourcesAroundPlayers(playersPos) {
      for (var i = 0; i < playersPos.length; i++) {
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [7, 14]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [14, 22]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.berrybush, 8, [22, 29]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [7, 14]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [14, 22]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.stone, 7, [22, 29]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [7, 14]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [14, 22]);
        this.placeResourceGroup(playersPos[i], RESOURCE_TYPES.gold, 7, [22, 29]);
        this.generateForestAroundPlayer(playersPos[i], this.size * 4);
      }
    }
  }, {
    key: "generateTerrain",
    value: function generateTerrain() {
      var _thresholds$mapType, _biomeThresholds$mapT;
      var gridSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 120;
      var mapType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'plain';
      // Seeded 2D value noise — each map generation gets a unique seed
      var seed = Math.random() * 9999;
      function hash(x, y) {
        var n = Math.sin(x * 127.1 + y * 311.7 + seed * 3.7) * 43758.5453;
        return n - Math.floor(n);
      }
      function noise(x, y) {
        var xi = Math.floor(x),
          yi = Math.floor(y);
        var xf = x - xi,
          yf = y - yi;
        var smooth = function smooth(t) {
          return t * t * (3 - 2 * t);
        };
        var u = smooth(xf),
          v = smooth(yf);
        var a = hash(xi, yi),
          b = hash(xi + 1, yi);
        var c = hash(xi, yi + 1),
          d = hash(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v;
      }

      // Fractional Brownian Motion — sum of N octaves for natural-looking terrain
      function fbm(x, y) {
        var octaves = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 5;
        var val = 0,
          amp = 0.5,
          freq = 1,
          sum = 0;
        for (var o = 0; o < octaves; o++) {
          val += noise(x * freq, y * freq) * amp;
          sum += amp;
          amp *= 0.5;
          freq *= 2;
        }
        return val / sum;
      }
      var scale = 4 / gridSize;
      var half = gridSize / 2;

      // Smooth radial falloff: 1.0 at center, 0.0 at edge
      function radialFalloff(i, j) {
        var dx = (i - half) / half;
        var dy = (j - half) / half;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var t = Math.min(1, dist);
        return 1 - t * t * (3 - 2 * t);
      }

      // Pre-compute heightmap and biome map
      var height = new Float32Array(gridSize * gridSize);
      var biome = new Float32Array(gridSize * gridSize);
      for (var i = 0; i < gridSize; i++) {
        for (var j = 0; j < gridSize; j++) {
          height[i * gridSize + j] = fbm(i * scale, j * scale);
          // Lower frequency (×0.6) → larger biome patches for AoE1-style biome regions
          biome[i * gridSize + j] = fbm(i * scale * 0.6 + 50, j * scale * 0.6 + 70, 4);
        }
      }

      // Water threshold per map type
      var thresholds = {
        plain: 0.30,
        continent: 0.40,
        lac: 0.42,
        ilot: 0.52
      };
      var waterThreshold = (_thresholds$mapType = thresholds[mapType]) !== null && _thresholds$mapType !== void 0 ? _thresholds$mapType : 0.30;
      var terrainMap = [];
      for (var _i0 = 0; _i0 < gridSize; _i0++) {
        terrainMap[_i0] = [];
        for (var _j4 = 0; _j4 < gridSize; _j4++) {
          var h = height[_i0 * gridSize + _j4];
          var fo = radialFalloff(_i0, _j4);
          if (mapType === 'continent') {
            // Stronger boost so the continent is large and water stays at the edges
            h += (fo - 0.5) * 0.75;
          } else if (mapType === 'lac') {
            // Depress center (→ lake), raise edges (→ land)
            h -= (fo - 0.3) * 0.50;
          } else if (mapType === 'ilot') {
            // Mild edge depression + higher threshold → scattered islands
            h += (fo - 0.5) * 0.20;
          }
          terrainMap[_i0][_j4] = h < waterThreshold ? 2 : 0;
        }
      }

      // Smooth coastlines with 2 passes of cellular automaton.
      // Removes isolated water/land pixels so water-border transition sprites apply correctly.
      for (var pass = 0; pass < 2; pass++) {
        for (var _i1 = 1; _i1 < gridSize - 1; _i1++) {
          for (var _j5 = 1; _j5 < gridSize - 1; _j5++) {
            var wn = (terrainMap[_i1 - 1][_j5] === 2 ? 1 : 0) + (terrainMap[_i1 + 1][_j5] === 2 ? 1 : 0) + (terrainMap[_i1][_j5 - 1] === 2 ? 1 : 0) + (terrainMap[_i1][_j5 + 1] === 2 ? 1 : 0);
            if (terrainMap[_i1][_j5] !== 2 && wn >= 3) terrainMap[_i1][_j5] = 2; // isolated land → water
            if (terrainMap[_i1][_j5] === 2 && wn <= 1) terrainMap[_i1][_j5] = 0; // isolated water → land
          }
        }
      }

      // Biome pass on land cells — per-type thresholds and larger-patch noise frequency
      // for more cohesive desert/jungle zones (AoE1 style)
      var biomeThresholds = {
        plain: {
          lo: 0.38,
          hi: 0.65
        },
        // warmer, drier → more desert
        continent: {
          lo: 0.33,
          hi: 0.67
        },
        // balanced
        lac: {
          lo: 0.32,
          hi: 0.68
        },
        // balanced
        ilot: {
          lo: 0.27,
          hi: 0.60
        } // tropical → more jungle
      };
      var bt = (_biomeThresholds$mapT = biomeThresholds[mapType]) !== null && _biomeThresholds$mapT !== void 0 ? _biomeThresholds$mapT : biomeThresholds.plain;
      for (var _i10 = 0; _i10 < gridSize; _i10++) {
        for (var _j6 = 0; _j6 < gridSize; _j6++) {
          if (terrainMap[_i10][_j6] === 2) continue;
          var b = biome[_i10 * gridSize + _j6];
          if (b < bt.lo) terrainMap[_i10][_j6] = 1; // desert
          else if (b > bt.hi) terrainMap[_i10][_j6] = 3; // jungle
        }
      }
      return terrainMap;
    }
  }, {
    key: "generateCells",
    value: function generateCells() {
      var z = 0;
      this.grid = [];
      var terrain = this.generateTerrain(this.size ? this.size + 1 : 121, this.mapType || 'plain');
      this.size = terrain.length - 1;

      // Map terrain numbers to cell types
      var terrainMap = {
        0: 'Grass',
        1: 'Desert',
        2: 'Water',
        3: 'Jungle'
      };
      for (var i = 0; i <= this.size; i++) {
        if (!this.grid[i]) this.grid[i] = [];
        for (var j = 0; j <= this.size; j++) {
          var type = terrainMap[terrain[i][j]];
          var cell = new Cell({
            i: i,
            j: j,
            z: z,
            type: type
          }, this.context);
          this.addChild(cell); // ensures cell.parent is set
          this.grid[i][j] = cell;
        }
      }

      // Post-processing
      for (var _i11 = 0; _i11 <= this.size; _i11++) {
        for (var _j7 = 0; _j7 <= this.size; _j7++) {
          this.grid[_i11][_j7].fillWaterCellsAroundCell();
        }
      }
      this.formatCellsWaterBorder();
      this.formatCellsDesert();
    }
  }, {
    key: "generateSets",
    value: function generateSets() {
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          if (getCellsAroundPoint(i, j, this.grid, 1, function (neighbour) {
            return neighbour.solid;
          }).length > 0) {
            continue;
          }
          if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
            if (cell.category !== 'Water' && Math.random() < 0.03 && i > 1 && j > 1 && i < this.size && j < this.size) {
              var randomSpritesheet = randomRange(292, 301).toString();
              var spritesheet = lib/* Assets */.sP.cache.get(randomSpritesheet);
              var texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
              var floor = lib/* Sprite */.kxk.from(texture);
              floor.label = LABEL_TYPES.floor;
              floor.roundPixels = true;
              floor.allowMove = false;
              floor.eventMode = 'none';
              floor.allowClick = false;
              floor.updateAnchor = true;
              cell.addChild(floor);
            }
            if (Math.random() < this.chanceOfSets) {
              if (cell.category !== 'Water') {
                var type = maths_randomItem(['tree', 'rock', 'animal']);
                switch (type) {
                  case 'rock':
                    {
                      var _randomSpritesheet = randomRange(531, 534).toString();
                      var _spritesheet = lib/* Assets */.sP.cache.get(_randomSpritesheet);
                      var _texture = _spritesheet.textures['000_' + _randomSpritesheet + '.png'];
                      var rock = lib/* Sprite */.kxk.from(_texture);
                      rock.label = LABEL_TYPES.set;
                      rock.roundPixels = true;
                      rock.allowMove = false;
                      rock.eventMode = 'none';
                      rock.allowClick = false;
                      rock.updateAnchor = true;
                      cell.addChild(rock);
                      break;
                    }
                  case 'animal':
                    {
                      var animals = lib/* Assets */.sP.cache.get('config').animals;
                      var animalType = maths_randomItem(Object.keys(animals));
                      this.gaia.createAnimal({
                        i: i,
                        j: j,
                        type: animalType
                      });
                      break;
                    }
                }
              } else {
                this.resources.add(this.addChild(new Resource({
                  i: i,
                  j: j,
                  type: RESOURCE_TYPES.salmon
                }, this.context)));
              }
            }
          }
        }
      }
    }
  }, {
    key: "generateMapRelief",
    value: function generateMapRelief() {
      var _this4 = this;
      // Coherent fBm heightmap for natural ridges and hill ranges.
      // Different seed and coarser scale than terrain noise → large, varied features.
      var seed = Math.random() * 9999;
      function hash(x, y) {
        var n = Math.sin(x * 83.7 + y * 214.3 + seed * 5.1) * 43758.5453;
        return n - Math.floor(n);
      }
      function noise(x, y) {
        var xi = Math.floor(x),
          yi = Math.floor(y);
        var xf = x - xi,
          yf = y - yi;
        var s = function s(t) {
          return t * t * (3 - 2 * t);
        };
        var u = s(xf),
          v = s(yf);
        var a = hash(xi, yi),
          b = hash(xi + 1, yi);
        var c = hash(xi, yi + 1),
          d = hash(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v;
      }
      function fbm(x, y) {
        var val = 0,
          amp = 0.5,
          freq = 1,
          sum = 0;
        for (var o = 0; o < 4; o++) {
          val += noise(x * freq, y * freq) * amp;
          sum += amp;
          amp *= 0.5;
          freq *= 2;
        }
        return val / sum;
      }
      var scale = 3 / this.size;
      var n = this.size + 1;
      var dist = this.getReliefCoastDistances();

      // Precompute fBm heightmap
      var reliefH = new Float32Array(n * n);
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          reliefH[i * n + j] = fbm(i * scale, j * scale);
        }
      }

      // Apply relief from highest level to lowest.
      // maxAllowed keeps beach cells and a few inland rings flat before slopes start.
      var levelThresholds = [0, 0.66, 0.78, 0.86];
      for (var targetLevel = 3; targetLevel >= 1; targetLevel--) {
        var threshold = levelThresholds[targetLevel];
        for (var _i12 = 0; _i12 <= this.size; _i12++) {
          for (var _j8 = 0; _j8 <= this.size; _j8++) {
            var cell = this.grid[_i12][_j8];
            if (cell.category === 'Water' || cell.has || cell.waterBorder) continue;
            var maxAllowed = this.getMaxReliefLevelFromCoastDistance(dist[_i12 * n + _j8]);
            var actual = Math.min(targetLevel, maxAllowed);
            if (reliefH[_i12 * n + _j8] > threshold && actual > cell.z) {
              cell.setCellLevel(actual);
            }
          }
        }
      }
      this.clampReliefAroundWater(dist);

      // Remove isolated z=1 bumps (direct reset, no propagation)
      for (var _i13 = 0; _i13 <= this.size; _i13++) {
        var _loop3 = function _loop3() {
          var cell = _this4.grid[_i13][_j9];
          if (cell.z === 1) {
            var cpt = 0;
            getCellsAroundPoint(_i13, _j9, _this4.grid, 1, function (c) {
              if (c.z > 0) cpt++;
            });
            if (cpt < 3) _this4.setCellReliefLevelDirect(cell, 0);
          }
        };
        for (var _j9 = 0; _j9 <= this.size; _j9++) {
          _loop3();
        }
      }

      // Fill gaps between close elevated cells
      for (var _i14 = 0; _i14 <= this.size; _i14++) {
        for (var _j0 = 0; _j0 <= this.size; _j0++) {
          this.grid[_i14][_j0].fillReliefCellsAroundCell();
        }
      }
      this.clampReliefAroundWater(dist);
    }
  }, {
    key: "getReliefCoastDistances",
    value: function getReliefCoastDistances() {
      var n = this.size + 1;
      var dist = new Int16Array(n * n).fill(9999);
      var queue = [];
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          if (cell.category === 'Water' || cell.waterBorder) {
            dist[i * n + j] = 0;
            queue.push(i * n + j);
          }
        }
      }
      for (var qi = 0; qi < queue.length; qi++) {
        var idx = queue[qi];
        var ci = Math.floor(idx / n),
          cj = idx % n;
        var d = dist[idx];
        for (var _i15 = 0, _arr = [[-1, 0], [1, 0], [0, -1], [0, 1]]; _i15 < _arr.length; _i15++) {
          var _arr$_i = map_slicedToArray(_arr[_i15], 2),
            di = _arr$_i[0],
            dj = _arr$_i[1];
          var ni = ci + di,
            nj = cj + dj;
          if (ni < 0 || ni > this.size || nj < 0 || nj > this.size) continue;
          var nidx = ni * n + nj;
          if (dist[nidx] > d + 1) {
            dist[nidx] = d + 1;
            queue.push(nidx);
          }
        }
      }
      return dist;
    }
  }, {
    key: "getMaxReliefLevelFromCoastDistance",
    value: function getMaxReliefLevelFromCoastDistance(distance) {
      return Math.max(0, distance - 3);
    }
  }, {
    key: "setCellReliefLevelDirect",
    value: function setCellReliefLevelDirect(cell, level) {
      var delta = level - cell.z;
      if (delta === 0) return;
      cell.y -= delta * CELL_DEPTH;
      cell.z = level;
    }
  }, {
    key: "clampReliefAroundWater",
    value: function clampReliefAroundWater() {
      var dist = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.getReliefCoastDistances();
      var n = this.size + 1;
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          var maxAllowed = this.getMaxReliefLevelFromCoastDistance(dist[i * n + j]);
          if (cell.z > maxAllowed) this.setCellReliefLevelDirect(cell, maxAllowed);
        }
      }
    }
  }, {
    key: "formatCellsRelief",
    value: function formatCellsRelief() {
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          if (cell.category === 'Water' || cell.waterBorder) continue;
          // Side
          if (this.grid[i - 1] && this.grid[i - 1][j].z - cell.z === 1 && (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) && (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) && (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z)) {
            cell.setReliefBorder('014', CELL_DEPTH / 2);
          } else if (this.grid[i + 1] && this.grid[i + 1][j].z - cell.z === 1 && (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z) && (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) && (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z)) {
            cell.setReliefBorder('015', CELL_DEPTH / 2);
          } else if (this.grid[i][j - 1] && this.grid[i][j - 1].z - cell.z === 1 && (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) && (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) && (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)) {
            cell.setReliefBorder('016', CELL_DEPTH / 2);
          } else if (this.grid[i][j + 1] && this.grid[i][j + 1].z - cell.z === 1 && (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z) && (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) && (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)) {
            cell.setReliefBorder('013', CELL_DEPTH / 2);
          } // Corner
          else if (this.grid[i - 1] && this.grid[i - 1][j - 1] && this.grid[i - 1][j - 1].z - cell.z === 1 && (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) && (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)) {
            cell.setReliefBorder('010', CELL_DEPTH / 2);
          } else if (this.grid[i + 1] && this.grid[i + 1][j - 1] && this.grid[i + 1][j - 1].z - cell.z === 1 && (!this.grid[i][j - 1] || this.grid[i][j - 1].z <= cell.z) && (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z)) {
            cell.setReliefBorder('012');
          } else if (this.grid[i - 1] && this.grid[i - 1][j + 1] && this.grid[i - 1][j + 1].z - cell.z === 1 && (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) && (!this.grid[i - 1] || this.grid[i - 1][j].z <= cell.z)) {
            cell.setReliefBorder('011');
          } else if (this.grid[i + 1] && this.grid[i + 1][j + 1] && this.grid[i + 1][j + 1].z - cell.z === 1 && (!this.grid[i][j + 1] || this.grid[i][j + 1].z <= cell.z) && (!this.grid[i + 1] || this.grid[i + 1][j].z <= cell.z)) {
            cell.setReliefBorder('009', CELL_DEPTH / 2);
          }
          // Deep corner
          else if (this.grid[i][j - 1] && this.grid[i][j - 1].z - cell.z === 1 && this.grid[i - 1] && this.grid[i - 1][j].z - cell.z === 1) {
            cell.setReliefBorder('022', CELL_DEPTH / 2);
          } else if (this.grid[i][j + 1] && this.grid[i][j + 1].z - cell.z === 1 && this.grid[i + 1] && this.grid[i + 1][j].z - cell.z === 1) {
            cell.setReliefBorder('021', CELL_DEPTH / 2);
          } else if (this.grid[i][j - 1] && this.grid[i][j - 1].z - cell.z === 1 && this.grid[i + 1] && this.grid[i + 1][j].z - cell.z === 1) {
            cell.setReliefBorder('023', CELL_DEPTH);
          } else if (this.grid[i][j + 1] && this.grid[i][j + 1].z - cell.z === 1 && this.grid[i - 1] && this.grid[i - 1][j].z - cell.z === 1) {
            cell.setReliefBorder('024', CELL_DEPTH);
          }
        }
      }
    }
  }, {
    key: "formatCellsWaterBorder",
    value: function formatCellsWaterBorder() {
      // Apply 20000 beach tiles to every land cell adjacent to water.
      // Bitmask priority: deep corners (2 adjacent orthogonal water) first,
      // then single sides, then diagonal-only outer corners.
      // No exclusive "other sides NOT water" conditions — handles any coastline shape.
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var _this$grid, _this$grid2, _this$grid$i, _this$grid$i2, _this$grid3, _this$grid4, _this$grid5, _this$grid6;
          var cell = this.grid[i][j];
          if (cell.type === 'Water') continue;
          var n = ((_this$grid = this.grid[i - 1]) === null || _this$grid === void 0 || (_this$grid = _this$grid[j]) === null || _this$grid === void 0 ? void 0 : _this$grid.type) === 'Water';
          var s = ((_this$grid2 = this.grid[i + 1]) === null || _this$grid2 === void 0 || (_this$grid2 = _this$grid2[j]) === null || _this$grid2 === void 0 ? void 0 : _this$grid2.type) === 'Water';
          var w = ((_this$grid$i = this.grid[i]) === null || _this$grid$i === void 0 || (_this$grid$i = _this$grid$i[j - 1]) === null || _this$grid$i === void 0 ? void 0 : _this$grid$i.type) === 'Water';
          var e = ((_this$grid$i2 = this.grid[i]) === null || _this$grid$i2 === void 0 || (_this$grid$i2 = _this$grid$i2[j + 1]) === null || _this$grid$i2 === void 0 ? void 0 : _this$grid$i2.type) === 'Water';
          var nw = ((_this$grid3 = this.grid[i - 1]) === null || _this$grid3 === void 0 || (_this$grid3 = _this$grid3[j - 1]) === null || _this$grid3 === void 0 ? void 0 : _this$grid3.type) === 'Water';
          var sw = ((_this$grid4 = this.grid[i + 1]) === null || _this$grid4 === void 0 || (_this$grid4 = _this$grid4[j - 1]) === null || _this$grid4 === void 0 ? void 0 : _this$grid4.type) === 'Water';
          var ne = ((_this$grid5 = this.grid[i - 1]) === null || _this$grid5 === void 0 || (_this$grid5 = _this$grid5[j + 1]) === null || _this$grid5 === void 0 ? void 0 : _this$grid5.type) === 'Water';
          var se = ((_this$grid6 = this.grid[i + 1]) === null || _this$grid6 === void 0 || (_this$grid6 = _this$grid6[j + 1]) === null || _this$grid6 === void 0 ? void 0 : _this$grid6.type) === 'Water';
          if (w && n) cell.setWaterBorder('20000', '001');else if (e && s) cell.setWaterBorder('20000', '002');else if (w && s) cell.setWaterBorder('20000', '003');else if (e && n) cell.setWaterBorder('20000', '000');else if (n) cell.setWaterBorder('20000', '008');else if (s) cell.setWaterBorder('20000', '009');else if (w) cell.setWaterBorder('20000', '011');else if (e) cell.setWaterBorder('20000', '010');else if (nw) cell.setWaterBorder('20000', '005');else if (sw) cell.setWaterBorder('20000', '007');else if (ne) cell.setWaterBorder('20000', '004');else if (se) cell.setWaterBorder('20000', '006');
        }
      }

      // Apply 20002 overlay on cells adjacent to waterBorder cells —
      // same approach as formatCellsDesert: the beach tile acts as the "source"
      // and its grass/jungle/desert neighbours get a sandy gradient on top.
      for (var _i16 = 0; _i16 <= this.size; _i16++) {
        for (var _j1 = 0; _j1 <= this.size; _j1++) {
          var _this$grid7, _this$grid8, _this$grid$_i, _this$grid$_i2;
          var _cell3 = this.grid[_i16][_j1];
          if (!_cell3.waterBorder) continue;
          var overlay = function overlay(neighbor, direction) {
            if (neighbor && !neighbor.waterBorder && neighbor.type !== 'Water' && neighbor.type !== 'Desert') {
              neighbor.setDesertBorder(direction);
            }
          };
          overlay((_this$grid7 = this.grid[_i16 - 1]) === null || _this$grid7 === void 0 ? void 0 : _this$grid7[_j1], 'east');
          overlay((_this$grid8 = this.grid[_i16 + 1]) === null || _this$grid8 === void 0 ? void 0 : _this$grid8[_j1], 'west');
          overlay((_this$grid$_i = this.grid[_i16]) === null || _this$grid$_i === void 0 ? void 0 : _this$grid$_i[_j1 - 1], 'south');
          overlay((_this$grid$_i2 = this.grid[_i16]) === null || _this$grid$_i2 === void 0 ? void 0 : _this$grid$_i2[_j1 + 1], 'north');
        }
      }
    }
  }, {
    key: "formatCellsDesert",
    value: function formatCellsDesert() {
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          var typeToFormat = ['Grass', 'Jungle'];
          if (cell.type === 'Desert') {
            if (this.grid[i - 1] && this.grid[i - 1][j] && typeToFormat.includes(this.grid[i - 1][j].type)) {
              this.grid[i - 1][j].setDesertBorder('east');
            }
            if (this.grid[i + 1] && this.grid[i + 1][j] && typeToFormat.includes(this.grid[i + 1][j].type)) {
              this.grid[i + 1][j].setDesertBorder('west');
            }
            if (this.grid[i][j - 1] && typeToFormat.includes(this.grid[i][j - 1].type)) {
              this.grid[i][j - 1].setDesertBorder('south');
            }
            if (this.grid[i][j + 1] && typeToFormat.includes(this.grid[i][j + 1].type)) {
              this.grid[i][j + 1].setDesertBorder('north');
            }
          }
        }
      }
    }
  }, {
    key: "findPlayerPlaces",
    value: function findPlayerPlaces() {
      var results = [];
      var N = this.positionsCount;
      var center = this.size / 2;
      // Randomise start angle so map layout varies each game
      var startAngle = Math.random() * 2 * Math.PI;
      // Search window radius around each angular candidate
      var searchHalf = Math.max(8, Math.floor(this.size * 0.07));
      var border = 12;
      // Ordered list of candidate radii (outer → inner) to try per slot
      var radiiFactors = [0.38, 0.30, 0.44, 0.22, 0.46, 0.15];
      for (var i = 0; i < N; i++) {
        var angle = startAngle + 2 * Math.PI / N * i;
        var found = null;
        var _iterator = map_createForOfIteratorHelper(radiiFactors),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var frac = _step.value;
            if (found) break;
            var r = Math.floor(this.size * frac);
            var ci = Math.round(center + Math.cos(angle) * r);
            var cj = Math.round(center + Math.sin(angle) * r);
            found = getZoneInGridWithCondition({
              minX: Math.max(border, ci - searchHalf),
              maxX: Math.min(this.size - border, ci + searchHalf),
              minY: Math.max(border, cj - searchHalf),
              maxY: Math.min(this.size - border, cj + searchHalf)
            }, this.grid, 5, function (cell) {
              return !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water';
            });
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        if (found) results.push(found);
      }
      return results;
    }
  }, {
    key: "placeResourceGroup",
    value: function placeResourceGroup(player, instance, quantity, range) {
      var context = this.context,
        grid = this.grid;
      function getValidCells(ci, cj, radius) {
        var cells = [];
        for (var dx = -radius; dx <= radius; dx++) {
          var _loop4 = function _loop4() {
            var _grid$newI2;
            var newI = ci + dx;
            var newJ = cj + dy;
            if (!((_grid$newI2 = grid[newI]) !== null && _grid$newI2 !== void 0 && _grid$newI2[newJ])) return 1; // continue
            var cell = grid[newI][newJ];
            var isFree = true;
            grid_getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, function (c) {
              var _c$has;
              if ([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.gold, RESOURCE_TYPES.stone].includes((_c$has = c.has) === null || _c$has === void 0 ? void 0 : _c$has.type)) {
                isFree = false;
              }
            });
            if (isFree && !cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
              cells.push({
                i: newI,
                j: newJ
              });
            }
          };
          for (var dy = -radius; dy <= radius; dy++) {
            if (_loop4()) continue;
          }
        }
        return cells;
      }

      // Radial placement: random angle + random distance in [range[0], range[1]]
      var angle = Math.random() * 2 * Math.PI;
      var dist = range[0] + Math.random() * (range[1] - range[0]);
      var centerI = Math.round(player.i + Math.cos(angle) * dist);
      var centerJ = Math.round(player.j + Math.sin(angle) * dist);

      // Radius 2 → 5×5 tight cluster (AoE1 style), fallback to 3 if not enough cells
      var validCells = getValidCells(centerI, centerJ, 2);
      if (validCells.length < quantity) validCells = getValidCells(centerI, centerJ, 3);
      if (validCells.length < quantity) return;
      var cellsToPlace = [];
      for (var i = 0; i < quantity; i++) {
        if (!validCells.length) break;
        var idx = Math.floor(Math.random() * validCells.length);
        cellsToPlace.push(validCells.splice(idx, 1)[0]);
      }
      for (var _i17 = 0, _cellsToPlace2 = cellsToPlace; _i17 < _cellsToPlace2.length; _i17++) {
        var cell = _cellsToPlace2[_i17];
        this.resources.add(this.addChild(new Resource({
          i: cell.i,
          j: cell.j,
          type: instance
        }, context)));
      }
    }

    // Bake all terrain cells into RenderTexture chunks and remove them from the live scene graph.
    // Reduces updateTransformAndChildren from ~14k nodes to ~1 sprite per chunk.
  }, {
    key: "bakeTerrainToChunks",
    value: function bakeTerrainToChunks() {
      var _this$context$app;
      var renderer = (_this$context$app = this.context.app) === null || _this$context$app === void 0 ? void 0 : _this$context$app.renderer;
      if (!renderer) return;

      // Full isometric pixel bounds of the map (with margin for sprite overflow)
      var _this$_getFogMapBound = this._getFogMapBounds(),
        minX = _this$_getFogMapBound.minX,
        minY = _this$_getFogMapBound.minY,
        maxX = _this$_getFogMapBound.maxX,
        maxY = _this$_getFogMapBound.maxY,
        totalW = _this$_getFogMapBound.totalW,
        totalH = _this$_getFogMapBound.totalH;

      // Cap chunk size at 4096 for broad GPU compatibility
      var gl = renderer.gl;
      var maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096;
      var chunksX = Math.ceil(totalW / maxTex);
      var chunksY = Math.ceil(totalH / maxTex);
      var chunkW = totalW / chunksX;
      var chunkH = totalH / chunksY;

      // All cells must be visible during the bake (fog overlay is separate in fogLayer)
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          this.grid[i][j].visible = true;
        }
      }

      // Move cells out of the live scene graph into an off-screen container.
      // Cells remain accessible via this.grid for all game logic.
      var terrainContainer = new lib/* Container */.mcf();
      for (var _i18 = 0; _i18 <= this.size; _i18++) {
        for (var _j10 = 0; _j10 <= this.size; _j10++) {
          terrainContainer.addChild(this.grid[_i18][_j10]);
        }
      }
      for (var cx = 0; cx < chunksX; cx++) {
        for (var cy = 0; cy < chunksY; cy++) {
          var cMinX = minX + cx * chunkW;
          var cMinY = minY + cy * chunkH;
          var cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW);
          var cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH);
          var rt = lib/* RenderTexture */.Y7R.create({
            width: cW,
            height: cH
          });
          var transform = new lib/* Matrix */.uqu().translate(-cMinX, -cMinY);
          renderer.render({
            container: terrainContainer,
            target: rt,
            transform: transform,
            clear: true
          });
          var sprite = new lib/* Sprite */.kxk(rt);
          sprite.x = cMinX;
          sprite.y = cMinY;
          sprite.zIndex = -1;
          sprite.eventMode = 'none';
          sprite.label = 'terrainChunk';
          this.addChild(sprite);
        }
      }

      // Re-initialize entity visibility: cells were moved out of the scene graph so their
      // updateVisible() was never triggered by the normal render pipeline.
      // Walk all viewed cells and show their resources/corpses explicitly.
      var player = this.context.player;
      for (var _i19 = 0; _i19 <= this.size; _i19++) {
        for (var _j11 = 0; _j11 <= this.size; _j11++) {
          var _player$views$_i;
          var cell = this.grid[_i19][_j11];
          if ((_player$views$_i = player.views[_i19]) !== null && _player$views$_i !== void 0 && (_player$views$_i = _player$views$_i[_j11]) !== null && _player$views$_i !== void 0 && _player$views$_i.viewed) {
            cell.updateVisible();
          }
        }
      }
    }
  }, {
    key: "_initFogChunks",
    value: function _initFogChunks() {
      var _this$context$app2,
        _this5 = this;
      this._fogQueue = new globalThis.Map();
      this._fogInitComplete = false;
      this._fogChunks = [];
      var renderer = (_this$context$app2 = this.context.app) === null || _this$context$app2 === void 0 ? void 0 : _this$context$app2.renderer;
      if (!renderer) return;
      var margin = CELL_WIDTH;
      var minX = -this.size * (CELL_WIDTH / 2) - margin;
      var minY = -margin;
      var maxX = this.size * (CELL_WIDTH / 2) + margin;
      var maxY = this.size * CELL_HEIGHT + margin;
      var totalW = maxX - minX;
      var totalH = maxY - minY;
      var gl = renderer.gl;
      var maxTex = gl ? Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096) : 4096;
      var chunksX = Math.ceil(totalW / maxTex);
      var chunksY = Math.ceil(totalH / maxTex);
      var chunkW = totalW / chunksX;
      var chunkH = totalH / chunksY;
      this._fogBounds = {
        minX: minX,
        minY: minY,
        chunksX: chunksX,
        chunksY: chunksY,
        chunkW: chunkW,
        chunkH: chunkH,
        totalW: totalW,
        totalH: totalH
      };
      this.fogLayer = new lib/* Container */.mcf();
      this.fogLayer.eventMode = 'none';
      this.fogLayer.zIndex = 1e9;
      this.fogLayer.sortableChildren = true;
      this.addChild(this.fogLayer);

      // revealEverything = no fog chunks at all, fogLayer stays empty
      if (this.revealEverything) return;
      for (var cx = 0; cx < chunksX; cx++) {
        for (var cy = 0; cy < chunksY; cy++) {
          var cMinX = minX + cx * chunkW;
          var cMinY = minY + cy * chunkH;
          var cW = Math.ceil(cx === chunksX - 1 ? totalW - cx * chunkW : chunkW);
          var cH = Math.ceil(cy === chunksY - 1 ? totalH - cy * chunkH : chunkH);
          var darknessRt = lib/* RenderTexture */.Y7R.create({
            width: cW,
            height: cH
          });
          var fogRt = lib/* RenderTexture */.Y7R.create({
            width: cW,
            height: cH
          });
          var edgeRt = lib/* RenderTexture */.Y7R.create({
            width: cW,
            height: cH
          });
          var emptyC = new lib/* Container */.mcf();
          renderer.render({
            container: emptyC,
            target: darknessRt,
            clear: true
          });
          renderer.render({
            container: emptyC,
            target: fogRt,
            clear: true
          });
          renderer.render({
            container: emptyC,
            target: edgeRt,
            clear: true
          });
          emptyC.destroy();
          var pattern = this._createFogPatternSprite(cMinX, cMinY, cW, cH);
          renderer.render({
            container: pattern,
            target: fogRt,
            clear: false
          });
          pattern.destroy();
          if (!this.revealTerrain) {
            var blackG = new lib/* Graphics */.A1g();
            blackG.rect(cMinX, cMinY, cW, cH).fill({
              color: 0x000000
            });
            renderer.render({
              container: blackG,
              target: darknessRt,
              transform: new lib/* Matrix */.uqu().translate(-cMinX, -cMinY),
              clear: false
            });
            blackG.destroy();
          }
          var darknessSprite = new lib/* Sprite */.kxk(darknessRt);
          darknessSprite.x = cMinX;
          darknessSprite.y = cMinY;
          darknessSprite.zIndex = 1;
          darknessSprite.eventMode = 'none';
          this.fogLayer.addChild(darknessSprite);
          var fogSprite = new lib/* Sprite */.kxk(fogRt);
          fogSprite.x = cMinX;
          fogSprite.y = cMinY;
          fogSprite.zIndex = 2;
          fogSprite.eventMode = 'none';
          this.fogLayer.addChild(fogSprite);
          var edgeSprite = new lib/* Sprite */.kxk(edgeRt);
          edgeSprite.x = cMinX;
          edgeSprite.y = cMinY;
          edgeSprite.zIndex = 3;
          edgeSprite.eventMode = 'none';
          this.fogLayer.addChild(edgeSprite);
          this._fogChunks.push({
            darknessRt: darknessRt,
            fogRt: fogRt,
            edgeRt: edgeRt,
            minX: cMinX,
            minY: cMinY,
            w: cW,
            h: cH
          });
        }
      }
      this._fogTickerCb = function () {
        // Self-remove if this map is no longer active
        if (_this5.context.map !== _this5) {
          _this5.context.app.ticker.remove(_this5._fogTickerCb);
          return;
        }
        _this5._flushFogQueue();
      };
      this.context.app.ticker.add(this._fogTickerCb);
    }
  }, {
    key: "_createFogPatternSprite",
    value: function _createFogPatternSprite(x, y, width, height) {
      var pattern = new lib/* TilingSprite */.t9Q({
        texture: getFogPatternTexture(),
        width: Math.ceil(width),
        height: Math.ceil(height)
      });
      pattern.x = 0;
      pattern.y = 0;
      pattern.tilePosition.set(-Math.floor(x), -Math.floor(y));
      pattern.eventMode = 'none';
      return pattern;
    }
  }, {
    key: "_getFogMapBounds",
    value: function _getFogMapBounds() {
      if (!this.grid.length) {
        var _margin = CELL_WIDTH + CELL_DEPTH * 4;
        var _minX = -this.size * (CELL_WIDTH / 2) - _margin;
        var _minY = -_margin;
        var _maxX = this.size * (CELL_WIDTH / 2) + _margin;
        var _maxY = this.size * CELL_HEIGHT + _margin;
        return {
          minX: _minX,
          minY: _minY,
          maxX: _maxX,
          maxY: _maxY,
          totalW: _maxX - _minX,
          totalH: _maxY - _minY
        };
      }
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var _this$grid$i3;
          var cell = (_this$grid$i3 = this.grid[i]) === null || _this$grid$i3 === void 0 ? void 0 : _this$grid$i3[j];
          if (!cell) continue;
          var bounds = this._getFogCellBounds(cell);
          minX = Math.min(minX, bounds.minX);
          minY = Math.min(minY, bounds.minY);
          maxX = Math.max(maxX, bounds.maxX);
          maxY = Math.max(maxY, bounds.maxY);
        }
      }
      var margin = CELL_DEPTH;
      minX -= margin;
      minY -= margin;
      maxX += margin;
      maxY += margin;
      return {
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        totalW: maxX - minX,
        totalH: maxY - minY
      };
    }
  }, {
    key: "_getFogCellBounds",
    value: function _getFogCellBounds(cell) {
      var hw = _DW / 2;
      var hh = _DH / 2;
      var _this$_getFogCellCent = this._getFogCellCenter(cell),
        _this$_getFogCellCent2 = map_slicedToArray(_this$_getFogCellCent, 2),
        cx = _this$_getFogCellCent2[0],
        cy = _this$_getFogCellCent2[1];
      return {
        minX: cx - hw,
        minY: cy - hh,
        maxX: cx + hw,
        maxY: cy + hh
      };
    }
  }, {
    key: "_getFogChunksForCell",
    value: function _getFogChunksForCell(cell) {
      var bounds = this._getFogCellBounds(cell);
      return this._fogChunks.filter(function (chunk) {
        return bounds.maxX >= chunk.minX && bounds.minX <= chunk.minX + chunk.w && bounds.maxY >= chunk.minY && bounds.minY <= chunk.minY + chunk.h;
      });
    }
  }, {
    key: "_drawFogCellShape",
    value: function _drawFogCellShape(graphics, cell) {
      var _this$_getFogCellPoin = this._getFogCellPoints(cell),
        _this$_getFogCellPoin2 = map_slicedToArray(_this$_getFogCellPoin, 4),
        top = _this$_getFogCellPoin2[0],
        right = _this$_getFogCellPoin2[1],
        bottom = _this$_getFogCellPoin2[2],
        left = _this$_getFogCellPoin2[3];
      graphics.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
    }
  }, {
    key: "_getFogCellOpenSides",
    value: function _getFogCellOpenSides(cell) {
      var _grid, _grid$cell$i, _grid2, _grid$cell$i2;
      var grid = this.grid;
      var _this$_getFogCellPoin3 = this._getFogCellPoints(cell),
        _this$_getFogCellPoin4 = map_slicedToArray(_this$_getFogCellPoin3, 4),
        top = _this$_getFogCellPoin4[0],
        right = _this$_getFogCellPoin4[1],
        bottom = _this$_getFogCellPoin4[2],
        left = _this$_getFogCellPoin4[3];
      var sides = [];
      var addSide = function addSide(neighbor, from, to) {
        if (neighbor && !neighbor._hasFog) return;
        sides.push({
          from: from,
          to: to
        });
      };
      addSide((_grid = grid[cell.i - 1]) === null || _grid === void 0 ? void 0 : _grid[cell.j], left, top);
      addSide((_grid$cell$i = grid[cell.i]) === null || _grid$cell$i === void 0 ? void 0 : _grid$cell$i[cell.j - 1], top, right);
      addSide((_grid2 = grid[cell.i + 1]) === null || _grid2 === void 0 ? void 0 : _grid2[cell.j], right, bottom);
      addSide((_grid$cell$i2 = grid[cell.i]) === null || _grid$cell$i2 === void 0 ? void 0 : _grid$cell$i2[cell.j + 1], bottom, left);
      return sides;
    }
  }, {
    key: "_signedDistanceToFogSide",
    value: function _signedDistanceToFogSide(point, from, to, cell) {
      var edgeX = to.x - from.x;
      var edgeY = to.y - from.y;
      var len = Math.hypot(edgeX, edgeY);
      if (len === 0) return 0;
      var _this$_getFogCellCent3 = this._getFogCellCenter(cell),
        _this$_getFogCellCent4 = map_slicedToArray(_this$_getFogCellCent3, 2),
        cx = _this$_getFogCellCent4[0],
        cy = _this$_getFogCellCent4[1];
      var pointCross = edgeX * (point.y - from.y) - edgeY * (point.x - from.x);
      var cellCross = edgeX * (cy - from.y) - edgeY * (cx - from.x);
      return pointCross * Math.sign(cellCross || 1) / len;
    }
  }, {
    key: "_clipFogErasePolygonBySide",
    value: function _clipFogErasePolygonBySide(points, from, to, cell, inset) {
      var _this6 = this;
      var clipped = [];
      var isInside = function isInside(point) {
        return _this6._signedDistanceToFogSide(point, from, to, cell) >= inset;
      };
      var intersection = function intersection(a, b) {
        var da = _this6._signedDistanceToFogSide(a, from, to, cell) - inset;
        var db = _this6._signedDistanceToFogSide(b, from, to, cell) - inset;
        var t = da / (da - db);
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        };
      };
      for (var i = 0; i < points.length; i++) {
        var current = points[i];
        var previous = points[(i + points.length - 1) % points.length];
        var currentInside = isInside(current);
        var previousInside = isInside(previous);
        if (currentInside) {
          if (!previousInside) clipped.push(intersection(previous, current));
          clipped.push(current);
        } else if (previousInside) {
          clipped.push(intersection(previous, current));
        }
      }
      return clipped;
    }
  }, {
    key: "_drawFogEraseCellShape",
    value: function _drawFogEraseCellShape(graphics, cell) {
      var inset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 5;
      var points = this._getFogCellPoints(cell);
      var _iterator2 = map_createForOfIteratorHelper(this._getFogCellOpenSides(cell)),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _step2$value = _step2.value,
            from = _step2$value.from,
            to = _step2$value.to;
          points = this._clipFogErasePolygonBySide(points, from, to, cell, inset);
          if (points.length < 3) return;
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      graphics.poly(points.flatMap(function (point) {
        return [point.x, point.y];
      }));
    }
  }, {
    key: "_getFogEraseRefreshCells",
    value: function _getFogEraseRefreshCells(cell) {
      var _grid3, _grid$cell$i3, _grid4, _grid$cell$i4;
      var grid = this.grid;
      return [cell, (_grid3 = grid[cell.i - 1]) === null || _grid3 === void 0 ? void 0 : _grid3[cell.j], (_grid$cell$i3 = grid[cell.i]) === null || _grid$cell$i3 === void 0 ? void 0 : _grid$cell$i3[cell.j - 1], (_grid4 = grid[cell.i + 1]) === null || _grid4 === void 0 ? void 0 : _grid4[cell.j], (_grid$cell$i4 = grid[cell.i]) === null || _grid$cell$i4 === void 0 ? void 0 : _grid$cell$i4[cell.j + 1]].filter(function (refreshCell) {
        return refreshCell && !refreshCell._hasFog;
      });
    }
  }, {
    key: "_getFogCellCenter",
    value: function _getFogCellCenter(cell) {
      return cartesianToIsometric(cell.i, cell.j);
    }
  }, {
    key: "_getFogCellPoints",
    value: function _getFogCellPoints(cell) {
      var hw = _DW / 2;
      var hh = _DH / 2;
      var _this$_getFogCellCent5 = this._getFogCellCenter(cell),
        _this$_getFogCellCent6 = map_slicedToArray(_this$_getFogCellCent5, 2),
        cx = _this$_getFogCellCent6[0],
        cy = _this$_getFogCellCent6[1];
      return [{
        x: cx,
        y: cy - hh
      }, {
        x: cx + hw,
        y: cy
      }, {
        x: cx,
        y: cy + hh
      }, {
        x: cx - hw,
        y: cy
      }];
    }
  }, {
    key: "_redrawFogEdgesInChunk",
    value: function _redrawFogEdgesInChunk(renderer, chunk) {
      var emptyC = new lib/* Container */.mcf();
      renderer.render({
        container: emptyC,
        target: chunk.edgeRt,
        clear: true
      });
      emptyC.destroy();
    }
  }, {
    key: "_drawVisibleCellsInChunk",
    value: function _drawVisibleCellsInChunk(graphics, chunk) {
      var maxX = chunk.minX + chunk.w;
      var maxY = chunk.minY + chunk.h;
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          if (cell._hasFog) continue;
          var bounds = this._getFogCellBounds(cell);
          if (bounds.maxX >= chunk.minX && bounds.minX <= maxX && bounds.maxY >= chunk.minY && bounds.minY <= maxY) {
            this._drawFogEraseCellShape(graphics, cell);
          }
        }
      }
    }
  }, {
    key: "_flushFogQueue",
    value: function _flushFogQueue() {
      var _this$context$app3,
        _this7 = this;
      if (!this._fogQueue || this._fogQueue.size === 0) return;
      var renderer = (_this$context$app3 = this.context.app) === null || _this$context$app3 === void 0 ? void 0 : _this$context$app3.renderer;
      if (!renderer) return;
      var chunkUpdates = new globalThis.Map();
      var addChunkUpdate = function addChunkUpdate(cell, state) {
        var chunks = _this7._getFogChunksForCell(cell);
        var _iterator3 = map_createForOfIteratorHelper(chunks),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var chunk = _step3.value;
            if (!chunkUpdates.has(chunk)) chunkUpdates.set(chunk, []);
            chunkUpdates.get(chunk).push({
              cell: cell,
              state: state
            });
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      };
      var _iterator4 = map_createForOfIteratorHelper(this._fogQueue),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var _step4$value = map_slicedToArray(_step4.value, 2),
            cell = _step4$value[0],
            state = _step4$value[1];
          addChunkUpdate(cell, state);
          if (state === 'clear') {
            var _iterator7 = map_createForOfIteratorHelper(this._getFogEraseRefreshCells(cell)),
              _step7;
            try {
              for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
                var refreshCell = _step7.value;
                if (refreshCell === cell) continue;
                addChunkUpdate(refreshCell, 'refreshFogErase');
              }
            } catch (err) {
              _iterator7.e(err);
            } finally {
              _iterator7.f();
            }
          }
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
      this._fogQueue.clear();
      var _iterator5 = map_createForOfIteratorHelper(chunkUpdates),
        _step5;
      try {
        for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
          var _step5$value = map_slicedToArray(_step5.value, 2),
            chunk = _step5$value[0],
            updates = _step5$value[1];
          var transform = new lib/* Matrix */.uqu().translate(-chunk.minX, -chunk.minY);
          var darknessDraw = new lib/* Graphics */.A1g();
          var darknessErase = new lib/* Graphics */.A1g();
          var fogErase = new lib/* Graphics */.A1g();
          var hasDarknessDraw = false;
          var hasDarknessErase = false;
          var hasFogErase = false;
          var needsFogRestore = false;
          var _iterator8 = map_createForOfIteratorHelper(updates),
            _step8;
          try {
            for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
              var _step8$value = _step8.value,
                _cell4 = _step8$value.cell,
                _state = _step8$value.state;
              if (_state === 'clear') {
                this._drawFogCellShape(darknessErase, _cell4);
                this._drawFogEraseCellShape(fogErase, _cell4);
                hasDarknessErase = true;
                hasFogErase = true;
              } else if (_state === 'refreshFogErase') {
                this._drawFogEraseCellShape(fogErase, _cell4);
                hasFogErase = true;
              } else if (_state === 'fogViewed') {
                this._drawFogCellShape(darknessErase, _cell4);
                hasDarknessErase = true;
                needsFogRestore = true;
              } else {
                this._drawFogCellShape(darknessDraw, _cell4);
                hasDarknessDraw = true;
              }
            }
          } catch (err) {
            _iterator8.e(err);
          } finally {
            _iterator8.f();
          }
          if (hasDarknessDraw) {
            darknessDraw.fill({
              color: 0x000000
            });
            renderer.render({
              container: darknessDraw,
              target: chunk.darknessRt,
              transform: transform,
              clear: false
            });
          }
          if (hasDarknessErase) {
            darknessErase.blendMode = 'erase';
            darknessErase.fill({
              color: 0xffffff
            });
            var eraseContainer = new lib/* Container */.mcf();
            eraseContainer.addChild(darknessErase);
            renderer.render({
              container: eraseContainer,
              target: chunk.darknessRt,
              transform: transform,
              clear: false
            });
            eraseContainer.removeChildren();
            eraseContainer.destroy();
          }
          if (needsFogRestore) {
            var pattern = this._createFogPatternSprite(chunk.minX, chunk.minY, chunk.w, chunk.h);
            renderer.render({
              container: pattern,
              target: chunk.fogRt,
              clear: false
            });
            pattern.destroy();
            this._drawVisibleCellsInChunk(fogErase, chunk);
            hasFogErase = true;
          }
          if (hasFogErase) {
            fogErase.blendMode = 'erase';
            fogErase.fill({
              color: 0xffffff
            });
            var _eraseContainer = new lib/* Container */.mcf();
            _eraseContainer.addChild(fogErase);
            renderer.render({
              container: _eraseContainer,
              target: chunk.fogRt,
              transform: transform,
              clear: false
            });
            _eraseContainer.removeChildren();
            _eraseContainer.destroy();
          }
          darknessDraw.destroy();
          darknessErase.destroy();
          fogErase.destroy();
        }
      } catch (err) {
        _iterator5.e(err);
      } finally {
        _iterator5.f();
      }
      var _iterator6 = map_createForOfIteratorHelper(this._fogChunks),
        _step6;
      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var _chunk = _step6.value;
          this._redrawFogEdgesInChunk(renderer, _chunk);
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
    }
  }]);
}(lib/* Container */.mcf);

;// ./app/lib/uiSound.js
var _audio = new Audio('assets/sounds/5035.wav');
_audio.volume = 0.6;
function playClickSound() {
  _audio.currentTime = 0;
  _audio.play()["catch"](function () {});
}
;// ./app/ui/MinimapManager.js
function MinimapManager_typeof(o) { "@babel/helpers - typeof"; return MinimapManager_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, MinimapManager_typeof(o); }
function MinimapManager_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function MinimapManager_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, MinimapManager_toPropertyKey(o.key), o); } }
function MinimapManager_createClass(e, r, t) { return r && MinimapManager_defineProperties(e.prototype, r), t && MinimapManager_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function MinimapManager_toPropertyKey(t) { var i = MinimapManager_toPrimitive(t, "string"); return "symbol" == MinimapManager_typeof(i) ? i : i + ""; }
function MinimapManager_toPrimitive(t, r) { if ("object" != MinimapManager_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != MinimapManager_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var MinimapManager = /*#__PURE__*/function () {
  function MinimapManager(menu) {
    MinimapManager_classCallCheck(this, MinimapManager);
    this.menu = menu;
    this.miniMapAlpha = 1.284;
    this.updatePlayerMiniMap = throttle(this.updatePlayerMiniMapEvt.bind(this), 500);
    this.updateResourcesMiniMap = throttle(this.updateResourcesMiniMapEvt.bind(this), 500);
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt.bind(this), 100);
  }
  return MinimapManager_createClass(MinimapManager, [{
    key: "getMinimapFactor",
    value: function getMinimapFactor() {
      var map = this.menu.context.map;
      return (CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2) / 234 * 2;
    }
  }, {
    key: "getMinimapParams",
    value: function getMinimapParams() {
      var factor = this.getMinimapFactor() / this.miniMapAlpha;
      var translate = (CELL_WIDTH / 2 + this.menu.context.map.size * CELL_WIDTH / 2) / 2 / factor;
      return {
        factor: factor,
        translate: translate
      };
    }
  }, {
    key: "initMiniMap",
    value: function initMiniMap() {
      var menu = this.menu;
      var _this$getMinimapParam = this.getMinimapParams(),
        translate = _this$getMinimapParam.translate;
      for (var _i = 0, _arr = [menu.terrainMinimap, menu.cameraMinimap, menu.resourcesMinimap]; _i < _arr.length; _i++) {
        var canvas = _arr[_i];
        canvas.getContext('2d').translate(translate, 0);
      }
      var map = menu.context.map;
      if (map.revealEverything || map.revealTerrain) {
        this.revealTerrainMinimap();
      }
    }
  }, {
    key: "revealTerrainMinimap",
    value: function revealTerrainMinimap() {
      var menu = this.menu;
      var map = menu.context.map;
      var canvas = menu.terrainMinimap;
      var context = canvas.getContext('2d');
      var _this$getMinimapParam2 = this.getMinimapParams(),
        factor = _this$getMinimapParam2.factor,
        translate = _this$getMinimapParam2.translate;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      for (var i = 0; i <= map.size; i++) {
        for (var j = 0; j <= map.size; j++) {
          var cell = map.grid[i][j];
          canvasDrawDiamond(context, cell.x / factor + translate, cell.y / factor, CELL_WIDTH / factor + 1, CELL_HEIGHT / factor + 1, cell.color);
        }
      }
    }
  }, {
    key: "updateTerrainMiniMap",
    value: function updateTerrainMiniMap(i, j) {
      var menu = this.menu;
      var map = menu.context.map;
      var canvas = menu.terrainMinimap;
      var context = canvas.getContext('2d');
      var _this$getMinimapParam3 = this.getMinimapParams(),
        factor = _this$getMinimapParam3.factor,
        translate = _this$getMinimapParam3.translate;
      var cell = map.grid[i][j];
      canvasDrawDiamond(context, cell.x / factor + translate, cell.y / factor, CELL_WIDTH / factor + 1, CELL_HEIGHT / factor + 1, cell.color);
      if (cell.has && cell.has.family === FAMILY_TYPES.resource) {
        this.updateResourceMiniMap(cell.has);
      }
    }
  }, {
    key: "updateResourceMiniMap",
    value: function updateResourceMiniMap(resource) {
      var menu = this.menu;
      var context = menu.resourcesMinimap.getContext('2d');
      var _this$getMinimapParam4 = this.getMinimapParams(),
        factor = _this$getMinimapParam4.factor,
        translate = _this$getMinimapParam4.translate;
      var squareSize = 4;
      canvasDrawRectangle(context, resource.x / factor - squareSize / 2 + translate, resource.y / factor - squareSize / 2, squareSize, squareSize, resource.color);
    }
  }, {
    key: "updateResourcesMiniMapEvt",
    value: function updateResourcesMiniMapEvt() {
      var menu = this.menu;
      var _menu$context = menu.context,
        map = _menu$context.map,
        player = _menu$context.player;
      var canvas = menu.resourcesMinimap;
      var context = canvas.getContext('2d');
      var _this$getMinimapParam5 = this.getMinimapParams(),
        factor = _this$getMinimapParam5.factor,
        translate = _this$getMinimapParam5.translate;
      var squareSize = 4;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      map.resources.forEach(function (resource) {
        var _player$views;
        var cell = player === null || player === void 0 || (_player$views = player.views) === null || _player$views === void 0 || (_player$views = _player$views[resource.i]) === null || _player$views === void 0 ? void 0 : _player$views[resource.j];
        if (resource.color && (cell !== null && cell !== void 0 && cell.viewed || map.revealEverything)) {
          canvasDrawRectangle(context, resource.x / factor - squareSize / 2 + translate, resource.y / factor - squareSize / 2, squareSize, squareSize, resource.color);
        }
      });
    }
  }, {
    key: "updateCameraMiniMapEvt",
    value: function updateCameraMiniMapEvt() {
      var menu = this.menu;
      var _menu$context2 = menu.context,
        app = _menu$context2.app,
        controls = _menu$context2.controls;
      var canvas = menu.cameraMinimap;
      var context = canvas.getContext('2d');
      var _this$getMinimapParam6 = this.getMinimapParams(),
        factor = _this$getMinimapParam6.factor,
        translate = _this$getMinimapParam6.translate;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      canvasDrawStrokeRectangle(context, controls.camera.x / factor + translate, controls.camera.y / factor, app.screen.width / factor, app.screen.height / factor, 'white');
    }
  }, {
    key: "updatePlayerMiniMapEvt",
    value: function updatePlayerMiniMapEvt(owner) {
      if (!owner) return;
      var menu = this.menu;
      var _menu$context3 = menu.context,
        map = _menu$context3.map,
        player = _menu$context3.player;
      var squareSize = 4;
      var _this$getMinimapParam7 = this.getMinimapParams(),
        factor = _this$getMinimapParam7.factor,
        translate = _this$getMinimapParam7.translate;
      var color = owner.colorHex;
      var id = "minimap-".concat(owner.label);
      var canvas, context;
      var existing = menu.playersMinimap.find(function (p) {
        return p.id === id;
      });
      if (existing) {
        canvas = existing.canvas;
        context = existing.context;
      } else {
        canvas = document.createElement('canvas');
        context = canvas.getContext('2d');
        context.translate(translate, 0);
        menu.playersMinimap.push({
          id: id,
          canvas: canvas,
          context: context
        });
        menu.bottombarMap.appendChild(canvas);
      }
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      var isVisible = function isVisible(instance) {
        return map.revealEverything || owner.isPlayed || instanceIsInPlayerSight(instance, player);
      };
      owner.buildings.forEach(function (building) {
        if (!isVisible(building)) return;
        var x = building.x,
          y = building.y,
          size = building.size,
          selected = building.selected;
        var finalSize = squareSize + size;
        canvasDrawRectangle(context, x / factor - finalSize / 2 + translate, y / factor - finalSize / 2, finalSize, finalSize, selected ? 'white' : color);
      });
      owner.units.forEach(function (unit) {
        if (!isVisible(unit)) return;
        var x = unit.x,
          y = unit.y,
          selected = unit.selected;
        canvasDrawRectangle(context, x / factor - squareSize / 2 + translate, y / factor - squareSize / 2, squareSize, squareSize, selected ? 'white' : color);
      });
    }
  }]);
}();
;// ./app/ui/BottombarManager.js
function BottombarManager_typeof(o) { "@babel/helpers - typeof"; return BottombarManager_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BottombarManager_typeof(o); }
function BottombarManager_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function BottombarManager_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? BottombarManager_ownKeys(Object(t), !0).forEach(function (r) { BottombarManager_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : BottombarManager_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function BottombarManager_defineProperty(e, r, t) { return (r = BottombarManager_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function BottombarManager_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BottombarManager_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BottombarManager_toPropertyKey(o.key), o); } }
function BottombarManager_createClass(e, r, t) { return r && BottombarManager_defineProperties(e.prototype, r), t && BottombarManager_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BottombarManager_toPropertyKey(t) { var i = BottombarManager_toPrimitive(t, "string"); return "symbol" == BottombarManager_typeof(i) ? i : i + ""; }
function BottombarManager_toPrimitive(t, r) { if ("object" != BottombarManager_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BottombarManager_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }






var BottombarManager = /*#__PURE__*/function () {
  function BottombarManager(menu) {
    BottombarManager_classCallCheck(this, BottombarManager);
    this.menu = menu;
  }
  return BottombarManager_createClass(BottombarManager, [{
    key: "resetInfo",
    value: function resetInfo() {
      var menu = this.menu;
      menu.bottombarInfo.textContent = '';
      menu.bottombarInfo.style.background = 'transparent';
      menu._infoCache = null;
    }
  }, {
    key: "generateInfo",
    value: function generateInfo(selection) {
      var menu = this.menu;
      this.resetInfo();
      menu.bottombarInfo.style.background = 'black';
      if (typeof selection["interface"].info === 'function') {
        selection["interface"].info(menu.bottombarInfo);
      }
    }
  }, {
    key: "updateInfo",
    value: function updateInfo(target, action) {
      var menu = this.menu;
      if (!menu._infoCache) menu._infoCache = new Map();
      var targetElement = menu._infoCache.get(target);
      if (!targetElement) {
        targetElement = menu.bottombarInfo.querySelector("[id=".concat(target, "]"));
        if (!targetElement) return;
        menu._infoCache.set(target, targetElement);
      }
      return typeof action !== 'function' ? targetElement.textContent = action : action(targetElement);
    }
  }, {
    key: "updateButtonContent",
    value: function updateButtonContent(target, action) {
      var menu = this.menu;
      var targetElement = menu.bottombarMenu.querySelector("[id=".concat(target, "]"));
      if (!targetElement) return;
      var contentElement = targetElement.querySelector('[id=content]');
      if (!contentElement) return;
      return typeof action !== 'function' ? contentElement.textContent = action : action(contentElement);
    }
  }, {
    key: "toggleButtonCancel",
    value: function toggleButtonCancel(target, value) {
      var menu = this.menu;
      var element = menu.bottombarMenu.querySelector("[id=".concat(target, "-cancel]"));
      if (!element) return;
      element.style.display = value ? 'block' : 'none';
    }
  }, {
    key: "updateBottombar",
    value: function updateBottombar() {
      var menu = this.menu;
      var player = menu.context.player;
      if (player.selectedBuilding || player.selectedUnit) {
        this.setBottombar(player.selectedBuilding || player.selectedUnit);
      }
    }
  }, {
    key: "setBottombar",
    value: function setBottombar() {
      var selection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var menu = this.menu;
      var _menu$context = menu.context,
        controls = _menu$context.controls,
        player = _menu$context.player;
      this.resetInfo();
      menu.bottombarMenu.textContent = '';
      menu.selection = selection;
      if (controls.mouseBuilding) {
        controls.removeMouseBuilding();
      }
      if (selection && selection["interface"]) {
        this.generateInfo(selection);
        if (selection.family === FAMILY_TYPES.building) {
          if (!selection.isBuilt) {
            setMenuRecurs(selection, menu.bottombarMenu, []);
          } else if (selection.technology) {
            setMenuRecurs(selection, menu.bottombarMenu, [{
              icon: 'assets/interface/50721/003_50721.png',
              id: "".concat(selection.technology, "-cancel"),
              onClick: function onClick(sel) {
                sound_lib/* sound */.s3.play('5036');
                sel.cancelTechnology();
              }
            }]);
          } else {
            setMenuRecurs(selection, menu.bottombarMenu, selection["interface"].menu || []);
          }
        } else {
          setMenuRecurs(selection, menu.bottombarMenu, selection["interface"].menu || []);
        }
      }
      function setMenuRecurs(sel, element, items, parent) {
        items.filter(function (btn) {
          return !btn.hide || !btn.hide();
        }).forEach(function (btn, index) {
          var box = document.createElement('div');
          box.className = 'bottombar-menu-box';
          box.id = btn.id || "btn-".concat(index);
          if (typeof btn.onCreate === 'function') {
            btn.onCreate(sel, box);
          } else {
            var img = document.createElement('img');
            img.src = typeof btn.icon === 'function' ? btn.icon() : btn.icon;
            img.className = 'img';
            box.appendChild(img);
          }
          if (btn.children) {
            box.addEventListener('pointerup', function () {
              sound_lib/* sound */.s3.play('5036');
              element.textContent = '';
              controls.removeMouseBuilding();
              setMenuRecurs(sel, element, btn.children, items);
            });
          } else if (typeof btn.onClick === 'function') {
            box.addEventListener('pointerup', function (evt) {
              sound_lib/* sound */.s3.play('5036');
              btn.onClick(sel, evt);
            });
          }
          element.appendChild(box);
        });
        if (parent || sel.selected) {
          var back = document.createElement('div');
          back.className = 'bottombar-menu-box';
          var img = document.createElement('img');
          img.className = 'img';
          back.id = 'interfaceBackBtn';
          img.src = 'assets/interface/50721/010_50721.png';
          if (parent) {
            back.addEventListener('pointerup', function () {
              sound_lib/* sound */.s3.play('5036');
              element.textContent = '';
              controls.removeMouseBuilding();
              setMenuRecurs(sel, element, parent);
            });
          } else {
            back.addEventListener('pointerup', function () {
              sound_lib/* sound */.s3.play('5036');
              controls.removeMouseBuilding();
              player.unselectAll();
            });
          }
          back.appendChild(img);
          element.appendChild(back);
        }
      }
    }
  }, {
    key: "getMessage",
    value: function getMessage(cost) {
      var player = this.menu.context.player;
      var resource = Object.keys(cost).find(function (prop) {
        return player[prop] < cost[prop];
      });
      return t('needMore', {
        resource: t(resource)
      });
    }
  }, {
    key: "getUnitButton",
    value: function getUnitButton(type) {
      var _this = this;
      var menu = this.menu;
      var player = menu.context.player;
      var unit = player.config.units[type];
      return {
        id: type,
        icon: function icon() {
          return getIconPath(unit.icon);
        },
        hide: function hide() {
          return (unit.conditions || []).some(function (condition) {
            return !isValidCondition(condition, player);
          });
        },
        onCreate: function onCreate(selection, element) {
          var div = document.createElement('div');
          div.className = 'bottombar-menu-column';
          var cancel = document.createElement('img');
          cancel.id = "".concat(type, "-cancel");
          cancel.className = 'img';
          cancel.src = 'assets/interface/50721/003_50721.png';
          if (!selection.queue.some(function (q) {
            return q === type;
          })) {
            cancel.style.display = 'none';
          }
          cancel.addEventListener('pointerup', function () {
            sound_lib/* sound */.s3.play('5036');
            for (var i = 0; i < selection.queue.length; i++) {
              if (selection.queue[i] === type) {
                refundCost(player, unit.cost);
              }
            }
            menu.updateTopbar();
            selection.queue = selection.queue.filter(function (q) {
              return q !== type;
            });
            if (selection.queue[0] !== type) {
              _this.updateButtonContent(type, '');
              _this.toggleButtonCancel(type, false);
            }
          });
          var img = document.createElement('img');
          img.src = getIconPath(unit.icon);
          img.className = 'img';
          img.addEventListener('pointerup', function () {
            sound_lib/* sound */.s3.play('5036');
            if (canAfford(player, unit.cost)) {
              if (player.population >= player.population_max) {
                menu.showMessage(t('needHouses'));
              }
              _this.toggleButtonCancel(type, true);
              selection.buyUnit(type);
            } else {
              menu.showMessage(_this.getMessage(unit.cost));
            }
          });
          var queue = selection.queue.filter(function (q) {
            return q === type;
          }).length;
          var counter = document.createElement('div');
          counter.id = 'content';
          counter.textContent = queue || '';
          counter.style.padding = '1px';
          counter.style.position = 'absolute';
          div.appendChild(img);
          div.appendChild(cancel);
          element.appendChild(div);
          element.appendChild(counter);
        }
      };
    }
  }, {
    key: "getBuildingButton",
    value: function getBuildingButton(type) {
      var _this2 = this;
      var menu = this.menu;
      var _menu$context2 = menu.context,
        controls = _menu$context2.controls,
        player = _menu$context2.player;
      var config = player.config.buildings[type];
      return {
        id: type,
        icon: function icon() {
          var assets = getBuildingAsset(type, player, lib/* Assets */.sP);
          return getIconPath(assets.icon);
        },
        hide: function hide() {
          return (config.conditions || []).some(function (condition) {
            return !isValidCondition(condition, player);
          });
        },
        onClick: function onClick() {
          var assets = getBuildingAsset(type, player, lib/* Assets */.sP);
          controls.removeMouseBuilding();
          if (canAfford(player, config.cost)) {
            controls.setMouseBuilding(BottombarManager_objectSpread(BottombarManager_objectSpread(BottombarManager_objectSpread({}, config), assets), {}, {
              type: type
            }));
          } else {
            menu.showMessage(_this2.getMessage(config.cost));
          }
        }
      };
    }
  }, {
    key: "getTechnologyButton",
    value: function getTechnologyButton(type) {
      var _this3 = this;
      var menu = this.menu;
      var _menu$context3 = menu.context,
        controls = _menu$context3.controls,
        player = _menu$context3.player;
      var config = player.techs[type];
      return {
        icon: getIconPath(config.icon),
        id: type,
        hide: function hide() {
          return (config.conditions || []).some(function (condition) {
            return player.technologies.includes(type) || !isValidCondition(condition, player);
          });
        },
        onClick: function onClick(selection) {
          controls.removeMouseBuilding();
          if (canAfford(player, config.cost)) {
            selection.buyTechnology(type);
          } else {
            menu.showMessage(_this3.getMessage(config.cost));
          }
        }
      };
    }
  }]);
}();
;// ./app/classes/menu.js
function menu_typeof(o) { "@babel/helpers - typeof"; return menu_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, menu_typeof(o); }
function menu_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function menu_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, menu_toPropertyKey(o.key), o); } }
function menu_createClass(e, r, t) { return r && menu_defineProperties(e.prototype, r), t && menu_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function menu_toPropertyKey(t) { var i = menu_toPrimitive(t, "string"); return "symbol" == menu_typeof(i) ? i : i + ""; }
function menu_toPrimitive(t, r) { if ("object" != menu_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != menu_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }






var Menu = /*#__PURE__*/function () {
  function Menu(context) {
    var _this = this;
    menu_classCallCheck(this, Menu);
    this.context = context;
    this.topbar = document.createElement('div');
    this.topbar.id = 'topbar';
    this.topbar.className = 'topbar bar';
    this.icons = {
      wood: getIconPath('000_50732'),
      food: getIconPath('002_50732'),
      stone: getIconPath('001_50732'),
      gold: getIconPath('003_50732')
    };
    this.infoIcons = {
      wood: getIconPath('000_50731'),
      stone: getIconPath('001_50731'),
      food: getIconPath('002_50731'),
      gold: getIconPath('003_50731')
    };
    this.longClick = false;
    this.mouseHoldTimeout;
    this.resources = document.createElement('div');
    this.resources.className = 'topbar-resources';
    ['wood', 'food', 'stone', 'gold'].forEach(function (res) {
      _this.setResourceBox(res);
    });
    this.age = document.createElement('div');
    this.age.className = 'topbar-age';
    var options = document.createElement('div');
    options.className = 'topbar-options';
    var menu = document.createElement('div');
    menu.className = 'topbar-options-menu';
    menu.innerText = t('menuBtn');
    menu.addEventListener('pointerdown', function () {
      playClickSound();
      _this.context.pause();
      var content = document.createElement('div');
      content.className = 'modal-menu';
      var modal = new Modal(content);
      var save = document.createElement('button');
      save.className = 'menu-btn';
      save.innerText = t('save');
      save.addEventListener('pointerdown', function () {
        playClickSound();
        _this.context.save();
        modal.close();
        _this.context.resume();
      });
      var load = document.createElement('div');
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/JSON';
      input.addEventListener('change', function (evt) {
        var reader = new FileReader();
        reader.onload = function (_ref) {
          var result = _ref.target.result;
          _this.context.load(JSON.parse(result));
          modal.close();
          _this.context.resume();
        };
        reader.readAsText(evt.target.files[0]);
      });
      load.className = 'input-file menu-btn';
      load.innerText = t('load');
      load.addEventListener('pointerdown', playClickSound);
      load.appendChild(input);
      var quit = document.createElement('button');
      quit.className = 'menu-btn secondary';
      quit.innerText = t('quit');
      quit.addEventListener('pointerdown', function () {
        playClickSound();
        modal.close();
        _this.context.quit();
      });
      var cancel = document.createElement('button');
      cancel.className = 'menu-btn secondary';
      cancel.innerText = t('cancel');
      cancel.addEventListener('pointerdown', function () {
        playClickSound();
        modal.close();
        _this.context.resume();
      });
      content.appendChild(save);
      content.appendChild(load);
      content.appendChild(quit);
      content.appendChild(cancel);
    });
    options.appendChild(menu);
    this.topbar.appendChild(this.resources);
    this.topbar.appendChild(this.age);
    this.topbar.appendChild(options);
    document.body.prepend(this.topbar);
    this.bottombar = document.createElement('div');
    this.bottombar.className = 'bottombar bar';
    this.bottombarInfo = document.createElement('div');
    this.bottombarInfo.className = 'bottombar-info';
    this.bottombarMenu = document.createElement('div');
    this.bottombarMenu.className = 'bottombar-menu';
    var bottombarMapWrap = document.createElement('div');
    bottombarMapWrap.className = 'bottombar-map-wrap';
    this.bottombarMap = document.createElement('div');
    this.bottombarMap.className = 'bottombar-map';
    this.bottombarMap.addEventListener('pointerdown', function (evt) {
      var controls = _this.context.controls;
      _this.mouseHoldTimeout = setTimeout(function () {
        _this.longClick = true;
        var minimapFactor = _this.minimapManager.getMinimapFactor();
        var rect = evt.target.getBoundingClientRect();
        var x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor;
        var y = (evt.clientY - rect.top - 3) * minimapFactor;
        controls.setCamera(x, y);
      }, LONG_CLICK_DURATION);
    });
    this.bottombarMap.addEventListener('pointerup', function (evt) {
      var _player$selectedUnits;
      var _this$context = _this.context,
        player = _this$context.player,
        controls = _this$context.controls,
        map = _this$context.map;
      clearTimeout(_this.mouseHoldTimeout);
      if (controls.mouseBuilding || controls.mouseRectangle || _this.longClick) {
        _this.longClick = false;
        return;
      }
      _this.longClick = false;
      var minimapFactor = _this.minimapManager.getMinimapFactor();
      var rect = evt.target.getBoundingClientRect();
      var x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor;
      var y = (evt.clientY - rect.top - 3) * minimapFactor;
      if (player !== null && player !== void 0 && (_player$selectedUnits = player.selectedUnits) !== null && _player$selectedUnits !== void 0 && _player$selectedUnits.length) {
        var pos = isometricToCartesian(x, y);
        var i = Math.min(Math.max(pos[0], 0), map.size);
        var j = Math.min(Math.max(pos[1], 0), map.size);
        if (map.grid[i] && map.grid[i][j]) {
          controls.sendUnits(map.grid[i][j]);
        }
      } else {
        controls.setCamera(x, y);
      }
    });
    bottombarMapWrap.appendChild(this.bottombarMap);
    this.terrainMinimap = document.createElement('canvas');
    this.playersMinimap = [];
    this.resourcesMinimap = document.createElement('canvas');
    this.cameraMinimap = document.createElement('canvas');
    this.cameraMinimap.style.zIndex = 1;
    this.bottombarMap.appendChild(this.terrainMinimap);
    this.bottombarMap.appendChild(this.resourcesMinimap);
    this.bottombarMap.appendChild(this.cameraMinimap);
    this.bottombar.appendChild(this.bottombarInfo);
    this.bottombar.appendChild(this.bottombarMenu);
    this.bottombar.appendChild(bottombarMapWrap);
    document.body.appendChild(this.bottombar);
    this.toggled = false;
    this.toggle = document.createElement('div');
    this.toggle.className = 'toggle';
    this.toggle.innerText = 'x';
    this.toggle.addEventListener('pointerdown', function (evt) {
      evt.preventDefault();
      if (_this.toggled) {
        _this.toggle.innerText = 'x';
        _this.bottombar.style.display = 'grid';
        _this.toggled = false;
      } else {
        _this.bottombar.style.display = 'none';
        _this.toggle.innerText = 'o';
        _this.toggled = true;
      }
      evt.stopPropagation();
    });
    IS_MOBILE && document.body.prepend(this.toggle);
    this.minimapManager = new MinimapManager(this);
    this.bottombarManager = new BottombarManager(this);

    // Expose throttled minimap updaters as top-level properties for external callers
    this.updatePlayerMiniMap = this.minimapManager.updatePlayerMiniMap;
    this.updateResourcesMiniMap = this.minimapManager.updateResourcesMiniMap;
    this.updateCameraMiniMap = this.minimapManager.updateCameraMiniMap;
    this._infoCache = null;
    this.selection = null;
    this.updateTopbar();
  }
  return menu_createClass(Menu, [{
    key: "destroy",
    value: function destroy() {
      this.bottombar.remove();
      this.topbar.remove();
    }
  }, {
    key: "init",
    value: function init() {
      this.minimapManager.initMiniMap();
      this.updateTopbar();
    }
  }, {
    key: "setResourceBox",
    value: function setResourceBox(name) {
      var box = document.createElement('div');
      box.className = 'resource';
      var img = document.createElement('img');
      img.className = 'resource-content';
      img.src = this.icons[name];
      this[name] = document.createElement('div');
      box.appendChild(img);
      box.appendChild(this[name]);
      this.resources.appendChild(box);
    }
  }, {
    key: "updateTopbar",
    value: function updateTopbar() {
      var _this2 = this;
      var player = this.context.player;
      var ageLabels = {
        0: t('stoneAge'),
        1: t('toolAge'),
        2: t('bronzeAge'),
        3: t('ironAge')
      };
      ['wood', 'food', 'stone', 'gold', 'age'].forEach(function (prop) {
        var val = Math.min(player && player[prop] || 0, 99999);
        _this2[prop].textContent = prop === 'age' ? ageLabels[val] : val;
      });
    }
  }, {
    key: "showMessage",
    value: function showMessage(message) {
      var gamebox = this.context.gamebox;
      if (document.getElementById('msg')) {
        document.getElementById('msg').remove();
      }
      var box = document.createElement('div');
      box.id = 'msg';
      box.className = 'message';
      Object.assign(box.style, {
        bottom: this.bottombar.clientHeight + 5 + 'px'
      });
      var msg = document.createElement('span');
      msg.textContent = message;
      msg.className = 'message-content';
      box.appendChild(msg);
      gamebox.appendChild(box);
      setTimeout(function () {
        box.remove();
      }, 3000);
    }

    // Minimap delegates
  }, {
    key: "getMinimapFactor",
    value: function getMinimapFactor() {
      return this.minimapManager.getMinimapFactor();
    }
  }, {
    key: "revealTerrainMinimap",
    value: function revealTerrainMinimap() {
      return this.minimapManager.revealTerrainMinimap();
    }
  }, {
    key: "updateTerrainMiniMap",
    value: function updateTerrainMiniMap(i, j) {
      return this.minimapManager.updateTerrainMiniMap(i, j);
    }
  }, {
    key: "updateResourceMiniMap",
    value: function updateResourceMiniMap(resource) {
      return this.minimapManager.updateResourceMiniMap(resource);
    }
  }, {
    key: "updatePlayerMiniMapEvt",
    value: function updatePlayerMiniMapEvt(owner) {
      return this.minimapManager.updatePlayerMiniMapEvt(owner);
    }
  }, {
    key: "updateResourcesMiniMapEvt",
    value: function updateResourcesMiniMapEvt() {
      return this.minimapManager.updateResourcesMiniMapEvt();
    }
  }, {
    key: "updateCameraMiniMapEvt",
    value: function updateCameraMiniMapEvt() {
      return this.minimapManager.updateCameraMiniMapEvt();
    }

    // Bottombar delegates
  }, {
    key: "resetInfo",
    value: function resetInfo() {
      return this.bottombarManager.resetInfo();
    }
  }, {
    key: "generateInfo",
    value: function generateInfo(selection) {
      return this.bottombarManager.generateInfo(selection);
    }
  }, {
    key: "updateInfo",
    value: function updateInfo(target, action) {
      return this.bottombarManager.updateInfo(target, action);
    }
  }, {
    key: "updateButtonContent",
    value: function updateButtonContent(target, action) {
      return this.bottombarManager.updateButtonContent(target, action);
    }
  }, {
    key: "toggleButtonCancel",
    value: function toggleButtonCancel(target, value) {
      return this.bottombarManager.toggleButtonCancel(target, value);
    }
  }, {
    key: "updateBottombar",
    value: function updateBottombar() {
      return this.bottombarManager.updateBottombar();
    }
  }, {
    key: "setBottombar",
    value: function setBottombar(selection) {
      return this.bottombarManager.setBottombar(selection);
    }
  }, {
    key: "getMessage",
    value: function getMessage(cost) {
      return this.bottombarManager.getMessage(cost);
    }
  }, {
    key: "getUnitButton",
    value: function getUnitButton(type) {
      return this.bottombarManager.getUnitButton(type);
    }
  }, {
    key: "getBuildingButton",
    value: function getBuildingButton(type) {
      return this.bottombarManager.getBuildingButton(type);
    }
  }, {
    key: "getTechnologyButton",
    value: function getTechnologyButton(type) {
      return this.bottombarManager.getTechnologyButton(type);
    }
  }]);
}();

;// ./app/controllers/CameraController.js
function CameraController_typeof(o) { "@babel/helpers - typeof"; return CameraController_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, CameraController_typeof(o); }
function CameraController_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = CameraController_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function CameraController_slicedToArray(r, e) { return CameraController_arrayWithHoles(r) || CameraController_iterableToArrayLimit(r, e) || CameraController_unsupportedIterableToArray(r, e) || CameraController_nonIterableRest(); }
function CameraController_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function CameraController_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return CameraController_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? CameraController_arrayLikeToArray(r, a) : void 0; } }
function CameraController_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function CameraController_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function CameraController_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function CameraController_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function CameraController_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, CameraController_toPropertyKey(o.key), o); } }
function CameraController_createClass(e, r, t) { return r && CameraController_defineProperties(e.prototype, r), t && CameraController_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function CameraController_toPropertyKey(t) { var i = CameraController_toPrimitive(t, "string"); return "symbol" == CameraController_typeof(i) ? i : i + ""; }
function CameraController_toPrimitive(t, r) { if ("object" != CameraController_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != CameraController_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var CameraController = /*#__PURE__*/function () {
  function CameraController(context) {
    CameraController_classCallCheck(this, CameraController);
    this.context = context;
    this.camera = {
      x: 0,
      y: 0
    };
    this.visibleCells = new Set();
    this.moveInterval = null;
    this._rafPending = false;
  }
  return CameraController_createClass(CameraController, [{
    key: "move",
    value: function move(dir, moveSpeed, isSpeedDivided) {
      var _this = this;
      /**
       *  /A\
       * /   \
       *B     D
       * \   /
       *  \C/
       */

      var _this$context = this.context,
        map = _this$context.map,
        app = _this$context.app,
        menu = _this$context.menu;
      var dividedSpeed = isSpeedDivided ? 1.5 : 1;
      var speed = (moveSpeed || 20) / dividedSpeed;
      var A = {
        x: CELL_WIDTH / 2 - this.camera.x,
        y: -this.camera.y
      };
      var B = {
        x: CELL_WIDTH / 2 - map.size * CELL_WIDTH / 2 - this.camera.x,
        y: map.size * CELL_HEIGHT / 2 - this.camera.y
      };
      var D = {
        x: CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2 - this.camera.x,
        y: map.size * CELL_HEIGHT / 2 - this.camera.y
      };
      var C = {
        x: CELL_WIDTH / 2 - this.camera.x,
        y: map.size * CELL_HEIGHT - this.camera.y
      };
      var cameraCenter = {
        x: app.screen.width / 2,
        y: app.screen.height / 2
      };
      if (dir === 'left') {
        if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
          this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x -= speed;
        } else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
          this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x -= speed;
        } else if (cameraCenter.x - 100 > B.x) {
          this.camera.x -= speed;
        }
      } else if (dir === 'right') {
        if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
          this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x += speed;
        } else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
          this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x += speed;
        } else if (cameraCenter.x + 100 < D.x) {
          this.camera.x += speed;
        }
      }
      if (dir === 'up') {
        if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
          this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x += speed;
        } else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
          this.camera.y -= speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x -= speed;
        } else if (cameraCenter.y - 50 > A.y) {
          this.camera.y -= speed;
        }
      } else if (dir === 'down') {
        if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
          this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x -= speed;
        } else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
          this.camera.y += speed / (CELL_WIDTH / CELL_HEIGHT);
          this.camera.x += speed;
        } else if (cameraCenter.y + 100 < C.y) {
          this.camera.y += speed;
        }
      }
      menu.updateCameraMiniMap();
      map.setCoordinate(-this.camera.x, -this.camera.y);
      if (!this._rafPending) {
        this._rafPending = true;
        requestAnimationFrame(function () {
          _this._rafPending = false;
          _this.updateVisibleCells();
        });
      }
    }
  }, {
    key: "moveWithMouse",
    value: function moveWithMouse(evt) {
      var _this2 = this;
      this.stopMouseMove();
      var dir = [];
      var mouse = {
        x: evt.pageX,
        y: evt.pageY
      };
      var coef = 1;
      var moveDist = 10;
      var calcs = {
        left: (0 + moveDist - mouse.x) * coef,
        right: (mouse.x - (window.innerWidth - moveDist)) * coef,
        up: (0 + moveDist - mouse.y) * coef,
        down: (mouse.y - (window.innerHeight - moveDist)) * coef
      };
      if (mouse.x >= 0 && mouse.x <= 0 + moveDist && mouse.y >= 0 && mouse.y <= window.innerHeight) {
        dir.push('left');
      } else if (mouse.x > window.innerWidth - moveDist && mouse.x <= window.innerWidth && mouse.y >= 0 && mouse.y <= window.innerHeight) {
        dir.push('right');
      }
      if (mouse.x >= 0 && mouse.x <= window.innerWidth && mouse.y >= 0 && mouse.y <= 0 + moveDist) {
        dir.push('up');
      } else if (mouse.x >= 0 && mouse.x <= window.innerWidth && mouse.y > window.innerHeight - moveDist && mouse.y <= window.innerHeight) {
        dir.push('down');
      }
      if (dir.length) {
        this.moveInterval = setInterval(function () {
          dir.forEach(function (prop) {
            _this2.move(prop, calcs[prop]);
          });
        }, 20);
      }
    }
  }, {
    key: "stopMouseMove",
    value: function stopMouseMove() {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }, {
    key: "instanceInCamera",
    value: function instanceInCamera(instance) {
      var app = this.context.app;
      return pointInRectangle(instance.x, instance.y, this.camera.x, this.camera.y, app.screen.width, app.screen.height);
    }
  }, {
    key: "getCellOnCamera",
    value: function getCellOnCamera(callback) {
      var _this$context2 = this.context,
        map = _this$context2.map,
        app = _this$context2.app;
      var cameraFloor = {
        x: Math.floor(this.camera.x),
        y: Math.floor(this.camera.y)
      };
      var margin = CELL_WIDTH;
      for (var i = cameraFloor.x - margin; i <= cameraFloor.x + app.screen.width + margin; i += CELL_WIDTH / 2) {
        for (var j = cameraFloor.y - margin; j <= cameraFloor.y + app.screen.height + margin; j += CELL_HEIGHT / 2) {
          var _isometricToCartesian = isometricToCartesian(i, j),
            _isometricToCartesian2 = CameraController_slicedToArray(_isometricToCartesian, 2),
            cartesianX = _isometricToCartesian2[0],
            cartesianY = _isometricToCartesian2[1];
          var x = Math.min(Math.max(cartesianX, 0), map.size - 1);
          var y = Math.min(Math.max(cartesianY, 0), map.size - 1);
          if (map.grid[x] && map.grid[x][y]) {
            callback(map.grid[x][y]);
          }
        }
      }
    }
  }, {
    key: "updateVisibleCells",
    value: function updateVisibleCells() {
      var _this$context3 = this.context,
        map = _this$context3.map,
        app = _this$context3.app;
      var newVisible = new Set();
      var margin = CELL_WIDTH;
      var startX = Math.floor(this.camera.x - margin);
      var endX = Math.floor(this.camera.x + app.screen.width + margin);
      var startY = Math.floor(this.camera.y - margin);
      var endY = Math.floor(this.camera.y + app.screen.height + margin);
      for (var i = startX; i <= endX; i += CELL_WIDTH / 2) {
        for (var j = startY; j <= endY; j += CELL_HEIGHT / 2) {
          var _map$grid$x;
          var _isometricToCartesian3 = isometricToCartesian(i, j),
            _isometricToCartesian4 = CameraController_slicedToArray(_isometricToCartesian3, 2),
            cartX = _isometricToCartesian4[0],
            cartY = _isometricToCartesian4[1];
          var x = Math.min(Math.max(cartX, 0), map.size - 1);
          var y = Math.min(Math.max(cartY, 0), map.size - 1);
          var cell = (_map$grid$x = map.grid[x]) === null || _map$grid$x === void 0 ? void 0 : _map$grid$x[y];
          if (cell) {
            newVisible.add(cell);
          }
        }
      }
      var _iterator = CameraController_createForOfIteratorHelper(this.visibleCells),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _cell = _step.value;
          if (!newVisible.has(_cell)) {
            if (_cell.has) _cell.has.visible = false;
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      var _iterator2 = CameraController_createForOfIteratorHelper(newVisible),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _cell2 = _step2.value;
          if (!this.visibleCells.has(_cell2)) {
            _cell2.updateVisible();
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
      this.visibleCells = newVisible;
    }
  }, {
    key: "set",
    value: function set(x, y, direct) {
      var _this$context4 = this.context,
        map = _this$context4.map,
        app = _this$context4.app,
        menu = _this$context4.menu;
      this.camera = {
        x: direct ? x : x - app.screen.width / 2,
        y: direct ? y : y - app.screen.height / 2
      };
      menu && menu.updateCameraMiniMap();
      map.setCoordinate(-this.camera.x, -this.camera.y);
      this.updateVisibleCells();
    }
  }]);
}();
;// ./app/controllers/BuildingPlacer.js
function BuildingPlacer_typeof(o) { "@babel/helpers - typeof"; return BuildingPlacer_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, BuildingPlacer_typeof(o); }
function BuildingPlacer_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function BuildingPlacer_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, BuildingPlacer_toPropertyKey(o.key), o); } }
function BuildingPlacer_createClass(e, r, t) { return r && BuildingPlacer_defineProperties(e.prototype, r), t && BuildingPlacer_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function BuildingPlacer_toPropertyKey(t) { var i = BuildingPlacer_toPrimitive(t, "string"); return "symbol" == BuildingPlacer_typeof(i) ? i : i + ""; }
function BuildingPlacer_toPrimitive(t, r) { if ("object" != BuildingPlacer_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != BuildingPlacer_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }



var BuildingPlacer = /*#__PURE__*/function () {
  function BuildingPlacer(controls) {
    BuildingPlacer_classCallCheck(this, BuildingPlacer);
    this.controls = controls;
  }
  return BuildingPlacer_createClass(BuildingPlacer, [{
    key: "handleMouseMove",
    value: function handleMouseMove() {
      var controls = this.controls;
      var _controls$context = controls.context,
        map = _controls$context.map,
        app = _controls$context.app;
      var pos = isometricToCartesian(controls.mouse.x - map.x, controls.mouse.y >= app.screen.height ? app.screen.height - map.y : controls.mouse.y - map.y);
      var i = Math.min(Math.max(pos[0], 0), map.size);
      var j = Math.min(Math.max(pos[1], 0), map.size);
      if (!map.grid[i] || !map.grid[i][j]) return;
      var cell = map.grid[i][j];
      controls.mouseBuilding.x = cell.x - controls.camera.x;
      controls.mouseBuilding.y = cell.y - controls.camera.y;
      var isFree = true;
      var dist = controls.mouseBuilding.size === 3 ? 1 : 0;
      if (controls.mouseBuilding.buildOnWater) {
        var waterBorderedCells = 0;
        var waterCells = 0;
        grid_getPlainCellsAroundPoint(i, j, map.grid, dist, function (c) {
          if (c.inclined || c.solid || !c.visible) {
            isFree = false;
            return;
          }
          if (c.waterBorder) waterBorderedCells++;else if (c.category === 'Water') waterCells++;
        });
        if (waterBorderedCells < 2 && waterCells < 4) isFree = false;
      } else {
        grid_getPlainCellsAroundPoint(i, j, map.grid, dist, function (c) {
          if (c.category === 'Water' || c.solid || c.inclined || c.border || !c.visible) {
            isFree = false;
          }
        });
      }
      var sprite = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.sprite);
      var color = controls.mouseBuilding.getChildByLabel(LABEL_TYPES.color);
      var tint = isFree ? COLOR_WHITE : COLOR_RED;
      sprite.tint = tint;
      if (color) color.tint = tint;
      controls.mouseBuilding.isFree = isFree;
    }
  }, {
    key: "handleMouseUp",
    value: function handleMouseUp(cell) {
      var controls = this.controls;
      var _controls$context2 = controls.context,
        menu = _controls$context2.menu,
        player = _controls$context2.player;
      if (cell.inclined || cell.border) return;
      if (controls.mouseBuilding.isFree) {
        if (player.buyBuilding(cell.i, cell.j, controls.mouseBuilding.type)) {
          controls.removeMouseBuilding();
          if (menu.selection) {
            menu.setBottombar(menu.selection);
          }
        }
      }
    }
  }, {
    key: "setMouseBuilding",
    value: function setMouseBuilding(building) {
      var controls = this.controls;
      var player = controls.context.player;
      controls.mouseBuilding = new lib/* Container */.mcf();
      var sprite = lib/* Sprite */.kxk.from(getTexture(building.images["final"], lib/* Assets */.sP));
      sprite.label = LABEL_TYPES.sprite;
      controls.mouseBuilding.addChild(sprite);
      Object.keys(building).forEach(function (prop) {
        controls.mouseBuilding[prop] = building[prop];
      });
      controls.mouseBuilding.x = controls.mouse.x;
      controls.mouseBuilding.y = controls.mouse.y;
      controls.mouseBuilding.label = LABEL_TYPES.mouseBuilding;
      if (building.images.color) {
        var color = lib/* Sprite */.kxk.from(getTexture(building.images.color, lib/* Assets */.sP));
        color.label = LABEL_TYPES.color;
        changeSpriteColor(color, player.color);
        controls.mouseBuilding.addChild(color);
      } else {
        changeSpriteColor(sprite, player.color);
      }
      controls.addChild(controls.mouseBuilding);
    }
  }, {
    key: "removeMouseBuilding",
    value: function removeMouseBuilding() {
      var controls = this.controls;
      if (!controls.mouseBuilding) return;
      controls.removeChild(controls.mouseBuilding);
      controls.mouseBuilding.destroy();
      controls.mouseBuilding = null;
    }
  }]);
}();
;// ./app/controllers/SelectionManager.js
function SelectionManager_typeof(o) { "@babel/helpers - typeof"; return SelectionManager_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, SelectionManager_typeof(o); }
function SelectionManager_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function SelectionManager_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, SelectionManager_toPropertyKey(o.key), o); } }
function SelectionManager_createClass(e, r, t) { return r && SelectionManager_defineProperties(e.prototype, r), t && SelectionManager_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function SelectionManager_toPropertyKey(t) { var i = SelectionManager_toPrimitive(t, "string"); return "symbol" == SelectionManager_typeof(i) ? i : i + ""; }
function SelectionManager_toPrimitive(t, r) { if ("object" != SelectionManager_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != SelectionManager_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }




var SelectionManager = /*#__PURE__*/function () {
  function SelectionManager(controls) {
    SelectionManager_classCallCheck(this, SelectionManager);
    this.controls = controls;
  }
  return SelectionManager_createClass(SelectionManager, [{
    key: "handleMouseMove",
    value: function handleMouseMove() {
      var controls = this.controls;
      var _controls$context = controls.context,
        player = _controls$context.player,
        app = _controls$context.app;
      if (!controls.mouseRectangle && controls.pointerStart && pointsDistance(controls.mouse.x, controls.mouse.y, controls.pointerStart.x, controls.pointerStart.y) > 5) {
        controls.mouseRectangle = {
          x: controls.pointerStart.x,
          y: controls.pointerStart.y,
          width: 0,
          height: 0,
          graph: new lib/* Graphics */.A1g()
        };
        app.stage.addChild(controls.mouseRectangle.graph);
      }
      if (controls.mouseRectangle) {
        if (player.selectedUnits.length || player.selectedBuilding) {
          player.unselectAll();
        }
        var graph = controls.mouseRectangle.graph;
        graph.clear();
        controls.mouseRectangle.width = controls.mouse.x - controls.mouseRectangle.x;
        controls.mouseRectangle.height = controls.mouse.y - controls.mouseRectangle.y;
        var x = Math.min(controls.mouseRectangle.x, controls.mouseRectangle.x + controls.mouseRectangle.width);
        var y = Math.min(controls.mouseRectangle.y, controls.mouseRectangle.y + controls.mouseRectangle.height);
        var w = Math.abs(controls.mouseRectangle.width);
        var h = Math.abs(controls.mouseRectangle.height);
        graph.rect(x, y, w, h).stroke(COLOR_WHITE);
      }
    }
  }, {
    key: "handleMouseUp",
    value: function handleMouseUp() {
      var controls = this.controls;
      var _controls$context2 = controls.context,
        menu = _controls$context2.menu,
        player = _controls$context2.player;
      var selectVillager;
      var countSelect = 0;
      player.unselectAll();
      for (var i = 0; i < player.units.length; i++) {
        var unit = player.units[i];
        if (player.selectedUnits.length < MAX_SELECT_UNITS && pointInRectangle(unit.x - controls.camera.x, unit.y - controls.camera.y, controls.mouseRectangle.x, controls.mouseRectangle.y, controls.mouseRectangle.width, controls.mouseRectangle.height, true)) {
          unit.select();
          countSelect++;
          if (unit.type === UNIT_TYPES.villager) selectVillager = unit;
          player.selectedUnits.push(unit);
        }
      }
      if (countSelect) {
        if (selectVillager) {
          player.selectedUnit = selectVillager;
          menu.setBottombar(selectVillager);
        } else {
          // TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
          player.selectedUnit = player.selectedUnits[0];
          menu.setBottombar(player.selectedUnits[0]);
        }
      }
      if (controls.mouseRectangle) {
        controls.mouseRectangle.graph.destroy(true);
        controls.mouseRectangle = null;
      }
    }
  }, {
    key: "handleClick",
    value: function handleClick(cell) {
      var controls = this.controls;
      var pointerSheet = lib/* Assets */.sP.cache.get('50405');
      var pointer = new lib/* AnimatedSprite */.Dl5(pointerSheet.animations['animation']);
      pointer.animationSpeed = 0.2 * ACCELERATOR;
      pointer.loop = false;
      pointer.anchor.set(0.5, 0.5);
      pointer.x = controls.mouse.x;
      pointer.y = controls.mouse.y;
      pointer.allowMove = false;
      pointer.allowClick = false;
      pointer.eventMode = 'auto';
      pointer.roundPixels = true;
      pointer.onComplete = function () {
        pointer.destroy();
      };
      pointer.play();
      controls.addChild(pointer);
      this.sendUnits(cell);
    }
  }, {
    key: "sendUnits",
    value: function sendUnits(cell) {
      var controls = this.controls;
      var _controls$context3 = controls.context,
        player = _controls$context3.player,
        map = _controls$context3.map;
      var minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (var k = 0; k < player.selectedUnits.length; k++) {
        var _player$selectedUnits = player.selectedUnits[k],
          i = _player$selectedUnits.i,
          j = _player$selectedUnits.j;
        if (i < minX) minX = i;
        if (j < minY) minY = j;
        if (i > maxX) maxX = i;
        if (j > maxY) maxY = j;
      }
      var centerX = minX + Math.round((maxX - minX) / 2);
      var centerY = minY + Math.round((maxY - minY) / 2);
      var hasSentVillager = false;
      var hasSentSoldier = false;
      for (var u = 0; u < player.selectedUnits.length; u++) {
        var unit = player.selectedUnits[u];
        var finalX = cell.i + (unit.i - centerX);
        var finalY = cell.j + (unit.j - centerY);
        if (unit.type === UNIT_TYPES.villager) hasSentVillager = true;else hasSentSoldier = true;
        if (map.grid[finalX] && map.grid[finalX][finalY]) {
          player.selectedUnits[u].sendTo(map.grid[finalX][finalY]);
        } else {
          player.selectedUnits[u].sendTo(cell);
        }
      }
      if (hasSentSoldier) {
        sound_lib/* sound */.s3.play(maths_randomItem(['5075', '5076', '5128', '5164']));
      } else if (hasSentVillager) {
        sound_lib/* sound */.s3.play('5006');
      }
    }
  }]);
}();
;// ./app/classes/controls.js
function controls_typeof(o) { "@babel/helpers - typeof"; return controls_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, controls_typeof(o); }
function controls_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function controls_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, controls_toPropertyKey(o.key), o); } }
function controls_createClass(e, r, t) { return r && controls_defineProperties(e.prototype, r), t && controls_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function controls_toPropertyKey(t) { var i = controls_toPrimitive(t, "string"); return "symbol" == controls_typeof(i) ? i : i + ""; }
function controls_toPrimitive(t, r) { if ("object" != controls_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != controls_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function controls_callSuper(t, o, e) { return o = controls_getPrototypeOf(o), controls_possibleConstructorReturn(t, controls_isNativeReflectConstruct() ? Reflect.construct(o, e || [], controls_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function controls_possibleConstructorReturn(t, e) { if (e && ("object" == controls_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return controls_assertThisInitialized(t); }
function controls_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function controls_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (controls_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function controls_getPrototypeOf(t) { return controls_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, controls_getPrototypeOf(t); }
function controls_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && controls_setPrototypeOf(t, e); }
function controls_setPrototypeOf(t, e) { return controls_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, controls_setPrototypeOf(t, e); }





var ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp']);
var Controls = /*#__PURE__*/function (_Container) {
  function Controls(context) {
    var _this;
    controls_classCallCheck(this, Controls);
    _this = controls_callSuper(this, Controls);
    _this.context = context;
    var map = context.map,
      gamebox = context.gamebox;
    _this.sortableChildren = true;
    _this.mouse = {
      x: 0,
      y: 0,
      prevent: false
    };
    _this.cameraController = new CameraController(context);
    _this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2));
    _this.mouseHoldTimeout;
    _this.keysPressed = {};
    _this.keyPressedCount = 0;
    _this.keyInterval;
    _this.keySpeed = 0;
    _this.eventMode = 'auto';
    _this.allowMove = false;
    _this.allowClick = false;
    _this.mouseRectangle;
    _this.mouseTouch;
    _this.mouseDrag = false;
    _this.minimapRectangle = new lib/* Graphics */.A1g();
    _this.addChild(_this.minimapRectangle);
    _this.fpsVisible = false;
    _this.fpsEl = document.createElement('div');
    _this.fpsEl.style.cssText = 'position:fixed;right:10px;z-index:9999;color:#fff;font:bold 14px monospace;' + 'background:rgba(0,0,0,0.65);padding:2px 8px;border-radius:3px;display:none;pointer-events:none;';
    document.body.appendChild(_this.fpsEl);
    _this._fpsTicker = function () {
      if (_this.fpsVisible) {
        _this.fpsEl.textContent = "FPS: ".concat(Math.round(context.app.ticker.FPS));
      }
    };
    context.app.ticker.add(_this._fpsTicker);
    _this.buildingPlacer = new BuildingPlacer(_this);
    _this.selectionManager = new SelectionManager(_this);
    _this._onDocMouseMove = function (evt) {
      return _this.moveCameraWithMouse(evt);
    };
    _this._onDocMouseOut = function () {
      return _this.stopMouseCameraMove();
    };
    _this._onKeyDown = function (evt) {
      return _this.onKeyDown(evt);
    };
    _this._onKeyUp = function (evt) {
      return _this.onKeyUp(evt);
    };
    _this._onTouchStart = function (evt) {
      return _this.onTouchStart(evt);
    };
    _this._onTouchEnd = function (evt) {
      return _this.onTouchEnd(evt);
    };
    _this._onTouchMove = function (evt) {
      return _this.onTouchMove(evt);
    };
    _this._onMouseMove = function (evt) {
      return _this.onMouseMove(evt);
    };
    _this._onMouseDown = function (evt) {
      return _this.onMouseDown(evt);
    };
    _this._onMouseUp = function (evt) {
      return _this.onMouseUp(evt);
    };
    document.addEventListener('mousemove', _this._onDocMouseMove);
    document.addEventListener('mouseout', _this._onDocMouseOut);
    document.addEventListener('keydown', _this._onKeyDown);
    document.addEventListener('keyup', _this._onKeyUp);
    gamebox.addEventListener('touchstart', _this._onTouchStart);
    gamebox.addEventListener('touchend', _this._onTouchEnd);
    gamebox.addEventListener('touchmove', _this._onTouchMove);
    gamebox.addEventListener('mousemove', _this._onMouseMove);
    gamebox.addEventListener('mousedown', _this._onMouseDown);
    gamebox.addEventListener('mouseup', _this._onMouseUp);
    return _this;
  }
  controls_inherits(Controls, _Container);
  return controls_createClass(Controls, [{
    key: "destroy",
    value: function destroy() {
      var gamebox = this.context.gamebox;
      this.context.app.ticker.remove(this._fpsTicker);
      this.fpsEl.remove();
      document.removeEventListener('mousemove', this._onDocMouseMove);
      document.removeEventListener('mouseout', this._onDocMouseOut);
      document.removeEventListener('keydown', this._onKeyDown);
      document.removeEventListener('keyup', this._onKeyUp);
      gamebox.removeEventListener('touchstart', this._onTouchStart);
      gamebox.removeEventListener('touchend', this._onTouchEnd);
      gamebox.removeEventListener('touchmove', this._onTouchMove);
      gamebox.removeEventListener('mousemove', this._onMouseMove);
      gamebox.removeEventListener('mousedown', this._onMouseDown);
      gamebox.removeEventListener('mouseup', this._onMouseUp);
      this.stopMouseCameraMove();
    }
  }, {
    key: "camera",
    get: function get() {
      return this.cameraController.camera;
    }
  }, {
    key: "onKeyDown",
    value: function onKeyDown(evt) {
      var _this2 = this;
      if (evt.key === 'f' || evt.key === 'F') {
        this.fpsVisible = !this.fpsVisible;
        this.fpsEl.style.display = this.fpsVisible ? 'block' : 'none';
        return;
      }
      if (evt.key === 'Delete' || evt.keyCode === 8) {
        var player = this.context.player;
        for (var i = 0; i < player.selectedUnits.length; i++) {
          player.selectedUnits[i].die();
        }
        if (player.selectedBuilding) {
          player.selectedBuilding.die();
        }
        return;
      }
      var handleMoveCamera = function handleMoveCamera() {
        if (!_this2.keyInterval) {
          _this2.keyInterval = setInterval(function () {
            var _double = _this2.keyPressedCount > 1;
            if (_this2.keySpeed < 4) {
              _this2.keySpeed += 0.2;
            }
            if (_this2.keysPressed['ArrowLeft']) _this2.moveCamera('left', _this2.keySpeed, _double);
            if (_this2.keysPressed['ArrowUp']) _this2.moveCamera('up', _this2.keySpeed, _double);
            if (_this2.keysPressed['ArrowDown']) _this2.moveCamera('down', _this2.keySpeed, _double);
            if (_this2.keysPressed['ArrowRight']) _this2.moveCamera('right', _this2.keySpeed, _double);
          }, 1);
        }
      };
      if (!evt.repeat) {
        this.keysPressed[evt.key] = true;
        this.keyPressedCount++;
      }
      if (ARROW_KEYS.has(evt.key)) {
        handleMoveCamera();
      }
    }
  }, {
    key: "onKeyUp",
    value: function onKeyUp(evt) {
      if (!evt.repeat && this.keysPressed[evt.key]) {
        delete this.keysPressed[evt.key];
        this.keyPressedCount--;
      }
      if (this.keyPressedCount <= 0) {
        this.keyPressedCount = 0;
        clearInterval(this.keyInterval);
        this.keyInterval = null;
        this.keySpeed = 0;
      }
    }
  }, {
    key: "onTouchStart",
    value: function onTouchStart(evt) {
      var touch = evt.touches[0];
      if (evt.touches.length === 2) {
        this.mouseTouch = {
          x: touch.pageX,
          y: touch.pageY
        };
      } else {
        this.onMouseDown(touch);
      }
    }
  }, {
    key: "onTouchMove",
    value: function onTouchMove(evt) {
      var touch = evt.touches[0];
      if (evt.touches.length === 2) {
        this.mouse.x = touch.pageX;
        this.mouse.y = touch.pageY;
        if (this.mouseTouch) {
          var speedX = Math.abs(this.mouse.x - this.mouseTouch.x) * 2;
          var speedY = Math.abs(this.mouse.y - this.mouseTouch.y) * 2;
          if (this.mouse.x > this.mouseTouch.x) this.moveCamera('left', speedX, false);
          if (this.mouse.y > this.mouseTouch.y) this.moveCamera('up', speedY, false);
          if (this.mouse.y < this.mouseTouch.y) this.moveCamera('down', speedY, false);
          if (this.mouse.x < this.mouseTouch.x) this.moveCamera('right', speedX, false);
        }
        this.mouseTouch = {
          x: this.mouse.x,
          y: this.mouse.y
        };
      } else {
        this.onMouseMove(touch);
      }
    }
  }, {
    key: "onTouchEnd",
    value: function onTouchEnd(evt) {
      var touch = evt.changedTouches[0];
      if (evt.changedTouches.length === 1) {
        this.onMouseUp(touch);
      }
    }
  }, {
    key: "onMouseDown",
    value: function onMouseDown(evt) {
      this.mouse.x = evt.pageX;
      this.mouse.y = evt.pageY;
      if (!this.isMouseInApp(evt)) return;
      this.pointerStart = {
        x: this.mouse.x,
        y: this.mouse.y
      };
    }
  }, {
    key: "onMouseMove",
    value: function onMouseMove(evt) {
      this.mouse.x = evt.pageX;
      this.mouse.y = evt.pageY;
      if (this.mouseBuilding) {
        this.buildingPlacer.handleMouseMove();
        return;
      }
      this.selectionManager.handleMouseMove();
    }
  }, {
    key: "onMouseUp",
    value: function onMouseUp(evt) {
      var _this$context = this.context,
        map = _this$context.map,
        player = _this$context.player;
      this.pointerStart = null;
      clearTimeout(this.mouseHoldTimeout);
      if (!this.isMouseInApp(evt) || this.mouse.prevent || this.mouseDrag) {
        this.mouse.prevent = false;
        return;
      }
      (player === null || player === void 0 ? void 0 : player.selectedBuilding) && player.unselectAll();
      if (this.mouseRectangle) {
        this.selectionManager.handleMouseUp();
        return;
      }
      if (this.isMouseInApp(evt)) {
        var pos = isometricToCartesian(this.mouse.x - map.x, this.mouse.y - map.y);
        var i = Math.min(Math.max(pos[0], 0), map.size);
        var j = Math.min(Math.max(pos[1], 0), map.size);
        if (map.grid[i] && map.grid[i][j]) {
          var cell = map.grid[i][j];
          if ((cell.solid || cell.has) && cell.visible) return;
          if (this.mouseBuilding) {
            this.buildingPlacer.handleMouseUp(cell);
          } else if (player !== null && player !== void 0 && player.selectedUnits.length) {
            this.selectionManager.handleClick(cell);
          }
        }
      }
    }
  }, {
    key: "sendUnits",
    value: function sendUnits(cell) {
      return this.selectionManager.sendUnits(cell);
    }
  }, {
    key: "isMouseInApp",
    value: function isMouseInApp(evt) {
      return evt.target && (!evt.target.tagName || evt.target.closest('#game'));
    }
  }, {
    key: "removeMouseBuilding",
    value: function removeMouseBuilding() {
      return this.buildingPlacer.removeMouseBuilding();
    }
  }, {
    key: "setMouseBuilding",
    value: function setMouseBuilding(building) {
      return this.buildingPlacer.setMouseBuilding(building);
    }
  }, {
    key: "moveCamera",
    value: function moveCamera(dir, moveSpeed, isSpeedDivided) {
      this.cameraController.move(dir, moveSpeed, isSpeedDivided);
    }
  }, {
    key: "moveCameraWithMouse",
    value: function moveCameraWithMouse(evt) {
      this.cameraController.moveWithMouse(evt);
    }
  }, {
    key: "stopMouseCameraMove",
    value: function stopMouseCameraMove() {
      this.cameraController.stopMouseMove();
    }
  }, {
    key: "instanceInCamera",
    value: function instanceInCamera(instance) {
      return this.cameraController.instanceInCamera(instance);
    }
  }, {
    key: "getCellOnCamera",
    value: function getCellOnCamera(callback) {
      this.cameraController.getCellOnCamera(callback);
    }
  }, {
    key: "updateVisibleCells",
    value: function updateVisibleCells() {
      this.cameraController.updateVisibleCells();
    }
  }, {
    key: "init",
    value: function init() {
      var _player$buildings, _player$units;
      var _this$context2 = this.context,
        player = _this$context2.player,
        map = _this$context2.map;
      var topbar = document.getElementById('topbar');
      this.fpsEl.style.top = (topbar ? topbar.clientHeight + 5 : 50) + 'px';
      if (player !== null && player !== void 0 && (_player$buildings = player.buildings) !== null && _player$buildings !== void 0 && _player$buildings.length) {
        this.setCamera(player.buildings[0].x, player.buildings[0].y);
      } else if (player !== null && player !== void 0 && (_player$units = player.units) !== null && _player$units !== void 0 && _player$units.length) {
        this.setCamera(player.units[0].x, player.units[0].y);
      } else {
        this.setCamera(map.size / 2, map.size / 2);
      }
    }
  }, {
    key: "setCamera",
    value: function setCamera(x, y, direct) {
      this.cameraController.set(x, y, direct);
    }
  }]);
}(lib/* Container */.mcf);

;// ./app/lib/ActionScheduler.js
function ActionScheduler_typeof(o) { "@babel/helpers - typeof"; return ActionScheduler_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, ActionScheduler_typeof(o); }
function ActionScheduler_slicedToArray(r, e) { return ActionScheduler_arrayWithHoles(r) || ActionScheduler_iterableToArrayLimit(r, e) || ActionScheduler_unsupportedIterableToArray(r, e) || ActionScheduler_nonIterableRest(); }
function ActionScheduler_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function ActionScheduler_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function ActionScheduler_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ActionScheduler_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = ActionScheduler_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function ActionScheduler_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return ActionScheduler_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? ActionScheduler_arrayLikeToArray(r, a) : void 0; } }
function ActionScheduler_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ActionScheduler_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function ActionScheduler_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, ActionScheduler_toPropertyKey(o.key), o); } }
function ActionScheduler_createClass(e, r, t) { return r && ActionScheduler_defineProperties(e.prototype, r), t && ActionScheduler_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function ActionScheduler_toPropertyKey(t) { var i = ActionScheduler_toPrimitive(t, "string"); return "symbol" == ActionScheduler_typeof(i) ? i : i + ""; }
function ActionScheduler_toPrimitive(t, r) { if ("object" != ActionScheduler_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != ActionScheduler_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
var ActionScheduler = /*#__PURE__*/function () {
  function ActionScheduler(app, getPaused) {
    var _this = this;
    ActionScheduler_classCallCheck(this, ActionScheduler);
    this._getPaused = getPaused;
    this._tasks = new Map();
    this._nextId = 1;
    this._toRemove = [];
    app.ticker.add(function (ticker) {
      return _this._tick(ticker.deltaMS);
    });
  }
  return ActionScheduler_createClass(ActionScheduler, [{
    key: "add",
    value: function add(callback, intervalMs) {
      var id = this._nextId++;
      this._tasks.set(id, {
        callback: callback,
        interval: intervalMs,
        elapsed: 0
      });
      return id;
    }
  }, {
    key: "addOneShot",
    value: function addOneShot(callback, delayMs) {
      var id = this._nextId++;
      this._tasks.set(id, {
        callback: callback,
        interval: delayMs,
        elapsed: 0,
        oneShot: true
      });
      return id;
    }
  }, {
    key: "remove",
    value: function remove(id) {
      this._tasks["delete"](id);
    }
  }, {
    key: "update",
    value: function update(id, intervalMs) {
      var task = this._tasks.get(id);
      if (task) task.interval = intervalMs;
    }
  }, {
    key: "_tick",
    value: function _tick(deltaMS) {
      if (this._getPaused()) return;
      this._toRemove.length = 0;
      var _iterator = ActionScheduler_createForOfIteratorHelper(this._tasks),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _step$value = ActionScheduler_slicedToArray(_step.value, 2),
            id = _step$value[0],
            task = _step$value[1];
          task.elapsed += deltaMS;
          if (task.elapsed >= task.interval) {
            task.elapsed -= task.interval;
            task.callback();
            if (task.oneShot) this._toRemove.push(id);
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      var _iterator2 = ActionScheduler_createForOfIteratorHelper(this._toRemove),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _id = _step2.value;
          this._tasks["delete"](_id);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
  }]);
}();
;// ./app/serialization/SaveSerializer.js
function SaveSerializer_typeof(o) { "@babel/helpers - typeof"; return SaveSerializer_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, SaveSerializer_typeof(o); }
function SaveSerializer_toConsumableArray(r) { return SaveSerializer_arrayWithoutHoles(r) || SaveSerializer_iterableToArray(r) || SaveSerializer_unsupportedIterableToArray(r) || SaveSerializer_nonIterableSpread(); }
function SaveSerializer_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function SaveSerializer_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return SaveSerializer_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? SaveSerializer_arrayLikeToArray(r, a) : void 0; } }
function SaveSerializer_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function SaveSerializer_arrayWithoutHoles(r) { if (Array.isArray(r)) return SaveSerializer_arrayLikeToArray(r); }
function SaveSerializer_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function SaveSerializer_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function SaveSerializer_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? SaveSerializer_ownKeys(Object(t), !0).forEach(function (r) { SaveSerializer_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : SaveSerializer_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function SaveSerializer_defineProperty(e, r, t) { return (r = SaveSerializer_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function SaveSerializer_toPropertyKey(t) { var i = SaveSerializer_toPrimitive(t, "string"); return "symbol" == SaveSerializer_typeof(i) ? i : i + ""; }
function SaveSerializer_toPrimitive(t, r) { if ("object" != SaveSerializer_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != SaveSerializer_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }

function resourceData(resource) {
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(resource, ['label', 'i', 'j', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints'])), {}, {
    textureName: (resource.textureName || '').split('.')[0]
  });
}
function animalData(animal) {
  var _animal$sprite, _animal$sprite2, _animal$dest, _animal$previousDest;
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(animal, ['label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest', 'zIndex', 'degree', 'action', 'direction', 'currentSheet', 'size', 'inactif', 'isDead', 'isDestroyed', 'quantity'])), {}, {
    currentFrame: (_animal$sprite = animal.sprite) === null || _animal$sprite === void 0 ? void 0 : _animal$sprite.currentFrame,
    loop: (_animal$sprite2 = animal.sprite) === null || _animal$sprite2 === void 0 ? void 0 : _animal$sprite2.loop,
    dest: animal.dest && [animal.dest.i, animal.dest.j, (_animal$dest = animal.dest) === null || _animal$dest === void 0 ? void 0 : _animal$dest.label],
    previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.j, (_animal$previousDest = animal.previousDest) === null || _animal$previousDest === void 0 ? void 0 : _animal$previousDest.label]
  });
}
function unitData(unit) {
  var _unit$sprite, _unit$sprite2, _unit$dest, _unit$previousDest;
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(unit, ['label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest', 'degree', 'action', 'loading', 'loadingType', 'direction', 'currentSheet', 'size', 'inactif', 'isDead', 'isDestroyed'])), {}, {
    currentFrame: (_unit$sprite = unit.sprite) === null || _unit$sprite === void 0 ? void 0 : _unit$sprite.currentFrame,
    loop: (_unit$sprite2 = unit.sprite) === null || _unit$sprite2 === void 0 ? void 0 : _unit$sprite2.loop,
    dest: unit.dest && [unit.dest.i, unit.dest.j, (_unit$dest = unit.dest) === null || _unit$dest === void 0 ? void 0 : _unit$dest.label],
    previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.j, (_unit$previousDest = unit.previousDest) === null || _unit$previousDest === void 0 ? void 0 : _unit$previousDest.label]
  });
}
function buildingData(building) {
  var _building$isUsedBy;
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(building, ['label', 'i', 'j', 'type', 'queue', 'technology', 'loading', 'isDead', 'isDestroyed', 'isBuilt', 'hitPoints', 'quantity'])), {}, {
    isUsedBy: (_building$isUsedBy = building.isUsedBy) === null || _building$isUsedBy === void 0 ? void 0 : _building$isUsedBy.label
  });
}
function playerData(player) {
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(player, ['label', 'age', 'type', 'wood', 'food', 'stone', 'gold', 'civ', 'color', 'population', 'population_max', 'technologies', 'cellViewed', 'isPlayed', 'hasBuilt'])), {}, {
    buildings: player.buildings.map(function (b) {
      return buildingData(b);
    }),
    units: player.units.map(function (u) {
      return unitData(u);
    }),
    corpses: player.corpses.map(function (c) {
      return unitData(c);
    }),
    views: player.views.map(function (view) {
      return view.map(function (cell) {
        return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(cell, ['i', 'j', 'viewed'])), {}, {
          viewBy: SaveSerializer_toConsumableArray(cell.viewBy || []).map(function (unit) {
            return unit.label;
          })
        });
      });
    })
  });
}
function cellData(cell) {
  var _cell$has;
  return SaveSerializer_objectSpread(SaveSerializer_objectSpread({}, filterObject(cell, ['z', 'type', 'viewed', 'solid', 'visible', 'category', 'inclined', 'border', 'waterBorder'])), {}, {
    has: (_cell$has = cell.has) === null || _cell$has === void 0 ? void 0 : _cell$has.label,
    fogSprites: cell.fogSprites.map(function (_ref) {
      var textureSheet = _ref.textureSheet,
        colorSheet = _ref.colorSheet,
        colorName = _ref.colorName;
      return {
        textureSheet: textureSheet,
        colorSheet: colorSheet,
        colorName: colorName
      };
    })
  });
}
function serializeGame(context) {
  return {
    camera: context.controls.camera,
    config: {
      devMode: context.map.devMode,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources
    },
    players: context.players.map(function (p) {
      return playerData(p);
    }),
    resources: SaveSerializer_toConsumableArray(context.map.resources).map(function (r) {
      return resourceData(r);
    }),
    map: context.map.grid.map(function (line) {
      return line.map(function (cell) {
        return cellData(cell);
      });
    }),
    animals: context.map.gaia.units.map(function (a) {
      return animalData(a);
    })
  };
}
;// ./app/screens/Game.js
function Game_typeof(o) { "@babel/helpers - typeof"; return Game_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, Game_typeof(o); }
function Game_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function Game_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? Game_ownKeys(Object(t), !0).forEach(function (r) { Game_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : Game_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function Game_defineProperty(e, r, t) { return (r = Game_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function Game_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function Game_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, Game_toPropertyKey(o.key), o); } }
function Game_createClass(e, r, t) { return r && Game_defineProperties(e.prototype, r), t && Game_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function Game_toPropertyKey(t) { var i = Game_toPrimitive(t, "string"); return "symbol" == Game_typeof(i) ? i : i + ""; }
function Game_toPrimitive(t, r) { if ("object" != Game_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != Game_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Game_callSuper(t, o, e) { return o = Game_getPrototypeOf(o), Game_possibleConstructorReturn(t, Game_isNativeReflectConstruct() ? Reflect.construct(o, e || [], Game_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function Game_possibleConstructorReturn(t, e) { if (e && ("object" == Game_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return Game_assertThisInitialized(t); }
function Game_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function Game_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (Game_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function Game_getPrototypeOf(t) { return Game_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, Game_getPrototypeOf(t); }
function Game_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && Game_setPrototypeOf(t, e); }
function Game_setPrototypeOf(t, e) { return Game_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, Game_setPrototypeOf(t, e); }









/**
 * Main Display Object
 * @exports Game
 * @extends Container
 */
var Game = /*#__PURE__*/function (_Container) {
  function Game(app, gamebox) {
    var _this;
    var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var onQuit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    Game_classCallCheck(this, Game);
    _this = Game_callSuper(this, Game);
    _this.config = config;
    _this.onQuit = onQuit;
    _this.context = {
      app: app,
      gamebox: gamebox,
      menu: null,
      player: null,
      players: [],
      map: null,
      controls: null,
      paused: false,
      scheduler: null,
      save: function save() {
        return _this.save();
      },
      load: function load(evt) {
        return _this.load(evt);
      },
      pause: function pause() {
        return _this.togglePause(true);
      },
      resume: function resume() {
        return _this.togglePause(false);
      },
      quit: function quit() {
        return _this.quit();
      }
    };
    _this.context.scheduler = new ActionScheduler(app, function () {
      return _this.context.paused;
    });
    _this.start();
    return _this;
  }
  Game_inherits(Game, _Container);
  return Game_createClass(Game, [{
    key: "start",
    value: function start() {
      var context = this.context,
        config = this.config;
      context.map = new map_Map(context);
      if (config.size) context.map.size = config.size;
      if (config.mapType) context.map.mapType = config.mapType;
      if (config.devMode) context.map.devMode = true;
      if (config.revealEverything !== undefined) context.map.revealEverything = config.revealEverything;
      if (config.revealTerrain !== undefined) context.map.revealTerrain = config.revealTerrain;
      if (config.startingResources) context.map.startingResources = config.startingResources;
      if (config.difficulty) context.map.difficulty = config.difficulty;
      context.controls = new Controls(context);
      context.menu = new Menu(context);
      var posCount = config.players ? config.players.length : config.bots != null ? config.bots + 1 : null;
      context.map.generateMap(posCount);
      context.players = context.map.generatePlayers(config.players || null);
      context.player = context.players[0];
      context.menu.init();
      context.map.placePlayers();
      context.map.stylishMap();
      context.controls.init();
      this.addChild(context.map);
      this.addChild(context.controls);
      this._attachWindowListeners();
    }
  }, {
    key: "_attachWindowListeners",
    value: function _attachWindowListeners() {
      var _this2 = this;
      this._onKeydown = function (evt) {
        if (evt.key === 'p') {
          _this2.context.paused ? _this2.context.resume() : _this2.context.pause();
        }
      };
      this._onResize = debounce(function () {
        if (_this2.context.controls) _this2.context.controls.updateVisibleCells();
        if (_this2.context.menu) _this2.context.menu.updateCameraMiniMap();
      }, 100);
      window.addEventListener('keydown', this._onKeydown);
      window.addEventListener('resize', this._onResize);
    }
  }, {
    key: "_removeWindowListeners",
    value: function _removeWindowListeners() {
      window.removeEventListener('keydown', this._onKeydown);
      window.removeEventListener('resize', this._onResize);
    }
  }, {
    key: "save",
    value: function save() {
      var data = serializeGame(this.context);
      var workerBlob = new Blob(['self.onmessage=({data})=>self.postMessage(JSON.stringify(data))'], {
        type: 'application/javascript'
      });
      var workerUrl = URL.createObjectURL(workerBlob);
      var worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      worker.onmessage = function (_ref) {
        var json = _ref.data;
        worker.terminate();
        var blobUrl = URL.createObjectURL(new Blob([json], {
          type: 'application/json'
        }));
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = "save_".concat(new Date().toLocaleString('en-GB', {
          timeZone: 'UTC'
        }), ".json");
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      };
      worker.postMessage(data);
    }
  }, {
    key: "load",
    value: function load(json) {
      var _document$getElementB;
      (_document$getElementB = document.getElementById('pause')) === null || _document$getElementB === void 0 || _document$getElementB.remove();
      this._removeWindowListeners();
      this.context.controls.destroy();
      this.context.menu.destroy();
      this.removeChildren();
      this.context = Game_objectSpread(Game_objectSpread({}, this.context), {}, {
        player: null,
        players: [],
        map: null,
        controls: null,
        paused: false
      });
      var context = this.context;
      context.map = new map_Map(context);
      if (json.config) {
        if (json.config.devMode) context.map.devMode = true;
        if (json.config.revealEverything !== undefined) context.map.revealEverything = json.config.revealEverything;
        if (json.config.revealTerrain !== undefined) context.map.revealTerrain = json.config.revealTerrain;
        if (json.config.startingResources) context.map.startingResources = json.config.startingResources;
      }
      context.controls = new Controls(context);
      context.menu = new Menu(context);
      context.map.generateFromJSON(json);
      this.addChild(context.map);
      this.addChild(context.controls);
      this._attachWindowListeners();
    }
  }, {
    key: "quit",
    value: function quit() {
      var _document$getElementB2;
      (_document$getElementB2 = document.getElementById('pause')) === null || _document$getElementB2 === void 0 || _document$getElementB2.remove();
      this._removeWindowListeners();
      this.context.controls.destroy();
      this.context.menu.destroy();
      this.removeChildren();
      if (this.onQuit) this.onQuit();
    }
  }, {
    key: "togglePause",
    value: function togglePause(pause) {
      var _this$context = this.context,
        map = _this$context.map,
        players = _this$context.players;
      if (pause) {
        var div = document.createElement('div');
        div.id = 'pause';
        div.innerText = t('pause');
        document.body.appendChild(div);
      } else {
        var _document$getElementB3;
        (_document$getElementB3 = document.getElementById('pause')) === null || _document$getElementB3 === void 0 || _document$getElementB3.remove();
      }
      for (var i = 0; i < map.gaia.units.length; i++) {
        pause ? map.gaia.units[i].pause() : map.gaia.units[i].resume();
      }
      for (var _i = 0; _i < players.length; _i++) {
        var player = players[_i];
        for (var j = 0; j < player.units.length; j++) {
          pause ? player.units[j].pause() : player.units[j].resume();
        }
        for (var _j = 0; _j < player.buildings.length; _j++) {
          pause ? player.buildings[_j].pause() : player.buildings[_j].resume();
        }
      }
      this.context.paused = pause;
    }
  }]);
}(lib/* Container */.mcf);

;// ./app/screens/Loader.js
function Loader_typeof(o) { "@babel/helpers - typeof"; return Loader_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, Loader_typeof(o); }
function Loader_regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return Loader_regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (Loader_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, Loader_regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, Loader_regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), Loader_regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", Loader_regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), Loader_regeneratorDefine2(u), Loader_regeneratorDefine2(u, o, "Generator"), Loader_regeneratorDefine2(u, n, function () { return this; }), Loader_regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (Loader_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function Loader_regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } Loader_regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { Loader_regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, Loader_regeneratorDefine2(e, r, n, t); }
function Loader_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function Loader_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? Loader_ownKeys(Object(t), !0).forEach(function (r) { Loader_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : Loader_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function Loader_defineProperty(e, r, t) { return (r = Loader_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function Loader_asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function Loader_asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { Loader_asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { Loader_asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function Loader_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function Loader_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, Loader_toPropertyKey(o.key), o); } }
function Loader_createClass(e, r, t) { return r && Loader_defineProperties(e.prototype, r), t && Loader_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function Loader_toPropertyKey(t) { var i = Loader_toPrimitive(t, "string"); return "symbol" == Loader_typeof(i) ? i : i + ""; }
function Loader_toPrimitive(t, r) { if ("object" != Loader_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != Loader_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Loader_callSuper(t, o, e) { return o = Loader_getPrototypeOf(o), Loader_possibleConstructorReturn(t, Loader_isNativeReflectConstruct() ? Reflect.construct(o, e || [], Loader_getPrototypeOf(t).constructor) : o.apply(t, e)); }
function Loader_possibleConstructorReturn(t, e) { if (e && ("object" == Loader_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return Loader_assertThisInitialized(t); }
function Loader_assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function Loader_isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (Loader_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function Loader_getPrototypeOf(t) { return Loader_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, Loader_getPrototypeOf(t); }
function Loader_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && Loader_setPrototypeOf(t, e); }
function Loader_setPrototypeOf(t, e) { return Loader_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, Loader_setPrototypeOf(t, e); }



/**
 * Loading Screen
 *
 * @exports LoaderScreen
 */
var LoaderScreen = /*#__PURE__*/function (_Container) {
  function LoaderScreen() {
    var _this;
    Loader_classCallCheck(this, LoaderScreen);
    _this = Loader_callSuper(this, LoaderScreen);
    _this.app;
    _this.loadingDiv = document.createElement('div');
    _this.loadingDiv.className = 'loading';
    document.body.prepend(_this.loadingDiv);
    _this.done = function () {};
    return _this;
  }
  Loader_inherits(LoaderScreen, _Container);
  return Loader_createClass(LoaderScreen, [{
    key: "start",
    value: function () {
      var _start = Loader_asyncToGenerator(/*#__PURE__*/Loader_regenerator().m(function _callee2() {
        var _this2 = this;
        return Loader_regenerator().w(function (_context2) {
          while (1) switch (_context2.n) {
            case 0:
              return _context2.a(2, new Promise(/*#__PURE__*/function () {
                var _ref = Loader_asyncToGenerator(/*#__PURE__*/Loader_regenerator().m(function _callee(resolve) {
                  var graphics, sounds;
                  return Loader_regenerator().w(function (_context) {
                    while (1) switch (_context.n) {
                      case 0:
                        lib/* Assets */.sP.addBundle('config', {
                          config: 'assets/config.json',
                          greek: 'assets/greek.json',
                          technology: 'assets/technology.json'
                        });
                        lib/* Assets */.sP.addBundle('interface', {
                          50405: 'assets/interface/50405/texture.json'
                        });
                        lib/* Assets */.sP.addBundle('terrain', {
                          15000: 'assets/terrain/15000/texture.json',
                          15001: 'assets/terrain/15001/texture.json',
                          15002: 'assets/terrain/15002/texture.json'
                        });
                        lib/* Assets */.sP.addBundle('border', {
                          20000: 'assets/border/20000/texture.json',
                          20002: 'assets/border/20002/texture.json'
                        });
                        graphics = ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '75', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '94', '153', '154', '155', '203', '204', '205', '206', '212', '215', '217', '218', '219', '220', '222', '223', '224', '225', '227', '230', '231', '232', '233', '234', '235', '236', '237', '239', '240', '254', '256', '258', '261', '271', '272', '273', '274', '280', '281', '292', '293', '294', '295', '296', '297', '298', '299', '300', '301', '308', '309', '311', '312', '314', '315', '321', '324', '326', '327', '328', '330', '331', '332', '333', '334', '336', '337', '339', '340', '343', '347', '355', '356', '367', '368', '370', '371', '373', '374', '380', '386', '388', '389', '390', '391', '392', '393', '394', '395', '397', '398', '399', '400', '401', '403', '413', '414', '415', '416', '418', '419', '425', '428', '430', '431', '432', '433', '435', '436', '437', '439', '440', '441', '442', '445', '447', '450', '452', '458', '463', '464', '465', '466', '473', '478', '479', '480', '481', '489', '492', '493', '494', '497', '500', '503', '509', '527', '531', '532', '533', '534', '593', '594', '609', '622', '623', '624', '625', '626', '628', '630', '631', '632', '633', '636', '651', '652', '653', '654', '655', '657', '658', '664', '667', '670', '672', '673', '676', '677', '678', '680', '681', '682', '683', '684', '688'];
                        lib/* Assets */.sP.addBundle('graphics', graphics.reduce(function (acc, g) {
                          return Loader_objectSpread(Loader_objectSpread({}, acc), {}, Loader_defineProperty({}, g, "assets/graphics/".concat(g, "/texture.json")));
                        }, {}));
                        sounds = ['5002', '5003', '5005', '5006', '5008', '5009', '5010', '5011', '5012', '5022', '5027', '5036', '5044', '5048', '5054', '5055', '5056', '5057', '5058', '5059', '5060', '5061', '5062', '5063', '5064', '5070', '5075', '5076', '5085', '5096', '5107', '5108', '5118', '5123', '5125', '5126', '5128', '5129', '5132', '5133', '5138', '5139', '5140', '5159', '5142', '5144', '5164', '5166', '5169', '5176', '5178', '5180', '5186', '5196', '5201', '5216', '5217', '5239'];
                        lib/* Assets */.sP.addBundle('sounds', sounds.reduce(function (acc, g) {
                          return Loader_objectSpread(Loader_objectSpread({}, acc), {}, Loader_defineProperty({}, g, "assets/sounds/".concat(g, ".wav")));
                        }, {}));
                        _this2.loadingDiv.innerHTML = t('loadingConfig');
                        _context.n = 1;
                        return lib/* Assets */.sP.loadBundle('config');
                      case 1:
                        _this2.loadingDiv.innerHTML = t('loadingInterface');
                        _context.n = 2;
                        return lib/* Assets */.sP.loadBundle('interface');
                      case 2:
                        _this2.loadingDiv.innerHTML = t('loadingTerrain');
                        _context.n = 3;
                        return lib/* Assets */.sP.loadBundle('terrain');
                      case 3:
                        _this2.loadingDiv.innerHTML = t('loadingBorder');
                        _context.n = 4;
                        return lib/* Assets */.sP.loadBundle('border');
                      case 4:
                        _this2.loadingDiv.innerHTML = t('loadingGraphics');
                        _context.n = 5;
                        return lib/* Assets */.sP.loadBundle('graphics');
                      case 5:
                        _this2.loadingDiv.innerHTML = t('loadingSounds');
                        _context.n = 6;
                        return lib/* Assets */.sP.loadBundle('sounds');
                      case 6:
                        _this2.loadingDiv.remove();
                        resolve();
                      case 7:
                        return _context.a(2);
                    }
                  }, _callee);
                }));
                return function (_x) {
                  return _ref.apply(this, arguments);
                };
              }()));
          }
        }, _callee2);
      }));
      function start() {
        return _start.apply(this, arguments);
      }
      return start;
    }()
  }]);
}(lib/* Container */.mcf);

;// ./app/screens/MainMenu.js
function MainMenu_typeof(o) { "@babel/helpers - typeof"; return MainMenu_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, MainMenu_typeof(o); }
function MainMenu_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function MainMenu_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, MainMenu_toPropertyKey(o.key), o); } }
function MainMenu_createClass(e, r, t) { return r && MainMenu_defineProperties(e.prototype, r), t && MainMenu_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function MainMenu_toPropertyKey(t) { var i = MainMenu_toPrimitive(t, "string"); return "symbol" == MainMenu_typeof(i) ? i : i + ""; }
function MainMenu_toPrimitive(t, r) { if ("object" != MainMenu_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != MainMenu_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var MainMenu = /*#__PURE__*/function () {
  function MainMenu(onStart, onLoad) {
    MainMenu_classCallCheck(this, MainMenu);
    this.el = document.createElement('div');
    this.el.id = 'main-menu';
    this.el.style.backgroundImage = "url('/assets/background/bg1.png')";
    var panel = document.createElement('div');
    panel.className = 'menu-panel';
    var title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Dawn of Empires';
    var divider = document.createElement('div');
    divider.className = 'menu-divider';
    var buttons = document.createElement('div');
    buttons.className = 'menu-buttons';
    var btnStart = document.createElement('button');
    btnStart.className = 'menu-btn';
    btnStart.textContent = t('newGame');
    btnStart.onmousedown = playClickSound;
    btnStart.onclick = onStart;
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.onchange = function (evt) {
      var file = evt.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        return onLoad(JSON.parse(e.target.result));
      };
      reader.readAsText(file);
    };
    var btnLoad = document.createElement('button');
    btnLoad.className = 'menu-btn secondary';
    btnLoad.textContent = t('loadGame');
    btnLoad.onmousedown = playClickSound;
    btnLoad.onclick = function () {
      return fileInput.click();
    };
    buttons.appendChild(btnStart);
    buttons.appendChild(btnLoad);
    buttons.appendChild(fileInput);
    panel.appendChild(title);
    panel.appendChild(divider);
    panel.appendChild(buttons);
    this.el.appendChild(panel);
    document.body.appendChild(this.el);
  }
  return MainMenu_createClass(MainMenu, [{
    key: "destroy",
    value: function destroy() {
      this.el.remove();
    }
  }]);
}();

;// ./app/screens/MapConfig.js
function MapConfig_typeof(o) { "@babel/helpers - typeof"; return MapConfig_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, MapConfig_typeof(o); }
function MapConfig_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function MapConfig_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? MapConfig_ownKeys(Object(t), !0).forEach(function (r) { MapConfig_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : MapConfig_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function MapConfig_defineProperty(e, r, t) { return (r = MapConfig_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function MapConfig_classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function MapConfig_defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, MapConfig_toPropertyKey(o.key), o); } }
function MapConfig_createClass(e, r, t) { return r && MapConfig_defineProperties(e.prototype, r), t && MapConfig_defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function MapConfig_toPropertyKey(t) { var i = MapConfig_toPrimitive(t, "string"); return "symbol" == MapConfig_typeof(i) ? i : i + ""; }
function MapConfig_toPrimitive(t, r) { if ("object" != MapConfig_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != MapConfig_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }


var MapConfig_DIFFICULTIES = [{
  label: function label() {
    return t('diffEasy');
  },
  value: 'easy'
}, {
  label: function label() {
    return t('diffMedium');
  },
  value: 'medium'
}, {
  label: function label() {
    return t('diffHard');
  },
  value: 'hard'
}];
var STARTING_RESOURCES = [{
  label: function label() {
    return t('resLow');
  },
  value: 'low'
}, {
  label: function label() {
    return t('resStandard');
  },
  value: 'standard'
}, {
  label: function label() {
    return t('resHigh');
  },
  value: 'high'
}, {
  label: function label() {
    return t('resVeryHigh');
  },
  value: 'very_high'
}];
var RESOURCES_MAP = {
  low: {
    wood: 100,
    food: 150,
    stone: 50,
    gold: 0
  },
  standard: {
    wood: 200,
    food: 200,
    stone: 150,
    gold: 0
  },
  high: {
    wood: 500,
    food: 500,
    stone: 300,
    gold: 0
  },
  very_high: {
    wood: 1000,
    food: 1000,
    stone: 750,
    gold: 100
  }
};
var MAP_SIZES = [{
  label: 'Tiny  (120×120)',
  value: 120,
  maxPlayers: 2
}, {
  label: 'Small (144×144)',
  value: 144,
  maxPlayers: 3
}, {
  label: 'Medium (168×168)',
  value: 168,
  maxPlayers: 4
}, {
  label: 'Normal (200×200)',
  value: 200,
  maxPlayers: 6
}, {
  label: 'Large  (220×220)',
  value: 220,
  maxPlayers: 8
}];
var MAP_TYPES = [{
  label: function label() {
    return t('mapTypePlain');
  },
  value: 'plain'
}, {
  label: function label() {
    return t('mapTypeContinent');
  },
  value: 'continent'
}, {
  label: function label() {
    return t('mapTypeLac');
  },
  value: 'lac'
}, {
  label: function label() {
    return t('mapTypeIlot');
  },
  value: 'ilot'
}];
var CIVS = [{
  label: function label() {
    return t('civGreek');
  },
  value: 'Greek'
}];
var PLAYER_COLORS = [{
  name: 'blue',
  hex: '#3f5f9f'
}, {
  name: 'red',
  hex: '#e30b00'
}, {
  name: 'yellow',
  hex: '#c3a31b'
}, {
  name: 'brown',
  hex: '#8b5b37'
}, {
  name: 'orange',
  hex: '#ef6307'
}, {
  name: 'green',
  hex: '#4b6b2b'
}, {
  name: 'grey',
  hex: '#8f8f8f'
}, {
  name: 'cyan',
  hex: '#00837b'
}];
var MapConfig = /*#__PURE__*/function () {
  function MapConfig(onPlay, onBack) {
    MapConfig_classCallCheck(this, MapConfig);
    this.onPlay = onPlay;
    this.onBack = onBack;
    this.config = {
      size: 120,
      mapType: 'plain',
      difficulty: 'medium',
      revealEverything: false,
      revealTerrain: false,
      devMode: false,
      startingResources: RESOURCES_MAP.standard
    };
    this.maxPlayers = 2;
    this.players = [{
      name: t('you'),
      color: 'blue',
      civ: 'Greek',
      isHuman: true
    }, {
      name: t('computer') + ' 1',
      color: 'red',
      civ: 'Greek',
      isHuman: false
    }];
    this.el = document.createElement('div');
    this.el.id = 'map-config';
    this.el.style.backgroundImage = "url('/assets/background/bg2.png')";
    this._buildUI();
    document.body.appendChild(this.el);
  }
  return MapConfig_createClass(MapConfig, [{
    key: "_buildUI",
    value: function _buildUI() {
      var _this = this;
      var panel = document.createElement('div');
      panel.className = 'menu-panel lobby-panel';
      var title = document.createElement('div');
      title.className = 'menu-title';
      title.textContent = t('newGame');
      var subtitle = document.createElement('div');
      subtitle.className = 'menu-subtitle';
      subtitle.textContent = t('configuration');
      var divider = document.createElement('div');
      divider.className = 'menu-divider';
      var layout = document.createElement('div');
      layout.className = 'lobby-layout';

      // ── Left column: player table ──
      var leftCol = document.createElement('div');
      leftCol.className = 'lobby-col';
      var leftTitle = document.createElement('div');
      leftTitle.className = 'lobby-section-title';
      leftTitle.textContent = t('players');
      this.playerTableEl = document.createElement('div');
      this.playerTableEl.className = 'player-table';
      this.addBotBtn = document.createElement('button');
      this.addBotBtn.className = 'menu-btn lobby-add-btn';
      this.addBotBtn.textContent = t('addOpponent');
      this.addBotBtn.onmousedown = playClickSound;
      this.addBotBtn.onclick = function () {
        return _this._addBot();
      };
      leftCol.appendChild(leftTitle);
      leftCol.appendChild(this.playerTableEl);
      leftCol.appendChild(this.addBotBtn);

      // ── Right column: settings ──
      var rightCol = document.createElement('div');
      rightCol.className = 'lobby-col';
      var rightTitle = document.createElement('div');
      rightTitle.className = 'lobby-section-title';
      rightTitle.textContent = t('mapSettings');
      var settingsForm = document.createElement('div');
      settingsForm.className = 'config-form lobby-settings-form';
      settingsForm.appendChild(this._createSelect(t('mapSizeLabel'), MAP_SIZES, 120, function (val) {
        _this.config.size = parseInt(val);
        var sizeEntry = MAP_SIZES.find(function (s) {
          return s.value === parseInt(val);
        });
        _this.maxPlayers = sizeEntry ? sizeEntry.maxPlayers : 2;
        _this._clampPlayers();
        _this._refreshPlayerTable();
      }));
      settingsForm.appendChild(this._createSelect(t('mapTypeLabel'), MAP_TYPES, 'plain', function (val) {
        _this.config.mapType = val;
      }));
      settingsForm.appendChild(this._createSelect(t('aiDifficulty'), MapConfig_DIFFICULTIES, 'medium', function (val) {
        _this.config.difficulty = val;
      }));
      settingsForm.appendChild(this._createSelect(t('startingResourcesLabel'), STARTING_RESOURCES, 'standard', function (val) {
        _this.config.startingResources = RESOURCES_MAP[val];
      }));
      settingsForm.appendChild(this._createCheckbox(t('devMode'), false, function (val) {
        _this.config.devMode = val;
      }));
      settingsForm.appendChild(this._createCheckbox(t('revealAll'), false, function (val) {
        _this.config.revealEverything = val;
      }));
      settingsForm.appendChild(this._createCheckbox(t('revealTerrain'), false, function (val) {
        _this.config.revealTerrain = val;
      }));
      rightCol.appendChild(rightTitle);
      rightCol.appendChild(settingsForm);
      layout.appendChild(leftCol);
      layout.appendChild(rightCol);
      var divider2 = document.createElement('div');
      divider2.className = 'menu-divider';
      var buttons = document.createElement('div');
      buttons.className = 'menu-buttons menu-buttons--row';
      var btnBack = document.createElement('button');
      btnBack.className = 'menu-btn secondary';
      btnBack.textContent = t('back');
      btnBack.onmousedown = playClickSound;
      btnBack.onclick = this.onBack;
      var btnPlay = document.createElement('button');
      btnPlay.className = 'menu-btn';
      btnPlay.textContent = t('startGame');
      btnPlay.onmousedown = playClickSound;
      btnPlay.onclick = function () {
        return _this.onPlay(MapConfig_objectSpread(MapConfig_objectSpread({}, _this.config), {}, {
          players: _this.players.map(function (p) {
            return MapConfig_objectSpread({}, p);
          })
        }));
      };
      buttons.appendChild(btnBack);
      buttons.appendChild(btnPlay);
      panel.appendChild(title);
      panel.appendChild(subtitle);
      panel.appendChild(divider);
      panel.appendChild(layout);
      panel.appendChild(divider2);
      panel.appendChild(buttons);
      this.el.appendChild(panel);
      this._refreshPlayerTable();
    }
  }, {
    key: "_usedColors",
    value: function _usedColors() {
      return new Set(this.players.map(function (p) {
        return p.color;
      }));
    }
  }, {
    key: "_nextAvailableColor",
    value: function _nextAvailableColor(currentColor) {
      var used = this._usedColors();
      var idx = PLAYER_COLORS.findIndex(function (c) {
        return c.name === currentColor;
      });
      for (var offset = 1; offset < PLAYER_COLORS.length; offset++) {
        var candidate = PLAYER_COLORS[(idx + offset) % PLAYER_COLORS.length];
        if (!used.has(candidate.name)) return candidate.name;
      }
      return currentColor;
    }
  }, {
    key: "_firstAvailableColor",
    value: function _firstAvailableColor() {
      var used = this._usedColors();
      var found = PLAYER_COLORS.find(function (c) {
        return !used.has(c.name);
      });
      return found ? found.name : PLAYER_COLORS[0].name;
    }
  }, {
    key: "_clampPlayers",
    value: function _clampPlayers() {
      while (this.players.length > this.maxPlayers) {
        this.players.pop();
      }
    }
  }, {
    key: "_addBot",
    value: function _addBot() {
      if (this.players.length >= this.maxPlayers) return;
      var color = this._firstAvailableColor();
      var botNum = this.players.filter(function (p) {
        return !p.isHuman;
      }).length + 1;
      this.players.push({
        name: t('computer') + ' ' + botNum,
        color: color,
        civ: 'Greek',
        isHuman: false
      });
      this._refreshPlayerTable();
    }
  }, {
    key: "_removePlayer",
    value: function _removePlayer(index) {
      this.players.splice(index, 1);
      var botNum = 1;
      this.players.forEach(function (p) {
        if (!p.isHuman) p.name = t('computer') + ' ' + botNum++;
      });
      this._refreshPlayerTable();
    }
  }, {
    key: "_cycleColor",
    value: function _cycleColor(playerIndex) {
      this.players[playerIndex].color = this._nextAvailableColor(this.players[playerIndex].color);
      this._refreshPlayerTable();
    }
  }, {
    key: "_refreshPlayerTable",
    value: function _refreshPlayerTable() {
      var _this2 = this;
      this.playerTableEl.innerHTML = '';

      // Header row
      var header = document.createElement('div');
      header.className = 'player-table-header';
      [t('colName'), t('colCiv'), t('colColor'), ''].forEach(function (text) {
        var cell = document.createElement('div');
        cell.textContent = text;
        header.appendChild(cell);
      });
      this.playerTableEl.appendChild(header);

      // Player rows
      this.players.forEach(function (player, i) {
        var row = document.createElement('div');
        row.className = 'player-row' + (i % 2 === 0 ? ' player-row--odd' : '');

        // Name
        var nameCell = document.createElement('div');
        nameCell.className = 'player-name' + (player.isHuman ? ' human' : '');
        nameCell.textContent = player.name;
        row.appendChild(nameCell);

        // Civilization select
        var civCell = document.createElement('div');
        civCell.className = 'player-civ';
        var civSelect = document.createElement('select');
        CIVS.forEach(function (civ) {
          var opt = document.createElement('option');
          opt.value = civ.value;
          opt.textContent = typeof civ.label === 'function' ? civ.label() : civ.label;
          if (civ.value === player.civ) opt.selected = true;
          civSelect.appendChild(opt);
        });
        civSelect.onchange = function (e) {
          _this2.players[i].civ = e.target.value;
        };
        civCell.appendChild(civSelect);
        row.appendChild(civCell);

        // Color swatch
        var colorCell = document.createElement('div');
        colorCell.className = 'player-color-cell';
        var colorData = PLAYER_COLORS.find(function (c) {
          return c.name === player.color;
        });
        var swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = colorData ? colorData.hex : '#fff';
        swatch.title = t('colorSwatch', {
          color: player.color
        });
        swatch.onmousedown = playClickSound;
        swatch.onclick = function () {
          return _this2._cycleColor(i);
        };
        colorCell.appendChild(swatch);
        row.appendChild(colorCell);

        // Remove button (bots only)
        var actionCell = document.createElement('div');
        actionCell.className = 'player-action-cell';
        if (!player.isHuman) {
          var removeBtn = document.createElement('button');
          removeBtn.className = 'player-remove';
          removeBtn.textContent = '×';
          removeBtn.title = t('removePlayer');
          removeBtn.onmousedown = playClickSound;
          removeBtn.onclick = function () {
            return _this2._removePlayer(i);
          };
          actionCell.appendChild(removeBtn);
        }
        row.appendChild(actionCell);
        _this2.playerTableEl.appendChild(row);
      });
      this.addBotBtn.disabled = this.players.length >= this.maxPlayers;
    }
  }, {
    key: "_createSelect",
    value: function _createSelect(label, options, defaultValue, onChange) {
      var row = document.createElement('div');
      row.className = 'config-row';
      var lbl = document.createElement('label');
      lbl.textContent = label;
      var select = document.createElement('select');
      options.forEach(function (opt) {
        var option = document.createElement('option');
        option.value = opt.value;
        option.textContent = typeof opt.label === 'function' ? opt.label() : opt.label;
        if (opt.value === defaultValue) option.selected = true;
        select.appendChild(option);
      });
      select.onchange = function (e) {
        return onChange(e.target.value);
      };
      row.appendChild(lbl);
      row.appendChild(select);
      return row;
    }
  }, {
    key: "_createCheckbox",
    value: function _createCheckbox(label, defaultValue, onChange) {
      var row = document.createElement('div');
      row.className = 'config-row config-row--checkbox';
      var lbl = document.createElement('label');
      lbl.textContent = label;
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = defaultValue;
      checkbox.onchange = function (e) {
        return onChange(e.target.checked);
      };
      row.appendChild(lbl);
      row.appendChild(checkbox);
      return row;
    }
  }, {
    key: "destroy",
    value: function destroy() {
      this.el.remove();
    }
  }]);
}();

;// ./app/entry.js
function entry_regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return entry_regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (entry_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, entry_regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, entry_regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), entry_regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", entry_regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), entry_regeneratorDefine2(u), entry_regeneratorDefine2(u, o, "Generator"), entry_regeneratorDefine2(u, n, function () { return this; }), entry_regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (entry_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function entry_regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } entry_regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { entry_regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, entry_regeneratorDefine2(e, r, n, t); }
function entry_asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function entry_asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { entry_asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { entry_asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }






entry_asyncToGenerator(/*#__PURE__*/entry_regenerator().m(function _callee() {
  var app, gamebox, loader, currentGame, quitGame, startGame, loadGame, showMapConfig, showMainMenu;
  return entry_regenerator().w(function (_context) {
    while (1) switch (_context.n) {
      case 0:
        app = new lib/* Application */.lgM();
        _context.n = 1;
        return app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          background: 0x000000,
          resizeTo: window,
          antialias: false,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          powerPreference: 'high-performance'
        });
      case 1:
        gamebox = document.getElementById('game');
        if (gamebox) {
          _context.n = 2;
          break;
        }
        console.error('No #game container found');
        return _context.a(2);
      case 2:
        gamebox.appendChild(app.canvas);
        loader = new LoaderScreen();
        app.stage.addChild(loader);
        _context.n = 3;
        return loader.start();
      case 3:
        app.stage.removeChild(loader);
        currentGame = null;
        quitGame = function quitGame() {
          if (currentGame) {
            app.stage.removeChild(currentGame);
            currentGame.destroy();
            currentGame = null;
          }
          showMainMenu();
        };
        startGame = function startGame(config) {
          currentGame = new Game(app, gamebox, config, quitGame);
          app.stage.addChild(currentGame);
        };
        loadGame = function loadGame(json) {
          currentGame = new Game(app, gamebox, {}, quitGame);
          app.stage.addChild(currentGame);
          currentGame.load(json);
        };
        showMapConfig = function showMapConfig() {
          var mapConfig = new MapConfig(function (config) {
            mapConfig.destroy();
            startGame(config);
          }, function () {
            mapConfig.destroy();
            showMainMenu();
          });
        };
        showMainMenu = function showMainMenu() {
          var mainMenu = new MainMenu(function () {
            mainMenu.destroy();
            showMapConfig();
          }, function (json) {
            mainMenu.destroy();
            loadGame(json);
          });
        };
        showMainMenu();
      case 4:
        return _context.a(2);
    }
  }, _callee);
}))();

/***/ },

/***/ 7172
(module, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5838);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3990);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_pnpm_css_loader_7_1_4_webpack_5_107_2_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `:root {
  --main-primary-color: #5e4a22;
  --main-background-color: rgba(14, 10, 5, 0.80);
  --main-bg-base: #0b0906;
  --main-border-color: transparent;
  --main-border-radius: 3px;
  --main-border-radius-lg: 5px;
  --main-border-size: 0px;
  --main-border-style: solid;
  --main-border-hover: #a07830;
  --main-shadow-color: rgba(0, 0, 0, 0.75);
  --main-shadow-dark: #1e1508;
  --main-box-shadow: var(--main-shadow-color) 0px 0px 3px 0px;
  --main-text-color: #ddd0a0;
  --main-text-muted: #8a7850;
  --main-accent-color: #d4a843;
  --main-accent-bright: #f0d860;
  --main-accent-hover: rgba(74, 58, 30, 0.55);

  --msg-color: #e84040;
  --msg-bg: rgba(10, 6, 2, 0.85);
  --msg-border: #6b1f1f;
  --msg-padding: 6px 18px;
  --msg-font-size: 13px;
  --msg-border-radius: var(--main-border-radius);
}

html,
body,
input,
textarea,
select,
button {
  border-color: var(--main-primary-color);
  color: var(--main-text-color);
  font-size: 12px;
  text-shadow: 1px 1px black;
  font-family: sans-serif;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: none;
  font-smoothing: none;
}

body {
  height: 100vh;
  overflow: hidden;
  margin: 0;
  -webkit-user-select: none;
  user-select: none;
  background-color: black;
}

button,
.input-file {
  border: 1px solid var(--main-primary-color);
  padding: 6px 15px;
  border-radius: var(--main-border-radius);
  position: relative;
  cursor: pointer;
  text-align: center;
  background-color: transparent;
  width: 200px;
  transition: all 0.2s;
  color: var(--main-accent-color);
}
button:hover,
.input-file:hover {
  background-color: var(--main-accent-hover);
  border-color: var(--main-border-hover);
}
.input-file {
  width: calc(100% - 32px);
}
.input-file > input {
  width: 200px;
  cursor: pointer;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 99;
  /*Opacity settings for all browsers*/
  opacity: 0;
  -moz-opacity: 0;
  filter: progid:DXImageTransform.Microsoft.Alpha(opacity=0);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

#game {
  flex: 1;
}

#pause {
  position: absolute;
  z-index: 1000;
  font-size: 50px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin-top: -66px;
}

.bar {
  background: var(--main-background-color);
  width: 100%;
}

img {
  -webkit-user-drag: none;
  user-drag: none;
}

.img {
  object-fit: none;
  height: 45px;
  width: 45px;
  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);
  border-radius: var(--main-border-radius);
  box-shadow: var(--main-box-shadow);
}

.topbar {
  position: absolute;
  top: 0;
  padding: 5px 10px;
  display: grid;
  font-weight: bold;
  grid-template-columns: 33% 33% 33%;
  width: calc(100% - 20px);
  align-items: center;
  justify-content: center;
}

.bottombar {
  position: absolute;
  bottom: 0;
  display: grid;
  height: 122px;
  grid-template-columns: 120px auto 242px;
  width: calc(100% - 10px);
  grid-gap: 5px;
  padding: 5px;
}

.bottombar-info {
  position: relative;
  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);
  border-radius: var(--main-border-radius);
  box-shadow: var(--main-box-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 2px;
  gap: 1px;
}

.bottombar-info #icon {
  object-fit: none;
  height: 45px;
  width: 45px;
}

.bottombar-info #infos {
  position: absolute;
  left: 45%;
  top: 30px;
  display: flex;
  align-items: center;
  flex-direction: column;
}

.bottombar-info #info {
  display: flex;
  align-items: center;
  gap: 5px;
}

.bottombar-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 5px 0;
  overflow: auto;
  max-width: 500px;
}

.bottombar-menu-column {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bottombar-menu-box {
  position: relative;
  display: flex;
}

.bottombar-map-wrap {
  position: relative;
  top: 2px;
  filter: drop-shadow(0px 0px 3px var(--main-shadow-color));
}

.bottombar-map {
  width: 100%;
  height: 100%;
  background: black;
  clip-path: polygon(50% 1%, 100% 48%, 50% 96%, 0% 48%);
}

.bottombar-map canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.topbar-age {
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-resources {
  display: flex;
  gap: 10px;
}

.topbar-options {
  display: flex;
  align-items: center;
  justify-content: end;
}

.topbar-options-menu {
  width: fit-content;
  cursor: pointer;
  border: 1px solid var(--main-primary-color);
  border-radius: var(--main-border-radius);
  padding: 3px 12px;
  color: var(--main-accent-color);
  background: var(--main-background-color);
  letter-spacing: 1px;
  text-transform: uppercase;
  font-size: 11px;
  transition: background 0.15s, border-color 0.15s;
}
.topbar-options-menu:hover {
  background: var(--main-accent-hover);
  border-color: var(--main-border-hover);
}

.resource {
  display: flex;
  gap: 2px;
  align-items: center;
}

.resource > div {
  width: 40px;
}

.resource-content {
  object-fit: none;
  height: 13px;
  width: 20px;
  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);
  border-radius: var(--main-border-radius);
  box-shadow: var(--main-box-shadow);
}

.message {
  z-index: 1000;
  position: fixed;
  width: 100%;
  text-align: center;
}

.message-content {
  color: var(--msg-color);
  background: var(--msg-bg);
  padding: var(--msg-padding);
  font-size: var(--msg-font-size);
  border: 1px solid var(--msg-border);
  border-radius: var(--msg-border-radius);
  box-shadow: var(--main-box-shadow);
  letter-spacing: 0.03em;
  animation: msg-fade 3s ease forwards;
}

@keyframes msg-fade {
  0%   { opacity: 0; transform: translateY(6px); }
  15%  { opacity: 1; transform: translateY(0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}

.resource-quantity {
  position: absolute;
  top: 20px;
  left: 45%;
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 5px;
}

.unit-loading {
  position: absolute;
  top: 52px;
  left: 45%;
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 5px;
}

.building-loading,
#population {
  position: absolute;
  left: 40%;
  top: 32px;
  display: flex;
  align-items: center;
}

.toggle {
  position: fixed;
  bottom: -119px;
  right: 0;
  transform: rotate(64deg);
  height: 192px;
  width: 100px;
  border-top-left-radius: 3px;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.modal-content {
  background: var(--main-background-color);
  border: 1px solid var(--main-primary-color);
  box-shadow: 0 0 0 1px var(--main-shadow-dark), 0 0 30px rgba(0, 0, 0, 0.9);
  border-radius: var(--main-border-radius-lg);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.modal-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
}

.modal-menu .menu-btn,
.modal-menu .input-file.menu-btn {
  width: 220px !important;
}

/* ============================================================
   MAIN MENU / MAP CONFIG
   ============================================================ */

#main-menu,
#map-config {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--main-bg-base);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

.menu-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 44px 64px;
  background: var(--main-background-color);
  border: 1px solid var(--main-primary-color);
  border-radius: var(--main-border-radius-lg);
  box-shadow:
    0 0 0 1px var(--main-shadow-dark),
    0 0 40px rgba(0, 0, 0, 0.9),
    inset 0 0 24px rgba(0, 0, 0, 0.6);
}

.menu-title {
  font-size: 40px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 8px;
  text-transform: uppercase;
  color: var(--main-accent-color);
  text-shadow:
    0 0 24px rgba(200, 168, 94, 0.35),
    2px 2px 0 #000;
  font-family: serif;
  margin: 0;
}

.menu-subtitle {
  font-size: 11px;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: var(--main-text-muted);
  margin-top: -12px;
  text-shadow: none;
}

.menu-divider {
  width: 220px;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--main-primary-color), transparent);
  margin: 2px 0;
}

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.menu-btn {
  box-sizing: border-box !important;
  width: 250px !important;
  padding: 10px 20px !important;
  font-size: 11px !important;
  letter-spacing: 2px;
  text-transform: uppercase;
  border: 1px solid var(--main-primary-color) !important;
  border-radius: var(--main-border-radius) !important;
  color: var(--main-accent-color) !important;
  background: var(--main-background-color) !important;
  transition: background 0.15s, border-color 0.15s, color 0.15s !important;
}

.menu-btn:hover {
  background: var(--main-accent-hover) !important;
  color: var(--main-accent-bright) !important;
  border-color: var(--main-border-hover) !important;
}

.menu-btn.secondary {
  color: var(--main-text-muted) !important;
  border-color: var(--main-primary-color) !important;
  opacity: 0.7;
}

.menu-btn.secondary:hover {
  background: var(--main-accent-hover) !important;
  color: var(--main-accent-color) !important;
  border-color: var(--main-border-hover) !important;
  opacity: 1;
}

/* Config form rows */
.config-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 340px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.config-row label {
  color: var(--main-text-color) !important;
  letter-spacing: 1px;
  font-size: 11px !important;
  text-transform: uppercase;
  text-shadow: none !important;
}

.config-row select {
  background: var(--main-background-color);
  border: 1px solid var(--main-primary-color) !important;
  border-radius: var(--main-border-radius);
  color: var(--main-accent-color) !important;
  padding: 5px 8px;
  min-width: 180px;
  font-size: 11px !important;
  cursor: pointer;
}

.config-row select:focus {
  outline: none;
  border-color: var(--main-border-hover) !important;
}

.config-row--checkbox {
  cursor: pointer;
}

.config-row input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--main-border-hover);
  cursor: pointer;
  border: none;
}

/* ============================================================
   LOBBY — tableau AOE style
   ============================================================ */

.lobby-panel {
  padding: 36px 48px;
  min-width: 0;
}

.lobby-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  width: min(82vw, 840px);
  align-items: start;
}

.lobby-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lobby-section-title {
  font-size: 9px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--main-text-muted);
  margin-bottom: 2px;
  text-shadow: none;
}

/* Player table */
.player-table {
  border: 1px solid var(--main-primary-color);
  border-radius: var(--main-border-radius);
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.player-table-header {
  display: grid;
  grid-template-columns: 1fr 100px 32px 20px;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--main-primary-color);
  background: rgba(74, 58, 30, 0.2);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--main-text-muted);
}

.player-row {
  display: grid;
  grid-template-columns: 1fr 100px 32px 20px;
  gap: 8px;
  padding: 5px 10px;
  align-items: center;
  border-bottom: 1px solid rgba(74, 58, 30, 0.2);
}

.player-row:last-child {
  border-bottom: none;
}

.player-row--odd {
  background: rgba(74, 58, 30, 0.08);
}

.player-name {
  font-size: 11px;
  color: var(--main-text-color);
}

.player-name.human {
  color: var(--main-accent-color);
}

.player-civ select {
  background: var(--main-background-color);
  border: 1px solid var(--main-primary-color);
  border-radius: var(--main-border-radius);
  color: var(--main-accent-color);
  padding: 3px 4px;
  font-size: 10px;
  cursor: pointer;
  width: 100%;
}

.player-civ select:focus {
  outline: none;
  border-color: var(--main-border-hover);
}

.player-color-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  flex-shrink: 0;
}

.color-swatch:hover {
  border-color: var(--main-accent-color);
  transform: scale(1.25);
}

.player-action-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-remove {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  color: var(--main-text-muted) !important;
  cursor: pointer;
  padding: 0 !important;
  font-size: 15px !important;
  width: auto !important;
  min-width: 0 !important;
  line-height: 1;
}

.player-remove:hover {
  color: #e30b00 !important;
  background: none !important;
}

.lobby-add-btn {
  margin-top: 4px;
  width: 100% !important;
  font-size: 10px !important;
  letter-spacing: 1px !important;
  padding: 6px 10px !important;
  border: 1px dashed var(--main-primary-color) !important;
  color: var(--main-text-muted) !important;
}

.lobby-add-btn:hover:not(:disabled) {
  color: var(--main-accent-color) !important;
  border-color: var(--main-border-hover) !important;
  background: var(--main-accent-hover) !important;
}

.lobby-add-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.lobby-settings-form {
  width: 100% !important;
}

.lobby-settings-form .config-row select {
  min-width: 0;
  flex: 1;
}

.menu-buttons--row {
  flex-direction: row !important;
  gap: 16px !important;
}
`, "",{"version":3,"sources":["webpack://./app/styles.css"],"names":[],"mappings":"AAAA;EACE,6BAA6B;EAC7B,8CAA8C;EAC9C,uBAAuB;EACvB,gCAAgC;EAChC,yBAAyB;EACzB,4BAA4B;EAC5B,uBAAuB;EACvB,0BAA0B;EAC1B,4BAA4B;EAC5B,wCAAwC;EACxC,2BAA2B;EAC3B,2DAA2D;EAC3D,0BAA0B;EAC1B,0BAA0B;EAC1B,4BAA4B;EAC5B,6BAA6B;EAC7B,2CAA2C;;EAE3C,oBAAoB;EACpB,8BAA8B;EAC9B,qBAAqB;EACrB,uBAAuB;EACvB,qBAAqB;EACrB,8CAA8C;AAChD;;AAEA;;;;;;EAME,uCAAuC;EACvC,6BAA6B;EAC7B,eAAe;EACf,0BAA0B;EAC1B,uBAAuB;EACvB,4BAA4B;EAC5B,6BAA6B;EAC7B,oBAAoB;AACtB;;AAEA;EACE,aAAa;EACb,gBAAgB;EAChB,SAAS;EACT,yBAAyB;EACzB,iBAAiB;EACjB,uBAAuB;AACzB;;AAEA;;EAEE,2CAA2C;EAC3C,iBAAiB;EACjB,wCAAwC;EACxC,kBAAkB;EAClB,eAAe;EACf,kBAAkB;EAClB,6BAA6B;EAC7B,YAAY;EACZ,oBAAoB;EACpB,+BAA+B;AACjC;AACA;;EAEE,0CAA0C;EAC1C,sCAAsC;AACxC;AACA;EACE,wBAAwB;AAC1B;AACA;EACE,YAAY;EACZ,eAAe;EACf,YAAY;EACZ,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,WAAW;EACX,oCAAoC;EACpC,UAAU;EACV,eAAe;EACf,0DAA0D;AAC5D;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;EACvB,YAAY;AACd;;AAEA;EACE,OAAO;AACT;;AAEA;EACE,kBAAkB;EAClB,aAAa;EACb,eAAe;EACf,QAAQ;EACR,SAAS;EACT,gCAAgC;EAChC,iBAAiB;AACnB;;AAEA;EACE,wCAAwC;EACxC,WAAW;AACb;;AAEA;EACE,uBAAuB;EACvB,eAAe;AACjB;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;EACX,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;AACpC;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,iBAAiB;EACjB,aAAa;EACb,iBAAiB;EACjB,kCAAkC;EAClC,wBAAwB;EACxB,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,aAAa;EACb,aAAa;EACb,uCAAuC;EACvC,wBAAwB;EACxB,aAAa;EACb,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;EAClC,gBAAgB;EAChB,aAAa;EACb,sBAAsB;EACtB,YAAY;EACZ,QAAQ;AACV;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;AACb;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,sBAAsB;AACxB;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,QAAQ;AACV;;AAEA;EACE,aAAa;EACb,eAAe;EACf,QAAQ;EACR,cAAc;EACd,cAAc;EACd,gBAAgB;AAClB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,QAAQ;AACV;;AAEA;EACE,kBAAkB;EAClB,aAAa;AACf;;AAEA;EACE,kBAAkB;EAClB,QAAQ;EACR,yDAAyD;AAC3D;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,iBAAiB;EACjB,qDAAqD;AACvD;;AAEA;EACE,kBAAkB;EAClB,OAAO;EACP,MAAM;EACN,WAAW;EACX,YAAY;AACd;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,aAAa;EACb,SAAS;AACX;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,oBAAoB;AACtB;;AAEA;EACE,kBAAkB;EAClB,eAAe;EACf,2CAA2C;EAC3C,wCAAwC;EACxC,iBAAiB;EACjB,+BAA+B;EAC/B,wCAAwC;EACxC,mBAAmB;EACnB,yBAAyB;EACzB,eAAe;EACf,gDAAgD;AAClD;AACA;EACE,oCAAoC;EACpC,sCAAsC;AACxC;;AAEA;EACE,aAAa;EACb,QAAQ;EACR,mBAAmB;AACrB;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;EACX,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;AACpC;;AAEA;EACE,aAAa;EACb,eAAe;EACf,WAAW;EACX,kBAAkB;AACpB;;AAEA;EACE,uBAAuB;EACvB,yBAAyB;EACzB,2BAA2B;EAC3B,+BAA+B;EAC/B,mCAAmC;EACnC,uCAAuC;EACvC,kCAAkC;EAClC,sBAAsB;EACtB,oCAAoC;AACtC;;AAEA;EACE,OAAO,UAAU,EAAE,0BAA0B,EAAE;EAC/C,OAAO,UAAU,EAAE,wBAAwB,EAAE;EAC7C,OAAO,UAAU,EAAE;EACnB,OAAO,UAAU,EAAE;AACrB;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,mBAAmB;EACnB,QAAQ;AACV;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,mBAAmB;EACnB,QAAQ;AACV;;AAEA;;EAEE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;AACrB;;AAEA;EACE,eAAe;EACf,cAAc;EACd,QAAQ;EACR,wBAAwB;EACxB,aAAa;EACb,YAAY;EACZ,2BAA2B;EAC3B,8BAA8B;EAC9B,WAAW;EACX,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,YAAY;EACZ,aAAa;EACb,8BAA8B;EAC9B,aAAa;AACf;;AAEA;EACE,wCAAwC;EACxC,2CAA2C;EAC3C,0EAA0E;EAC1E,2CAA2C;EAC3C,kBAAkB;EAClB,QAAQ;EACR,SAAS;EACT,gCAAgC;AAClC;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,mBAAmB;EACnB,QAAQ;EACR,kBAAkB;AACpB;;AAEA;;EAEE,uBAAuB;AACzB;;AAEA;;iEAEiE;;AAEjE;;EAEE,eAAe;EACf,QAAQ;EACR,aAAa;EACb,aAAa;EACb,mBAAmB;EACnB,uBAAuB;EACvB,+BAA+B;EAC/B,sBAAsB;EACtB,4BAA4B;EAC5B,2BAA2B;AAC7B;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,mBAAmB;EACnB,SAAS;EACT,kBAAkB;EAClB,wCAAwC;EACxC,2CAA2C;EAC3C,2CAA2C;EAC3C;;;qCAGmC;AACrC;;AAEA;EACE,eAAe;EACf,iBAAiB;EACjB,kBAAkB;EAClB,mBAAmB;EACnB,yBAAyB;EACzB,+BAA+B;EAC/B;;kBAEgB;EAChB,kBAAkB;EAClB,SAAS;AACX;;AAEA;EACE,eAAe;EACf,mBAAmB;EACnB,yBAAyB;EACzB,6BAA6B;EAC7B,iBAAiB;EACjB,iBAAiB;AACnB;;AAEA;EACE,YAAY;EACZ,WAAW;EACX,0FAA0F;EAC1F,aAAa;AACf;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,QAAQ;EACR,mBAAmB;AACrB;;AAEA;EACE,iCAAiC;EACjC,uBAAuB;EACvB,6BAA6B;EAC7B,0BAA0B;EAC1B,mBAAmB;EACnB,yBAAyB;EACzB,sDAAsD;EACtD,mDAAmD;EACnD,0CAA0C;EAC1C,mDAAmD;EACnD,wEAAwE;AAC1E;;AAEA;EACE,+CAA+C;EAC/C,2CAA2C;EAC3C,iDAAiD;AACnD;;AAEA;EACE,wCAAwC;EACxC,kDAAkD;EAClD,YAAY;AACd;;AAEA;EACE,+CAA+C;EAC/C,0CAA0C;EAC1C,iDAAiD;EACjD,UAAU;AACZ;;AAEA,qBAAqB;AACrB;EACE,aAAa;EACb,sBAAsB;EACtB,SAAS;EACT,YAAY;AACd;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,8BAA8B;EAC9B,SAAS;AACX;;AAEA;EACE,wCAAwC;EACxC,mBAAmB;EACnB,0BAA0B;EAC1B,yBAAyB;EACzB,4BAA4B;AAC9B;;AAEA;EACE,wCAAwC;EACxC,sDAAsD;EACtD,wCAAwC;EACxC,0CAA0C;EAC1C,gBAAgB;EAChB,gBAAgB;EAChB,0BAA0B;EAC1B,eAAe;AACjB;;AAEA;EACE,aAAa;EACb,iDAAiD;AACnD;;AAEA;EACE,eAAe;AACjB;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,sCAAsC;EACtC,eAAe;EACf,YAAY;AACd;;AAEA;;iEAEiE;;AAEjE;EACE,kBAAkB;EAClB,YAAY;AACd;;AAEA;EACE,aAAa;EACb,8BAA8B;EAC9B,SAAS;EACT,uBAAuB;EACvB,kBAAkB;AACpB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,QAAQ;AACV;;AAEA;EACE,cAAc;EACd,mBAAmB;EACnB,yBAAyB;EACzB,6BAA6B;EAC7B,kBAAkB;EAClB,iBAAiB;AACnB;;AAEA,iBAAiB;AACjB;EACE,2CAA2C;EAC3C,wCAAwC;EACxC,8BAA8B;EAC9B,gBAAgB;AAClB;;AAEA;EACE,aAAa;EACb,0CAA0C;EAC1C,QAAQ;EACR,iBAAiB;EACjB,kDAAkD;EAClD,iCAAiC;EACjC,cAAc;EACd,mBAAmB;EACnB,yBAAyB;EACzB,6BAA6B;AAC/B;;AAEA;EACE,aAAa;EACb,0CAA0C;EAC1C,QAAQ;EACR,iBAAiB;EACjB,mBAAmB;EACnB,8CAA8C;AAChD;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,kCAAkC;AACpC;;AAEA;EACE,eAAe;EACf,6BAA6B;AAC/B;;AAEA;EACE,+BAA+B;AACjC;;AAEA;EACE,wCAAwC;EACxC,2CAA2C;EAC3C,wCAAwC;EACxC,+BAA+B;EAC/B,gBAAgB;EAChB,eAAe;EACf,eAAe;EACf,WAAW;AACb;;AAEA;EACE,aAAa;EACb,sCAAsC;AACxC;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,kBAAkB;EAClB,0CAA0C;EAC1C,eAAe;EACf,8CAA8C;EAC9C,cAAc;AAChB;;AAEA;EACE,sCAAsC;EACtC,sBAAsB;AACxB;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,2BAA2B;EAC3B,uBAAuB;EACvB,2BAA2B;EAC3B,wCAAwC;EACxC,eAAe;EACf,qBAAqB;EACrB,0BAA0B;EAC1B,sBAAsB;EACtB,uBAAuB;EACvB,cAAc;AAChB;;AAEA;EACE,yBAAyB;EACzB,2BAA2B;AAC7B;;AAEA;EACE,eAAe;EACf,sBAAsB;EACtB,0BAA0B;EAC1B,8BAA8B;EAC9B,4BAA4B;EAC5B,uDAAuD;EACvD,wCAAwC;AAC1C;;AAEA;EACE,0CAA0C;EAC1C,iDAAiD;EACjD,+CAA+C;AACjD;;AAEA;EACE,YAAY;EACZ,mBAAmB;AACrB;;AAEA;EACE,sBAAsB;AACxB;;AAEA;EACE,YAAY;EACZ,OAAO;AACT;;AAEA;EACE,8BAA8B;EAC9B,oBAAoB;AACtB","sourcesContent":[":root {\n  --main-primary-color: #5e4a22;\n  --main-background-color: rgba(14, 10, 5, 0.80);\n  --main-bg-base: #0b0906;\n  --main-border-color: transparent;\n  --main-border-radius: 3px;\n  --main-border-radius-lg: 5px;\n  --main-border-size: 0px;\n  --main-border-style: solid;\n  --main-border-hover: #a07830;\n  --main-shadow-color: rgba(0, 0, 0, 0.75);\n  --main-shadow-dark: #1e1508;\n  --main-box-shadow: var(--main-shadow-color) 0px 0px 3px 0px;\n  --main-text-color: #ddd0a0;\n  --main-text-muted: #8a7850;\n  --main-accent-color: #d4a843;\n  --main-accent-bright: #f0d860;\n  --main-accent-hover: rgba(74, 58, 30, 0.55);\n\n  --msg-color: #e84040;\n  --msg-bg: rgba(10, 6, 2, 0.85);\n  --msg-border: #6b1f1f;\n  --msg-padding: 6px 18px;\n  --msg-font-size: 13px;\n  --msg-border-radius: var(--main-border-radius);\n}\n\nhtml,\nbody,\ninput,\ntextarea,\nselect,\nbutton {\n  border-color: var(--main-primary-color);\n  color: var(--main-text-color);\n  font-size: 12px;\n  text-shadow: 1px 1px black;\n  font-family: sans-serif;\n  -webkit-font-smoothing: none;\n  -moz-osx-font-smoothing: none;\n  font-smoothing: none;\n}\n\nbody {\n  height: 100vh;\n  overflow: hidden;\n  margin: 0;\n  -webkit-user-select: none;\n  user-select: none;\n  background-color: black;\n}\n\nbutton,\n.input-file {\n  border: 1px solid var(--main-primary-color);\n  padding: 6px 15px;\n  border-radius: var(--main-border-radius);\n  position: relative;\n  cursor: pointer;\n  text-align: center;\n  background-color: transparent;\n  width: 200px;\n  transition: all 0.2s;\n  color: var(--main-accent-color);\n}\nbutton:hover,\n.input-file:hover {\n  background-color: var(--main-accent-hover);\n  border-color: var(--main-border-hover);\n}\n.input-file {\n  width: calc(100% - 32px);\n}\n.input-file > input {\n  width: 200px;\n  cursor: pointer;\n  height: 100%;\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 99;\n  /*Opacity settings for all browsers*/\n  opacity: 0;\n  -moz-opacity: 0;\n  filter: progid:DXImageTransform.Microsoft.Alpha(opacity=0);\n}\n\n.loading {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n}\n\n#game {\n  flex: 1;\n}\n\n#pause {\n  position: absolute;\n  z-index: 1000;\n  font-size: 50px;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  margin-top: -66px;\n}\n\n.bar {\n  background: var(--main-background-color);\n  width: 100%;\n}\n\nimg {\n  -webkit-user-drag: none;\n  user-drag: none;\n}\n\n.img {\n  object-fit: none;\n  height: 45px;\n  width: 45px;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n}\n\n.topbar {\n  position: absolute;\n  top: 0;\n  padding: 5px 10px;\n  display: grid;\n  font-weight: bold;\n  grid-template-columns: 33% 33% 33%;\n  width: calc(100% - 20px);\n  align-items: center;\n  justify-content: center;\n}\n\n.bottombar {\n  position: absolute;\n  bottom: 0;\n  display: grid;\n  height: 122px;\n  grid-template-columns: 120px auto 242px;\n  width: calc(100% - 10px);\n  grid-gap: 5px;\n  padding: 5px;\n}\n\n.bottombar-info {\n  position: relative;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  padding: 2px;\n  gap: 1px;\n}\n\n.bottombar-info #icon {\n  object-fit: none;\n  height: 45px;\n  width: 45px;\n}\n\n.bottombar-info #infos {\n  position: absolute;\n  left: 45%;\n  top: 30px;\n  display: flex;\n  align-items: center;\n  flex-direction: column;\n}\n\n.bottombar-info #info {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n}\n\n.bottombar-menu {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n  padding: 5px 0;\n  overflow: auto;\n  max-width: 500px;\n}\n\n.bottombar-menu-column {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n\n.bottombar-menu-box {\n  position: relative;\n  display: flex;\n}\n\n.bottombar-map-wrap {\n  position: relative;\n  top: 2px;\n  filter: drop-shadow(0px 0px 3px var(--main-shadow-color));\n}\n\n.bottombar-map {\n  width: 100%;\n  height: 100%;\n  background: black;\n  clip-path: polygon(50% 1%, 100% 48%, 50% 96%, 0% 48%);\n}\n\n.bottombar-map canvas {\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: 100%;\n}\n\n.topbar-age {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.topbar-resources {\n  display: flex;\n  gap: 10px;\n}\n\n.topbar-options {\n  display: flex;\n  align-items: center;\n  justify-content: end;\n}\n\n.topbar-options-menu {\n  width: fit-content;\n  cursor: pointer;\n  border: 1px solid var(--main-primary-color);\n  border-radius: var(--main-border-radius);\n  padding: 3px 12px;\n  color: var(--main-accent-color);\n  background: var(--main-background-color);\n  letter-spacing: 1px;\n  text-transform: uppercase;\n  font-size: 11px;\n  transition: background 0.15s, border-color 0.15s;\n}\n.topbar-options-menu:hover {\n  background: var(--main-accent-hover);\n  border-color: var(--main-border-hover);\n}\n\n.resource {\n  display: flex;\n  gap: 2px;\n  align-items: center;\n}\n\n.resource > div {\n  width: 40px;\n}\n\n.resource-content {\n  object-fit: none;\n  height: 13px;\n  width: 20px;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n}\n\n.message {\n  z-index: 1000;\n  position: fixed;\n  width: 100%;\n  text-align: center;\n}\n\n.message-content {\n  color: var(--msg-color);\n  background: var(--msg-bg);\n  padding: var(--msg-padding);\n  font-size: var(--msg-font-size);\n  border: 1px solid var(--msg-border);\n  border-radius: var(--msg-border-radius);\n  box-shadow: var(--main-box-shadow);\n  letter-spacing: 0.03em;\n  animation: msg-fade 3s ease forwards;\n}\n\n@keyframes msg-fade {\n  0%   { opacity: 0; transform: translateY(6px); }\n  15%  { opacity: 1; transform: translateY(0); }\n  75%  { opacity: 1; }\n  100% { opacity: 0; }\n}\n\n.resource-quantity {\n  position: absolute;\n  top: 20px;\n  left: 45%;\n  display: flex;\n  align-items: center;\n  flex-direction: row;\n  gap: 5px;\n}\n\n.unit-loading {\n  position: absolute;\n  top: 52px;\n  left: 45%;\n  display: flex;\n  align-items: center;\n  flex-direction: row;\n  gap: 5px;\n}\n\n.building-loading,\n#population {\n  position: absolute;\n  left: 40%;\n  top: 32px;\n  display: flex;\n  align-items: center;\n}\n\n.toggle {\n  position: fixed;\n  bottom: -119px;\n  right: 0;\n  transform: rotate(64deg);\n  height: 192px;\n  width: 100px;\n  border-top-left-radius: 3px;\n  background: rgba(0, 0, 0, 0.5);\n  z-index: 10;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.modal {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  background: rgba(0, 0, 0, 0.5);\n  z-index: 1001;\n}\n\n.modal-content {\n  background: var(--main-background-color);\n  border: 1px solid var(--main-primary-color);\n  box-shadow: 0 0 0 1px var(--main-shadow-dark), 0 0 30px rgba(0, 0, 0, 0.9);\n  border-radius: var(--main-border-radius-lg);\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.modal-menu {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  padding: 24px 32px;\n}\n\n.modal-menu .menu-btn,\n.modal-menu .input-file.menu-btn {\n  width: 220px !important;\n}\n\n/* ============================================================\n   MAIN MENU / MAP CONFIG\n   ============================================================ */\n\n#main-menu,\n#map-config {\n  position: fixed;\n  inset: 0;\n  z-index: 2000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--main-bg-base);\n  background-size: cover;\n  background-repeat: no-repeat;\n  background-position: center;\n}\n\n.menu-panel {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 18px;\n  padding: 44px 64px;\n  background: var(--main-background-color);\n  border: 1px solid var(--main-primary-color);\n  border-radius: var(--main-border-radius-lg);\n  box-shadow:\n    0 0 0 1px var(--main-shadow-dark),\n    0 0 40px rgba(0, 0, 0, 0.9),\n    inset 0 0 24px rgba(0, 0, 0, 0.6);\n}\n\n.menu-title {\n  font-size: 40px;\n  font-weight: bold;\n  text-align: center;\n  letter-spacing: 8px;\n  text-transform: uppercase;\n  color: var(--main-accent-color);\n  text-shadow:\n    0 0 24px rgba(200, 168, 94, 0.35),\n    2px 2px 0 #000;\n  font-family: serif;\n  margin: 0;\n}\n\n.menu-subtitle {\n  font-size: 11px;\n  letter-spacing: 5px;\n  text-transform: uppercase;\n  color: var(--main-text-muted);\n  margin-top: -12px;\n  text-shadow: none;\n}\n\n.menu-divider {\n  width: 220px;\n  height: 1px;\n  background: linear-gradient(to right, transparent, var(--main-primary-color), transparent);\n  margin: 2px 0;\n}\n\n.menu-buttons {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  align-items: center;\n}\n\n.menu-btn {\n  box-sizing: border-box !important;\n  width: 250px !important;\n  padding: 10px 20px !important;\n  font-size: 11px !important;\n  letter-spacing: 2px;\n  text-transform: uppercase;\n  border: 1px solid var(--main-primary-color) !important;\n  border-radius: var(--main-border-radius) !important;\n  color: var(--main-accent-color) !important;\n  background: var(--main-background-color) !important;\n  transition: background 0.15s, border-color 0.15s, color 0.15s !important;\n}\n\n.menu-btn:hover {\n  background: var(--main-accent-hover) !important;\n  color: var(--main-accent-bright) !important;\n  border-color: var(--main-border-hover) !important;\n}\n\n.menu-btn.secondary {\n  color: var(--main-text-muted) !important;\n  border-color: var(--main-primary-color) !important;\n  opacity: 0.7;\n}\n\n.menu-btn.secondary:hover {\n  background: var(--main-accent-hover) !important;\n  color: var(--main-accent-color) !important;\n  border-color: var(--main-border-hover) !important;\n  opacity: 1;\n}\n\n/* Config form rows */\n.config-form {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  width: 340px;\n}\n\n.config-row {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.config-row label {\n  color: var(--main-text-color) !important;\n  letter-spacing: 1px;\n  font-size: 11px !important;\n  text-transform: uppercase;\n  text-shadow: none !important;\n}\n\n.config-row select {\n  background: var(--main-background-color);\n  border: 1px solid var(--main-primary-color) !important;\n  border-radius: var(--main-border-radius);\n  color: var(--main-accent-color) !important;\n  padding: 5px 8px;\n  min-width: 180px;\n  font-size: 11px !important;\n  cursor: pointer;\n}\n\n.config-row select:focus {\n  outline: none;\n  border-color: var(--main-border-hover) !important;\n}\n\n.config-row--checkbox {\n  cursor: pointer;\n}\n\n.config-row input[type='checkbox'] {\n  width: 14px;\n  height: 14px;\n  accent-color: var(--main-border-hover);\n  cursor: pointer;\n  border: none;\n}\n\n/* ============================================================\n   LOBBY — tableau AOE style\n   ============================================================ */\n\n.lobby-panel {\n  padding: 36px 48px;\n  min-width: 0;\n}\n\n.lobby-layout {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 40px;\n  width: min(82vw, 840px);\n  align-items: start;\n}\n\n.lobby-col {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.lobby-section-title {\n  font-size: 9px;\n  letter-spacing: 3px;\n  text-transform: uppercase;\n  color: var(--main-text-muted);\n  margin-bottom: 2px;\n  text-shadow: none;\n}\n\n/* Player table */\n.player-table {\n  border: 1px solid var(--main-primary-color);\n  border-radius: var(--main-border-radius);\n  background: rgba(0, 0, 0, 0.3);\n  overflow: hidden;\n}\n\n.player-table-header {\n  display: grid;\n  grid-template-columns: 1fr 100px 32px 20px;\n  gap: 8px;\n  padding: 5px 10px;\n  border-bottom: 1px solid var(--main-primary-color);\n  background: rgba(74, 58, 30, 0.2);\n  font-size: 9px;\n  letter-spacing: 2px;\n  text-transform: uppercase;\n  color: var(--main-text-muted);\n}\n\n.player-row {\n  display: grid;\n  grid-template-columns: 1fr 100px 32px 20px;\n  gap: 8px;\n  padding: 5px 10px;\n  align-items: center;\n  border-bottom: 1px solid rgba(74, 58, 30, 0.2);\n}\n\n.player-row:last-child {\n  border-bottom: none;\n}\n\n.player-row--odd {\n  background: rgba(74, 58, 30, 0.08);\n}\n\n.player-name {\n  font-size: 11px;\n  color: var(--main-text-color);\n}\n\n.player-name.human {\n  color: var(--main-accent-color);\n}\n\n.player-civ select {\n  background: var(--main-background-color);\n  border: 1px solid var(--main-primary-color);\n  border-radius: var(--main-border-radius);\n  color: var(--main-accent-color);\n  padding: 3px 4px;\n  font-size: 10px;\n  cursor: pointer;\n  width: 100%;\n}\n\n.player-civ select:focus {\n  outline: none;\n  border-color: var(--main-border-hover);\n}\n\n.player-color-cell {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.color-swatch {\n  width: 20px;\n  height: 20px;\n  border-radius: 50%;\n  border: 2px solid rgba(255, 255, 255, 0.2);\n  cursor: pointer;\n  transition: border-color 0.15s, transform 0.1s;\n  flex-shrink: 0;\n}\n\n.color-swatch:hover {\n  border-color: var(--main-accent-color);\n  transform: scale(1.25);\n}\n\n.player-action-cell {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.player-remove {\n  background: none !important;\n  border: none !important;\n  box-shadow: none !important;\n  color: var(--main-text-muted) !important;\n  cursor: pointer;\n  padding: 0 !important;\n  font-size: 15px !important;\n  width: auto !important;\n  min-width: 0 !important;\n  line-height: 1;\n}\n\n.player-remove:hover {\n  color: #e30b00 !important;\n  background: none !important;\n}\n\n.lobby-add-btn {\n  margin-top: 4px;\n  width: 100% !important;\n  font-size: 10px !important;\n  letter-spacing: 1px !important;\n  padding: 6px 10px !important;\n  border: 1px dashed var(--main-primary-color) !important;\n  color: var(--main-text-muted) !important;\n}\n\n.lobby-add-btn:hover:not(:disabled) {\n  color: var(--main-accent-color) !important;\n  border-color: var(--main-border-hover) !important;\n  background: var(--main-accent-hover) !important;\n}\n\n.lobby-add-btn:disabled {\n  opacity: 0.3;\n  cursor: not-allowed;\n}\n\n.lobby-settings-form {\n  width: 100% !important;\n}\n\n.lobby-settings-form .config-row select {\n  min-width: 0;\n  flex: 1;\n}\n\n.menu-buttons--row {\n  flex-direction: row !important;\n  gap: 16px !important;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }

},
/******/ __webpack_require__ => { // webpackRuntimeModules
/******/ var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
/******/ __webpack_require__.O(0, [96], () => (__webpack_exec__(6854)));
/******/ var __webpack_exports__ = __webpack_require__.O();
/******/ }
]);
//# sourceMappingURL=main.js.map