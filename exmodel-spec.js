// exmodel.js <https://github.com/exjs/exmodel>
"use strict";

var assert = require("assert");
var exclass = require("exclass");
var exmodel = require("./exmodel");

// ============================================================================
// [Helpers]
// ============================================================================

var isArray = Array.isArray;
var isEqual = exmodel.util.isEqual;
var cloneDeep = exmodel.util.cloneDeep;
var printableSchema = exmodel.printableSchema;

function repeatString(s, n) {
  var result = "";
  for (var i = 0; i < n; i++)
    result += s;
  return result;
}

function sortedArrayOfArrays(arr) {
  arr = arr.slice();

  arr.sort(function(a, b) {
    var aVal = a.join("|");
    var bVal = b.join("|");

    return aVal < bVal ? -1 : aVal === bVal ? 0 : 1;
  });

  return arr;
}

function printableOptions(options) {
  var arr = [];

  if ((options & exmodel.kExtractAll) === exmodel.kExtractTop)
    arr.push("kExtractTop");

  if ((options & exmodel.kExtractAll) === exmodel.kExtractNested)
    arr.push("kExtractNested");

  if ((options & exmodel.kExtractAll) === exmodel.kExtractAll)
    arr.push("kExtractAll");

  if ((options & exmodel.kDeltaMode) !== 0)
    arr.push("kDeltaMode");

  if ((options & exmodel.kAccumulateErrors) !== 0)
    arr.push("kAccumulateErrors");

  return arr;
}

function serializeFailure(reason, schema, options, access, input, output, expected, errors) {
  var e = "ERROR - " + reason;
  var s = e + "\n" + repeatString("-", e.length) + "\n";

  if (schema   !== undefined) s += "schema"   + " = " + JSON.stringify(printableSchema(schema), null, 2) + "\n";
  if (options  !== undefined) s += "options"  + " = " + JSON.stringify(printableOptions(options)) + "\n";
  if (access   !== undefined) s += "access"   + " = " + JSON.stringify(access, null, 2) + "\n";
  if (input    !== undefined) s += "input"    + " = " + JSON.stringify(input, null, 2) + "\n";
  if (output   !== undefined) s += "output"   + " = " + JSON.stringify(output, null, 2) + "\n";
  if (expected !== undefined) s += "expected" + " = " + JSON.stringify(expected, null, 2) + "\n";
  if (errors   !== undefined) s += "errors"   + " = " + JSON.stringify(errors, null, 2) + "\n";

  try {
    var fn = exmodel.precompile("process", schema, options, access);
    s += "process = " + fn.toString();
  }
  catch (ex) {
    s += "process = <Invalid function generated>";
  }

  return reason + "\n" + s;
}

function TestError(message) {
  this.message = message;

  this.name = "TestError";
  this.stack = "Test" + Error(message).stack;
}
exclass({
  $extend: Error,
  $construct: TestError
});

function pass(input, schema, options, access, expected) {
  var output = null;
  var err = null;

  try {
    output = exmodel.process(input, schema, options, access);
  }
  catch (ex) {
    err = ex;
  }

  if (err) {
    var errors = err instanceof exmodel.SchemaError ? err.errors : undefined;
    console.log(serializeFailure(
      "Should have passed", schema, options, access, input, undefined, expected, errors));
    throw err;
  }

  if (arguments.length <= 4)
    expected = input;

  if (!isEqual(output, expected)) {
    throw new TestError(serializeFailure(
      "Didn't match the expected output", schema, options, access, input, output, arguments.length <= 4 ? undefined : expected));
  }
}

function fail(input, schema, options, access) {
  var output = undefined;
  var message = "Should have failed";

  try {
    output = exmodel.process(input, schema, options, access);
  }
  catch (ex) {
    if (ex instanceof exmodel.SchemaError)
      return;
    message = "Should have thrown SchemaError (but thrown " + ex.name + ")";
  }

  throw new TestError(serializeFailure(message, schema, options, access, input, output));
}

function assertThrow(fn) {
  try {
    fn();
  } catch (ex) {
    return;
  }

  throw new Error("Should have thrown exception.");
}

// ============================================================================
// [Tests]
// ============================================================================

describe("exmodel", function() {
  // --------------------------------------------------------------------------
  // [Utilities]
  // --------------------------------------------------------------------------

  it("should test utilities - isEqual", function() {
    // Basics.
    assert(isEqual(null     , null     ));
    assert(isEqual(undefined, undefined));
    assert(isEqual(true     , true     ));
    assert(isEqual(false    , false    ));
    assert(isEqual(0        , 0        ));
    assert(isEqual(0.10     , 0.10     ));
    assert(isEqual(""       , ""       ));
    assert(isEqual("string" , "string" ));
    assert(isEqual(Infinity , Infinity ));
    assert(isEqual(-Infinity, -Infinity));
    assert(isEqual(NaN      , NaN      ));
    assert(isEqual({ a: 0 } , { a: 0 } ));
    assert(isEqual([0, 1, 2], [0, 1, 2]));

    assert(!isEqual(null, undefined));
    assert(!isEqual(undefined, null));

    assert(!isEqual(0, "0"));
    assert(!isEqual("0", 0));

    assert(!isEqual(false, "false"));
    assert(!isEqual("true", true));

    assert(!isEqual("", null));
    assert(!isEqual(null, ""));

    assert(!isEqual(0, null));
    assert(!isEqual(null, 0));

    assert(!isEqual(null, {}));
    assert(!isEqual({}, null));

    assert(!isEqual(null, []));
    assert(!isEqual([], null));

    assert(!isEqual({ a: undefined }, {}));
    assert(!isEqual({}, { a: undefined }));

    assert(!isEqual({}, []));
    assert(!isEqual([], {}));

    // Object equality.
    assert(isEqual({
      boolValue: false,
      numberValue: 42,
      stringValue: "string",
      nestedObject: {
        a: 0,
        b: 1
      },
      nestedArray: [1, 2, 3]
    }, {
      boolValue: false,
      numberValue: 42,
      stringValue: "string",
      nestedObject: {
        a: 0,
        b: 1
      },
      nestedArray: [1, 2, 3]
    }));

    // Cyclic references.
    var aCyclic = {
      a: 0,
      b: 1
    };

    var bCyclic = {
      a: 0,
      b: 1
    };

    aCyclic.cyclic = bCyclic;
    bCyclic.cyclic = aCyclic;

    assertThrow(function() { isEqual(aCyclic, bCyclic); });
    assertThrow(function() { isEqual(bCyclic, aCyclic); });
  });

  it("should test utilities - cloneDeep", function() {
    var orig = {
      a: true,
      b: false,
      c: 1,
      d: "string",
      e: {
        a: [{}, [], false, true, 0, 1, "x"]
      },
      f: [NaN, Infinity, -Infinity, 0.1122]
    };
    var copy = cloneDeep(orig);

    assert(isEqual(copy, orig));
    assert(copy !== orig);
    assert(copy.e !== orig.e);
    assert(copy.f !== orig.f);
    assert(copy.e.a !== orig.e.a);
    assert(copy.e.a[0] !== orig.e.a[0]);
    assert(copy.e.a[1] !== orig.e.a[1]);
  });

  it("should test utilities - string operations", function() {
    assert(exmodel.util.isDirectiveName("$")          === true);
    assert(exmodel.util.isDirectiveName("$directive") === true);
    assert(exmodel.util.isDirectiveName("")           === false);
    assert(exmodel.util.isDirectiveName("fieldName")  === false);

    assert(exmodel.util.isVariableName("someVar")     === true);
    assert(exmodel.util.isVariableName("SomeVar")     === true);
    assert(exmodel.util.isVariableName("$someVar")    === true);
    assert(exmodel.util.isVariableName("_someVar")    === true);
    assert(exmodel.util.isVariableName("$1")          === true);
    assert(exmodel.util.isVariableName("$$")          === true);
    assert(exmodel.util.isVariableName("1")           === false);
    assert(exmodel.util.isVariableName("1$NotAVar")   === false);
    assert(exmodel.util.isVariableName("1_NotAVar")   === false);

    assert(exmodel.util.escapeRegExp("[]{}")          === "\\[\\]\\{\\}");

    assert(exmodel.util.unescapeFieldName("field")    === "field");
    assert(exmodel.util.unescapeFieldName("\\$field") === "$field");

    assert(exmodel.util.toCamelCase("ThisIsString")   === "thisIsString");
    assert(exmodel.util.toCamelCase("this-is-string") === "thisIsString");
    assert(exmodel.util.toCamelCase("THIS_IS_STRING") === "thisIsString");
    assert(exmodel.util.toCamelCase("this-isString")  === "thisIsString");
    assert(exmodel.util.toCamelCase("THIS_IsSTRING")  === "thisIsString");
  });

  // --------------------------------------------------------------------------
  // [Enum]
  // --------------------------------------------------------------------------

  it("should test enum", function() {
    // Enum - safe, unique, and sequential.
    var AnimalDef = {
      Horse: 0,
      Dog: 1,
      Cat: 2,
      Mouse: 4,
      Hamster: 3
    };
    var AnimalEnum = exmodel.enum(AnimalDef);

    assert(Object.keys(AnimalEnum).length === 5);

    assert(AnimalEnum.Horse   === 0);
    assert(AnimalEnum.Dog     === 1);
    assert(AnimalEnum.Cat     === 2);
    assert(AnimalEnum.Hamster === 3);
    assert(AnimalEnum.Mouse   === 4);

    assert(AnimalEnum.hasKey("Horse"          ) === true);
    assert(AnimalEnum.hasKey("Mouse"          ) === true);
    assert(AnimalEnum.hasKey("constructor"    ) === false);
    assert(AnimalEnum.hasKey("hasOwnProperty" ) === false);

    assert(AnimalEnum.keyToValue("Horse"      ) === AnimalEnum.Horse  );
    assert(AnimalEnum.keyToValue("Dog"        ) === AnimalEnum.Dog    );
    assert(AnimalEnum.keyToValue("Cat"        ) === AnimalEnum.Cat    );
    assert(AnimalEnum.keyToValue("Hamster"    ) === AnimalEnum.Hamster);
    assert(AnimalEnum.keyToValue("Mouse"      ) === AnimalEnum.Mouse  );
    assert(AnimalEnum.keyToValue("constructor") === undefined);

    assert(AnimalEnum.valueToKey(AnimalEnum.Horse  ) === "Horse"  );
    assert(AnimalEnum.valueToKey(AnimalEnum.Dog    ) === "Dog"    );
    assert(AnimalEnum.valueToKey(AnimalEnum.Cat    ) === "Cat"    );
    assert(AnimalEnum.valueToKey(AnimalEnum.Hamster) === "Hamster");
    assert(AnimalEnum.valueToKey(AnimalEnum.Mouse  ) === "Mouse"  );

    assert(AnimalEnum.valueToKey(5)   === undefined);
    assert(AnimalEnum.valueToKey(-1)  === undefined);
    assert(AnimalEnum.valueToKey("0") === undefined);

    assert(isEqual(AnimalEnum.$.keyMap, AnimalDef));
    assert(isEqual(AnimalEnum.$.keyArray, [
      "Horse",
      "Dog",
      "Cat",
      "Mouse",
      "Hamster"
    ]));

    assert(isEqual(AnimalEnum.$.valueMap, {
      "0": "Horse",
      "1": "Dog",
      "2": "Cat",
      "3": "Hamster",
      "4": "Mouse"
    }));
    assert(isEqual(AnimalEnum.$.valueArray, [
      0, 1, 2, 3, 4
    ]));

    assert(AnimalEnum.$.min === 0);
    assert(AnimalEnum.$.max === 4);
    assert(AnimalEnum.$.safe === true);
    assert(AnimalEnum.$.unique === true);
    assert(AnimalEnum.$.sequential === true);

    // Enum - safe, unique, and non-sequential.
    var TypeIdUniqueDef = {
      String: 1299,
      Number: 3345,
      Object: 6563,
      Array : 1234
    };
    var TypeIdUniqueEnum = exmodel.enum(TypeIdUniqueDef);

    assert(TypeIdUniqueEnum.keyToValue("String") === TypeIdUniqueEnum.String);
    assert(TypeIdUniqueEnum.keyToValue("Number") === TypeIdUniqueEnum.Number);
    assert(TypeIdUniqueEnum.keyToValue("Object") === TypeIdUniqueEnum.Object);
    assert(TypeIdUniqueEnum.keyToValue("Array" ) === TypeIdUniqueEnum.Array );

    assert(TypeIdUniqueEnum.valueToKey(TypeIdUniqueEnum.String) === "String");
    assert(TypeIdUniqueEnum.valueToKey(TypeIdUniqueEnum.Number) === "Number");
    assert(TypeIdUniqueEnum.valueToKey(TypeIdUniqueEnum.Object) === "Object");
    assert(TypeIdUniqueEnum.valueToKey(TypeIdUniqueEnum.Array ) === "Array" );

    assert(TypeIdUniqueEnum.$.min === 1234);
    assert(TypeIdUniqueEnum.$.max === 6563);
    assert(TypeIdUniqueEnum.$.safe === true);
    assert(TypeIdUniqueEnum.$.unique === true);
    assert(TypeIdUniqueEnum.$.sequential === false);

    // Enum - safe, non-unique, and non-sequential.
    var TypeIdNonUniqueDef = {
      String: 1299,
      Number: 3345,
      Object: 6563, // Same as Array
      Array : 6563  // Same as Object, but value should be mapped to "Object".
    };
    var TypeIdNonUniqueEnum = exmodel.enum(TypeIdNonUniqueDef);

    assert(TypeIdNonUniqueEnum.keyToValue("String") === TypeIdNonUniqueEnum.String);
    assert(TypeIdNonUniqueEnum.keyToValue("Number") === TypeIdNonUniqueEnum.Number);
    assert(TypeIdNonUniqueEnum.keyToValue("Object") === TypeIdNonUniqueEnum.Object);
    assert(TypeIdNonUniqueEnum.keyToValue("Array" ) === TypeIdNonUniqueEnum.Array );

    assert(TypeIdNonUniqueEnum.valueToKey(TypeIdNonUniqueEnum.String) === "String");
    assert(TypeIdNonUniqueEnum.valueToKey(TypeIdNonUniqueEnum.Number) === "Number");
    assert(TypeIdNonUniqueEnum.valueToKey(TypeIdNonUniqueEnum.Object) === "Object");

    // Array share the same value as Object, but Object has been defined first,
    // so Array value has to map to "Object" string.
    assert(TypeIdNonUniqueEnum.valueToKey(TypeIdNonUniqueEnum.Array) === "Object");

    assert(isEqual(TypeIdNonUniqueEnum.$.valueMap, {
      "1299": "String",
      "3345": "Number",
      "6563": "Object"
    }));
    assert(isEqual(TypeIdNonUniqueEnum.$.valueArray, [1299, 3345, 6563]));

    assert(TypeIdNonUniqueEnum.$.min === 1299);
    assert(TypeIdNonUniqueEnum.$.max === 6563);
    assert(TypeIdNonUniqueEnum.$.safe === true);
    assert(TypeIdNonUniqueEnum.$.unique === false);
    assert(TypeIdNonUniqueEnum.$.sequential === false);

    // Enum - unsafe.
    assert(exmodel.enum({ A:-1.1                   }).$.safe === false);
    assert(exmodel.enum({ A: 1.1                   }).$.safe === false);
    assert(exmodel.enum({ A: 1234.1234             }).$.safe === false);
    assert(exmodel.enum({ A: exmodel.kSafeIntMin - 2 }).$.safe === false);
    assert(exmodel.enum({ A: exmodel.kSafeIntMax + 2 }).$.safe === false);

    // Enum - using reserved property names (Object.prototype properties).
    var ReservedDef = {
      constructor: 0,
      hasOwnProperty: 1,
      __defineGetter__: 2,
      toSource: 3,
      toString: 4,
      valueOf: 5
    };
    var ReservedEnum = exmodel.enum(ReservedDef);

    assert(isEqual(ReservedEnum.$.keyMap, ReservedDef));

    assert(ReservedEnum.hasKey("constructor"         ) === true );
    assert(ReservedEnum.hasKey("__defineGetter__"    ) === true );
    assert(ReservedEnum.hasKey("valueOf"             ) === true );
    assert(ReservedEnum.hasKey("propertyIsEnumerable") === false);

    assert(ReservedEnum.keyToValue("constructor"         ) === 0);
    assert(ReservedEnum.keyToValue("__defineGetter__"    ) === 2);
    assert(ReservedEnum.keyToValue("valueOf"             ) === 5);
    assert(ReservedEnum.keyToValue("propertyIsEnumerable") === undefined);

    // Ban keys that collide with members exmodel.enum() provides.
    assertThrow(function() { exmodel.enum({ $         : 0 }); });
    assertThrow(function() { exmodel.enum({ hasKey    : 0 }); });
    assertThrow(function() { exmodel.enum({ hasValue  : 0 }); });
    assertThrow(function() { exmodel.enum({ keyToValue: 0 }); });
    assertThrow(function() { exmodel.enum({ valueToKey: 0 }); });

    // Ban JS keys that are essential to the JS engine.
    assertThrow(function() { exmodel.enum({ prototype : 0 }); });

    // Non-numeric values are not allowed.
    assertThrow(function() { exmodel.enum({ infinityValue  : Infinity }); });
    assertThrow(function() { exmodel.enum({ infinityValue  :-Infinity }); });
    assertThrow(function() { exmodel.enum({ nanValue       : NaN      }); });
    assertThrow(function() { exmodel.enum({ booleanValue   : false    }); });
    assertThrow(function() { exmodel.enum({ booleanValue   : true     }); });
    assertThrow(function() { exmodel.enum({ stringValue    : "1"      }); });
    assertThrow(function() { exmodel.enum({ objectValue    : {}       }); });
    assertThrow(function() { exmodel.enum({ arrayValue     : []       }); });
  });

  // --------------------------------------------------------------------------
  // [Core]
  // --------------------------------------------------------------------------

  it("should validate null and fail if undefined", function() {
    ["bool", "int", "number", "string", "text", "date", "datetime", "object"].forEach(function(type) {
      pass(null     , exmodel.schema({ $type: type, $null: true      }));
      fail(undefined, exmodel.schema({ $type: type, $null: true      }));
    });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Any]
  // --------------------------------------------------------------------------

  it("should validate any - anything", function() {
    var def = exmodel.schema({ $type: "any" });

    var passData = [false, true, 0, 1, 42.42, "", "string", {}, [], { a: true }, [[[1, 2], 3], 4, { a: true }]];
    var failData = [null, undefined];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate any - $allowed", function() {
    var def = exmodel.schema({ $type: "any" });

    var passData = [false, true, 0, 1, 42.42, "", "string", {}, [], { a: true }, [[[1, 2], 3], 4, { a: true }]];
    var failData = [null, undefined];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Bool]
  // --------------------------------------------------------------------------

  it("should validate bool", function() {
    var def = exmodel.schema({ $type: "bool" });

    var passData = [false, true];
    var failData = [0, 1, "", "string", {}, [], Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Number]
  // --------------------------------------------------------------------------

  it("should validate number - int", function() {
    var def = exmodel.schema({ $type: "int" });

    var passData = [0, 1, -1];
    var failData = [false, true, "", "0", "string", {}, [], 0.1, -0.23211, Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate number - intxx", function() {
    pass(-128       , exmodel.schema({ $type: "int8"  }));
    pass( 127       , exmodel.schema({ $type: "int8"  }));
    pass( 255       , exmodel.schema({ $type: "uint8" }));

    pass(-32768     , exmodel.schema({ $type: "int16"  }));
    pass( 32767     , exmodel.schema({ $type: "int16"  }));
    pass( 65535     , exmodel.schema({ $type: "uint16" }));

    pass(-2147483648, exmodel.schema({ $type: "int32"  }));
    pass( 2147483647, exmodel.schema({ $type: "int32"  }));
    pass( 4294967295, exmodel.schema({ $type: "uint32" }));

    fail(-129       , exmodel.schema({ $type: "int8"  }));
    fail( 128       , exmodel.schema({ $type: "int8"  }));
    fail(-1         , exmodel.schema({ $type: "uint8" }));
    fail( 256       , exmodel.schema({ $type: "uint8" }));

    fail(-32769     , exmodel.schema({ $type: "int16"  }));
    fail( 32768     , exmodel.schema({ $type: "int16"  }));
    fail(-1         , exmodel.schema({ $type: "uint16" }));
    fail( 65536     , exmodel.schema({ $type: "uint16" }));

    fail(-2147483649, exmodel.schema({ $type: "int32"  }));
    fail( 2147483648, exmodel.schema({ $type: "int32"  }));
    fail(-1         , exmodel.schema({ $type: "uint32" }));
    fail( 4294967296, exmodel.schema({ $type: "uint32" }));
  });

  it("should validate number - double", function() {
    var def = exmodel.schema({ $type: "number" });

    var passData = [0, 1, -1, 0.1, -0.23211];
    var failData = [false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate number - lat/lon", function() {
    var defLat = exmodel.schema({ $type: "lat" });
    var defLon = exmodel.schema({ $type: "lon" });

    var passLat = [-90, -45.5334, 0, 34.4432, 90];
    var failLat = [-90.0001, 90.0001, "", true, null, undefined];

    var passLon = [-180, -144.4322, 0, 99.2332, 180];
    var failLon = [-180.0001, 180.0001, "", true, null, undefined];

    passLat.forEach(function(value) { pass(value, defLat); });
    failLat.forEach(function(value) { fail(value, defLat); });

    passLon.forEach(function(value) { pass(value, defLon); });
    failLon.forEach(function(value) { fail(value, defLon); });
  });

  it("should validate number - $allowed", function() {
    var types = [
      "int", "int8", "int16", "int32", "double", "number", "numeric"
    ];

    types.forEach(function(type) {
      pass( 0, exmodel.schema({ $type: type, $allowed: [0, 1, 2] }));
      pass( 0, exmodel.schema({ $type: type, $allowed: [0, 1, 5] }));
      pass( 5, exmodel.schema({ $type: type, $allowed: [1, 5, 0] }));

      fail(-1, exmodel.schema({ $type: type, $allowed: [0, 1, 2] }));
      fail( 6, exmodel.schema({ $type: type, $allowed: [0, 1, 5] }));
    });
  });

  it("should validate number - $min/$max", function() {
    var types = [
      "int", "int8", "int16", "int32", "double", "number", "numeric"
    ];

    types.forEach(function(type) {
      pass( 0, exmodel.schema({ $type: type, $min: 0, $max: 5 }));
      pass( 5, exmodel.schema({ $type: type, $min: 0, $max: 5 }));

      pass( 1, exmodel.schema({ $type: type, $min: 0, $minExclusive: true }));
      pass( 4, exmodel.schema({ $type: type, $max: 5, $maxExclusive: true }));

      fail(-1, exmodel.schema({ $type: type, $min: 0, $max: 5 }));
      fail( 6, exmodel.schema({ $type: type, $min: 0, $max: 5 }));

      fail( 0, exmodel.schema({ $type: type, $min: 0, $minExclusive: true }));
      fail( 5, exmodel.schema({ $type: type, $max: 0, $maxExclusive: true }));
    });
  });

  it("should validate number - $divisibleBy", function() {
    ["int", "number"].forEach(function(type) {
      pass(-9, exmodel.schema({ $type: type, $divisibleBy: 9 }));
      pass( 0, exmodel.schema({ $type: type, $divisibleBy: 1 }));
      pass( 1, exmodel.schema({ $type: type, $divisibleBy: 1 }));
      pass( 2, exmodel.schema({ $type: type, $divisibleBy: 1 }));
      pass( 4, exmodel.schema({ $type: type, $divisibleBy: 2 }));
      pass(10, exmodel.schema({ $type: type, $divisibleBy: 5 }));

      fail(-3, exmodel.schema({ $type: type, $divisibleBy: 2 }));
      fail( 3, exmodel.schema({ $type: type, $divisibleBy: 6 }));
    });
  });

  it("should validate numeric - precision and scale", function() {
    var defWithType = exmodel.schema({
      $type: "numeric(6, 2)"
    });

    var defExplicit = exmodel.schema({
      $type: "numeric",
      $precision: 6,
      $scale: 2
    });

    var passData = [
      -9999.99, -1111.11, -1.11, -1, 0, 1, 1.11, 1111.11, 9999.99
    ];

    var failData = [
      false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN,
      -10000, 10000
    ];

    passData.forEach(function(value) {
      pass(value, defWithType);
      pass(value, defExplicit);
    });

    failData.forEach(function(value) {
      fail(value, defWithType);
      fail(value, defExplicit);
    });
  });

  it("should validate numeric - invalid precision / scale", function() {
    assertThrow(function() { exmodel.schema({ $type: "numeric(-2)"      }); });
    assertThrow(function() { exmodel.schema({ $type: "numeric(2,-2)"    }); });
    assertThrow(function() { exmodel.schema({ $type: "numeric(2,-2)"    }); });
    assertThrow(function() { exmodel.schema({ $type: "numeric(2, 2)"    }); });
    assertThrow(function() { exmodel.schema({ $type: "numeric(2, 4)"    }); });
    assertThrow(function() { exmodel.schema({ $type: "numeric(invalid)" }); });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Char]
  // --------------------------------------------------------------------------

  it("should validate char", function() {
    pass(""  , exmodel.schema({ $type: "char", $empty: true }));
    pass("a" , exmodel.schema({ $type: "char" }));
    pass("b" , exmodel.schema({ $type: "char" }));

    pass("a" , exmodel.schema({ $type: "char", $allowed: "abc" }));
    pass("c" , exmodel.schema({ $type: "char", $allowed: "abc" }));

    fail(""  , exmodel.schema({ $type: "char" }));
    fail(""  , exmodel.schema({ $type: "char", $empty: false }));

    fail("A" , exmodel.schema({ $type: "char", $allowed: "abc" }));
    fail("z" , exmodel.schema({ $type: "char", $allowed: "abc" }));

    fail("ab", exmodel.schema({ $type: "char" }));
    fail("bc", exmodel.schema({ $type: "char" }));
  });

  // --------------------------------------------------------------------------
  // [SchemaType - String]
  // --------------------------------------------------------------------------

  it("should validate string", function() {
    pass("\x00"  , exmodel.schema({ $type: "string" }));
    pass("xxxx"  , exmodel.schema({ $type: "string" }));

    pass("abc"   , exmodel.schema({ $type: "string", $length   : 3 }));

    pass("abc"   , exmodel.schema({ $type: "string", $minLength: 3 }));
    pass("abcdef", exmodel.schema({ $type: "string", $minLength: 3 }));

    pass("abc"   , exmodel.schema({ $type: "string", $maxLength: 6 }));
    pass("abcdef", exmodel.schema({ $type: "string", $maxLength: 6 }));

    fail("abc", exmodel.schema({ $type: "string", $length   : 2 }));
    fail("abc", exmodel.schema({ $type: "string", $minLength: 4 }));
    fail("abc", exmodel.schema({ $type: "string", $maxLength: 2 }));
  });

  it("should validate string - allowed", function() {
    var allowed = ["yes", "no", "maybe"];
    var def = exmodel.schema({ $type: "text", $empty: true, $allowed: allowed });

    var passData = allowed.concat([""]);
    var failData = [null, "never", " yes", "no ", " maybe "];

    passData.forEach(function(value) {
      pass(value, def);
    });

    failData.forEach(function(value) {
      fail(value, def);
    });
  });

  it("should validate string - text (lo)", function() {
    // Text goes through the same validator as "string", so test only parts
    // where "string" vs "text" differ.
    var def = exmodel.schema({ $type: "text" });

    // Should accept some characters below 32.
    var passData = [
      "",
      "some text \x09",
      "some text \x0A",
      "some text \x0D",
      "!@#$%^&*(),.+-=/<>{}[]_~|`\\:;?'"
    ];

    // Should refuse NULL and other characters below 32.
    var failData = [
      "some text \x00",
      "some text \x1B",
      "some text \x1F"
    ];

    passData.forEach(function(value) {
      pass(value, def);
    });

    failData.forEach(function(value) {
      fail(value, def);
    });
  });

  it("should validate string - text (lo+hi)", function() {
    var def = exmodel.schema({ $type: "textline" });

    var passData = [
      "",
      "some text \x09",
      "!@#$%^&*(),.+-=/<>{}[]_~|`\\:;?'"
    ];

    var failData = [
      "some text \x00",
      "some text \x1B",
      "some text \x1F",
      "some text \n",
      "some text \r\n",
      "some text \n\r",
      "some text \u2028",
      "some text \u2029"
    ];

    passData.forEach(function(value) {
      pass(value, def);
    });

    failData.forEach(function(value) {
      fail(value, def);
    });
  });

  it("should validate string - text (surrogate pairs)", function() {
    var def = exmodel.schema({ $type: "text" });

    var passData = [
      "\uD834\uDF06",

      "______\uD834\uDF06",
      "\uD834\uDF06______"
    ];

    var failData = [
      "\uDF06",
      "\uD834",

      "\uDF06\uDF06",
      "\uD834\uD834",

      "\uDF06\uD834",

      "______\uDF06",
      "\uDF06______",

      "______\uD834",
      "\uD834______",

      "\uD834\uDF06\uD834",
      "\uD834\uDF06\uDF06"
    ];

    passData.forEach(function(value) {
      pass(value, def);
    });

    failData.forEach(function(value) {
      fail(value, def);
    });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - BigInt]
  // --------------------------------------------------------------------------

  it("should validate bigint", function() {
    var def = exmodel.schema({ $type: "bigint" });

    var passData = [
      "0",
      "1",
      "12",
      "123",
      "1234",
      "12345",
      "10000",
      "1000000000000000000",
      "9000000000000000000",
      "9200000000000000000",
      "9220000000000000000",
      "9223000000000000000",
      "9223000000000000000",
      "9223300000000000000",
      "9223370000000000000",
      "9223372000000000000",
      "9223372030000000000",
      "9223372036000000000",
      "9223372036800000000",
      "9223372036850000000",
      "9223372036854000000",
      "9223372036854700000",
      "9223372036854770000",
      "9223372036854775000",
      "9223372036854775800",
      "9223372036854775800",
      "9223372036854775806",
      "9223372036854775807"
    ];

    var failData = [
      0,
      true,
      1222,
      "",
      "invalid",
      "0x",
      "0 ",
      "x0",
      " 0",
      "[0]",
      "00",
      "000",
      "9223372036854775808",
      "9223372036854775810",
      "9223372036854775900",
      "9223372036854776000",
      "9223372036854780000",
      "9223372036854800000",
      "9223372036855000000",
      "9223372036860000000",
      "9223372036900000000",
      "9223372037000000000",
      "9223372040000000000",
      "9223372100000000000",
      "9223373000000000000",
      "9223380000000000000",
      "9223400000000000000",
      "9224000000000000000",
      "9230000000000000000",
      "9300000000000000000",
      "9999999999999999999",
      "10000000000000000000",

      "-",
      "-0",
      "-00",
      "-000"
    ];

    passData.forEach(function(data) {
      pass(data, def);
    });

    failData.forEach(function(data) {
      fail(data, def);
    });
  });

  it("should validate bigint - $allowed", function() {
    pass(""    , exmodel.schema({ $type: "bigint", $allowed: ["1234", "2345"], $empty: true }));
    pass("1234", exmodel.schema({ $type: "bigint", $allowed: ["1234", "2345"] }));
    pass("1234", exmodel.schema({ $type: "bigint", $allowed: ["2345", "1234"] }));

    fail(""    , exmodel.schema({ $type: "bigint", $allowed: ["2345", "3456"] }));
    fail("1234", exmodel.schema({ $type: "bigint", $allowed: ["2345", "3456"] }));
    fail("1234", exmodel.schema({ $type: "bigint", $allowed: [] }));
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Color]
  // --------------------------------------------------------------------------

  it("should validate color - #XXX and #XXXXXX", function() {
    var def = exmodel.schema({ $type: "color" });

    pass("#000", def);
    pass("#123", def);
    pass("#F00", def);
    pass("#0AF", def);
    pass("#0af", def);
    pass("#DEF", def);
    pass("#fff", def);

    pass("#000000", def);
    pass("#112233", def);
    pass("#FF0000", def);
    pass("#00AAFF", def);
    pass("#00aaff", def);
    pass("#DDEEFF", def);
    pass("#ffffff", def);

    fail(" #FFF", def);
    fail("#FFF ", def);

    fail("#FF"  , def);
    fail("#FFFF", def);

    fail("#FFg" , def);
    fail("#FgF" , def);
    fail("#gFF" , def);

    fail("#FF " , def);
    fail("#F F" , def);
    fail("# FF" , def);
  });

  it("should validate color - color names", function() {
    var defDefault          = exmodel.schema({ $type: "color" });
    var defAllowCssNames    = exmodel.schema({ $type: "color", $cssNames: true  });
    var defDisallowCssNames = exmodel.schema({ $type: "color", $cssNames: false });

    for (var k in exmodel.util.colorNames) {
      var K = k.toUpperCase();

      pass(k, defDefault);
      pass(K, defDefault);

      pass(k, defAllowCssNames);
      pass(K, defAllowCssNames);

      fail(k      , defDisallowCssNames);
      fail(K      , defDisallowCssNames);
      fail(k + " ", defDisallowCssNames);
      fail("#" + k, defDisallowCssNames);
    }
  });

  it("should validate color - extra names", function() {
    var ExtraNames = {
      "none"        : true,
      "transparent" : true,
      "currentcolor": true
    };

    var def = exmodel.schema({
      $type         : "color",
      $cssNames     : true,
      $extraNames   : ExtraNames
    });

    pass("#FFF"        , def);
    pass("#FFFFFF"     , def);
    pass("red"         , def);
    pass("RED"         , def);
    pass("none"        , def);
    pass("NONE"        , def);
    pass("transparent" , def);
    pass("TRANSPARENT" , def);
    pass("currentcolor", def);
    pass("currentColor", def);
    pass("CURRENTCOLOR", def);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - CreditCard]
  // --------------------------------------------------------------------------

  it("should validate creditcard", function() {
    var def = exmodel.schema({ $type: "creditcard" });

    // Randomly generated from:
    // http://www.freeformatter.com/credit-card-number-generator-validator.html
    var passData = [
      // VISA:
      "4556592777286861",
      "4561630180863141",
      "4716203245370983",
      // MasterCard:
      "5226346701343042",
      "5168623982904811",
      "5321526479575164",
      // American Express (AMEX):
      "349357074744917",
      "373167420246221",
      "371014557145135",
      // Discover:
      "6011329741927500",
      "6011794079493138",
      "6011337361376130",
      // JCB:
      "3337934039462492",
      "3096901216932242",
      "3096030621506811",
      // Diners Club - North America:
      "5522577702482337",
      "5538547440807915",
      "5460940284600300",
      // Diners Club - Carte Blanche:
      "30306477491901",
      "30151193010944",
      "30323308640796",
      // Diners Club - International:
      "36594325317980",
      "36808073646329",
      "36248730115600",
      // Maestro:
      "6304228546783421",
      "6761861577869127",
      "6763867742875517",
      // Laser:
      "6304680224325729",
      "6709677437638485",
      "6304700957790301",
      // Visa Electron:
      "4508335323606623",
      "4026595541751419",
      "4913477252284342",
      // InstaPayment:
      "6371883925980952",
      "6370627906955181",
      "6372830657093578"
    ];

    var failData = [
      // VISA:
      "4556592777286865",
      "4561630180861141",
      "4716203245370982",
      // MasterCard:
      "5226346701343045",
      "5168623982904821",
      "5321526479575169",
      // American Express (AMEX):
      "349357074744919",
      "373167420246231",
      "371014557145136",
      // Discover:
      "6011329741927508",
      "6011794079493148",
      "6011337361376135",
      // JCB:
      "3337934039462495",
      "3096901216932232",
      "3096030621506812",
      // Diners Club - North America:
      "5522577702482334",
      "5538546440807915",
      "5460940284600301",
      // Diners Club - Carte Blanche:
      "30306477491907",
      "30151193010244",
      "30323308640798",
      // Diners Club - International:
      "36594325317982",
      "36808073646629",
      "36248730115602",
      // Maestro:
      "6304228546783427",
      "6761861777869127",
      "6763867741875517",
      // Laser:
      "6304680224325724",
      "6709677437638785",
      "6304700957790304",
      // Visa Electron:
      "4508335323606628",
      "4026595541751429",
      "4913477252284346",
      // InstaPayment:
      "6371883925980954",
      "6370627906955191",
      "6372830657093579"
    ];

    passData.forEach(function(data) {
      pass(data, def);
    });

    failData.forEach(function(data) {
      fail(data, def);
    });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - ISBN]
  // --------------------------------------------------------------------------

  it("should validate isbn", function() {
    var passData = [
      "1617290858",
      "3423214120",
      "340101319X",

      "9783836221191",
      "9784873113685"
    ];

    var failData = [
      "invalid",

      " 1617290858",
      "1617290858 ",

      "1617290859",
      "3423215120",
      "344101319X",

      " 9783836221191",
      "9783836221191 ",

      "9783836221190",
      "9783873113685"
    ];

    passData.forEach(function(data) {
      var correctFormat = String(data.length);
      var invalidFormat = correctFormat === "10" ? "13" : "10";

      pass(data, exmodel.schema({ $type: "isbn" }));
      pass(data, exmodel.schema({ $type: "isbn" }));

      pass(data, exmodel.schema({ $type: "isbn", $format: correctFormat }));
      fail(data, exmodel.schema({ $type: "isbn", $format: invalidFormat }));
    });

    failData.forEach(function(data) {
      fail(data, exmodel.schema({ $type: "isbn" }));
      fail(data, exmodel.schema({ $type: "isbn", $format: "10" }));
      fail(data, exmodel.schema({ $type: "isbn", $format: "13" }));
    });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - MAC]
  // --------------------------------------------------------------------------

  it("should validate mac", function() {
    var MAC  = exmodel.schema({ $type: "mac" });
    var MACd = exmodel.schema({ $type: "mac", $separator: "-" });

    pass("00:00:00:00:00:00", MAC);
    pass("01:02:03:04:05:06", MAC);
    pass("a1:a2:a3:a4:a5:a6", MAC);
    pass("F1:F2:F3:F4:F5:F6", MAC);
    pass("ab:cd:ef:ab:cd:ef", MAC);
    pass("aB:cD:eF:aB:cD:eF", MAC);
    pass("Ab:Cd:Ef:Ab:Cd:Ef", MAC);
    pass("AB:CD:EF:AB:CD:EF", MAC);

    pass("ab-cd-ef-ab-cd-ef", MACd);

    fail(true                , MAC);
    fail("invalid"           , MAC);

    fail(":12:34:56:78:90:AB", MAC);
    fail(" 12:34:56:78:90:AB", MAC);
    fail("12:34:56:78:90:AB:", MAC);
    fail("12:34:56:78:90:AB ", MAC);

    fail("1:34:56:78:90:AB"  , MAC);
    fail("12:3:56:78:90:AB"  , MAC);
    fail("12:34:5:78:90:AB"  , MAC);
    fail("12:34:56:7:90:AB"  , MAC);
    fail("12:34:56:78:9:AB"  , MAC);
    fail("12:34:56:78:90:A"  , MAC);

    fail("12:34:56:78:90:Ag" , MAC);
    fail("12:34:56:78:90:gB" , MAC);
    fail("12:34:56:78:9g:AB" , MAC);
    fail("12:34:56:78:g0:AB" , MAC);
    fail("12:34:56:7g:90:AB" , MAC);
    fail("12:34:56:g8:90:AB" , MAC);
    fail("12:34:5g:78:90:AB" , MAC);
    fail("12:34:g6:78:90:AB" , MAC);
    fail("12:3g:56:78:90:AB" , MAC);
    fail("12:g4:56:78:90:AB" , MAC);
    fail("1g:34:56:78:90:AB" , MAC);
    fail("g2:34:56:78:90:AB" , MAC);

    fail("12:34:56:78:90-AB" , MAC);
    fail("12:34:56:78-90:AB" , MAC);
    fail("12:34:56-78:90:AB" , MAC);
    fail("12:34-56:78:90:AB" , MAC);
    fail("12-34:56:78:90:AB" , MAC);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - IP]
  // --------------------------------------------------------------------------

  it("should validate ip - ipv4", function() {
    var IPV4 = exmodel.schema({
      $type: "ipv4"
    });

    var IPV4AllowPort = exmodel.schema({
      $type: "ipv4",
      $allowPort: true
    });

    var ipList = [
      "0.0.0.0",
      "1.1.1.1",
      "1.1.1.10",
      "1.1.10.1",
      "1.10.1.1",
      "10.1.1.1",
      "1.1.1.255",
      "1.1.255.1",
      "1.255.1.1",
      "255.1.1.1",
      "192.168.1.1",
      "255.255.255.255"
    ];

    ipList.forEach(function(ip) {
      pass(ip, IPV4);

      pass(ip + ":123"  , IPV4AllowPort);
      fail(ip + ":65536", IPV4AllowPort);

      fail(" " + ip, IPV4);
      fail(" " + ip, IPV4AllowPort);
      fail(ip + " ", IPV4);
      fail(ip + " ", IPV4AllowPort);
    });

    fail(true             , IPV4);
    fail("invalid"        , IPV4);

    fail("0"              , IPV4);
    fail("0.0"            , IPV4);
    fail("0.0.0"          , IPV4);

    fail("..."            , IPV4);
    fail("0..."           , IPV4);
    fail("0.0.."          , IPV4);
    fail("0.0.0."         , IPV4);
    fail(".0.0."          , IPV4);
    fail("..0."           , IPV4);

    fail("0.0.0.0."       , IPV4);
    fail("0.0.0.0 "       , IPV4);
    fail(".0.0.0.0"       , IPV4);
    fail(" 0.0.0.0"       , IPV4);
    fail("1.1.1..1"       , IPV4);
    fail("1.1..1.1"       , IPV4);
    fail("1..1.1.1"       , IPV4);
    fail("1.1.1.01"       , IPV4);
    fail("1.1.01.1"       , IPV4);
    fail("1.01.1.1"       , IPV4);
    fail("01.1.1.1"       , IPV4);
    fail("1.1.1.256"      , IPV4);
    fail("1.1.256.1"      , IPV4);
    fail("1.256.1.1"      , IPV4);
    fail("256.1.1.1"      , IPV4);
    fail("1.1.1.1000"     , IPV4);
    fail("1.1.1000.1"     , IPV4);
    fail("1.1000.1.1"     , IPV4);
    fail("1000.1.1.1"     , IPV4);
  });

  it("should validate ip - ipv6", function() {
    var IPV6 = exmodel.schema({
      $type: "ipv6"
    });

    var IPV6AllowPort = exmodel.schema({
      $type: "ipv6",
      $allowPort: true
    });

    var ipList = [
      "137F:F137:7F13:37F1:137F:F137:7F13:37F1",
      "137F:137F:137F:137F:137F:137F:137F::",
      "137F:137F:137F:137F:137F:137F::",
      "137F:137F:137F:137F:137F::",
      "137F:137F:137F:137F::",
      "137F:137F:137F::",
      "137F:137F::",
      "137F::",

      "::137F:137F:137F:137F:137F:137F:137F",
      "::137F:137F:137F:137F:137F:137F",
      "::137F:137F:137F:137F:137F",
      "::137F:137F:137F:137F",
      "::137F:137F:137F",
      "::137F:137F",
      "::137F",

      "1::2:3:4:5:6:7",
      "1:2::3:4:5:6:7",
      "1:2:3::4:5:6:7",
      "1:2:3:4::5:6:7",
      "1:2:3:4:5::6:7",
      "1:2:3:4:5:6::7",

      "::1",
      "1::"
    ];

    ipList.forEach(function(ip) {
      pass(ip, IPV6);

      pass("[" + ip + "]:123"  , IPV6AllowPort);
      fail("[" + ip + "]:65536", IPV6AllowPort);

      // Extra space is invalid.
      fail(" " + ip, IPV6);
      fail(" " + ip, IPV6AllowPort);
      fail(ip + " ", IPV6);
      fail(ip + " ", IPV6AllowPort);

      // Malformed, extra ":" is invalid.
      fail(":" + ip, IPV6);
      fail(":" + ip, IPV6AllowPort);
      fail(ip + ":", IPV6);
      fail(ip + ":", IPV6AllowPort);
    });

    // High level errors.
    fail(true                                       , IPV6);
    fail("invalid"                                  , IPV6);

    // Invalid HEX digit 'G'.
    fail("G37F:137F:137F:137F:137F:137F:137F:137F"  , IPV6);
    fail("137F:G37F:137F:137F:137F:137F:137F:137F"  , IPV6);
    fail("137F:137F:G37F:137F:137F:137F:137F:137F"  , IPV6);
    fail("137F:137F:137F:G37F:137F:137F:137F:137F"  , IPV6);
    fail("137F:137F:137F:137F:G37F:137F:137F:137F"  , IPV6);
    fail("137F:137F:137F:137F:137F:G37F:137F:137F"  , IPV6);
    fail("137F:137F:137F:137F:137F:137F:G37F:137F"  , IPV6);
    fail("137F:137F:137F:137F:137F:137F:137F:G37F"  , IPV6);

    // More than 4 HEX digits per component.
    fail("1137F:137F:137F:137F:137F:137F:137F:137F" , IPV6);
    fail("137F:1137F:137F:137F:137F:137F:137F:137F" , IPV6);
    fail("137F:137F:1137F:137F:137F:137F:137F:137F" , IPV6);
    fail("137F:137F:137F:1137F:137F:137F:137F:137F" , IPV6);
    fail("137F:137F:137F:137F:1137F:137F:137F:137F" , IPV6);
    fail("137F:137F:137F:137F:137F:1137F:137F:137F" , IPV6);
    fail("137F:137F:137F:137F:137F:137F:1137F:137F" , IPV6);
    fail("137F:137F:137F:137F:137F:137F:137F:1137F" , IPV6);

    // Leading / Trailing errors.
    fail(" 137F:137F:137F:137F:137F:137F:137F:137F" , IPV6);
    fail(":137F:137F:137F:137F:137F:137F:137F:137F" , IPV6);
    fail("::137F:137F:137F:137F:137F:137F:137F:137F", IPV6);

    fail("137F:137F:137F:137F:137F:137F:137F:137F " , IPV6);
    fail("137F:137F:137F:137F:137F:137F:137F:137F:" , IPV6);
    fail("137F:137F:137F:137F:137F:137F:137F:137F::", IPV6);

    // More than 8 components.
    fail("1:2:3:4:5:6:7:8:9"                        , IPV6);

    // Multiple collapse marks.
    fail("::1::"                                    , IPV6);
    fail("1:2::3:4::5:6"                            , IPV6);
    fail("::1:2:3::4:5"                             , IPV6);
    fail("1:2:3::4:5::"                             , IPV6);

    // Extra separators.
    fail("1:::"                                     , IPV6);
    fail(":::1"                                     , IPV6);
    fail("1:2:3:4:5:6:::"                           , IPV6);
    fail(":::1:2:3:4:5:6"                           , IPV6);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - UUID]
  // --------------------------------------------------------------------------

  it("should validate uuid", function() {
    var passData = [
      "123FABCD-12AF-398F-812F-F2AFFF9CF4F3",
      "12F4ABCD-12FB-39FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-3F8B-AF23-92FF3FFC14F3",
      "F234ABCD-F2AB-398F-B12F-92AF3F9F14FF",

      "123FABCD-12AF-498F-812F-F2AFFF9CF4F3",
      "12F4ABCD-12FB-49FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-4F8B-AF23-92FF3FFC14F3",
      "F234ABCD-F2AB-498F-B12F-92AF3F9F14FF",

      "123FABCD-12AF-598F-812F-F2AFFF9CF4F3",
      "12F4ABCD-12FB-59FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-5F8B-AF23-92FF3FFC14F3",
      "F234ABCD-F2AB-598F-B12F-92AF3F9F14FF"
    ];

    var failData = [
      "invalid",

      "X23FABCD-12AF-498F-812F-F2AFFF9CF4F3",
      "123FABCD-X2AF-498F-812F-F2AFFF9CF4F3",
      "123FABCD-12AF-X98F-812F-F2AFFF9CF4F3",
      "123FABCD-12AF-498F-X12F-F2AFFF9CF4F3",
      "123FABCD-12AF-498F-812F-X2AFFF9CF4F3",

      "123FABCD12AF-398F-812F-F2AFFF9CF4F3",
      "12F4ABCD-12FB39FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-3F8BAF23-92FF3FFC14F3",
      "F234ABCD-F2AB-398F-B12F92AF3F9F14FF",

      "123FABCD--12AF-398F-812F-F2AFFF9CF4F3",
      "12F4ABCD-12FB--39FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-3F8B--AF23-92FF3FFC14F3",
      "F234ABCD-F2AB-398F-B12F--92AF3F9F14FF",

      "-123FABCD-12AF-398F-812F-F2AFFF9CF4F3",
      "12F4-ABCD-12FB-39FB-91F3-9FAF3F9C1FF3",
      "1F34ABCD-1FAB-3F8B-AF23-92F-F3FFC14F3",
      "F234ABCD-F2AB-398F-B12F-92AF3F9F14-FF",

      " 123FABCD-12AF-598F-812F-F2AFFF9CF4F3",
      "123FABCD-12AF-598F-812F-F2AFFF9CF4F3 ",

      "{123FABCD-12AF-598F-812F-F2AFFF9CF4F3",
      "123FABCD-12AF-598F-812F-F2AFFF9CF4F3}",

      "(123FABCD-12AF-598F-812F-F2AFFF9CF4F3)",
      "[123FABCD-12AF-598F-812F-F2AFFF9CF4F3]"
    ];

    passData.forEach(function(value) {
      var version = value.charAt(14);

      pass(value, exmodel.schema({ $type: "uuid" }));
      pass(value, exmodel.schema({ $type: "uuid", $version: version       }));
      pass(value, exmodel.schema({ $type: "uuid", $version: version + "+" }));

      pass("{" + value + "}", exmodel.schema({ $type: "uuid", $format: "any"      }));
      pass("{" + value + "}", exmodel.schema({ $type: "uuid", $format: "windows"  }));

      fail("{" + value + "}", exmodel.schema({ $type: "uuid", $format: null       }));
      fail("{" + value + "}", exmodel.schema({ $type: "uuid", $format: "rfc"      }));
    });

    failData.forEach(function(value) {
      fail(value, exmodel.schema({ $type: "uuid" }));
      fail(value, exmodel.schema({ $type: "uuid", $format: "any"     }));
      fail(value, exmodel.schema({ $type: "uuid", $format: "rfc"     }));
      fail(value, exmodel.schema({ $type: "uuid", $format: "windows" }));
    });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - DateTime]
  // --------------------------------------------------------------------------

  it("should validate datetime - date", function() {
    var YYYY_MM    = exmodel.schema({ $type: "date", $format: "YYYY-MM" });
    var YYYY_MM_DD = exmodel.schema({ $type: "date" });

    pass("1968-08"   , YYYY_MM);
    pass("1968-08-20", YYYY_MM_DD);

    fail("0000-01"    , YYYY_MM);
    fail("1999-00"    , YYYY_MM);
    fail("1999-13"    , YYYY_MM);

    fail(""           , YYYY_MM_DD);
    fail("invalidDate", YYYY_MM_DD);
    fail("1999-01-01 ", YYYY_MM_DD);
    fail(" 1999-01-01", YYYY_MM_DD);

    fail("0000-01-01" , YYYY_MM_DD);
    fail("1999-00-01" , YYYY_MM_DD);
    fail("1999-01-00" , YYYY_MM_DD);
    fail("1999-01-32" , YYYY_MM_DD);
    fail("1999-02-29" , YYYY_MM_DD);
    fail("1999-13-01" , YYYY_MM_DD);
    fail("1999-01-0a" , YYYY_MM_DD);
    fail("1999-01-001", YYYY_MM_DD);
    fail("1999-01-01 ", YYYY_MM_DD);
  });

  it("should validate datetime - time", function() {
    var HH_mm       = exmodel.schema({ $type: "time", $format: "HH:mm" });
    var HH_mm_ss    = exmodel.schema({ $type: "time" });

    pass("14:53"   , HH_mm);
    pass("14:53:59", HH_mm_ss);

    fail("00:61"   , HH_mm);
    fail("24:59"   , HH_mm);
    fail("14:53:60", HH_mm);
    fail("14:53:61", HH_mm);

    fail("invalid" , HH_mm);
    fail("invalid" , HH_mm_ss);
  });

  it("should validate datetime - datetime", function() {
    var YYYY_MM_DD_HH_mm_ss = exmodel.schema({ $type: "datetime"    });
    var YYYY_MM_DD_HH_mm_ms = exmodel.schema({ $type: "datetime-ms" });
    var YYYY_MM_DD_HH_mm_us = exmodel.schema({ $type: "datetime-us" });

    pass("1968-08-20 12:00:59"       , YYYY_MM_DD_HH_mm_ss);
    pass("1968-08-20 12:00:59.999"   , YYYY_MM_DD_HH_mm_ms);
    pass("1968-08-20 12:00:59.999999", YYYY_MM_DD_HH_mm_us);

    fail("1968-08-20 24:00:00", YYYY_MM_DD_HH_mm_ss);
    fail("1968-08-20 23:60:00", YYYY_MM_DD_HH_mm_ss);
    fail("1968-08-20 23:59:60", YYYY_MM_DD_HH_mm_ss);

    fail("1968-08-20 24:00:00.000", YYYY_MM_DD_HH_mm_ms);
    fail("1968-08-20 23:60:00.000", YYYY_MM_DD_HH_mm_ms);
    fail("1968-08-20 23:59:60.000", YYYY_MM_DD_HH_mm_ms);

    fail("1968-08-20 24:00:00.000000", YYYY_MM_DD_HH_mm_us);
    fail("1968-08-20 23:60:00.000000", YYYY_MM_DD_HH_mm_us);
    fail("1968-08-20 23:59:60.000000", YYYY_MM_DD_HH_mm_us);
  });

  it("should validate datetime - leap year handling", function() {
    var YYYY_MM_DD = exmodel.schema({
      $type: "date"
    });

    var YYYY_MM_DD_no29thFeb = exmodel.schema({
      $type: "date",
      $leapYear: false
    });

    // `$leapYear` is true by default.
    pass("2000-02-29", YYYY_MM_DD);
    pass("2004-02-29", YYYY_MM_DD);
    pass("2008-02-29", YYYY_MM_DD);
    pass("2012-02-29", YYYY_MM_DD);
    pass("2016-02-29", YYYY_MM_DD);
    pass("2400-02-29", YYYY_MM_DD);

    // Disabled leap year.
    fail("2000-02-29", YYYY_MM_DD_no29thFeb);
    fail("2004-02-29", YYYY_MM_DD_no29thFeb);
    fail("2008-02-29", YYYY_MM_DD_no29thFeb);
    fail("2012-02-29", YYYY_MM_DD_no29thFeb);
    fail("2016-02-29", YYYY_MM_DD_no29thFeb);
    fail("2400-02-29", YYYY_MM_DD_no29thFeb);

    // Invalid leap year.
    fail("1999-02-29", YYYY_MM_DD);
    fail("2100-02-29", YYYY_MM_DD);
  });

  it("should validate datetime - leap second handling", function() {
    var YYYY_MM_DD_HH_mm_ss = exmodel.schema({
      $type: "datetime",
      $leapSecond: true
    });

    var MM_DD_HH_mm_ss = exmodel.schema({
      $type: "datetime",
      $format: "MM-DD HH:mm:ss",
      $leapSecond: true
    });

    var HH_mm_ss = exmodel.schema({
      $type: "time",
      $leapSecond: true
    });

    // DateTime with leap second.
    pass("1972-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    pass("1972-12-31 23:59:60", YYYY_MM_DD_HH_mm_ss);
    pass("2012-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);

    // Leap second without a year is allowed if `$leapSecond` is true.
    pass("06-30 23:59:60", MM_DD_HH_mm_ss);
    pass("12-31 23:59:60", MM_DD_HH_mm_ss);

    // Leap second without a date (YMD) is allowed if `$leapSecond` is true.
    pass("23:59:60", HH_mm_ss);
    pass("23:59:60", HH_mm_ss);

    // Leap seconds' dates are not defined from 1971 and below.
    fail("1971-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("1971-12-31 23:59:60", YYYY_MM_DD_HH_mm_ss);

    // Leap seconds' dates that are known to not have leap second.
    fail("1973-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("2013-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("2013-12-31 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("2014-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("2014-12-31 23:59:60", YYYY_MM_DD_HH_mm_ss);

    // Leap seconds' dates in far future are not known at the moment.
    fail("2100-06-30 23:59:60", YYYY_MM_DD_HH_mm_ss);
    fail("2100-12-31 23:59:60", YYYY_MM_DD_HH_mm_ss);

    // Leap seconds not allowed for these dates (regardless of year).
    fail("01-31 23:59:60", MM_DD_HH_mm_ss);
    fail("02-28 23:59:60", MM_DD_HH_mm_ss);
    fail("02-29 23:59:60", MM_DD_HH_mm_ss);
    fail("03-31 23:59:60", MM_DD_HH_mm_ss);
    fail("04-30 23:59:60", MM_DD_HH_mm_ss);
    fail("05-31 23:59:60", MM_DD_HH_mm_ss);
    fail("07-31 23:59:60", MM_DD_HH_mm_ss);
    fail("08-31 23:59:60", MM_DD_HH_mm_ss);
    fail("09-30 23:59:60", MM_DD_HH_mm_ss);
    fail("10-31 23:59:60", MM_DD_HH_mm_ss);
    fail("11-30 23:59:60", MM_DD_HH_mm_ss);
  });

  it("should validate datetime - valid custom format YYYYMMDD", function() {
    var def = exmodel.schema({ $type: "date", $format: "YYYYMMDD" });

    pass("19990101", def);
    pass("20041213", def);

    fail("invalid"  , def);
    fail("2011312"  , def);
    fail("20111312" , def);
    fail("20140132" , def);
    fail("20110101 ", def);
  });

  it("should validate datetime - valid custom format YYYYMMDD HHmmss", function() {
    var def = exmodel.schema({ $type: "date", $format: "YYYYMMDD HHmmss" });

    pass("19990101 013030" , def);
    pass("20041213 013030" , def);

    fail("invalid"         , def);
    fail("19990101 253030" , def);
    fail("19990101 016030" , def);
    fail("19990101 013060" , def);
    fail("2011312 013030"  , def);
    fail("20111312 013030" , def);
    fail("20140132 013030" , def);
    fail("20110101 013030 ", def);
  });

  it("should validate datetime - valid custom format D.M.Y", function() {
    var def = exmodel.schema({ $type: "date", $format: "D.M.Y" });

    pass("1.1.455"    , def);
    pass("2.8.2004"   , def);
    pass("20.12.2004" , def);

    fail("32.1.2004"  , def);
    fail("20.13.2004" , def);
    fail("20.13.10000", def);
  });

  it("should validate datetime - valid custom format D.M.Y H:m:s", function() {
    var def = exmodel.schema({ $type: "date", $format: "D.M.Y H:m:s" });

    pass("1.1.455 1:30:30"    , def);
    pass("2.8.2004 1:30:30"   , def);
    pass("20.12.2004 1:30:30" , def);

    fail("1.1.1999 12"        , def);
    fail("1.1.1999 12:"       , def);
    fail("1.1.1999 12:30"     , def);
    fail("1.1.1999 12:30:"    , def);
    fail("1.1.1999 25:30:30"  , def);
    fail("1.1.1999 1:60:30"   , def);
    fail("1.1.1999 1:30:60"   , def);
    fail("32.1.2004 1:30:30"  , def);
    fail("20.13.2004 1:30:30" , def);
    fail("20.13.10000 1:30:30", def);
  });

  it("should validate datetime - invalid custom format", function() {
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YD"            }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YM"            }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YMD"           }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "DMY"           }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YYYY-DD"       }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YYYY-MM-DD mm" }); });
    assertThrow(function() { exmodel.schema({ $type: "date", $format: "YYYY-MM-DD ss" }); });
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Object]
  // --------------------------------------------------------------------------

  it("should validate object - empty object", function() {
    var def = exmodel.schema({});

    pass({}, def);
    fail({ a: true }, def);
  });

  it("should validate object - mandatory fields", function() {
    var def = exmodel.schema({
      a: { $type: "bool"   },
      b: { $type: "int"    },
      c: { $type: "double" },
      d: { $type: "string" },
      nested: {
        a: { $type: "int", $min: 5, $max: 10 },
        b: { $type: "int", $null: true }
      }
    });

    pass({
      a: true,
      b: 1,
      c: 1.5,
      d: "string",
      nested: {
        a: 6,
        b: null
      }
    }, def);
  });

  it("should validate object - optional fields", function() {
    var def = exmodel.schema({
      a: { $type: "bool"  , $optional: true },
      b: { $type: "int"   , $optional: true },
      c: { $type: "double", $optional: true },
      d: { $type: "string", $optional: true },
      nested: {
        a: { $type: "int", $min: 5, $max: 10, $optional: true },
        b: { $type: "int", $null: true      , $optional: true }
      }
    });

    pass({ nested: {} }, def);
  });

  it("should validate object - special fields", function() {
    var def = exmodel.schema({
      constructor         : { $type: "string", $optional: true },
      hasOwnProperty      : { $type: "string", $optional: true },
      toString            : { $type: "string", $optional: true },
      propertyIsEnumerable: { $type: "string", $optional: true },
      __defineGetter__    : { $type: "string", $optional: true }
    });

    var none = {};
    var data = {
      constructor         : "1",
      hasOwnProperty      : "2",
      toString            : "3",
      propertyIsEnumerable: "4",
      __defineGetter__    : "5"
    };

    pass(none, def);
    pass(data, def);
  });

  it("should validate object - unicode fields", function() {
    var def = exmodel.schema({
      "\u0909": { $type: "string" },
      "\u0910": { $type: "string" }
    });

    pass({ "\u0909": "a", "\u0910": "b" }, def);
  });

  it("should validate object - escaped fields", function() {
    var def = exmodel.schema({
      "\\$type"  : { $type: "string" },
      "\\\\value": { $type: "string" }
    });

    pass({ "$type": "int", "\\value": "13" }, def);
  });

  it("should validate object - default fields", function() {
    var def = exmodel.schema({
      a: { $type: "bool"  , $default: true  },
      b: { $type: "int"   , $default: 42    },
      c: { $type: "double", $default: 3.14  },
      d: { $type: "string", $default: "exm" },
      e: { $type: "object", $default: {}    }
    });

    pass({}, def, 0, null, {
      a: true,
      b: 42,
      c: 3.14,
      d: "exm",
      e: {}
    });

    // exmodel.js should always copy all defaults.
    assert(exmodel.process({}, def, 0, null).e !==
           exmodel.process({}, def, 0, null).e);
  });

  it("should validate object - strict/extract", function() {
    var def = exmodel.schema({
      a: { $type: "bool" },
      nested: {
        b: { $type: "int" }
      }
    });

    var data = {
      a: true,
      nested: {
        b: 1
      }
    };

    var noise1 = cloneDeep(data);
    noise1.someNoise = true;

    var noise2 = cloneDeep(noise1);
    noise2.nested.anotherNoise = true;

    pass(noise1, def, exmodel.kExtractTop, null, data);
    pass(noise2, def, exmodel.kExtractAll, null, data);

    fail(noise1, def, exmodel.kNoOptions);
    fail(noise1, def, exmodel.kExtractNested);

    fail(noise2, def, exmodel.kNoOptions);
    fail(noise2, def, exmodel.kExtractTop);
  });

  it("should validate object - delta mode", function() {
    var def = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  },
      nested: {
        c: { $type: "string"   },
        d: { $type: "string[]" }
      }
    });

    pass({ a: true }, def, exmodel.kDeltaMode);
    pass({ b: 1234 }, def, exmodel.kDeltaMode);

    pass({ a: true, nested: {} }, def, exmodel.kDeltaMode);
    pass({ b: 1234, nested: {} }, def, exmodel.kDeltaMode);

    pass({ a: true, nested: { c: "exm"   } }, def, exmodel.kDeltaMode);
    pass({ b: 1234, nested: { d: ["qqq"] } }, def, exmodel.kDeltaMode);

    // This is just a delta mode, invalid properties shouldn't be allowed.
    fail({ invalid: true }, def);
    fail({ nested: { invalid: true } }, def);
  });

  it("should validate object - delta mode with $delta", function() {
    var def = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  },
      nested: {
        $delta: false,
        c: { $type: "string"   },
        d: { $type: "string[]" }
      }
    });

    pass({ a: true }, def, exmodel.kDeltaMode);
    pass({ b: 1234 }, def, exmodel.kDeltaMode);

    pass({ a: true, nested: { c: "exm", d: ["qqq" ] } }, def, exmodel.kDeltaMode);
    pass({ b: 1234, nested: { c: "exm", d: ["qqq" ] } }, def, exmodel.kDeltaMode);

    fail({ a: true, nested: {} }, def, exmodel.kDeltaMode);
    fail({ b: 1234, nested: {} }, def, exmodel.kDeltaMode);

    fail({ a: true, nested: { c: "exm"   } }, def, exmodel.kDeltaMode);
    fail({ b: 1234, nested: { d: ["qqq"] } }, def, exmodel.kDeltaMode);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Map]
  // --------------------------------------------------------------------------

  it("should validate map - any", function() {
    var def0 = exmodel.schema({
      $type: "map",
      $data: {
        $type: "any"
      }
    });

    pass({ a: 1, b: true, c: "exm", d: [[[1, 2], 3], 4] }, def0);
    fail(null, def0);
    fail({ a: null }, def0);

    var def1 = exmodel.schema({
      $type: "map",
      $null: true,
      $data: {
        $type: "any"
      }
    });

    pass({ a: 1, b: true, c: "exm", d: [[[1, 2], 3], 4] }, def1);
    pass(null, def1);
    fail({ a: null }, def1);

    var def2 = exmodel.schema({
      $type: "map",
      $null: true,
      $data: {
        $type: "any",
        $null: true
      }
    });

    pass({ a: 1, b: true, c: "exm", d: [[[1, 2], 3], 4] }, def2);
    pass(null, def2);
    pass({ a: null }, def2);
  });

  it("should validate map - types", function() {
    var def0 = exmodel.schema({
      $type: "map",
      $data: {
        $type: "int",
        $max: 50
      }
    });

    pass({ a: 0, b: 49 }, def0);
    fail({ a: 0, b: 51 }, def0);

    var def1 = exmodel.schema({
      $type: "map",
      $data: {
        $type: "string"
      }
    });

    pass({ a: "Hi", b: "Bye" }, def1);
    fail({ a: "Hi", b: null  }, def1);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Array]
  // --------------------------------------------------------------------------

  it("should validate array - nested values", function() {
    var specs = [
      { type: "bool"  , pass: [false, true]         , fail: [0, 1, "string", NaN, Infinity, [], {}] },
      { type: "int"   , pass: [-1, 0, 2, 3, 4]      , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "uint"  , pass: [ 0, 1, 2, 3, 4]      , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "number", pass: [-1.5, 0, 1.5, 1e100] , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "string", pass: ["", "a", "ab", "abc"], fail: [true, -1, 0, 1, NaN, Infinity, [], {}] }
    ];

    specs.forEach(function(spec) {
      [false, true].forEach(function(canBeNull) {
        var type = spec.type;

        var passData = spec.pass;
        var failData = spec.fail.concat([undefined]);

        var def = exmodel.schema({
          $type: "array",
          $data: {
            $type: type,
            $null: canBeNull ? true : false
          }
        });

        if (canBeNull)
          passData = passData.concat([null]);
        else
          failData = failData.concat([null]);

        passData.forEach(function(value) { pass([value], def); });
        failData.forEach(function(value) { fail([value], def); });
      });
    });
  });

  it("should validate array - nested objects", function() {
    var def = exmodel.schema({
      $type: "array",
      $data: {
        active: { $type: "bool", $null: true },
        nested: {
          position: { $type: "int" },
          nested: {
            $null: true,
            text: { $type: "string" }
          }
        }
      }
    });

    var data = [
      { active: true , nested: { position: 0, nested: { text: "some text 1" } } },
      { active: false, nested: { position: 1, nested: { text: "some text 2" } } },
      { active: null , nested: { position: 2, nested: null } }
    ];

    pass(data, def);
  });

  it("should validate array - length", function() {
    var defLen2 = exmodel.schema({
      $type: "array",
      $data: {
        $type: "int"
      },
      $length: 2
    });

    var defMin2 = exmodel.schema({
      $type: "array",
      $data: {
        $type: "int"
      },
      $minLength: 2
    });

    var defMax2 = exmodel.schema({
      $type: "array",
      $data: {
        $type: "int"
      },
      $maxLength: 2
    });

    pass([0, 1], defLen2);
    pass([0, 1], defMin2);
    pass([0, 1], defMax2);

    fail([0, 1, 2], defLen2);
    fail([1234567], defMin2);
    fail([0, 1, 2], defMax2);
  });

  // --------------------------------------------------------------------------
  // [SchemaType - Shortcuts]
  // --------------------------------------------------------------------------

  it("should handle shortcut '?'", function() {
    var def = exmodel.schema({
      a: { $type: "int"  },
      b: { $type: "int?" }
    });

    pass({ a: 0, b: 1    }, def);
    pass({ a: 0, b: null }, def);

    fail({ a: 0               }, def);
    fail({ a: null, b: 1      }, def);
    fail({ a: 0, b: undefined }, def);
    fail({ a: 0, b: "string"  }, def);
  });

  it("should handle shortcut '[]'", function() {
    var def0 = exmodel.schema({
      a: { $type: "int"   },
      b: { $type: "int[]" }
    });

    pass({ a: 0, b: [0]   }, def0);
    fail({ a: 0           }, def0);
    fail({ a: null, b: [] }, def0);
    fail({ a: 0, b: null  }, def0);
    fail({ a: 0, b: "s"   }, def0);
    fail({ a: 0, b: ["s"] }, def0);

    var def1 = exmodel.schema({
      a: { $type: "int[]", $optional: true }
    });

    pass({        }, def1);
    pass({ a: [0] }, def1);
  });

  it("should handle shortcut '[x..y]'", function() {
    var Exact  = exmodel.schema({ $type: "int[2]"    });
    var Min    = exmodel.schema({ $type: "int[2..]"  });
    var Max    = exmodel.schema({ $type: "int[..2]"  });
    var MinMax = exmodel.schema({ $type: "int[2..4]" });

    fail([]             , Exact);
    fail([0]            , Exact);
    pass([0, 1]         , Exact);
    fail([0, 1, 2]      , Exact);

    fail([]             , Min);
    fail([0]            , Min);
    pass([0, 1]         , Min);
    pass([0, 1, 2]      , Min);
    pass([0, 1, 2, 3]   , Min);

    pass([]             , Max);
    pass([0]            , Max);
    pass([0, 1]         , Max);
    fail([0, 1, 2]      , Max);
    fail([0, 1, 2, 3]   , Max);

    fail([]             , MinMax);
    fail([0]            , MinMax);
    pass([0, 1]         , MinMax);
    pass([0, 1, 2]      , MinMax);
    pass([0, 1, 2, 3]   , MinMax);
    fail([0, 1, 2, 3, 4], MinMax);
  });

  it("should handle shortcut '[]?'", function() {
    var def = exmodel.schema({
      a: { $type: "int"    },
      b: { $type: "int[]?" }
    });

    pass({ a: 0, b: []   }, def);
    pass({ a: 0, b: [0]  }, def);
    pass({ a: 0, b: null }, def);

    fail({ a: 0               }, def);
    fail({ a: null, b: []     }, def);
    fail({ a: 0, b: undefined }, def);
    fail({ a: 0, b: "s"       }, def);
    fail({ a: 0, b: ["s"]     }, def);
  });

  it("should handle shortcut '?[]?'", function() {
    var def = exmodel.schema({
      a: { $type: "int"     },
      b: { $type: "int?[]?" }
    });

    pass({ a: 0, b: []     }, def);
    pass({ a: 0, b: [0]    }, def);
    pass({ a: 0, b: null   }, def);
    pass({ a: 0, b: [null] }, def);

    fail({ a: 0               }, def);
    fail({ a: null, b: []     }, def);
    fail({ a: 0, b: undefined }, def);
    fail({ a: 0, b: "s"       }, def);
    fail({ a: 0, b: ["s"]     }, def);
  });

  it("should handle shortcut (invalid)", function() {
    assertThrow(function() { exmodel.schema({ $type: "int??"    }); });
    assertThrow(function() { exmodel.schema({ $type: "int??[]"  }); });
    assertThrow(function() { exmodel.schema({ $type: "int[]??"  }); });
    assertThrow(function() { exmodel.schema({ $type: "int?[]??" }); });
    assertThrow(function() { exmodel.schema({ $type: "int??[]?" }); });
  });

  // --------------------------------------------------------------------------
  // [Directive - $g]
  // --------------------------------------------------------------------------

  it("should enrich object - properties having $g", function() {
    var def0 = exmodel.schema({
      id         : { $type: "int" },
      type       : { $type: "int" },
      flags      : { $type: "int" },

      title      : { $type: "text", $g: "" }, // Normalized to "@default".
      description: { $type: "text", $g: "" },
      metadata   : { $type: "text", $g: undefined }
    });

    // If group is not specified everything goes to a "@default" group.
    assert.deepEqual(def0.$groupMap, {
      "@default": ["id", "type", "flags", "title", "description", "metadata"]
    });

    var def1 = exmodel.schema({
      id         : { $type: "int" , $g: "@info" },
      type       : { $type: "int" , $g: "@info" },
      flags      : { $type: "int" , $g: "@info" },

      title      : { $type: "text", $g: "@more" },
      description: { $type: "text", $g: "@more" },
      metadata   : { $type: "text", $g: null } // Won't be added to $groupMap.
    });

    // Handle groups specified/skipped.
    assert.deepEqual(def1.$groupMap, {
      "@info": ["id", "type", "flags"],
      "@more": ["title", "description"]
    });
  });

  // --------------------------------------------------------------------------
  // [Directive - $pk / $fk]
  // --------------------------------------------------------------------------

  it("should enrich object - properties having $pk and $fk", function() {
    var def0 = exmodel.schema({
      id         : { $type: "int", $pk: true            },
      userId     : { $type: "int", $fk: "users.userId"  },
      tagId      : { $type: "int", $fk: "tags.tagId"    }
    });

    assert.deepEqual(def0.$pkMap  , { id: true });
    assert.deepEqual(def0.$pkArray, ["id"]);

    assert.deepEqual(def0.$fkMap  , { userId: "users.userId", tagId: "tags.tagId" });
    assert.deepEqual(def0.$fkArray, ["userId", "tagId"]);

    assert.deepEqual(def0.$idMap  , { id: true, userId: true, tagId: true });
    assert.deepEqual(def0.$idArray, ["id", "userId", "tagId"]);
  });

  it("should enrich object - properties having $unique", function() {
    var def0 = exmodel.schema({
      id         : { $type: "int", $pk: true     },
      name       : { $type: "int", $unique: true },
      taxId      : { $type: "int", $unique: true }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def0.$uniqueArray),
      sortedArrayOfArrays([["id"], ["name"], ["taxId"]]));

    var def1 = exmodel.schema({
      id         : { $type: "int", $pk: true    },
      name       : { $type: "int", $unique: "nameAndTax" },
      taxId      : { $type: "int", $unique: "nameAndTax" }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def1.$uniqueArray),
      sortedArrayOfArrays([["id"], ["name", "taxId"]]));

    var def2 = exmodel.schema({
      userId     : { $type: "int"   , $pk: true, $unique: "name|id" },
      tagId      : { $type: "int"   , $pk: true, $unique: "id"      },
      tagName    : { $type: "string"           , $unique: "name"    }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def2.$uniqueArray),
      sortedArrayOfArrays([["tagId", "userId"], ["tagName", "userId"]]));

    var def3 = exmodel.schema({
      a: { $type: "int", $unique: "ac|ad" },
      b: { $type: "int", $unique: true    },
      c: { $type: "int", $unique: "ac"    },
      d: { $type: "int", $unique: "ad"    }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def3.$uniqueArray),
      sortedArrayOfArrays([["a", "c"], ["a", "d"], ["b"]]));
  });

  // --------------------------------------------------------------------------
  // [Extend]
  // --------------------------------------------------------------------------

  it("should extend schema - use as nested (directly)", function() {
    var nestedDef = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var rootDef = exmodel.schema({
      nested: nestedDef
    });

    pass({ nested: { a: true, b: 1234 } }, rootDef);
  });

  it("should extend schema - use as nested ($extend)", function() {
    var nestedDef = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var rootDef = exmodel.schema({
      nested: {
        $extend: nestedDef
      }
    });

    pass({ nested: { a: true, b: 1234 } }, rootDef);
  });

  it("should extend schema - add field", function() {
    var def0 = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var def1 = exmodel.schema({
      $extend: def0,
      c: { $type: "string" }
    });

    var def2 = exmodel.schema({
      $extend: def1,
      d: { $type: "string[]" }
    });

    pass({ a: true, b: 1234                       }, def0);
    pass({ a: true, b: 1234, c: "exm"             }, def1);
    pass({ a: true, b: 1234, c: "exm", d: ["qqq"] }, def2);
  });

  it("should extend schema - delete field", function() {
    var def0 = exmodel.schema({
      a: { $type: "bool"     },
      b: { $type: "int"      },
      c: { $type: "string"   },
      d: { $type: "string[]" }
    });

    var def1 = exmodel.schema({
      $extend: def0,
      d: undefined
    });

    var def2 = exmodel.schema({
      $extend: def1,
      c: undefined
    });

    pass({ a: true, b: 1234, c: "exm", d: ["qqq"] }, def0);
    pass({ a: true, b: 1234, c: "exm"             }, def1);
    pass({ a: true, b: 1234                       }, def2);

    fail({ a: true, b: 1234, c: "exm", d: ["qqq"] }, def1);
    fail({ a: true, b: 1234, c: "exm"             }, def2);
  });

  it("should extend schema - delete nonexisting field", function() {
    var def0 = exmodel.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var def1 = exmodel.schema({
      $extend: def0,
      nonExisting: undefined
    });

    pass({ a: true, b: 1234 }, def1);
  });

  it("should extend schema - modify field (optional)", function() {
    var def0 = exmodel.schema({
      a: { $type: "bool"   },
      b: { $type: "int"    },
      c: { $type: "string", $optional: true }
    });

    var def1 = exmodel.schema({
      $extend: def0,
      a: { $optional: true  },
      b: { $optional: undefined },
      c: { $optional: false }
    });

    pass({ a: true, b: 1234           }, def0);
    pass({ a: true, b: 1234, c: "exm" }, def0);

    pass({ a: true, b: 1234, c: "exm" }, def1);
    pass({          b: 1234, c: "exm" }, def1);

    fail({ a: true, b: 1234           }, def1);
    fail({          b: 1234           }, def1);
  });

  // --------------------------------------------------------------------------
  // [Include]
  // --------------------------------------------------------------------------

  it("should include", function() {
    var MData1 = {
      a: { $type: "bool" },
      b: { $type: "int"  }
    };

    var MData2 = { c: { $type: "bool" } };
    var MData3 = { d: { $type: "int"  } };

    var def = exmodel.schema({
      some: { $type: "string" },
      $include0: MData1,
      $include1: [MData2, MData3]
    });

    pass({ some: "some", a: false, b: 42, c: true, d: 42 }, def);

    // Prevent inclusion of property that already exists.
    assertThrow(function() { exmodel.schema({ a: { $type: "bool" }, $include: MData1 }); });
    assertThrow(function() { exmodel.schema({ $include: MData1, a: { $type: "bool" } }); });

    assertThrow(function() { exmodel.schema({ $include: [MData1, MData1] }); });
    assertThrow(function() { exmodel.schema({ $include0: MData1, $include1: MData1 }); });
  });

  // --------------------------------------------------------------------------
  // [Access]
  // --------------------------------------------------------------------------

  it("should validate access rights - write one", function() {
    var def = exmodel.schema({
      a: { $type: "bool"     , $r: "*", $w: "basic" },
      b: { $type: "int"      , $r: "*", $w: "basic" },
      c: { $type: "string"   , $r: "*", $w: "basic" },
      d: { $type: "object"   , $r: "*", $w: "extra" },
      e: { $type: "string[]" , $r: "*", $w: "extra" }
    });

    var data = {
      a: true,
      b: 0,
      c: "exm",
      d: {},
      e: ["test"]
    };

    // `null` disables access rights checking (the default).
    pass(data, def, exmodel.kNoOptions, null, data);
    pass(data, def, exmodel.kNoOptions, { basic: true, extra: true }, data);

    // Empty object means enabled access rights checks, but no access rights.
    fail(data, def, exmodel.kNoOptions, {});

    // Incomplete access rights.
    fail(data, def, exmodel.kNoOptions, { basic: true });
    fail(data, def, exmodel.kNoOptions, { extra: true });

    // Delta mode cares only about access rights required by the fields specified.
    pass({ a: true                        }, def, exmodel.kDeltaMode, { basic: true });
    pass({ a: true, b: 0                  }, def, exmodel.kDeltaMode, { basic: true });
    pass({ a: true, b: 0, c: "s"          }, def, exmodel.kDeltaMode, { basic: true });
    pass({ d: {}                          }, def, exmodel.kDeltaMode, { extra: true });
    pass({ e: []                          }, def, exmodel.kDeltaMode, { extra: true });

    // No access.
    fail({ a: true, b: 0, c: "s", d: null }, def, exmodel.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", d: {}   }, def, exmodel.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", e: null }, def, exmodel.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", e: []   }, def, exmodel.kDeltaMode, { basic: true });
    fail({ a: true                        }, def, exmodel.kDeltaMode, { extra: true });
    fail({ a: true, b: 0                  }, def, exmodel.kDeltaMode, { extra: true });
    fail({ a: true, b: 0, c: "s"          }, def, exmodel.kDeltaMode, { extra: true });
  });

  it("should validate access rights - write a|b", function() {
    var def = exmodel.schema({
      a: { $type: "int", $r: "*", $w: "a"   },
      b: { $type: "int", $r: "*", $w: "a|b" },
      c: { $type: "int", $r: "*", $w: "a|c" },
      d: { $type: "int", $r: "*", $w: "b|c" }
    });

    var data = {
      a: 0,
      b: 1,
      c: 2,
      d: 3
    };

    // `null` disables access rights checking (the default).
    pass(data, def, exmodel.kNoOptions, null);
    pass(data, def, exmodel.kNoOptions, { a: true, b: true });
    pass(data, def, exmodel.kNoOptions, { a: true, c: true });
    fail(data, def, exmodel.kNoOptions, { b: true, c: true });

    pass({ a: 0 }, def, exmodel.kDeltaMode, { a: true });
    pass({ b: 0 }, def, exmodel.kDeltaMode, { a: true });
    pass({ b: 0 }, def, exmodel.kDeltaMode, { b: true });
    pass({ c: 0 }, def, exmodel.kDeltaMode, { a: true });
    pass({ c: 0 }, def, exmodel.kDeltaMode, { c: true });
    pass({ d: 0 }, def, exmodel.kDeltaMode, { b: true });
    pass({ d: 0 }, def, exmodel.kDeltaMode, { c: true });

    fail({ a: 0 }, def, exmodel.kDeltaMode, { b: true });
    fail({ b: 0 }, def, exmodel.kDeltaMode, { c: true });
    fail({ c: 0 }, def, exmodel.kDeltaMode, { b: true });
    fail({ d: 0 }, def, exmodel.kDeltaMode, { a: true });
  });

 it("should validate access rights - write inherit", function() {
    var def = exmodel.schema({
      $r: "*", $w: "user|admin",
      nested: {
        a           : { $type: "int", $r: "*"                      }, // Inherit.
        b           : { $type: "int", $r: "*", $w: "inherit"       }, // Inherit.
        onlyUser    : { $type: "int", $r: "*", $w: "user"          }, // Only user.
        onlyAdmin   : { $type: "int", $r: "*", $w: "admin"         }, // Only admin.
        inheritUser : { $type: "int", $r: "*", $w: "user|inherit"  }, // User/Inherit  -> User|Admin.
        inheritAdmin: { $type: "int", $r: "*", $w: "admin|inherit" }, // Admin/Inherit -> User|Admin
        none        : { $type: "int", $r: "*", $w: "none"          }  // None
      }
    });

    var data0 = {
      nested: {
        a: 0,
        b: 1
      }
    };

    pass(data0, def, exmodel.kDeltaMode, null);
    pass(data0, def, exmodel.kDeltaMode, { user: true });
    pass(data0, def, exmodel.kDeltaMode, { admin: true });
    fail(data0, def, exmodel.kDeltaMode, {});

    var data1 = {
      nested: {
        a: 0,
        b: 1,
        onlyUser: 2,
        inheritUser: 3
      }
    };

    pass(data1, def, exmodel.kDeltaMode, null);
    pass(data1, def, exmodel.kDeltaMode, { user: true });
    fail(data1, def, exmodel.kDeltaMode, {});
    fail(data1, def, exmodel.kDeltaMode, { admin: true });

    var data2 = {
      nested: {
        a: 0,
        b: 1,
        onlyAdmin: 2,
        inheritAdmin: 3
      }
    };

    pass(data2, def, exmodel.kDeltaMode, null);
    pass(data2, def, exmodel.kDeltaMode, { admin: true });
    fail(data2, def, exmodel.kDeltaMode, {});
    fail(data2, def, exmodel.kDeltaMode, { user: true });

    var data3 = {
      nested: {
        a: 0,
        b: 1,
        onlyUser: 2,
        onlyAdmin: 3
      }
    };

    pass(data3, def, exmodel.kDeltaMode, null);
    pass(data3, def, exmodel.kDeltaMode, { admin: true, user: true });
    fail(data3, def, exmodel.kDeltaMode, {});
    fail(data3, def, exmodel.kDeltaMode, { user: true });
    fail(data3, def, exmodel.kDeltaMode, { admin: true });

    var data4 = {
      nested: {
        none: 5
      }
    };

    pass(data4, def, exmodel.kDeltaMode, null);
    fail(data4, def, exmodel.kDeltaMode, {});
    fail(data4, def, exmodel.kDeltaMode, { user: true });
    fail(data4, def, exmodel.kDeltaMode, { admin: true });
    fail(data4, def, exmodel.kDeltaMode, { admin: true, user: true });
  });

  it("should validate access rights - invalid expression ($r / $w)", function() {
    var invalid = [
      "__proto__", "**",
      "|", " |", "| ", "||", " || ",
      "&", " &", "& ", "&&", " && ",
      "|a", "a|", "a|b|",
      "|@", "@|", "@|@|"
    ];

    invalid.forEach(function(access) {
      assertThrow(function() { exmodel.schema({ field: { $type: "int", $a: access } }); });
      assertThrow(function() { exmodel.schema({ field: { $type: "int", $r: access } }); });
      assertThrow(function() { exmodel.schema({ field: { $type: "int", $w: access } }); });
    });
  });

  // --------------------------------------------------------------------------
  // [...]
  // --------------------------------------------------------------------------

  it("should accumulate errors", function() {
    var def = exmodel.schema({
      a: { $type: "bool"   },
      b: { $type: "int"    },
      c: { $type: "double" },
      d: { $type: "string" },
      nested: {
        a: { $type: "int", $min: 5, $max: 10 },
        b: { $type: "int", $null: true }
      }
    });

    var data = {
      a: "invalid",
      b: "invalid",
      c: "invalid",
      d: 0,
      nested: {
        a: "invalid",
        b: "invalid"
      }
    };

    var out = null;
    var err;

    try {
      out = exmodel.process(data, def, exmodel.kAccumulateErrors);
    }
    catch (err) {
      assert(err instanceof exmodel.SchemaError, "Error thrown 'SchemaError' instance.");
      assert.deepEqual(err.errors, [
        { code: "ExpectedBoolean", path: "a" },
        { code: "ExpectedNumber" , path: "b" },
        { code: "ExpectedNumber" , path: "c" },
        { code: "ExpectedString" , path: "d" },
        { code: "ExpectedNumber" , path: "nested.a" },
        { code: "ExpectedNumber" , path: "nested.b" }
      ]);
    }

    if (out)
      throw new Error("Should have thrown exception.");
  });

  it("should refuse schema with some semantic errors", function() {
    assertThrow(function() { exmodel.schema({ $type: "invalid"               }); });
    assertThrow(function() { exmodel.schema({ $type: "object", $null: 55     }); });
  });
});
