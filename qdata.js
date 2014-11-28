// QData <https://github.com/jshq/qdata>
(function(qclass, $export, $as) {
"use strict";

// ============================================================================
// [QData]
// ============================================================================

// \namespace qdata
var qdata = {};

// ============================================================================
// [Constants]
// ============================================================================

// `qdata.VERSION`
//
// Version information in a "major.minor.patch" form.
qdata.VERSION = "0.1.0";

// `qdata.kExtractTopFields`
//
// Extract top fields from the source object.
//
// This option is used in case that you have a top level object that contains
// keys/values and you want to extract everything matching your schema out of
// it. Only keys defined in the schema are considered, others ignored silently.
//
// NOTE: This option can be combined with `kExtractAllFields`, in such case the
// latter has priority.
var kExtractTopFields = qdata.kExtractTopFields = 0x0001;

// `qdata.kExtractAllFields`
//
// Extract all fields from any source object.
//
// This is like `kExtractTopFields`, but it takes effect for any object, top
// level or nested. This option can be efficiently used to filter properties
// from source objects into properties defined by the schema.
var kExtractAllFields = qdata.kExtractAllFields = 0x0002;

// `qdata.kAccumulateErrors`
//
// Accumulate all errors instead of bailing out on the first failure.
//
// When this option is used the error object thrown in case of one or more
// error will always contain `errors` array that is populated by all errors
// found. This option is useful in cases that you want to see all problems
// of the input data - for example you want to highlight fields that are
// wrong on the client or perform an additional processing/fixing.
var kAccumulateErrors = qdata.kAccumulateErrors = 0x0004;

// Min/Max safe integer limits - 53 bits.
var kIntMin = qdata.kIntMin = -9007199254740992;
var kIntMax = qdata.kIntMax =  9007199254740992;

// Min/Max year that can be used in date/datetime.
var kYearMin = qdata.kYearMin = 1;
var kYearMax = qdata.kYearMax = 9999;

// ============================================================================
// [Internals]
// ============================================================================

// \internal
//
// Link to `Array.isArray`
var isArray = Array.isArray;

// \internal
//
// Link to `Object.prototype.hasOwnProperty`.
var hasOwnProperty = Object.prototype.hasOwnProperty;

// \internal
//
// Reserved properties of Object's instances that can't be used as dictionary
// keys.
var reservedProperties = [
  "__proto__", "__count__"
];

// \internal
//
// Find a new line \n.
var reNewLine = /\n/g;

// \internal
//
// Used to sanity an identifier.
var reIdentifier = /[^A-Za-z0-9_\$]/g;

// \internal
//
// Test if the given key is a qdata property "$" or "$...".
var reFieldIsProperty = /^\$(?:[^\$]|$)/;

// \internal
//
// Test if the given key is an optional type "...?".
var reFieldIsOptional = /\?$/;

// \internal
//
// Test if the given key is an array type "...[]".
var reFieldIsArray = /\[\]$/;

// \internal
//
// Escapre a string `s` so it can be used in regexp to match it.
function escapeRegExp(s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// ============================================================================
// [Regular Expressions]
// ============================================================================

var qdata_re = qdata.re = {
  // Tests whether a string contains the following character(s):
  //   - [00] NUL Null
  //   - [01] SOH Start of Heading
  //   - [02] STX Start of Text
  //   - [03] ETX End of Text
  //   - [04] EOT End of Transmission
  //   - [05] ENQ Enquiry
  //   - [06] ACK Acknowledge
  //   - [07] BEL Bell
  //   - [08] BS  Back Space
  //   - [0B] VT  Vertical Tab
  //   - [0C] FF  Form Feed
  //   - [0E] SO  Shift Out
  //   - [0F] SI  Shift In
  //   - [10] DLE Data Line Escape
  //   - [11] DC1 Device Control 1
  //   - [12] DC2 Device Control 2
  //   - [13] DC3 Device Control 3
  //   - [14] DC4 Device Control 4
  //   - [15] NAK Negative Acknowledge
  //   - [16] SYN Synchronous Idle
  //   - [17] ETB End of Transmit Block
  //   - [18] CAN Cancel
  //   - [19] EM  End of Medium
  //   - [1A] SUB Substitute
  //   - [1B] ESC Escape
  //   - [1C] FS  File Separator
  //   - [1D] GS  Group Separator
  //   - [1E] RS  Record Separator
  //   - [1F] US  Unit Separator
  text: /[\x00-\x08\x0B-\x0C\x0E-\x1F]/
};

// ============================================================================
// [Errors]
// ============================================================================

// \class RuntimeError
//
// Error thrown in case that `qdata` has been misused.
function RuntimeError(message) {
  var e = Error.call(this, message);

  this.name = "RuntimeError";
  this.message = message;
  this.stack = e.stack || "";
}
qdata.RuntimeError = qclass({
  $extend: Error,
  $construct: RuntimeError
});

// \class SchemaError
//
// Error thrown in case of validation failure.
//
// The SchemaError is used in general in two ways:
//
//   1. `data` is an object - in this case the schema validator was configured
//      to out after the first error that have happened, and the `data` object
//      contains the error details. Data will be stored as an array having one
//      element that is the `data` argument to make the interface compatible
//      with `data` containing an array of errors.
//
//   2. `data` is an array - in this case the schema validator was configured
//      to accumulate all errors (by using `kAccumulateErrors` option).
//
// A single error entry contains the following properties:
//
//   "code": String - Code of the error (not a message).
//   "path": String - Path to the error (dot is used to separate nested fields).
//
// Each error can also contain any other properties that are specific to the
// type or rule.
function SchemaError(details) {
  var e = Error.call(this);

  if (!isArray(details))
    details = [details];

  this.name = "SchemaError";
  this.message = "Data processing failed.";
  this.stack = e.stack || "";

  this.details = details;
}
qdata.SchemaError = qclass({
  $extend: Error,
  $construct: SchemaError
});

// ============================================================================
// [Core Utilities]
// ============================================================================

// \function `qdata.typeOf(val)`
//
// Get extended type of the object.
function typeOf(val) {
  var type = typeof val;
  if (type !== "object")
    return type;

  if (val === null)
    return "null";

  if (isArray(val))
    return "array";

  return "object";
}
qdata.typeOf = typeOf;

function copyObject(obj) {
  var dst = {};
  for (var k in obj)
    dst[k] = obj[k];
  return dst;
}

function _deepCopy(obj) {
  if (isArray(obj)) {
    var dstArr = [];
    var srcArr = obj;

    for (var i = 0, len = srcArr.length; i < len; i++) {
      var child = srcArr[i];
      dstArr.push((!child || typeof child !== "object") ? child : _deepCopy(child));
    }

    return dstArr;
  }
  else {
    var dstObj = {};
    var srcObj = obj;

    for (var k in srcObj) {
      var element = srcObj[k];
      dstObj[k] = (!element || typeof element !== "object") ? element : _deepCopy(element);
    }

    return dstObj;
  }
}

function deepCopy(value) {
  return (!value || typeof value !== "object") ? value : _deepCopy(value);
}
qdata.deepCopy = deepCopy;

// \internal
function _deepEqual(a, b, buffer) {
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
        throw new RuntimeError("Detected cyclic references.");
    }

    buffer.push(a);
    buffer.push(b);

    for (var i = 0; i < aLen; i++) {
      aValue = a[i];
      bValue = b[i];

      if (aValue === bValue)
        continue;

      if (!_deepEqual(aValue, bValue, buffer))
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
        throw new RuntimeError("Detected cyclic references.");
    }

    buffer.push(a);
    buffer.push(b);

    for (k in a) {
      if (!hasOwnProperty.call(a, k))
        continue;

      if (!hasOwnProperty.call(b, k))
        return false;
    }

    for (k in b) {
      if (!hasOwnProperty.call(b, k))
        continue;

      if (!hasOwnProperty.call(a, k))
        return false;

      aValue = a[k];
      bValue = b[k];

      if (aValue === bValue)
        continue;

      if (!_deepEqual(aValue, bValue, buffer))
        return false;
    }

    buffer.pop();
    buffer.pop();

    return true;
  }
}

// \function `qdata.deepEqual(a, b)`
//
// Get whether the values `a` and `b` are deep equal.
function deepEqual(a, b) {
  return (a === b) ? true : _deepEqual(a, b, []);
}
qdata.deepEqual = deepEqual;

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

// ============================================================================
// [SimpleCompiler]
// ============================================================================

// \class `qdata.SimpleCompiler`
//
// Base class used for compiling JS code. The reason there is `SimpleCompiler`
// and not just `SchemaCompiler` is that `SimpleCompiler` is used by other
// functions to compile much simpler JS code, like code for date parsing.
//
// SimpleCompiler has been designed as a lightweight class that can be used to
// serialize JS code into one string, by providing an interface for indentation
// and declaring local variables at the beginning of the function.
//
// The following snippet demonstrates the desired functionality:
//
// ```
// var c = new SimpleCompiler();
//
// c.arg("array");
// c.declareVariable("i", "0");
// c.declareVariable("len", "array.length");
//
// c.emit("do {");
// c.declareVariable("element");
// c.emit("element = array[i]");
// c.emit("...");
// c.emit("} while (++i < len);";
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
//     do {
//       element = array[i];
//       ...
//     } while (++i < len);
//   }
// }
// ```
//
// The function above is a boilerplate that is needed to pass custom data to
// the generated function and the function that contains the body constructed
// by using `emit()` and others to emit JS code. Passing data is easy through
// `data(data)` method or more high level `declareData(name, data)` method.
function SimpleCompiler() {
  this._debug = false;        // Whether to output debug code and comments.
  this._indentation = "  ";   // Indentation, see `indent()` and `deindent()`.

  this._args = [];            // Function arguments;
  this._body = "";            // Function body.

  this._locals = {};          // Local variables and initialization code.
  this._globals = {};         // Global variables and initialization code.
  this._uniqueName = 0;       // Unique variable names generator.

  this._data = [];            // Data that is passed to outer function.
  this._dataName = "$$_data"; // Reserved name for outer data argument.
  this._dataToVar = {};       // Mapping of global data index and variables.
}
qclass({
  $construct: SimpleCompiler,

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

    if (name)
      name = name.replace(reIdentifier, "_");
    else
      name = this._makeUniqueName();

    exp = exp || "";
    if (hasOwnProperty.call(locals, name)) {
      if (locals[name] !== exp)
        throw new RuntimeError("Can't redeclare local variable '" + name + "' with different initialization '" + exp + "'");
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
  // that can reference objects outside. For example you can add `qdata` global
  // and reference it inside the generated function.
  declareGlobal: function(name, exp) {
    var globals = this._globals;

    if (name)
      name = name.replace(reIdentifier, "_");
    else
      name = this._makeUniqueName();

    exp = exp || "";
    if (hasOwnProperty.call(globals, name)) {
      if (globals[name] !== exp)
        throw new RuntimeError("Can't redeclare global variable '" + name + "' with different initialization '" + exp + "'");
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
      if (hasOwnProperty.call(map, exp))
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

    // Automatically deindent if the first character is '}'.
    if (code.charAt(0) === "}")
      this.deindent();

    this._body += this.applyIndentation(code);

    // Automatically indent if the last character is '{'.
    if (code.charAt(code.length - 1) === "{")
      this.indent();

    return this;
  },

  // Emit newline delimiter `\n`.
  emitNewLine: function() {
    this._body += "\n";
    return this;
  },

  // Emit comment with current indentation applied if debugging is enabled.
  emitComment: function(s) {
    if (this._debug)
      this._body += this.applyIndentation("// " + s.replace("\n", "\n// "));
    return this;
  },

  str: function(s) {
    return JSON.stringify(s);
  },

  indent: function() {
    this._indentation += "  ";
    return this;
  },

  deindent: function() {
    var s = this._indentation;
    this._indentation = s.substr(0, s.length - 2);
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
    var body, fn;

    try {
      body = this.serialize();
      fn = new Function(this._dataName, body);

      return fn(this._data);
    }
    catch (ex) {
      console.log(body);
      console.log(ex);
      throw new RuntimeError("Invalid code generated", {
        body   : body,
        message: ex.message
      });
    }
  }
});

// ============================================================================
// [SchemaCompiler]
// ============================================================================

// \class `qdata.SchemaCompiler`
function SchemaCompiler(env, options) {
  SimpleCompiler.call(this);

  this._env = env;          // Schema environment (`qdata` or customized).
  this._options = options;  // Schema validation options.

  this._nestedLevel = 0;    // Level of the current scope.
  this._ifLevel = 0;        // Count of IFs in the current scope.
  this._sectionLevel = 0;   // Section level.

  this._path = "\"\"";      // Path to the current scope (code).
  this._stack = [];         // Used to save state of the previous scope.
}
qclass({
  $extend: SimpleCompiler,
  $construct: SchemaCompiler,

  compileFunc: function(def) {
    this.arg("input");

    this.declareData("qdata", this._env);
    this.declareGlobal("SchemaError", "qdata.SchemaError");
    this.declareVariable("err", "null");

    if (this.hasOption(kAccumulateErrors)) {
      this.declareVariable("details", "[]");
    }

    var vIn = "input";
    var vOut = this.compileType(vIn, def);

    this.emitNewLine();

    if (this.hasOption(kAccumulateErrors)) {
      this.emit(
        "if (details.length !== 0)\n" +
        "  throw new SchemaError(details);\n" +
        "\n"
      );
    }

    this.emit("return " + vOut + ";");
    return this.toFunction();
  },

  compileType: function(vIn, def) {
    var type = def.$type || "object";
    var handler = this._env.getType(type);

    if (!handler)
      throw new RuntimeError("Couldn't find handler for type " + type + ".");

    var vOut = handler.compile(this, vIn, def);

    this.emitNewLine();
    this.emit("if (err !== null) {");
    this.emit("err.path = " + this.path() + ";");

    if (this.hasOption(kAccumulateErrors)) {
      this.emit("details.push(err);");
      this.emit("err = null;");
    }
    else {
      this.emit("throw new SchemaError(err);");
    }

    this.emit("}");
    return vOut;
  },

  hasOption: function(option) {
    return (this._options & option ) !== 0;
  },

  // Handle a case at least `def.$null` or `def.$undefined` is `true`. It emits
  // code that handles `null` or `undefined` value, so the flow won't continue.
  //
  // NOTE: If both `$null` and `$undefined` are false this code does nothing.
  emitNullOrUndefinedCheck: function(def, vOut, vIn) {
    if (def.$null && def.$undefined)
      this.passIf(vIn + " == null", vOut, vIn);
    else if (def.$null)
      this.passIf(vIn + " === null", vOut, vIn);
    else if (def.$undefined)
      this.passIf(vIn + " === undefined", vOut, vIn);

    return this;
  },

  emitStringTypeCheck: function(def, v) {
    this.failIf("typeof " + v + " !== \"string\"",
      this.error(this.str("StringCheckFailure")));

    if (def.$length != null)
      this.failIf(v + ".length !== " + def.$length,
        this.error(this.str("InvalidLength")));

    if (def.$minLength != null && def.$maxLength == null)
      this.failIf(v + ".length < " + def.$minLength,
        this.error(this.str("InvalidLength")));

    if (def.$minLength == null && def.$maxLength != null)
      this.failIf(v + ".length > " + def.$maxLength,
        this.error(this.str("InvalidLength")));

    if (def.$minLength != null && def.$maxLength != null)
      this.failIf(v + ".length < " + def.$minLength + " || " + v + " > " + def.$maxLength,
        this.error(this.str("InvalidLength")));

    return this;
  },

  emitRangeConditionCheck: function(def, v, minValue, maxValue) {
    var min = def.$gt != null ? def.$gt : null;
    var max = def.$lt != null ? def.$lt : null;;

    var minEq = false;
    var maxEq = false;

    // Handle $gt, $ge, and $min.
    if (def.$ge != null && (min === null || min <= def.$ge)) {
      min = def.$ge;
      minEq = true;
    }

    if (def.$min != null && (min === null || min <= def.$min)) {
      min = def.$min;
      minEq = true;
    }

    if (minValue != null && (min === null || min <= minValue)) {
      min = minValue;
      minEq = true;
    }

    // Handle $lt, $le, and $max.
    if (def.$le != null && (max === null || max >= def.$le)) {
      max = def.$le;
      maxEq = true;
    }

    if (def.$max != null && (max === null || max >= def.$max)) {
      max = def.$max;
      maxEq = true;
    }

    if (maxValue != null && (max === null || max >= maxValue)) {
      max = maxValue;
      maxEq = true;
    }

    // Emit.
    var cond = [];
    if (min !== null)
      cond.push(v + (minEq ? " >= " : " > ") + min);

    if (max !== null)
      cond.push(v + (maxEq ? " <= " : " < ") + max);

    if (cond.length > 0)
      this.failIf("!(" + cond.join(" && ") + ")",
        this.error(this.str("OutOfRange")));

    return this;
  },

  addLocal: function(name, mangledTypeName) {
    return this.declareVariable("_" + this._nestedLevel + (mangledTypeName || "") + "_" + name);
  },

  // Get a type-prefix of type defined by `def`.
  mangledType: function(def) {
    var env = this._env;
    var type = "o";

    if (typeof def.$type === "string") {
      var typeInfo = env.getType(def.$type);
      if (typeInfo)
        type = typeInfo.mangle;
    }

    return type;
  },

  emitIf: function(cond, body) {
    var ifKeyword = (++this._ifLevel === 1) ? "if" : "else if";

    this.emit(ifKeyword + " (" + cond + ") {");
    this.emit(body);
    this.emit("}");

    return this;
  },

  passIf: function(cond, vOut, vIn) {
    if (vOut === vIn)
      return this.emitIf(cond, "// PASS.");
    else
      return this.emitIf(cond, vOut + " = " + vIn + ";");
  },

  failIf: function(cond, code) {
    if (code !== "err")
      code = "err = " + code + ";";
    else
      code = "// FAIL.";

    return this.emitIf(cond, code);
  },

  setPath: function(path) {
    var oldPath = this._path;
    this._path = path;
    return oldPath;
  },

  addPath: function(sep, code) {
    var p = this._path;
    if (p !== '""' && sep)
      p = mergePath(p, sep);
    return this.setPath(mergePath(p, code));
  },

  path: function() {
    return this._path;
  },

  error: function(objectOrCode) {
    if (typeof objectOrCode === "object")
      return JSON.stringify(objectOrCode);
    else
      return "{ \"code\": " + objectOrCode + " }";
  },

  beginSection: function() {
    this.emit(this._ifLevel === 0 ? "if (1) {" : "else {");
    this._ifLevel = 0;
    this._sectionLevel++;
    return this;
  },

  endSection: function() {
    if (--this._sectionLevel < 0)
      throw new RuntimeError("Invalid call to endSection(), there are no more sections.");

    this.emit("}");
    this._ifLevel = 0;

    return this;
  },

  done: function() {
    this._ifLevel = 0;
    return this;
  },

  // Begin nesting of the current object/array.
  nest: function() {
    this._stack.push({
      ifLevel: this._ifLevel
    });

    this._ifLevel = 0;
    this._nestedLevel++;

    return this;
  },

  // End nesting of the current object/array.
  denest: function() {
    var state = this._stack.pop();

    this._ifLevel = state.ifLevel;
    this._nestedLevel--;

    return this;
  }
});

// ============================================================================
// [Date Utilities]
// ============================================================================

// \namespace `qdata.date`
var qdata_date = qdata.date = {};

// Days in a month, leap years have to be handled separately.
var daysInMonth = [
  31, // January.
  28, // February.
  31, // March.
  30, // April.
  31, // May.
  30, // June.
  31, // July.
  31, // August.
  30, // September.
  31, // October.
  30, // November.
  31  // December.
];

// Leap seconds data.
//
// Every year has it's own data that is stored in a single number in a form 0xXY,
// where X represents a leap second in June-30 and Y represents Dec-31.
var leapSecondDates = {
  start: 1972,
  array: [
    0x11, // 1972.
    0x01, // 1973.
    0x01, // 1974.
    0x01, // 1975.
    0x01, // 1976.
    0x01, // 1977.
    0x01, // 1978.
    0x01, // 1979.
    0x00, // 1980.
    0x10, // 1981.
    0x10, // 1982.
    0x10, // 1983.
    0x00, // 1984.
    0x10, // 1985.
    0x00, // 1986.
    0x01, // 1987.
    0x00, // 1988.
    0x01, // 1989.
    0x01, // 1990.
    0x00, // 1991.
    0x10, // 1992.
    0x10, // 1993.
    0x10, // 1994.
    0x01, // 1995.
    0x00, // 1996.
    0x10, // 1997.
    0x01, // 1998.
    0x00, // 1999.
    0x00, // 2000.
    0x00, // 2001.
    0x00, // 2002.
    0x00, // 2003.
    0x00, // 2004.
    0x01, // 2005.
    0x00, // 2006.
    0x00, // 2007.
    0x01, // 2008.
    0x00, // 2009.
    0x00, // 2010.
    0x00, // 2011.
    0x10, // 2012.
    0x00, // 2013.
    0x00  // 2014.
  ]
};
qdata_date.leapSecondDates = leapSecondDates;

// \function `data.date.isLeapYear(year)`
//
// Get whether the `year` is a leap year (ie it has 29th February).
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
qdata_date.isLeapYear = isLeapYear;

// \function `data.date.hasLeapSecond(year, month, day)`
//
// Get whether a date defined by `year`, `month`, and `day` has a leap second.
// Please note that it's impossible to guess leap second in the future. This
// function is mainly included to validate whether a date that has already
// passed or is in a near future has a leap second defined.
function isLeapSecondDate(year, month, date) {
  var mask = 0x00;

  if (month === 6 && date === 30)
    mask = 0x10;
  else if (month === 12 && date === 31)
    mask = 0x01;
  else
    return false;

  var data = leapSecondDates;
  var start = data.start;
  var array = data.array;

  var index = year - start;
  if (index < 0 || index >= array.length)
    return 0;

  return (array[index] & mask) !== 0;
}
qdata_date.isLeapSecondDate = isLeapSecondDate;

// \internal
//
// Date format (like YYYY-MM-DD) to a parser function, which returns an object
// having `year`, `month`, `date`, `hour`, `minute`, `second`, and `ms` or `us`.
var dateCache = {};

// \internal
var dateParts = {
  Y     : { re: "\\d+"  , len: 0, mask: 0x01 },
  YY    : { re: "\\d{2}", len: 2, mask: 0x01 },
  YYYY  : { re: "\\d{4}", len: 4, mask: 0x01 },
  M     : { re: "\\d+"  , len: 0, mask: 0x02 },
  MM    : { re: "\\d{2}", len: 2, mask: 0x02 },
  D     : { re: "\\d+"  , len: 0, mask: 0x04 },
  DD    : { re: "\\d{2}", len: 2, mask: 0x04 },
  H     : { re: "\\d+"  , len: 0, mask: 0x08 },
  HH    : { re: "\\d{2}", len: 2, mask: 0x08 },
  m     : { re: "\\d+"  , len: 0, mask: 0x10 },
  mm    : { re: "\\d{2}", len: 2, mask: 0x10 },
  s     : { re: "\\d+"  , len: 0, mask: 0x20 },
  ss    : { re: "\\d{2}", len: 2, mask: 0x20 },
  S     : { re: "\\d{1}", len: 1, mask: 0x40 },
  SS    : { re: "\\d{2}", len: 2, mask: 0x40 },
  SSS   : { re: "\\d{3}", len: 3, mask: 0x40 },
  SSSSSS: { re: "\\d{6}", len: 6, mask: 0x40 }
};

// \internal
//
// Get whether the given charcode is a date component (ie it can be parsed as
// year, month, date, etc...). Please note that not all alphanumeric characters
// are considered as date components.
function isDateComponent(c) {
  return (c === 0x59) | // 'Y' - Year.
         (c === 0x4D) | // 'M' - Month.
         (c === 0x44) | // 'D' - Day.
         (c === 0x48) | // 'H' - Hour.
         (c === 0x6D) | // 'm' - Minute.
         (c === 0x73) | // 's' - Second.
         (c === 0x53) ; // 'S' - Fractions of second.
}

// \internal
//
// Perform analysis on a date `form`. If the form is valid and non-ambiguous it
// returns an object, which contains:
//
//   'Y', 'M', 'D', 'H', 'm', 's', 'S' - Information about date components
//     parsed in a form of object.
//
//   'parts' - Date components and separators.
//
//   'allFixed' - All date components have fixed length (0 or 1).
function analyzeDateFormat(form) {
  var i = 0;
  var len = form.length;

  // Parsed date components and separators, for example "YYYY-MM-DD" string
  // would be split into ["YYYY", "-", "MM", "-", "DD"] components.
  var parts = [];
  do {
    var start = i;
    var c = form.charCodeAt(i);

    if (isDateComponent(c)) {
      // Merge component chars, like "Y", "YY", "YYYY".
      while (++i < len && form.charCodeAt(i) === c)
        continue;
    }
    else {
      // Parse anything that is not a date component.
      while (++i < len && !isDateComponent(form.charCodeAt(i)))
        continue;
    }

    parts.push(form.substring(start, i));
  } while (i < len);

  var allFixed = 1;   // All components have fixed length.
  var mask = 0|0;     // Mask of parsed components.
  var sep = false;    // Whether the current/next component has to be a separator.

  var matchIndex = 1; // Component/Part match index, used when `allFixed` is 0.
  var strIndex = 0;   // Component/Part string index, used when `allFixed` is 1.

  var obj = {
    parts: null,
    allFixed: 0
  };

  for (i = 0, len = parts.length; i < len; i++) {
    var part = parts[i];

    if (hasOwnProperty.call(dateParts, part)) {
      // Fail if one component appears multiple times or if the separator is
      // required at this point.
      if (obj[part.charAt(0)] || sep)
        throw new RuntimeError("Detected an invalid date form '" + form + "'.");

      var data = dateParts[part];

      // Mark this component as parsed so it won't repeat. Only the first
      // character is used as it prevents "Y" and "YY" to appear in one form,
      // for example.
      obj[part.charAt(0)] = {
        part      : part,
        matchIndex: matchIndex,
        strIndex  : strIndex,
        strLen    : data.len
      };

      // Require the next component to be a separator if the component doesn't
      // have a fixed length. This prevents from ambiguities and one component
      // running through another in case of "YMD" for example.
      sep = (data.len === 0);

      // Update `allFixedLength` flag in case this component doesn't have fixed
      // length as different parsing strategy is used when all components have
      // fixed length.
      allFixed &= !sep;

      mask |= data.mask;
      matchIndex++;
    }
    else {
      // Reset the separator flag and add escaped part sequence into the regexp.
      sep = false;
    }

    strIndex += part.length;
  }

  if (((mask + 1) & mask) !== 0)
    throw new RuntimeError("Detected an invalid date form '" + form + "'.");

  obj.parts = parts;
  obj.allFixed = allFixed;

  return obj;
}

function newDateRegExp(parts, capture) {
  var re = "";

  var captureBegin = capture ? "(" : "";
  var captureEnd   = capture ? ")" : "";

  for (var i = 0, len = parts.length; i < len; i++) {
    var part = parts[i];

    if (hasOwnProperty.call(dateParts, part))
      re += captureBegin + dateParts[part].re + captureEnd;
    else
      re += escapeRegExp(part);
  }

  return new RegExp("^" + re + "$");
}

function inlineParseInt(v, start, len) {
  var str = "";
  var mul = 1;

  for (var i = len - 1; i >= 0; i--) {
    str = "(" + v + ".charCodeAt(" + (start + i) + ") - 48)" +
      (mul > 1 ? " * " + mul : "") +
      (str     ? " + " + str : "") ;
    mul *= 10;
  }

  return str;
}

// \internal
//
// Generates a new date parser that is using the 'fixed' strategy. Please note
// that it compiles a function every time this is called that is compatible
// with `checkDateMatchStrategy()` and uses `this`.
function checkDateFixedStrategy(obj) {
  var c = new SimpleCompiler();

  var Y = obj.Y;
  var M = obj.M;
  var D = obj.D;
  var H = obj.H;
  var m = obj.m;
  var s = obj.s;

  c.arg("s");
  c.arg("hasLeapSecond");

  c.emit("if (this.re.test(s)) {");
  c.emit("var year = " + inlineParseInt("s", Y.strIndex, Y.strLen) + ";");
  c.emit("if (year >= " + kYearMin + ") {");

  var ok = "return null;";
  
  if (M) {
    c.emit("var month = " + inlineParseInt("s", M.strIndex, M.strLen) + ";");
    c.emit("if (month >= 1 && month <= 12) {");

    if (D) {
      c.declareData("daysInMonth", daysInMonth);
      c.declareData("isLeapYear", isLeapYear);

      c.emit("var date = " + inlineParseInt("s", D.strIndex, D.strLen) + ";");
      c.emit("var maxDate = daysInMonth[month - 1];");

      c.emitNewLine();
      c.emit("if (month === 2 && date === 29) {")
        .emit("maxDate += isLeapYear(year);");
      c.emit("}");

      c.emitNewLine();
      c.emit("if (date >= 1 && date <= maxDate) {");

      if (H) {
        c.emit("var hour = " + inlineParseInt("s", H.strIndex, H.strLen) + ";");
        c.emit("if (hour <= 23) {");

        if (m) {
          c.emit("var minute = " + inlineParseInt("s", m.strIndex, m.strLen) + ";");
          c.emit("if (minute <= 59) {");

          if (s) {
            c.declareData("isLeapSecondDate", isLeapSecondDate);
            c.emit("var second = " + inlineParseInt("s", s.strIndex, s.strLen) + ";");
            c.emit("if (second <= 59 || (second === 60 && hasLeapSecond && isLeapSecondDate(year, month, date))) {")
              .emit(ok);
            c.emit("}");
          }
          else {
            c.emit(ok);
          }

          c.emit("}");
        }
        else {
          c.emit(ok);
        }

        c.emit("}");
      }
      else {
        c.emit(ok);
      }

      c.emit("}");
    }
    else {
      c.emit(ok);
    }

    c.emit("}");
  }
  else {
    c.emit(ok);
  }

  c.emit("}");
  c.emit("}");
  c.emit("return { code: \"DateCheckFailure\", form: this.form };");

  return c.toFunction();
}

// \internal
//
// Date parser that uses regular expression matches to parse the components.
// Used in case of 'match' parsing strategy. Please note that this parser
// requires `this` to be the object returned by `newDateParser` and used by
// `dateCache`.
function checkDateMatchStrategy(s, hasLeapSecond) {
  var m = this.re.exec(s);

  if (m) {
    var indexes = this.indexes;
    var n = indexes.length;

    // Parse year.
    var year = parseInt(m[indexes[0]]);
    if (year >= kYearMin && year <= kYearMax) {
      if (n === 1)
        return null;

      // Parse month.
      var month = parseInt(m[indexes[1]]);
      if (month >= 1 && month <= 12) {
        if (n === 2)
          return null;

        // Parse date and handle a possible leap year.
        var date = parseInt(m[indexes[2]]);
        var maxDate = daysInMonth[month - 1];

        if (month === 2 && date === 29)
          maxDate += isLeapYear(year);

        if (date >= 1 && date <= maxDate) {
          if (n === 3)
            return null;

          // Parse hour.
          var hour = parseInt(m[indexes[3]]);
          if (hour <= 23) {
            if (n === 4)
              return null;

            // Parse minute.
            var minute = parseInt(m[indexes[4]]);
            if (minute <= 59) {
              if (n === 5)
                return null;

              // Parse second and handle possible leap second.
              var second = parseInt(m[indexes[5]]);
              if (second <= 59 || (second === 60 && hasLeapSecond && isLeapSecondDate(year, month, date))) {
                // There is nothing special on milliseconds/microseconds.
                return null;
              }
            }
          }
        }
      }
    }
  }

  return { code: "DateCheckFailure", form: this.form };
}

// \internal
//
// Create a new date parser based on format. The new parser is an object which
// contains:
//
//   'strategy' - Strategy to use to parse the date. See 'parsing strategies'.
//
//   're' - Regular expression that validates if the input string has a correct
//     structure. In case of 'match' strategy matches are used to parse date
//     components. In case of 'fixed' strategy RegExp.test() should be used
//     to just validate an input string.
//
// Parsing strategies:
//
//   'fixed' - All date components have fixed length, use optimized parser.
//
//   'match' - One or more date component has variable length, regexp matches
//     have to be used to get individual components.
function newDateParser(form) {
  var obj = analyzeDateFormat(form);

  // Make `indexes` that are used by `checkDateMatchStrategy()`.
  var indexes = [];
  var comp;

  if ((comp = obj.Y)) indexes.push(comp.matchIndex);
  if ((comp = obj.M)) indexes.push(comp.matchIndex);
  if ((comp = obj.D)) indexes.push(comp.matchIndex);
  if ((comp = obj.H)) indexes.push(comp.matchIndex);
  if ((comp = obj.m)) indexes.push(comp.matchIndex);
  if ((comp = obj.s)) indexes.push(comp.matchIndex);
  if ((comp = obj.S)) indexes.push(comp.matchIndex);

  // Decide on strategy and assign correct `check` function.
  var strategy;
  var check;
  var re;

  if (obj.allFixed) {
    strategy = "fixed";
    check = checkDateFixedStrategy(obj);
    re = newDateRegExp(obj.parts, false);
  }
  else {
    strategy = "match";
    check = checkDateMatchStrategy;
    re = newDateRegExp(obj.parts, true);
  }

  return {
    form    : form,
    strategy: strategy,
    check   : check,
    re      : re,
    indexes : indexes
  };
}

function getDateParser(form) {
  var cache = dateCache;

  if (hasOwnProperty.call(cache, form))
    return cache[form];
  else
    return (cache[form] = newDateParser(form));
}

// ============================================================================
// [Interface - Schema Building]
// ============================================================================

// \internal
//
// Convert a possibly escaped property name `s` into an unescaped property name.
function unescapeProperty(s) {
  // If the field name starts with "$$..." then we unescape to "$...". This is
  // because "$..." is considered private, but "$$" can be used to define data
  // fields that start with "$".
  if (s.length > 1 && s.charCodeAt(0) === 36 && s.charCodeAt(1) === 36)
    return s.substr(1);
  else
    return s;
}

// \internal
//
// Process a given definition and return an object that can be used.
function unfold(def, priv) {
  // Safe defaults.
  var defType = def.$type || "object";
  var defData = def.$data;

  var defNull = false;
  var defUndefined = false;

  var obj, k;

  // If the $type ends with "?" it implies `{ $null: true }` definition.
  if (reFieldIsOptional.test(defType)) {
    defType = defType.substr(0, defType.length - 1);
    defNull = true;
  }

  // If the $type ends with "[]" it implies `{ $type: "array", $data: ... }`.
  // In this case all definitions specified in `def` are related to the array
  // data, not the array itself.
  if (reFieldIsArray.test(defType)) {
    var nested = copyObject(def);
    nested.$type = defType.substr(0, defType.length - 2);

    obj = {
      $type     : "array",
      $data     : unfold.call(this, nested, null),
      $null     : defNull,
      $undefined: false,
      $_private : priv
    };
  }
  else {
    if (typeof def.$null === "boolean")
      defNull = def.$null;

    if (typeof def.$undefined === "boolean")
      defUndefined = def.$undefined;

    obj = {
      $type     : defType,
      $data     : null,
      $null     : defNull,
      $undefined: defUndefined,
      $_private : priv
    };

    if (defType === "object") {
      var $data = obj.$data = {};

      for (k in def) {
        var kDef = def[k];

        // Properties are stored in `obj` itself, however, object fields are
        // stored always in `obj.$data`. This is just a way to distinguish
        // properties from object fields.
        if (!reFieldIsProperty.test(k))
          $data[unescapeProperty(k)] = unfold.call(this, kDef, null);
        else if (!hasOwnProperty.call(obj, k))
          obj[k] = kDef;
      }

      if (defData != null) {
        if (typeof defData !== "object")
          throw new RuntimeError("Property '$data' has to be object, not '" + typeOf(defData) + "'.");

        for (k in defData) {
          kDef = defData[k];
          $data[k] = unfold.call(this, kDef, null);
        }
      }
    }
    else {
      for (k in def) {
        if (!reFieldIsProperty.test(k))
          throw new RuntimeError("Data field '" + k + "'can't be used by '" + defType + "' type.");

        if (!hasOwnProperty.call(obj, k))
          obj[k] = def[k];
      }

      if (defData != null) {
        if (typeof defData !== "object")
          throw new RuntimeError("Property '$data' has to be object, not '" + typeOf(defData) + "'.");

        obj.$data = unfold.call(this, defData, null);
      }
    }
  }

  // Validate that the postprocessed object is valid and can be compiled.
  var handler = this.getType(obj.$type);
  if (!handler)
    throw new RuntimeError("Unknown type '" + obj.$type + "'.");

  if (typeof handler.validate === "function")
    handler.validate(obj);

  return obj;
}

// \function `qdata.schema(def)`
//
// Processes the given definition `def` and creates a schema that can be used
// and compiled by `qdata` library.
function schema(def) {
  // All members starting with `$_private` are considered private and used
  // exclusively by QData library. This is the only reserved prefix so far.
  var priv = {
    data : null,
    funcs: {}
  };

  return unfold.call(this, def, priv);
}
qdata.schema = schema;

// ============================================================================
// [Interface - Schema Processing]
// ============================================================================

// \function `qdata.compile(def, options)`
//
// Compile and return a function that can be used to process data based
// on definition `def` and options given in `options`. The function returned
// is NOT associated with the given `def`, use more high-level `qdata.process()`
// to process data by using functions that are cached.
function compile(def, options) {
  return (new SchemaCompiler(this || qdata, options)).compileFunc(def);
}
qdata.compile = compile;

// \function `qdata.process(data, def, options, access)`
//
// Process the given `data` by using a definition `def`, `options` and an
// optional `access` rights. The function specific for the validation type
// and options is compiled on demand and then cached.
function process(data, def, options, access) {
  if (def === null || typeof def !== "object")
    throw new RuntimeError("Invalid schema, has to be of object type.");

  var priv = def.$_private;
  if (!priv)
    throw new RuntimeError("Invalid schema, doesn't contain $_private data.");

  if (!options)
    options = 0;

  var map = priv.funcs;
  var key = access ? "a" : "_";

  key += options;
  var fn = map[key];

  if (typeof fn !== "function") {
    fn = compile.call(this, def, options);
    map[key] = fn;
  }

  return fn(data, def, access);
}
qdata.process = process;

// ============================================================================
// [Interface - Customize]
// ============================================================================

// \object `qdata.types`
//
// Types supported by `qdata`. Mapping between a type names (or aliases) and
// type objects.
qdata.types = {};

// \object `qdata.rules`
//
// Rules supported by `qdata`. Mapping between a rule names and rule objects.
qdata.rules = {};

// \function `qdata.getType(name)`
//
// Get a type by `name`.
//
// The function also matches type aliases.
function getType(name) {
  var types = this.types;
  return (hasOwnProperty.call(types, name)) ? types[name] : null;
}
qdata.getType = getType;

// \function `qdata.addType(t)`
//
// Add a type or types to the `qdata` environment.
//
// The type `t` can be an array of types or a single type. The type added
// is a POD object having the following signature:
//
// ```
// {
//   // Type names/aliases, like `["int"]` or `["int", "integer", ...]`,
//   names  : String[]
//
//   // Mangled name of a JS variable type.
//   mangle: Char
//     "b" - Boolean
//     "n" - Number (double or integer, doesn't matter)
//     "s" - String (character or string, doesn't matter)
//     "a" - Array
//     "o" - Object
//
//   // Function that compiles a given type.
//   compile: Function(c, v, def) { ... }
// }
// ```
function addType(data) {
  var types = this.types;

  if (!isArray(data))
    data = [data];

  for (var i = 0; i < data.length; i++) {
    var type = data[i];
    var names = type.names;

    for (var n = 0; n < names.length; n++) {
      types[names[n]] = type;
    }
  }

  return this;
}
qdata.addType = addType;

// \function `qdata.getRule(name)`
//
// Get a rule by `name`.
function getRule(name) {
  var rules = this.rules;
  return (hasOwnProperty.call(rules, name)) ? rules[name] : null;
}
qdata.getRule = getRule;

// \function `qdata.addRule(rule)`
//
// Add a rule or rules to the `qdata` environment.
function addRule(data) {
  var rules = this.rules;

  if (!isArray(data))
    data = [data];

  for (var i = 0; i < data.length; i++) {
    var rule = data[i];
    rules[rule.name] = rule;
  }

  return this;
}
qdata.addRule = addRule;

// \function `qdata.customize(opt)`
//
// Extend the `qdata` library by custom types and rules. It returns a completely
// new object that acts as `qdata` library itself. This is the recommended way
// of extending `qdata` library.
//
// For example let's say that you have your own type `CustomType` and you want
// to extend the library. The recommended way is to extend `qdata` and use the
// extended library in your code base (node.js example):
//
// ```
// var qdata = require("qdata");
//
// var CustomType = {
//   ...
// };
//
// var xdata = qdata.customize({
//   types: [
//     CustomType
//   ]
// });
//
// // Export the new interface and always use your library to load the custom
// // version of `qdata`.
// module.exports = xdata;
// ```
//
// The advantage of this approach is that changes are not made globally and the
// new types or rules can be accessed only through the new `qdata` like object
// returned.
function customize(opt) {
  if (opt == null)
    opt = {};

  if (typeOf(opt) !== "object")
    throw new RuntimeError(
      "qdata.customize(opt) - The `opt` parameter has to be an object, received " + typeOf(opt) + ".");

  // Create a new `qdata` like object.
  var obj = copyObject(this || qdata);
  var tmp, i;

  // Clone members that can change.
  obj.types = copyObject(obj.types);
  obj.rules = copyObject(obj.rules);

  // Customize types and/or rules if provided.
  tmp = opt.types;
  if (tmp)
    obj.addType(tmp);

  tmp = opt.rules;
  if (tmp)
    obj.addRule(tmp);

  return obj;
}
qdata.customize = customize;

// ============================================================================
// [Built-In Types]
// ============================================================================

// Boolean types.
qdata.addType({
  names: ["boolean", "bool"],
  mangle: "b",

  compile: function(c, v, def) {
    c.emitNullOrUndefinedCheck(def, v, v);

    c.failIf("typeof " + v + " !== \"boolean\"",
      c.error(c.str("BoolCheckFailure")));

    return v;
  }
});

// Integer and Double types.
qdata.addType({
  names: [
    // Double types.
    "double",
    "number",

    // Integer types.
    "integer",
    "int"  , "uint"  ,
    "int8" , "uint8" ,
    "int16", "uint16",
    "int32", "uint32",
    "short", "ushort",

    // Latitude/Longitude types.
    "lat", "latitude",
    "lon", "longitude"
  ],
  mangle: "n",

  compile: function(c, v, def) {
    var type = def.$type;
    c.emitNullOrUndefinedCheck(def, v, v);

    if (/^(?:[u]?int\d*|integer|[u]?short)$/.test(type))
      c.failIf("typeof " + v + " !== \"number\" || !isFinite(" + v + ") || !(Math.floor(" + v + ") === " + v + ")",
        c.error(c.str("IntCheckFailure")));
    else
      c.failIf("typeof " + v + " !== \"number\" || !isFinite(" + v + ")",
        c.error(c.str("DoubleCheckFailure")));

    // Range check.
    var minValue = null;
    var maxValue = null;

    switch (type) {
      case "int":
      case "integer":
        minValue = kIntMin;
        maxValue = kIntMax;
        break;
      case "uint":
        minValue = 0;
        maxValue = kIntMax;
        break;
      case "int32":
        minValue = -2147483648;
        maxValue = 2147483647;
        break;
      case "uint32":
        minValue = 0;
        maxValue = 4294967295;
        break;
      case "int16":
      case "short":
        minValue = -32768;
        maxValue = 32767;
        break;
      case "uint16":
      case "ushort":
        minValue = 0;
        maxValue = 65535;
        break;
      case "int8":
        minValue = -128;
        maxValue = 127;
        break;
      case "uint8":
        minValue = 0;
        maxValue = 255;
        break;
      case "lat":
      case "latitude":
        minValue = -90;
        maxValue = 90;
        break;
      case "lon":
      case "longitude":
        minValue = -180;
        maxValue = 180;
        break;
    }

    c.emitRangeConditionCheck(def, v, minValue, maxValue);

    // DivBy check.
    if (def.$divBy != null)
      c.failIf(v + " % " + def.$divBy + " !== 0",
        c.error(c.str("DivByFailure")));

    return v;
  }
});

// Character type.
qdata.addType({
  names: ["char"],
  mangle: "s",

  compile: function(c, v, def) {
    c.emitNullOrUndefinedCheck(def, v, v);

    c.failIf("typeof " + v + " !== \"string\" || " + v + ".length !== 1",
      c.error(c.str("CharCheckFailure")));

    return v;
  }
});

// String and Text types.
//
// NOTE: Text is basically a string with some characters restricted.
qdata.addType({
  names: ["string", "text"],
  mangle: "s",

  compile: function(c, v, def) {
    c.emitNullOrUndefinedCheck(def, v, v);
    c.emitStringTypeCheck(def, v);

    if (def.$type === "text") {
      var reText = c.declareGlobal("re_text", "qdata.re.text");
      c.failIf(reText + ".test(" + v + ")",
        c.error(c.str("TextCheckFailure")));
    }

    if (def.$re != null) {
      var reCustom = c.declareData(null, def.$re);
      c.failIf(reCustom + ".test(" + v + ")",
        c.error(c.str(def.$reError || "RegExpFailure")));
    }

    return v;
  }
});

// Date and DateTime types.
qdata.addType({
  names: ["date", "datetime", "datetime-ms", "datetime-us"],
  mangle: "s",

  compile: function(c, v, def) {
    var type = def.$type;
    var form = def.$form || this.typeToForm[type];

    var vErr = "err";
    c.emitNullOrUndefinedCheck(def, v, v);

    c.failIf("typeof " + v + " !== \"string\"",
      c.error(c.str("DateCheckFailure")));

    var obj = c.declareData(null, getDateParser(form));
    var leapSecond = def.$leapSecond ? true : false;

    c.failIf("(" + vErr + " = " + obj + ".check(" + v + ", " + leapSecond + ")" + ")", vErr);
    return v;
  },

  validate: function(def) {
    // Validate that the given form is valid before we return the processed
    // schema to prevent throwing from `compile()` as it can harm consumers.
    var form = def.$form;
    if (form)
      getDateParser(form);
  },

  typeToForm: {
    "date"       : "YYYY-MM-DD",
    "datetime"   : "YYYY-MM-DD HH:mm:ss",
    "datetime-ms": "YYYY-MM-DD HH:mm:ss.SSS",
    "datetime-us": "YYYY-MM-DD HH:mm:ss.SSSSSS"
  }
});

// Object type.
qdata.addType({
  names: ["object"],
  mangle: "o",

  compile: function(c, v, def) {
    var vOut = c.addLocal("out", this.mangle);
    var toString = c.declareGlobal("toString", "Object.prototype.toString");

    // Type of null/{} is "object". So if "null" nor "undefined" types are allowed
    // this condition catches them both. We don't have to worry about these in
    // case that one of them is allowed as in such case it will be caught by
    // `emitNullOrUndefinedCheck()` and such value would have never reached this
    // check.
    c.emitNullOrUndefinedCheck(def, vOut, v);
    c.failIf(toString + ".call(" + v + ") !== \"[object Object]\"",
      c.error(c.str("ObjectCheckFailure")));

    c.beginSection();
    // c.emit("do {");
    c.nest();

    var fields = def.$data;
    var mandatoryFields = [];
    var optionalFields = [];

    var eKey, eDef, eMangledType;
    var eIn, eOut;
    var i = 0;

    for (eKey in fields) {
      eDef = fields[eKey];

      if (eDef == null || typeof eDef !== "object")
        throw new RuntimeError("Invalid field definition, expected object, got " + typeOf(eDef) + ".");

      // Just once.
      if (i === 0) {
        c.declareGlobal("hasOwnProperty", "Object.prototype.hasOwnProperty");
        i++;
      }

      if (eDef.$optional) {
        optionalFields.push(eKey);
      }
      else {
        eMangledType = c.mangledType(eDef);
        eIn = c.addLocal(eKey, eMangledType);

        var oldPath = c.addPath('"."', c.str(eKey));

        c.emit("if (hasOwnProperty.call(" + v + ", " + c.str(eKey) + ")) {");
        c.emit(eIn + " = " + v + "[" + c.str(eKey) + "];");

        eOut = c.compileType(eIn, eDef);

        c.emit("}");
        c.emit("else {");
        c.emit("err = " + c.error(c.str("RequiredField")) + ";");
        c.emit("}");

        c.emitNewLine();
        c.setPath(oldPath);
        c.done();

        mandatoryFields.push(eKey);
        mandatoryFields.push(eOut);
      }
    }

    if (mandatoryFields.length) {
      i = 0;

      c.emit(vOut + " = {");
      do {
        eKey = mandatoryFields[i + 0];
        eOut = mandatoryFields[i + 1];

        i += 2;
        c.emit(c.str(eKey) + ": " + eOut + (i < mandatoryFields.length ? "," : ""));
      } while (i < mandatoryFields.length);
      c.emit("};");
    }
    else {
      c.emit(vOut + " = {};");
    }

    if (optionalFields.length) {
      i = 0;
      do {
        eKey = optionalFields[i];

        c.emitNewLine();
        c.emit("if (hasOwnProperty.call(" + v + ", " + c.str(eKey) + ")) {");

        eMangledType = c.mangledType(eDef);
        eIn = c.addLocal(eKey, eMangledType);

        c.emit(eIn + " = " + v + "[" + c.str(eKey) + "];");

        var oldPath = c.addPath('"."', c.str(eKey));
        eOut = c.compileType(eIn, eDef);
        c.setPath(oldPath);

        c.emit(vOut + "[" + c.str(eKey) + "] = " + eOut + ";");
        c.emit("}");

        c.done();
      } while (++i < optionalFields.length);
    }

    c.denest();
    // c.emit("} while(false);");
    c.endSection();

    return vOut;
  }
});

// Array type.
qdata.addType({
  names: ["array"],
  mangle: "a",

  compile: function(c, v, def) {
    var vIdx = c.addLocal("idx", "_");
    var vLen = c.addLocal("len", "_");
    var vOut = c.addLocal("out", this.mangle);

    var toString = c.declareGlobal("toString", "Object.prototype.toString");

    c.emitNullOrUndefinedCheck(def, vOut, v);
    c.failIf(toString + ".call(" + v + ") !== \"[object Array]\"",
      c.error(c.str("ArrayCheckFailure")));

    c.beginSection();
    // c.emit("do {");
    c.nest();

    c.emit(vLen + " = " + v + ".length;");
    c.emit(vOut + " = [];");

    var cond = [];
    if (def.$length != null)
      cond.push(vLen + " !== " + def.$length);

    if (def.$minLength != null)
      cond.push(vLen + " < " + def.$minLength);

    if (def.$maxLength != null)
      cond.push(vLen + " > " + def.$maxLength);

    if (cond.length) {
      c.failIf(cond.join(" && "),
        c.error(c.str("InvalidLength")));
      c.beginSection();
    }

    c.emitNewLine();
    c.emit("for (" + vIdx + " = 0; " + vIdx + " < " + vLen + "; " + vIdx + "++) {");

    var eDef = def.$data;
    if (eDef == null || typeof eDef !== "object")
      throw new RuntimeError("Invalid ArrayType.$data definition, expected object, got " + typeOf(eDef) + ".");

    var eMangledType = c.mangledType(eDef);
    var eIn = c.addLocal("element", eMangledType);

    c.emit(eIn + " = " + v + "[" + vIdx + "];");

    var oldPath = c.addPath("", '"[" + ' + vIdx + ' + "]"');
    var eOut = c.compileType(eIn, eDef);

    c.emit(vOut + ".push(" + eOut + ");");
    c.setPath(oldPath);
    c.emit("}");

    if (cond.length) {
      c.endSection();
    }

    c.denest();
    // c.emit("} while(false);");
    c.endSection();

    return vOut;
  }
});

// ============================================================================
// [Built-In Rules]
// ============================================================================

/*
var IdRule = {
  name: "id"
};
qdata.IdRule = IdRule;
*/

// ============================================================================
// [Exports]
// ============================================================================

$export[$as] = qdata;

}).apply(this, typeof module === "object"
  ? [require("qclass"), module, "exports"]
  : [this.qclass, this, "qdata"]);
