"use strict";
(self["webpackChunkrts_game"] = self["webpackChunkrts_game"] || []).push([[792],{

/***/ 6544:
/***/ ((__unused_webpack_module, __unused_webpack___webpack_exports__, __webpack_require__) => {


// NAMESPACE OBJECT: ./app/lib/maths.js
var maths_namespaceObject = {};
__webpack_require__.r(maths_namespaceObject);
__webpack_require__.d(maths_namespaceObject, {
  average: () => (average),
  cartesianToIsometric: () => (cartesianToIsometric),
  cellIsDiag: () => (maths_cellIsDiag),
  degreeToDirection: () => (maths_degreeToDirection),
  degreesToRadians: () => (degreesToRadians),
  diff: () => (diff),
  formatNumber: () => (formatNumber),
  getInstanceDegree: () => (maths_getInstanceDegree),
  getInstanceZIndex: () => (getInstanceZIndex),
  getPercentage: () => (maths_getPercentage),
  getPointsDegree: () => (maths_getPointsDegree),
  getValuePercentage: () => (getValuePercentage),
  instancesDistance: () => (maths_instancesDistance),
  isometricToCartesian: () => (maths_isometricToCartesian),
  pointInRectangle: () => (pointInRectangle),
  pointIsBetweenTwoPoint: () => (pointIsBetweenTwoPoint),
  pointsDistance: () => (maths_pointsDistance),
  randomItem: () => (maths_randomItem),
  randomRange: () => (maths_randomRange),
  uuidv4: () => (uuidv4)
});

// EXTERNAL MODULE: ./node_modules/.pnpm/pixi.js@8.13.2/node_modules/pixi.js/lib/index.mjs + 39 modules
var lib = __webpack_require__(6663);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js
var injectStylesIntoStyleTag = __webpack_require__(5993);
var injectStylesIntoStyleTag_default = /*#__PURE__*/__webpack_require__.n(injectStylesIntoStyleTag);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/styleDomAPI.js
var styleDomAPI = __webpack_require__(4782);
var styleDomAPI_default = /*#__PURE__*/__webpack_require__.n(styleDomAPI);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/insertBySelector.js
var insertBySelector = __webpack_require__(5494);
var insertBySelector_default = /*#__PURE__*/__webpack_require__.n(insertBySelector);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js
var setAttributesWithoutAttributes = __webpack_require__(1193);
var setAttributesWithoutAttributes_default = /*#__PURE__*/__webpack_require__.n(setAttributesWithoutAttributes);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/insertStyleElement.js
var insertStyleElement = __webpack_require__(8325);
var insertStyleElement_default = /*#__PURE__*/__webpack_require__.n(insertStyleElement);
// EXTERNAL MODULE: ./node_modules/.pnpm/style-loader@4.0.0_webpack@5.101.3/node_modules/style-loader/dist/runtime/styleTagTransform.js
var styleTagTransform = __webpack_require__(3842);
var styleTagTransform_default = /*#__PURE__*/__webpack_require__.n(styleTagTransform);
// EXTERNAL MODULE: ./node_modules/.pnpm/css-loader@7.1.2_webpack@5.101.3/node_modules/css-loader/dist/cjs.js!./app/styles.css
var styles = __webpack_require__(7511);
;// ./app/styles.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());
options.insert = insertBySelector_default().bind(null, "head");
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(styles/* default */.A, options);




       /* harmony default export */ const app_styles = (styles/* default */.A && styles/* default */.A.locals ? styles/* default */.A.locals : undefined);

// EXTERNAL MODULE: ./node_modules/.pnpm/@pixi+sound@6.0.1_pixi.js@8.13.2/node_modules/@pixi/sound/lib/index.mjs + 29 modules
var sound_lib = __webpack_require__(7694);
;// ./app/constants/index.js
var CELL_WIDTH = 64;
var CELL_HEIGHT = 32;
var CELL_DEPTH = 16;
var ACCELERATOR = 1.5;
var STEP_TIME = 20;
var IS_MOBILE = window.innerWidth <= 800 && window.innerHeight <= 600;
var LONG_CLICK_DURATION = 200;
var WORK_FOOD_TYPES = ['fisher', 'hunter', 'farmer', 'forager'];
var LOADING_FOOD_TYPES = ['meat', 'wheat', 'berry', 'fish'];
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
  Stone: 'minestone',
  Gold: 'minegold',
  Berrybush: 'forageberry',
  Tree: 'chopwood',
  Fish: 'fishing'
};
var CORPSE_TIME = 120;
var RUBBLE_TIME = 120;
var MAX_SELECT_UNITS = 10;
var POPULATION_MAX = 200;
// EXTERNAL MODULE: ./node_modules/.pnpm/pixi-filters@6.1.4_pixi.js@8.13.2/node_modules/pixi-filters/lib/multi-color-replace/MultiColorReplaceFilter.mjs + 4 modules
var MultiColorReplaceFilter = __webpack_require__(5360);
;// ./app/lib/graphics.js
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }




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
  var path = assets.cache.get(owner.civ.toLowerCase()).buildings;
  if (path[owner.age][type]) {
    return path[owner.age][type];
  } else if (path[owner.age - 1][type]) {
    return path[owner.age - 1][type];
  } else if (path[owner.age - 2][type]) {
    return path[owner.age - 2][type];
  } else if (path[0][type]) {
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
    _name$split2 = _slicedToArray(_name$split, 2),
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

/**
 * Get the hex color code for a given color name.
 * @param {string} name - The name of the color.
 * @returns {string} The hex color code, or '#ffffff' if the color is not found.
 */
function getHexColor(name) {
  var colorMap = {
    blue: '#3f5f9f',
    red: '#e30b00',
    yellow: '#c3a31b',
    brown: '#8b5b37',
    orange: '#ef6307',
    green: '#4b6b2b',
    grey: '#8f8f8f',
    cyan: '#00837b'
  };
  return colorMap[name] || '#ffffff'; // Default to white if not found
}

/**
 * Change the color of a sprite directly by manipulating its texture.
 * @param {object} sprite - The sprite to change the color of.
 * @param {string} color - The new color to apply to the sprite.
 */
function changeSpriteColorDirectly(sprite, color) {
  if (color === 'blue') {
    return; // Skip processing if color is blue
  }
  var sourceColors = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057];
  var colors = {
    red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
    yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
    brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
    orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
    green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
    grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
    cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327]
  };
  var targetColors = colors[color];
  if (!targetColors) {
    throw new Error('Invalid color selected.'); // Throw error for invalid color
  }
  var baseTexture = sprite.texture.baseTexture.resource;
  var canvas = document.createElement('canvas');
  canvas.width = sprite.texture.width;
  canvas.height = sprite.texture.height;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(baseTexture, sprite.texture.frame.x, sprite.texture.frame.y, sprite.texture.frame.width, sprite.texture.frame.height, 0, 0, sprite.texture.frame.width, sprite.texture.frame.height);
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var sourceColorMap = new Map(sourceColors.map(function (color, index) {
    return [color, targetColors[index]];
  }));
  for (var i = 0; i < data.length; i += 4) {
    var r = data[i];
    var g = data[i + 1];
    var b = data[i + 2];
    var rgb = r << 16 | g << 8 | b;
    if (sourceColorMap.has(rgb)) {
      var targetColor = sourceColorMap.get(rgb);
      data[i] = targetColor >> 16 & 0xff; // Red
      data[i + 1] = targetColor >> 8 & 0xff; // Green
      data[i + 2] = targetColor & 0xff; // Blue
    }
  }
  ctx.putImageData(imageData, 0, 0);
  var newTexture = lib/* Texture */.gPd.from(canvas);
  sprite.texture = newTexture;
}

/**
 * Change the color of a sprite based on the specified color.
 *
 * @param {object} sprite - The sprite object whose color will be changed.
 * @param {string} color - The target color. Supported colors: 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan'.
 * @returns {void}
 */
function changeSpriteColor(sprite, color) {
  // Skip color change if the specified color is blue
  if (color === 'blue') {
    return;
  }

  // Source colors (Hex)
  var source = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057];

  // Define color mappings
  var colors = {
    red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
    yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
    brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
    orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
    green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
    grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
    cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327]
  };

  // Check if the color is supported
  if (!colors[color]) {
    return;
  }

  // Create final color mapping
  var replacements = [];
  for (var i = 0; i < source.length; i++) {
    replacements.push([source[i], colors[color][i]]);
  }
  var filter = new MultiColorReplaceFilter/* MultiColorReplaceFilter */.N({
    replacements: replacements,
    tolerance: 0.1
  });
  sprite.filters = [filter];
}

/**
 * Draws a blinking selection around the given instance.
 * @param {object} instance - The instance to draw the selection around.
 */
function drawInstanceBlinkingSelection(instance) {
  var selection = new lib/* Graphics */.A1g();
  selection.label = 'selection';
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
  sprite.onFrameChange = function (currentFrame) {
    if (currentFrame === frame) {
      cb();
    }
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
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') {
    console.error('Invalid arguments provided to refundCost.');
    return;
  }
  Object.keys(cost).forEach(function (prop) {
    if (typeof cost[prop] === 'number') {
      player[prop] += cost[prop];
    } else {
      console.warn("Cost for ".concat(prop, " is not a number:"), cost[prop]);
    }
  });
}

/**
 * Deducts costs from the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to pay.
 */
function payCost(player, cost) {
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') {
    console.error('Invalid arguments provided to payCost.');
    return;
  }
  Object.keys(cost).forEach(function (prop) {
    if (typeof cost[prop] === 'number') {
      player[prop] -= cost[prop];
    } else {
      console.warn("Cost for ".concat(prop, " is not a number:"), cost[prop]);
    }
  });
}

/**
 * Checks if the player can afford the given costs.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to check.
 * @returns {boolean} - True if the player can afford the costs, false otherwise.
 */
function canAfford(player, cost) {
  // Validate inputs
  if (!player || _typeof(player) !== 'object' || !cost || _typeof(cost) !== 'object') {
    console.error('Invalid arguments provided to canAfford.');
    return false;
  }

  // Iterate over the cost object
  for (var prop in cost) {
    // Check if the cost for the property is a number
    if (typeof cost[prop] === 'number') {
      // Early return if player cannot afford the cost
      if (player[prop] < cost[prop]) {
        return false;
      }
    }
  }

  // If all costs are affordable, return true
  return true;
}
;// ./app/lib/maths.js


/**
 * Generate a version 4 UUID.
 * @returns {string} - A random UUID.
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var randomValue = crypto.getRandomValues(new Uint8Array(1))[0] & 15; // Get a random value
    var hexValue = (c === 'x' ? randomValue : randomValue & 0x3 | 0x8).toString(16); // Adjust for 'y'
    return hexValue;
  });
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
function maths_isometricToCartesian(x, y) {
  return [Math.round((x / (CELL_WIDTH / 2) + y / (CELL_HEIGHT / 2)) / 2), Math.round((y / (CELL_HEIGHT / 2) - x / (CELL_WIDTH / 2)) / 2)];
}

/**
 * Get percentage with two numbers
 * @param {number} a
 * @param {number} b
 */
function maths_getPercentage(a, b) {
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
    return Math.abs(s) * Math.sqrt(L2) <= lineThickness;
  }
}

/**
 * Get a random number between two numbers
 * @param {number} min
 * @param {number} max
 */
function maths_randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Get a random item from a array
 * @param {array} array
 */
function maths_randomItem() {
  var array = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  return array[Math.round(Math.random() * (array.length - 1))];
}

/**
 * Get distance between two instances, can use iso (x, y) or cartesian (i, j)
 * @param {object} a
 * @param {object} b
 * @param {boolean} useCartesian
 */
function maths_instancesDistance(a, b) {
  var useCartesian = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  return useCartesian ? maths_pointsDistance(a.i, a.j, b.i, b.j) : maths_pointsDistance(a.x, a.y, b.x, b.y);
}

/**
 * Get the instance zIndex according to his position
 * @param {object} instance
 */
function getInstanceZIndex(instance) {
  var pos = maths_isometricToCartesian(instance.x, instance.y + instance.z * CELL_DEPTH);
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
function maths_getInstanceDegree(instance, x, y) {
  return maths_getPointsDegree(instance.x, instance.y, x, y);
}

/**
 * Get the degree from one point to another.
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @returns {number} - The angle in degrees from the first point to the second.
 */
function maths_getPointsDegree(x1, y1, x2, y2) {
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
  return degrees * (Math.PI / 180);
}

/**
 * Get distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function maths_pointsDistance(x1, y1, x2, y2) {
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
function maths_cellIsDiag(src, target) {
  return Math.abs(target.i - src.i) === Math.abs(target.j - src.j);
}
function maths_degreeToDirection(degree) {
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
    return 'est';
  } else if (degree > 112.5 && degree < 157.5) {
    return 'northest';
  } else if (degree > 202.5 && degree < 247.5) {
    return 'southest';
  }
}
;// ./app/lib/grid.js
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = grid_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || grid_unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return grid_arrayLikeToArray(r); }
function grid_slicedToArray(r, e) { return grid_arrayWithHoles(r) || grid_iterableToArrayLimit(r, e) || grid_unsupportedIterableToArray(r, e) || grid_nonIterableRest(); }
function grid_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function grid_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return grid_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? grid_arrayLikeToArray(r, a) : void 0; } }
function grid_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function grid_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function grid_arrayWithHoles(r) { if (Array.isArray(r)) return r; }


Object.entries(maths_namespaceObject).forEach(function (_ref) {
  var _ref2 = grid_slicedToArray(_ref, 2),
    name = _ref2[0],
    exported = _ref2[1];
  return window[name] = exported;
});

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
      return randomItem(cells);
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
  var paths = [];

  // Get cells around the target based on size
  var distance = size === 3 ? 2 : 1;
  getCellsAroundPoint(target.i, target.j, map.grid, distance, function (cell) {
    var path = getInstancePath(instance, cell.i, cell.j, map);
    if (path.length) {
      paths.push(path);
    }
  });

  // Return the shortest path if available
  return paths.length ? paths.reduce(function (shortest, current) {
    return current.length < shortest.length ? current : shortest;
  }) : [];
}

/**
 * Get the shortest path for a instance to a destination
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 * @param {object} map
 */
function getInstancePath(instance, x, y, map) {
  var maxZone = 10;
  var end = map.grid[x][y];
  var start = map.grid[instance.i][instance.j];
  var minX = Math.max(Math.min(start.i, end.i) - maxZone, 0);
  var maxX = Math.min(Math.max(start.i, end.i) + maxZone, map.size);
  var minY = Math.max(Math.min(start.j, end.j) - maxZone, 0);
  var maxY = Math.min(Math.max(start.j, end.j) + maxZone, map.size);
  function isCellReachable(cell) {
    if (cell.solid) {
      return false;
    }
    var allowWaterCellCategory = instance.category === 'Boat';
    return allowWaterCellCategory ? cell.category === 'Water' : cell.category !== 'Water';
  }
  var cloneGrid = [];
  for (var i = minX; i <= maxX; i++) {
    for (var j = minY; j <= maxY; j++) {
      if (cloneGrid[i] == null) {
        cloneGrid[i] = [];
      }
      cloneGrid[i][j] = {
        i: i,
        j: j,
        x: map.grid[i][j].x,
        y: map.grid[i][j].y,
        z: map.grid[i][j].z,
        solid: map.grid[i][j].solid,
        category: map.grid[i][j].category
      };
    }
  }
  var isFinish = false;
  var path = [];
  var openCells = [];
  var closedCells = [];
  var cloneEnd = cloneGrid[end.i][end.j];
  var cloneStart = cloneGrid[start.i][start.j];
  openCells.push(cloneStart);
  var _loop = function _loop() {
    if (openCells.length > 0) {
      // find the lowest f in open cells
      var lowestF = 0;
      for (var _i = 0; _i < openCells.length; _i++) {
        if (openCells[_i].f < openCells[lowestF].f) {
          lowestF = _i;
        }
        if (openCells[_i].f == openCells[lowestF].f) {
          if (openCells[_i].g > openCells[lowestF].g) {
            lowestF = _i;
          }
        }
      }
      var current = openCells[lowestF];
      if (current === cloneEnd) {
        // reached the end cell
        isFinish = true;
      }
      // calculate path
      path = [cloneEnd];
      var temp = current;
      while (temp.previous) {
        path.push(temp.previous);
        temp = temp.previous;
      }
      openCells.splice(openCells.indexOf(current), 1);
      closedCells.push(current);
      // check neighbours
      getCellsAroundPoint(current.i, current.j, cloneGrid, 1, function (neighbour) {
        var validDiag = !cellIsDiag(current, neighbour) || isCellReachable(cloneGrid[current.i][neighbour.j]) && isCellReachable(cloneGrid[neighbour.i][current.j]);
        if (!closedCells.includes(neighbour) && isCellReachable(neighbour) && validDiag) {
          var tempG = current.g + instancesDistance(neighbour, current);
          if (!openCells.includes(neighbour)) {
            openCells.push(neighbour);
            neighbour.g = tempG;
            neighbour.h = instancesDistance(neighbour, cloneEnd);
            neighbour.f = neighbour.g + neighbour.h;
            neighbour.previous = current;
          }
        }
      });
    } else {
      // no solution
      path = [];
      isFinish = true;
    }
  };
  while (!isFinish) {
    _loop();
  }
  path.pop();
  return _toConsumableArray(path);
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
      var surroundingCells = getPlainCellsAroundPoint(i, j, grid, size);
      var _iterator = _createForOfIteratorHelper(surroundingCells),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var surroundingCell = _step.value;
          if (!condition(surroundingCell)) {
            isFree = false;
            break; // Exit early if a cell does not meet the condition
          }
        }

        // Return the first valid {i, j} coordinates if the area is free
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
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
    grid = instance.parent.grid;
  var instances = [];
  for (var x = Math.max(instX - sight, 0); x <= Math.min(instX + sight, grid.length - 1); x++) {
    for (var y = Math.max(instY - sight, 0); y <= Math.min(instY + sight, grid[x].length - 1); y++) {
      // Check if the cell is within the instance's sight range
      if (pointsDistance(instX, instY, x, y) <= sight) {
        var cell = grid[x][y];

        // Ensure the cell has an instance and the condition is met
        if (cell !== null && cell !== void 0 && cell.has && typeof condition === 'function' && condition(cell.has)) {
          instances.push(cell.has);
        }
      }
    }
  }
  return instances;
}

/**
 * Renders cells in the instance's line of sight, updating their visibility and interactions based on the instance's sight.
 *
 * @param {object} instance - The instance whose sight is being processed.
 *                            Must include properties like `i`, `j`, `sight`, `owner`, `parent`, and `context`.
 */
function renderCellOnInstanceSight(instance) {
  var _instance$context = instance.context,
    player = _instance$context.player,
    controls = _instance$context.controls,
    map = _instance$context.map;
  var owner = instance.owner,
    sight = instance.sight;

  // Check if instance should be visible based on player interaction and sight
  if (player && (!map.revealEverything ? !instanceIsInPlayerSight(instance, player) : !controls.instanceInCamera(instance)) && !owner.isPlayed) {
    instance.visible = false;
  } else {
    instance.visible = true;
  }

  // Process cells around the instance based on its sight
  getPlainCellsAroundPoint(instance.i, instance.j, owner.views, sight, function (cell) {
    var pointDistance = pointsDistance(instance.i, instance.j, cell.i, cell.j);
    var globalCell = map.grid[cell.i][cell.j];
    if (pointDistance <= sight) {
      // If the global cell has an instance with sight and a detection function
      if (globalCell.has && globalCell.has.sight && instancesDistance(instance, globalCell.has) <= globalCell.has.sight && typeof globalCell.has.detect === 'function') {
        globalCell.has.detect(instance);
      }

      // Add the instance to the cell's viewBy list if not already present
      if (!cell.viewBy.includes(instance)) {
        cell.viewBy.push(instance);
      }

      // Mark the cell as viewed if it hasn't been already
      if (!cell.viewed) {
        owner.cellViewed++;
        cell.onViewed();
        cell.viewed = true;
      }

      // Handle fog removal for the instance's owner (player vs AI)
      if (owner.isPlayed && !map.revealEverything) {
        globalCell.removeFog();
      } else if (owner.type === 'AI') {
        // Update AI's knowledge of the surroundings (trees, berrybushes, enemy buildings)
        updateAIKnowledge(globalCell, cell, instance);
      }
    }
  });
}

/**
 * Updates AI knowledge of trees, berrybushes, and enemy buildings when an AI instance views a global cell.
 *
 * @param {object} globalCell - The cell in the global grid.
 * @param {object} cell - The current local cell being processed.
 * @param {object} instance - The AI instance viewing the cell.
 */
function updateAIKnowledge(globalCell, cell, instance) {
  var owner = instance.owner;

  // Sync local cell's "has" object with the global cell if different
  if (globalCell.has && (!cell.has || cell.has.label !== globalCell.has.label)) {
    cell.has = globalCell.has;

    // Detect tree resources and update AI's knowledge
    if (globalCell.has.type === 'Tree' && globalCell.has.quantity > 0 && !owner.foundedTrees.includes(globalCell.has)) {
      owner.foundedTrees.push(globalCell.has);
    }

    // Detect berrybush resources and update AI's knowledge
    if (globalCell.has.type === 'Berrybush' && globalCell.has.quantity > 0 && !owner.foundedBerrybushs.includes(globalCell.has)) {
      owner.foundedBerrybushs.push(globalCell.has);
    }

    // Detect enemy buildings and update AI's knowledge
    if (globalCell.has.family === 'building' && globalCell.has.hitPoints > 0 && globalCell.has.owner.label !== owner.label && !owner.foundedEnemyBuildings.includes(globalCell.has)) {
      owner.foundedEnemyBuildings.push(globalCell.has);
    }
  }
}

/**
 * Clears the cells within the instance's line of sight from the owner's view.
 *
 * This function removes the instance from the `viewBy` list of cells around it, within its line of sight.
 * If a cell is no longer viewed by any instance and meets certain conditions, fog is applied to that cell.
 *
 * @param {object} instance - The instance whose sight is being cleared (must have properties `i`, `j`, `sight`, `owner`, and `parent`).
 */
function clearCellOnInstanceSight(instance) {
  // If the entire map is revealed, skip the process
  if (instance.parent.revealEverything) return;
  var instX = instance.i,
    instY = instance.j,
    sight = instance.sight,
    owner = instance.owner,
    parent = instance.parent;
  var views = owner.views;

  // Get cells around the instance within its sight range
  getPlainCellsAroundPoint(instX, instY, views, sight, function (cell) {
    // Check if the cell is within the sight radius based on distance
    if (pointsDistance(instX, instY, cell.i, cell.j) <= sight) {
      var idx = cell.viewBy.indexOf(instance);

      // If the instance is in the viewBy array, remove it
      if (idx !== -1) {
        cell.viewBy.splice(idx, 1);

        // If the cell is no longer viewed by any instance, apply fog after a slight delay
        if (!cell.viewBy.length && owner.isPlayed && !parent.revealEverything) {
          setTimeout(function () {
            if (parent && !cell.viewBy.length) {
              parent.grid[cell.i][cell.j].setFog();
            }
          }, 30);
        }
      }
    }
  });
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
    var surroundingCells = getPlainCellsAroundPoint(randomX, randomY, grid, size);
    var _iterator2 = _createForOfIteratorHelper(surroundingCells),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var surroundingCell = _step2.value;
        if (!condition(surroundingCell)) {
          isFree = false;
          break; // Exit early if a cell does not meet the condition
        }
      }

      // If the area is free, return the valid cell
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
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
  var dist = instance.size === 3 ? 1 : 0;
  var isInSight = false; // Flag to track if the instance is in player sight

  (player === null || player === void 0 ? void 0 : player.views) && getPlainCellsAroundPoint(instance.i, instance.j, player.views, dist, function (cell) {
    if (cell.viewBy.length > 0) {
      isInSight = true; // Set the flag if the condition is met
    }
  });
  return isInSight; // Return the flag
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
function getPlainCellsAroundPoint(startX, startY, grid) {
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
 * Get the coordinates around a point within a Manhattan distance
 * @param {number} startX
 * @param {number} startY
 * @param {Array} grid
 * @param {number} dist
 * @param {Function} callback
 * @returns {Array} Array of cells that match the criteria
 */
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
    if (!grid[x]) continue; // Skip if row does not exist

    var dyMax = dist - Math.abs(dx);
    for (var dy = -dyMax; dy <= dyMax; dy++) {
      var y = startY + dy;
      var row = grid[x];
      if (!row || !row[y]) continue; // Skip if cell does not exist

      var cell = row[y];
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
  var _iterator3 = _createForOfIteratorHelper(instances),
    _step3;
  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var targetInstance = _step3.value;
      var distance = instancesDistance(instance, targetInstance);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestInstance = targetInstance;
      }
    }

    // Return the closest instance, or false if no valid instance was found
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
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
  var closest = null;
  var _iterator4 = _createForOfIteratorHelper(instances),
    _step4;
  try {
    for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
      var target = _step4.value;
      var path = getInstanceClosestFreeCellPath(instance, target, instance.parent);

      // If a valid path exists, compare its length to the current closest
      if (path.length && (!closest || path.length < closest.path.length)) {
        closest = {
          instance: target,
          path: path
        };
      }
    }
  } catch (err) {
    _iterator4.e(err);
  } finally {
    _iterator4.f();
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
  var sheetToReset = ['actionSheet', 'dyingSheet', 'corpseSheet'];
  // Sheet don't exist we just block the current sheet
  if (!instance[sheet]) {
    if (instance.currentSheet !== 'walkingSheet' && instance.walkingSheet) {
      instance.sprite.textures = [instance.walkingSheet.textures[Object.keys(instance.walkingSheet.textures)[0]]];
    } else {
      instance.sprite.textures = [instance.sprite.textures[instance.sprite.currentFrame]];
    }
    instance.currentSheet = 'walkingSheet';
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
  var direction = maths_degreeToDirection(instance.degree);
  switch (direction) {
    case 'southest':
      instance.sprite.scale.x = -1;
      instance.sprite.textures = instance[sheet].animations['southwest'];
      break;
    case 'northest':
      instance.sprite.scale.x = -1;
      instance.sprite.textures = instance[sheet].animations['northwest'];
      break;
    case 'est':
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
    wheat: 'farmer',
    wood: 'woodcutter',
    berry: 'forager',
    stone: 'stoneminer',
    gold: 'goldminer',
    meat: 'hunter',
    fish: 'fisher'
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
      return source.type === 'Villager' && target.family === 'animal' && target.quantity > 0 && target.isDead && !target.isDestroyed;
    },
    fishing: function fishing() {
      return target.category === 'Fish' && target.allowAction.includes(source.type) && target.quantity > 0 && !target.isDestroyed;
    },
    hunt: function hunt() {
      return source.type === 'Villager' && target.family === 'animal' && target.quantity > 0 && target.hitPoints > 0 && !target.isDead;
    },
    chopwood: function chopwood() {
      return source.type === 'Villager' && target.type === 'Tree' && target.quantity > 0 && !target.isDead;
    },
    farm: function farm() {
      var _target$owner;
      return source.type === 'Villager' && target.type === 'Farm' && target.hitPoints > 0 && ((_target$owner = target.owner) === null || _target$owner === void 0 ? void 0 : _target$owner.label) === source.owner.label && target.quantity > 0 && (!target.isUsedBy || target.isUsedBy === source) && !target.isDead;
    },
    forageberry: function forageberry() {
      return source.type === 'Villager' && target.type === 'Berrybush' && target.quantity > 0 && !target.isDead;
    },
    minestone: function minestone() {
      return source.type === 'Villager' && target.type === 'Stone' && target.quantity > 0 && !target.isDead;
    },
    minegold: function minegold() {
      return source.type === 'Villager' && target.type === 'Gold' && target.quantity > 0 && !target.isDead;
    },
    build: function build() {
      var _target$owner2;
      return source.type === 'Villager' && ((_target$owner2 = target.owner) === null || _target$owner2 === void 0 ? void 0 : _target$owner2.label) === source.owner.label && target.family === 'building' && target.hitPoints > 0 && (!target.isBuilt || target.hitPoints < target.totalHitPoints) && !target.isDead;
    },
    attack: function attack() {
      var _target$owner3;
      return target && ((_target$owner3 = target.owner) === null || _target$owner3 === void 0 ? void 0 : _target$owner3.label) !== source.owner.label && ['building', 'unit', 'animal'].includes(target.family) && target.hitPoints > 0 && !target.isDead;
    },
    heal: function heal() {
      var _target$owner4;
      return target && ((_target$owner4 = target.owner) === null || _target$owner4 === void 0 ? void 0 : _target$owner4.label) === source.owner.label && target.family === 'unit' && target.hitPoints > 0 && target.hitPoints < target.totalHitPoints && !target.isDead;
    }
  };
  return target && target !== source && source.hitPoints > 0 && !source.isDead && conditions[action](props);
};
;// ./app/lib/index.js





;// ./app/classes/resource.js
function resource_typeof(o) { "@babel/helpers - typeof"; return resource_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, resource_typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == resource_typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != resource_typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != resource_typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == resource_typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }




var Resource = /*#__PURE__*/function (_Container) {
  function Resource(options, context) {
    var _this$quantity, _this$hitPoints;
    var _this;
    _classCallCheck(this, Resource);
    _this = _callSuper(this, Resource);
    _this.context = context;
    var _this2 = _this,
      map = _this2.context.map;
    _this.label = uuidv4();
    _this.family = 'resource';
    _this.selected = false;
    _this.isDead = false;
    _this.isDestroyed = false;
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
    _this.sprite.label = 'sprite';
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
    return _this;
  }
  _inherits(Resource, _Container);
  return _createClass(Resource, [{
    key: "select",
    value: function select() {
      if (this.selected) {
        return;
      }
      this.selected = true;
      var selection = new lib/* Graphics */.A1g();
      selection.label = 'selection';
      selection.zIndex = 3;
      var path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size];
      selection.poly(path);
      selection.stroke(COLOR_WHITE);
      this.addChildAt(selection, 0);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) {
        return;
      }
      this.selected = false;
      var selection = this.getChildByLabel('selection');
      if (selection) {
        this.removeChild(selection);
      }
    }
  }, {
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
        if (players[i].type === 'AI') {
          var list = players[i][listName];
          if (list) {
            var _index = list.indexOf(this);
            list.splice(_index, 1);
          }
        }
      }
      // Remove from map resources
      var index = map.resources.indexOf(this);
      if (index >= 0) {
        map.resources.splice(index, 1);
      }
      menu.updateResourcesMiniMap();
      this.isDead = true;
      if (this.type === 'Tree' && !immediate) {
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
        map.grid[this.i][this.j].corpses.push(this);
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
      var corpseIndex = map.grid[this.i][this.j].corpses.indexOf(this);
      corpseIndex >= 0 && map.grid[this.i][this.j].corpses.splice(corpseIndex, 1);
      map.removeChild(this);
      this.destroy({
        child: true,
        texture: true
      });
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var menu = this.context.menu;
      var typeDiv = document.createElement('div');
      typeDiv.id = 'type';
      typeDiv.textContent = this.type;
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = 'icon';
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      if (this.hitPoints) {
        var hitPointsDiv = document.createElement('div');
        hitPointsDiv.id = 'hitPoints';
        hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints;
        element.appendChild(hitPointsDiv);
      }
      if (this.quantity) {
        var quantityDiv = document.createElement('div');
        quantityDiv.id = 'quantity';
        quantityDiv.className = 'resource-quantity';
        var iconToUse;
        switch (this.type) {
          case 'Tree':
            iconToUse = menu.infoIcons['wood'];
            break;
          case 'Salmon':
          case 'Berrybush':
            iconToUse = menu.infoIcons['food'];
            break;
          case 'Stone':
            iconToUse = menu.infoIcons['stone'];
            break;
          case 'Gold':
            iconToUse = menu.infoIcons['gold'];
            break;
        }
        var smallIconImg = document.createElement('img');
        smallIconImg.src = iconToUse;
        smallIconImg.className = 'resource-quantity-icon';
        var textDiv = document.createElement('div');
        textDiv.id = 'quantity-text';
        textDiv.textContent = this.quantity;
        quantityDiv.appendChild(smallIconImg);
        quantityDiv.appendChild(textDiv);
        element.appendChild(quantityDiv);
      }
    }
  }]);
}(lib/* Container */.mcf);
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
    _this.family = 'projectile';
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(_this.owner.owner.config.projectiles[_this.type]).forEach(function (prop) {
      _this[prop] = _this.owner.owner.config.projectiles[_this.type][prop];
    });
    _this.x = _this.owner.x;
    _this.y = _this.owner.y - _this.owner.sprite.height / 2;
    var _ref = _this.destination || _this.target,
      targetX = _ref.x,
      targetY = _ref.y;
    _this.owner.visible && _this.sounds.start && sound_lib/* sound */.s3.play(Array.isArray(_this.sounds.start) ? maths_randomItem(_this.sounds.start) : _this.sounds.start);
    _this.distance = maths_instancesDistance(_this, _this.target, false);
    var degree = _this.degree || getPointsDegree(_this.x, _this.y, targetX, targetY);
    var sprite = new lib/* Graphics */.A1g();
    sprite.rect(1, 1, _this.size, 1);
    sprite.fill(COLOR_ARROW);
    sprite.rotation = degreesToRadians(degree);
    sprite.label = 'sprite';
    sprite.allowMove = false;
    sprite.eventMode = 'none';
    sprite.allowClick = false;
    sprite.roundPixels = true;
    _this.addChild(sprite);
    var interval = setInterval(function () {
      if (maths_pointsDistance(_this.x, _this.y, targetX, targetY) <= Math.max(_this.speed, _this.size)) {
        if (maths_pointsDistance(targetX, targetY, _this.target.x, _this.target.y) <= average(_this.target.width, _this.target.height)) {
          _this.onHit(_this.target);
        }
        clearInterval(interval);
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
        menu.updateInfo('hitPoints', instance.hitPoints + '/' + instance.totalHitPoints);
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
      this.destroy({
        child: true,
        texture: true
      });
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/classes/building.js
function building_typeof(o) { "@babel/helpers - typeof"; return building_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, building_typeof(o); }
function building_slicedToArray(r, e) { return building_arrayWithHoles(r) || building_iterableToArrayLimit(r, e) || building_unsupportedIterableToArray(r, e) || building_nonIterableRest(); }
function building_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function building_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function building_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = building_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
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
function building_getPrototypeOf(t) { return building_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, building_getPrototypeOf(t); }
function building_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && building_setPrototypeOf(t, e); }
function building_setPrototypeOf(t, e) { return building_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, building_setPrototypeOf(t, e); }






var Building = /*#__PURE__*/function (_Container) {
  function Building(options, context) {
    var _this$quantity, _this$hitPoints;
    var _this;
    building_classCallCheck(this, Building);
    _this = building_callSuper(this, Building);
    _this.context = context;
    var map = context.map,
      controls = context.controls;
    _this.label = uuidv4();
    _this.family = 'building';
    _this.selected = false;
    _this.queue = [];
    _this.technology = null;
    _this.loading = null;
    _this.isDead = false;
    _this.isDestroyed = false;
    _this.timeout;
    _this.isUsedBy = null;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(_this.owner.config.buildings[_this.type]).forEach(function (prop) {
      _this[prop] = _this.owner.config.buildings[_this.type][prop];
    });
    _this.interval;
    _this.attackInterval;
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
    _this.visible = map.revealEverything && controls.instanceInCamera(_this) ? true : false;
    var spriteSheet = getBuildingTextureNameWithSize(_this.size);
    if (_this.type === 'House' && _this.owner.age === 0) {
      spriteSheet = '000_489';
    } else if (_this.type === 'Dock') {
      spriteSheet = '000_356';
    }
    var texture = getTexture(spriteSheet, lib/* Assets */.sP);
    _this.sprite = lib/* Sprite */.kxk.from(texture);
    _this.sprite.updateAnchor = true;
    _this.sprite.label = 'sprite';
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
        _this.setDefaultInterface(element, assets);
        if (_this.displayPopulation && _this.owner.isPlayed && _this.isBuilt) {
          var populationDiv = document.createElement('div');
          populationDiv.id = 'population';
          var populationIcon = document.createElement('img');
          var populationSpan = document.createElement('span');
          populationSpan.id = 'population-text';
          populationSpan.textContent = _this.owner.population + '/' + Math.min(POPULATION_MAX, _this.owner.POPULATION_MAX);
          populationIcon.src = getIconPath('004_50731');
          populationDiv.appendChild(populationIcon);
          populationDiv.appendChild(populationSpan);
          element.appendChild(populationDiv);
        }
        element.appendChild(_this.getLoadingElement());
      },
      menu: _this.owner.isPlayed || map.devMode ? [].concat(building_toConsumableArray(units), building_toConsumableArray(technologies)) : []
    };

    // Set solid zone
    var dist = _this.size === 3 ? 1 : 0;
    getPlainCellsAroundPoint(_this.i, _this.j, map.grid, dist, function (cell) {
      var set = cell.getChildByLabel('set');
      if (set) {
        cell.removeChild(set);
      }
      for (var i = 0; i < cell.corpses.length; i++) {
        typeof cell.corpses[i].clear === 'function' && cell.corpses[i].clear();
      }
      cell.has = _this;
      cell.solid = true;
      _this.owner.views[cell.i][cell.j].viewBy.push(_this);
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
              if (unit.type === 'Villager') {
                if (extra_getActionCondition(unit, _this, 'build')) {
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
              var voice = randomItem(['5075', '5076', '5128', '5164']);
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
              var accept = _unit.category === 'Boat' ? _this.type === 'Dock' : _this.type === 'TownCenter' || _this.accept && _this.accept.includes(_unit.loadingType);
              if (_unit.type === 'Villager' && extra_getActionCondition(_unit, _this, 'build')) {
                hasSentVillager = true;
                _unit.previousDest = null;
                _unit.sendToBuilding(_this);
              } else if (_unit.type === 'Villager' && extra_getActionCondition(_unit, _this, 'farm')) {
                hasSentVillager = true;
                _unit.sendToFarm(_this);
              } else if (accept && extra_getActionCondition(_unit, _this, 'delivery', {
                buildingTypes: [_this.type]
              })) {
                hasSentVillager = true;
                _unit.previousDest = null;
                _unit.sendTo(_this, 'delivery');
              }
            }
            if (hasSentVillager) {
              drawInstanceBlinkingSelection(_this);
            }
            if (hasSentVillager) {
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
            if (playerUnit.type === 'Villager') {
              playerUnit.sendToAttack(_this);
            } else {
              playerUnit.sendTo(_this, 'attack');
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
      renderCellOnInstanceSight(_this);
      _this.finalTexture();
      _this.onBuilt();
    }
    return _this;
  }
  building_inherits(Building, _Container);
  return building_createClass(Building, [{
    key: "attackAction",
    value: function attackAction(target) {
      var _this3 = this;
      var map = this.context.map;
      this.startAttackInterval(function () {
        if (extra_getActionCondition(_this3, target, 'attack') && maths_instancesDistance(_this3, target) <= _this3.range) {
          if (target.hitPoints <= 0) {
            target.die();
          } else {
            var projectile = new Projectile({
              owner: _this3,
              type: _this3.projectile,
              target: target
            }, _this3.context);
            map.addChild(projectile);
          }
        } else {
          _this3.stopAttackInterval();
        }
      }, this.rateOfFire);
    }
  }, {
    key: "startInterval",
    value: function startInterval(callback, time) {
      var _this4 = this;
      var finalCb = function finalCb() {
        var paused = _this4.context.paused;
        if (paused) {
          return;
        }
        callback();
      };
      this.stopInterval();
      this.interval = setInterval(finalCb, time * 1000 / 100 / ACCELERATOR);
    }
  }, {
    key: "stopInterval",
    value: function stopInterval() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  }, {
    key: "startAttackInterval",
    value: function startAttackInterval(callback, time) {
      var _this5 = this;
      var finalCb = function finalCb() {
        var paused = _this5.context.paused;
        if (paused) {
          return;
        }
        callback();
      };
      this.stopAttackInterval();
      finalCb();
      this.attackInterval = setInterval(finalCb, time * 1000);
    }
  }, {
    key: "stopAttackInterval",
    value: function stopAttackInterval() {
      if (this.attackInterval) {
        clearInterval(this.attackInterval);
        this.attackInterval = null;
      }
    }
  }, {
    key: "pause",
    value: function pause() {
      var _this$timeout;
      (_this$timeout = this.timeout) === null || _this$timeout === void 0 || _this$timeout.pause();
    }
  }, {
    key: "resume",
    value: function resume() {
      var _this$timeout2;
      (_this$timeout2 = this.timeout) === null || _this$timeout2 === void 0 || _this$timeout2.resume();
    }
  }, {
    key: "startTimeout",
    value: function startTimeout(cb, time) {
      this.stopTimeout();
      this.timeout = new CustomTimeout(function () {
        return cb();
      }, time * 1000 / ACCELERATOR);
    }
  }, {
    key: "stopTimeout",
    value: function stopTimeout() {
      if (this.timeout) {
        clearInterval(this.timeout);
        this.timeout = null;
      }
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      if (this.isDead) {
        return;
      }
      if (this.range && extra_getActionCondition(this, instance, 'attack') && maths_instancesDistance(this, instance) <= this.range) {
        this.attackAction(instance);
      }
      this.updateHitPoints('attack');
    }
  }, {
    key: "updateTexture",
    value: function updateTexture() {
      var menu = this.context.menu;
      var percentage = maths_getPercentage(this.hitPoints, this.totalHitPoints);
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
          if (this.owner.isPlayed && this.sounds && this.sounds.create) {
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
        renderCellOnInstanceSight(this);
      }
    }
  }, {
    key: "onBuilt",
    value: function onBuilt() {
      var menu = this.context.menu;
      if (this.increasePopulation) {
        // Increase player population and continue all unit creation that was paused
        this.owner.POPULATION_MAX += this.increasePopulation;
        // Update bottombar with POPULATION_MAX if house selected
        if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
          menu.updateInfo('population-text', this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX));
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
      var color = this.getChildByLabel('color');
      if (color) {
        color.destroy();
      }
      if (assets.images.color) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(assets.images.color, lib/* Assets */.sP));
        spriteColor.label = 'color';
        changeSpriteColorDirectly(spriteColor, this.owner.color);
        this.addChild(spriteColor);
      } else {
        changeSpriteColorDirectly(this.sprite, this.owner.color);
      }
      if (this.type === 'House') {
        if (this.owner.age === 0) {
          var spritesheetFire = lib/* Assets */.sP.cache.get('347');
          var spriteFire = new lib/* AnimatedSprite */.Dl5(spritesheetFire.animations['fire']);
          spriteFire.label = 'deco';
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
          var fire = this.getChildByLabel('deco');
          if (fire) {
            fire.destroy();
          }
        }
      }
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      if (this.range && instance.label !== 'animal' && !this.attackInterval && extra_getActionCondition(this, instance, 'attack') && maths_instancesDistance(this, instance) <= this.range) {
        this.attackAction(instance);
      }
    }
  }, {
    key: "updateHitPoints",
    value: function updateHitPoints(action) {
      if (this.hitPoints > this.totalHitPoints) {
        this.hitPoints = this.totalHitPoints;
      }
      var percentage = maths_getPercentage(this.hitPoints, this.totalHitPoints);
      if (this.hitPoints <= 0) {
        this.die();
      }
      if (action === 'build' && !this.isBuilt) {
        this.updateTexture();
      } else if (action === 'attack' && this.isBuilt || action === 'build' && this.isBuilt) {
        if (percentage > 0 && percentage < 25) {
          generateFire(this, '450');
        }
        if (percentage >= 25 && percentage < 50) {
          generateFire(this, '452');
        }
        if (percentage >= 50 && percentage < 75) {
          generateFire(this, '347');
        }
        if (percentage >= 75) {
          var fire = this.getChildByLabel('fire');
          if (fire) {
            this.removeChild(fire);
          }
        }
      }
      function generateFire(building, spriteId) {
        var fire = building.getChildByLabel('fire');
        var spritesheetFire = lib/* Assets */.sP.cache.get(spriteId);
        if (fire) {
          for (var i = 0; i < fire.children.length; i++) {
            fire.children[i].textures = spritesheetFire.animations['fire'];
            fire.children[i].play();
          }
        } else {
          var newFire = new lib/* Container */.mcf();
          newFire.label = 'fire';
          newFire.allowMove = false;
          newFire.allowClick = false;
          newFire.eventMode = 'none';
          var poses = [[0, 0]];
          if (building.size === 3) {
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
          building.addChild(newFire);
        }
      }
    }
  }, {
    key: "die",
    value: function die() {
      var _this6 = this;
      if (this.isDead) {
        return;
      }
      var _this$context = this.context,
        map = _this$context.map,
        player = _this$context.player,
        players = _this$context.players,
        menu = _this$context.menu;
      this.stopInterval();
      this.isDead = true;
      if (this.selected && player) {
        player.unselectAll();
      }

      // Remove from player buildings
      var index = this.owner.buildings.indexOf(this);
      if (index >= 0) {
        this.owner.buildings.splice(index, 1);
      }
      // Remove from view of others players
      for (var i = 0; i < players.length; i++) {
        if (players[i].type === 'AI') {
          var list = players[i].foundedEnemyBuildings;
          list.splice(list.indexOf(this), 1);
        }
      }
      var color = this.getChildByLabel('color');
      color && color.destroy();
      var deco = this.getChildByLabel('deco');
      deco && deco.destroy();
      var fire = this.getChildByLabel('fire');
      fire && fire.destroy();
      var rubbleSheet = getBuildingRubbleTextureNameWithSize(this.size, lib/* Assets */.sP);
      if (this.type === 'Farm') {
        rubbleSheet = '000_239';
      }
      this.sprite.texture = getTexture(rubbleSheet, lib/* Assets */.sP);
      this.sprite.allowMove = false;
      this.sprite.eventMode = 'none';
      this.sprite.allowClick = false;
      this.zIndex--;
      if (this.type === 'Farm') {
        changeSpriteColorDirectly(this.sprite, this.owner.color);
      }
      // Remove solid zone
      clearCellOnInstanceSight(this);
      var dist = this.size === 3 ? 1 : 0;
      getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, function (cell) {
        if (cell.has === _this6) {
          cell.has = null;
          cell.solid = false;
          cell.corpses.push(_this6);
        }
      });
      this.startTimeout(function () {
        return _this6.clear();
      }, RUBBLE_TIME);
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "clear",
    value: function clear() {
      var _this7 = this;
      if (this.isDestroyed) {
        return;
      }
      var map = this.context.map;
      var dist = this.size === 3 ? 1 : 0;
      getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, function (cell) {
        var index = cell.corpses.indexOf(_this7);
        if (index >= 0) {
          cell.corpses.splice(index, 1);
        }
      });
      this.isDestroyed = true;
      this.destroy({
        child: true,
        texture: true
      });
    }
  }, {
    key: "select",
    value: function select() {
      if (this.selected) {
        return;
      }
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        player = _this$context2.player;
      if (this.owner.isPlayed && this.sounds && this.sounds.create) {
        sound_lib/* sound */.s3.play(this.sounds.create);
      }
      this.selected = true;
      var selection = new lib/* Graphics */.A1g();
      selection.label = 'selection';
      selection.zIndex = 3;
      var path = [-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size];
      selection.poly(path);
      selection.stroke(COLOR_WHITE);
      if (this.loading && this.owner.isPlayed) {
        this.updateInterfaceLoading();
      }
      this.addChildAt(selection, 0);
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) {
        return;
      }
      var _this$context3 = this.context,
        menu = _this$context3.menu,
        player = _this$context3.player;
      this.selected = false;
      var selection = this.getChildByLabel('selection');
      if (selection) {
        this.removeChild(selection);
      }
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "placeUnit",
    value: function placeUnit(type) {
      var _this$context4 = this.context,
        map = _this$context4.map,
        menu = _this$context4.menu;
      var spawnCell;
      var config = this.owner.config.units[type];
      if (config.category === 'Boat') {
        spawnCell = getFreeCellAroundPoint(this.i, this.j, this.size, map.grid, function (cell) {
          return cell.category === 'Water' && !cell.solid;
        });
      } else {
        spawnCell = getFreeCellAroundPoint(this.i, this.j, this.size, map.grid, function (cell) {
          return cell.category !== 'Water' && !cell.solid;
        });
      }
      if (!spawnCell) {
        return;
      }
      this.owner.population++;
      var extra = this.owner.getUnitExtraOptions && this.owner.getUnitExtraOptions(type) || {};
      this.owner.createUnit(_objectSpread({
        i: spawnCell.i,
        j: spawnCell.j,
        type: type
      }, extra));
      if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
        menu.updateInfo('population-text', this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX));
      }
    }
  }, {
    key: "buyUnit",
    value: function buyUnit(type) {
      var _this8 = this;
      var alreadyPaid = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var force = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var extra = arguments.length > 3 ? arguments[3] : undefined;
      var _this$context5 = this.context,
        menu = _this$context5.menu,
        map = _this$context5.map;
      var success = false;
      var unit = this.owner.config.units[type];
      if (this.isBuilt && !this.isDead && (canAfford(this.owner, unit.cost) || alreadyPaid)) {
        if (!alreadyPaid) {
          if (this.owner.type === 'AI') {
            if (!this.queue.length && this.loading === null) {
              payCost(this.owner, unit.cost);
              this.queue.push(type);
              success = true;
            }
          } else {
            payCost(this.owner, unit.cost);
            this.queue.push(type);
            if (this.selected && this.owner.isPlayed) {
              menu.updateButtonContent(type, this.queue.filter(function (q) {
                return q === type;
              }).length);
            }
            this.owner.isPlayed && menu.updateTopbar();
            success = true;
          }
        }
        if (this.loading === null && this.queue[0] || force) {
          var hasShowedMessage = false;
          this.loading = force ? this.loading : 0;
          if (this.selected && this.owner.isPlayed) {
            this.updateInterfaceLoading();
          }
          this.startInterval(function () {
            if (_this8.queue[0] !== type) {
              _this8.stopInterval();
              _this8.loading = null;
              if (_this8.queue.length) {
                _this8.buyUnit(_this8.queue[0], true);
              }
              hasShowedMessage = false;
              if (_this8.selected && _this8.owner.isPlayed) {
                var still = _this8.queue.filter(function (q) {
                  return q === type;
                }).length;
                menu.updateButtonContent(type, still || '');
                if (still === 0) {
                  menu.toggleButtonCancel(type, false);
                }
                _this8.updateInterfaceLoading();
              }
            } else if (_this8.loading >= 100 || map.devMode) {
              _this8.stopInterval();
              _this8.placeUnit(type, extra);
              _this8.loading = null;
              _this8.queue.shift();
              if (_this8.queue.length) {
                _this8.buyUnit(_this8.queue[0], true);
              }
              hasShowedMessage = false;
              if (_this8.selected && _this8.owner.isPlayed) {
                var _still = _this8.queue.filter(function (q) {
                  return q === type;
                }).length;
                menu.updateButtonContent(type, _still || '');
                if (_still === 0) {
                  menu.toggleButtonCancel(type, false);
                }
                _this8.updateInterfaceLoading();
              }
            } else if (_this8.loading < 100) {
              if (_this8.owner.population < Math.min(POPULATION_MAX, _this8.owner.POPULATION_MAX)) {
                _this8.loading += 1;
              } else if (_this8.owner.isPlayed && !hasShowedMessage) {
                menu.showMessage('You need to build more houses');
                hasShowedMessage = true;
              }
              if (_this8.selected && _this8.owner.isPlayed) {
                _this8.updateInterfaceLoading();
              }
            }
          }, unit.trainingTime);
        }
        return success;
      }
    }
  }, {
    key: "updateInterfaceLoading",
    value: function updateInterfaceLoading() {
      var _this9 = this;
      var menu = this.context.menu;
      if (this.owner.isPlayed && this.owner.selectedBuilding === this) {
        if (this.loading === 1) {
          menu.updateInfo('loading', function (element) {
            return element.innerHTML = _this9.getLoadingElement().innerHTML;
          });
        } else if (this.loading > 1) {
          menu.updateInfo('loading-text', this.loading + '%');
        } else {
          menu.updateInfo('loading', function (element) {
            return element.innerHTML = '';
          });
        }
      }
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      var loadingDiv = document.createElement('div');
      loadingDiv.className = 'building-loading';
      loadingDiv.id = 'loading';
      if (this.loading && this.owner.isPlayed) {
        var iconImg = document.createElement('img');
        iconImg.className = 'building-loading-icon';
        iconImg.src = getIconPath('009_50731');
        var textDiv = document.createElement('div');
        textDiv.id = 'loading-text';
        textDiv.textContent = this.loading + '%';
        loadingDiv.appendChild(iconImg);
        loadingDiv.appendChild(textDiv);
      }
      return loadingDiv;
    }
  }, {
    key: "cancelTechnology",
    value: function cancelTechnology() {
      var _this$context6 = this.context,
        player = _this$context6.player,
        menu = _this$context6.menu;
      this.stopInterval();
      refundCost(player, this.technology.cost);
      this.technology = null;
      this.loading = null;
      if (this.owner.isPlayed) {
        menu.updateBottombar();
        menu.updateTopbar();
      }
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      var data = this.owner.config.buildings[type];
      this.type = type;
      this.hitPoints = data.totalHitPoints - (this.totalHitPoints - this.hitPoints);
      for (var _i4 = 0, _Object$entries = Object.entries(data); _i4 < _Object$entries.length; _i4++) {
        var _Object$entries$_i = building_slicedToArray(_Object$entries[_i4], 2),
          key = _Object$entries$_i[0],
          value = _Object$entries$_i[1];
        this[key] = value;
      }
      var assets = getBuildingAsset(this.type, this.owner, lib/* Assets */.sP);
      this.sprite.texture = getTexture(assets.images["final"], lib/* Assets */.sP);
      this.sprite.anchor.set(this.sprite.texture.defaultAnchor.x, this.sprite.texture.defaultAnchor.y);
      var color = this.getChildByLabel('color');
      color === null || color === void 0 || color.destroy();
      if (assets.images.color) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(assets.images.color, lib/* Assets */.sP));
        spriteColor.label = 'color';
        changeSpriteColorDirectly(spriteColor, this.owner.color);
        this.addChild(spriteColor);
      } else {
        changeSpriteColorDirectly(this.sprite, this.owner.color);
      }
    }
  }, {
    key: "buyTechnology",
    value: function buyTechnology(type, alreadyPaid, force) {
      var _this0 = this;
      var _this$context7 = this.context,
        menu = _this$context7.menu,
        map = _this$context7.map;
      var success = false;
      var config = this.owner.techs[type];
      if (!this.queue.length && this.isBuilt && (force || this.loading === null) && !this.isDead && (alreadyPaid || canAfford(this.owner, config.cost))) {
        !alreadyPaid && payCost(this.owner, config.cost);
        success = true;
        if (this.owner.isPlayed) {
          menu.updateTopbar();
        }
        this.loading = force ? this.loading : 0;
        this.technology = {
          config: config,
          type: type
        };
        if (this.selected && this.owner.selectedBuilding === this) {
          menu.setBottombar(this);
        }
        this.startInterval(function () {
          var _this0$technology = _this0.technology,
            config = _this0$technology.config,
            type = _this0$technology.type;
          if (_this0.loading >= 100 || map.devMode) {
            _this0.stopInterval();
            _this0.loading = null;
            _this0.technology = null;
            if (Array.isArray(_this0.owner[config.key])) {
              _this0.owner[config.key].push(config.value || type);
            } else {
              _this0.owner[config.key] = config.value || type;
            }
            if (config.action) {
              switch (config.action.type) {
                case 'upgradeUnit':
                  for (var i = 0; i < _this0.owner.units.length; i++) {
                    var unit = _this0.owner.units[i];
                    if (unit.type === config.action.source) {
                      unit.upgrade(config.action.target);
                    }
                  }
                  break;
                case 'upgradeBuilding':
                  for (var _i5 = 0; _i5 < _this0.owner.buildings.length; _i5++) {
                    var building = _this0.owner.buildings[_i5];
                    if (building.type === config.action.source) {
                      building.upgrade(technconfigology.action.target);
                    }
                  }
                  break;
                case 'improve':
                  _this0.owner.updateConfig(config.action.operations);
                  break;
              }
            }
            var functionName = "on".concat(capitalizeFirstLetter(config.key), "Change");
            typeof _this0.owner[functionName] === 'function' && _this0.owner[functionName](config.value);
            if (_this0.owner.isPlayed) {
              menu.updateBottombar();
              menu.updateTopbar();
            }
          } else if (_this0.loading < 100) {
            _this0.loading += 1;
            if (_this0.owner.isPlayed && _this0.owner.selectedBuilding === _this0) {
              _this0.updateInterfaceLoading();
            }
          }
        }, config.researchTime);
      }
      return success;
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var menu = this.context.menu;
      var civDiv = document.createElement('div');
      civDiv.id = 'civ';
      civDiv.textContent = this.owner.civ;
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = 'type';
      typeDiv.textContent = this.type;
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = 'icon';
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      if (this.owner && this.owner.isPlayed) {
        var hitPointsDiv = document.createElement('div');
        hitPointsDiv.id = 'hitPoints';
        hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints;
        element.appendChild(hitPointsDiv);
        if (this.isBuilt && this.quantity) {
          var quantityDiv = document.createElement('div');
          quantityDiv.id = 'quantity';
          quantityDiv.className = 'resource-quantity';
          var smallIconImg = document.createElement('img');
          smallIconImg.src = menu.icons['food'];
          smallIconImg.className = 'resource-quantity-icon';
          var textDiv = document.createElement('div');
          textDiv.id = 'quantity-text';
          textDiv.textContent = this.quantity;
          quantityDiv.appendChild(smallIconImg);
          quantityDiv.appendChild(textDiv);
          element.appendChild(quantityDiv);
        }
      }
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/classes/unit.js
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
function unit_getPrototypeOf(t) { return unit_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, unit_getPrototypeOf(t); }
function unit_inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && unit_setPrototypeOf(t, e); }
function unit_setPrototypeOf(t, e) { return unit_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, unit_setPrototypeOf(t, e); }





function getActionSheet(work, action, Assets, unit) {
  if (!work) {
    return;
  }
  var actionSheet = action === 'takemeat' ? 'harvestSheet' : 'actionSheet';
  return Assets.cache.get(unit.allAssets[work][actionSheet]);
}
var Unit = /*#__PURE__*/function (_Container) {
  function Unit(options, context) {
    var _this$x, _this$y, _this$z, _this$quantity, _this$hitPoints, _this$loop;
    var _this;
    unit_classCallCheck(this, Unit);
    _this = unit_callSuper(this, Unit);
    _this.context = context;
    var _this2 = _this,
      _this2$context = _this2.context,
      map = _this2$context.map,
      menu = _this2$context.menu;
    _this.label = uuidv4();
    _this.family = 'unit';
    _this.dest = null;
    _this.realDest = null;
    _this.previousDest = null;
    _this.path = [];
    _this.selected = false;
    _this.degree = maths_randomRange(1, 360);
    _this.currentFrame = maths_randomRange(0, 4);
    _this.action = null;
    _this.loading = 0;
    _this.loadingType = null;
    _this.currentSheet = 'standingSheet';
    _this.inactif = true;
    _this.isDead = false;
    _this.isDestroyed = false;
    _this.x = null;
    _this.y = null;
    _this.z = null;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(_this.owner.config.units[_this.type]).forEach(function (prop) {
      _this[prop] = _this.owner.config.units[_this.type][prop];
    });
    _this.size = 1;
    _this.visible = false;
    _this.x = (_this$x = _this.x) !== null && _this$x !== void 0 ? _this$x : map.grid[_this.i][_this.j].x;
    _this.y = (_this$y = _this.y) !== null && _this$y !== void 0 ? _this$y : map.grid[_this.i][_this.j].y;
    _this.z = (_this$z = _this.z) !== null && _this$z !== void 0 ? _this$z : map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.totalHitPoints;
    _this.currentCell = map.grid[_this.i][_this.j];
    if (_this.currentSheet === 'corpseSheet') {
      _this.owner.corpses.push(_this);
      map.grid[_this.i][_this.j].corpses.push(_this);
    } else if (!_this.isDead) {
      _this.currentCell.has = _this;
      _this.currentCell.solid = true;
      _this.owner.units.push(_this);
    }
    switch (_this.type) {
      case 'Villager':
        _this.work = _this.work || null;
        break;
      case 'Priest':
        _this.work = 'healer';
        break;
      default:
        _this.work = 'attacker';
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
    if (_this.owner.isPlayed && map.ready) {
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
    _this.actionSheet = _this.actionSheet || getActionSheet(_this.work, _this.action, lib/* Assets */.sP, _this);
    _this.sprite = new lib/* AnimatedSprite */.Dl5(_this['standingSheet'].animations['south']);
    _this.sprite.label = 'sprite';
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'auto';
    _this.sprite.allowClick = false;
    _this.sprite.roundPixels = true;
    _this.sprite.loop = (_this$loop = _this.loop) !== null && _this$loop !== void 0 ? _this$loop : true;
    if (_this.isDead) {
      _this.currentSheet === 'corpseSheet' ? _this.decompose() : _this.death();
    } else if (_this.loading > 0) {
      _this.walkingSheet = lib/* Assets */.sP.cache.get(_this.allAssets[getWorkWithLoadingType(_this.loadingType)].loadedSheet);
      _this.standingSheet = lib/* Assets */.sP.cache.get(_this.allAssets[getWorkWithLoadingType(_this.loadingType)].standingSheet);
    }
    _this.setTextures(_this.currentSheet);
    _this.sprite.currentFrame = Math.min(_this.currentFrame, _this.sprite.textures.length - 1);
    _this.sprite.updateAnchor = true;
    _this.addChild(_this.sprite);
    _this.sendTo = _this.owner.isPlayed ? throttle(_this.sendToEvt, 100, true) : _this.sendToEvt;
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
            if (playerUnit.work === 'healer' && _this.getActionCondition(playerUnit, 'heal')) {
              hasSentHealer = true;
              playerUnit.sendTo(_this, 'heal');
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
            if (_this.getActionCondition(_playerUnit, 'attack')) if (_playerUnit.type === 'Villager') {
              hasSentAttacker = true;
              _playerUnit.sendToAttack(_this);
            } else if (_playerUnit.work === 'attacker') {
              hasSentAttacker = true;
              _playerUnit.sendTo(_this, 'attack');
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
    _this.interval = null;
    renderCellOnInstanceSight(_this);
    return _this;
  }
  unit_inherits(Unit, _Container);
  return unit_createClass(Unit, [{
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
      if (this.selected) return;
      var _this$context = this.context,
        menu = _this$context.menu,
        player = _this$context.player;
      this.selected = true;
      var selection = new lib/* Graphics */.A1g();
      selection.label = 'selection';
      selection.zIndex = 3;

      // Diamond shape
      var path = [-32 * 0.5, 0, 0, -16 * 0.5, 32 * 0.5, 0, 0, 16 * 0.5];
      selection.poly(path);
      selection.stroke(COLOR_WHITE);
      this.addChildAt(selection, 0);
      if (canUpdateMinimap(this, player)) {
        menu.updatePlayerMiniMapEvt(this.owner);
      }
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) {
        return;
      }
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        player = _this$context2.player;
      this.selected = false;
      var selection = this.getChildByLabel('selection');
      if (selection) {
        this.removeChild(selection);
      }
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
      if (!dest) {
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
      this.setTextures('walkingSheet');
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
      var _map$grid$this$i$this;
      var map = this.context.map;
      this.handleChangeDest();
      this.stopInterval();
      var path = [];
      // No instance we cancel the destination
      if (!dest || this.isDead) {
        return;
      }
      // Unit is already beside our target
      if (this.isUnitAtDest(action, dest) && (!map.grid[this.i][this.j].solid || map.grid[this.i][this.j].solid && ((_map$grid$this$i$this = map.grid[this.i][this.j].has) === null || _map$grid$this$i$this === void 0 ? void 0 : _map$grid$this$i$this.label) === this.label)) {
        this.setDest(dest);
        this.action = action;
        this.degree = maths_getInstanceDegree(this, dest.x, dest.y);
        this.getAction(action);
        return;
      }
      // Set unit path
      if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
        var allowWaterCellCategory = this.category === 'Boat';
        if (map.grid[dest.i][dest.j].solid) {
          path = getInstanceClosestFreeCellPath(this, dest, map);
          if (!path.length && this.work) {
            this.action = action;
            this.affectNewDest();
            return;
          }
        } else if (!allowWaterCellCategory && dest.category === 'Water') {
          var cell = getFreeCellAroundPoint(dest.i, dest.j, 1, map.grid, function (cell) {
            return cell.category !== 'Water' && !cell.solid;
          });
          this.sendToEvt(cell);
          return;
        }
      }
      if (!path.length) {
        path = getInstancePath(this, dest.i, dest.j, map);
      }
      // Unit found a path, set the action and play walking animation
      if (path.length) {
        this.setDest(dest);
        this.action = action;
        this.setPath(path);
      } else {
        this.stop();
      }
    }
  }, {
    key: "getActionCondition",
    value: function getActionCondition(target) {
      var action = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.action;
      var props = arguments.length > 2 ? arguments[2] : undefined;
      return extra_getActionCondition(this, target, action, props);
    }
  }, {
    key: "goBackToPrevious",
    value: function goBackToPrevious() {
      var map = this.context.map;
      if (!this.previousDest) {
        this.stop();
        return;
      }
      var dest = this.previousDest;
      var type = dest.category || dest.type;
      this.previousDest = null;
      if (dest.family === 'animal') {
        if (this.getActionCondition(dest, 'takemeat')) {
          this.sendToTakeMeat(dest);
        } else {
          this.sendTo(map.grid[dest.i][dest.j], 'hunt');
        }
      } else if (dest.family === 'building') {
        if (this.getActionCondition(dest, 'build')) {
          this.sendToBuilding(dest);
        } else if (this.getActionCondition(dest, 'farm')) {
          this.sendToFarm(dest);
        } else {
          this.sendTo(map.grid[dest.i][dest.j], 'build');
        }
      } else if (TYPE_ACTION[type]) {
        if (this.getActionCondition(dest, TYPE_ACTION[type])) {
          var sendToFunc = "sendTo".concat(type);
          typeof this[sendToFunc] === 'function' ? this[sendToFunc](dest) : this.stop();
        } else {
          this.sendTo(map.grid[dest.i][dest.j], TYPE_ACTION[type]);
        }
      } else {
        this.sendTo(map.grid[dest.i][dest.j]);
      }
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      var _this6 = this;
      var _this$context3 = this.context,
        menu = _this$context3.menu,
        player = _this$context3.player,
        map = _this$context3.map;
      this.sprite.onLoop = null;
      this.sprite.onFrameChange = null;
      switch (name) {
        case 'delivery':
          if (!this.getActionCondition(this.dest, this.action)) {
            this.stop();
            return;
          }
          this.owner[LOADING_FOOD_TYPES.includes(this.loadingType) ? 'food' : this.loadingType] += this.loading;
          this.owner.isPlayed && menu.updateTopbar();
          this.loading = 0;
          this.updateInterfaceLoading();
          if (this.allAssets && this.allAssets[this.work]) {
            this.standingSheet = lib/* Assets */.sP.cache.get(this.allAssets[this.work].standingSheet);
            this.walkingSheet = lib/* Assets */.sP.cache.get(this.allAssets[this.work].walkingSheet);
          }
          if (this.previousDest) {
            this.goBackToPrevious();
          } else {
            this.stop();
          }
          break;
        case 'farm':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.dest.isUsedBy = this;
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest.quantity <= 0) {
                _this6.dest.die();
              }
              _this6.affectNewDest();
              return;
            }
            _this6.dest.isUsedBy = _this6;
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              _this6.dest.isUsedBy = null;
              return;
            }
            // Villager farm the farm
            _this6.loading++;
            _this6.loadingType = 'wheat';
            _this6.updateInterfaceLoading();
            _this6.visible && sound_lib/* sound */.s3.play('5178');
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            if (_this6.dest.selected) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Destroy farm if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.dest.die();
              _this6.affectNewDest();
            }
            // Set the walking with berrybush animation
            if (_this6.loading > 0) {
              if (_this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'chopwood':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest.quantity <= 0) {
                _this6.dest.die();
              }
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            _this6.visible && sound_lib/* sound */.s3.play('5048');

            // Tree destination is still alive we cut him until it's dead
            if (_this6.dest.hitPoints > 0) {
              _this6.dest.hitPoints = Math.max(_this6.dest.hitPoints - 1, 0);
              if (_this6.dest.selected) {
                menu.updateInfo('hitPoints', _this6.dest.hitPoints > 0 ? _this6.dest.hitPoints + '/' + _this6.dest.totalHitPoints : '');
              }
              if (_this6.dest.hitPoints <= 0) {
                // Set cutted tree texture
                _this6.dest.hitPoints = 0;
                _this6.dest.setCuttedTreeTexture();
              }
            } else {
              // Villager cut the stump
              _this6.loading++;
              _this6.loadingType = 'wood';
              _this6.updateInterfaceLoading();
              _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
              if (_this6.dest.selected) {
                menu.updateInfo('quantity-text', _this6.dest.quantity);
              }
              // Destroy tree if stump out of quantity
              if (_this6.dest.quantity <= 0) {
                _this6.dest.die();
                _this6.affectNewDest();
              }
              // Set the walking with wood animation
              if (_this6.loading > 0) {
                if (_this6.allAssets[_this6.work]) {
                  _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
                }
                _this6.standingSheet = null;
              }
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'forageberry':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest.quantity <= 0) {
                _this6.dest.die();
              }
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            // Villager forage the berrybush
            _this6.loading++;
            _this6.loadingType = 'berry';
            _this6.updateInterfaceLoading();
            _this6.visible && sound_lib/* sound */.s3.play('5085');
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            if (_this6.dest.selected) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Destroy berrybush if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.dest.die();
              _this6.affectNewDest();
            }
            // Set the walking with berrybush animation
            if (_this6.loading > 0) {
              if (_this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'minestone':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest.quantity <= 0) {
                _this6.dest.die();
              }
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            // Villager mine the stone
            _this6.loading++;
            _this6.loadingType = 'stone';
            _this6.updateInterfaceLoading();
            _this6.visible && sound_lib/* sound */.s3.play('5159');
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            if (_this6.dest.selected) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Destroy stone if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.dest.die();
              _this6.affectNewDest();
            }
            // Set the walking with stone animation
            if (_this6.loading > 0) {
              if (_this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'minegold':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            // Villager mine the gold
            _this6.loading++;
            _this6.loadingType = 'gold';
            _this6.updateInterfaceLoading();
            _this6.visible && sound_lib/* sound */.s3.play('5159');
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            if (_this6.dest.selected) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Destroy gold if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.dest.die();
              _this6.affectNewDest();
            }
            // Set the walking with gold animation
            if (_this6.loading > 0) {
              if (_this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'build':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest.type === 'Farm' && !_this6.dest.isUsedBy) {
                _this6.sendToFarm(_this6.dest);
              }
              _this6.affectNewDest();
              return;
            }
            if (_this6.dest.hitPoints < _this6.dest.totalHitPoints) {
              _this6.visible && sound_lib/* sound */.s3.play('5107');
              _this6.dest.hitPoints = Math.min(Math.round(_this6.dest.hitPoints + _this6.dest.totalHitPoints / _this6.dest.constructionTime), _this6.dest.totalHitPoints);
              if (_this6.dest.selected && _this6.owner.isPlayed) {
                menu.updateInfo('hitPoints', _this6.dest.hitPoints + '/' + _this6.dest.totalHitPoints);
              }
              _this6.dest.updateHitPoints(_this6.action);
            } else {
              if (!_this6.dest.isBuilt) {
                _this6.depst.updateHitPoints(_this6.action);
                _this6.dest.isBuilt = true;
                if (_this6.dest.type === 'Farm' && !_this6.dest.isUsedBy) {
                  _this6.sendToFarm(_this6.dest);
                }
              }
              _this6.affectNewDest();
            }
          }, 1000, false);
          break;
        case 'attack':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          if (this.range && this.type !== 'Villager') {
            this.sprite.onLoop = function () {
              if (!_this6.getActionCondition(_this6.dest)) {
                if (_this6.dest && _this6.dest.hitPoints <= 0) {
                  _this6.dest.die();
                }
                _this6.affectNewDest();
                return;
              }
              if (!_this6.isUnitAtDest(_this6.action, _this6.dest)) {
                _this6.stop();
                return;
              }
              if (_this6.destHasMoved()) {
                _this6.realDest.i = _this6.dest.i;
                _this6.realDest.j = _this6.dest.j;
                _this6.realDest.x = _this6.dest.x;
                _this6.realDest.y = _this6.dest.y;
                var oldDeg = _this6.degree;
                _this6.degree = maths_getInstanceDegree(_this6, _this6.dest.x, _this6.dest.y);
                if (maths_degreeToDirection(oldDeg) !== maths_degreeToDirection(_this6.degree)) {
                  _this6.setTextures('actionSheet');
                }
              }
            };
            onSpriteLoopAtFrame(this.sprite, 6, function () {
              var projectile = new Projectile({
                owner: _this6,
                target: _this6.dest,
                type: _this6.projectile,
                destination: _this6.realDest
              }, _this6.context);
              map.addChild(projectile);
            });
          } else {
            this.startInterval(function () {
              if (!_this6.getActionCondition(_this6.dest)) {
                if (_this6.dest && _this6.dest.hitPoints <= 0) {
                  _this6.dest.die();
                }
                _this6.affectNewDest();
                return;
              }
              if (_this6.destHasMoved()) {
                _this6.realDest.i = _this6.dest.i;
                _this6.realDest.j = _this6.dest.j;
                _this6.realDest.x = _this6.dest.x;
                _this6.realDest.y = _this6.dest.y;
                var oldDeg = _this6.degree;
                _this6.degree = maths_getInstanceDegree(_this6, _this6.dest.x, _this6.dest.y);
                if (maths_degreeToDirection(oldDeg) !== maths_degreeToDirection(_this6.degree)) {
                  _this6.setTextures('actionSheet');
                }
              }
              if (!_this6.isUnitAtDest(_this6.action, _this6.dest)) {
                _this6.sendTo(_this6.dest, 'attack');
                return;
              }
              if (_this6.sounds && _this6.sounds.hit) {
                _this6.visible && sound_lib/* sound */.s3.play(Array.isArray(_this6.sounds.hit) ? maths_randomItem(_this6.sounds.hit) : _this6.sounds.hit);
              }
              if (_this6.dest.hitPoints > 0) {
                _this6.dest.hitPoints = getHitPointsWithDamage(_this6, _this6.dest);
                if (_this6.dest.selected && (player.selectedUnit === _this6.dest || player.selectedBuilding === _this6.dest || player.selectedOther === _this6.dest)) {
                  menu.updateInfo('hitPoints', _this6.dest.hitPoints + '/' + _this6.dest.totalHitPoints);
                }
                _this6.dest.isAttacked(_this6);
                if (_this6.dest.hitPoints <= 0) {
                  _this6.dest.die();
                  _this6.affectNewDest();
                }
              }
            }, this.rateOfFire * 1000, false);
          }
          break;
        case 'heal':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.sprite.onLoop = function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              _this6.affectNewDest();
              return;
            }
            if (_this6.destHasMoved()) {
              _this6.realDest.i = _this6.dest.i;
              _this6.realDest.j = _this6.dest.j;
              _this6.realDest.x = _this6.dest.x;
              _this6.realDest.y = _this6.dest.y;
              var oldDeg = _this6.degree;
              _this6.degree = maths_getInstanceDegree(_this6, _this6.dest.x, _this6.dest.y);
              if (maths_degreeToDirection(oldDeg) !== maths_degreeToDirection(_this6.degree)) {
                _this6.setTextures('actionSheet');
              }
            }
            if (!_this6.isUnitAtDest(_this6.action, _this6.dest)) {
              _this6.sendTo(_this6.dest, 'heal');
              return;
            }
            if (_this6.dest.hitPoints < _this6.dest.totalHitPoints) {
              _this6.dest.hitPoints = Math.min(_this6.dest.hitPoints + _this6.healing, _this6.dest.totalHitPoints);
              if (_this6.dest.selected && player.selectedUnit === _this6.dest) {
                menu.updateInfo('hitPoints', _this6.dest.hitPoints + '/' + _this6.dest.totalHitPoints);
              }
            }
          };
          break;
        case 'takemeat':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            // Villager take meat
            _this6.visible && sound_lib/* sound */.s3.play('5178');
            _this6.loading++;
            _this6.loadingType = 'meat';
            _this6.updateInterfaceLoading();
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            _this6.dest.updateTexture();
            if (_this6.dest.selected && _this6.owner.isPlayed) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Set the walking with meat animation
            if (_this6.loading > 0) {
              if (_this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
            // Destroy corps if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.affectNewDest();
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          break;
        case 'fishing':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              _this6.affectNewDest();
              return;
            }
            // Villager is full we send him delivery first
            if (_this6.loading === _this6.loadingMax[_this6.loadingType] || !_this6.dest) {
              _this6.sendToDelivery();
              return;
            }
            // Villager fish
            _this6.loading++;
            _this6.loadingType = 'fish';
            _this6.updateInterfaceLoading();
            _this6.dest.quantity = Math.max(_this6.dest.quantity - 1, 0);
            if (_this6.dest.selected && _this6.owner.isPlayed) {
              menu.updateInfo('quantity-text', _this6.dest.quantity);
            }
            // Set the walking with meat animation
            if (_this6.loading > 0) {
              if (_this6.allAssets && _this6.allAssets[_this6.work]) {
                _this6.walkingSheet = lib/* Assets */.sP.cache.get(_this6.allAssets[_this6.work].loadedSheet);
              }
              _this6.standingSheet = null;
            }
            // Destroy corps if it out of quantity
            if (_this6.dest.quantity <= 0) {
              _this6.affectNewDest();
            }
          }, 1 / this.gatheringRate[this.work] * 1000, false);
          if (this.category !== 'Boat') {
            onSpriteLoopAtFrame(this.sprite, 6, function () {
              _this6.visible && sound_lib/* sound */.s3.play('5125');
            });
          }
          break;
        case 'hunt':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          if (this.dest.isDead) {
            this.previousDest ? this.goBackToPrevious() : this.sendToTakeMeat(this.dest);
          }
          this.setTextures('actionSheet');
          this.sprite.onLoop = function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest && _this6.dest.hitPoints <= 0) {
                _this6.dest.die();
                _this6.previousDest ? _this6.goBackToPrevious() : _this6.sendToTakeMeat(_this6.dest);
                return;
              }
              _this6.affectNewDest();
              return;
            }
            if (!_this6.isUnitAtDest(_this6.action, _this6.dest)) {
              _this6.stop();
              return;
            }
            if (_this6.destHasMoved()) {
              _this6.realDest.i = _this6.dest.i;
              _this6.realDest.j = _this6.dest.j;
              _this6.realDest.x = _this6.dest.x;
              _this6.realDest.y = _this6.dest.y;
              var oldDeg = _this6.degree;
              _this6.degree = maths_getInstanceDegree(_this6, _this6.dest.x, _this6.dest.y);
              if (maths_degreeToDirection(oldDeg) !== maths_degreeToDirection(_this6.degree)) {
                _this6.setTextures('actionSheet');
              }
            }
          };
          onSpriteLoopAtFrame(this.sprite, 6, function () {
            var projectile = new Projectile({
              owner: _this6,
              target: _this6.dest,
              type: 'Spear',
              destination: _this6.realDest,
              damage: 4
            }, _this6.context);
            map.addChild(projectile);
          });
          break;
        default:
          this.stop();
      }
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      if (this.work === 'attacker' && instance && instance.family === 'unit' && !this.path.length && !this.dest && this.getActionCondition(instance, 'attack')) {
        this.sendTo(instance, 'attack');
      }
    }
  }, {
    key: "handleAffectNewDestHunter",
    value: function handleAffectNewDestHunter() {
      var _this7 = this;
      var firstTargets = findInstancesInSight(this, function (instance) {
        return _this7.getActionCondition(instance, 'takemeat');
      });
      if (firstTargets.length) {
        var target = getClosestInstanceWithPath(this, firstTargets);
        if (target) {
          if (this.action !== 'takemeat') {
            this.action = 'takemeat';
            if (this.allAssets[this.work]) {
              this.actionSheet = lib/* Assets */.sP.cache.get(this.allAssets[this.work].harvestSheet);
            }
          }
          if (instanceContactInstance(this, target)) {
            this.degree = maths_getInstanceDegree(this, target.x, target.y);
            this.getAction(this.action);
            return true;
          }
          this.setDest(target.instance);
          this.setPath(target.path);
          return true;
        }
      }
      var secondTargets = findInstancesInSight(this, function (instance) {
        return _this7.getActionCondition(instance, 'hunt');
      });
      if (secondTargets.length) {
        var _target = getClosestInstanceWithPath(this, secondTargets);
        if (_target) {
          if (this.action !== 'hunt') {
            this.action = 'hunt';
            if (this.allAssets[this.work]) {
              this.actionSheet = lib/* Assets */.sP.cache.get(this.allAssets[this.work].actionSheet);
            }
          }
          if (instanceContactInstance(this, _target)) {
            this.degree = maths_getInstanceDegree(this, _target.x, _target.y);
            this.getAction(this.action);
            return true;
          }
          this.setDest(_target.instance);
          this.setPath(_target.path);
          return true;
        }
      }
      return false;
    }
  }, {
    key: "upgrade",
    value: function upgrade(type) {
      var data = this.owner.config.units[type];
      this.type = type;
      this.hitPoints = data.totalHitPoints - (this.totalHitPoints - this.hitPoints);
      for (var _i4 = 0, _Object$entries3 = Object.entries(data); _i4 < _Object$entries3.length; _i4++) {
        var _Object$entries3$_i = unit_slicedToArray(_Object$entries3[_i4], 2),
          key = _Object$entries3$_i[0],
          value = _Object$entries3$_i[1];
        this[key] = value;
      }
      for (var _i5 = 0, _Object$entries4 = Object.entries(this.assets); _i5 < _Object$entries4.length; _i5++) {
        var _Object$entries4$_i = unit_slicedToArray(_Object$entries4[_i5], 2),
          _key2 = _Object$entries4$_i[0],
          _value2 = _Object$entries4$_i[1];
        this[_key2] = lib/* Assets */.sP.cache.get(_value2);
      }
      if (this.action && !this.path.length) {
        this.getAction(this.action);
      } else {
        this.setTextures(this.currentSheet);
      }
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      var _this8 = this;
      this.stopInterval();
      if (this.previousDest && this.work !== 'delivery') {
        this.goBackToPrevious();
        return;
      }
      var handleSuccess = false;
      if (this.type === 'Villager' && (this.action === 'takemeat' || this.action === 'hunt')) {
        handleSuccess = this.handleAffectNewDestHunter();
      } else if (!this.dest || this.dest.label !== 'animal') {
        var targets = findInstancesInSight(this, function (instance) {
          return _this8.getActionCondition(instance);
        });
        if (targets.length) {
          var target = getClosestInstanceWithPath(this, targets);
          if (target) {
            if (instanceContactInstance(this, target)) {
              this.degree = maths_getInstanceDegree(this, target.x, target.y);
              this.getAction(this.action);
              return;
            }
            this.setDest(target.instance);
            this.setPath(target.path);
            return;
          }
        }
      }
      if (!handleSuccess) {
        var notDeliveryWork = ['builder', 'attacker', 'healer'];
        if (this.loading && !notDeliveryWork.includes(this.work)) {
          this.sendToDelivery();
        } else {
          this.stop();
        }
      }
    }
  }, {
    key: "isUnitAtDest",
    value: function isUnitAtDest(action, dest) {
      if (!action) {
        return false;
      }
      if (!dest) {
        this.affectNewDest();
        return false;
      }
      if ((this.type !== 'Villager' || action === 'hunt') && this.range && maths_instancesDistance(this, dest) <= this.range) {
        return true;
      }
      return instanceContactInstance(this, dest);
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      return (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) && maths_instancesDistance(this, this.dest) <= this.sight;
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      var map = this.context.map;
      var next = this.path[this.path.length - 1];
      var nextCell = map.grid[next.i][next.j];
      if (!this.dest || this.dest.isDestroyed) {
        this.affectNewDest();
        return;
      }
      // Collision with another walking unit, we block the mouvement
      if (nextCell.has && nextCell.has.family === 'unit' && nextCell.has.label !== this.label && nextCell.has.hasPath() && maths_instancesDistance(this, nextCell.has) <= 1 && nextCell.has.sprite.playing) {
        this.sprite.stop();
        return;
      }
      if (nextCell.solid && this.dest) {
        this.sendTo(this.dest, this.action);
        return;
      }
      if (!this.sprite.playing) {
        this.sprite.play();
      }
      this.zIndex = getInstanceZIndex(this);
      if (maths_instancesDistance(this, nextCell, false) <= this.speed) {
        clearCellOnInstanceSight(this);
        this.z = nextCell.z;
        this.i = nextCell.i;
        this.j = nextCell.j;
        if (this.currentCell.has === this) {
          this.currentCell.has = null;
          this.currentCell.solid = false;
        }
        this.currentCell = map.grid[this.i][this.j];
        if (this.currentCell.has === null) {
          this.currentCell.has = this;
          this.currentCell.solid = true;
        }
        renderCellOnInstanceSight(this);
        this.path.pop();

        // Destination moved
        if (this.destHasMoved()) {
          this.sendTo(this.dest, this.action);
          return;
        }
        if (this.isUnitAtDest(this.action, this.dest)) {
          this.path = [];
          this.stopInterval();
          this.degree = maths_getInstanceDegree(this, this.dest.x, this.dest.y);
          this.getAction(this.action);
          return;
        }
        if (!this.path.length) {
          this.stop();
        }
      } else {
        var _this$context4 = this.context,
          menu = _this$context4.menu,
          player = _this$context4.player;
        // Move to next
        var oldDeg = this.degree;
        var speed = this.speed;
        if (this.loading > 0) {
          speed *= 0.8;
        }
        moveTowardPoint(this, nextCell.x, nextCell.y, this.speed);
        canUpdateMinimap(this, player) && menu.updatePlayerMiniMap(this.owner);
        if (maths_degreeToDirection(oldDeg) !== maths_degreeToDirection(this.degree)) {
          // Change animation according to degree
          this.setTextures('walkingSheet');
        }
      }
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      if (!instance || this.dest === instance || this.isDead) {
        return;
      }
      var currentDest = this.dest;
      if (this.type === 'Villager') {
        if (instance.family === 'animal') {
          this.sendToHunt(instance);
        } else {
          this.sendToAttack(instance);
        }
      } else {
        this.sendTo(instance, 'attack');
      }
      this.previousDest = currentDest;
    }
  }, {
    key: "stop",
    value: function stop() {
      if (this.currentCell.has.label !== this.label && this.currentCell.solid) {
        this.sendTo(this.currentCell);
        return;
      }
      this.handleChangeDest();
      this.inactif = true;
      this.action = null;
      this.dest = null;
      this.realDest = null;
      this.currentCell.has = this;
      this.currentCell.solid = true;
      this.path = [];
      this.stopInterval();
      this.setTextures('standingSheet');
    }
  }, {
    key: "startInterval",
    value: function startInterval(callback, time) {
      var _this9 = this;
      var immediate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      var finalCb = function finalCb() {
        var paused = _this9.context.paused;
        if (paused) {
          return;
        }
        callback();
      };
      if (this.isDead) {
        return;
      }
      this.stopInterval();
      immediate && finalCb();
      this.interval = setInterval(finalCb, time);
    }
  }, {
    key: "stopInterval",
    value: function stopInterval() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
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
    key: "explore",
    value: function explore() {
      var _this0 = this;
      var map = this.context.map;
      var dest;
      for (var i = 3; i < 50; i++) {
        getCellsAroundPoint(this.i, this.j, map.grid, i, function (cell) {
          if (!_this0.owner.views[cell.i][cell.j].viewed && !cell.solid) {
            dest = _this0.owner.views[cell.i][cell.j];
            return;
          }
        });
        if (dest) {
          this.sendTo(dest);
          break;
        }
      }
    }
  }, {
    key: "runaway",
    value: function runaway(instance) {
      var _this1 = this;
      var map = this.context.map;
      var dest = null;
      getCellsAroundPoint(this.i, this.j, map.grid, this.sight, function (cell) {
        if (!cell.solid && (!dest || pointsDistance(cell.i, cell.j, instance.i, instance.j) > pointsDistance(dest.i, dest.j, instance.i, instance.j))) {
          dest = _this1.owner.views[cell.i][cell.j];
          return;
        }
      });
      if (dest) {
        this.sendTo(dest);
      } else {
        this.stop();
      }
    }
  }, {
    key: "decompose",
    value: function decompose() {
      var map = this.context.map;
      this.setTextures('corpseSheet');
      this.sprite.animationSpeed = 1 / (CORPSE_TIME * 1000) * ACCELERATOR;
      if (map.grid[this.i][this.j].has === this) {
        map.grid[this.i][this.j].has = null;
        map.grid[this.i][this.j].corpses.push(this);
        map.grid[this.i][this.j].solid = false;
      }
      this.sprite.onComplete = function () {
        //this.clear()
      };
    }
  }, {
    key: "death",
    value: function death() {
      var _this10 = this;
      this.setTextures('dyingSheet');
      this.zIndex--;
      this.sprite.loop = false;
      this.sprite.onComplete = function () {
        clearCellOnInstanceSight(_this10);
        // Remove from player units
        var index = _this10.owner.corpses.indexOf(_this10);
        if (index < 0) {
          _this10.owner.corpses.push(_this10);
        }
        _this10.decompose();
      };
    }
  }, {
    key: "die",
    value: function die() {
      if (this.isDead) {
        return;
      }
      var _this$context5 = this.context,
        player = _this$context5.player,
        menu = _this$context5.menu;
      this.sounds && this.sounds.die && this.visible && sound_lib/* sound */.s3.play(Array.isArray(this.sounds.die) ? maths_randomItem(this.sounds.die) : this.sounds.die);
      this.stopInterval();
      if (this.selected && player.selectedOther === this) {
        player.unselectUnit(this);
      }
      if (this.dest && this.dest.isUsedBy === this) {
        this.dest.isUsedBy = null;
      }
      this.hitPoints = 0;
      this.path = [];
      this.action = null;
      this.eventMode = 'none';
      this.isDead = true;
      this.unselect();
      if (this.owner) {
        this.owner.population--;
        if (this.owner.isPlayed && this.owner.selectedBuilding && this.owner.selectedBuilding.displayPopulation) {
          menu.updateInfo('population-text', this.owner.population + '/' + Math.min(POPULATION_MAX, this.owner.POPULATION_MAX));
        }
        // Remove from player units
        var index = this.owner.units.indexOf(this);
        if (index >= 0) {
          this.owner.units.splice(index, 1);
        }
        // Update from player selected unit
        if (this.owner.selectedUnit === this) {
          menu.updateInfo('hitPoints', this.hitPoints + '/' + this.totalHitPoints);
        }
      }
      this.death();
      canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner);
    }
  }, {
    key: "clear",
    value: function clear() {
      var map = this.context.map;
      this.isDestroyed = true;
      // Remove from player units
      var index = this.owner.corpses.indexOf(this);
      if (index >= 0) {
        this.owner.corpses.splice(index, 1);
      }
      // Remove from map corpses
      var corpsesIndex = map.grid[this.i][this.j].corpses.indexOf(this);
      if (index >= 0) {
        map.grid[this.i][this.j].corpses.splice(corpsesIndex, 1);
      }
      map.removeChild(this);
      this.destroy({
        child: true,
        texture: true
      });
    }
  }, {
    key: "setTextures",
    value: function setTextures(sheet) {
      setUnitTexture(sheet, this, ACCELERATOR);
    }
  }, {
    key: "updateInterfaceLoading",
    value: function updateInterfaceLoading() {
      var _this11 = this;
      var menu = this.context.menu;
      if (this.selected && this.owner.isPlayed && this.owner.selectedUnit === this) {
        if (this.loading === 1) {
          menu.updateInfo('loading', function (element) {
            return element.innerHTML = _this11.getLoadingElement().innerHTML;
          });
        } else if (this.loading > 1) {
          menu.updateInfo('loading-text', this.loading);
        } else {
          menu.updateInfo('loading', function (element) {
            return element.innerHTML = '';
          });
        }
      }
    }
  }, {
    key: "getLoadingElement",
    value: function getLoadingElement() {
      var menu = this.context.menu;
      var loadingDiv = document.createElement('div');
      loadingDiv.className = 'unit-loading';
      loadingDiv.id = 'loading';
      if (this.loading) {
        var iconImg = document.createElement('img');
        iconImg.className = 'unit-loading-icon';
        iconImg.src = menu.infoIcons[LOADING_FOOD_TYPES.includes(this.loadingType) ? 'food' : this.loadingType];
        var textDiv = document.createElement('div');
        textDiv.id = 'loading-text';
        textDiv.textContent = this.loading;
        loadingDiv.appendChild(iconImg);
        loadingDiv.appendChild(textDiv);
      }
      return loadingDiv;
    }
  }, {
    key: "commonSendTo",
    value: function commonSendTo(target, work, action, keepPrevious) {
      var menu = this.context.menu;
      var workFromLoading = getWorkWithLoadingType(this.loadingType);
      if (work !== 'builder' && work !== workFromLoading && !(WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(workFromLoading))) {
        this.loading = 0;
        this.loadingType = null;
        this.updateInterfaceLoading();
      }
      if (this.work !== work || this.action !== action) {
        this.work = work;
        this.owner.isPlayed && this.owner.selectedUnit === this && menu.updateInfo('type', this.work);
        if (this.allAssets && this.allAssets[work]) {
          this.actionSheet = getActionSheet(work, action, lib/* Assets */.sP, this);
          if (!this.loading) {
            this.standingSheet = lib/* Assets */.sP.cache.get(this.allAssets[work]['standingSheet']);
            this.walkingSheet = lib/* Assets */.sP.cache.get(this.allAssets[work]['walkingSheet']);
            this.dyingSheet = lib/* Assets */.sP.cache.get(this.allAssets[work]['dyingSheet']);
            this.corpseSheet = lib/* Assets */.sP.cache.get(this.allAssets[work]['corpseSheet']);
          }
        }
      }
      this.previousDest = keepPrevious ? this.previousDest : null;
      return this.sendTo(target, action);
    }
  }, {
    key: "sendToDelivery",
    value: function sendToDelivery() {
      var _this12 = this;
      var map = this.context.map;
      var buildingTypes = [];
      if (this.category === 'Boat') {
        buildingTypes = ['Dock'];
      } else {
        buildingTypes = ['TownCenter'];
        var buildings = {
          Granary: this.owner.config.buildings.Granary,
          StoragePit: this.owner.config.buildings.StoragePit
        };
        for (var _i6 = 0, _Object$entries5 = Object.entries(buildings); _i6 < _Object$entries5.length; _i6++) {
          var _Object$entries5$_i = unit_slicedToArray(_Object$entries5[_i6], 2),
            key = _Object$entries5$_i[0],
            value = _Object$entries5$_i[1];
          if (value.accept && value.accept.includes(this.loadingType)) {
            buildingTypes.push(key);
            break;
          }
        }
      }
      var targets = this.owner.buildings.filter(function (building) {
        return extra_getActionCondition(_this12, building, 'delivery', {
          buildingTypes: buildingTypes
        });
      });
      var target = getClosestInstance(this, targets);
      if (this.dest) {
        this.previousDest = this.dest;
      } else {
        this.previousDest = map.grid[this.i][this.j];
      }
      this.sendTo(target, 'delivery');
    }
  }, {
    key: "sendToFish",
    value: function sendToFish(target) {
      return this.commonSendTo(target, 'fisher', 'fishing');
    }
  }, {
    key: "sendToAttack",
    value: function sendToAttack(target) {
      return this.commonSendTo(target, 'attacker', 'attack', {
        resource: 'attack'
      });
    }
  }, {
    key: "sendToTakeMeat",
    value: function sendToTakeMeat(target) {
      return this.commonSendTo(target, 'hunter', 'takemeat', {
        actionSheet: 'harvestSheet'
      });
    }
  }, {
    key: "sendToHunt",
    value: function sendToHunt(target) {
      return this.commonSendTo(target, 'hunter', 'hunt');
    }
  }, {
    key: "sendToBuilding",
    value: function sendToBuilding(target) {
      return this.commonSendTo(target, 'builder', 'build');
    }
  }, {
    key: "sendToFarm",
    value: function sendToFarm(target) {
      return this.commonSendTo(target, 'farmer', 'farm');
    }
  }, {
    key: "sendToTree",
    value: function sendToTree(target) {
      return this.commonSendTo(target, 'woodcutter', 'chopwood');
    }
  }, {
    key: "sendToBerrybush",
    value: function sendToBerrybush(target) {
      return this.commonSendTo(target, 'forager', 'forageberry');
    }
  }, {
    key: "sendToStone",
    value: function sendToStone(target) {
      return this.commonSendTo(target, 'stoneminer', 'minestone');
    }
  }, {
    key: "sendToGold",
    value: function sendToGold(target) {
      return this.commonSendTo(target, 'goldminer', 'minegold');
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var civDiv = document.createElement('div');
      civDiv.id = 'civ';
      civDiv.textContent = this.owner.civ;
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = 'type';
      typeDiv.textContent = this.type === 'Villager' ? this.work || this.type : this.type;
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = 'icon';
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      var hitPointsDiv = document.createElement('div');
      hitPointsDiv.id = 'hitPoints';
      hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints;
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
}(lib/* Container */.mcf);
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
    this.family = 'player';
    this.context = context;
    var map = context.map;
    this.label = uuidv4();
    this.parent = map;
    this.wood = map.devMode ? 10000 : 200;
    this.food = map.devMode ? 10000 : 200;
    this.stone = map.devMode ? 10000 : 150;
    this.gold = map.devMode ? 10000 : 0;
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
    this.POPULATION_MAX = this.POPULATION_MAX || map.devMode ? POPULATION_MAX : 0;
    this.colorHex = getHexColor(this.color);
    this.config = player_objectSpread({}, lib/* Assets */.sP.cache.get('config'));
    this.techs = player_objectSpread({}, lib/* Assets */.sP.cache.get('technology'));
    this.hasBuilt = this.hasBuilt || map.devMode ? Object.keys(this.config.buildings).map(function (key) {
      return key;
    }) : [];
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
          viewBy: (_this$views$i$j$viewB = (_this$views = _this.views) === null || _this$views === void 0 ? void 0 : _this$views[i][j].viewBy) !== null && _this$views$i$j$viewB !== void 0 ? _this$views$i$j$viewB : [],
          onViewed: function onViewed() {
            var _this$context = _this.context,
              menu = _this$context.menu,
              map = _this$context.map;
            if (_this.isPlayed && !map.revealEverything) {
              menu.updateTerrainMiniMap(i, j);
            }
          },
          viewed: (_this$views$i$j$viewe = (_this$views2 = _this.views) === null || _this$views2 === void 0 ? void 0 : _this$views2[i][j].viewed) !== null && _this$views$i$j$viewe !== void 0 ? _this$views$i$j$viewe : _this.isPlayed && _this.type === 'Human' && map.revealTerrain || false
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
          if (unit.type === 'Villager') {
            if (extra_getActionCondition(unit, building, 'build')) {
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
        if (player.type === 'Human') {
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
;// ./app/classes/players/ai.js
function ai_typeof(o) { "@babel/helpers - typeof"; return ai_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, ai_typeof(o); }
function ai_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = ai_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function ai_toConsumableArray(r) { return ai_arrayWithoutHoles(r) || ai_iterableToArray(r) || ai_unsupportedIterableToArray(r) || ai_nonIterableSpread(); }
function ai_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function ai_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return ai_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? ai_arrayLikeToArray(r, a) : void 0; } }
function ai_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function ai_arrayWithoutHoles(r) { if (Array.isArray(r)) return ai_arrayLikeToArray(r); }
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


var styleLogInfo1 = 'background: #00ff00; color: #ffff00';
var styleLogInfo2 = 'background: #222; color: #ff0000';
var AI = /*#__PURE__*/function (_Player) {
  function AI(_ref, context) {
    var _this;
    var props = _extends({}, (_objectDestructuringEmpty(_ref), _ref));
    ai_classCallCheck(this, AI);
    _this = ai_callSuper(this, AI, [ai_objectSpread(ai_objectSpread({}, props), {}, {
      isPlayed: false,
      type: 'AI'
    }), context]);
    _this.foundedTrees = [];
    _this.foundedBerrybushs = [];
    _this.foundedGolds = [];
    _this.foundedStones = [];
    _this.foundedEnemyBuildings = [];
    _this.interval = setInterval(function () {
      return _this.step();
    }, 4000);
    _this.selectedUnits = [];
    _this.selectedUnit = null;
    _this.selectedBuilding = null;
    _this.selectedOther = null;
    _this.distSpread = 1;
    _this.cellViewed = 0;
    _this.nextAge = {
      1: 'ToolAge',
      2: 'BronzeAge',
      3: 'IronAge'
    };
    _this.maxVillagerPerAge = {
      0: 16,
      1: 24,
      2: 40,
      3: 50
    };
    _this.villageTargetPercentageByAge = {
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
    _this.maxBuildingByAge = {
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
        Market: 1
      },
      2: {
        StoragePit: 3,
        Granary: 3,
        Farm: 6,
        Barracks: 2,
        Market: 1
      },
      3: {
        StoragePit: 4,
        Granary: 4,
        Farm: 10,
        Barracks: 2,
        Market: 1
      }
    };
    return _this;
  }
  ai_inherits(AI, _Player);
  return ai_createClass(AI, [{
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
  }, {
    key: "getUnitExtraOptions",
    value: function getUnitExtraOptions(type) {
      var me = this;
      return {
        handleSetDest: function handleSetDest(target) {
          var map = me.context.map;
          if (type === 'Villager' && target.family === 'resource') {
            var buildingType = target.type === 'Berrybush' ? 'Granary' : 'StoragePit';
            var buildings = me.buildingsByTypes([buildingType]);
            if (canAfford(me, me.config.buildings[buildingType]) && me.hasNotReachBuildingLimit(buildingType, buildings)) {
              var closestBuilding = getClosestInstance(target, [].concat(ai_toConsumableArray(buildings), ai_toConsumableArray(me.buildingsByTypes(['TownCenter']))));
              if (!closestBuilding || maths_instancesDistance(closestBuilding, target) > 5) {
                var pos = getPositionInGridAroundInstance(target, map.grid, [1, 5], 1);
                if (pos && me.buyBuilding(pos.i, pos.j, buildingType)) {
                  console.log("Building ".concat(buildingType, " at:"), pos);
                }
              }
            }
          }
        }
      };
    }
  }, {
    key: "step",
    value: function step() {
      var _this2 = this;
      var _this$context = this.context,
        map = _this$context.map,
        paused = _this$context.paused;
      if (paused) {
        return;
      }
      var maxVillagers = this.maxVillagerPerAge[this.age];
      var maxVillagersOnConstruction = 4;
      var maxClubmans = 10;
      var howManyVillagerBeforeBuyingABarracks = 10;
      var howManySoldiersBeforeAttack = 5;
      console.log('%c ----Step started', styleLogInfo1);
      console.log("%c Age: ".concat(this.age, ", Wood: ").concat(this.wood, ", Food: ").concat(this.food, ", Stone: ").concat(this.stone, ", Gold: ").concat(this.gold, ", Population: ").concat(this.population, "/").concat(this.POPULATION_MAX), styleLogInfo2);
      var filterUnitsByType = function filterUnitsByType(type) {
        var condition = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (unit) {
          return unit.hitPoints > 0;
        };
        return _this2.units.filter(function (unit) {
          return unit.type === type && condition(unit);
        });
      };
      var villagers = filterUnitsByType('Villager');
      var clubmans = filterUnitsByType('Clubman');
      console.log("%c Villagers: ".concat(villagers.length, "/").concat(maxVillagers, ", Clubmans: ").concat(clubmans.length, "/").concat(maxClubmans), styleLogInfo2);
      var towncenters = this.buildingsByTypes(['TownCenter']);
      var storagepits = this.buildingsByTypes(['StoragePit']);
      var houses = this.buildingsByTypes(['House']);
      var granarys = this.buildingsByTypes(['Granary']);
      var barracks = this.buildingsByTypes(['Barracks']);
      var markets = this.buildingsByTypes(['Market']);
      var farms = this.buildingsByTypes(['Farm']);
      var emptyFarms = farms.filter(function (_ref2) {
        var isUsedBy = _ref2.isUsedBy;
        return !isUsedBy;
      });
      console.log("%c Towncenters: ".concat(towncenters.length, ", Houses: ").concat(houses.length, ", StoragePits: ").concat(storagepits.length, ", Granaries: ").concat(granarys.length, ", Barracks: ").concat(barracks.length, ", Markets: ").concat(markets), styleLogInfo2);
      var notBuiltBuildings = this.buildings.filter(function (b) {
        return !b.isBuilt || b.hitPoints > 0 && b.hitPoints < b.totalHitPoints;
      });
      var notBuiltHouses = notBuiltBuildings.filter(function (b) {
        return b.type === 'House';
      });
      var villagersByWork = function villagersByWork(works) {
        return villagers.filter(function (v) {
          return !v.inactif && works.includes(v.work);
        });
      };
      var inactifVillagers = villagers.filter(function (v) {
        return v.inactif && v.action !== 'attack';
      });
      var villagersOnWood = villagersByWork(['woodcutter']);
      var villagersOnFood = villagersByWork(['forager', 'farmer', 'hunter']);
      var villagersOnGold = villagersByWork(['goldminer']);
      var villagersOnStone = villagersByWork(['stoneminer']);
      var builderVillagers = villagersByWork(['builder']);
      var maxVillagersOnWood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['wood']);
      var maxVillagersOnFood = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['food']);
      var maxVillagersOnGold = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['gold']);
      var maxVillagersOnStone = getValuePercentage(villagers.length, this.villageTargetPercentageByAge[this.age]['stone']);
      console.log("%c Villagers on Wood: ".concat(villagersOnWood.length, "/").concat(maxVillagersOnWood, ", Villagers on Food: ").concat(villagersOnFood.length, "/").concat(maxVillagersOnFood, ", Villagers on Stone: ").concat(villagersOnStone.length, "/").concat(maxVillagersOnStone, ", Villagers on Gold: ").concat(villagersOnGold.length, "/").concat(maxVillagersOnGold, ", Builder Villagers: ").concat(builderVillagers.length), styleLogInfo2);
      var inactifClubmans = clubmans.filter(function (c) {
        return c.inactif && c.action !== 'attack' && c.assault;
      });
      var waitingClubmans = clubmans.filter(function (c) {
        return c.inactif && c.action !== 'attack' && !c.assault;
      });
      console.log("%c Inactif Clubmans: ".concat(inactifClubmans.length, ", Waiting Clubmans: ").concat(waitingClubmans.length), styleLogInfo2);

      // Player losing condition
      if (!this.buildings.length && !this.units.length) {
        console.log('Player has no buildings and units. Dying...');
        this.die();
        return;
      }

      // Cell Viewing Logic
      if (this.cellViewed <= map.totalCells) {
        getCellsAroundPoint(this.i, this.j, this.views, this.distSpread, function (cell) {
          var globalCell = map.grid[cell.i][cell.j];
          cell.has = globalCell.has;
          if (globalCell.has) {
            var has = globalCell.has;
            if (has.quantity > 0) {
              if (has.type === 'Tree' && !_this2.foundedTrees.includes(has)) {
                _this2.foundedTrees.push(has);
              }
              if (has.type === 'Berrybush' && !_this2.foundedBerrybushs.includes(has)) {
                _this2.foundedBerrybushs.push(has);
              }
              if (has.type === 'Stone' && !_this2.foundedStones.includes(has)) {
                _this2.foundedStones.push(has);
              }
              if (has.type === 'Gold' && !_this2.foundedGolds.includes(has)) {
                _this2.foundedGolds.push(has);
              }
            }
            if (has.family === 'building' && has.owner.label !== _this2.label && !_this2.foundedEnemyBuildings.includes(has)) {
              _this2.foundedEnemyBuildings.push(has);
            }
          }
          if (!cell.viewed) {
            _this2.cellViewed++;
            cell.viewed = true;
          }
        });
        this.distSpread++;
      }

      // Utility function to assign villagers to resources
      var assignVillagersToResource = function assignVillagersToResource(villagers, resourceList, maxVillagers, actionCallback) {
        if (resourceList.length) {
          if (villagers.length < maxVillagers) {
            for (var i = 0; i < Math.min(maxVillagers, inactifVillagers.length); i++) {
              var resource = getClosestInstance(inactifVillagers[i], resourceList);
              actionCallback(inactifVillagers[i], resource);
            }
          } else {
            for (var _i = 0; _i < villagers.length - maxVillagers; _i++) {
              villagers[_i].stop();
            }
          }
        } else {
          for (var _i2 = 0; _i2 < villagers.length; _i2++) {
            villagers[_i2].stop();
          }
        }
      };

      // Food Gathering Logic
      assignVillagersToResource(villagersOnFood, this.foundedBerrybushs, maxVillagersOnFood, function (villager, bush) {
        villager.sendToBerrybush(bush);
      });

      // Wood Gathering Logic
      assignVillagersToResource(villagersOnWood, this.foundedTrees, maxVillagersOnWood, function (villager, tree) {
        villager.sendToTree(tree);
      });

      // Stone Gathering Logic
      assignVillagersToResource(villagersOnStone, this.foundedStones, maxVillagersOnStone, function (villager, stone) {
        villager.sendToStone(stone);
      });

      // Gold Gathering Logic
      assignVillagersToResource(villagersOnGold, this.foundedGolds, maxVillagersOnGold, function (villager, gold) {
        villager.sendToGold(gold);
      });
      for (var i = 0; i < emptyFarms.length; i++) {
        var villager = getClosestInstance(emptyFarms[i], inactifVillagers);
        villager && villager.sendToFarm(emptyFarms[i]);
      }

      // Construction Logic
      if (notBuiltBuildings.length) {
        var _iterator = ai_createForOfIteratorHelper(notBuiltBuildings),
          _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done;) {
            var building = _step.value;
            if (builderVillagers.length >= maxVillagersOnConstruction) break;
            var availableVillagers = villagers.filter(function (v) {
              return v.work !== 'builder' || v.inactif;
            });
            var _villager = getClosestInstance(building, availableVillagers);
            if (_villager) {
              console.log('Villager sent to build:', building);
              _villager.sendToBuilding(building);
            }
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
      }

      // Attack Logic
      var sendToAttack = function sendToAttack(clubmans, target) {
        console.log('Sending clubmans to attack:', target);
        clubmans.forEach(function (clubman) {
          return clubman.sendTo(target, 'attack');
        });
      };
      if (waitingClubmans.length >= howManySoldiersBeforeAttack) {
        var target = this.foundedEnemyBuildings[0] || map.grid[randomRange(0, map.grid.length - 1)][randomRange(0, map.grid[0].length - 1)];
        console.log('Clubman attack target:', target);
        sendToAttack(waitingClubmans, target);
      }
      if (inactifClubmans.length && this.foundedEnemyBuildings.length) {
        console.log('Inactif clubmans attacking founded enemy building...');
        sendToAttack(inactifClubmans, this.foundedEnemyBuildings[0]);
      }

      // Unit Purchasing Logic
      var buyUnits = function buyUnits(currentCount, maxCount, buildingList, unitType, extra) {
        // Calculate how many more units can be bought
        var unitsNeeded = maxCount - currentCount;
        var unitsBought = 0;
        if (unitsNeeded <= 0) {
          return;
        }
        // Iterate over the buildings until we reach the needed count
        var _iterator2 = ai_createForOfIteratorHelper(buildingList),
          _step2;
        try {
          for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
            var _building = _step2.value;
            if (unitsBought >= unitsNeeded) break; // Stop if we've bought enough units

            if (_building && _building.buyUnit(unitType, false, false, extra)) {
              unitsBought++;
              console.log("Buying ".concat(unitType, " from ").concat(_building.type, ", Total Bought: ").concat(unitsBought));
            }
          }
        } catch (err) {
          _iterator2.e(err);
        } finally {
          _iterator2.f();
        }
      };
      buyUnits(villagers.length, maxVillagers, towncenters, 'Villager');
      buyUnits(clubmans.length, maxClubmans, barracks, 'Clubman');

      // Building Purchasing Logic
      var buyBuildingIfNeeded = function buyBuildingIfNeeded(condition, buildingType, positionCallback) {
        var list = {
          House: houses,
          Farm: farms,
          Barracks: barracks,
          Granary: granarys,
          StoragePit: storagepits,
          Market: markets
        };
        var building = _this2.config.buildings[buildingType];
        if (condition && canAfford(_this2, building.cost) && _this2.hasNotReachBuildingLimit(buildingType, list[buildingType])) {
          var pos = positionCallback();
          if (pos && _this2.buyBuilding(pos.i, pos.j, buildingType)) {
            console.log("Buying building: ".concat(buildingType, " at position:"), pos);
          }
        }
      };

      // Buy House
      buyBuildingIfNeeded(this.population + 2 > this.POPULATION_MAX && !notBuiltHouses.length, 'House', function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 10], 0);
      });

      // Buy Barracks
      buyBuildingIfNeeded(villagers.length > howManyVillagerBeforeBuyingABarracks, 'Barracks', function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, function (cell) {
          return _this2.otherPlayers().every(function (player) {
            return maths_instancesDistance(cell, player) <= maths_instancesDistance(towncenters[0], player);
          });
        });
      });

      // Buy Markets
      buyBuildingIfNeeded(markets.length === 0, 'Market', function () {
        return getPositionInGridAroundInstance(towncenters[0], map.grid, [6, 20], 1, false, function (cell) {
          return _this2.otherPlayers().every(function (player) {
            return maths_instancesDistance(cell, player) <= maths_instancesDistance(towncenters[0], player);
          });
        });
      });

      // Buy Farm
      buyBuildingIfNeeded(true, 'Farm', function () {
        var buildings = [].concat(ai_toConsumableArray(granarys), ai_toConsumableArray(towncenters)); // Combine both granarys and towncenters
        var _iterator3 = ai_createForOfIteratorHelper(buildings),
          _step3;
        try {
          var _loop = function _loop() {
              var building = _step3.value;
              // Try to find a valid position around each building
              var position = getPositionInGridAroundInstance(building, map.grid, [2, 10], 2, false, function (cell) {
                return _this2.otherPlayers().every(function (player) {
                  return maths_instancesDistance(cell, player) <= maths_instancesDistance(building, player);
                });
              }, false);
              if (position) {
                return {
                  v: position
                }; // If a valid position is found, return and break the loop
              }
            },
            _ret;
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            _ret = _loop();
            if (_ret) return _ret.v;
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
        return null; // If no valid position is found after looping through all buildings
      });

      // Unit Purchasing Logic
      var buyTechnology = function buyTechnology(buildingList, technologyType) {
        // Iterate over the buildings until we reach the needed count
        var _iterator4 = ai_createForOfIteratorHelper(buildingList),
          _step4;
        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var _building2 = _step4.value;
            if (_building2 && _building2.buyTechnology(technologyType)) {
              console.log("Buying ".concat(technologyType, " from ").concat(_building2.type));
            }
          }
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
      };
      if (this.nextAge[this.age + 1]) {
        buyTechnology(towncenters, this.nextAge[this.age + 1]);
      }
      console.log('%c ----Step ended', styleLogInfo1);
    }
  }, {
    key: "die",
    value: function die() {
      var players = this.context.players;
      clearInterval(this.interval);
      players.splice(players.indexOf(this), 1);
    }
  }]);
}(Player);
;// ./app/classes/animal.js
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




var Animal = /*#__PURE__*/function (_Container) {
  function Animal(options, context) {
    var _this$x, _this$y, _this$z, _this$hitPoints, _this$quantity, _this$loop;
    var _this;
    animal_classCallCheck(this, Animal);
    _this = animal_callSuper(this, Animal);
    _this.context = context;
    var _this2 = _this,
      map = _this2.context.map;
    _this.label = uuidv4();
    _this.family = 'animal';
    _this.dest = null;
    _this.realDest = null;
    _this.previousDest = null;
    _this.path = [];
    _this.selected = false;
    _this.degree = maths_randomRange(1, 360);
    _this.action = null;
    _this.currentFrame = 0;
    _this.currentSheet = 'standingSheet';
    _this.inactif = true;
    _this.isDead = false;
    _this.isDestroyed = false;
    _this.timeout;
    _this.x = null;
    _this.y = null;
    _this.z = null;
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(_this.owner.config.animals[_this.type]).forEach(function (prop) {
      _this[prop] = _this.owner.config.animals[_this.type][prop];
    });
    _this.size = 1;
    _this.visible = false;
    _this.x = (_this$x = _this.x) !== null && _this$x !== void 0 ? _this$x : map.grid[_this.i][_this.j].x;
    _this.y = (_this$y = _this.y) !== null && _this$y !== void 0 ? _this$y : map.grid[_this.i][_this.j].y;
    _this.z = (_this$z = _this.z) !== null && _this$z !== void 0 ? _this$z : map.grid[_this.i][_this.j].z;
    _this.zIndex = getInstanceZIndex(_this);
    _this.currentCell = map.grid[_this.i][_this.j];
    _this.currentCell.has = _this;
    _this.currentCell.solid = true;
    _this.hitPoints = (_this$hitPoints = _this.hitPoints) !== null && _this$hitPoints !== void 0 ? _this$hitPoints : _this.totalHitPoints;
    _this.quantity = (_this$quantity = _this.quantity) !== null && _this$quantity !== void 0 ? _this$quantity : _this.totalQuantity;
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
    _this.sprite.label = 'sprite';
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'auto';
    _this.sprite.allowClick = false;
    _this.sprite.roundPixels = true;
    _this.sprite.loop = (_this$loop = _this.loop) !== null && _this$loop !== void 0 ? _this$loop : true;
    if (_this.isDead) {
      _this.currentSheet === 'corpseSheet' ? _this.decompose() : _this.death();
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
          if (playerUnit.type === 'Villager') {
            if (extra_getActionCondition(playerUnit, _this, 'hunt')) {
              playerUnit.sendToHunt(_this);
              hasSentVillager = true;
              drawDestinationRectangle = true;
            } else if (extra_getActionCondition(playerUnit, _this, 'takemeat')) {
              playerUnit.sendToTakeMeat(_this);
              hasSentVillager = true;
              drawDestinationRectangle = true;
            }
          } else if (extra_getActionCondition(playerUnit, _this, 'attack')) {
            playerUnit.sendTo(_this, 'attack');
            drawDestinationRectangle = true;
            hasSentOther = true;
          }
        }
      } else if (player.selectedBuilding && player.selectedBuilding.range) {
        if (extra_getActionCondition(player.selectedBuilding, _this, 'attack') && maths_instancesDistance(player.selectedBuilding, _this) <= player.selectedBuilding.range) {
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
        var voice = randomItem(['5075', '5076', '5128', '5164']);
        sound_lib/* sound */.s3.play(voice);
      } else if (hasSentVillager) {
        var _voice = lib/* Assets */.sP.cache.get('config').units.Villager.sounds.hunt;
        sound_lib/* sound */.s3.play(_voice);
      }
      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(_this);
      }
    });
    _this.interval = null;
    _this.sprite.updateAnchor = true;
    _this.addChild(_this.sprite);
    renderCellOnInstanceSight(_this);
    return _this;
  }
  animal_inherits(Animal, _Container);
  return animal_createClass(Animal, [{
    key: "startInterval",
    value: function startInterval(callback, time) {
      var _this4 = this;
      var immediate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      var finalCb = function finalCb() {
        var paused = _this4.context.paused;
        if (paused) {
          return;
        }
        callback();
      };
      this.stopInterval();
      immediate && finalCb();
      this.interval = setInterval(finalCb, time);
    }
  }, {
    key: "stopInterval",
    value: function stopInterval() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  }, {
    key: "select",
    value: function select() {
      if (this.selected) {
        return;
      }
      this.selected = true;
      var selection = new lib/* Graphics */.A1g();
      selection.label = 'selection';
      selection.zIndex = 3;
      var path = [-32 * 0.5, 0, 0, -16 * 0.5, 32 * 0.5, 0, 0, 16 * 0.5];
      selection.poly(path);
      selection.stroke(COLOR_WHITE);
      this.addChildAt(selection, 0);
    }
  }, {
    key: "unselect",
    value: function unselect() {
      if (!this.selected) {
        return;
      }
      this.selected = false;
      var selection = this.getChildByLabel('selection');
      if (selection) {
        this.removeChild(selection);
      }
    }
  }, {
    key: "hasPath",
    value: function hasPath() {
      return this.path.length > 0;
    }
  }, {
    key: "setDest",
    value: function setDest(dest) {
      if (!dest) {
        this.stop();
        return;
      }
      this.dest = dest;
      this.realDest = {
        i: dest.i,
        j: dest.j
      };
    }
  }, {
    key: "pause",
    value: function pause() {
      var _this$timeout, _this$sprite;
      (_this$timeout = this.timeout) === null || _this$timeout === void 0 || _this$timeout.pause();
      (_this$sprite = this.sprite) === null || _this$sprite === void 0 || _this$sprite.stop();
    }
  }, {
    key: "resume",
    value: function resume() {
      var _this$timeout2, _this$sprite2;
      (_this$timeout2 = this.timeout) === null || _this$timeout2 === void 0 || _this$timeout2.resume();
      (_this$sprite2 = this.sprite) === null || _this$sprite2 === void 0 || _this$sprite2.play();
    }
  }, {
    key: "setPath",
    value: function setPath(path) {
      var _this5 = this;
      if (!path.length) {
        this.stop();
        return;
      }
      this.setTextures('walkingSheet');
      this.inactif = false;
      this.path = path;
      this.startInterval(function () {
        return _this5.step();
      }, STEP_TIME, true);
    }
  }, {
    key: "isAnimalAtDest",
    value: function isAnimalAtDest(action, dest) {
      if (!action) {
        return false;
      }
      if (!dest) {
        this.affectNewDest();
        return false;
      }
      return instanceContactInstance(this, dest);
    }
  }, {
    key: "sendTo",
    value: function sendTo(dest, action) {
      var _map$grid$this$i$this;
      var map = this.context.map;
      this.stopInterval();
      var path = [];
      // No instance we cancel the destination
      if (!dest) {
        this.stop();
        return;
      }
      // Animal is already beside our target
      if (this.isAnimalAtDest(action, dest) && (!map.grid[this.i][this.j].solid || map.grid[this.i][this.j].solid && ((_map$grid$this$i$this = map.grid[this.i][this.j].has) === null || _map$grid$this$i$this === void 0 ? void 0 : _map$grid$this$i$this.label) === this.label)) {
        this.setDest(dest);
        this.action = action;
        this.degree = maths_getInstanceDegree(this, dest.x, dest.y);
        this.getAction(action);
        return;
      }
      // Set animal path
      if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
        path = getInstanceClosestFreeCellPath(this, dest, map);
      } else {
        path = getInstancePath(this, dest.i, dest.j, map);
      }
      // Animal found a path, set the action and play walking animation
      if (path.length) {
        this.setDest(dest);
        this.action = action;
        this.setPath(path);
      } else {
        this.stop();
      }
    }
  }, {
    key: "getActionCondition",
    value: function getActionCondition(target) {
      return extra_getActionCondition(this, target, this.action);
    }
  }, {
    key: "getAction",
    value: function getAction(name) {
      var _this6 = this;
      var _this$context = this.context,
        menu = _this$context.menu,
        player = _this$context.player;
      switch (name) {
        case 'attack':
          if (!this.getActionCondition(this.dest)) {
            this.affectNewDest();
            return;
          }
          this.setTextures('actionSheet');
          this.startInterval(function () {
            if (!_this6.getActionCondition(_this6.dest)) {
              if (_this6.dest && _this6.dest.hitPoints <= 0) {
                _this6.dest.die();
              }
              _this6.affectNewDest();
              return;
            }
            if (_this6.destHasMoved()) {
              _this6.degree = maths_getInstanceDegree(_this6, _this6.dest.x, _this6.dest.y);
              _this6.setTextures('actionSheet');
            }
            if (!instanceContactInstance(_this6, _this6.dest)) {
              _this6.sendTo(_this6.dest, 'attack');
              return;
            }
            _this6.sounds && _this6.sounds.hit && _this6.visible && sound_lib/* sound */.s3.play(_this6.sounds.hit);
            if (_this6.dest.hitPoints > 0) {
              _this6.dest.hitPoints = getHitPointsWithDamage(_this6, _this6.dest);
              if (_this6.dest.selected && player && (player.selectedUnit === _this6.dest || player.selectedBuilding === _this6.dest)) {
                menu.updateInfo('hitPoints', _this6.dest.hitPoints + '/' + _this6.dest.totalHitPoints);
              }
              _this6.dest.isAttacked(_this6);
            }
            if (_this6.dest.hitPoints <= 0) {
              _this6.dest.die();
              _this6.affectNewDest();
            }
          }, this.rateOfFire * 1000, false);
          break;
        default:
          this.stop();
      }
    }
  }, {
    key: "affectNewDest",
    value: function affectNewDest() {
      var _this7 = this;
      this.stopInterval();
      var targets = findInstancesInSight(this, function (instance) {
        return _this7.getActionCondition(instance);
      });
      if (targets.length) {
        var target = getClosestInstanceWithPath(this, targets);
        if (target) {
          if (instanceContactInstance(this, target)) {
            this.degree = maths_getInstanceDegree(this, target.x, target.y);
            this.getAction(this.action);
            return;
          }
          this.setDest(target.instance);
          this.setPath(target.path);
          return;
        }
      }
      this.stop();
      return;
    }
  }, {
    key: "destHasMoved",
    value: function destHasMoved() {
      return (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j) && maths_instancesDistance(this, this.dest) <= this.sight;
    }
  }, {
    key: "moveToPath",
    value: function moveToPath() {
      var map = this.context.map;
      var next = this.path[this.path.length - 1];
      var nextCell = map.grid[next.i][next.j];
      if (!this.dest || this.dest.isDestroyed) {
        this.affectNewDest();
        return;
      }
      // Collision with another walking unit, we block the mouvement
      if (nextCell.has && nextCell.has.family === 'animal' && nextCell.has.label !== this.label && nextCell.has.hasPath() && maths_instancesDistance(this, nextCell.has) <= 1 && nextCell.has.sprite.playing) {
        this.sprite.stop();
        return;
      }
      if (nextCell.solid && this.dest) {
        this.sendTo(this.dest, this.action);
        return;
      }
      if (!this.sprite.playing) {
        this.sprite.play();
      }
      this.zIndex = getInstanceZIndex(this);
      if (maths_instancesDistance(this, nextCell, false) < this.speed) {
        clearCellOnInstanceSight(this);
        this.z = nextCell.z;
        this.i = nextCell.i;
        this.j = nextCell.j;
        if (this.currentCell.has === this) {
          this.currentCell.has = null;
          this.currentCell.solid = false;
        }
        this.currentCell = map.grid[this.i][this.j];
        if (this.currentCell.has === null) {
          this.currentCell.has = this;
          this.currentCell.solid = true;
        }
        renderCellOnInstanceSight(this);
        this.path.pop();

        // Destination moved
        if (this.destHasMoved()) {
          this.sendTo(this.dest, this.action);
          return;
        }
        if (this.isAnimalAtDest(this.action, this.dest)) {
          this.path = [];
          this.stopInterval();
          this.degree = maths_getInstanceDegree(this, this.dest.x, this.dest.y);
          this.getAction(this.action);
          return;
        }
        if (!this.path.length) {
          this.stop();
        }
      } else {
        // Move to next
        var oldDeg = this.degree;
        moveTowardPoint(this, nextCell.x, nextCell.y, this.speed);
        if (degreeToDirection(oldDeg) !== degreeToDirection(this.degree)) {
          // Change animation according to degree
          this.setTextures('walkingSheet');
        }
      }
    }
  }, {
    key: "getReaction",
    value: function getReaction(instance) {
      if (this.strategy === 'runaway') {
        this.runaway(instance);
      } else {
        this.sendTo(instance, 'attack');
      }
    }
  }, {
    key: "detect",
    value: function detect(instance) {
      if (this.strategy && instance && instance.family === 'unit' && !this.isDead && !this.path.length && !this.dest) {
        this.getReaction(instance);
      }
    }
  }, {
    key: "isAttacked",
    value: function isAttacked(instance) {
      if (!instance || this.dest || this.isDead) {
        return;
      }
      this.getReaction(instance);
    }
  }, {
    key: "stop",
    value: function stop() {
      if (this.currentCell.has.label !== this.label && this.currentCell.solid) {
        this.sendTo(this.currentCell);
        return;
      }
      this.inactif = true;
      this.action = null;
      this.dest = null;
      this.realDest = null;
      this.currentCell.has = this;
      this.currentCell.solid = true;
      this.path = [];
      this.stopInterval();
      this.setTextures('standingSheet');
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
    key: "runaway",
    value: function runaway(instance) {
      var _this8 = this;
      var map = this.context.map;
      var dest = null;
      getCellsAroundPoint(this.i, this.j, map.grid, this.sight, function (cell) {
        if (!cell.solid && (!dest || maths_pointsDistance(cell.i, cell.j, instance.i, instance.j) > maths_pointsDistance(dest.i, dest.j, instance.i, instance.j))) {
          dest = _this8.owner.views[cell.i][cell.j];
          return;
        }
      });
      if (dest) {
        this.sendTo(dest);
      } else {
        this.stop();
      }
    }
  }, {
    key: "decompose",
    value: function decompose() {
      var _this9 = this;
      var _this$context2 = this.context,
        player = _this$context2.player,
        menu = _this$context2.menu;
      this.setTextures('corpseSheet');
      this.sprite.animationSpeed = 0;
      this.startInterval(function () {
        if (_this9.quantity > 0) {
          _this9.quantity--;
          if (_this9.selected && player.selectedOther === _this9) {
            menu.updateInfo('quantity-text', _this9.quantity);
          }
        }
        _this9.updateTexture();
      }, 5000);
    }
  }, {
    key: "death",
    value: function death() {
      var _this0 = this;
      this.setTextures('dyingSheet');
      this.zIndex--;
      this.sprite.loop = false;
      this.sprite.onComplete = function () {
        _this0.decompose();
      };
    }
  }, {
    key: "die",
    value: function die() {
      if (this.isDead) {
        return;
      }
      if (this.sounds && this.visible) {
        this.sounds.die && sound_lib/* sound */.s3.play(this.sounds.die);
        this.sounds.fall && sound_lib/* sound */.s3.play(this.sounds.fall);
      }
      clearCellOnInstanceSight(this);
      this.owner.population--;
      this.stopInterval();
      this.isDead = true;
      this.zIndex--;
      this.path = [];
      this.action = null;
      this.death();
    }
  }, {
    key: "updateTexture",
    value: function updateTexture() {
      var _this1 = this;
      var _this$context3 = this.context,
        player = _this$context3.player,
        map = _this$context3.map;
      var percentage = getPercentage(this.quantity, this.totalQuantity);
      if (percentage > 25 && percentage < 50) {
        this.sprite.currentFrame = 1;
      } else if (percentage > 0 && percentage <= 25) {
        this.sprite.currentFrame = 2;
      } else if (percentage <= 0) {
        this.stopInterval();
        if (map.grid[this.i][this.j].has === this) {
          map.grid[this.i][this.j].has = null;
          map.grid[this.i][this.j].corpses.push(this);
          map.grid[this.i][this.j].solid = false;
        }
        if (this.selected && player.selectedOther === this) {
          player.unselectAll();
        }
        this.sprite.currentFrame = 3;
        this.timeout = new CustomTimeout(function () {
          _this1.clear();
        }, CORPSE_TIME * 1000);
      }
    }
  }, {
    key: "clear",
    value: function clear() {
      var map = this.context.map;
      this.isDestroyed = true;
      // Remove from map corpses
      var corpsesIndex = map.grid[this.i][this.j].corpses.indexOf(this);
      corpsesIndex >= 0 && map.grid[this.i][this.j].corpses.splice(corpsesIndex, 1);
      map.removeChild(this);
      this.destroy({
        child: true,
        texture: true
      });
    }
  }, {
    key: "setTextures",
    value: function setTextures(sheet) {
      setUnitTexture(sheet, this, ACCELERATOR);
    }
  }, {
    key: "setDefaultInterface",
    value: function setDefaultInterface(element, data) {
      var menu = this.context.menu;
      var civDiv = document.createElement('div');
      civDiv.id = 'civ';
      civDiv.textContent = '';
      element.appendChild(civDiv);
      var typeDiv = document.createElement('div');
      typeDiv.id = 'type';
      typeDiv.textContent = this.type;
      element.appendChild(typeDiv);
      var iconImg = document.createElement('img');
      iconImg.id = 'icon';
      iconImg.src = getIconPath(data.icon);
      element.appendChild(iconImg);
      var hitPointsDiv = document.createElement('div');
      hitPointsDiv.id = 'hitPoints';
      hitPointsDiv.textContent = this.hitPoints + '/' + this.totalHitPoints;
      element.appendChild(hitPointsDiv);
      var quantityDiv = document.createElement('div');
      quantityDiv.id = 'quantity';
      quantityDiv.className = 'resource-quantity';
      var smallIconImg = document.createElement('img');
      smallIconImg.src = menu.icons['food'];
      smallIconImg.className = 'resource-quantity-icon';
      var textDiv = document.createElement('div');
      textDiv.id = 'quantity-text';
      textDiv.textContent = this.quantity;
      quantityDiv.appendChild(smallIconImg);
      quantityDiv.appendChild(textDiv);
      element.appendChild(quantityDiv);
    }
  }]);
}(lib/* Container */.mcf);
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
      type: 'Gaia'
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
      type: 'Human'
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
          if (this.selectedUnits[i].type === 'Villager') {
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



;// ./app/classes/cell.js
function cell_typeof(o) { "@babel/helpers - typeof"; return cell_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, cell_typeof(o); }
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
    _this.family = 'cell';
    _this.map = map;
    _this.solid = false;
    _this.visible = false;
    _this.zIndex = 0;
    _this.inclined = false;
    _this.border = false;
    _this.waterBorder = false;
    _this.z = 0;
    _this.viewed = false;
    _this.viewBy = [];
    _this.has = null;
    _this.corpses = [];
    _this.fogSprites = [];
    Object.keys(options).forEach(function (prop) {
      _this[prop] = options[prop];
    });
    Object.keys(lib/* Assets */.sP.cache.get('config').cells[_this.type]).forEach(function (prop) {
      _this[prop] = lib/* Assets */.sP.cache.get('config').cells[_this.type][prop];
    });
    var pos = cartesianToIsometric(_this.i, _this.j);
    _this.x = pos[0];
    _this.y = pos[1] - _this.z * CELL_DEPTH;
    var textureName = randomItem(_this.assets);
    var resourceName = textureName.split('_')[1];
    var textureFile = textureName + '.png';
    var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
    var texture = spritesheet.textures[textureFile];
    _this.sprite = lib/* Sprite */.kxk.from(texture);
    _this.sprite.label = 'sprite';
    _this.sprite.anchor.set(0.5, 0.5);
    _this.sprite.roundPixels = true;
    _this.sprite.allowMove = false;
    _this.sprite.eventMode = 'none';
    _this.sprite.allowClick = false;
    _this.addChild(_this.sprite);
    _this.fogSprites.forEach(function (sprite) {
      var _this3;
      return (_this3 = _this).addFogBuilding.apply(_this3, cell_toConsumableArray(Object.values(sprite)));
    });
    _this.eventMode = 'none';
    _this.allowMove = false;
    _this.allowClick = false;
    return _this;
  }
  cell_inherits(Cell, _Container);
  return cell_createClass(Cell, [{
    key: "updateVisible",
    value: function updateVisible() {
      var _this$context = this.context,
        map = _this$context.map,
        player = _this$context.player;
      function updateChild(instance) {
        if (map.revealEverything || !instance.owner || instance.owner.isPlayed || instanceIsInPlayerSight(instance, player)) {
          instance.visible = true;
        }
      }
      if (!map.revealEverything && !player.views[this.i][this.j].viewed) {
        return;
      }
      this.visible = true;
      if (this.has) {
        updateChild(this.has);
      }
      if (this.corpses.length) {
        for (var i = 0; i < this.corpses.length; i++) {
          updateChild(this.corpses[i]);
        }
      }
    }
  }, {
    key: "setDesertBorder",
    value: function setDesertBorder(direction) {
      var resourceName = '20002';
      var cellSprite = this.sprite;
      var cellSpriteTextureName = cellSprite.texture.label;
      var cellSpriteIndex = cellSpriteTextureName.split('_')[0];
      var val = {};
      var index;
      var cpt = 0;
      for (var i = 0; i < 25; i++) {
        val[i] = [];
        if (i < 9) {
          val[i].push(0, 1, 2, 3);
        } else {
          for (var j = cpt; j < cpt + 4; j++) {
            val[i].push(j + 4);
          }
          cpt += 4;
        }
      }
      switch (direction) {
        case 'west':
          index = val[cellSpriteIndex * 1][0];
          break;
        case 'north':
          index = val[cellSpriteIndex * 1][1];
          break;
        case 'south':
          index = val[cellSpriteIndex * 1][2];
          break;
        case 'est':
          index = val[cellSpriteIndex * 1][3];
          break;
      }
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png'];
      var sprite = lib/* Sprite */.kxk.from(texture);
      sprite.direction = direction;
      sprite.anchor.set(0.5, 0.5);
      sprite.type = 'border';
      this.addChild(sprite);
    }
  }, {
    key: "setWaterBorder",
    value: function setWaterBorder(resourceName, index) {
      var sprite = this.sprite;
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      this.type = 'Desert';
      this.border = true;
      this.waterBorder = true;
      if (this.has && typeof this.has.die === 'function') {
        this.has.die(true);
      }
      sprite.texture = texture;
    }
  }, {
    key: "setReliefBorder",
    value: function setReliefBorder(index) {
      var elevation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var sprite = this.sprite;
      var resourceName = sprite.texture.label.split('_')[1].split('.')[0];
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      var texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      if (elevation) {
        this.y -= elevation;
      }
      this.inclined = true;
      if (this.has) {
        this.has.zIndex = getInstanceZIndex(this.has);
      }
      sprite.label = 'sprite';
      sprite.anchor.set(0.5, 0.5);
      sprite.texture = texture;
    }
  }, {
    key: "setWater",
    value: function setWater() {
      var index = formatNumber(maths_randomRange(0, 3));
      var resourceName = '15002';
      var spritesheet = lib/* Assets */.sP.cache.get(resourceName);
      this.sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png'];
      this.type = 'Water';
      this.category = 'Water';
    }
  }, {
    key: "fillWaterCellsAroundCell",
    value: function fillWaterCellsAroundCell() {
      var _this4 = this;
      var grid = this.parent.grid;
      if (this.type === 'Water' && !this.sprite.texture.label.includes('15002')) {
        this.setWater();
      }
      getCellsAroundPoint(this.i, this.j, grid, 2, function (cell) {
        if (cell.type === 'Water' && _this4.type === 'Water') {
          var dist = maths_instancesDistance(_this4, cell);
          var velX = Math.round((_this4.i - cell.i) / dist);
          var velY = Math.round((_this4.j - cell.j) / dist);
          if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
            var target = grid[cell.i + velX][cell.j + velY];
            var aside = grid[_this4.i + cell.i - target.i][_this4.j + cell.j - target.j];
            if (target.type !== _this4.type && aside.type !== _this4.type) {
              if (Math.floor(maths_instancesDistance(_this4, cell)) === 2) {
                cell.setWater();
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
      var _this5 = this;
      var grid = this.parent.grid;
      getCellsAroundPoint(this.i, this.j, grid, 2, function (cell) {
        if (cell.z === _this5.z) {
          var dist = maths_instancesDistance(_this5, cell);
          var velX = Math.round((_this5.i - cell.i) / dist);
          var velY = Math.round((_this5.j - cell.j) / dist);
          if (grid[cell.i + velX] && grid[cell.i + velX][cell.j + velY]) {
            var target = grid[cell.i + velX][cell.j + velY];
            var aside = grid[_this5.i + cell.i - target.i][_this5.j + cell.j - target.j];
            if (target.z <= _this5.z && target.z !== _this5.z && aside.z !== _this5.z) {
              if (Math.floor(maths_instancesDistance(_this5, cell)) === 2) {
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
      if (level === 0) {
        this.y += CELL_DEPTH;
        this.z = level;
        return;
      }
      var grid = this.parent.grid;
      getCellsAroundPoint(this.i, this.j, grid, level - cpt, function (cell) {
        if (cell.z < cpt) {
          cell.y -= (cpt - cell.z) * CELL_DEPTH;
          cell.z = cpt;
          cell.fillReliefCellsAroundCell(grid);
        }
      });
      if (cpt + 1 < level) {
        this.setCellLevel(level, cpt + 1);
      }
      if (this.has) {
        this.has.zIndex = getInstanceZIndex(this.has);
      }
    }
  }, {
    key: "addFogBuilding",
    value: function addFogBuilding(textureSheet, colorSheet, colorName) {
      var sprite = lib/* Sprite */.kxk.from(getTexture(textureSheet, lib/* Assets */.sP));
      sprite.label = 'buildingFog';
      sprite.tint = COLOR_FOG;
      sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
      this.addChild(sprite);
      this.fogSprites.push({
        sprite: sprite,
        textureSheet: textureSheet,
        colorSheet: colorSheet,
        colorName: colorName
      });
      if (colorSheet) {
        var spriteColor = lib/* Sprite */.kxk.from(getTexture(colorSheet, lib/* Assets */.sP));
        spriteColor.label = 'buildingColorFog';
        spriteColor.tint = COLOR_FOG;
        changeSpriteColorDirectly(spriteColor, colorName);
        this.addChild(spriteColor);
        this.fogSprites.push({
          sprite: spriteColor,
          textureSheet: textureSheet,
          colorSheet: colorSheet,
          colorName: colorName
        });
      } else {
        changeSpriteColorDirectly(sprite, colorName);
      }
      this.zIndex = 100;
    }
  }, {
    key: "removeFogBuilding",
    value: function removeFogBuilding(instance) {
      var map = this.context.map;
      if (instance.owner && !instance.owner.isPlayed && instance.family === 'building') {
        var i = 0;
        var localCell = map.grid[instance.i][instance.j];
        while (i < localCell.fogSprites.length) {
          if (localCell.fogSprites[i]) {
            var _localCell$fogSprites;
            (_localCell$fogSprites = localCell.fogSprites[i].sprite) === null || _localCell$fogSprites === void 0 || _localCell$fogSprites.destroy(); // Destroy the sprite
            localCell.fogSprites.splice(i, 1); // Remove the destroyed sprite from the array
          } else {
            i++; // Only increment if no sprite is destroyed, to avoid skipping elements
          }
        }
      }
    }
  }, {
    key: "setFogChildren",
    value: function setFogChildren(instance, init) {
      var _this$context2 = this.context,
        player = _this$context2.player,
        map = _this$context2.map;
      if (!instanceIsInPlayerSight(instance, player)) {
        if (instance.owner && !instance.owner.isPlayed) {
          if (!init && instance.family === 'building') {
            var assets = getBuildingAsset(instance.type, instance.owner, lib/* Assets */.sP);
            var localCell = map.grid[instance.i][instance.j];
            localCell.addFogBuilding(assets.images["final"], assets.images.color, instance.owner.color);
          }
          instance.visible = false;
        } else {
          for (var i = 0; i < instance.children.length; i++) {
            if (instance.children[i].tint) {
              instance.children[i].tint = COLOR_FOG;
            }
          }
        }
      }
    }
  }, {
    key: "setFog",
    value: function setFog(init) {
      if (this.has) {
        this.setFogChildren(this.has, init);
      }
      for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].tint) {
          this.children[i].tint = COLOR_FOG;
        }
      }
      if (this.corpses.length) {
        for (var _i = 0; _i < this.corpses.length; _i++) {
          this.setFogChildren(this.corpses[_i], init);
        }
      }
    }
  }, {
    key: "removeFog",
    value: function removeFog() {
      var controls = this.context.controls;
      function setRemoveChildren(instance) {
        if (controls.instanceInCamera(instance)) {
          instance.visible = true;
        }
        for (var i = 0; i < instance.children.length; i++) {
          if (instance.children[i].tint) {
            instance.children[i].tint = COLOR_WHITE;
          }
        }
      }
      if (!this.visible) {
        this.visible = true;
      }
      this.zIndex = 0;
      for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].tint) {
          this.children[i].tint = COLOR_WHITE;
        }
      }
      if (this.has) {
        this.removeFogBuilding(this.has);
        setRemoveChildren(this.has);
      }
      if (this.corpses.length) {
        for (var _i2 = 0; _i2 < this.corpses.length; _i2++) {
          setRemoveChildren(this.corpses[_i2]);
        }
      }
    }
  }]);
}(lib/* Container */.mcf);
;// ./app/classes/map.js
function map_typeof(o) { "@babel/helpers - typeof"; return map_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, map_typeof(o); }
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
    _this.noAI = true;
    _this.devMode = false;
    _this.revealEverything =  true || 0;
    _this.revealTerrain = _this.devMode || false;
    _this.x = 0;
    _this.y = 0;
    _this.startingUnits = 3;
    _this.playersPos = [];
    _this.positionsCount = 2;
    _this.gaia = null;
    _this.resources = [];
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
      //this.position.set(-x, -y);
      this.x = x;
      this.y = y;
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
          if (!this.revealEverything) {
            this.grid[i][j].setFog();
          }
        }
      }
      for (var _i = 0; _i <= this.size; _i++) {
        for (var _j = 0; _j <= this.size; _j++) {
          this.grid[_i][_j].fillWaterCellsAroundCell();
        }
      }
      this.resources = resources.map(function (resource) {
        return _this2.addChild(new Resource(resource, _this2.context));
      });
      this.formatCellsRelief();
      this.formatCellsWaterBorder();
      this.formatCellsDesert();
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
        for (var _i2 = 0; _i2 <= _this2.size; _i2++) {
          var _line = player.views[_i2];
          for (var _j2 = 0; _j2 <= _this2.size; _j2++) {
            var _cell = _line[_j2];
            if (_cell.viewed) {
              _cell.onViewed();
            }
            _cell.viewBy = _cell.viewBy.map(function (name) {
              return getDest(name, _this2);
            }).filter(Boolean);
            if (player.isPlayed && _cell.viewed) {
              if (!_cell.viewBy.length) {
                _this2.grid[_i2][_j2].setFog(true);
              } else {
                _this2.grid[_i2][_j2].removeFog();
              }
            }
          }
        }
        player.units.forEach(function (unit) {
          return processUnit(unit, _this2);
        });
      });
      this.ready = true;
    }
  }, {
    key: "generateMap",
    value: function generateMap() {
      var repeat = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
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
          this.positionsCount = 4;
          break;
        case 220:
          this.positionsCount = 4;
          break;
        default:
          this.positionsCount = 2;
      }
      this.totalCells = Math.pow(this.size, 2);
      this.playersPos = this.findPlayerPlaces();
      if (this.playersPos.length < this.positionsCount) {
        if (repeat >= 10) {
          alert('Error while generating the map');
          return;
        }
        this.generateMap(repeat + 1);
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

      //this.generateMapRelief()
      //this.formatCellsRelief()

      this.generateSets();
      if (!this.revealEverything) {
        for (var i = 0; i <= this.size; i++) {
          for (var j = 0; j <= this.size; j++) {
            this.grid[i][j].setFog();
          }
        }
        for (var _i3 = 0; _i3 < player.buildings.length; _i3++) {
          var building = player.buildings[_i3];
          renderCellOnInstanceSight(building);
        }
        for (var _i4 = 0; _i4 < player.units.length; _i4++) {
          var unit = player.units[_i4];
          renderCellOnInstanceSight(unit);
        }
      }
      this.ready = true;
      menu.updateResourcesMiniMap();
    }
  }, {
    key: "generatePlayers",
    value: function generatePlayers() {
      var context = this.context;
      var players = [];
      var poses = [];
      var randoms = Array.from(Array(this.playersPos.length).keys());
      for (var i = 0; i < this.playersPos.length; i++) {
        var pos = maths_randomItem(randoms);
        poses.push(pos);
        randoms.splice(randoms.indexOf(pos), 1);
      }
      for (var _i5 = 0; _i5 < this.positionsCount; _i5++) {
        var _this$playersPos$pose, _this$playersPos$pose2;
        var posI = (_this$playersPos$pose = this.playersPos[poses[_i5]]) === null || _this$playersPos$pose === void 0 ? void 0 : _this$playersPos$pose.i;
        var posJ = (_this$playersPos$pose2 = this.playersPos[poses[_i5]]) === null || _this$playersPos$pose2 === void 0 ? void 0 : _this$playersPos$pose2.j;
        if (posI && posJ) {
          var color = colors[_i5];
          if (!_i5) {
            players.push(new Human({
              i: posI,
              j: posJ,
              age: 0,
              civ: 'Greek',
              color: color,
              isPlayed: true
            }, context));
          } else if (!this.noAI) {
            players.push(new AI({
              i: posI,
              j: posJ,
              age: 0,
              civ: 'Greek',
              color: color
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
          type: 'TownCenter',
          isBuilt: true
        });
        for (var _i6 = 0; _i6 < this.startingUnits; _i6++) {
          towncenter.placeUnit('Villager');
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

      // Function to calculate the distance between two points
      function distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
      }

      // Function to create a circle of points within a grid, checking boundaries
      function createCircle(centerI, centerJ, radius) {
        var density = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0.7;
        var edgeNoise = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;
        var circleCells = [];
        for (var x = -radius; x <= radius; x++) {
          for (var y = -radius; y <= radius; y++) {
            var distFromCenter = Math.sqrt(x * x + y * y);
            var noise = Math.random() * edgeNoise - edgeNoise / 2; // Random edge noise
            if (distFromCenter + noise <= radius) {
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
          clusterCenterI = playerI + Math.floor(Math.random() * 60 - 30); // Random offset
          clusterCenterJ = playerJ + Math.floor(Math.random() * 60 - 30);
          tries++;
          if (tries > 100) break; // Safety exit
        } while (distance(clusterCenterI, clusterCenterJ, playerI, playerJ) < safeDistance || clusterCenterI < 0 || clusterCenterI >= gridWidth || clusterCenterJ < 0 || clusterCenterJ >= gridHeight ||
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
          soloI = playerI + Math.floor(Math.random() * 60 - 30); // Random offset within [-30, 30]
          soloJ = playerJ + Math.floor(Math.random() * 60 - 30);
          _tries++;
          if (_tries > 50) break; // Safety exit to avoid infinite loop
        } while (distance(soloI, soloJ, playerI, playerJ) < safeDistance || soloI < 0 || soloI >= gridWidth || soloJ < 0 || soloJ >= gridHeight ||
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
      for (var clearing = 0; clearing < clusterCount; clearing++) {
        if (Math.random() < clearingProbability) {
          var clearingCenterI = void 0,
            clearingCenterJ = void 0;
          var _tries2 = 0;
          var clearingRadius = Math.floor(Math.random() * 8) + 5; // Random clearing radius between 5 and 13
          var _edgeNoise = Math.random() * 1.5;
          do {
            clearingCenterI = playerI + Math.floor(Math.random() * 60 - 30); // Random offset
            clearingCenterJ = playerJ + Math.floor(Math.random() * 60 - 30);
            _tries2++;
            if (_tries2 > 100) break;
          } while (distance(clearingCenterI, clearingCenterJ, playerI, playerJ) < safeDistance || clearingCenterI < 0 || clearingCenterI >= gridWidth || clearingCenterJ < 0 || clearingCenterJ >= gridHeight ||
          // Stay within grid bounds
          grid[clearingCenterI][clearingCenterJ].category === 'Water' ||
          // Avoid water cells
          grid[clearingCenterI][clearingCenterJ].solid ||
          // Avoid solid cells
          grid[clearingCenterI][clearingCenterJ].inclined // Avoid inclined cells
          );
          if (_tries2 <= 100) {
            var clearingCells = createCircle(clearingCenterI, clearingCenterJ, clearingRadius, 0, _edgeNoise);
            clearingCells.forEach(function (clearedCell) {
              var index = forestCells.findIndex(function (cell) {
                return cell.i === clearedCell.i && cell.j === clearedCell.j;
              });
              if (index > -1) {
                forestCells.splice(index, 1); // Remove tree from clearing
              }
            });
          }
        }
      }

      // Generate diagonal paths
      var pathLength = 20;
      var pathDirection = Math.random() > 0.5 ? 1 : -1; // Random path direction

      for (var step = 0; step < pathLength; step++) {
        var offsetX = void 0,
          offsetY = void 0;
        var _tries3 = 0;
        do {
          offsetX = step * pathDirection;
          offsetY = step;
          _tries3++;
          if (_tries3 > 50) break;
        } while (distance(playerI + offsetX, playerJ + offsetY, playerI, playerJ) < safeDistance || playerI + offsetX < 0 || playerI + offsetX >= gridWidth || playerJ + offsetY < 0 || playerJ + offsetY >= gridHeight);
        if (_tries3 <= 50) {
          var randOffsetX = Math.random() > 0.5 ? 1 : -1;
          var randOffsetY = Math.random() > 0.5 ? 1 : -1;
          pathCells.add("".concat(playerI + offsetX + randOffsetX, ",").concat(playerJ + offsetY + randOffsetY));
        }
      }

      // Remove path cells from forestCells
      forestCells.forEach(function (cell) {
        if (pathCells.has("".concat(cell.i, ",").concat(cell.j))) {
          forestCells.splice(forestCells.indexOf(cell), 1);
        }
      });

      // Select and place trees in the forest cells
      var cellsToPlace = [];
      for (var _i7 = 0; _i7 < treeCount; _i7++) {
        if (forestCells.length === 0) break;
        var itemIndex = Math.floor(Math.random() * forestCells.length);
        var cell = forestCells[itemIndex];
        cellsToPlace.push(cell);
        forestCells.splice(itemIndex, 1);
      }

      // Place the trees in the selected cells
      var _loop = function _loop() {
        var cell = _cellsToPlace[_i8];
        // Ensure again that we're not placing trees on Water, Border, or Solid cells
        if (grid[cell.i][cell.j].category !== 'Water' && !grid[cell.i][cell.j].waterBorder && !grid[cell.i][cell.j].solid && !grid[cell.i][cell.j].inclined) {
          var isFree = true;
          getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, function (cell) {
            var _cell$has;
            if (['Berrybush', 'Gold', 'Stone'].includes((_cell$has = cell.has) === null || _cell$has === void 0 ? void 0 : _cell$has.type)) {
              isFree = false;
            }
          });
          isFree && _this3.resources.push(_this3.addChild(new Resource({
            i: cell.i,
            j: cell.j,
            type: 'Tree'
          }, _this3.context)));
        }
      };
      for (var _i8 = 0, _cellsToPlace = cellsToPlace; _i8 < _cellsToPlace.length; _i8++) {
        _loop();
      }
    }
  }, {
    key: "generateResourcesAroundPlayers",
    value: function generateResourcesAroundPlayers(playersPos) {
      for (var i = 0; i < playersPos.length; i++) {
        this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [7, 14]);
        this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [14, 22]);
        this.placeResourceGroup(playersPos[i], 'Berrybush', 8, [22, 29]);
        this.placeResourceGroup(playersPos[i], 'Stone', 7, [7, 14]);
        this.placeResourceGroup(playersPos[i], 'Stone', 7, [14, 22]);
        this.placeResourceGroup(playersPos[i], 'Stone', 7, [22, 29]);
        this.placeResourceGroup(playersPos[i], 'Gold', 7, [7, 14]);
        this.placeResourceGroup(playersPos[i], 'Gold', 7, [14, 22]);
        this.placeResourceGroup(playersPos[i], 'Gold', 7, [22, 29]);
        this.generateForestAroundPlayer(playersPos[i], this.size * 4);
      }
    }
  }, {
    key: "generateTerrain",
    value: function generateTerrain() {
      var gridSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 120;
      var mapModel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'plain';
      var terrainMap = [];

      // Initialize the map with default grass (0)
      for (var i = 0; i < gridSize; i++) {
        terrainMap[i] = [];
        for (var j = 0; j < gridSize; j++) {
          terrainMap[i][j] = 0; // Default to grass
        }
      }

      // Helper function to generate terrain clusters around a point
      function generateTerrainCluster(x, y, radius, type) {
        for (var _i9 = -radius; _i9 <= radius; _i9++) {
          for (var _j3 = -radius; _j3 <= radius; _j3++) {
            var nx = x + _i9;
            var ny = y + _j3;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && _i9 * _i9 + _j3 * _j3 <= radius * radius) {
              terrainMap[nx][ny] = type;
            }
          }
        }
      }

      // Generate water with a smoother, randomized approach
      function generateWater() {
        if (mapModel === 'continent') {
          var edgeSize = 10; // Base edge size for water
          var roundFactor = 0.15; // Controls the "smoothness" of the water edge

          // Loop through the map and set water in a rounded pattern with random noise
          for (var _i0 = 0; _i0 < gridSize; _i0++) {
            for (var _j4 = 0; _j4 < gridSize; _j4++) {
              var distFromCenter = Math.abs(_i0 - gridSize / 2) + Math.abs(_j4 - gridSize / 2); // Distance from center

              // Add smooth water around the edges with randomized borders
              var edgeDist = Math.min(_i0, _j4, gridSize - _i0, gridSize - _j4);
              var randomOffset = Math.random() * 5 - 2.5; // Randomize water edge for more natural look

              if (edgeDist < edgeSize + Math.sin(distFromCenter * roundFactor) * 5 + randomOffset) {
                terrainMap[_i0][_j4] = 2; // Water
              }
            }
          }
        } else if (mapModel === 'lac') {
          var centerX = Math.floor(gridSize / 2);
          var centerY = Math.floor(gridSize / 2);
          var baseRadius = Math.floor(gridSize / 4); // Base radius for the lake
          var _roundFactor = 0.6; // Adjust this for more/less rounding

          // Create a lake with a smoother, randomized border
          for (var _i1 = -baseRadius; _i1 <= baseRadius; _i1++) {
            for (var _j5 = -baseRadius; _j5 <= baseRadius; _j5++) {
              var nx = centerX + _i1;
              var ny = centerY + _j5;
              var distanceFromCenter = Math.sqrt(_i1 * _i1 + _j5 * _j5);
              var noise = Math.sin(distanceFromCenter * _roundFactor) * 2; // Create smooth noise
              var _randomOffset = Math.random() * 3 - 1.5; // Add randomness to the lake shape

              if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && distanceFromCenter < baseRadius + noise + _randomOffset) {
                terrainMap[nx][ny] = 2; // Water
              }
            }
          }
        }
        // 'plain' model: no water, so do nothing
      }

      // Generate clusters of desert (1) and jungle (3)
      function generateLandTerrain() {
        // Generate desert areas (1)
        generateClusters(1, 8, 5, 10);

        // Generate jungle areas (3)
        generateClusters(3, 10, 4, 8);
      }

      // Generic function to generate clustered terrain types
      function generateClusters(type, clusterCount, clusterSizeMin, clusterSizeMax) {
        for (var _i10 = 0; _i10 < clusterCount; _i10++) {
          var clusterX = Math.floor(Math.random() * gridSize);
          var clusterY = Math.floor(Math.random() * gridSize);
          var radius = Math.floor(Math.random() * (clusterSizeMax - clusterSizeMin)) + clusterSizeMin;

          // Ensure we avoid water if generating jungle/desert in the 'lac' or 'continent' models
          if (type !== 2 && terrainMap[clusterX][clusterY] === 2) {
            continue; // Skip if this area is water
          }
          generateTerrainCluster(clusterX, clusterY, radius, type);
        }
      }

      // Generate water based on the map model
      generateWater();

      // Generate desert and jungle clusters
      generateLandTerrain();
      return terrainMap;
    }
  }, {
    key: "generateCells",
    value: function generateCells() {
      var z = 0;
      var terrain = this.generateTerrain(121);
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
        for (var _j6 = 0; _j6 <= this.size; _j6++) {
          this.grid[_i11][_j6].fillWaterCellsAroundCell();
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
              var randomSpritesheet = maths_randomRange(292, 301).toString();
              var spritesheet = lib/* Assets */.sP.cache.get(randomSpritesheet);
              var texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
              var floor = lib/* Sprite */.kxk.from(texture);
              floor.label = 'floor';
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
                    var _randomSpritesheet = maths_randomRange(531, 534).toString();
                    var _spritesheet = lib/* Assets */.sP.cache.get(_randomSpritesheet);
                    var _texture = _spritesheet.textures['000_' + _randomSpritesheet + '.png'];
                    var rock = lib/* Sprite */.kxk.from(_texture);
                    rock.label = 'set';
                    rock.roundPixels = true;
                    rock.allowMove = false;
                    rock.eventMode = 'none';
                    rock.allowClick = false;
                    rock.updateAnchor = true;
                    cell.addChild(rock);
                    break;
                  case 'animal':
                    var animals = lib/* Assets */.sP.cache.get('config').animals;
                    var _type = maths_randomItem(Object.keys(animals));
                    this.gaia.createAnimal({
                      i: i,
                      j: j,
                      type: _type
                    });
                    break;
                }
              } else {
                this.resources.push(this.addChild(new Resource({
                  i: i,
                  j: j,
                  type: 'Salmon'
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
      for (var i = 0; i <= this.size; i++) {
        var _loop2 = function _loop2() {
          var cell = _this4.grid[i][j];
          if (Math.random() < _this4.chanceOfRelief) {
            var level = maths_randomItem(_this4.reliefRange);
            var canGenerate = true;
            if (getPlainCellsAroundPoint(i, j, _this4.grid, level * 2, function (cell) {
              if (cell.category === 'Water' || cell.has && cell.has.family === 'building') {
                canGenerate = false;
              }
            })) ;
            if (canGenerate) {
              cell.setCellLevel(level);
            }
          }
        };
        for (var j = 0; j <= this.size; j++) {
          _loop2();
        }
      }
      for (var _i12 = 0; _i12 <= this.size; _i12++) {
        var _loop3 = function _loop3() {
          var cell = _this4.grid[_i12][_j7];
          if (cell.z === 1) {
            var toRemove = true;
            var cpt = 0;
            if (getCellsAroundPoint(_i12, _j7, _this4.grid, 1, function (cell) {
              if (cell.z > 0) {
                cpt++;
              }
              if (cpt >= 3) {
                toRemove = false;
              }
            })) ;
            if (toRemove) {
              cell.setCellLevel(0);
            }
          }
        };
        for (var _j7 = 0; _j7 <= this.size; _j7++) {
          _loop3();
        }
      }
      // Format cell's relief
      for (var _i13 = 0; _i13 <= this.size; _i13++) {
        for (var _j8 = 0; _j8 <= this.size; _j8++) {
          var cell = this.grid[_i13][_j8];
          cell.fillReliefCellsAroundCell();
        }
      }
    }
  }, {
    key: "formatCellsRelief",
    value: function formatCellsRelief() {
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
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
      for (var i = 0; i <= this.size; i++) {
        for (var j = 0; j <= this.size; j++) {
          var cell = this.grid[i][j];
          if (cell.type !== 'Water') {
            // Side
            if (this.grid[i - 1] && this.grid[i - 1][j].type === 'Water' && (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') && (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') && (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water')) {
              cell.setWaterBorder('20000', '008');
            } else if (this.grid[i + 1] && this.grid[i + 1][j].type === 'Water' && (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water') && (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') && (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water')) {
              cell.setWaterBorder('20000', '009');
            } else if (this.grid[i][j - 1] && this.grid[i][j - 1].type === 'Water' && (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') && (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') && (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '011');
            } else if (this.grid[i][j + 1] && this.grid[i][j + 1].type === 'Water' && (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water') && (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') && (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '010');
            } // Corner
            else if (this.grid[i - 1] && this.grid[i - 1][j - 1] && this.grid[i - 1][j - 1].type === 'Water' && (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') && (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '005');
            } else if (this.grid[i + 1] && this.grid[i + 1][j - 1] && this.grid[i + 1][j - 1].type === 'Water' && (!this.grid[i][j - 1] || this.grid[i][j - 1].type !== 'Water') && (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '007');
            } else if (this.grid[i - 1] && this.grid[i - 1][j + 1] && this.grid[i - 1][j + 1].type === 'Water' && (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') && (!this.grid[i - 1] || this.grid[i - 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '004');
            } else if (this.grid[i + 1] && this.grid[i + 1][j + 1] && this.grid[i + 1][j + 1].type === 'Water' && (!this.grid[i][j + 1] || this.grid[i][j + 1].type !== 'Water') && (!this.grid[i + 1] || this.grid[i + 1][j].type !== 'Water')) {
              cell.setWaterBorder('20000', '006');
            }
            // Deep corner
            else if (this.grid[i][j - 1] && this.grid[i][j - 1].type === 'Water' && this.grid[i - 1] && this.grid[i - 1][j].type === 'Water') {
              cell.setWaterBorder('20000', '001');
            } else if (this.grid[i][j + 1] && this.grid[i][j + 1].type === 'Water' && this.grid[i + 1] && this.grid[i + 1][j].type === 'Water') {
              cell.setWaterBorder('20000', '002');
            } else if (this.grid[i][j - 1] && this.grid[i][j - 1].type === 'Water' && this.grid[i + 1] && this.grid[i + 1][j].type === 'Water') {
              cell.setWaterBorder('20000', '003');
            } else if (this.grid[i][j + 1] && this.grid[i][j + 1].type === 'Water' && this.grid[i - 1] && this.grid[i - 1][j].type === 'Water') {
              cell.setWaterBorder('20000', '000');
            }
          }
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
              this.grid[i - 1][j].setDesertBorder('est');
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
      var outBorder = 20;
      var inBorder = Math.floor(this.size / 4);
      var zones = [{
        minX: outBorder,
        minY: this.size / 2 + inBorder,
        maxX: this.size / 2 - inBorder,
        maxY: this.size - outBorder
      }, {
        minX: outBorder,
        minY: outBorder,
        maxX: this.size / 2 - inBorder,
        maxY: this.size / 2 - inBorder
      }, {
        minX: this.size / 2 + inBorder,
        minY: outBorder,
        maxX: this.size - outBorder,
        maxY: this.size / 2 - inBorder
      }, {
        minX: this.size / 2 + inBorder,
        minY: this.size / 2 + inBorder,
        maxX: this.size - outBorder,
        maxY: this.size - outBorder
      }];
      for (var i = 0; i < zones.length; i++) {
        var pos = getZoneInGridWithCondition(zones[i], this.grid, 5, function (cell) {
          return !cell.border && !cell.solid && !cell.inclined;
        });
        if (pos) {
          results.push(pos);
        }
      }
      return results;
    }
  }, {
    key: "placeResourceGroup",
    value: function placeResourceGroup(player, instance, quantity, range) {
      var context = this.context,
        grid = this.grid;

      // Function to get valid cells around a center point within a specific distance
      function getValidCells(centerI, centerJ, dist) {
        var cells = [];
        // Check surrounding cells within the specified distance
        for (var dx = -dist; dx <= dist; dx++) {
          var _loop4 = function _loop4() {
            var newI = centerI + dx;
            var newJ = centerJ + dy;

            // Ensure the new coordinates are within the grid bounds
            if (grid[newI] && grid[newI][newJ]) {
              var cell = grid[newI][newJ];
              var isFree = true;
              getPlainCellsAroundPoint(cell.i, cell.j, grid, 3, function (cell) {
                var _cell$has2;
                if (['Berrybush', 'Gold', 'Stone'].includes((_cell$has2 = cell.has) === null || _cell$has2 === void 0 ? void 0 : _cell$has2.type)) {
                  isFree = false;
                }
              });
              // Check if the cell is valid
              if (isFree && !cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined) {
                cells.push({
                  i: newI,
                  j: newJ
                });
              }
            }
          };
          for (var dy = -dist; dy <= dist; dy++) {
            _loop4();
          }
        }
        return cells;
      }

      // Get a random center point around the player's position within the specified range
      var randomDistance = maths_randomRange(range[0], range[1]);
      var centerI = player.i + maths_randomItem([-randomDistance, randomDistance]);
      var centerJ = player.j + maths_randomItem([-randomDistance, randomDistance]);

      // Gather valid cells around the center point
      var validCells = getValidCells(centerI, centerJ, 2); // Adjust distance to suit clustering

      // Check if we have enough valid cells to place the required quantity of resources
      if (validCells.length < quantity) {
        console.warn('Not enough valid cells found for resource placement.');
        return; // Exit if not enough valid cells found
      }

      // Randomly select the required number of cells from the valid cells
      var cellsToPlace = [];
      for (var i = 0; i < quantity; i++) {
        var itemIndex = Math.floor(Math.random() * validCells.length);
        var cell = validCells[itemIndex];
        cellsToPlace.push(cell); // Store the selected cell for placement
        validCells.splice(itemIndex, 1); // Remove it from valid cells to avoid duplicates
      }

      // Place resources in the selected cells
      for (var _i14 = 0, _cellsToPlace2 = cellsToPlace; _i14 < _cellsToPlace2.length; _i14++) {
        var _cell2 = _cellsToPlace2[_i14];
        this.resources.push(this.addChild(new Resource({
          i: _cell2.i,
          j: _cell2.j,
          type: instance
        }, context)));
      }
    }
  }]);
}(lib/* Container */.mcf);

;// ./app/classes/menu.js
function menu_typeof(o) { "@babel/helpers - typeof"; return menu_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, menu_typeof(o); }
function menu_ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function menu_objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? menu_ownKeys(Object(t), !0).forEach(function (r) { menu_defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : menu_ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function menu_defineProperty(e, r, t) { return (r = menu_toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
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
    menu.innerText = 'Menu';
    menu.addEventListener('pointerdown', function () {
      _this.context.pause();
      var content = document.createElement('div');
      content.className = 'modal-menu';
      var modal = new Modal(content);
      var save = document.createElement('button');
      save.innerText = 'Save';
      save.addEventListener('pointerdown', function () {
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
      load.className = 'input-file';
      load.innerText = 'Load';
      load.appendChild(input);
      var cancel = document.createElement('button');
      cancel.innerText = 'Cancel';
      cancel.addEventListener('pointerdown', function () {
        modal.close();
        _this.context.resume();
      });
      content.appendChild(save);
      content.appendChild(load);
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
        var minimapFactor = _this.getMinimapFactor();
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
      var minimapFactor = _this.getMinimapFactor();
      var rect = evt.target.getBoundingClientRect();
      var x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor;
      var y = (evt.clientY - rect.top - 3) * minimapFactor;
      if (player !== null && player !== void 0 && (_player$selectedUnits = player.selectedUnits) !== null && _player$selectedUnits !== void 0 && _player$selectedUnits.length) {
        var pos = isometricToCartesian(x, y);
        var i = Math.min(Math.max(pos[0], 0), map.size);
        var j = Math.min(Math.max(pos[1], 0), map.size);
        if (map.grid[i] && map.grid[i][j]) {
          var cell = map.grid[i][j];
          controls.sendUnits(cell);
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
    this.updatePlayerMiniMap = throttle(this.updatePlayerMiniMapEvt, 500);
    this.updateResourcesMiniMap = throttle(this.updateResourcesMiniMapEvt, 500);
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt, 100);
    this.miniMapAlpha = 1.284;
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
      this.initMiniMap();
      this.updateTopbar();
    }
  }, {
    key: "getMinimapFactor",
    value: function getMinimapFactor() {
      var map = this.context.map;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      return mapWidth / 234 * 2;
    }
  }, {
    key: "initMiniMap",
    value: function initMiniMap() {
      var map = this.context.map;
      var context = this.terrainMinimap.getContext('2d');
      var cameraContext = this.cameraMinimap.getContext('2d');
      var resourceContext = this.resourcesMinimap.getContext('2d');
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      context.translate(translate, 0);
      cameraContext.translate(translate, 0);
      resourceContext.translate(translate, 0);
      if (map.revealEverything || map.revealTerrain) {
        this.revealTerrainMinimap();
      }
    }
  }, {
    key: "revealTerrainMinimap",
    value: function revealTerrainMinimap() {
      var map = this.context.map;
      var canvas = this.terrainMinimap;
      var context = canvas.getContext('2d');
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      for (var i = 0; i <= map.size; i++) {
        for (var j = 0; j <= map.size; j++) {
          var cell = map.grid[i][j];
          var x = cell.x;
          var y = cell.y;
          canvasDrawDiamond(context, x / minimapFactor + translate, y / minimapFactor, CELL_WIDTH / minimapFactor + 1, CELL_HEIGHT / minimapFactor + 1, cell.color);
        }
      }
    }
  }, {
    key: "updateTerrainMiniMap",
    value: function updateTerrainMiniMap(i, j) {
      var map = this.context.map;
      var canvas = this.terrainMinimap;
      var context = canvas.getContext('2d');
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      var cell = map.grid[i][j];
      var color = cell.color;
      var x = cell.x;
      var y = cell.y;
      canvasDrawDiamond(context, x / minimapFactor + translate, y / minimapFactor, CELL_WIDTH / minimapFactor + 1, CELL_HEIGHT / minimapFactor + 1, color);
      if (cell.has && cell.has.family === 'resource') {
        this.updateResourceMiniMap(cell.has);
      }
    }
  }, {
    key: "updateResourceMiniMap",
    value: function updateResourceMiniMap(resource) {
      var map = this.context.map;
      var canvas = this.resourcesMinimap;
      var context = canvas.getContext('2d');
      var squareSize = 4;
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      var finalX = resource.x / minimapFactor - squareSize / 2;
      var finalY = resource.y / minimapFactor - squareSize / 2;
      canvasDrawRectangle(context, finalX + translate, finalY, squareSize, squareSize, resource.color);
    }
  }, {
    key: "updateResourcesMiniMapEvt",
    value: function updateResourcesMiniMapEvt() {
      var _this$context2 = this.context,
        map = _this$context2.map,
        player = _this$context2.player;
      var canvas = this.resourcesMinimap;
      var context = canvas.getContext('2d');
      var squareSize = 4;
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      map.resources.forEach(function (resource) {
        var _player$views;
        var cell = player === null || player === void 0 || (_player$views = player.views) === null || _player$views === void 0 || (_player$views = _player$views[resource.i]) === null || _player$views === void 0 ? void 0 : _player$views[resource.j];
        if (resource.color && (cell !== null && cell !== void 0 && cell.viewed || map.revealEverything)) {
          var finalX = resource.x / minimapFactor - squareSize / 2;
          var finalY = resource.y / minimapFactor - squareSize / 2;
          canvasDrawRectangle(context, finalX + translate, finalY, squareSize, squareSize, resource.color);
        }
      });
    }
  }, {
    key: "updateCameraMiniMapEvt",
    value: function updateCameraMiniMapEvt() {
      var _this$context3 = this.context,
        app = _this$context3.app,
        map = _this$context3.map,
        controls = _this$context3.controls;
      var canvas = this.cameraMinimap;
      var context = canvas.getContext('2d');
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      var x = controls.camera.x / minimapFactor;
      var y = controls.camera.y / minimapFactor;
      var w = app.screen.width / minimapFactor;
      var h = app.screen.height / minimapFactor;
      canvasDrawStrokeRectangle(context, x + translate, y, w, h, 'white');
    }
  }, {
    key: "updatePlayerMiniMapEvt",
    value: function updatePlayerMiniMapEvt(owner) {
      if (!owner) {
        return;
      }
      var map = this.context.map;
      var squareSize = 4;
      var playerMinimap = this.playersMinimap.find(function (_ref2) {
        var id = _ref2.id;
        return id === "minimap-".concat(owner.label);
      });
      var color = owner.colorHex;
      var canvas;
      var context;
      var minimapFactor = this.getMinimapFactor() / this.miniMapAlpha;
      var mapWidth = CELL_WIDTH / 2 + map.size * CELL_WIDTH / 2;
      var translate = mapWidth / 2 / minimapFactor;
      if (playerMinimap) {
        canvas = playerMinimap.canvas;
        context = playerMinimap.context;
      } else {
        canvas = document.createElement('canvas');
        context = canvas.getContext('2d');
        context.translate(translate, 0);
        this.playersMinimap.push({
          id: "minimap-".concat(owner.label),
          canvas: canvas,
          context: context
        });
        this.bottombarMap.appendChild(canvas);
      }
      context.clearRect(-translate, 0, canvas.width, canvas.height);
      owner.buildings.forEach(function (_ref3) {
        var x = _ref3.x,
          y = _ref3.y,
          size = _ref3.size,
          selected = _ref3.selected;
        var finalSize = squareSize + size;
        var finalX = x / minimapFactor - finalSize / 2;
        var finalY = y / minimapFactor - finalSize / 2;
        canvasDrawRectangle(context, finalX + translate, finalY, finalSize, finalSize, selected ? 'white' : color);
      });
      owner.units.forEach(function (_ref4) {
        var x = _ref4.x,
          y = _ref4.y,
          selected = _ref4.selected;
        var finalX = x / minimapFactor - squareSize / 2;
        var finalY = y / minimapFactor - squareSize / 2;
        canvasDrawRectangle(context, finalX + translate, finalY, squareSize, squareSize, selected ? 'white' : color);
      });
    }
  }, {
    key: "getMessage",
    value: function getMessage(cost) {
      var player = this.context.player;
      var resource = Object.keys(cost).find(function (prop) {
        return player[prop] < cost[prop];
      });
      return "You need more ".concat(resource, " !");
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
    key: "updateBottombar",
    value: function updateBottombar() {
      var player = this.context.player;
      if (player.selectedBuilding || player.selectedUnit) {
        this.setBottombar(player.selectedBuilding || player.selectedUnit);
      }
    }
  }, {
    key: "updateTopbar",
    value: function updateTopbar() {
      var _this2 = this;
      var player = this.context.player;
      var t = {
        0: 'Stone Age',
        1: 'Tool Age',
        2: 'Bronze Age',
        3: 'Iron Age'
      };
      ['wood', 'food', 'stone', 'gold', 'age'].forEach(function (prop) {
        var val = Math.min(player && player[prop] || 0, 99999);
        _this2[prop].textContent = prop === 'age' ? t[val] : val;
      });
    }
  }, {
    key: "resetInfo",
    value: function resetInfo() {
      this.bottombarInfo.textContent = '';
      this.bottombarInfo.style.background = 'transparent';
    }
  }, {
    key: "generateInfo",
    value: function generateInfo(selection) {
      this.resetInfo();
      this.bottombarInfo.style.background = 'black';
      if (typeof selection["interface"].info === 'function') {
        selection["interface"].info(this.bottombarInfo);
      }
    }
  }, {
    key: "updateInfo",
    value: function updateInfo(target, action) {
      var targetElement = this.bottombarInfo.querySelector("[id=".concat(target, "]"));
      if (!targetElement) {
        return;
      }
      return typeof action !== 'function' ? targetElement.textContent = action : action(targetElement);
    }
  }, {
    key: "updateButtonContent",
    value: function updateButtonContent(target, action) {
      var targetElement = this.bottombarMenu.querySelector("[id=".concat(target, "]"));
      if (!targetElement) {
        return;
      }
      var contentElement = targetElement.querySelector('[id=content]');
      if (!contentElement) {
        return;
      }
      return typeof action !== 'function' ? contentElement.textContent = action : action(contentElement);
    }
  }, {
    key: "toggleButtonCancel",
    value: function toggleButtonCancel(target, value) {
      var element = this.bottombarMenu.querySelector("[id=".concat(target, "-cancel]"));
      if (!element) {
        return;
      }
      element.style.display = value ? 'block' : 'none';
    }
  }, {
    key: "setBottombar",
    value: function setBottombar() {
      var selection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var _this$context4 = this.context,
        controls = _this$context4.controls,
        player = _this$context4.player;
      this.resetInfo();
      this.bottombarMenu.textContent = '';
      this.selection = selection;
      if (controls.mouseBuilding) {
        controls.removeMouseBuilding();
      }
      if (selection && selection["interface"]) {
        this.generateInfo(selection);
        if (selection.family === 'building') {
          if (!selection.isBuilt) {
            setMenuRecurs(selection, this.bottombarMenu, []);
          } else if (selection.technology) {
            setMenuRecurs(selection, this.bottombarMenu, [{
              icon: 'assets/interface/50721/003_50721.png',
              id: "".concat(type, "-cancel"),
              onClick: function onClick(selection) {
                sound_lib/* sound */.s3.play('5036');
                selection.cancelTechnology();
              }
            }]);
          } else {
            setMenuRecurs(selection, this.bottombarMenu, selection["interface"].menu || []);
          }
        } else {
          setMenuRecurs(selection, this.bottombarMenu, selection["interface"].menu || []);
        }
      }
      function setMenuRecurs(selection, element, menu, parent) {
        menu.filter(function (btn) {
          return !btn.hide || !btn.hide();
        }).forEach(function (btn, index) {
          var box = document.createElement('div');
          box.className = 'bottombar-menu-box';
          box.id = btn.id || "btn-".concat(index);
          if (typeof btn.onCreate === 'function') {
            btn.onCreate(selection, box);
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
              setMenuRecurs(selection, element, btn.children, menu);
            });
          } else if (typeof btn.onClick === 'function') {
            box.addEventListener('pointerup', function (evt) {
              sound_lib/* sound */.s3.play('5036');
              btn.onClick(selection, evt);
            });
          }
          element.appendChild(box);
        });
        if (parent || selection.selected) {
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
              setMenuRecurs(selection, element, parent);
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
    key: "getUnitButton",
    value: function getUnitButton(type) {
      var _this3 = this;
      var player = this.context.player;
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
          if (!selection.queue.filter(function (q) {
            return q === type;
          }).length) {
            cancel.style.display = 'none';
          }
          cancel.addEventListener('pointerup', function () {
            sound_lib/* sound */.s3.play('5036');
            for (var i = 0; i < selection.queue.length; i++) {
              if (selection.queue[i] === type) {
                refundCost(player, unit.cost);
              }
            }
            _this3.updateTopbar();
            selection.queue = selection.queue.filter(function (q) {
              return q !== type;
            });
            if (selection.queue[0] !== type) {
              _this3.updateButtonContent(type, '');
              _this3.toggleButtonCancel(type, false);
            }
          });
          var img = document.createElement('img');
          img.src = getIconPath(unit.icon);
          img.className = 'img';
          img.addEventListener('pointerup', function () {
            sound_lib/* sound */.s3.play('5036');
            if (canAfford(player, unit.cost)) {
              if (player.population >= player.POPULATION_MAX) {
                _this3.showMessage('You need to build more houses');
              }
              _this3.toggleButtonCancel(type, true);
              selection.buyUnit(type);
            } else {
              _this3.showMessage(_this3.getMessage(unit.cost));
            }
          });
          var queue = selection.queue.filter(function (queue) {
            return queue === type;
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
      var _this4 = this;
      var _this$context5 = this.context,
        controls = _this$context5.controls,
        player = _this$context5.player;
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
            controls.setMouseBuilding(menu_objectSpread(menu_objectSpread(menu_objectSpread({}, config), assets), {}, {
              type: type
            }));
          } else {
            _this4.showMessage(_this4.getMessage(config.cost));
          }
        }
      };
    }
  }, {
    key: "getTechnologyButton",
    value: function getTechnologyButton(type) {
      var _this5 = this;
      var _this$context6 = this.context,
        controls = _this$context6.controls,
        player = _this$context6.player;
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
            _this5.showMessage(_this5.getMessage(config.cost));
          }
        }
      };
    }
  }]);
}();

;// ./app/classes/controls.js
function controls_typeof(o) { "@babel/helpers - typeof"; return controls_typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, controls_typeof(o); }
function controls_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = controls_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function controls_slicedToArray(r, e) { return controls_arrayWithHoles(r) || controls_iterableToArrayLimit(r, e) || controls_unsupportedIterableToArray(r, e) || controls_nonIterableRest(); }
function controls_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function controls_iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function controls_arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function controls_toConsumableArray(r) { return controls_arrayWithoutHoles(r) || controls_iterableToArray(r) || controls_unsupportedIterableToArray(r) || controls_nonIterableSpread(); }
function controls_nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function controls_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return controls_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? controls_arrayLikeToArray(r, a) : void 0; } }
function controls_iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function controls_arrayWithoutHoles(r) { if (Array.isArray(r)) return controls_arrayLikeToArray(r); }
function controls_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
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
    _this.camera = {
      x: 0,
      y: 0
    };
    _this.visibleCells = new Set();
    _this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2));
    _this.mouseHoldTimeout;
    _this.keysPressed = {};
    _this.keyInterval;
    _this.keySpeed = 0;
    _this.eventMode = 'auto';
    _this.allowMove = false;
    _this.allowClick = false;
    _this.mouseRectangle;
    _this.mouseTouch;
    _this.mouseDrag = false;
    _this.moveCameraInterval;
    _this.minimapRectangle = new lib/* Graphics */.A1g();
    _this.addChild(_this.minimapRectangle);
    document.addEventListener('mousemove', function (evt) {
      return _this.moveCameraWithMouse(evt);
    });
    document.addEventListener('mouseout', function () {
      return clearInterval(_this.moveCameraInterval);
    });
    document.addEventListener('keydown', function (evt) {
      return _this.onKeyDown(evt);
    });
    document.addEventListener('keyup', function (evt) {
      return _this.onKeyUp(evt);
    });
    gamebox.addEventListener('touchstart', function (evt) {
      return _this.onTouchStart(evt);
    });
    gamebox.addEventListener('touchend', function (evt) {
      return _this.onTouchEnd(evt);
    });
    gamebox.addEventListener('touchmove', function (evt) {
      return _this.onTouchMove(evt);
    });
    gamebox.addEventListener('mousemove', function (evt) {
      return _this.onMouseMove(evt);
    });
    gamebox.addEventListener('mousedown', function (evt) {
      return _this.onMouseDown(evt);
    });
    gamebox.addEventListener('mouseup', function (evt) {
      return _this.onMouseUp(evt);
    });
    return _this;
  }
  controls_inherits(Controls, _Container);
  return controls_createClass(Controls, [{
    key: "destroy",
    value: function destroy() {
      var _this2 = this;
      var gamebox = this.context.gamebox;
      document.removeEventListener('mousemove', function (evt) {
        return _this2.moveCameraWithMouse(evt);
      });
      document.removeEventListener('mouseout', function () {
        return clearInterval(_this2.moveCameraInterval);
      });
      document.removeEventListener('keydown', function (evt) {
        return _this2.onKeyDown(evt);
      });
      document.removeEventListener('keyup', function (evt) {
        return _this2.onKeyUp(evt);
      });
      gamebox.removeEventListener('touchstart', function (evt) {
        return _this2.onTouchStart(evt);
      });
      gamebox.removeEventListener('touchend', function (evt) {
        return _this2.onTouchEnd(evt);
      });
      gamebox.removeEventListener('touchmove', function (evt) {
        return _this2.onTouchMove(evt);
      });
      gamebox.removeEventListener('mousemove', function (evt) {
        return _this2.onMouseMove(evt);
      });
      gamebox.removeEventListener('mousedown', function (evt) {
        return _this2.onMouseDown(evt);
      });
      gamebox.removeEventListener('mouseup', function (evt) {
        return _this2.onMouseUp(evt);
      });
    }
  }, {
    key: "onKeyDown",
    value: function onKeyDown(evt) {
      var _this3 = this;
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
        if (!_this3.keyInterval) {
          _this3.keyInterval = setInterval(function () {
            var _double = false;
            if (Object.values(_this3.keysPressed).filter(Boolean).length > 1) {
              _double = true;
            }
            if (_this3.keySpeed < 4) {
              _this3.keySpeed += 0.2;
            }
            if (_this3.keysPressed['ArrowLeft']) {
              _this3.moveCamera('left', _this3.keySpeed, _double);
            }
            if (_this3.keysPressed['ArrowUp']) {
              _this3.moveCamera('up', _this3.keySpeed, _double);
            }
            if (_this3.keysPressed['ArrowDown']) {
              _this3.moveCamera('down', _this3.keySpeed, _double);
            }
            if (_this3.keysPressed['ArrowRight']) {
              _this3.moveCamera('right', _this3.keySpeed, _double);
            }
          }, 1);
        }
      };
      if (!evt.repeat) {
        this.keysPressed[evt.key] = true;
      }
      var controlsMap = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'];
      if (controlsMap.includes(evt.key)) {
        handleMoveCamera();
      }
    }
  }, {
    key: "onKeyUp",
    value: function onKeyUp(evt) {
      if (!evt.repeat) {
        delete this.keysPressed[evt.key];
      }
      if (!Object.values(this.keysPressed).filter(Boolean).length) {
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
          if (this.mouse.x > this.mouseTouch.x) {
            this.moveCamera('left', speedX, false);
          }
          if (this.mouse.y > this.mouseTouch.y) {
            this.moveCamera('up', speedY, false);
          }
          if (this.mouse.y < this.mouseTouch.y) {
            this.moveCamera('down', speedY, false);
          }
          if (this.mouse.x < this.mouseTouch.x) {
            this.moveCamera('right', speedX, false);
          }
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
      if (!this.isMouseInApp(evt)) {
        return;
      }
      this.pointerStart = {
        x: this.mouse.x,
        y: this.mouse.y
      };
    }
  }, {
    key: "onMouseMove",
    value: function onMouseMove(evt) {
      var _this$context = this.context,
        map = _this$context.map,
        player = _this$context.player,
        app = _this$context.app;
      this.mouse.x = evt.pageX;
      this.mouse.y = evt.pageY;

      // Mouse building to place construction
      if (this.mouseBuilding) {
        var pos = maths_isometricToCartesian(this.mouse.x - map.x, this.mouse.y >= app.screen.height ? app.screen.height - map.y : this.mouse.y - map.y);
        var i = Math.min(Math.max(pos[0], 0), map.size);
        var j = Math.min(Math.max(pos[1], 0), map.size);
        if (map.grid[i] && map.grid[i][j]) {
          var cell = map.grid[i][j];
          this.mouseBuilding.x = cell.x - this.camera.x;
          this.mouseBuilding.y = cell.y - this.camera.y;
          var isFree = true;
          var dist = this.mouseBuilding.size === 3 ? 1 : 0;
          if (this.mouseBuilding.buildOnWater) {
            var waterBorderedCells = 0;
            var waterCells = 0;
            getPlainCellsAroundPoint(i, j, map.grid, dist, function (cell) {
              if (cell.inclined || cell.solid || !cell.visible) {
                isFree = false;
                return;
              }
              if (cell.waterBorder) {
                waterBorderedCells++;
              } else if (cell.category === 'Water') {
                waterCells++;
              }
            });
            if (waterBorderedCells < 2 && waterCells < 4) {
              isFree = false;
            }
          } else {
            getPlainCellsAroundPoint(i, j, map.grid, dist, function (cell) {
              if (cell.category === 'Water' || cell.solid || cell.inclined || cell.border || !cell.visible) {
                isFree = false;
                return;
              }
            });
          }
          // Color image of mouse building depend on buildable or not
          var sprite = this.mouseBuilding.getChildByLabel('sprite');
          var color = this.mouseBuilding.getChildByLabel('color');
          if (isFree) {
            sprite.tint = COLOR_WHITE;
            if (color) {
              color.tint = COLOR_WHITE;
            }
          } else {
            sprite.tint = COLOR_RED;
            if (color) {
              color.tint = COLOR_RED;
            }
          }
          this.mouseBuilding.isFree = isFree;
        }
        return;
      }

      // Create and draw mouse selection
      if (!this.mouseRectangle && this.pointerStart && maths_pointsDistance(this.mouse.x, this.mouse.y, this.pointerStart.x, this.pointerStart.y) > 5) {
        this.mouseRectangle = {
          x: this.pointerStart.x,
          y: this.pointerStart.y,
          width: 0,
          height: 0,
          graph: new lib/* Graphics */.A1g()
        };
        app.stage.addChild(this.mouseRectangle.graph);
      }
      if (this.mouseRectangle && !this.mouseBuilding) {
        if (player.selectedUnits.length || player.selectedBuilding) {
          player.unselectAll();
        }
        var graph = this.mouseRectangle.graph;
        graph.clear();
        this.mouseRectangle.width = this.mouse.x - this.mouseRectangle.x;
        this.mouseRectangle.height = this.mouse.y - this.mouseRectangle.y;
        var x = Math.min(this.mouseRectangle.x, this.mouseRectangle.x + this.mouseRectangle.width);
        var y = Math.min(this.mouseRectangle.y, this.mouseRectangle.y + this.mouseRectangle.height);
        var w = Math.abs(this.mouseRectangle.width);
        var h = Math.abs(this.mouseRectangle.height);
        graph.rect(x, y, w, h).stroke(COLOR_WHITE);
      }
    }
  }, {
    key: "onMouseUp",
    value: function onMouseUp(evt) {
      var _this$context2 = this.context,
        menu = _this$context2.menu,
        map = _this$context2.map,
        player = _this$context2.player;
      this.pointerStart = null;
      clearTimeout(this.mouseHoldTimeout);
      if (!this.isMouseInApp(evt) || this.mouse.prevent || this.mouseDrag) {
        this.mouse.prevent = false;
        return;
      }
      (player === null || player === void 0 ? void 0 : player.selectedBuilding) && player.unselectAll();
      // Select units on mouse rectangle
      if (this.mouseRectangle) {
        var selectVillager;
        var countSelect = 0;
        player.unselectAll();
        // Select units inside the rectangle
        for (var i = 0; i < player.units.length; i++) {
          var unit = player.units[i];
          if (player.selectedUnits.length < MAX_SELECT_UNITS && pointInRectangle(unit.x - this.camera.x, unit.y - this.camera.y, this.mouseRectangle.x, this.mouseRectangle.y, this.mouseRectangle.width, this.mouseRectangle.height, true)) {
            unit.select();
            countSelect++;
            if (unit.type === 'Villager') {
              selectVillager = unit;
            }
            player.selectedUnits.push(unit);
          }
        }
        // Set our bottombar
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
        // Reset mouse selection
        if (this.mouseRectangle) {
          this.mouseRectangle.graph.destroy(true);
          this.mouseRectangle = null;
        }
        return;
      }
      if (this.isMouseInApp(evt)) {
        var pos = maths_isometricToCartesian(this.mouse.x - map.x, this.mouse.y - map.y);
        var _i = Math.min(Math.max(pos[0], 0), map.size);
        var j = Math.min(Math.max(pos[1], 0), map.size);
        if (map.grid[_i] && map.grid[_i][j]) {
          var cell = map.grid[_i][j];
          if ((cell.solid || cell.has) && cell.visible) {
            return;
          }
          if (this.mouseBuilding) {
            if (cell.inclined || cell.border) {
              return;
            }
            if (this.mouseBuilding.isFree) {
              if (player.buyBuilding(_i, j, this.mouseBuilding.type)) {
                this.removeMouseBuilding();
                if (menu.selection) {
                  menu.setBottombar(menu.selection);
                }
              }
            }
          } else if (player !== null && player !== void 0 && player.selectedUnits.length) {
            // Pointer animation
            var pointerSheet = lib/* Assets */.sP.cache.get('50405');
            var pointer = new lib/* AnimatedSprite */.Dl5(pointerSheet.animations['animation']);
            pointer.animationSpeed = 0.2 * ACCELERATOR;
            pointer.loop = false;
            pointer.anchor.set(0.5, 0.5);
            pointer.x = this.mouse.x;
            pointer.y = this.mouse.y;
            pointer.allowMove = false;
            pointer.allowClick = false;
            pointer.eventMode = 'auto';
            pointer.roundPixels = true;
            pointer.onComplete = function () {
              pointer.destroy();
            };
            pointer.play();
            this.addChild(pointer);
            // Send units
            this.sendUnits(cell);
          }
        }
      }
    }
  }, {
    key: "sendUnits",
    value: function sendUnits(cell) {
      var _this$context3 = this.context,
        player = _this$context3.player,
        map = _this$context3.map;
      var minX = Math.min.apply(Math, controls_toConsumableArray(player.selectedUnits.map(function (unit) {
        return unit.i;
      })));
      var minY = Math.min.apply(Math, controls_toConsumableArray(player.selectedUnits.map(function (unit) {
        return unit.j;
      })));
      var maxX = Math.max.apply(Math, controls_toConsumableArray(player.selectedUnits.map(function (unit) {
        return unit.i;
      })));
      var maxY = Math.max.apply(Math, controls_toConsumableArray(player.selectedUnits.map(function (unit) {
        return unit.j;
      })));
      var centerX = minX + Math.round((maxX - minX) / 2);
      var centerY = minY + Math.round((maxY - minY) / 2);
      var hasSentVillager = false;
      var hasSentSoldier = false;
      for (var u = 0; u < player.selectedUnits.length; u++) {
        var unit = player.selectedUnits[u];
        var distCenterX = unit.i - centerX;
        var distCenterY = unit.j - centerY;
        var finalX = cell.i + distCenterX;
        var finalY = cell.j + distCenterY;
        if (unit.type === 'Villager') {
          hasSentVillager = true;
        } else {
          hasSentSoldier = true;
        }
        if (map.grid[finalX] && map.grid[finalX][finalY]) {
          player.selectedUnits[u].sendTo(map.grid[finalX][finalY]);
        } else {
          player.selectedUnits[u].sendTo(cell);
        }
      }
      if (hasSentSoldier) {
        var voice = maths_randomItem(['5075', '5076', '5128', '5164']);
        sound_lib/* sound */.s3.play(voice);
      } else if (hasSentVillager) {
        sound_lib/* sound */.s3.play('5006');
      }
    }
  }, {
    key: "isMouseInApp",
    value: function isMouseInApp(evt) {
      return evt.target && (!evt.target.tagName || evt.target.closest('#game'));
    }
  }, {
    key: "removeMouseBuilding",
    value: function removeMouseBuilding() {
      if (!this.mouseBuilding) {
        return;
      }
      this.removeChild(this.mouseBuilding);
      this.mouseBuilding.destroy();
      this.mouseBuilding = null;
    }
  }, {
    key: "setMouseBuilding",
    value: function setMouseBuilding(building) {
      var _this4 = this;
      var player = this.context.player;
      this.mouseBuilding = new lib/* Container */.mcf();
      var sprite = lib/* Sprite */.kxk.from(getTexture(building.images["final"], lib/* Assets */.sP));
      sprite.label = 'sprite';
      this.mouseBuilding.addChild(sprite);
      Object.keys(building).forEach(function (prop) {
        _this4.mouseBuilding[prop] = building[prop];
      });
      this.mouseBuilding.x = this.mouse.x;
      this.mouseBuilding.y = this.mouse.y;
      this.mouseBuilding.label = 'mouseBuilding';
      if (building.images.color) {
        var color = lib/* Sprite */.kxk.from(getTexture(building.images.color, lib/* Assets */.sP));
        color.label = 'color';
        changeSpriteColor(color, player.color);
        this.mouseBuilding.addChild(color);
      } else {
        changeSpriteColor(sprite, player.color);
      }
      this.addChild(this.mouseBuilding);
    }
  }, {
    key: "moveCamera",
    value: function moveCamera(dir, moveSpeed, isSpeedDivided) {
      /**
       * 	/A\
       * /   \
       *B     D
       * \   /
       *  \C/
       */

      var _this$context4 = this.context,
        map = _this$context4.map,
        app = _this$context4.app,
        menu = _this$context4.menu;
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
        x: this.camera.x + app.screen.width / 2 - this.camera.x,
        y: this.camera.y + app.screen.height / 2 - this.camera.y
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
      this.updateVisibleCells();
    }
  }, {
    key: "moveCameraWithMouse",
    value: function moveCameraWithMouse(evt) {
      var _this5 = this;
      clearInterval(this.moveCameraInterval);
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
        this.moveCameraInterval = setInterval(function () {
          dir.forEach(function (prop) {
            _this5.moveCamera(prop, calcs[prop]);
          });
        }, 20);
      }
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
      var _this$context5 = this.context,
        map = _this$context5.map,
        app = _this$context5.app;
      var cameraFloor = {
        x: Math.floor(this.camera.x),
        y: Math.floor(this.camera.y)
      };
      var margin = CELL_WIDTH;
      for (var i = cameraFloor.x - margin; i <= cameraFloor.x + app.screen.width + margin; i += CELL_WIDTH / 2) {
        for (var j = cameraFloor.y - margin; j <= cameraFloor.y + app.screen.height + margin; j += CELL_HEIGHT / 2) {
          var _isometricToCartesian = maths_isometricToCartesian(i, j),
            _isometricToCartesian2 = controls_slicedToArray(_isometricToCartesian, 2),
            cartesianX = _isometricToCartesian2[0],
            cartesianY = _isometricToCartesian2[1];
          var x = Math.min(Math.max(cartesianX, 0), map.size - 1); // Adjust for index bounds
          var y = Math.min(Math.max(cartesianY, 0), map.size - 1);

          // Ensure the coordinates are within bounds and call the callback
          if (map.grid[x] && map.grid[x][y]) {
            callback(map.grid[x][y]);
          }
        }
      }
    }
  }, {
    key: "updateVisibleCells",
    value: function updateVisibleCells() {
      var _this$context6 = this.context,
        map = _this$context6.map,
        app = _this$context6.app;
      var newVisible = new Set();
      var margin = CELL_WIDTH; // extra padding for offscreen cells

      var startX = Math.floor(this.camera.x - margin);
      var endX = Math.floor(this.camera.x + app.screen.width + margin);
      var startY = Math.floor(this.camera.y - margin);
      var endY = Math.floor(this.camera.y + app.screen.height + margin);
      for (var i = startX; i <= endX; i += CELL_WIDTH / 2) {
        for (var j = startY; j <= endY; j += CELL_HEIGHT / 2) {
          var _map$grid$x;
          var _isometricToCartesian3 = maths_isometricToCartesian(i, j),
            _isometricToCartesian4 = controls_slicedToArray(_isometricToCartesian3, 2),
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

      // Hide cells that left the viewport
      var _iterator = controls_createForOfIteratorHelper(this.visibleCells),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _cell = _step.value;
          if (!newVisible.has(_cell)) {
            _cell.visible = false;
            if (_cell.has) _cell.has.visible = false;
          }
        }

        // Show newly visible cells
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      var _iterator2 = controls_createForOfIteratorHelper(newVisible),
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
    key: "init",
    value: function init() {
      var _player$buildings, _player$units;
      var _this$context7 = this.context,
        player = _this$context7.player,
        map = _this$context7.map;
      // Set camera to player building else unit
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
      var _this$context8 = this.context,
        map = _this$context8.map,
        app = _this$context8.app,
        menu = _this$context8.menu;
      this.camera = {
        x: direct ? x : x - app.screen.width / 2,
        y: direct ? y : y - app.screen.height / 2
      };
      menu && menu.updateCameraMiniMap();
      map.setCoordinate(-this.camera.x, -this.camera.y);
      this.updateVisibleCells();
    }
  }]);
}(lib/* Container */.mcf);

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
    Game_classCallCheck(this, Game);
    _this = Game_callSuper(this, Game);
    _this.context = {
      app: app,
      gamebox: gamebox,
      menu: null,
      player: null,
      players: [],
      map: null,
      controls: null,
      paused: false,
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
      }
    };
    _this.start();
    return _this;
  }
  Game_inherits(Game, _Container);
  return Game_createClass(Game, [{
    key: "start",
    value: function start() {
      var _this2 = this;
      var context = this.context;
      context.map = new map_Map(context);
      context.controls = new Controls(context);
      context.menu = new Menu(context);
      context.map.generateMap();
      context.players = context.map.generatePlayers();
      context.player = context.players[0];
      context.menu.init();
      context.map.placePlayers();
      context.map.stylishMap();
      context.controls.init();
      this.addChild(context.map);
      this.addChild(context.controls);
      window.addEventListener('keydown', function (evt) {
        if (evt.key === 'p') {
          _this2.context.paused ? context.resume() : context.pause();
        }
      });
      window.addEventListener('resize', function () {
        if (context.controls) {
          context.controls.updateVisibleCells();
        }
        if (context.menu) {
          context.menu.updateCameraMiniMap();
        }
      });
    }
  }, {
    key: "save",
    value: function save() {
      var cleanContext = function cleanContext(context) {
        var resourceData = function resourceData(resource) {
          return Game_objectSpread(Game_objectSpread({}, filterObject(resource, ['label', 'i', 'j', 'selected', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints'])), {}, {
            textureName: (resource.textureName || '').split('.')[0]
          });
        };
        var animalData = function animalData(animal) {
          var _animal$sprite, _animal$sprite2, _animal$dest, _animal$previousDest;
          return Game_objectSpread(Game_objectSpread({}, filterObject(animal, ['label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest', 'path', 'zIndex', 'selected', 'degree', 'action', 'direction', 'currentSheet', 'size', 'inactif', 'isDead', 'isDestroyed', 'quantity'])), {}, {
            currentFrame: (_animal$sprite = animal.sprite) === null || _animal$sprite === void 0 ? void 0 : _animal$sprite.currentFrame,
            loop: (_animal$sprite2 = animal.sprite) === null || _animal$sprite2 === void 0 ? void 0 : _animal$sprite2.loop,
            dest: animal.dest && [animal.dest.i, animal.dest.i, (_animal$dest = animal.dest) === null || _animal$dest === void 0 ? void 0 : _animal$dest.label],
            previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.i, (_animal$previousDest = animal.previousDest) === null || _animal$previousDest === void 0 ? void 0 : _animal$previousDest.label]
          });
        };
        var unitData = function unitData(unit) {
          var _unit$sprite, _unit$sprite2, _unit$dest, _unit$previousDest;
          return Game_objectSpread(Game_objectSpread({}, filterObject(unit, ['label', 'type', 'i', 'j', 'x', 'y', 'z', 'hitPoints', 'path', 'work', 'realDest', 'path', 'selected', 'degree', 'action', 'loading', 'loadingType', 'direction', 'currentSheet', 'size', 'inactif', 'isDead', 'isDestroyed'])), {}, {
            currentFrame: (_unit$sprite = unit.sprite) === null || _unit$sprite === void 0 ? void 0 : _unit$sprite.currentFrame,
            loop: (_unit$sprite2 = unit.sprite) === null || _unit$sprite2 === void 0 ? void 0 : _unit$sprite2.loop,
            dest: unit.dest && [unit.dest.i, unit.dest.i, (_unit$dest = unit.dest) === null || _unit$dest === void 0 ? void 0 : _unit$dest.label],
            previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.i, (_unit$previousDest = unit.previousDest) === null || _unit$previousDest === void 0 ? void 0 : _unit$previousDest.label]
          });
        };
        var buildingData = function buildingData(building) {
          var _building$isUsedBy;
          return Game_objectSpread(Game_objectSpread({}, filterObject(building, ['label', 'i', 'j', 'type', 'selected', 'queue', 'technology', 'loading', 'isDead', 'isDestroyed', 'isBuilt', 'hitPoints', 'quantity'])), {}, {
            isUsedBy: (_building$isUsedBy = building.isUsedBy) === null || _building$isUsedBy === void 0 ? void 0 : _building$isUsedBy.iname
          });
        };
        var playerData = function playerData(player) {
          return Game_objectSpread(Game_objectSpread({}, filterObject(player, ['label', 'age', 'type', 'wood', 'food', 'stone', 'gold', 'civ', 'color', 'population', 'POPULATION_MAX', 'technologies', 'cellViewed', 'isPlayed', 'hasBuilt'])), {}, {
            buildings: player.buildings.map(function (building) {
              return buildingData(building);
            }),
            units: player.units.map(function (unit) {
              return unitData(unit);
            }),
            corpses: player.corpses.map(function (corpse) {
              return unitData(corpse);
            }),
            views: player.views.map(function (view) {
              return view.map(function (cell) {
                return Game_objectSpread(Game_objectSpread({}, filterObject(cell, ['i', 'j', 'viewed'])), {}, {
                  viewBy: (cell.viewBy || []).map(function (unit) {
                    return unit.label;
                  })
                });
              });
            })
          });
        };
        var cellData = function cellData(cell) {
          var _cell$has;
          return Game_objectSpread(Game_objectSpread({}, filterObject(cell, ['z', 'type', 'viewed', 'solid', 'visible', 'category', 'inclined', 'border', 'waterBorder'])), {}, {
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
        };
        return {
          camera: context.controls.camera,
          players: context.players.map(function (player) {
            return playerData(player);
          }),
          resources: context.map.resources.map(function (resource) {
            return resourceData(resource);
          }),
          map: context.map.grid.map(function (line) {
            return line.map(function (cell) {
              return cellData(cell);
            });
          }),
          animals: context.map.gaia.units.map(function (animal) {
            return animalData(animal);
          })
        };
      };
      var json = cleanContext(this.context);
      var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json));
      var downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', dataStr);
      downloadAnchorNode.setAttribute('download', "save_".concat(new Date().toLocaleString('en-GB', {
        timeZone: 'UTC'
      }), ".json"));
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  }, {
    key: "load",
    value: function load(json) {
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
      context.controls = new Controls(context);
      context.menu = new Menu(context);
      context.map.generateFromJSON(json);
      this.addChild(context.map);
      this.addChild(context.controls);
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
        div.innerText = 'Pause';
        document.body.appendChild(div);
      } else {
        var _document$getElementB;
        (_document$getElementB = document.getElementById('pause')) === null || _document$getElementB === void 0 || _document$getElementB.remove();
      }
      for (var i = 0; i < map.gaia.units.length; i++) {
        pause ? map.gaia.units[i].pause() : map.gaia.units[i].resume();
      }
      for (var _i = 0; _i < players.length; _i++) {
        var player = players[_i];
        for (var j = 0; j < (player === null || player === void 0 || (_player$units = player.units) === null || _player$units === void 0 ? void 0 : _player$units.length); j++) {
          var _player$units;
          pause ? player.units[j].pause() : player.units[j].resume();
        }
        for (var _j = 0; _j < (player === null || player === void 0 || (_player$buildings = player.buildings) === null || _player$buildings === void 0 ? void 0 : _player$buildings.length); _j++) {
          var _player$buildings;
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
                        lib/* Assets */.sP.addBundle('seeds', {
                          0: 'assets/seeds/0.txt'
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
                        _this2.loadingDiv.innerHTML = 'Loading config..';
                        _context.n = 1;
                        return lib/* Assets */.sP.loadBundle('config');
                      case 1:
                        _this2.loadingDiv.innerHTML = 'Loading interface..';
                        _context.n = 2;
                        return lib/* Assets */.sP.loadBundle('interface');
                      case 2:
                        _this2.loadingDiv.innerHTML = 'Loading seeds..';
                        _context.n = 3;
                        return lib/* Assets */.sP.loadBundle('seeds');
                      case 3:
                        _this2.loadingDiv.innerHTML = 'Loading terrain..';
                        _context.n = 4;
                        return lib/* Assets */.sP.loadBundle('terrain');
                      case 4:
                        _this2.loadingDiv.innerHTML = 'Loading border..';
                        _context.n = 5;
                        return lib/* Assets */.sP.loadBundle('border');
                      case 5:
                        _this2.loadingDiv.innerHTML = 'Loading graphics..';
                        _context.n = 6;
                        return lib/* Assets */.sP.loadBundle('graphics');
                      case 6:
                        _this2.loadingDiv.innerHTML = 'Loading sounds..';
                        _context.n = 7;
                        return lib/* Assets */.sP.loadBundle('sounds');
                      case 7:
                        _this2.loadingDiv.remove();
                        resolve();
                      case 8:
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

;// ./app/entry.js
function entry_regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return entry_regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (entry_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, entry_regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, entry_regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), entry_regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", entry_regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), entry_regeneratorDefine2(u), entry_regeneratorDefine2(u, o, "Generator"), entry_regeneratorDefine2(u, n, function () { return this; }), entry_regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (entry_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function entry_regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } entry_regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { entry_regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, entry_regeneratorDefine2(e, r, n, t); }
function entry_asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function entry_asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { entry_asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { entry_asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }




entry_asyncToGenerator(/*#__PURE__*/entry_regenerator().m(function _callee() {
  var app, gamebox, loader, game;
  return entry_regenerator().w(function (_context) {
    while (1) switch (_context.n) {
      case 0:
        // Create a new PixiJS application
        app = new lib/* Application */.lgM(); // Initialize the app with background color and auto-resize
        _context.n = 1;
        return app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          background: 0x000000,
          // black background
          resizeTo: window,
          antialias: false,
          // faster
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          // adjusts canvas for resolution
          powerPreference: 'high-performance' // GPU hint
        });
      case 1:
        // Append the canvas to your game container
        gamebox = document.getElementById('game');
        if (gamebox) {
          _context.n = 2;
          break;
        }
        console.error('No #game container found');
        return _context.a(2);
      case 2:
        gamebox.appendChild(app.canvas);

        // Initialize loader
        loader = new LoaderScreen();
        app.stage.addChild(loader);
        _context.n = 3;
        return loader.start();
      case 3:
        // Once assets are loaded, remove loader and start game
        game = new Game(app, gamebox);
        app.stage.removeChild(loader);
        app.stage.addChild(game);

        // Optional: global pointermove listener
        app.stage.on('pointermove', function (event) {
          // event.data.global.x, event.data.global.y
        });
      case 4:
        return _context.a(2);
    }
  }, _callee);
}))();

/***/ }),

/***/ 7511:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(957);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5099);
/* harmony import */ var _node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_pnpm_css_loader_7_1_2_webpack_5_101_3_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `:root {
  --main-primary-color: #1d57a8;
  --main-background-color: #12171ecf;
  --main-border-color: transparent;
  --main-border-radius: 2px;
  --main-border-size: 0px;
  --main-border-style: solid;
  --main-shadow-color: rgba(0, 0, 0, 0.7);
  --main-box-shadow: var(--main-shadow-color) 0px 0px 3px 0px;
}

html,
body,
input,
textarea,
select,
button {
  border-color: #5e5d5a;
  color: #e5e0d8;
  font-size: 12px;
  text-shadow: 1px 1px black;
  font-family: sans-serif;
  -webkit-font-smoothing: none;
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
}
button:hover,
.input-file:hover {
  background-color: var(--main-primary-color);
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
  color: #da2424;
  background: rgba(0, 0, 0, 0.4);
  padding: 3px;
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
  border-radius: var(--main-border-radius);
  box-shadow: var(--main-box-shadow);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.modal-menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
}
`, "",{"version":3,"sources":["webpack://./app/styles.css"],"names":[],"mappings":"AAAA;EACE,6BAA6B;EAC7B,kCAAkC;EAClC,gCAAgC;EAChC,yBAAyB;EACzB,uBAAuB;EACvB,0BAA0B;EAC1B,uCAAuC;EACvC,2DAA2D;AAC7D;;AAEA;;;;;;EAME,qBAAqB;EACrB,cAAc;EACd,eAAe;EACf,0BAA0B;EAC1B,uBAAuB;EACvB,4BAA4B;AAC9B;;AAEA;EACE,aAAa;EACb,gBAAgB;EAChB,SAAS;EACT,yBAAyB;EACzB,iBAAiB;EACjB,uBAAuB;AACzB;;AAEA;;EAEE,2CAA2C;EAC3C,iBAAiB;EACjB,wCAAwC;EACxC,kBAAkB;EAClB,eAAe;EACf,kBAAkB;EAClB,6BAA6B;EAC7B,YAAY;EACZ,oBAAoB;AACtB;AACA;;EAEE,2CAA2C;AAC7C;AACA;EACE,wBAAwB;AAC1B;AACA;EACE,YAAY;EACZ,eAAe;EACf,YAAY;EACZ,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,WAAW;EACX,oCAAoC;EACpC,UAAU;EACV,eAAe;EACf,0DAA0D;AAC5D;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;EACvB,YAAY;AACd;;AAEA;EACE,OAAO;AACT;;AAEA;EACE,kBAAkB;EAClB,aAAa;EACb,eAAe;EACf,QAAQ;EACR,SAAS;EACT,gCAAgC;EAChC,iBAAiB;AACnB;;AAEA;EACE,wCAAwC;EACxC,WAAW;AACb;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;EACX,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;AACpC;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,iBAAiB;EACjB,aAAa;EACb,iBAAiB;EACjB,kCAAkC;EAClC,wBAAwB;EACxB,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,aAAa;EACb,aAAa;EACb,uCAAuC;EACvC,wBAAwB;EACxB,aAAa;EACb,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;EAClC,gBAAgB;EAChB,aAAa;EACb,sBAAsB;EACtB,YAAY;EACZ,QAAQ;AACV;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;AACb;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,sBAAsB;AACxB;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,QAAQ;AACV;;AAEA;EACE,aAAa;EACb,eAAe;EACf,QAAQ;EACR,cAAc;EACd,cAAc;EACd,gBAAgB;AAClB;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,QAAQ;AACV;;AAEA;EACE,kBAAkB;EAClB,aAAa;AACf;;AAEA;EACE,kBAAkB;EAClB,QAAQ;EACR,yDAAyD;AAC3D;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,iBAAiB;EACjB,qDAAqD;AACvD;;AAEA;EACE,kBAAkB;EAClB,OAAO;EACP,MAAM;EACN,WAAW;EACX,YAAY;AACd;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,aAAa;EACb,SAAS;AACX;;AAEA;EACE,aAAa;EACb,mBAAmB;EACnB,oBAAoB;AACtB;;AAEA;EACE,kBAAkB;EAClB,eAAe;AACjB;;AAEA;EACE,aAAa;EACb,QAAQ;EACR,mBAAmB;AACrB;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,gBAAgB;EAChB,YAAY;EACZ,WAAW;EACX,iFAAiF;EACjF,wCAAwC;EACxC,kCAAkC;AACpC;;AAEA;EACE,aAAa;EACb,eAAe;EACf,WAAW;EACX,kBAAkB;AACpB;;AAEA;EACE,cAAc;EACd,8BAA8B;EAC9B,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,mBAAmB;EACnB,QAAQ;AACV;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;EACnB,mBAAmB;EACnB,QAAQ;AACV;;AAEA;;EAEE,kBAAkB;EAClB,SAAS;EACT,SAAS;EACT,aAAa;EACb,mBAAmB;AACrB;;AAEA;EACE,eAAe;EACf,cAAc;EACd,QAAQ;EACR,wBAAwB;EACxB,aAAa;EACb,YAAY;EACZ,2BAA2B;EAC3B,8BAA8B;EAC9B,WAAW;EACX,aAAa;EACb,mBAAmB;EACnB,uBAAuB;AACzB;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,YAAY;EACZ,aAAa;EACb,8BAA8B;EAC9B,aAAa;AACf;;AAEA;EACE,wCAAwC;EACxC,wCAAwC;EACxC,kCAAkC;EAClC,kBAAkB;EAClB,QAAQ;EACR,SAAS;EACT,gCAAgC;AAClC;;AAEA;EACE,aAAa;EACb,sBAAsB;EACtB,SAAS;EACT,aAAa;AACf","sourcesContent":[":root {\n  --main-primary-color: #1d57a8;\n  --main-background-color: #12171ecf;\n  --main-border-color: transparent;\n  --main-border-radius: 2px;\n  --main-border-size: 0px;\n  --main-border-style: solid;\n  --main-shadow-color: rgba(0, 0, 0, 0.7);\n  --main-box-shadow: var(--main-shadow-color) 0px 0px 3px 0px;\n}\n\nhtml,\nbody,\ninput,\ntextarea,\nselect,\nbutton {\n  border-color: #5e5d5a;\n  color: #e5e0d8;\n  font-size: 12px;\n  text-shadow: 1px 1px black;\n  font-family: sans-serif;\n  -webkit-font-smoothing: none;\n}\n\nbody {\n  height: 100vh;\n  overflow: hidden;\n  margin: 0;\n  -webkit-user-select: none;\n  user-select: none;\n  background-color: black;\n}\n\nbutton,\n.input-file {\n  border: 1px solid var(--main-primary-color);\n  padding: 6px 15px;\n  border-radius: var(--main-border-radius);\n  position: relative;\n  cursor: pointer;\n  text-align: center;\n  background-color: transparent;\n  width: 200px;\n  transition: all 0.2s;\n}\nbutton:hover,\n.input-file:hover {\n  background-color: var(--main-primary-color);\n}\n.input-file {\n  width: calc(100% - 32px);\n}\n.input-file > input {\n  width: 200px;\n  cursor: pointer;\n  height: 100%;\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 99;\n  /*Opacity settings for all browsers*/\n  opacity: 0;\n  -moz-opacity: 0;\n  filter: progid:DXImageTransform.Microsoft.Alpha(opacity=0);\n}\n\n.loading {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n}\n\n#game {\n  flex: 1;\n}\n\n#pause {\n  position: absolute;\n  z-index: 1000;\n  font-size: 50px;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n  margin-top: -66px;\n}\n\n.bar {\n  background: var(--main-background-color);\n  width: 100%;\n}\n\n.img {\n  object-fit: none;\n  height: 45px;\n  width: 45px;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n}\n\n.topbar {\n  position: absolute;\n  top: 0;\n  padding: 5px 10px;\n  display: grid;\n  font-weight: bold;\n  grid-template-columns: 33% 33% 33%;\n  width: calc(100% - 20px);\n  align-items: center;\n  justify-content: center;\n}\n\n.bottombar {\n  position: absolute;\n  bottom: 0;\n  display: grid;\n  height: 122px;\n  grid-template-columns: 120px auto 242px;\n  width: calc(100% - 10px);\n  grid-gap: 5px;\n  padding: 5px;\n}\n\n.bottombar-info {\n  position: relative;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  padding: 2px;\n  gap: 1px;\n}\n\n.bottombar-info #icon {\n  object-fit: none;\n  height: 45px;\n  width: 45px;\n}\n\n.bottombar-info #infos {\n  position: absolute;\n  left: 45%;\n  top: 30px;\n  display: flex;\n  align-items: center;\n  flex-direction: column;\n}\n\n.bottombar-info #info {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n}\n\n.bottombar-menu {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n  padding: 5px 0;\n  overflow: auto;\n  max-width: 500px;\n}\n\n.bottombar-menu-column {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n}\n\n.bottombar-menu-box {\n  position: relative;\n  display: flex;\n}\n\n.bottombar-map-wrap {\n  position: relative;\n  top: 2px;\n  filter: drop-shadow(0px 0px 3px var(--main-shadow-color));\n}\n\n.bottombar-map {\n  width: 100%;\n  height: 100%;\n  background: black;\n  clip-path: polygon(50% 1%, 100% 48%, 50% 96%, 0% 48%);\n}\n\n.bottombar-map canvas {\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: 100%;\n}\n\n.topbar-age {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.topbar-resources {\n  display: flex;\n  gap: 10px;\n}\n\n.topbar-options {\n  display: flex;\n  align-items: center;\n  justify-content: end;\n}\n\n.topbar-options-menu {\n  width: fit-content;\n  cursor: pointer;\n}\n\n.resource {\n  display: flex;\n  gap: 2px;\n  align-items: center;\n}\n\n.resource > div {\n  width: 40px;\n}\n\n.resource-content {\n  object-fit: none;\n  height: 13px;\n  width: 20px;\n  border: var(--main-border-size) var(--main-border-style) var(--main-border-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n}\n\n.message {\n  z-index: 1000;\n  position: fixed;\n  width: 100%;\n  text-align: center;\n}\n\n.message-content {\n  color: #da2424;\n  background: rgba(0, 0, 0, 0.4);\n  padding: 3px;\n}\n\n.resource-quantity {\n  position: absolute;\n  top: 20px;\n  left: 45%;\n  display: flex;\n  align-items: center;\n  flex-direction: row;\n  gap: 5px;\n}\n\n.unit-loading {\n  position: absolute;\n  top: 52px;\n  left: 45%;\n  display: flex;\n  align-items: center;\n  flex-direction: row;\n  gap: 5px;\n}\n\n.building-loading,\n#population {\n  position: absolute;\n  left: 40%;\n  top: 32px;\n  display: flex;\n  align-items: center;\n}\n\n.toggle {\n  position: fixed;\n  bottom: -119px;\n  right: 0;\n  transform: rotate(64deg);\n  height: 192px;\n  width: 100px;\n  border-top-left-radius: 3px;\n  background: rgba(0, 0, 0, 0.5);\n  z-index: 10;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.modal {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  background: rgba(0, 0, 0, 0.5);\n  z-index: 1001;\n}\n\n.modal-content {\n  background: var(--main-background-color);\n  border-radius: var(--main-border-radius);\n  box-shadow: var(--main-box-shadow);\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.modal-menu {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 10px;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ })

},
/******/ __webpack_require__ => { // webpackRuntimeModules
/******/ var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
/******/ __webpack_require__.O(0, [96], () => (__webpack_exec__(6544)));
/******/ var __webpack_exports__ = __webpack_require__.O();
/******/ }
]);
//# sourceMappingURL=main.js.map