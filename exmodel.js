// exmodel.js <https://github.com/exceptionaljs/exmodel>
(function(exclass, $export, $as) {
"use strict";

// ideas:
// extasy
// errorless
// painless

// ============================================================================
// [Config]
// ============================================================================

var SANITY = false;

// ============================================================================
// [Shortcuts]
// ============================================================================

var freeze = Object.freeze;
var hasOwn = Object.prototype.hasOwnProperty;
var isArray = Array.isArray;

// ============================================================================
// [exmodel.js]
// ============================================================================

// \namespace exmodel
var exmodel = {};

// `exmodel.VERSION`
//
// Version information in a "major.minor.patch" form.
exmodel.VERSION = "0.0.1";

// `exmodel.SENTINEL`
//
// Private object that is used to check whether an object is a exmodel.js instance.
var SENTINEL = freeze({});
exmodel.SENTINEL = SENTINEL;

// `exmodel.qclass`
//
// Link to the `qclass` library used by exmodel.js (useful mostly in NPM based
// environment).
exmodel.exclass = exclass;

// ============================================================================
// [Constants]
// ============================================================================

// `exmodel.kNoOptions`
//
// No data processing options. This constant has been added so the code that
// is using data processing can be more clear in cases where no options are
// used.
var kNoOptions = exmodel.kNoOptions = 0;

// `exmodel.kExtractTop`
//
// Extract top fields from the source object.
//
// This option is used in case that you have a top level object that contains
// keys/values and you want to extract everything matching your schema out of
// it. Only keys defined in the schema are considered, others ignored silently.
//
// It's an error if user access control is enabled and the source object
// contains a property that the user doesn't have access to. In such case
// a "PermissionDenied" error will be generated.
//
// NOTE: This option can be combined with `kExtractAll`, in such case the
// latter has priority.
var kExtractTop = exmodel.kExtractTop = 0x0001;

// `exmodel.kExtractNested`
//
// Extract nested fields from the source object.
//
// This option is used in case you have a top level object that doesn't contain
// any other properties than defined by the schema, but nested objects can. When
// combined with `exmodel.kExtractTop` it efficiently forms `exmodel.kExtractAll`.
//
// Extraction from nested objects follows the same rules as extraction from top
// level object. See `exmodel.kExtractTop` for more detailed information.
var kExtractNested = exmodel.kExtractNested = 0x0002;

// `exmodel.kExtractAll`
//
// Extract all fields from the source object and all nested objects.
//
// This is like `kExtractTop`, but it takes effect for any object, top level or
// nested. This option can be efficiently used to filter properties from source
// objects into properties defined by the schema.
//
// NOTE: This is a combination of both `exmodel.kExtractTop` and `exmodel.kExtractNested`.
var kExtractAll = exmodel.kExtractAll = 0x0003;

// `exmodel.kDeltaMode`
//
// Delta mode allows to validate a data that contains only changes (deltas).
// When used all required fields become optional and default values won't
// be used to substitute data that is not present.
//
// NOTE: Delta updating makes sense when updating something that already exists,
// but it doesn't make sense for data insertion, where you probably don't want
// to omit what is 'required'. If your stack doesn't use delta updates or you
// use exmodel.js for an input validation only, this feature can be completely
// ignored.
var kDeltaMode = exmodel.kDeltaMode = 0x0004;

// \internal
//
// Flag used internally to generate code for `exmodel.test()` like validation.
var kTestOnly = 0x0008;

// \internal
//
// Flag used internally to force code generator to emit access rights checks.
var kTestAccess = 0x0010;

// `exmodel.kAccumulateErrors`
//
// Accumulate all errors instead of bailing out on the first failure.
//
// When this option is used the error object thrown in case of one or more
// error will always contain `errors` array that is populated by all errors
// found. This option is useful in cases that you want to see all problems
// of the input data - for example you want to highlight fields that are
// wrong on the client or perform an additional processing/fixing.
var kAccumulateErrors = exmodel.kAccumulateErrors = 0x1000;

// \internal
//
// Mask of all options that take effect in cache lookup. These options that are
// not here are always checked in the validator function itself and won't cause
// a new function to be generated when one is already present (even if it was
// generated with some different options)
var kFuncCacheMask = kExtractAll | kDeltaMode | kTestOnly | kTestAccess;

// \internal
//
// Maximum number of functions that can be generated per one final schema. This
// is basically a last flag shifted one bit left. For example if the last bit is
// 0x8 the total number of functions generated per schema to cover all possible
// combinations would be 16 (indexes 0...15).
var kFuncCacheCount = kFuncCacheMask + 1;

// Min/Max safe integer limits - 53 bits.
//
// NOTE: These should be fully compliant with ES6 `Number.isSafeInteger()`.
var kSafeIntMin = exmodel.kSafeIntMin = -9007199254740991;
var kSafeIntMax = exmodel.kSafeIntMax =  9007199254740991;

// Minimum year that can be used in date/datetime.
var kYearMin = 1;

// ============================================================================
// [Tuning]
// ============================================================================

// \internal
//
// If set to true the code generator will use `Object.keys(obj).length` to get
// the total count of properties `obj` has. This is turned off by default as it
// has been observed that simple `for (k in obj) props++` is much faster than
// calling `Object.keys()`.
var kTuneUseObjectKeysAsCount = false;

// ============================================================================
// [Internals]
// ============================================================================

// \internal
//
// Unsafe properties are properties that collide with `Object.prototype`. These
// are always checked by using hasOwnProperty() even if the field can't contain
// `undefined` value.
//
// `UnsafeProperties` is a list, not object!
var UnsafeProperties = Object.getOwnPropertyNames(Object.prototype);

// \internal
//
// Mapping of JS types into a character that describes the type. This mapping
// is used by `SchemaCompiler` to reduce the length of variable names and to map
// distinct JS types to different variable names in case of the same property
// name. This is good for JS engines as each variable will always contain values
// of a specific JS type and the engine will never deoptimize the function in
// case of type misprediction.
var MangledType = {
  any    : "x",
  array  : "a",
  boolean: "b",
  number : "n",
  object : "o",
  string : "s"
};

// Dummy frozen objects.
var NoObject = freeze({});
var NoArray = freeze([]);

// Some useful regexps.
var reNewLine = /\n/g;                        // Newline (test).
var reUnescapeFieldName = /\\(.)/g;           // Unescape field name (replace).
var reInvalidIdentifier = /[^\w\$]/;          // Invalid identifier (test).

var reTypeArgs = /^(\w+)\(([^\(]+)\)/;        // Type arguments "(...)" (match).
var reTypeArray = /\[(\d+)?(\.\.)?(\d+)?]$/;  // Array type suffix "...[xxx]" (match).
var reTypeOptional = /\?$/;                   // Optional type suffix "...?" (match).
var reInclude = /^\$include/;                 // Test for $include directive.

// Test if the given access right is valid (forbid some characters that can
// violate with future boolean algebra that can be applied to UAC system).
var reInvalidAccessName = /[\x00-\x1F\s\(\)\[\]\{\}\&\|\*\^\!%]/;

// ============================================================================
// [Errors]
// ============================================================================

// \class RuntimeError
//
// Error thrown in case that exmodel.js has been misused.
function RuntimeError(message) {
  var e = Error.call(this, message);

  this.name = "RuntimeError";
  this.message = message;
  this.stack = e.stack || "";

  if (this.stack)
    this.stack = "Runtime" + this.stack;
}
exmodel.RuntimeError = exclass({
  $extend: Error,
  $construct: RuntimeError
});

// \class SchemaError
//
// Error thrown in case of validation failure. The `SchemaError` constructor
// always accepts an array of errors, where a single element is an object
// containing the following mandatory properties:
//
//   "code": String - Code of the error (not a message).
//   "path": String - Path to the error (dot is used to separate nested fields).
//
// An error detail can also contain an optional properties that are specific to
// the type and rule used, for example `InvalidDate` will contain the requested
// date format, etc...
function SchemaError(errors) {
  var e = Error.call(this);

  this.name = "SchemaError";
  this.message = "Data is not valid according to the schema.";
  this.stack = e.stack || "";
  this.errors = errors;

  if (this.stack)
    this.stack = "Schema" + this.stack;
}
exmodel.SchemaError = exclass({
  $extend: Error,
  $construct: SchemaError
});

function throwRuntimeError(msg, params) {
  var ex = new RuntimeError(msg);
  if (params != null && typeof params === "object") {
    for (var k in params)
      ex[k] = params[k];
  }
  throw ex;
}
exmodel.throwRuntimeError = throwRuntimeError;

function throwSchemaError(errors) {
  throw new SchemaError(errors);
}
exmodel.throwSchemaError = throwSchemaError;

// ============================================================================
// [Util]
// ============================================================================

// \namespace `exmodel.util`
//
// exmodel.js utility functions.
var qutil = exmodel.util = {};

// \function `exmodel.util.typeOf(arg)`
//
// Get extended type of the object.
function typeOf(arg) {
  var type = typeof arg;
  return type !== "object" ? type : arg === null ? "null" : isArray(arg) ? "array" : "object";
}
qutil.typeOf = typeOf;

// \function `exmodel.util.stringSplice(s, from, to, content)`
//
// Replace `s` content `from:to` by `by.`.
function stringSplice(s, from, to, by) {
  return s.substr(0, from) + (by ? by : "") + s.substr(to);
}
qutil.stringSplice = stringSplice;

// \function `exmodel.util.trimStringArray(arr)`
//
// Trim all strings in the array `arr` and return `arr`.
function trimStringArray(arr) {
  for (var i = 0, len = arr.length; i < len; i++)
    arr[i] = String(arr[i]).trim();
  return arr;
}

// \function `exmodel.util.isDirectiveName(s)`
//
// Get whether the string `s` is a exmodel's directive name (ie it starts with "$").
function isDirectiveName(s) {
  return s.charCodeAt(0) === 36;
}
qutil.isDirectiveName = isDirectiveName;

// \function `exmodel.util.isVariableName(s)`
//
// Get whether the string `s` is a valid JS variable name:
//
//   - `s` is not an empty string.
//   - `s` starts with ASCII letter [A-Za-z], underscore [_] or a dollar sign [$].
//   - `s` may contain ASCII numeric characters, but not the first char.
//
// Please note that EcmaScript allows to use any unicode alphanumeric and
// ideographic characters to be used in a variable name, but this function
// doesn't allow these, only ASCII characters are considered. It basically
// follows the same convention as C/C++, with dollar sign [$] included.
function isVariableName(s) {
  if (!s)
    return false;

  var c;
  return !reInvalidIdentifier.test(s) && ((c = s.charCodeAt(0)) < 48 || c >= 58);
}
qutil.isVariableName = isVariableName;

// \function `exmodel.util.escapeRegExp(s)`
//
// Escape a string `s` so it can be used in regexp for exact matching. For
// example a string "[]" will be escaped to "\\[\\]".
function escapeRegExp(s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}
qutil.escapeRegExp = escapeRegExp;

// \function `exmodel.util.unescapeFieldName(s)`
//
// Unescape a given object's field name `s` to a real name (exmodel.js specific).
function unescapeFieldName(s) {
  return s.replace(reUnescapeFieldName, "$1");
}
qutil.unescapeFieldName = unescapeFieldName;

// \function `exmodel.util.toCamelCase(s)`
//
// Make a string camelcased.
//
// This version of `toCamelCase()` preserves words that start with an uppercased
// character, so for example "CamelCased" string will be properly converted to
// "camelCased".
//
// Examples:
//
//   toCamelCase("ThisIsString")   -> "thisIsString"
//   toCamelCase("this-is-string") -> "thisIsString"
//   toCamelCase("THIS_IS_STRING") -> "thisIsString"
//   toCamelCase("this-isString")  -> "thisIsString"
//   toCamelCase("THIS_IsSTRING")  -> "thisIsString"
var toCamelCase = (function() {
  var re1 = /[A-Z]+/g;
  var fn1 = function(m) { return m[0] + m.substr(1).toLowerCase(); };

  var re2 = /[_-][A-Za-z]/g;
  var fn2 = function(m) { return m.substr(1).toUpperCase(); };

  function toCamelCase(s) {
    s = s.replace(re1, fn1);
    s = s.replace(re2, fn2);

    return s.charAt(0).toLowerCase() + s.substr(1);
  }

  return toCamelCase;
})();
qutil.toCamelCase = toCamelCase;

// \internal
//
// Returns `"." + s` or `[s]` depending on the content of `s`. Basically used
// to emit optimized Object's property accessor (the idea is just to make code
// shorter, it doesn't matter for JavaScript VM in the end).
function getObjectProperty(s) {
  return isVariableName(s) ? "." + s : "[" + JSON.stringify(s) + "]";
}

// \function `exmodel.util.isEmpty(obj)`
//
// Get whether the given object or array `obj` is empty, i.e. contains no keys
// or no elements. The given parameter has to be an object or array instance,
// otherwise the function may throw `TypeError`.
function isEmpty(obj) {
  if (isArray(obj)) {
    return obj.length === 0;
  }
  else {
    for (var k in obj)
      return false;
    return true;
  }
}
qutil.isEmpty = isEmpty;

// \function `exmodel.util.arrayToSet(arr)`
//
// Convert an array to a set (i.e. object having array values as key/true pairs).
function arrayToSet(arr) {
  var obj = {};
  for (var i = 0, len = arr.length; i < len; i++)
    obj[arr[i]] = true;
  return obj;
}
qutil.arrayToSet = arrayToSet;

// \function `exmodel.util.setToArray(arr)`
//
// Convert an object into a set (i.e. return an array containing all object keys).
function setToArray(set) {
  return Object.keys(set).slice();
}
qutil.setToArray = setToArray;

// \function `exmodel.util.mergeSets(a, b)`
//
// Merge a set `a` with another set or array `b`.
function mergeSets(a, b) {
  if (b != null) {
    if (isArray(b)) {
      var srcArr = b;
      for (var i = 0, len = srcArr.length; i < len; i++)
        a[srcArr[i]] = true;
    }
    else {
      var srcObj = b;
      for (var k in srcObj)
        a[k] = true;
    }
  }
  return a;
}
qutil.mergeSets = mergeSets;

// \function `exmodel.util.joinSet(set, sep)`
//
// Join all keys in a set `set` separated by `sep`. The functionality is similar
// to `Array.join()`, however, it's designed to join an object keys.
function joinSet(set, sep) {
  var s = "";

  // Compatible with `Array.prototype.join()`.
  if (sep == null)
    sep = ",";

  for (var k in set) {
    if (s) s += sep;
    s += k;
  }
  return s;
}
qutil.joinSet = joinSet;

// \function `exmodel.util.mergeObject(a, b)`
//
// Merge content from object `b` into `a`, and return `a`.
function mergeObject(a, b) {
  if (b != null) {
    for (var k in b)
      a[k] = b[k];
  }
  return a;
}
qutil.mergeObject = mergeObject;

function freezeOrNoArray(arr) { return !isEmpty(arr) ? freeze(arr) : NoArray; }
function freezeOrNoObject(arr) { return !isEmpty(arr) ? freeze(arr) : NoObject; }

// \function `exmodel.util.cloneWeak(v)`
//
// Perform a weak clone of variable `v`. If the variable is an array, a new
// array is returned containing
function cloneWeak(v) {
  if (!v || typeof v !== "object")
    return v;

  if (isArray(v))
    return v.slice();

  var dstObj = {};
  var srcObj = v;

  for (var k in srcObj)
    dstObj[k] = srcObj[k];

  return dstObj;
}
qutil.cloneWeak = cloneWeak;

// \function `exmodel.util.omit(obj, props)`
//
// Return a new object based on `obj` with omitted properties specified by `props`.
function omit(obj, props) {
  var dst = {};
  for (var k in obj) {
    if (hasOwn.call(props, k))
      continue;
    dst[k] = obj[k];
  }
  return dst;
}
qutil.omit = omit;

function _cloneDeep(obj) {
  if (isArray(obj)) {
    var dstArr = [];
    var srcArr = obj;

    for (var i = 0, len = srcArr.length; i < len; i++) {
      var child = srcArr[i];
      dstArr.push((!child || typeof child !== "object") ? child : _cloneDeep(child));
    }

    return dstArr;
  }
  else {
    // Never clone exmodel.js-like objects.
    if (obj.SENTINEL === SENTINEL)
      return obj;

    var dstObj = {};
    var srcObj = obj;

    for (var k in srcObj) {
      var element = srcObj[k];
      dstObj[k] = (!element || typeof element !== "object") ? element : _cloneDeep(element);
    }

    return dstObj;
  }
}

// \function `exmodel.util.cloneDeep(v)`
function cloneDeep(v) {
  return (!v || typeof v !== "object") ? v : _cloneDeep(v);
}
qutil.cloneDeep = cloneDeep;

// \internal
function _isEqual(a, b, buffer) {
  var aType = typeof a;
  var bType = typeof b;

  // NaN !== NaN.
  if (aType === "number" && bType === "number")
    return true;

  // Anything else than object should be caught by `a === b`.
  if (a === null || aType !== "object" || b === null || bType !== "object")
    return false;

  var aIsArray = isArray(a);
  var bIsArray = isArray(b);

  var aValue;
  var bValue;

  var i, k;

  if (aIsArray & bIsArray) {
    var aLen = a.length;
    var bLen = b.length;

    if (aLen !== bLen)
      return false;

    // Detect cyclic references.
    for (i = 0; i < buffer.length; i += 2) {
      if (buffer[i] === a || buffer[i + 1] === b)
        throwRuntimeError("Detected cyclic references.");
    }

    buffer.push(a);
    buffer.push(b);

    for (var i = 0; i < aLen; i++) {
      aValue = a[i];
      bValue = b[i];

      if (aValue === bValue)
        continue;

      if (!_isEqual(aValue, bValue, buffer))
        return false;
    }

    buffer.pop();
    buffer.pop();

    return true;
  }
  else if (aIsArray | bIsArray) {
    return false;
  }
  else {
    // Detect cyclic references.
    for (i = 0; i < buffer.length; i += 2) {
      if (buffer[i] === a || buffer[i + 1] === b)
        throwRuntimeError("Detected cyclic references.");
    }

    buffer.push(a);
    buffer.push(b);

    for (k in a) {
      if (!hasOwn.call(a, k))
        continue;

      if (!hasOwn.call(b, k))
        return false;
    }

    for (k in b) {
      if (!hasOwn.call(b, k))
        continue;

      if (!hasOwn.call(a, k))
        return false;

      aValue = a[k];
      bValue = b[k];

      if (aValue === bValue)
        continue;

      if (!_isEqual(aValue, bValue, buffer))
        return false;
    }

    buffer.pop();
    buffer.pop();

    return true;
  }
}

// \function `exmodel.util.isEqual(a, b)`
//
// Get whether the values `a` and `b` are deep equal.
function isEqual(a, b) {
  return (a === b) ? true : _isEqual(a, b, []);
}
qutil.isEqual = isEqual;

// ============================================================================
// [Enum]
// ============================================================================

var Enum$IllegalKeys = [
  // exmodel.enum() members.
  "$",
  "hasKey",
  "hasValue",
  "keyToValue",
  "valueToKey",

  // JS.
  "prototype",

  // This probably can't really be specified.
  "__proto__"
];

function Enum$sortIntFn(a, b) { return a - b; }

// \function `exmodel.enum(def)`
//
// Create an enumeration, which is a mapping between a key (always string) and
// value (always number).
//
// exmodel.js knows how to recognize common patterns in enums and adds some
// metadata to the instance that can be used to improve and simplify data
// validation.
//
// The instance returned is always immutable, if JS environment allows it. This
// prevents from modifying an existing enumeration and thus breaking validators
// that have already been compiled and are cached.
function Enum(def) {
  // Enum is designed to be instantiated without using `new` operator.
  if (!(this instanceof Enum))
    return new Enum(def);

  if (!def || typeof def !== "object")
    throwRuntimeError("exmodel.enum() - Invalid definition of type '" + typeOf(def) + "' passed.");

  var keyMap     = def;
  var keyArray    = [];
  var valueMap   = {};
  var valueArray  = [];

  var safe       = true;
  var unique     = true;
  var sequential = true;

  // The only member variable we use, everything else (except member functions)
  // can be used as keys.
  var $ = {
    keyMap    : keyMap,    // Mapping of keys to values.
    keyArray  : keyArray,  // Array containing all keys.
    valueMap  : valueMap,  // Mapping of values to keys.
    valueArray: valueArray,// Array containing all unique values, sorted.
    valueSeq  : null,      // Keys in value order if all values are sequential.

    min       : null,      // Minimum value (can be used to start a loop).
    max       : null,      // Maximum value (can be used to end a loop).
    safe      : true,      // True if all values are safe integers.
    unique    : true,      // True if all values are unique (ie don't overlap).
    sequential: true       // True if all values form a sequence and don't overlap.
  };

  Object.defineProperty(this, "$", {
    value       : $,
    enumerable  : false,
    configurable: false,
    writable    : false
  });

  for (var key in keyMap) {
    if (!hasOwn.call(keyMap, key))
      continue;

    if (Enum$IllegalKeys.indexOf(key) !== -1)
      throwRuntimeError("exmodel.enum() - Key '" + key + "' is reserved and can't be used.");

    var val = keyMap[key];
    var str = String(val);

    if (!key || typeof val !== "number" || !isFinite(val))
      throwRuntimeError("exmodel.enum() - Invalid key/value pair '" + key + "' -> '" + str + "'.");

    if (!hasOwn.call(valueMap, str)) {
      valueMap[str] = key;
      valueArray.push(val);
    }
    else {
      unique = false;
    }

    if (Math.floor(val) !== val || val < kSafeIntMin || val > kSafeIntMax)
      safe = false;

    keyArray.push(key);
    this[key] = val;
  }

  // Compute `min`, `max`, and `sequential` properties.
  if (valueArray.length) {
    valueArray.sort(Enum$sortIntFn);

    var a = valueArray[0];
    var b = valueArray[valueArray.length - 1];
    var i;

    $.min = a;
    $.max = b;

    if (safe) {
      for (i = 1; i < valueArray.length; i++) {
        if (++a !== valueArray[i]) {
          sequential = false;
          break;
        }
      }

      // Create an array that is used for sequential value to key conversion.
      if (sequential) {
        var valueSeq = $.valueSeq = [];
        for (i = 0; i < valueArray.length; i++)
          valueSeq.push(valueMap[String(valueArray[i])]);
      }
    }
  }

  $.safe = safe;
  $.unique = unique;
  $.sequential = sequential;

  // Make the whole object immutable.
  freeze(keyMap);
  freeze(keyArray);
  freeze(valueMap);
  freeze(valueArray);

  freeze($);
  freeze(this);
}
exmodel.enum = exclass({
  $construct: Enum,

  // \function `Enum.hasKey(key)`
  //
  // Get whether the enum has `key`.
  hasKey: function(key) {
    if (typeof key !== "string")
      return undefined;

    return hasOwn.call(this.$.keyMap, key);
  },

  // \function `Enum.hasValue(value)`
  //
  // Get whether the enum has `value`.
  hasValue: function(value) {
    var $ = this.$;
    if (typeof value !== "number")
      return false;

    if ($.sequential) {
      return !(value < $.min || value > $.max || Math.floor(value) !== value);
    }
    else {
      var map = $.valueMap;
      var str = String(value);
      return hasOwn.call(map, str);
    }
  },

  // \function `Enum.keyToValue(key)`
  //
  // Get a value based on `key`.
  keyToValue: function(key) {
    if (typeof key !== "string")
      return undefined;

    var map = this.$.keyMap;
    return hasOwn.call(map, key) ? map[key] : undefined;
  },

  // \function `Enum.valueToKey(value)`
  //
  // Get a key based on `value`.
  valueToKey: function(value) {
    var $ = this.$;
    if (typeof value !== "number")
      return undefined;

    if ($.sequential) {
      var min = $.min;
      var max = $.max;

      if (value < min || value > max || Math.floor(value) !== value)
        return undefined;

      return $.valueSeq[value - min];
    }
    else {
      var map = $.valueMap;
      var str = String(value);
      return hasOwn.call(map, str) ? map[str] : undefined;
    }
  }
});

// ============================================================================
// [BitArray]
// ============================================================================

// \internal
var kNumBits = 31;

// \class `BitArray`
//
// \internal
//
// A simple bitarray implementation that uses integers having `kNumBits`. The
// reason for such class is to avoid having integers with the highest bit set
// as it can dramaticaly decrease possible optimizations by JavaScript VM (V8).
var BitArray = exclass({
  $construct: function(bits) {
    this.bits = bits || [];
  },

  clone: function() {
    return new BitArray(this.bits.slice());
  },

  test: function(n) {
    var bits = this.bits;

    var idx = Math.floor(n / kNumBits);
    var msk = 1 << Math.floor(n % kNumBits);

    if (idx >= bits.length)
      throwRuntimeError("BitArray.test() - Out of range (n=" + n + " len=" + (bits.length * kNumBits) + ").");

    return (bits[idx] & msk) !== 0;
  },

  equals: function(other) {
    var a = this.bits;
    var b = other.bits;

    var len = a.length;
    if (len !== b.length)
      return false;

    for (var i = 0; i < len; i++)
      if (a[i] !== b[i])
        return false;

    return true;
  },

  combine: function(op, arg) {
    var bits = this.bits;

    if (typeof arg === "number") {
      var idx = Math.floor(arg / kNumBits);
      var msk = 1 << Math.floor(arg % kNumBits);

      if (idx >= bits.length)
        throwRuntimeError("BitArray.combine(" + arg + ") - Out of range (max=" + (bits.length * kNumBits) + ").");

      switch (op) {
        case "or"    : bits[idx] |= msk; break;
        case "and"   : bits[idx] &= msk; break;
        case "andnot": bits[idx] &=~msk; break;
        default: throwRuntimeError("Invalid operator '" + op + "'.");
      }
    }
    else {
      var src = arg.bits;
      var len = bits.length;

      if (len !== src.length)
        throwRuntimeError("BitArray.combine([...]) - Length mismatch (" + len + " vs " + src.length + ").");

      var i = 0;
      switch (op) {
        case "or"    : for (; i < len; i++) bits[i] |= src[i]; break;
        case "and"   : for (; i < len; i++) bits[i] &= src[i]; break;
        case "andnot": for (; i < len; i++) bits[i] &=~src[i]; break;
        default: throwRuntimeError("Invalid operator '" + op + "'.");
      }
    }

    return this;
  },

  $statics: {
    newEmpty: function(num) {
      var bits = [];
      for (var i = 0, n = Math.floor((num + (kNumBits - 1)) / kNumBits); i < n; i++)
        bits.push(0);
      return new BitArray(bits);
    }
  }
});

// ============================================================================
// [ValueRange]
// ============================================================================

var ValueRange = exclass({
  $construct: function(min, max, minExclusive, maxExclusive) {
    this.init(min, max, minExclusive, maxExclusive);
  },

  init: function(min, max, minExclusive, maxExclusive) {
    this.min = typeof min === "number" ? min : null;
    this.max = typeof max === "number" ? max : null;

    this.minExclusive = (this.min !== null && minExclusive) ? true : false;
    this.maxExclusive = (this.max !== null && maxExclusive) ? true : false;

    return this;
  },

  mergeMin: function(min, exc) {
    var tMin = this.min;
    var tExc = this.minExclusive;

    if (min == null) {
      tExc = exc ? true : false;
    }
    else if (tMin === null) {
      tMin = min;
      tExc = exc ? true : false;
    }
    else if (tMin <= min) {
      tMin = min;
      if (!tExc && exc) tExc = true;
    }

    this.min = tMin;
    this.minExclusive = tExc;

    return this;
  },

  mergeMax: function(max, exc) {
    var tMax = this.max;
    var tExc = this.maxExclusive;

    if (max == null) {
      tExc = exc ? true : false;
    }
    else if (tMax === null) {
      tMax = max;
      tExc = exc ? true : false;
    }
    else if (tMax >= max) {
      tMax = max;
      if (!tExc && exc) tExc = true;
    }

    this.max = tMax;
    this.maxExclusive = tExc;

    return this;
  }
});

// ============================================================================
// [CoreCompiler]
// ============================================================================

// \class `exmodel.CoreCompiler`
//
// Base class used for compiling JS code. The reason there is `CoreCompiler`
// and not just `SchemaCompiler` is that `CoreCompiler` is used by other
// functions to compile much simpler JS code, like code for date parsing.
//
// CoreCompiler has been designed as a lightweight class that can be used to
// serialize JS code into one string, by providing an interface for indentation
// and declaring local variables at the beginning of the function.
//
// The following snippet demonstrates the desired functionality:
//
// ```
// var c = new CoreCompiler();
//
// c.arg("array");
// c.declareVariable("i", "0");
// c.declareVariable("len", "array.length");
//
// c.emit("while (i < len) {");
// c.declareVariable("element");
// c.emit("element = array[i]");
// c.emit("...");
// c.emit("i++;");
// c.emit("}";
//
// c.toFunction();
// ```
//
// The code above will generate and execute the following function:
//
// ```
// "use strict";
// function($$_data) {
//   return function(array) {
//     var i = 0, len = array.length, element;
//     while (i < len) {
//       element = array[i];
//       ...
//       i++;
//     }
//   }
// }
// ```
//
// The function above is a boilerplate that is needed to pass custom data to
// the generated function and the function that contains the body constructed
// by using `emit()` and others to emit JS code. Passing data is easy through
// `data(data)` method or more high level `declareData(name, data)` method.
function CoreCompiler() {
  this._debug = false;        // Whether to output debug code and comments.

  // Used by `nest()` and `denest()`.
  this._scopeArray = [];      // Used to save data of the previous scope(s).
  this._scopeIndex = 0;       // Scope index in `_scopeArray`.
  this._indentation = "  ";   // Indentation.
  this._ifElseCount = 0;      // Count if previous if/if else blocks.

  this._args = [];            // Function arguments;
  this._body = "";            // Function body.

  this._locals = {};          // Local variables and initialization code.
  this._globals = {};         // Global variables and initialization code.
  this._uniqueName = 0;       // Unique variable names generator.

  this._data = [];            // Data that is passed to outer function.
  this._dataName = "$$_data"; // Reserved name for outer data argument.
  this._dataToVar = {};       // Mapping of global data index and variables.
}
exclass({
  $construct: CoreCompiler,

  // \internal
  _sanityIdentifierName: function(name) {
    return isVariableName(name) ? name : this._makeUniqueName();
  },

  // Declare a new local variable and put the declaration at the beginning of
  // the function.
  //
  // The function returns a variable name that is safe in case that the `name`
  // parameter contained name that is forbidden by JS.
  //
  // NOTE: If the variable already exists it only validates that `exp` is the
  // same as passed first time the variable has been declared. This makes it
  // possible to share variable names, but prevents changing their init code.
  declareVariable: function(name, exp) {
    var locals = this._locals;

    name = this._sanityIdentifierName(name);
    exp = exp || "";

    if (hasOwn.call(locals, name)) {
      if (locals[name] !== exp)
        throwRuntimeError("Can't redeclare local variable '" + name + "' with different initialization '" + exp + "'");
    }
    else {
      locals[name] = exp;
    }

    return name;
  },

  // Declare a new global variable and put the declaration outside of the
  // generated function.
  //
  // Global variables can contain values that are constant to the function and
  // that can reference objects outside. For example you can add `exmodel`
  // global and reference it inside the generated function.
  declareGlobal: function(name, exp) {
    var globals = this._globals;

    name = this._sanityIdentifierName(name);
    exp = exp || "";

    if (hasOwn.call(globals, name)) {
      if (globals[name] !== exp)
        throwRuntimeError("Can't redeclare global variable '" + name + "' with different initialization '" + exp + "'");
    }
    else {
      globals[name] = exp;
    }

    return name;
  },

  declareData: function(name, data) {
    var exp = this.data(data);
    var map = this._dataToVar;

    if (!name) {
      if (hasOwn.call(map, exp))
        name = map[exp];
      else
        name = this._makeUniqueName();
    }

    map[exp] = name;
    return this.declareGlobal(name, exp);
  },

  _makeUniqueName: function() {
    return "_" + (++this._uniqueName);
  },

  // Add an argument to the function.
  arg: function(name) {
    this._args.push(name);
    return this;
  },

  // Pass a data to the function, returns code that can be used to access it.
  data: function(data) {
    var array = this._data;
    var i = array.indexOf(data);

    if (i === -1) {
      i = array.length;
      array.push(data);
    }

    return this._dataName + "[" + i + "]";
  },

  // Emit JS `code` with current indentation applied.
  emit: function(code) {
    if (!code)
      return this;

    // Automatically denest if the first character is '}'.
    if (code.charAt(0) === "}")
      this.denest();

    this._body += this.applyIndentation(code);

    // Automatically nest if the last character is '{'.
    if (code.charAt(code.length - 1) === "{")
      this.nest();

    return this;
  },

  // Emit newline delimiter `\n`.
  nl: function() {
    this._body += "\n";
    return this;
  },

  // Emit comment with current indentation applied if debugging is enabled.
  comment: function(s) {
    if (this._debug)
      this._body += this.applyIndentation("// " + s.replace("\n", "\n// "));
    return this;
  },

  ifElseIf: function(cond) {
    var keyword = (++this._ifElseCount === 1) ? "if" : "else if";
    return this.emit(keyword + " (" + cond + ") {");
  },

  otherwise: function() {
    var keyword = this._ifElseCount > 0 ? "else" : "if (1)";
    this._ifElseCount = 0;
    return this.emit(keyword + " {");
  },

  end: function() {
    return this.emit("}");
  },

  str: function(s) {
    return JSON.stringify(s);
  },

  nest: function() {
    var array = this._scopeArray;
    var index = this._scopeIndex;

    var indentation = this._indentation;
    var ifElseCount = this._ifElseCount;

    if (index === array.length) {
      obj = {
        indentation: indentation,
        ifElseCount: ifElseCount
      };
      array.push(obj);
    }
    else {
      var obj = array[index];
      obj.indentation = indentation;
      obj.ifElseCount = ifElseCount;
    }

    this._scopeIndex = index + 1;
    this._indentation = indentation + "  ";
    this._ifElseCount = 0;

    return this;
  },

  denest: function() {
    var array = this._scopeArray;
    var index = this._scopeIndex;

    if (index === 0)
      throwRuntimeError("CoreCompiler.denest() - Can't denest the root scope.");

    var obj = array[--index];
    this._scopeIndex = index;
    this._indentation = obj.indentation;
    this._ifElseCount = obj.ifElseCount;

    return this;
  },

  applyIndentation: function(s) {
    if (!s)
      return s;

    if (s.charCodeAt(s.length - 1) === 10)
      s = s.substr(0, s.length - 1);

    var indentation = this._indentation;
    return indentation + s.replace(reNewLine, "\n" + indentation) + "\n";
  },

  serialize: function() {
    var globals = this._globals;
    var locals = this._locals;

    var init = "";
    var vars = "";
    var name, value;

    for (name in globals) {
      init += "var " + name + " = " + globals[name] + ";\n";
    }

    if (init)
      init += "\n";
    init = "\"use strict\";\n" + init;

    for (name in locals) {
      value = locals[name];
      vars += (vars ? ", " : "var ") + name + (value ? " = " + value : "");
    }

    if (vars) {
      vars += ";";
      vars = this.applyIndentation(vars);
    }

    return init +
      "return function(" + this._args.join(", ") + ") {\n" +
        vars +
        this._body +
      "}\n";
  },

  toFunction: function() {
    var body = this.serialize();
    var fn;

    try {
      // console.log(body);
      fn = new Function(this._dataName, body);
      return fn(this._data);
    }
    catch (ex) {
      throwRuntimeError("Invalid code generated", {
        message: ex.message,
        body: body
      });
    }
  }
});

// ============================================================================
// [SchemaCompiler]
// ============================================================================

// \internal
function mergePath(a, b) {
  if (!b)
    return a;

  // Merge `a` with an existing string `b`, results in less code to be emitted.
  if (a.charAt(a.length - 1) === '"' && b.charAt(0) === '"')
    return a.substr(0, a.length - 1) + b.substr(1);
  else
    return a + " + " + b;
}

// \class `exmodel.SchemaCompiler`
function SchemaCompiler(env, options) {
  CoreCompiler.call(this);

  this._env = env;            // Schema environment (`exmodel` or customized).
  this._options = options;    // Schema validation options.
  this._extract = false;      // Whether to extract properties from this level.
  this._delta = false;        // Whether we are in delta-mode (at the moment).
  this._path = "\"\"";        // Path to the current scope (code).

  this._accessMap = null;     // Access rights map (key to index).
  this._accessCount = 0;      // Count of access rights in the map.
  this._accessGranted = null; // Granted access rights (at the time accessed).

  // Cached ValueRange instance.
  this._cachedRange = new ValueRange();
}
exclass({
  $extend: CoreCompiler,
  $construct: SchemaCompiler,

  compileFunc: function(def) {
    this.arg("errors");
    this.arg("input");
    this.arg("options");
    this.arg("access");

    this.declareData("exmodel", this._env);
    this.setExtract(this.hasOption(kExtractTop));
    this.setDelta(this.hasOption(kDeltaMode));

    if (this.hasOption(kTestAccess)) {
      this._accessMap = def.$_exmData.wMap;
      this._prepareAccess("access");
    }

    var vIn = "input";
    var vOut = this.compileType(vIn, def);

    this.nl();

    if (!this.hasOption(kTestOnly))
      this.emit("return " + vOut + ";");
    else
      this.emit("return true;");

    return this.toFunction();
  },

  compileType: function(vIn, def) {
    var name = def.$type || "object";
    var type = this._env.getType(name);

    if (!type)
      throwRuntimeError("Can't find handler for type " + name + ".");

    return type.compile(this, vIn, def);
  },

  hasOption: function(opt) {
    return (this._options & opt) !== 0;
  },

  addOption: function(opt) {
    this._options |= opt;
    return this;
  },

  clearOption: function(opt) {
    this._options &= ~opt;
    return this;
  },

  _prepareAccess: function(accVar) {
    var map = this._accessMap;
    var count = 0;
    var didWork = false;

    for (var key in map) {
      var id = map[key];
      var v, m;

      if (id < kNumBits) {
        v = "ac0";
        m = 1 << id;
      }
      else {
        // This happens only if the schema is large and has more than `kNumBits`
        // access control rights. Handled as a special case as divs/mods are slow.
        v = "ac" + Math.floor(id / kNumBits);
        m = 1 << Math.floor(id % kNumBits);
      }

      if (!didWork) {
        didWork = true;
        this.nl();
      }

      this.declareVariable(v, "0");
      this.emit("if (" + accVar + getObjectProperty(key) + " === true) " +
        v + " |= " + "0x" + m.toString(16) + ";");

      count++;
    }

    if (didWork)
      this.nl();

    this._accessCount = count;
    this._accessGranted = BitArray.newEmpty(count);
  },

  emitNumberCheck: function(v, range, isInt, isFinite) {
    var cond = [];

    var min = range.min;
    var max = range.max;

    var minExclusive = range.minExclusive;
    var maxExclusive = range.maxExclusive;

    // Finite check is only important if there is no range check. By default
    // all integer checks have range (because of the int type), however, doubles
    // have no range by default.
    if (isFinite && (min === null || max === null)) {
      cond.push("isFinite(" + v + ")");
    }

    // JS integer type is a 32-bit number that can have values in range from
    // -2147483648 to 2147483647 - for this range it's safe to check for an
    // integer type by `(x|0) === x`, otherwise this trick is not possible and
    // less efficient `Math.floor(x) === x` has to be used.
    if (isInt) {
      var minIsSafe = (min !== null) && min >= -2147483648 - minExclusive;
      var maxIsSafe = (max !== null) && max <=  2147483647 + maxExclusive;

      if (minIsSafe && maxIsSafe) {
        cond.push("(" + v + "|0) === " + v);

        // Remove min/max checks if covered by `(x|0) === x`.
        if (min + minExclusive === -2147483648) min = null;
        if (max - maxExclusive ===  2147483647) max = null;
      }
      else {
        cond.push("Math.floor(" + v + ") === " + v);
      }
    }

    if (min !== null) cond.push(v + (minExclusive ? " > " : " >= ") + min);
    if (max !== null) cond.push(v + (maxExclusive ? " < " : " <= ") + max);

    if (cond.length > 0)
      this.failIf("!(" + cond.join(" && ") + ")",
        this.error(this.str("InvalidValue")));

    return this;
  },

  addLocal: function(name, mangledType) {
    return this.declareVariable(name + "$" + (mangledType || "") + this._scopeIndex);
  },

  // Get a type-prefix of type defined by `def`.
  mangledType: function(def) {
    var env = this._env;

    // Default mangled type is an object.
    var type;
    var mangled = "o";

    if (typeof def.$type === "string" && (type = env.getType(def.$type)) != null)
      mangled = MangledType[type.type] || "z";

    return mangled;
  },

  passIf: function(cond, vOut, vIn) {
    return this.ifElseIf(cond).emit(vIn === vOut ? "// OK." : vOut + " = " + vIn + ";").end();
  },

  failIf: function(cond, err) {
    this.ifElseIf(cond);
    this.fail(err);
    this.end();
    return this;
  },

  fail: function(err) {
    if (this.hasOption(kTestOnly))
      this.emit("return false;");
    else
      this.emitError(err);
    return this;
  },

  emitError: function(err) {
    if (this.hasOption(kTestOnly)) {
      this.emit("return false;");
    }
    else {
      this.emit("errors.push(" + err + ");");

      // Better to preprocess `options & kAccumulateErrors) and just use a bool
      // to perform a quick check. It's much faster and generates less code.
      this.declareVariable("quick", "(options & " + kAccumulateErrors + ") === 0");
      this.emit("if (quick) return false;");
    }
    return this;
  },

  getPath: function() {
    return this._path;
  },

  setPath: function(path) {
    var prev = this._path;
    this._path = path;
    return prev;
  },

  addPath: function(sep, code) {
    var p = this._path;
    if (p !== '""' && sep)
      p = mergePath(p, sep);
    return this.setPath(mergePath(p, code));
  },

  getExtract: function() {
    return this._extract;
  },

  setExtract: function(value) {
    var prev = this._extract;
    this._extract = value;
    return prev;
  },

  getDelta: function() {
    return this._delta;
  },

  setDelta: function(value) {
    var prev = this._delta;
    this._delta = value;
    return prev;
  },

  error: function(code, extra) {
    var s = "{ code: " + code + ", path: " + this.getPath();
    if (extra)
      s += " ," + JSON.stringify(extra).substr(1);
    else
      s += " }";
    return s;
  },

  done: function() {
    this._ifElseCount = 0;
    return this;
  }
});

// ============================================================================
// [SchemaBuilder]
// ============================================================================

var SchemaAccess = exclass({
  $construct: function(type, initial, inherit) {
    this.type = type;
    this.inherit = "";

    this.map = {};
    this.len = 0;

    // Used as a temporary map to prevent creating maps every time a string is
    // going to be normalized. Signature is incremented every time `tmpMap` is
    // used so it doesn't matter what was there previously. It's for matching
    // the same names during a single run of `process()`.
    this.tmpMap = {};
    this.tmpSig = 0;
    this.tmpArray = [];

    this.inherit = this.process(initial, inherit || "any");
  },

  add: function(name) {
    var map = this.map;
    var id;

    if (!hasOwn.call(map, name)) {
      id = this.len++;
      map[name] = id;
    }
    else {
      id = map[name];
    }

    return id;
  },

  // Process a given access string `s` and return a normalized one that doesn't
  // contain virtual access rights like "inherit" (also handles null/empty
  // string as "inherit").
  process: function(s, inherit) {
    if (!s || s === "inherit")
      s = inherit || this.inherit;

    // Fast-path (in case access control rights are not used).
    if (s === "any" || s === "none")
      return s;

    var names = s.split("|");
    var name;

    var tmpMap = this.tmpMap;
    var tmpSig = this.tmpSig++;
    var tmpArray = this.tmpArray;

    var i = 0;
    while (i < names.length) {
      name = names[i].trim();
      if (!name)
        throwRuntimeError("Invalid access string '" + s + "'.");

      var normalized = this.normalize(name, inherit);
      if (normalized === null)
        throwRuntimeError("Invalid access string '" + s + "' (can't normalize '" + name + "').");

      if (normalized.indexOf("|") !== -1) {
        // Prevent recursion, add to `names` we are interating over.
        var array = normalized.split("|");
        for (var j = 0; j < array.length; j++) {
          name = array[j];
          if (tmpMap[name] !== tmpSig)
            names.push(name);
        }
      }
      else {
        tmpMap[normalized] = tmpSig;
      }

      i++;
    }

    // It's an error if both "none" and "any" have been specified.
    if (tmpMap.any === tmpSig && tmpMap.none === tmpSig)
      throwRuntimeError("Access string can't have both 'any' and 'none' specified.");

    // If there is 'any' or 'none' at least once it cancels effect of all others.
    if (tmpMap.any  === tmpSig) return "any";
    if (tmpMap.none === tmpSig) return "none";

    // Construct a new string that is a combination of unique normalized access
    // control names expanded by the previous loop.
    tmpArray.length = 0;
    for (name in tmpMap) {
      if (tmpMap[name] === tmpSig) {
        tmpArray.push(name);
        this.add(name);
      }
    }
    tmpArray.sort();
    return tmpArray.join("|");
  },

  // \internal
  //
  // Normalize an access control string `s` (can contain only one name).
  normalize: function(s, inherit) {
    // Normalize special cases.
    if (s === "*")
      s = "any";

    // Check if the access control name is correct (i.e. doesn't contain any
    // characters we don't consider valid). This also checks for symbols like
    // '&' and '|', which should have been handled before name normalization.
    if (s && reInvalidAccessName.test(s))
      return null;

    // Handled implicit / explicit inheritance.
    if (!s || s === "inherit")
      s = inherit || this.inherit;

    // Banned name, can't be stored in JS object.
    if (s === "__proto__")
      return null;

    // Handle "@", which will be modified depending on `type` (usually "r" or "w").
    return s.replace("@", this.type);
  }
});

function mergeBits(bits, map, s) {
  var names = s.split("|");

  for (var i = 0, len = names.length; i < len; i++) {
    var index = map[names[i]];
    if (typeof index === "number")
      bits.combine("or", index);
  }

  return bits;
}

function extractDefData(def, data) {
  var dst = {};
  var k;

  for (k in def) {
    if (isDirectiveName(k))
      continue;
    dst[unescapeFieldName(k)] = def[k];
  }

  if (data == null)
    return dst;

  if (typeof data !== "object")
    throwRuntimeError("Directive '$data' has to be an object, not '" + typeOf(data) + "'.");

  for (k in data) {
    if (hasOwn.call(dst, k))
      throwRuntimeError("Property '" + k + "' specified in both definition and $data directives.");
    dst[k] = data[k];
  }

  return dst;
}

function sanityNormalized(def) {
  for (var k in def) {
    if (!isDirectiveName(k))
      throwRuntimeError("Found a non-directive '" + k + "' in normalized schema.");
  }
}

function hasInclude(def) {
  for (var k in def)
    if (reInclude.test(k))
      return true;
  return false;
}

function mergeInclude(src) {
  var dst = {};

  for (var k in src) {
    var v = src[k];
    if (reInclude.test(k)) {
      if (!isArray(v))
        v = [v];

      for (var i = 0, len = v.length; i < len; i++) {
        var incDef = v[i];

        if (incDef === null || typeof incDef !== "object")
          throwRuntimeError("Invalid " + k + "[" + i + "] data of type " + typeOf(incDef) + ".");

        for (var incKey in incDef) {
          if (isDirectiveName(incKey))
            throwRuntimeError("Invalid " + k + "[" + i + "] data, directive " + incKey + " is not allowed.");

          if (hasOwn.call(dst, incKey))
            throwRuntimeError("Invalid " + k + "[" + i + "] data, property " + incKey + " already exists.");

          dst[incKey] = incDef[incKey];
        }
      }
    }
    else {
      if (hasOwn.call(dst, k))
        throwRuntimeError("The " + k + " was already included.");

      dst[k] = v;
    }
  }

  return dst;
}

// \internal
//
// Schema builder is responsible for translating a non-normalized schema into
// a normalized schema that can be actually used by extractors and validators.
function SchemaBuilder(env, options) {
  if (!options)
    options = NoObject;

  // The environment the schema is bound to (exmodel.js or inherited).
  this.env = env;
  this.options = options;

  // All user access control rights that appeared in all fields, nested inclusive.
  this.rAccess = new SchemaAccess("r", options.$r || options.$a || null, "any");
  this.wAccess = new SchemaAccess("w", options.$w || options.$a || null, "any");
}
exclass({
  $construct: SchemaBuilder,

  // \internal
  //
  // Called once per schema, it adds the root field.
  build: function(def) {
    def = this.field(def, null, null);

    // The member `$_exmData` is considered private and used exclusively by
    // the exmodel.js library. This is the only reserved key so far.
    def.$_exmData = {
      env  : this.env,
      rMap : this.rAccess.map,
      wMap : this.wAccess.map,
      cache: new Array(kFuncCacheCount)
    };

    return def;
  },

  // \internal
  //
  // Translate the given schema definition into a normalized format that is used
  // by exmodel.js library. This function is called for root type and all children
  // it contains, basically per recognized type.
  field: function(def, override, parent) {
    // If the `def` contains one or more include directive we create a new
    // merged definition.
    if (hasInclude(def)) {
      def = mergeInclude(def);
    }

    // If the definition extends another one, we switch it to `def` and use the
    // former as `override`. The `$extend` directive is never set on normalized
    // schema object, so if we are already extending, we should never see it.
    if (hasOwn.call(def, "$extend")) {
      var extend = def.$extend;

      // ERROR: The `$extend` directive shouldn't be part of an existing schema.
      if (override !== null)
        throwRuntimeError("Directive '$extend' should never appear in normalized schema.");

      // ERROR: Extend has to be an existing schema.
      if (extend == null || typeof extend !== "object" || !hasOwn.call(extend, "$_exmData"))
        throwRuntimeError("Directive '$extend' requires an existing exmodel.schema.");

      override = def;
      def = extend;
    }

    // Initialize to safe defaults.
    var defType = def.$type;
    var defArgs = NoArray;
    var defData = def.$data;

    var nullable = false;
    var optional = false;

    // Reused, contains `defType` matches.
    var m = null;

    // Helpers.
    var k, v, o; // Key/Value/Overridden.
    var g, r, w; // Group/Read/Write.

    // Process `defType`:
    //   1. Check if the type has arguments:
    //      - Put them to the `defArgs` variable.
    //      - Remove them from the `defType` itself.
    //   2. Make `defType` to be object by default.
    if (defType) {
      m = defType.match(reTypeArgs);
      if (m) {
        defType = stringSplice(defType, m[1].length, m[0].length);

        v = m[2].trim();
        m = null;

        if (v)
          defArgs = trimStringArray(v.split(","));
      }
    }
    else {
      defType = "object";
    }

    if (!override) {
      // If the $type ends with "?" it implies `{ $null: true }` definition.
      if (reTypeOptional.test(defType)) {
        defType = defType.substr(0, defType.length - 1);
        nullable = true;

        // Prevent from having invalid type that contains for example "??" by mistake.
        if (reTypeOptional.test(defType))
          throwRuntimeError("Invalid type '" + def.$type + "'.");
      }

      // If the $type ends with "[...]" it implies `{ $type: "array", $data: ... }`.
      // In this case all definitions specified in `def` are related to the array
      // elements, not the array itself. However, it's possible to specify basics
      // like array length, minimum length, and maximum length inside "[...]".
      m = defType.match(reTypeArray);

      // Handle "$null" + do some checks.
      if (!m) {
        if (defType.indexOf("[") !== -1)
          throwRuntimeError("Invalid type '" + def.$type + "'.");

        if (def.$null != null) {
          nullable = def.$null;
          if (typeof nullable !== "boolean")
            throwRuntimeError("Directive '$null' can only contain null/boolean, not '" + def.$null + "'.");
        }
      }

      if (def.$optional != null) {
        optional = def.$optional;
        if (typeof optional !== "boolean")
          throwRuntimeError("Directive '$optional' can only contain null/boolean, not '" + def.$optional + "'.");
      }

      // Handle "$r" and "$w".
      r = def.$r || def.$a || null;
      w = def.$w || def.$a || null;

      // Handle "$g".
      g = def.$g;
    }
    else {
      // Handle the override basics here. Be pedantic as it's better to catch
      // errors here than failing later.
      if (hasOwn.call(override, "$type") && override.$type !== defType)
        throwRuntimeError("Can't override type '" + defType + "' to '" + override.$type + "'.");

      // Override "$null".
      if (hasOwn.call(override, "$null")) {
        v = override.$null;
        nullable = (v == null) ? null : v;
      }

      // Override "$optional".
      if (hasOwn.call(override, "$optional")) {
        v = override.$optional;
        optional = (v == null) ? null : v;
      }

      // Override "$r" and "$w".
      r = def.$r;
      w = def.$w;

      var has$a = hasOwn.call(override, "$a");
      if (hasOwn.call(override, "$r") || has$a) r = override.$r || override.$a || null;
      if (hasOwn.call(override, "$w") || has$a) w = override.$w || override.$a || null;

      // Override "$g".
      g = def.$g;
      if (hasOwn.call(override, "$g"))
        g = override.$g;
    }

    // Undefined/Empty string is normalized to "@default". Nulls are kept.
    if (g === undefined || g === "")
      g = "@default";

    // Create the field object. Until now everything stored here is handled,
    // overrides included.
    var obj = {
      $type     : defType,
      $data     : null,
      $null     : nullable,
      $optional : optional,
      $g        : g,
      $r        : r,
      $w        : w,
      $rExp     : this.rAccess.process(r, parent ? parent.$rExp : null),
      $wExp     : this.wAccess.process(w, parent ? parent.$wExp : null),
      $_exmData : null
    };

    if (m) {
      var omitted = this.env.shortcutDirectives;

      // Never in override mode here.
      if (override)
        throwRuntimeError("Internal error.");

      var nested = omit(def, omitted);
      nested.$type = defType.substr(0, defType.length - m[0].length);

      var minLen = m[1] ? parseInt(m[1]) : null;
      var maxLen = m[3] ? parseInt(m[3]) : null;

      if (minLen !== null && maxLen !== null && minLen > maxLen)
        throwRuntimeError("Invalid type '" + def.$type + "'.");

      // Set to array and copy directives that are omitted in the nested object.
      obj.$type = "array";
      for (k in def) {
        if (!hasOwn.call(obj, k) && hasOwn.call(omitted, k))
          obj[k] = def[k];
      }

      obj.$data = this.field(nested, null, obj);

      if (m[2]) {
        // "[min..]", "[..max]" or "[min..max]" syntax.
        if (minLen !== null) obj.$minLength = minLen;
        if (maxLen !== null) obj.$maxLength = maxLen;
      }
      else {
        // "[length]" syntax.
        if (minLen !== null) obj.$length = minLen;
      }
    }
    else {
      var artificial = this.env.artificialDirectives;

      if (defType === "object") {
        var $data = obj.$data = {};

        if (!override) {
          // Handle "object" directives.
          for (k in def) {
            // Properties are stored in `obj` itself, however, object fields are
            // stored always in `obj.$data`. This is just a way to distinguish
            // exmodel.js properties from object's properties.
            if (artificial[k] === true || !isDirectiveName(k) || hasOwn.call(obj, k))
              continue;
            obj[k] = def[k];
          }

          // Handle "object" properties.
          defData = extractDefData(def, defData);
          for (k in defData) {
            $data[k] = this.field(defData[k], null, obj);
          }
        }
        else {
          // Override "object" directives.
          for (k in def) {
            // We don't have to worry about properties in the field vs $data,
            // as the schema has already been normalized. So here we expect
            // exmodel.js directives only, not objects' fields.
            if (artificial[k] === true || hasOwn.call(obj, k))
              continue;

            // Not overridden directive.
            if (!hasOwn.call(override, k)) {
              obj[k] = def[k];
              continue;
            }

            // Delete/undefine directive.
            v = override[k];
            if (v === undefined)
              continue;

            // TODO: What about type of v, should we handle an object as well?
            obj[k] = v;
          }

          for (k in override) {
            if (artificial[k] === true ||
                !isDirectiveName(k) ||
                hasOwn.call(obj, k) ||
                hasOwn.call(def, k))
              continue;

            v = override[k];
            if (v === undefined)
              continue;

            obj[k] = v;
          }

          // Override "object" properties.
          var overrideData = extractDefData(override, override.$data);
          for (k in defData) {
            v = defData[k];

            // Not overridden property.
            if (!hasOwn.call(overrideData, k)) {
              $data[k] = this.field(v, null, obj);
              continue;
            }

            // Delete/undefine property.
            o = overrideData[k];
            if (o == null)
              continue;

            // Override the object.
            $data[k] = this.field(v, o, obj);
          }

          for (k in overrideData) {
            if (hasOwn.call(defData, k))
              continue;

            o = overrideData[k];
            if (o == null)
              continue;

            $data[k] = this.field(o, null, obj);
          }
        }
      }
      else {
        if (!override) {
          // Handle "any" directives.
          for (k in def) {
            if (artificial[k] === true || hasOwn.call(obj, k))
              continue;
            if (!isDirectiveName(k))
              throwRuntimeError("Property '" + k + "'can't be used by '" + defType + "' type.");
            obj[k] = def[k];
          }

          // Handle "any" properties.
          if (defData != null) {
            if (typeof defData !== "object")
              throwRuntimeError("Directive '$data' has to be object, not '" + typeOf(defData) + "'.");

            obj.$data = this.field(defData, null, obj);
          }
        }
        else {
          // Override "any" directives.
          for (k in def) {
            if (artificial[k] === true || hasOwn.call(obj, k))
              continue;

            // Not overridden directive.
            if (!hasOwn.call(override, k)) {
              obj[k] = def[k];
              continue;
            }

            // Delete/undefine directive.
            v = override[k];
            if (v === undefined)
              continue;

            // TODO: What about type of v, should we handle an object as well?
            obj[k] = v;
          }

          for (k in override) {
            if (artificial[k] === true || hasOwn.call(obj, k) || hasOwn.call(def, k))
              continue;

            v = override[k];
            if (v === undefined)
              continue;

            obj[k] = v;
          }

          // Override "any" properties.
          if (defData != null) {
            if (typeof defData !== "object")
              throwRuntimeError("Directive '$data' has to be object, not '" + typeOf(defData) + "'.");

            obj.$data = this.field(defData, override.$data, obj);
          }
        }
      }
    }

    // Validate that the postprocessed object is valid and can be compiled.
    var TypeObject = this.env.getType(obj.$type);
    if (!TypeObject)
      throwRuntimeError("Unknown type '" + obj.$type + "'.");

    if (typeof TypeObject.configure === "function")
      TypeObject.configure(obj, this.env, defArgs);

    if (typeof TypeObject.hook === "function")
      TypeObject.hook(obj, this.env, defArgs);

    if (SANITY)
      sanityNormalized(obj);

    return obj;
  }
});

// \function `exmodel.schema(def)`
//
// Processes the given definition `def` and creates a schema that can be used
// and compiled by exmodel.js library. It basically normalizes the input object
// and calls `type` and `rule` hooks on it.
function schema(def, options) {
  return (new SchemaBuilder(this || exmodel, options)).build(def);
}
exmodel.schema = schema;

function isSchema(def) {
  return def != null && typeof def === "object" && hasOwn.call(def, "$_exmData");
}
exmodel.isSchema = isSchema;

// Serialize the given schema `def` into something that can be printed as JSON.
// It basically removes some helper variables and data structures associated
// with schema, that only confuse the output if printed as JSON.
function printableSchema(def) {
  if (def == null || typeof def !== "object")
    return def;

  if (isArray(def)) {
    var dstArr = [];
    var srcArr = def;

    for (var i = 0; i < srcArr.length; i++)
      dstArr.push(printableSchema(srcArr[i]));
    return dstArr;
  }
  else {
    var dstObj = {};
    var srcObj = def;

    for (var k in srcObj) {
      var value = srcObj[k];

      if (k === "$_exmData")
        dstObj[k] = value ? "<...>" : null;
      else
        dstObj[k] = printableSchema(value);
    }
    return dstObj;
  }
}
exmodel.printableSchema = printableSchema;

// ============================================================================
// [Schema - Interface]
// ============================================================================

// \internal
//
// Global validation context, used as a cache to prevent creating the object
// every time `process()`, `validate()`, and `test()` are called. It doesn't
// prevent nested validation as the context is always set to `null` in case
// it's acquired and set back when released, if another global context doesn't
// exist.
var _errorsGlobal = null;

// \internal
//
// Compile and return a function that can be used to process data based on the
// definition `def` and options given in `index` (options and processing mode).
function compile(env, def, index) {
  var cache = def.$_exmData.cache;
  var fn = (new SchemaCompiler(env, index)).compileFunc(def);

  cache[index] = fn;
  return fn;
}

// \internal
function precompile(func, def, options, hasAccess) {
  var index = (options || 0) & kFuncCacheMask;

  if (func === "process") {
    // OK.
  }
  else if (func === "test") {
    index |= kTestOnly;
  }
  else {
    throwRuntimeError("exmodel.precompile() - 'func' parameter can be either 'process' or 'test'.");
  }

  if (hasAccess)
    index |= kTestAccess;

  return compile(this || exmodel, def, index);
}
exmodel.precompile = precompile;

// \function `exmodel.process(data, def, options, access)`
//
// Process the given `data` by using a definition `def`, `options` and `access`
// rights. The function specific for the validation type and options is compiled
// on demand and then cached.
exmodel.process = function(data, def, _options, access) {
  var options = typeof _options === "number" ? _options : 0;

  var cache = def.$_exmData.cache;
  var index = options & kFuncCacheMask;

  if (access)
    index |= kTestAccess;

  var fn = cache[index] || compile(this || exmodel, def, index);
  var errors = _errorsGlobal || [];

  _errorsGlobal = null;
  var result = fn(errors, data, options, access);

  if (errors.length)
    throwSchemaError(errors);

  _errorsGlobal = errors;
  return result;
};

// \function `exmodel.test(data, def, options, access)`
//
// Tests the given `data` by using a definition `def`, `options` and `access`
// right.
exmodel.test = function(data, def, _options, access) {
  var options = typeof _options === "number" ? _options | kTestOnly : kTestOnly;

  var cache = def.$_exmData.cache;
  var index = options & kFuncCacheMask;

  if (access)
    index |= kTestAccess;

  var fn = cache[index] || compile(this || exmodel, def, index);
  return fn(null, data, options, access);
};

// ============================================================================
// [Schema - Customize]
// ============================================================================

// \object `exmodel.types`
//
// Types supported by `exmodel`. Mapping between a type names (or aliases) and
// type objects.
exmodel.types = {};

// \object `exmodel.rules`
//
// Rules supported by `exmodel`. Mapping between a rule names and rule objects.
exmodel.rules = {};

// \object `exmodel.artificialDirectives`
//
// Directives, which are artificially generated by the schema post-processing
// and will never be copied from one schema to another in case of extending.
// exmodel.js rules can specify additional artificial directives that will be
// added to the global map in the exmodel.js environment that defines such rule.
exmodel.artificialDirectives = {
  $_exmData   : true, // Private data used exclusively by exmodel.js.
  $a          : true, // Shortcut to setup both `$r` and `$w` access information.
  $extend     : true, // Extend directive.
  $rExp       : true, // Expanded read access (expression).
  $wExp       : true, // Expanded write access (expression).
  $groupMap   : true, // Property groups map (key is a group, value is a list of property names).
  $uniqueMap  : true, // Array of unique properties map  , like `[{ id:true }, { a:true, b:true }]`.
  $uniqueArray: true, // Array of unique properties array, like `[["id"]     , ["a"    ,"b"     ]]`.
  $pkMap      : true, // Primary key map (value is always `true`).
  $pkArray    : true, // Primary key array.
  $fkMap      : true, // Foreign key map (value is always a string pointing to an "entity.field").
  $fkArray    : true, // Foreign key array.
  $idMap      : true, // Primary and foreign key map (value is always `true`).
  $idArray    : true  // Primary and foreign key array.
};

// \object `exmodel.shortcutDirectives`
//
// List of directives that won't be moved into the child object in case of using
// array shortcut in $type directive.
exmodel.shortcutDirectives = {
  $r          : true, // Read access.
  $w          : true, // Write access,
  $a          : true, // Read/write access.
  $g          : true, // Group.
  $unique     : true, // Unique specifier.
  $artificial : true, // Artificial directive always apply to the root object.
  $optional   : true  // Doesn't make sense, the array optional / not.
};

// \function `exmodel.getType(name)`
//
// Get a type by `name`.
//
// The function also matches type aliases.
exmodel.getType = function(name) {
  var types = this.types;
  return (hasOwn.call(types, name)) ? types[name] : null;
};

// \function `exmodel.addType(t)`
//
// Add a type or types to the exmodel.js environment.
//
// The type `t` can be an array of types or a single type. The type added
// is a POD object having the following signature:
//
// ```
// {
//   // Type names/aliases, like `["int"]` or `["int", "integer", ...]`,
//   name: String[]
//
//   // Javascript type of a given field.
//   type: String
//     "array"   - Array
//     "boolean" - Boolean
//     "number"  - Number (double or integer, doesn't matter)
//     "object"  - Object
//     "string"  - String (character or string, doesn't matter)
//
//   // Function that compiles a given type.
//   compile: Function(c, v, def) { ... }
// }
// ```
exmodel.addType = function(data) {
  var types = this.types;

  if (!isArray(data))
    data = [data];

  for (var i = 0; i < data.length; i++) {
    var type = data[i];
    var name = type.name;

    for (var n = 0; n < name.length; n++) {
      types[name[n]] = type;
    }
  }

  return this;
};

// \function `exmodel.getRule(name)`
//
// Get a rule by `name`.
exmodel.getRule = function(name) {
  var rules = this.rules;
  return (hasOwn.call(rules, name)) ? rules[name] : null;
};

// \function `exmodel.addRule(rule)`
//
// Add a rule or rules to the exmodel.js environment.
exmodel.addRule = function(data) {
  var rules = this.rules;

  if (!isArray(data))
    data = [data];

  for (var i = 0; i < data.length; i++) {
    var rule = data[i];
    rules[rule.name] = rule;

    if (rule.artificialDirectives)
      mergeObject(this.artificialDirectives, rule.artificialDirectives);
  }

  return this;
};

// \function `exmodel.customize(opt)`
//
// Extend the exmodel.js library by custom types and rules. It returns a
// completely new object that acts as exmodel.js itself. This is the recommended
// way to extend the library (it's nonintrusive, won't break anybody's else code).
//
// For example let's say that you have your own type `CustomType` and you want
// to extend the library. The recommended way is to extend exmodel.js and use
// the extended library in your code base (node.js example):
//
// ```
// var exmodel = require("exmodel");
//
// var CustomType = {
//   ...
// };
//
// var xmodel = exmodel.customize({
//   types: [
//     CustomType
//   ]
// });
//
// // Export the new interface and always use your library to load the custom
// // version of exmodel.js.
// module.exports = xmodel;
// ```
//
// The advantage of this approach is that changes are not made globally and the
// new types or rules can be accessed only through the new exmodel.js like
// object returned.
exmodel.customize = function(opt) {
  if (opt == null)
    opt = NoObject;

  if (typeOf(opt) !== "object")
    throwRuntimeError(
      "exmodel.customize(opt) - The `opt` parameter has to be an object, received " + typeOf(opt) + ".");

  // Create a new object extending exmodel.js.
  var obj = cloneWeak(this || exmodel);
  var tmp;

  // Clone members that can change.
  obj.types = cloneWeak(obj.types);
  obj.rules = cloneWeak(obj.rules);
  obj.artificialDirectives = cloneWeak(obj.artificialDirectives);

  // Customize types and/or rules if provided.
  tmp = opt.types;
  if (tmp)
    obj.addType(tmp);

  tmp = opt.rules;
  if (tmp)
    obj.addRule(tmp);

  return obj;
};

// \function `exmodel.freeze()`
//
// Freeze the object (deep) to prevent any future modifications.
exmodel.freeze = function() {
  freeze(this.types);
  freeze(this.rules);
  freeze(this.artificialDirectives);

  return freeze(this);
};

// ============================================================================
// [SchemaType - Base]
// ============================================================================

var TypeToError = {
  any    : "ExpectedAny",
  array  : "ExpectedArray",
  boolean: "ExpectedBoolean",
  number : "ExpectedNumber",
  object : "ExpectedObject",
  string : "ExpectedString"
};

function inputVarToOutputVar(v) {
  return v.lastIndexOf("in", 0) === 0 ? v.replace("in", "out") : null;
}

function compileAccessCheck(data, negate) {
  var s = "";

  var op = negate ? "&" : "|";
  var eq = negate ? "===" : "!==";

  for (var i = 0, len = data.length; i < len; i++) {
    var msk = data[i];
    if (!msk)
      continue;

    if (s)
      s += " || ";
    s += "(" + "ac" + String(i) + " " + op + " 0x" + msk.toString(16) + ") " + eq + " 0";
  }

  return s;
}

function BaseType() {}
exmodel.BaseType = exclass({
  $construct: BaseType,

  // Field type name and aliases ("array", "date", "color", ...), not strictly
  // a javascript type name.
  name: null,

  // JavaScript type name:
  //   - "any"
  //   - "array"
  //   - "boolean"
  //   - "number"
  //   - "object"
  //   - "string"
  type: null,

  // Configure and verify the definition `def` and throw `RuntimeError` if it's
  // not valid.
  //
  // The `args` parameter is a string containing type arguments specified in
  // parenthesis `"type(args)"`.
  configure: function(def, env, args) {
    // Nothing by default.
  },

  // Compile the type definition `def`.
  compile: function(c, v, def) {
    var type = this.type;
    var cond = null;

    var vIn = v;
    var vOut = v;

    var typeError = this.typeError || TypeToError[type];
    var isNull = def.$null;

    var allowed = def.$allowed;
    if (isArray(allowed) && allowed.indexOf(null) !== -1)
      isNull = true;

    // Object and Array types require `vOut` variable to be different than `vIn`.
    if (type === "object" || type === "array") {
      if (!c.hasOption(kTestOnly))
        vOut = c.declareVariable(inputVarToOutputVar(v));
    }

    // Emit access rights check.
    var prevAccess = c._accessGranted;
    var checkAccess = null;

    if (c.hasOption(kTestAccess)) {
      var w = def.$wExp;
      if (w !== "any") {
        if (w === "none") {
          c.fail(c.error(c.str("InvalidAccess")));
        }
        else {
          var curAccess = mergeBits(prevAccess.clone(), c._accessMap, w);
          if (!prevAccess.equals(curAccess)) {
            // We can't grant all of the rights if more than one is allowed.
            if (w.indexOf("|") === -1)
              c._accessGranted = curAccess;
            checkAccess = compileAccessCheck(curAccess.clone().combine("andnot", prevAccess).bits, true);
          }
        }
      }
    }

    // Emit type check that considers `null` and `undefined` values if specified.
    if (type === "object") {
      var toStringFn = c.declareGlobal("toString", "Object.prototype.toString");
      var cond = "";

      c.emit(vOut + " = " + vIn + ";");

      if (checkAccess)
        c.failIf(checkAccess, c.error(c.str("InvalidAccess")));

      if (isNull) {
        c.passIf(vIn + " === null");
        cond = vIn + " === undefined || ";
      }
      else {
        cond = vIn + " == null || ";
      }

      cond += "(" + vIn + ".constructor !== Object && " + toStringFn + ".call(" + v + ") !== \"[object Object]\")";
      c.failIf(cond, c.error(c.str(typeError)));

      this.compileType(c, vOut, vIn, def);
    }
    else if (type === "any") {
      if (checkAccess)
        c.failIf(checkAccess, c.error(c.str("InvalidAccess")));

      c.failIf(vIn + (!isNull ? " == null" : " === undefined"), c.error(c.str(typeError)));
      this.compileType(c, vOut, vIn, def);
    }
    else {
      if (checkAccess)
        c.failIf(checkAccess, c.error(c.str("InvalidAccess")));

      if (type === "array")
        c.ifElseIf("!Array.isArray(" + vIn + ")");
      else
        c.ifElseIf("typeof " + vIn + " !== \"" + type + "\"");

      if (isNull)
        cond = vIn + " !== null";
      else
        cond = null;

      if (cond && vOut !== vIn)
        c.emit(vOut + " = " + vIn + ";");

      var err = c.error(c.str(typeError));
      if (cond)
        c.failIf(cond, err);
      else
        c.emitError(err);
      c.end();

      this.compileType(c, vOut, vIn, def);
    }

    if (prevAccess) {
      c._accessGranted = prevAccess;
    }

    return vOut;
  },

  compileType: function(c, vOut, v, def) {
    throwRuntimeError("BaseType.compileType() has to be overridden.");
  }
});

// ============================================================================
// [SchemaType - Custom]
// ============================================================================

var CustomType = exclass({
  $extend: BaseType,

  // The most used type of all custom validators is "string". It can be omitted
  type: "string",

  compileType: function(c, vOut, v, def) {
    var cond = this.fail
      .replace(/\$[\w]+/g, function(key) {
        var value = def[key];
        if (value !== null && typeof value === "object")
          value = c.declareData(null, value);
        else
          value = JSON.stringify(value !== undefined ? value : null);
        return value;
      })
      .replace("func", c.declareData(null, this.func))
      .replace("@", v);

    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str(this.error)));
    return v;
  },

  // Function to be used as validator.
  func: null,

  // Code to be used to check for a successful validation.
  //   - "func" is replaced by the function call.
  //   - "@" is replaced by the actual value.
  //   - "$directive" is replaced by the directive.
  fail: "!func(@)",

  // Error code to be returned.
  error: "InvalidCustomType"
});
exmodel.CustomType = CustomType;

// ============================================================================
// [SchemaType - Any]
// ============================================================================

function hasObjectType(arr) {
  for (var i = 0, len = arr.length; i < len; i++) {
    var value = arr[i];
    if (value !== null && typeof value === "object")
      return true;
  }
  return false;
}

var AnyType = exclass({
  $extend: BaseType,

  name: ["any"],
  type: "any",

  compileType: function(c, vOut, v, def) {
    var allowed = def.$allowed;

    if (allowed) {
      var allowedData = c.declareData(null, allowed);

      // Get whether the $allowed directive contains an object.
      if (hasObjectType(allowed)) {
        c.failIf("!" + c.declareData(null, this.isAllowed) + "(" + v + ", " + allowedData + ")");
        if (!c.hasOption(kTestOnly)) {
          var cloneDeepFn = c.declareData("cloneDeep", cloneDeep);

          c.otherwise();
          c.emit(vOut + " = " + cloneDeepFn + "(" + v + ");");
          c.end("}");
        }
      }
      else {
        c.failIf(c.declareData(null, this.isAllowed) + ".indexOf(" + v + ") === -1",
          c.error(c.str("NotAllowed")));
      }
    }
    else {
      if (!c.hasOption(kTestOnly)) {
        var cloneDeepFn = c.declareData("cloneDeep", cloneDeep);

        c.otherwise();
        c.emit(vOut + " = " + cloneDeepFn + "(" + v + ");");
        c.end();
      }
    }

    return vOut;
  },

  isAllowed: function(a, allowed) {
    if (a === null || typeof a !== "object")
      return allowed.indexOf(a) !== -1;

    for (var i = 0, len = allowed.length; i < len; i++) {
      var b = allowed[i];
      if (typeof b === "object" && isEqual(a, b))
        return true;
    }

    return false;
  }
});
exmodel.addType(new AnyType());

// ============================================================================
// [SchemaType - Bool]
// ============================================================================

var BooleanType = exclass({
  $extend: BaseType,

  name: ["boolean", "bool"],
  type: "boolean",

  compileType: function(c, vOut, v, def) {
    var allowed = def.$allowed;

    // This is a boolean specific.
    if (isArray(allowed) && allowed.length > 0) {
      var isTrue  = allowed.indexOf(true ) !== -1;
      var isFalse = allowed.indexOf(false) !== -1;

      var cond = null;

      if (isTrue && !isFalse)
        cond = v + " !== true";
      if (!isTrue && isFalse)
        cond = v + " === true";

      if (cond)
        c.failIf(cond, c.error(c.str("NotAllowed")));
    }
  }
});
exmodel.addType(new BooleanType());

// ============================================================================
// [SchemaType - Number]
// ============================================================================

var NumberInfo = {
  number   : { integer: 0, min: null        , nax: null        },
  double   : { integer: 0, min: null        , nax: null        },
  numeric  : { integer: 0, min: null        , nax: null        },

  lat      : { integer: 0, min: -90         , max: 90          },
  latitude : { integer: 0, min: -90         , max: 90          },
  lon      : { integer: 0, min: -180        , max: 180         },
  longitude: { integer: 0, min: -180        , max: 180         },

  integer  : { integer: 1, min: kSafeIntMin , max: kSafeIntMax },
  int      : { integer: 1, min: kSafeIntMin , max: kSafeIntMax },
  uint     : { integer: 1, min: 0           , max: kSafeIntMax },
  int8     : { integer: 1, min: -128        , max: 127         },
  uint8    : { integer: 1, min: 0           , max: 255         },
  int16    : { integer: 1, min: -32768      , max: 32767       },
  uint16   : { integer: 1, min: 0           , max: 65535       },
  short    : { integer: 1, min: -32768      , max: 32767       },
  ushort   : { integer: 1, min: 0           , max: 65535       },
  int32    : { integer: 1, min: -2147483648 , max: 2147483647  },
  uint32   : { integer: 1, min: 0           , max: 4294967295  }
};

// TODO: $scale not honored.
var NumberType = exclass({
  $extend: BaseType,

  name: setToArray(NumberInfo),
  type: "number",

  configure: function(def, env, args) {
    var type = def.$type;

    if (type === "numeric") {
      var precision = null;
      var scale = null;

      if (args.length) {
        precision = args[0];
        scale = args.length > 1 ? parseInt(args[1]) : 0;

        if (!isFinite(precision))
          throwRuntimeError("Invalid precision '" + args[0] + "'");

        if (!isFinite(scale))
          throwRuntimeError("Invalid scale '" + args[1] + "'");

        def.$precision = precision;
        def.$scale = scale;
      }
      else {
        precision = def.$precision;
        scale = def.$scale;
      }

      if (precision != null && (!isFinite(precision) || precision <= 0))
        throwRuntimeError("Invalid precision '" + precision + "'");

      if (scale != null && (!isFinite(scale) || scale < 0))
        throwRuntimeError("Invalid scale '" + scale + "'");

      if (precision != null && scale != null && precision <= scale) {
        throwRuntimeError(
          "Precision '" + precision + "' has to be greater than scale '" + scale + ".");
      }
    }
  },

  compileType: function(c, vOut, v, def) {
    var type = def.$type;
    var info = NumberInfo[type];

    var allowed = def.$allowed;
    if (allowed) {
      c.failIf(c.declareData(null, allowed) + ".indexOf(" + v + ") === -1",
        c.error(c.str("NotAllowed")));
    }
    else {
      var range = c._cachedRange.init(info.min, info.max);

      range.mergeMin(def.$min, def.$minExclusive);
      range.mergeMax(def.$max, def.$maxExclusive);

      if (def.$precision) {
        var threshold = Math.pow(10, def.$precision - (def.$scale || 0));

        range.mergeMin(-threshold, true);
        range.mergeMax( threshold, true);
      }

      var isInt = !!info.integer;
      var isFinite = true;

      c.emitNumberCheck(v, range, isInt, isFinite);

      // DivBy check.
      if (def.$divisibleBy != null)
        c.failIf(v + " % " + def.$divisibleBy + " !== 0",
          c.error(c.str("DivisibleByError")));
    }

    return v;
  }
});
exmodel.addType(new NumberType());

// ============================================================================
// [SchemaType - String / Text]
// ============================================================================

// Special LO characters:
//   x [0000] NUL Null.
//   x [0001] SOH Start of Heading.
//   x [0002] STX Start of Text.
//   x [0003] ETX End of Text.
//   x [0004] EOT End of Transmission.
//   x [0005] ENQ Enquiry.
//   x [0006] ACK Acknowledge.
//   x [0007] BEL Bell.
//   x [0008] BS  Back Space.
//   o [0009] TAB Tab.
//   o [000A] LF  Line feed.
//   x [000B] VT  Vertical Tab.
//   x [000C] FF  Form Feed.
//   o [000D] CR  Carriage return.
//   x [000E] SO  Shift Out.
//   x [000F] SI  Shift In.
//   x [0010] DLE Data Line Escape.
//   x [0011] DC1 Device Control 1.
//   x [0012] DC2 Device Control 2.
//   x [0013] DC3 Device Control 3.
//   x [0014] DC4 Device Control 4.
//   x [0015] NAK Negative Acknowledge.
//   x [0016] SYN Synchronous Idle.
//   x [0017] ETB End of Transmit Block.
//   x [0018] CAN Cancel.
//   x [0019] EM  End of Medium.
//   x [001A] SUB Substitute.
//   x [001B] ESC Escape.
//   x [001C] FS  File Separator.
//   x [001D] GS  Group Separator.
//   x [001E] RS  Record Separator.
//   x [001F] US  Unit Separator.
function isText(s, loMask, hiMask) {
  var i = 0;
  var length = s.length;

  if (length === 0)
    return true;

  var c0 = 0;
  var c1 = 0;

  do {
    c0 = s.charCodeAt(i);

    // Lo-Mask check.
    if (c0 < 32) {
      if (((1 << c0) & loMask) === 0)
        return false;
      continue;
    }

    if (c0 < 0x2028)
      continue;

    // Hi-Mask check.
    if (c0 < 0x2028 + 32) {
      if (((1 << (c0 - 0x2028)) & hiMask) === 0)
        return false;
    }

    if (c0 < 0xD800 || c0 > 0xDFFF)
      continue;

    // Validate the surrogate pair.
    if (c0 > 0xDBFF || ++i === length)
      return false;

    c1 = s.charCodeAt(i);
    if (c1 < 0xDC00 || c1 > 0xDFFF)
      return false;
  } while (++i < length);

  return true;
}

var StringType = exclass({
  $extend: BaseType,

  name: ["string", "text", "textline", "text-line"],
  type: "string",

  masks: {
    // Forbidden characters:
    //   [U0000-U0008]
    //   [U000B-U000C]
    //   [U000E-U001F]
    text: {
      lo: 0x00002600|0, // ((1 << 0x09) | (1 << 0x0A) | (1 << 0x0D))
      hi: 0xFFFFFFFF|0  //~0
    },

    // Forbidden characters:
    //   [U0000-U0008]
    //   [U000A-U001F]
    //   [U2028-U2029]
    textline: {
      lo: 0x00000200|0, // ((1 << 0x09))
      hi: 0xFFFFFFFC|0  //~((1 << 0x00) | (1 << 0x01))
    }
  },

  compileType: function(c, vOut, v, def) {
    var type = def.$type;

    var isEmpty = def.$empty;
    var allowed = def.$allowed;

    var len = def.$length;
    var min = def.$minLength;
    var max = def.$maxLength;

    if (typeof isEmpty === "boolean") {
      if (isEmpty) {
        // Can be empty, however the minimum length can be still specified to
        // restrict non-empty strings.
        if (min !== null) {
          if (min <= 1)
            min = null;
          else
            c.passIf("!" + v);
        }
      }
      else {
        // Can't be empty, patch min/max length if necessary.
        if (min === null && max === null)
          len = 1;
        else if (min === null || min < 1)
          min = 1;
      }
    }

    if (isArray(allowed)) {
      c.failIf(c.declareData(null, allowed) + ".indexOf(" + v + ") === -1",
        c.error(c.str("NotAllowed")));
    }
    else {
      var cond = [];

      if (len != null) cond.push(v + ".length !== " + len);
      if (min != null) cond.push(v + ".length < " + min);
      if (max != null) cond.push(v + ".length > " + max);

      if (cond.length)
        c.failIf(cond.join(" || "),
          c.error(c.str("InvalidLength")));

      if (hasOwn.call(this.masks, type)) {
        var masks = this.masks[type];
        c.failIf("!" + c.declareData(null, isText) +
          "(" + v +
            ", " + masks.lo + "|0" +
            ", " + masks.hi + "|0" +
          ")",
          c.error(c.str("InvalidText")));
      }

      if (def.$re != null)
        c.failIf(c.declareData(null, def.$re) + ".test(" + v + ")",
          c.error(c.str(def.$reError || "RegExpFailure")));
    }

    return v;
  }
});
exmodel.addType(new StringType());

// ============================================================================
// [SchemaType - Char]
// ============================================================================

var CharType = exclass({
  $extend: BaseType,

  name: ["char"],
  type: "string",

  configure: function(def, env, args) {
    var allowed = def.$allowed;
    if (allowed && isArray(allowed))
      def.$allowed = allowed.join("");
  },

  compileType: function(c, vOut, v, def) {
    var cond = v + ((def.$empty === true) ? ".length > 1" : ".length !== 1");
    var allowed = def.$allowed;

    c.failIf(cond, c.error(c.str("InvalidChar")));

    if (allowed)
      c.failIf(c.declareData(null, allowed) + ".indexOf(" + v + ") === -1",
        c.error(c.str("NotAllowed")));

    return v;
  }
});
exmodel.addType(new CharType());

// ============================================================================
// [SchemaType - BigInt]
// ============================================================================

var kBigIntMin = "-9223372036854775808"; // Min BIGINT.
var kBigIntMax = "9223372036854775807";  // Max BIGINT.

function isBigInt(s, min, max) {
  var len = s.length;
  if (!len)
    return false;

  var i = 0;
  var c = s.charCodeAt(i);

  var ref;
  var isNegative = c === 45 ? 1 : 0;

  // Parse '-' sign.
  if (isNegative) {
    ref = min || kBigIntMin;
    if (ref.charCodeAt(0) !== 45 || ++i === len)
      return false;
    c = s.charCodeAt(i);
  }
  else {
    ref = max || kBigIntMax;
    if (ref.charCodeAt(0) === 45)
      return false;
  }

  // The input string can't be longer than the minimum/maximum string.
  var refLen = ref.length;
  if (len > refLen)
    return false;

  // "-0" or padded numbers like "-0XXX" and "0XXX" are not allowed.
  if (c < 48 || c > 57 || (c === 48 && len > 1))
    return false;

  // Validate whether the string only contains numbers, i.e. chars from 48..57.
  while (++i < len) {
    c = s.charCodeAt(i);
    if (c < 48 || c > 57)
      return false;
  }

  // In case that the input has the same length as min/max string we have to go
  // char-by-char and validate whether the string doesn't overflow.
  if (len === refLen) {
    for (i = isNegative; i < len; i++) {
      c = s.charCodeAt(i) - ref.charCodeAt(i);
      if (c !== 0) return c < 0;
    }
  }

  return true;
}
qutil.isBigInt = isBigInt;

var BigIntType = exclass({
  $extend: BaseType,

  name: ["bigint"],
  type: "string",

  configure: function(def, env, args) {
    var allowed = def.$allowed;

    if (allowed && isArray(allowed)) {
      var i, length = allowed.length;
      var safe = true;

      for (i = 0; i < length; i++) {
        if (typeof allowed[i] !== "string") {
          safe = false;
          break;
        }
      }

      if (!safe) {
        allowed = allowed.slice();
        do {
          allowed[i] = String(allowed[i]);
        } while (++i < length);

        def.$allowed = allowed;
      }
    }
  },

  compileType: function(c, vOut, v, def) {
    var allowed = def.$allowed;

    if (allowed) {
      cond = c.declareData(null, allowed) + ".indexOf(" + v + ") === -1";
      if (def.$empty === true)
        cond = v + " && " + cond;
      c.failIf(cond, c.error(c.str("NotAllowed")));
    }
    else {
      var cond = "!" + c.declareData(null, isBigInt) + "(" + v + ")";
      if (def.$empty === true)
        cond = v + " && " + cond;
      c.failIf(cond, c.error(c.str("InvalidBigInt")));
    }

    return v;
  }
});
exmodel.addType(new BigIntType());

// ============================================================================
// [SchemaType - Color]
// ============================================================================

// \internal
var ColorNames = {
  aliceblue           : "#f0f8ff", antiquewhite        : "#faebd7",
  aqua                : "#00ffff", aquamarine          : "#7fffd4",
  azure               : "#f0ffff",
  beige               : "#f5f5dc", bisque              : "#ffe4c4",
  black               : "#000000", blanchedalmond      : "#ffebcd",
  blue                : "#0000ff", blueviolet          : "#8a2be2",
  brown               : "#a52a2a", burlywood           : "#deb887",
  cadetblue           : "#5f9ea0", chartreuse          : "#7fff00",
  chocolate           : "#d2691e", coral               : "#ff7f50",
  cornflowerblue      : "#6495ed", cornsilk            : "#fff8dc",
  crimson             : "#dc143c", cyan                : "#00ffff",
  darkblue            : "#00008b", darkcyan            : "#008b8b",
  darkgoldenrod       : "#b8860b", darkgray            : "#a9a9a9",
  darkgreen           : "#006400", darkkhaki           : "#bdb76b",
  darkmagenta         : "#8b008b", darkolivegreen      : "#556b2f",
  darkorange          : "#ff8c00", darkorchid          : "#9932cc",
  darkred             : "#8b0000", darksalmon          : "#e9967a",
  darkseagreen        : "#8fbc8f", darkslateblue       : "#483d8b",
  darkslategray       : "#2f4f4f", darkturquoise       : "#00ced1",
  darkviolet          : "#9400d3", deeppink            : "#ff1493",
  deepskyblue         : "#00bfff", dimgray             : "#696969",
  dodgerblue          : "#1e90ff",
  firebrick           : "#b22222", floralwhite         : "#fffaf0",
  forestgreen         : "#228b22", fuchsia             : "#ff00ff",
  gainsboro           : "#dcdcdc", ghostwhite          : "#f8f8ff",
  gold                : "#ffd700", goldenrod           : "#daa520",
  gray                : "#808080", green               : "#008000",
  greenyellow         : "#adff2f",
  honeydew            : "#f0fff0", hotpink             : "#ff69b4",
  indianred           : "#cd5c5c", indigo              : "#4b0082",
  ivory               : "#fffff0",
  khaki               : "#f0e68c",
  lavender            : "#e6e6fa", lavenderblush       : "#fff0f5",
  lawngreen           : "#7cfc00", lemonchiffon        : "#fffacd",
  lightblue           : "#add8e6", lightcoral          : "#f08080",
  lightcyan           : "#e0ffff", lightgoldenrodyellow: "#fafad2",
  lightgrey           : "#d3d3d3", lightgreen          : "#90ee90",
  lightpink           : "#ffb6c1", lightsalmon         : "#ffa07a",
  lightseagreen       : "#20b2aa", lightskyblue        : "#87cefa",
  lightslategray      : "#778899", lightsteelblue      : "#b0c4de",
  lightyellow         : "#ffffe0", lime                : "#00ff00",
  limegreen           : "#32cd32", linen               : "#faf0e6",
  magenta             : "#ff00ff", maroon              : "#800000",
  mediumaquamarine    : "#66cdaa", mediumblue          : "#0000cd",
  mediumorchid        : "#ba55d3", mediumpurple        : "#9370d8",
  mediumseagreen      : "#3cb371", mediumslateblue     : "#7b68ee",
  mediumspringgreen   : "#00fa9a", mediumturquoise     : "#48d1cc",
  mediumvioletred     : "#c71585", midnightblue        : "#191970",
  mintcream           : "#f5fffa", mistyrose           : "#ffe4e1",
  moccasin            : "#ffe4b5",
  navajowhite         : "#ffdead", navy                : "#000080",
  oldlace             : "#fdf5e6", olive               : "#808000",
  olivedrab           : "#6b8e23", orange              : "#ffa500",
  orangered           : "#ff4500", orchid              : "#da70d6",
  palegoldenrod       : "#eee8aa", palegreen           : "#98fb98",
  paleturquoise       : "#afeeee", palevioletred       : "#d87093",
  papayawhip          : "#ffefd5", peachpuff           : "#ffdab9",
  peru                : "#cd853f", pink                : "#ffc0cb",
  plum                : "#dda0dd", powderblue          : "#b0e0e6",
  purple              : "#800080",
  red                 : "#ff0000", rosybrown           : "#bc8f8f",
  royalblue           : "#4169e1",
  saddlebrown         : "#8b4513", salmon              : "#fa8072",
  sandybrown          : "#f4a460", seagreen            : "#2e8b57",
  seashell            : "#fff5ee", sienna              : "#a0522d",
  silver              : "#c0c0c0", skyblue             : "#87ceeb",
  slateblue           : "#6a5acd", slategray           : "#708090",
  snow                : "#fffafa", springgreen         : "#00ff7f",
  steelblue           : "#4682b4",
  tan                 : "#d2b48c", teal                : "#008080",
  thistle             : "#d8bfd8", tomato              : "#ff6347",
  turquoise           : "#40e0d0",
  violet              : "#ee82ee",
  wheat               : "#f5deb3", white               : "#ffffff",
  whitesmoke          : "#f5f5f5",
  yellow              : "#ffff00", yellowgreen         : "#9acd32"
};
qutil.ColorNames = ColorNames;

function isColor(s, cssNames, extraNames) {
  var len = s.length;
  if (!len)
    return false;

  // Validate "#XXX" and "#XXXXXX".
  var c0 = s.charCodeAt(0);
  if (c0 === 35) {
    if (len !== 4 && len !== 7)
      return false;

    for (var i = 1; i < len; i++) {
      var c0 = s.charCodeAt(i);
      if (c0 < 48 || (c0 > 57 && ((c0 |= 0x20) < 97 || c0 > 102)))
        return false;
    }

    return true;
  }

  if (cssNames === false && extraNames != null)
    return false;

  // Need lowercased color name from here (a bit overhead, but necessary).
  s = s.toLowerCase();

  // Validate named entities.
  if (cssNames !== false && hasOwn.call(ColorNames, s))
    return true;

  // Validate extra table (can contain values like "currentColor", "none", ...)
  if (extraNames != null && hasOwn.call(extraNames, s))
    return true;

  return false;
}
qutil.isColor = isColor;

var ColorType = exclass({
  $extend: BaseType,

  name: ["color"],
  type: "string",

  configure: function(def, env, args) {
    var css = def.$cssNames;
    var extra = def.$extraNames;

    if (css != null) {
      css = def.$cssNames;
      if (typeof css !== "boolean")
        throwRuntimeError("ColorType - Invalid '$cssNames' directive '" + css + "'.");
    }

    if (extra != null) {
      extra = def.$extraNames;
      if (typeof extra !== "object" || isArray(extra))
        throwRuntimeError("ColorType - Invalid '$extraNames' directive '" + extra + "'.");
    }
  },

  compileType: function(c, vOut, v, def) {
    var css = def.$cssNames != null ? def.$cssNames : true;
    var extra = def.$extraNames != null ? c.declareData(null, def.$extraNames) : null;

    var cond = "!" + c.declareData("isColor", isColor) + "(" + v + ", " + css + ", " + extra + ")";
    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str("InvalidColor")));
    return v;
  }
});
exmodel.addType(new ColorType());

// ============================================================================
// [SchemaType - CreditCard]
// ============================================================================

function isCreditCard(s) {
  var i = 0;
  var len = s.length;

  // Credit card number contains 13-19 digits.
  if (len < 13 || len > 19)
    return "";

  // LUHN algorithm.
  var odd = 1 - (len & 1);
  var sum = 0;

  for (;;) {
    var c = s.charCodeAt(i) - 48;
    if (c < 0 || c > 9)
      return false;

    if (++i === len)
      break;

    // Multiply by 2 all digits in odd positions counting from the end and
    // subtract 9 to all those result after the multiplication is over 9.
    if ((i & 1) === odd && (c *= 2) > 9) c -= 9;

    // Sum all digits except the last one.
    sum += c;
  }

  if (((sum + c) % 10) !== 0)
    return "";

  return "OK";
}
qutil.isCreditCard = isCreditCard;

var CreditCardType = exclass({
  $extend: CustomType,
  name: ["creditcard"],

  func: isCreditCard,
  fail: "func(@) === \"\"",

  error: "InvalidCreditCard"
});
exmodel.addType(new CreditCardType());

// ============================================================================
// [SchemaType - ISBN]
// ============================================================================

function isISBN(s) {
  var i = 0;
  var c;

  var len = s.length;
  var sum = 0;

  if (len === 10) {
    for (;;) {
      c = s.charCodeAt(i) - 48;
      if (++i === len)
        break;

      if (c < 0 || c > 9)
        return 0;
      sum += (11 - i) * c;
    }

    if (c === 40)
      c = 10;
    else if (c < 0 || c > 9)
      return 0;

    if (((sum + (11 - i) * c) % 11) === 0)
      return 10;
  }
  else if (len === 13) {
    for (;;) {
      c = s.charCodeAt(i) - 48;
      if (c < 0 || c > 9)
        return 0;

      if (i & 1)
        c *= 3;
      sum += c;

      if (++i === len)
        break;
    }

    if ((sum % 10) === 0)
      return 13;
  }

  return 0;
}
qutil.isISBN = isISBN;

var ISBNType = exclass({
  $extend: BaseType,

  name: ["isbn"],
  type: "string",

  configure: function(def, env, args) {
    var fmt = def.$format;

    if (fmt != null && (fmt !== "" && fmt !== "10" && fmt !== "13"))
      throwRuntimeError("ISBNType - Invalid '$format' directive '" + fmt + "'.");
  },

  compileType: function(c, vOut, v, def) {
    var fmt = def.$format;
    var cond = c.declareData("isISBN", isISBN) + "(" + v + ")";

    if (fmt)
      cond += " !== " + fmt;
    else
      cond += " === 0";

    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str("InvalidISBN")));
    return v;
  }
});
exmodel.addType(new ISBNType());

// ============================================================================
// [SchemaType - MAC Address]
// ============================================================================

function isMAC(s, sep) {
  if (typeof sep !== "number")
    sep = 58; // ':'.

  // MAC is written as "AA:BB:CC:DD:EE:FF" which is exactly 17 characters long.
  if (s.length !== 17)
    return false;

  var i = 0;
  for (;;) {
    var c0 = s.charCodeAt(i    );
    var c1 = s.charCodeAt(i + 1);

    i += 3;

    if (c0 < 48 || (c0 > 57 && ((c0 |= 0x20) < 97 || c0 > 102))) return false;
    if (c1 < 48 || (c1 > 57 && ((c1 |= 0x20) < 97 || c1 > 102))) return false;

    if (i === 18)
      return true;

    if (s.charCodeAt(i - 1) !== sep)
      return false;
  }
}
qutil.isMAC = isMAC;

var MACType = exclass({
  $extend: BaseType,

  name: ["mac"],
  type: "string",

  configure: function(def, env, args) {
    var sep = def.$separator;

    if (sep != null && (typeof sep !== "string" || sep.length !== 1))
      throwRuntimeError("MAC address separator has to be a single character.");
  },

  compileType: function(c, vOut, v, def) {
    var sep = def.$separator || ":";
    var cond = "!" + c.declareData(null, isMAC) + "(" + v + ", " + sep.charCodeAt(0) + ")";

    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str("InvalidMAC")));
    return v;
  }
});
exmodel.addType(new MACType());

// ============================================================================
// [SchemaType - IPV4 / IPV6]
// ============================================================================

function isIP(s, allowPort) {
  return isIPV4(s, allowPort) || isIPV6(s, allowPort);
}
qutil.isIP = isIP;

function isIPV4(s, allowPort) {
  // The shortest possible IPV4 address is "W.X.Y.Z", which is 7 characters long.
  var len = s.length;
  if (len < 7)
    return false;

  var i = 0;
  var n = 1;

  // Parse the IP part.
  for (;;) {
    // Parse the first digit.
    var c0 = s.charCodeAt(i);
    if (c0 < 48 || c0 > 57)
      return false;
    c0 -= 48;

    if (++i === len)
      return n === 4;

    // Parse one or two consecutive digits and validate the value to be <= 256.
    var c1 = s.charCodeAt(i);
    if (c1 >= 48 && c1 <= 57) {
      if (c0 === 0)
        return false;

      if (++i === len)
        return n === 4;

      c0 = c0 * 10 + c1 - 48;
      c1 = s.charCodeAt(i);

      if (c1 >= 48 && c1 <= 57) {
        c0 = c0 * 10 + c1 - 48;
        if (c0 > 255)
          return false;

        if (++i === len)
          return n === 4;
        c1 = s.charCodeAt(i);
      }
    }

    if (c1 !== 46) {
      if (c1 === 58 && allowPort && n === 4)
        break;
      return false;
    }

    if (++i === len)
      return false;

    // Maximum 4 components separated by ".".
    if (++n >= 5)
      return false;
  }

  // Parse the port value.
  if (++i === len)
    return false;

  // Parse the first digit.
  var port = s.charCodeAt(i) - 48;
  if (port < 0 || port > 9)
    return false;

  // Parse the consecutive digits.
  while (++i !== len) {
    var c0 = s.charCodeAt(i);
    if (c0 < 48 || c0 > 57)
      return false;

    // Prevent ports padded by zeros and values outside of 16-bit domain.
    port = port * 10 + c0 - 48;
    if (port === 0 || port > 65535)
      return false;
  }

  return true;
}
qutil.isIPV4 = isIPV4;

function isIPV6(s, allowPort) {
  // The shortest possible IPV6 address is "::", which is 2 characters long.
  var len = s.length;
  if (len < 2)
    return false;

  var i = 0;         // Index to `s`.
  var numValues = 0; // How many components have been parsed.
  var collapsed = 0; // Whether the collapsed version `::` has been used.

  var c0 = s.charCodeAt(0);
  var c1;

  // Parse "[...]:port" if allowed.
  if (c0 === 91) {
    if (!allowPort)
      return false;

    var port = 0;
    var scale = 1;

    for (;;) {
      c0 = s.charCodeAt(--len);
      if (c0 >= 48 && c0 <= 57) {
        c0 -= 48;

        port  += c0 * scale;
        scale *= 10;

        // Port is a 16-bit number, thus it cannot be greater than 65535.
        if (port > 65535)
          return false;
        continue;
      }

      // Parse ":" before the port value.
      if (c0 === 58)
        break;

      return false;
    }

    // Parse "]" that is before the ":port" part and refuse "[]:port" syntax
    // without any IP address within [].
    if (s.charCodeAt(--len) !== 93 || ++i >= len)
      return false;
    c0 = s.charCodeAt(i);
  }

  // Parse leading "::", but refuse to parse leading ":".
  if (c0 === 58) {
    if ((i += 2) > len || s.charCodeAt(i - 1) !== 58)
      return false;

    // Multicast "::" form.
    if (i === len)
      return true;

    c0 = s.charCodeAt(i);
    collapsed = 1;
  }

  for (;;) {
    // Parse "X...XXXX" number.
    if (c0 < 48 || (c0 > 57 && (((c1 = c0 | 0x20)) < 97 || c1 > 102)))
      break;

    if (++numValues > 8)
      return false;

    if (++i === len) break;
    c0 = s.charCodeAt(i);

    // Parse at most 3 more HEX characters.
    if (c0 >= 48 && (c0 <= 57 || (((c1 = c0 | 0x20)) >= 97 && c1 <= 102))) {
      if (++i === len) break;
      c0 = s.charCodeAt(i);

      if (c0 >= 48 && (c0 <= 57 || (((c1 = c0 | 0x20)) >= 97 && c1 <= 102))) {
        if (++i === len) break;
        c0 = s.charCodeAt(i);

        if (c0 >= 48 && (c0 <= 57 || (((c1 = c0 | 0x20)) >= 97 && c1 <= 102))) {
          if (++i === len) break;
          c0 = s.charCodeAt(i);
        }
      }
    }

    // Parse ":" or "::"
    if (c0 !== 58)
      break;

    // Refuse ":" at the end of the input
    if (++i === len)
      return false;

    // Refuse "::" if occured multiple times.
    c0 = s.charCodeAt(i);
    if (c0 === 58) {
      if (++collapsed !== 1)
        return false;

      if (++i === len) break;
      c0 = s.charCodeAt(i);
    }
  }

  if (i !== len)
    return false;

  if (collapsed) {
    // Collapsed form having 8 or more components is invalid.
    if (numValues >= 8)
      return false;
  }
  else {
    // Non-collapsed form requires exactly 8 components.
    if (numValues !== 8)
      return false;
  }

  return true;
}
qutil.isIPV6 = isIPV6;

var IPType = exclass({
  $extend: BaseType,

  name: ["ip", "ipv4", "ipv6"],
  type: "string",

  compileType: function(c, vOut, v, def) {
    var type = def.$type;
    var err;
    var fn;

    var allowPort = def.$allowPort ? true : false;

    switch (type) {
      case "ip":
        err = "InvalidIP";
        fn = qutil.isIP;
        break;
      case "ipv4":
        err = "InvalidIPV4";
        fn = qutil.isIPV4;
        break;
      case "ipv6":
        err = "InvalidIPV6";
        fn = qutil.isIPV6;
        break;
      default:
        throwRuntimeError("Invalid type '" + type + "'.");
    }

    var cond = "!" + c.declareData(null, fn) + "(" + v + ", " + allowPort + ")";
    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str(err)));
    return v;
  }
});
exmodel.addType(new IPType());

// ============================================================================
// [SchemaType - UUID]
// ============================================================================

// The `brackets` argument can be one of:
//   `0`  - No brackets allowed    - will accept only "UUID".
//   `1`  - Brackets are optional  - will accept either "UUID" or "{UUID}".
//   `2`  - Brackets are mandatory - will accept only "{UUID}".
//
// The function will return
//   `-1` - The string is a well formed UUID string, but the version check
//          failed.
//   `0`  - Invalid UUID string.
//   `1-5`- UUID version 1 to 5 recognized.
function isUUID(s, brackets) {
  var i = 0;
  var len = s.length;

  // xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
  if (len !== 36) {
    // Invalid UUID or "{UUID}" form not allowed.
    if (len !== 38 || !brackets || s.charCodeAt(0) !== 123 || s.charCodeAt(--len) !== 125)
      return 0;
    i = 1;
  }
  else if (brackets > 1) {
    // Invalid UUID or "UUID" form not allowed.
    return 0;
  }

  // The first part is 8 characters (4 bytes) long.
  var stop = i + 8;
  var c, v;

  for (;;) {
    do {
      c = s.charCodeAt(i);
      // Number "0-9".
      if (c < 48) return 0;
      // Hex (Lowercased).
      if (c > 57 && ((c |= 0x20) < 97 || c > 102)) return 0;
    } while (++i !== stop);

    if (i === len)
      break;

    c = s.charCodeAt(i);
    if (c !== 45)
      return 0;

    // 1. The middle parts are 4 characters (2 bytes) long.
    // 2. The last part is 12 characters (6 bytes) long.
    stop = ++i + 12;
    if (stop !== len)
      stop -= 8;
  }

  v = s.charCodeAt(len - 22) - 48;
  switch (v) {
    case 1:
    case 2:
      return v;

    case 3:
    case 4:
    case 5:
      c = s.charCodeAt(len - 17);
      if (c === 56 || c === 57) return v; // '8' or '9'.
      c |= 0x20; // Lowercase.
      if (c === 97 || c === 98) return v; // 'A' or 'B'.
      break;
  }

  // Well formed UUID string, but has incorrect version.
  return -1;
}
qutil.isUUID = isUUID;

var UUIDType = exclass({
  $extend: BaseType,

  name: ["uuid"],
  type: "string",

  configure: function(def, env, args) {
    var fmt = def.$format;
    var ver = def.$version;

    if (fmt != null && (fmt !== "any" && fmt !== "rfc" && fmt !== "windows"))
      throwRuntimeError("UUIDType - Invalid '$format' directive '" + fmt + "'.");

    if (ver != null && (typeof ver !== "string" || (ver && !/^[1-5]\+?$/.test(ver))))
      throwRuntimeError("UUIDType - Invalid '$version' directive '" + ver + "'.");
  },

  compileType: function(c, vOut, v, def) {
    var fmt = def.$format;
    var ver = def.$version;

    var brackets = 0;

    if (fmt === "any") brackets = 1;
    if (fmt === "windows") brackets = 2;

    var cond = c.declareData("isUUID", isUUID) + "(" + v + ", " + brackets + ")";
    var m;

    if (ver && (m = ver.match(/^([1-5])(\+?)$/)))
      cond += (m[2] ? " < " : " !== ") + m[1];
    else
      cond += " === 0";

    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, c.error(c.str("InvalidUUID")));
    return v;
  }
});
exmodel.addType(new UUIDType());

// ============================================================================
// [SchemaType - DateTime]
// ============================================================================

// Days in a month, leap years have to be handled separately.
//                (JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC)
var DaysInMonth = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Leap seconds data.
//
// Every year has it's own data that is stored in a single number in a form 0xXY,
// where X represents a leap second in June-30 and Y represents Dec-31.
var LeapSecondDates = {
  start: 1972,
  array: [
    /* 1972: */ 0x11, /* 1973: */ 0x01, /* 1974: */ 0x01, /* 1975: */ 0x01,
    /* 1976: */ 0x01, /* 1977: */ 0x01, /* 1978: */ 0x01, /* 1979: */ 0x01,
    /* 1980: */ 0x00, /* 1981: */ 0x10, /* 1982: */ 0x10, /* 1983: */ 0x10,
    /* 1984: */ 0x00, /* 1985: */ 0x10, /* 1986: */ 0x00, /* 1987: */ 0x01,
    /* 1988: */ 0x00, /* 1989: */ 0x01, /* 1990: */ 0x01, /* 1991: */ 0x00,
    /* 1992: */ 0x10, /* 1993: */ 0x10, /* 1994: */ 0x10, /* 1995: */ 0x01,
    /* 1996: */ 0x00, /* 1997: */ 0x10, /* 1998: */ 0x01, /* 1999: */ 0x00,
    /* 2000: */ 0x00, /* 2001: */ 0x00, /* 2002: */ 0x00, /* 2003: */ 0x00,
    /* 2004: */ 0x00, /* 2005: */ 0x01, /* 2006: */ 0x00, /* 2007: */ 0x00,
    /* 2008: */ 0x01, /* 2009: */ 0x00, /* 2010: */ 0x00, /* 2011: */ 0x00,
    /* 2012: */ 0x10, /* 2013: */ 0x00, /* 2014: */ 0x00, /* 2015: */ 0x10
  ]
};
qutil.LeapSecondDates = LeapSecondDates;

// \internal
//
// Built-in DateTime formats.
var DateFormats = {
  "date"       : "YYYY-MM-DD",

  "datetime"   : "YYYY-MM-DD HH:mm:ss",
  "datetime-ms": "YYYY-MM-DD HH:mm:ss.SSS",
  "datetime-us": "YYYY-MM-DD HH:mm:ss.SSSSSS",

  "time"       : "HH:mm:ss",
  "time-ms"    : "HH:mm:ss.SSS",
  "time-us"    : "HH:mm:ss.SSSSSS"
};

// \internal
var DateComponents = {
  Y     : { len:-4, msk: 0x01 },
  YY    : { len: 2, msk: 0x01 },
  YYYY  : { len: 4, msk: 0x01 },
  M     : { len:-2, msk: 0x02 },
  MM    : { len: 2, msk: 0x02 },
  D     : { len:-2, msk: 0x04 },
  DD    : { len: 2, msk: 0x04 },
  H     : { len:-2, msk: 0x08 },
  HH    : { len: 2, msk: 0x08 },
  m     : { len:-2, msk: 0x10 },
  mm    : { len: 2, msk: 0x10 },
  s     : { len:-2, msk: 0x20 },
  ss    : { len: 2, msk: 0x20 },
  S     : { len: 1, msk: 0x40 },
  SS    : { len: 2, msk: 0x40 },
  SSS   : { len: 3, msk: 0x40 },
  SSSSSS: { len: 6, msk: 0x40 }
};

// \internal
//
// Get whether the given charcode is a date component (ie it can be parsed as
// year, month, date, etc...). Please note that not all alphanumeric characters
// are considered as date components.
function isDateComponent(c) {
  return c === 0x59 || // 'Y' - Year.
         c === 0x4D || // 'M' - Month.
         c === 0x44 || // 'D' - Day.
         c === 0x48 || // 'H' - Hour.
         c === 0x6D || // 'm' - Minute.
         c === 0x73 || // 's' - Second.
         c === 0x53 ;  // 'S' - Fractions of second.
}

// \function `data.util.isLeapYear(year)`
//
// Get whether the `year` is a leap year (ie it has 29th February).
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 1 : 0;
}
qutil.isLeapYear = isLeapYear;

// \function `data.util.hasLeapSecond(year, month, day)`
//
// Get whether a date defined by `year`, `month`, and `day` has a leap second.
// Please note that it's impossible to guess leap second in the future. This
// function is mainly included to validate whether a date that has already
// passed or is in a near future has a leap second defined.
function isLeapSecondDate(year, month, date) {
  var msk = 0x00;

  if (month === 6 && date === 30)
    msk = 0x10;
  else if (month === 12 && date === 31)
    msk = 0x01;
  else
    return false;

  var data = LeapSecondDates;
  var start = data.start;
  var array = data.array;
  var index = year - start;

  if (index < 0 || index >= array.length)
    return 0;

  return (array[index] & msk) !== 0;
}
qutil.isLeapSecondDate = isLeapSecondDate;

// \internal
//
// Interface to create/cache date parsers based on date `format`.
var DateFactory = {
  // Get a date parser based on format passed as `format`. The object returned
  // has `format`, which is the same as `format` passed and `func`, which is a
  // compiled validation function. The result is cached and every `format` is
  // checked and compiled only once.
  get: function(format) {
    var cache = this.cache;

    if (hasOwn.call(cache, format))
      return cache[format];

    var detail = this.inspect(format);
    var validator = {
      format: format,
      exec  : this.compile(format, detail)
    };

    cache[format] = validator;
    return validator;
  },

  // A mapping between a date format and a validator instance.
  cache: {},

  // Inspects a date format passed as `format`. If the format is valid and
  // non-ambiguous it returns an object that contains:
  //
  //   'Y', 'M', 'D', 'H', 'm', 's', 'S' - Information about date parts parsed in
  //     a `format` of object having `{ part, index, len }` properties.
  //
  //   'parts' - Date components and separators.
  //
  //   'fixed' - Whether ALL date components have fixed length (0 or 1).
  //
  //   'minLength' - Minimum length of a string to be considered valid and to be
  //     processed.
  inspect: function(format) {
    var i = 0;
    var len = format.length;

    // Split date components and separators, for example "YYYY-MM-DD" string
    // would be split into ["YYYY", "-", "MM", "-", "DD"] components.
    var parts = [];
    do {
      var start = i;
      var symb = format.charCodeAt(i);

      if (isDateComponent(symb)) {
        // Merge component chars, like "Y", "YY", "YYYY".
        while (++i < len && format.charCodeAt(i) === symb)
          continue;
      }
      else {
        // Parse anything that is not a date component.
        while (++i < len && !isDateComponent(format.charCodeAt(i)))
          continue;
      }

      parts.push(format.substring(start, i));
    } while (i < len);

    var index = 0;   // Component/Part string index, -1 if not usable.
    var fixed = 1;   // All components have fixed length.

    var msk = 0|0;   // Mask of parsed components.
    var sep = false; // Whether the current/next component has to be a separator.

    var insepected = {
      parts: null,
      fixed: 0,
      minLength: len
    };

    for (i = 0, len = parts.length; i < len; i++) {
      var part = parts[i];

      if (hasOwn.call(DateComponents, part)) {
        var data = DateComponents[part];
        var symb = part.charAt(0);

        // Fail if one component appears multiple times or if the separator is
        // required at this point.
        if ((msk & data.msk) !== 0 || sep)
          throwRuntimeError("Invalid date format '" + format + "'.");
        msk |= data.msk;

        // Store the information about this date component. We always use the
        // format symbol `symb` as a key as it's always "Y" for all of "Y", "YY",
        // and "YYYY", for example.
        insepected[symb] = {
          part : part,
          index: fixed ? index : -1,
          len  : data.len
        };

        // Require the next component to be a separator if the component doesn't
        // have a fixed length. This prevents from ambiguities and one component
        // running through another in case of "YMD" for example.
        sep = data.len <= 0;

        // Update `fixed` flag in case this component's length is not fixed.
        fixed &= !sep;
      }
      else {
        // Reset the separator flag and add escaped part sequence into the regexp.
        sep = false;
      }

      index += part.length;
    }

    // [Y=0x01] [M=0x02] [D=0x04]
    // [H=0x08] [m=0x10] [s=0x20] [S=0x40]
    if ((msk & (0x40 | 0x20)) === (0x40) || // Cannot have 'S' without 's'.
        (msk & (0x20 | 0x10)) === (0x20) || // Cannot have 's' without 'm'.
        (msk & (0x10 | 0x08)) === (0x10) || // Cannot have 'm' without 'H'.
        (msk & (0x04 | 0x02)) === (0x04) || // Cannot have 'D' without 'M'.
        (msk & (0x01 | 0x02)) === (0x01) || // Cannot have 'Y' without 'M'.
        (msk & (0x05 | 0x02)) === (0x02) )  // Cannot have 'M' without either 'D' or 'Y'.
      throwRuntimeError("Invalid date format '" + format + "'.");

    insepected.parts = parts;
    insepected.fixed = fixed;

    return insepected;
  },

  compile: function(format, detail) {
    var c = new CoreCompiler();

    var parts = detail.parts;
    var fixed = detail.fixed;

    var Y = detail.Y;
    var M = detail.M;
    var D = detail.D;
    var H = detail.H;
    var m = detail.m;
    var s = detail.s;

    var index = 0;
    var i, j;

    c.arg("input");
    c.arg("hasLeapYear");
    c.arg("hasLeapSecond");

    c.declareVariable("len", "input.length");
    c.declareVariable("cp", 0);

    c.comment("Date validator of '" + format + "' format.");
    c.emit("do {");

    c.emit("if (len " + (fixed ? "!==" : "<") + " " + detail.minLength + ") break;");
    c.nl();

    for (i = 0; i < parts.length; i++) {
      var part = parts[i];
      var symb = part.charAt(0);

      if (hasOwn.call(detail, symb)) {
        var data = detail[symb];
        var jLen = data.len;

        // Generate code that parses the number and assigns its value into
        // a variable `symb`.
        c.declareVariable(symb);

        // If this component has a variable length we have to fix the parser
        // in a way that all consecutive components will use relative indexing.
        if (jLen <= 0 && index >= 0) {
          c.declareVariable("index", String(index));
          index = -1;
        }

        if (jLen > 0) {
          if (index < 0)
            c.emit("if (index + " + String(jLen) + " > len) break;");

          for (j = 0; j < jLen; j++) {
            var v = (j === 0) ? symb : "cp";
            var sIndex = (index >= 0) ? String(index + j) : "index + " + j;

            c.emit("if ((" + v + " = input.charCodeAt(" + sIndex + ") - 48) < 0 || " + v + " >= 10) break;");
            if (j !== 0)
              c.emit(symb + " = " + symb + " * 10 + " + v + ";");
          }

          if (index >= 0)
            index += jLen;
        }
        else {
          j = -jLen;

          c.declareVariable("limit");

          c.emit("if (index >= len) break;");
          c.emit("if ((" + symb + " = input.charCodeAt(index) - 48) < 0 || " + symb + " >= 10) break;");

          c.nl();
          c.emit("limit = Math.min(len, index + " + j + ");");

          c.emit("while (++index < limit && (cp = input.charCodeAt(index) - 48) >= 0 && cp < 10) {");
          c.emit(symb += " = " + symb + " * 10 + cp;");
          c.emit("}");
        }
      }
      else {
        // Generate code that checks if the separator sequence is correct.
        var cond = [];
        var jLen = part.length;

        if (index >= 0) {
          for (j = 0; j < jLen; j++)
            cond.push("input.charCodeAt(" + (index + j) + ") !== " + part.charCodeAt(j));
          index += jLen;
        }
        else {
          cond.push("index + " + jLen + " > len");
          for (j = 0; j < jLen; j++)
            cond.push("input.charCodeAt(index + " + j + ") !== " + part.charCodeAt(j));
        }

        c.emit("if (" + cond.join(" || ") + ") break;");

        if (index < 0)
          c.emit("index += " + jLen + ";");
      }

      c.nl();
    }

    if (Y) {
      c.emit("if (Y < " + kYearMin + ") break;");
    }

    if (M) {
      c.emit("if (M < 1 || M > 12) break;");
      if (D) {
        c.declareData("DaysInMonth", DaysInMonth);

        // If `hasLeapYear` is true, but year is not part of the format we
        // allow any 29th February.
        var leapYearCheck = "hasLeapYear";
        if (Y)
          leapYearCheck += " && ((Y % 4 === 0 && Y % 100 !== 0) || (Y % 400 === 0))";

        c.emit("if (D < 1 || D > DaysInMonth[M - 1] +\n" +
               "    ((M === 2 && D === 29 && " + leapYearCheck + ") ? 1 : 0))\n" +
               "  break;");
      }
    }

    if (H) {
      c.emit("if (H > 23) break;");
      if (m) {
        c.emit("if (m > 59) break;");
        if (s) {
          var leapSecondCheck = "hasLeapSecond";
          if (M && D) {
            if (Y) {
              c.declareData("isLeapSecondDate", isLeapSecondDate);
              leapSecondCheck += " && isLeapSecondDate(Y, M, D)";
            }
            else {
              // If `hasLeapSecond` is `true`, but year is not part of
              // the format we allow any 30th/June and 31st/December.
              leapSecondCheck += " && ((M === 6 && D == 30) || (M === 12 && D === 31))";
            }
          }
          c.emit("if (s > 59 && !(s === 60 && " + leapSecondCheck + ")) break;");
        }
      }
    }

    c.emit("return null;");
    c.emit("} while (false);");

    c.nl();
    c.emit("return { code: \"InvalidDate\", format: this.format };");

    return c.toFunction();
  }
};

var DateTimeType = exclass({
  $extend: BaseType,

  name: setToArray(DateFormats),
  type: "string",

  hook: function(def, env, args) {
    var type = def.$type;
    var format = def.$format || DateFormats[type];

    if (typeof format !== "string")
      throwRuntimeError("Invalid date format '" + format + "'.");

    def.$validator = DateFactory.get(format);
  },

  compileType: function(c, vOut, v, def) {
    var vErr = c.declareVariable("err");

    var validator = c.declareData(null, def.$validator);
    var hasLeapYear = true;
    var hasLeapSecond = false;

    // Default `$leapYear` value is `true`.
    if (def.$leapYear === false)
      hasLeapYear = false;

    // Default `$leapSecond` value is `false`.
    if (def.$leapSecond === true)
      hasLeapSecond = true;

    var cond = "(" +
      vErr + " = " + validator + ".exec(" +
        v + ", " +
        hasLeapYear + ", " +
        hasLeapSecond + ")" +
      ")";

    if (def.$empty === true)
      cond = v + " && " + cond;

    c.failIf(cond, vErr);
    return v;
  }
});
exmodel.addType(new DateTimeType());

// ============================================================================
// [SchemaType - Object]
// ============================================================================

function addKeyToGroup(map, group, k) {
  if (group.indexOf("|") !== -1) {
    var array = group.split("|");
    for (var i = 0, len = array.length; i < len; i++) {
      group = array[i];
      if (!hasOwn.call(map, group))
        map[group] = [k];
      else
        map[group].push(k);
    }
  }
  else {
    if (!hasOwn.call(map, group))
      map[group] = [k];
    else
      map[group].push(k);
  }
}

var ObjectType = exclass({
  $extend: BaseType,

  name: ["object"],
  type: "object",

  hook: function(def, env, args) {
    var rules = env.rules;

    // Apply rules.
    for (var k in rules) {
      var rule = rules[k];
      rule.hook(def, env);
    }

    // Expand object directives (this has to be done after hooks as any hook
    // can add a property, for example, which should still be expanded).
    var properties = def.$data;

    var uniqueMap = [];
    var uniqueArray = [];
    var uniqueGroup = {};

    var groupMap = {};
    var pkMap = {};
    var fkMap = {};
    var idMap = {};

    for (var k in properties) {
      var property = properties[k];

      // Handle '$pk' directive.
      if (property.$pk) {
        pkMap[k] = true;
        idMap[k] = true;
        // All primary keys combined should form a unique group.
        addKeyToGroup(uniqueGroup, "$pk", k);
      }

      // Handle '$fk' directive.
      if (property.$fk) {
        fkMap[k] = property.$fk;
        idMap[k] = true;
      }

      // Handle '$g' directive.
      var g = property.$g;
      if (g)
        addKeyToGroup(groupMap, String(g), k);

      // Handle '$unique' directive.
      var unique = property.$unique;
      if (unique) {
        if (unique === true) {
          var set = [k];
          uniqueArray.push(set);
          uniqueMap.push(arrayToSet(set));
        }
        else {
          addKeyToGroup(uniqueGroup, String(unique), k);
        }
      }
    }

    // Post-process unique groups and eliminate all combinations that are stored
    // multiple times.
    var uniqueSignatures = {};
    for (var k in uniqueGroup) {
      var array = uniqueGroup[k];
      array.sort();

      var signature = array.join("|");
      if (hasOwn.call(uniqueSignatures, signature))
        continue;

      uniqueArray.push(array);
      uniqueMap.push(arrayToSet(array));
      uniqueSignatures[signature] = true;
    }

    def.$pkMap       = freezeOrNoObject(pkMap);
    def.$pkArray     = freezeOrNoArray(setToArray(pkMap));
    def.$fkMap       = freezeOrNoObject(fkMap);
    def.$fkArray     = freezeOrNoArray(setToArray(fkMap));
    def.$idMap       = freezeOrNoObject(idMap);
    def.$idArray     = freezeOrNoArray(setToArray(idMap));
    def.$groupMap    = freezeOrNoObject(groupMap);
    def.$uniqueArray = freezeOrNoArray(uniqueArray);
    def.$uniqueMap   = freezeOrNoObject(uniqueMap);
  },

  compileType: function(c, vOut, v, def) {
    c.otherwise();

    var vLen = "";
    var properties = def.$data;
    var mandatoryProperties = [];
    var optionalProperties = [];

    var eKey, eDef, eMangledType;
    var eIn, eOut;

    var i;
    var prop;

    var path = c.getPath();
    var delta = c.getDelta();
    var extract = c.setExtract(c.hasOption(kExtractNested));

    if (delta === true && def.$delta === false)
      c.setDelta(false);

    // Collect information regarding mandatory and optional keys.
    for (eKey in properties) {
      eDef = properties[eKey];

      if (eDef == null || typeof eDef !== "object")
        throwRuntimeError("Invalid property, expected object, got " + typeOf(eDef) + ".");

      var optional = !!eDef.$optional;

      // Make the property optional when using delta-mode.
      if (!optional && c.getDelta()) {
        optional = true;
      }

      if (optional)
        optionalProperties.push(eKey);
      else
        mandatoryProperties.push(eKey);
    }

    // If the extraction mode is off we have to make sure that there are no
    // properties in the source object that are not defined by the schema.
    if (!extract) {
      vLen = c.addLocal("nKeys");
      c.emit(vLen + " = " + mandatoryProperties.length + ";");
    }

    if (mandatoryProperties.length) {
      var mandatoryVars = [];

      for (i = 0; i < mandatoryProperties.length; i++) {
        eKey = mandatoryProperties[i];
        eDef = properties[eKey];
        prop = getObjectProperty(eKey);

        var isUnsafeProperty = UnsafeProperties.indexOf(eKey) !== -1;
        var isDefaultProperty = eDef.$default !== undefined;

        if (isUnsafeProperty || isDefaultProperty)
          c.declareGlobal("hasOwn", "Object.prototype.hasOwnProperty");

        c.addPath('"."', c.str(eKey));

        eMangledType = c.mangledType(eDef);
        eIn = c.addLocal("in$" + eKey, eMangledType);

        if (isUnsafeProperty || isDefaultProperty)
          c.emit("if (hasOwn.call(" + v + ", " + c.str(eKey) + ")) {");

        c.emit(eIn + " = " + v + prop + ";");
        eOut = c.compileType(eIn, eDef);
        mandatoryVars.push(eOut);

        if (isUnsafeProperty || isDefaultProperty) {
          c.emit("}");
          c.emit("else {");

          if (isDefaultProperty) {
            c.emit(eOut + " = " + JSON.stringify(eDef.$default) + ";");
            // Default property doesn't count.
            if (!extract)
              c.emit(vLen + "--;");
          }
          else {
            c.emitError(c.error(c.str("RequiredField")));
          }

          c.emit("}");
        }

        c.nl();
        c.setPath(path);
        c.done();
      }

      if (!c.hasOption(kTestOnly)) {
        c.emit(vOut + " = {");
        for (i = 0; i < mandatoryProperties.length; i++) {
          eKey = mandatoryProperties[i];
          eOut = mandatoryVars[i];

          c.emit(c.str(eKey) + ": " + eOut + (i + 1 < mandatoryProperties.length ? "," : ""));
        }
        c.emit("};");
      }
    }
    else {
      if (!c.hasOption(kTestOnly)) {
        c.emit(vOut + " = {};");
      }
    }

    if (optionalProperties.length) {
      for (i = 0; i < optionalProperties.length; i++) {
        eKey = optionalProperties[i];
        eDef = properties[eKey];
        prop = getObjectProperty(eKey);

        c.nl();

        c.declareGlobal("hasOwn", "Object.prototype.hasOwnProperty");
        c.emit("if (hasOwn.call(" + v + ", " + c.str(eKey) + ")) {");

        eMangledType = c.mangledType(eDef);
        eIn = c.addLocal("in$" + eKey, eMangledType);

        if (!extract)
          c.emit(vLen + "++;");

        c.emit(eIn + " = " + v + prop + ";");
        c.addPath('"."', c.str(eKey));
        eOut = c.compileType(eIn, eDef);
        c.setPath(path);

        if (!c.hasOption(kTestOnly))
          c.emit(vOut + prop + " = " + eOut + ";");

        c.emit("}");
        c.done();
      }
    }

    if (!extract) {
      c.declareVariable("dummy");
      c.nl();

      if (kTuneUseObjectKeysAsCount) {
        c.emit("if (Object.keys(" + v + ").length !== " + vLen + ") {");
      }
      else {
        c.emit("for (dummy in " + v + ") " + vLen + "--;");
        c.nl();
        c.emit("if (" + vLen + " !== 0) {");
      }

      if (c.hasOption(kTestOnly)) {
        c.emit("return false;");
      }
      else {
        var fn = c.declareData("extractionFailed", this.extractionFailed);
        c.emitError(fn + "(" + vOut + ", " + v + ", " + c.getPath() + ")");
      }

      c.emit("}");
    }

    c.end();

    c.setExtract(extract);
    c.setDelta(delta);

    return vOut;
  },

  // Called from compiled code to generate a list containing all invalid properties.
  extractionFailed: function(dst, src, path) {
    var keys = [];

    for (var k in src)
      if (!hasOwn.call(dst, k))
        keys.push(k);

    return {
      code: "InvalidProperties",
      path: path,
      keys: keys
    };
  }
});
exmodel.addType(new ObjectType());

// ============================================================================
// [SchemaType - Map]
// ============================================================================

var MapType = exclass({
  $extend: BaseType,

  name: ["map"],
  type: "object",

  compileType: function(c, vOut, v, def) {
    var vKey = c.addLocal("key", "s");

    var eDef = def.$data;
    if (eDef == null || typeof eDef !== "object")
      throwRuntimeError("Invalid MapType.$data definition, expected object, got " + typeOf(eDef) + ".");

    var eMangledType = c.mangledType(eDef);
    var eIn = c.addLocal("element", eMangledType);

    c.otherwise();

    if (!c.hasOption(kTestOnly))
      c.emit(vOut + " = {};");

    c.emit("for (" + vKey + " in " + v + ") {");
    c.emit(eIn + " = " + v + "[" + vKey + "];");

    var prevPath = c.addPath("", '"[" + ' + vKey + ' + "]"');
    var eOut = c.compileType(eIn, eDef);

    if (!c.hasOption(kTestOnly))
      c.emit(vOut + "[" + vKey + "] = " + eOut + ";");

    c.emit("}");
    c.setPath(prevPath);

    c.end();
    return vOut;
  }
});
exmodel.addType(new MapType());

// ============================================================================
// [SchemaType - Array]
// ============================================================================

var ArrayType = exclass({
  $extend: BaseType,

  name: ["array"],
  type: "array",

  compileType: function(c, vOut, v, def) {
    var vIdx = c.addLocal("i", "x");
    var vLen = c.addLocal("len", "x");

    c.otherwise();
    c.emit(vLen + " = " + v + ".length;");

    if (!c.hasOption(kTestOnly))
      c.emit(vOut + " = [];");

    var cond = [];
    if (def.$length != null)
      cond.push(vLen + " !== " + def.$length);

    if (def.$minLength != null)
      cond.push(vLen + " < " + def.$minLength);

    if (def.$maxLength != null)
      cond.push(vLen + " > " + def.$maxLength);

    if (cond.length) {
      c.failIf(cond.join(" || "),
        c.error(c.str("InvalidLength")));
      c.otherwise();
    }

    c.nl();
    c.emit("for (" + vIdx + " = 0; " + vIdx + " < " + vLen + "; " + vIdx + "++) {");

    var eDef = def.$data;
    if (eDef == null || typeof eDef !== "object")
      throwRuntimeError("Invalid ArrayType.$data definition, expected object, got " + typeOf(eDef) + ".");

    var eMangledType = c.mangledType(eDef);
    var eIn = c.addLocal("element", eMangledType);

    c.emit(eIn + " = " + v + "[" + vIdx + "];");

    var prevPath = c.addPath("", '"[" + ' + vIdx + ' + "]"');
    var eOut = c.compileType(eIn, eDef);

    if (!c.hasOption(kTestOnly))
      c.emit(vOut + ".push(" + eOut + ");");

    c.emit("}");
    c.setPath(prevPath);

    if (cond.length) {
      c.end();
    }

    c.end();
    return vOut;
  }
});
exmodel.addType(new ArrayType());

// ============================================================================
// [Exports]
// ============================================================================

$export[$as] = exmodel.freeze();

}).apply(this, typeof module === "object"
  ? [require("exclass"), module, "exports"]
  : [this.exclass, this, "exmodel"]);
