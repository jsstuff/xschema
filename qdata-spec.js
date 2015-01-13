// QData <https://github.com/jshq/qdata>
"use strict";

var assert = require("assert");
var qclass = require("qclass");
var qdata = require("./qdata");

var deepCopy = qdata.deepCopy;
var deepEqual = qdata.deepEqual;

function TestError(message, schema, input, output, expected) {
  var e = Error(message);
  var s = "TestError: " + message + "\n";

  if (arguments.length > 1) s += "schema = "   + JSON.stringify(schema  , null, 2) + "\n";
  if (arguments.length > 2) s += "input = "    + JSON.stringify(input   , null, 2) + "\n";
  if (arguments.length > 3) s += "output = "   + JSON.stringify(output  , null, 2) + "\n";
  if (arguments.length > 4) s += "expected = " + JSON.stringify(expected, null, 2) + "\n";

  console.log("\n" + s);

  this.name = "TestError";
  this.message = s;
  this.stack = e.stack;
}
qclass({
  $extend: Error,
  $construct: TestError
});

function pass(input, schema, options, access, expected) {
  var output = null;
  var err = null;

  var fn = null;

  if (err)
    throw err;

  try {
    output = qdata.process(input, schema, options, access);
  }
  catch (ex) {
    console.log("Schema Validation Failed:");
    console.log(JSON.stringify(schema, null, 2));
    console.log("\n" + fn.toString());
    err = ex;
  }

  if (err)
    throw err;

  if (arguments.length <= 4)
    expected = input;

  if (!deepEqual(output, expected)) {
    console.log("\n" + fn.toString());
    if (arguments.length <= 4)
      throw new TestError("Result didn't match the input data.", schema, input, output);
    else
      throw new TestError("Result didn't match the input data.", schema, input, output, expected);
  }
}

function fail(input, schema, options) {
  var output = null;

  try {
    output = qdata.process(input, schema, options);
  }
  catch (ex) {
    return;
  }

  throw new TestError("Validation should have failed", schema, input, output);
}

function assertThrow(fn) {
  try {
    fn();
  } catch (ex) {
    return;
  }

  throw new Error("Should have thrown exception.");
}

describe("QData", function() {
  it("should test utilities - deep equal", function() {
    // Basics.
    assert(deepEqual(null     , null     ));
    assert(deepEqual(undefined, undefined));
    assert(deepEqual(true     , true     ));
    assert(deepEqual(false    , false    ));
    assert(deepEqual(0        , 0        ));
    assert(deepEqual(0.10     , 0.10     ));
    assert(deepEqual(""       , ""       ));
    assert(deepEqual("string" , "string" ));
    assert(deepEqual(Infinity , Infinity ));
    assert(deepEqual(-Infinity, -Infinity));
    assert(deepEqual(NaN      , NaN      ));
    assert(deepEqual({ a: 0 } , { a: 0 } ));
    assert(deepEqual([0, 1, 2], [0, 1, 2]));

    assert(!deepEqual(null, undefined));
    assert(!deepEqual(undefined, null));

    assert(!deepEqual(0, "0"));
    assert(!deepEqual("0", 0));

    assert(!deepEqual(false, "false"));
    assert(!deepEqual("true", true));

    assert(!deepEqual("", null));
    assert(!deepEqual(null, ""));

    assert(!deepEqual(0, null));
    assert(!deepEqual(null, 0));

    assert(!deepEqual(null, {}));
    assert(!deepEqual({}, null));

    assert(!deepEqual(null, []));
    assert(!deepEqual([], null));

    assert(!deepEqual({ a: undefined }, {}));
    assert(!deepEqual({}, { a: undefined }));

    assert(!deepEqual({}, []));
    assert(!deepEqual([], {}));

    // Object equality.
    assert(deepEqual({
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

    assertThrow(function() { deepEqual(aCyclic, bCyclic); });
    assertThrow(function() { deepEqual(bCyclic, aCyclic); });
  });

  it("should test utilities - deep copy", function() {
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
    var copy = deepCopy(orig);

    assert(deepEqual(copy, orig));
    assert(copy !== orig);
    assert(copy.e !== orig.e);
    assert(copy.f !== orig.f);
    assert(copy.e.a !== orig.e.a);
    assert(copy.e.a[0] !== orig.e.a[0]);
    assert(copy.e.a[1] !== orig.e.a[1]);
  });

  it("should test utilities - string operations", function() {
    assert(qdata.util.isPropertyName("$")           === true);
    assert(qdata.util.isPropertyName("$property")   === true);
    assert(qdata.util.isPropertyName("")            === false);
    assert(qdata.util.isPropertyName("fieldName")   === false);

    assert(qdata.util.isVariableName("someVar")     === true);
    assert(qdata.util.isVariableName("SomeVar")     === true);
    assert(qdata.util.isVariableName("$someVar")    === true);
    assert(qdata.util.isVariableName("_someVar")    === true);
    assert(qdata.util.isVariableName("$1")          === true);
    assert(qdata.util.isVariableName("$$")          === true);
    assert(qdata.util.isVariableName("1")           === false);
    assert(qdata.util.isVariableName("1$NotAVar")   === false);
    assert(qdata.util.isVariableName("1_NotAVar")   === false);

    assert(qdata.util.escapeRegExp("[]{}")          === "\\[\\]\\{\\}");

    assert(qdata.util.unescapeFieldName("field")    === "field");
    assert(qdata.util.unescapeFieldName("\\$field") === "$field");

    assert(qdata.util.toCamelCase("ThisIsString")   === "thisIsString");
    assert(qdata.util.toCamelCase("this-is-string") === "thisIsString");
    assert(qdata.util.toCamelCase("THIS_IS_STRING") === "thisIsString");
    assert(qdata.util.toCamelCase("this-isString")  === "thisIsString");
    assert(qdata.util.toCamelCase("THIS_IsSTRING")  === "thisIsString");
  });

  it("should test enumeration", function() {
    // Enum - safe, unique, and sequential.
    var AnimalDef = {
      Horse: 0,
      Dog: 1,
      Cat: 2,
      Mouse: 4,
      Hamster: 3
    };
    var AnimalEnum = qdata.enum(AnimalDef);

    assert(AnimalEnum.Horse   === 0);
    assert(AnimalEnum.Dog     === 1);
    assert(AnimalEnum.Cat     === 2);
    assert(AnimalEnum.Hamster === 3);
    assert(AnimalEnum.Mouse   === 4);

    assert(AnimalEnum.$hasKey("Horse"          ) === true);
    assert(AnimalEnum.$hasKey("Mouse"          ) === true);
    assert(AnimalEnum.$hasKey("constructor"    ) === false);
    assert(AnimalEnum.$hasKey("hasOwnProperty" ) === false);

    assert(AnimalEnum.$keyToValue("Horse"      ) === AnimalEnum.Horse  );
    assert(AnimalEnum.$keyToValue("Dog"        ) === AnimalEnum.Dog    );
    assert(AnimalEnum.$keyToValue("Cat"        ) === AnimalEnum.Cat    );
    assert(AnimalEnum.$keyToValue("Hamster"    ) === AnimalEnum.Hamster);
    assert(AnimalEnum.$keyToValue("Mouse"      ) === AnimalEnum.Mouse  );
    assert(AnimalEnum.$keyToValue("constructor") === undefined);

    assert(AnimalEnum.$valueToKey(AnimalEnum.Horse  ) === "Horse"  );
    assert(AnimalEnum.$valueToKey(AnimalEnum.Dog    ) === "Dog"    );
    assert(AnimalEnum.$valueToKey(AnimalEnum.Cat    ) === "Cat"    );
    assert(AnimalEnum.$valueToKey(AnimalEnum.Hamster) === "Hamster");
    assert(AnimalEnum.$valueToKey(AnimalEnum.Mouse  ) === "Mouse"  );

    assert(AnimalEnum.$valueToKey(5)   === undefined);
    assert(AnimalEnum.$valueToKey(-1)  === undefined);
    assert(AnimalEnum.$valueToKey("0") === undefined);

    assert(deepEqual(AnimalEnum.$keyMap, AnimalDef));
    assert(deepEqual(AnimalEnum.$keyList, [
      "Horse",
      "Dog",
      "Cat",
      "Mouse",
      "Hamster"
    ]));

    assert(deepEqual(AnimalEnum.$valueMap, {
      "0": "Horse",
      "1": "Dog",
      "2": "Cat",
      "3": "Hamster",
      "4": "Mouse"
    }));
    assert(deepEqual(AnimalEnum.$valueList, [
      0, 1, 2, 3, 4
    ]));

    assert(AnimalEnum.$min === 0);
    assert(AnimalEnum.$max === 4);
    assert(AnimalEnum.$safe === true);
    assert(AnimalEnum.$unique === true);
    assert(AnimalEnum.$sequential === true);

    // Enum - safe, unique, and non-sequential.
    var TypeIdUniqueDef = {
      String: 1299,
      Number: 3345,
      Object: 6563,
      Array : 1234
    };
    var TypeIdUniqueEnum = qdata.enum(TypeIdUniqueDef);

    assert(TypeIdUniqueEnum.$keyToValue("String") === TypeIdUniqueEnum.String);
    assert(TypeIdUniqueEnum.$keyToValue("Number") === TypeIdUniqueEnum.Number);
    assert(TypeIdUniqueEnum.$keyToValue("Object") === TypeIdUniqueEnum.Object);
    assert(TypeIdUniqueEnum.$keyToValue("Array" ) === TypeIdUniqueEnum.Array );

    assert(TypeIdUniqueEnum.$valueToKey(TypeIdUniqueEnum.String) === "String");
    assert(TypeIdUniqueEnum.$valueToKey(TypeIdUniqueEnum.Number) === "Number");
    assert(TypeIdUniqueEnum.$valueToKey(TypeIdUniqueEnum.Object) === "Object");
    assert(TypeIdUniqueEnum.$valueToKey(TypeIdUniqueEnum.Array ) === "Array" );

    assert(TypeIdUniqueEnum.$min === 1234);
    assert(TypeIdUniqueEnum.$max === 6563);
    assert(TypeIdUniqueEnum.$safe === true);
    assert(TypeIdUniqueEnum.$unique === true);
    assert(TypeIdUniqueEnum.$sequential === false);

    // Enum - safe, non-unique, and non-sequential.
    var TypeIdNonUniqueDef = {
      String: 1299,
      Number: 3345,
      Object: 6563, // Same as Array
      Array : 6563  // Same as Object, but value should be mapped to "Object".
    };
    var TypeIdNonUniqueEnum = qdata.enum(TypeIdNonUniqueDef);

    assert(TypeIdNonUniqueEnum.$keyToValue("String") === TypeIdNonUniqueEnum.String);
    assert(TypeIdNonUniqueEnum.$keyToValue("Number") === TypeIdNonUniqueEnum.Number);
    assert(TypeIdNonUniqueEnum.$keyToValue("Object") === TypeIdNonUniqueEnum.Object);
    assert(TypeIdNonUniqueEnum.$keyToValue("Array" ) === TypeIdNonUniqueEnum.Array );

    assert(TypeIdNonUniqueEnum.$valueToKey(TypeIdNonUniqueEnum.String) === "String");
    assert(TypeIdNonUniqueEnum.$valueToKey(TypeIdNonUniqueEnum.Number) === "Number");
    assert(TypeIdNonUniqueEnum.$valueToKey(TypeIdNonUniqueEnum.Object) === "Object");

    // Array share the same value as Object, but Object has been defined first,
    // so Array value has to map to "Object" string.
    assert(TypeIdNonUniqueEnum.$valueToKey(TypeIdNonUniqueEnum.Array ) === "Object");

    assert(deepEqual(TypeIdNonUniqueEnum.$valueMap, {
      "1299": "String",
      "3345": "Number",
      "6563": "Object"
    }));
    assert(deepEqual(TypeIdNonUniqueEnum.$valueList, [1299, 3345, 6563]));

    assert(TypeIdNonUniqueEnum.$min === 1299);
    assert(TypeIdNonUniqueEnum.$max === 6563);
    assert(TypeIdNonUniqueEnum.$safe === true);
    assert(TypeIdNonUniqueEnum.$unique === false);
    assert(TypeIdNonUniqueEnum.$sequential === false);

    // Enum - unsafe.
    assert(qdata.enum({ A:-1.1                   }).$safe === false);
    assert(qdata.enum({ A: 1.1                   }).$safe === false);
    assert(qdata.enum({ A: 1234.1234             }).$safe === false);
    assert(qdata.enum({ A: qdata.kSafeIntMin - 2 }).$safe === false);
    assert(qdata.enum({ A: qdata.kSafeIntMax + 2 }).$safe === false);

    // Enum - using reserved property names (Object.prototype properties).
    var ReservedDef = {
      constructor: 0,
      hasOwnProperty: 1,
      __defineGetter__: 2,
      toSource: 3,
      toString: 4,
      valueOf: 5
    };
    var ReservedEnum = qdata.enum(ReservedDef);

    assert(deepEqual(ReservedEnum.$keyMap, ReservedDef));

    assert(ReservedEnum.$hasKey("constructor"         ) === true );
    assert(ReservedEnum.$hasKey("__defineGetter__"    ) === true );
    assert(ReservedEnum.$hasKey("valueOf"             ) === true );
    assert(ReservedEnum.$hasKey("propertyIsEnumerable") === false);

    assert(ReservedEnum.$keyToValue("constructor"         ) === 0);
    assert(ReservedEnum.$keyToValue("__defineGetter__"    ) === 2);
    assert(ReservedEnum.$keyToValue("valueOf"             ) === 5);
    assert(ReservedEnum.$keyToValue("propertyIsEnumerable") === undefined);

    // Enum - non-numeric values are not allowed.
    assertThrow(function() { qdata.enum({ infinityValue  : Infinity }); });
    assertThrow(function() { qdata.enum({ infinityValue  :-Infinity }); });
    assertThrow(function() { qdata.enum({ nanValue       : NaN      }); });
    assertThrow(function() { qdata.enum({ booleanValue   : false    }); });
    assertThrow(function() { qdata.enum({ booleanValue   : true     }); });
    assertThrow(function() { qdata.enum({ stringValue    : "1"      }); });
    assertThrow(function() { qdata.enum({ objectValue    : {}       }); });
    assertThrow(function() { qdata.enum({ arrayValue     : []       }); });
    assertThrow(function() { qdata.enum({ $reservedKey   : 1        }); });
  });

  it("should validate null/undefined", function() {
    ["bool", "int", "number", "string", "text", "date", "datetime", "object"].forEach(function(type) {
      pass(null     , qdata.schema({ $type: type, $null: true, $undefined: true }));
      pass(undefined, qdata.schema({ $type: type, $null: true, $undefined: true }));

      pass(null     , qdata.schema({ $type: type, $null: true      }));
      pass(undefined, qdata.schema({ $type: type, $undefined: true }));

      fail(undefined, qdata.schema({ $type: type, $null: true      }));
      fail(null     , qdata.schema({ $type: type, $undefined: true }));
    });
  });

  it("should validate bool", function() {
    var Schema = qdata.schema({ $type: "bool" });

    var passData = [false, true];
    var failData = [0, 1, "", "string", {}, [], Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, Schema); });
    failData.forEach(function(value) { fail(value, Schema); });
  });

  it("should validate number - int", function() {
    var Schema = qdata.schema({ $type: "int" });

    var passData = [0, 1, -1];
    var failData = [false, true, "", "0", "string", {}, [], 0.1, -0.23211, Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, Schema); });
    failData.forEach(function(value) { fail(value, Schema); });
  });

  it("should validate number - intxx", function() {
    pass(-128       , qdata.schema({ $type: "int8"  }));
    pass( 127       , qdata.schema({ $type: "int8"  }));
    pass( 255       , qdata.schema({ $type: "uint8" }));

    pass(-32768     , qdata.schema({ $type: "int16"  }));
    pass( 32767     , qdata.schema({ $type: "int16"  }));
    pass( 65535     , qdata.schema({ $type: "uint16" }));

    pass(-2147483648, qdata.schema({ $type: "int32"  }));
    pass( 2147483647, qdata.schema({ $type: "int32"  }));
    pass( 4294967295, qdata.schema({ $type: "uint32" }));

    fail(-129       , qdata.schema({ $type: "int8"  }));
    fail( 128       , qdata.schema({ $type: "int8"  }));
    fail(-1         , qdata.schema({ $type: "uint8" }));
    fail( 256       , qdata.schema({ $type: "uint8" }));

    fail(-32769     , qdata.schema({ $type: "int16"  }));
    fail( 32768     , qdata.schema({ $type: "int16"  }));
    fail(-1         , qdata.schema({ $type: "uint16" }));
    fail( 65536     , qdata.schema({ $type: "uint16" }));

    fail(-2147483649, qdata.schema({ $type: "int32"  }));
    fail( 2147483648, qdata.schema({ $type: "int32"  }));
    fail(-1         , qdata.schema({ $type: "uint32" }));
    fail( 4294967296, qdata.schema({ $type: "uint32" }));
  });

  it("should validate number - double", function() {
    var Schema = qdata.schema({ $type: "number" });

    var valuesToPass = [0, 1, -1, 0.1, -0.23211];
    var valuesToFail = [false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN];

    valuesToPass.forEach(function(value) { pass(value, Schema); });
    valuesToFail.forEach(function(value) { fail(value, Schema); });
  });

  it("should validate number - lat/lon", function() {
    var SchemaLat = qdata.schema({ $type: "lat" });
    var SchemaLon = qdata.schema({ $type: "lon" });

    var passLat = [-90, -45.5334, 0, 34.4432, 90];
    var failLat = [-90.0001, 90.0001, "", true, null, undefined];

    var passLon = [-180, -144.4322, 0, 99.2332, 180];
    var failLon = [-180.0001, 180.0001, "", true, null, undefined];

    passLat.forEach(function(value) { pass(value, SchemaLat); });
    failLat.forEach(function(value) { fail(value, SchemaLat); });

    passLon.forEach(function(value) { pass(value, SchemaLon); });
    failLon.forEach(function(value) { fail(value, SchemaLon); });
  });

  it("should validate number - $min/$max $gt/$lt $ge/$le", function() {
    ["int", "number"].forEach(function(type) {
      pass(0, qdata.schema({ $type: type, $min: 0, $max: 5 }));
      pass(5, qdata.schema({ $type: type, $min: 0, $max: 5 }));

      pass(0, qdata.schema({ $type: type, $ge: 0, $le: 5 }));
      pass(5, qdata.schema({ $type: type, $ge: 0, $le: 5 }));

      pass(1, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));
      pass(4, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));

      fail(-1, qdata.schema({ $type: type, $min: 0, $max: 5 }));
      fail( 6, qdata.schema({ $type: type, $min: 0, $max: 5 }));

      fail(-1, qdata.schema({ $type: type, $ge: 0, $le: 5 }));
      fail( 6, qdata.schema({ $type: type, $ge: 0, $le: 5 }));

      fail( 0, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));
      fail( 5, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));
    });
  });

  it("should validate number - $divisibleBy", function() {
    ["int", "number"].forEach(function(type) {
      pass(-9, qdata.schema({ $type: type, $divisibleBy: 9 }));
      pass( 0, qdata.schema({ $type: type, $divisibleBy: 1 }));
      pass( 1, qdata.schema({ $type: type, $divisibleBy: 1 }));
      pass( 2, qdata.schema({ $type: type, $divisibleBy: 1 }));
      pass( 4, qdata.schema({ $type: type, $divisibleBy: 2 }));
      pass(10, qdata.schema({ $type: type, $divisibleBy: 5 }));

      fail(-3, qdata.schema({ $type: type, $divisibleBy: 2 }));
      fail( 3, qdata.schema({ $type: type, $divisibleBy: 6 }));
    });
  });

  it("should validate string", function() {
    pass("\x00"  , qdata.schema({ $type: "string" }));
    pass("xxxx"  , qdata.schema({ $type: "string" }));

    pass("abc"   , qdata.schema({ $type: "string", $length   : 3 }));

    pass("abc"   , qdata.schema({ $type: "string", $minLength: 3 }));
    pass("abcdef", qdata.schema({ $type: "string", $minLength: 3 }));

    pass("abc"   , qdata.schema({ $type: "string", $maxLength: 6 }));
    pass("abcdef", qdata.schema({ $type: "string", $maxLength: 6 }));

    fail("abc", qdata.schema({ $type: "string", $length   : 2 }));
    fail("abc", qdata.schema({ $type: "string", $minLength: 4 }));
    fail("abc", qdata.schema({ $type: "string", $maxLength: 2 }));
  });

  it("should validate text", function() {
    // Text goes through the same validator as "string", so test only parts
    // where "string" vs "text" differ.
    var Schema = qdata.schema({ $type: "text" });

    // Should accept some characters below 32.
    pass("some text \x09", Schema);
    pass("some text \x0A", Schema);
    pass("some text \x0D", Schema);

    // Should refuse NULL and other characters below 32.
    fail("some text \x00", Schema);
    fail("some text \x1B", Schema);
    fail("some text \x1F", Schema);
  });

  it("should validate color - #XXX and #XXXXXX", function() {
    var Schema = qdata.schema({ $type: "color" });

    pass("#000", Schema);
    pass("#123", Schema);
    pass("#F00", Schema);
    pass("#0AF", Schema);
    pass("#0af", Schema);
    pass("#DEF", Schema);
    pass("#fff", Schema);

    pass("#000000", Schema);
    pass("#112233", Schema);
    pass("#FF0000", Schema);
    pass("#00AAFF", Schema);
    pass("#00aaff", Schema);
    pass("#DDEEFF", Schema);
    pass("#ffffff", Schema);

    fail(" #FFF", Schema);
    fail("#FFF ", Schema);

    fail("#FF"  , Schema);
    fail("#FFFF", Schema);

    fail("#FFg" , Schema);
    fail("#FgF" , Schema);
    fail("#gFF" , Schema);

    fail("#FF " , Schema);
    fail("#F F" , Schema);
    fail("# FF" , Schema);
  });

  it("should validate color - color names", function() {
    var SchemaDefault       = qdata.schema({ $type: "color" });
    var SchemaAllowNames    = qdata.schema({ $type: "color", $allowNames: true  });
    var SchemaDisallowNames = qdata.schema({ $type: "color", $allowNames: false });

    for (var k in qdata.util.colorNames) {
      var K = k.toUpperCase();

      pass(k, SchemaDefault);
      pass(K, SchemaDefault);

      pass(k, SchemaAllowNames);
      pass(K, SchemaAllowNames);

      fail(k      , SchemaDisallowNames);
      fail(K      , SchemaDisallowNames);
      fail(k + " ", SchemaDisallowNames);
      fail("#" + k, SchemaDisallowNames);
    }
  });

  it("should validate color - extra names", function() {
    var ExtraNames = {
      "none"        : true,
      "transparent" : true,
      "currentcolor": true
    };

    var Schema = qdata.schema({
      $type: "color",
      $allowNames: true,
      $extraNames: ExtraNames
    });

    pass("#FFF"        , Schema);
    pass("#FFFFFF"     , Schema);
    pass("red"         , Schema);
    pass("RED"         , Schema);
    pass("none"        , Schema);
    pass("NONE"        , Schema);
    pass("transparent" , Schema);
    pass("TRANSPARENT" , Schema);
    pass("currentcolor", Schema);
    pass("currentColor", Schema);
    pass("CURRENTCOLOR", Schema);
  });

  it("should validate net - mac address", function() {
    var MAC  = qdata.schema({ $type: "mac" });
    var MACd = qdata.schema({ $type: "mac", $separator: "-" });

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

  it("should validate net - ipv4 address", function() {
    var IPV4 = qdata.schema({
      $type: "ipv4"
    });

    pass("0.0.0.0"        , IPV4);
    pass("1.1.1.1"        , IPV4);
    pass("1.1.1.10"       , IPV4);
    pass("1.1.10.1"       , IPV4);
    pass("1.10.1.1"       , IPV4);
    pass("10.1.1.1"       , IPV4);
    pass("1.1.1.255"      , IPV4);
    pass("1.1.255.1"      , IPV4);
    pass("1.255.1.1"      , IPV4);
    pass("255.1.1.1"      , IPV4);
    pass("192.168.1.1"    , IPV4);
    pass("255.255.255.255", IPV4);

    fail(true        , IPV4);
    fail("invalid"   , IPV4);
    fail("0"         , IPV4);
    fail("0.0"       , IPV4);
    fail("0.0.0"     , IPV4);
    fail("0.0.0.0."  , IPV4);
    fail("0.0.0.0 "  , IPV4);
    fail(".0.0.0.0"  , IPV4);
    fail(" 0.0.0.0"  , IPV4);
    fail("1.1.1..1"  , IPV4);
    fail("1.1..1.1"  , IPV4);
    fail("1..1.1.1"  , IPV4);
    fail("1.1.1.01"  , IPV4);
    fail("1.1.01.1"  , IPV4);
    fail("1.01.1.1"  , IPV4);
    fail("01.1.1.1"  , IPV4);
    fail("1.1.1.256" , IPV4);
    fail("1.1.256.1" , IPV4);
    fail("1.256.1.1" , IPV4);
    fail("256.1.1.1" , IPV4);
    fail("1.1.1.1000", IPV4);
    fail("1.1.1000.1", IPV4);
    fail("1.1000.1.1", IPV4);
    fail("1000.1.1.1", IPV4);
  });

  it("should validate date - basics", function() {
    var YYYY_MM    = qdata.schema({ $type: "date", $format: "YYYY-MM" });
    var YYYY_MM_DD = qdata.schema({ $type: "date" });

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

  it("should validate date - datetime", function() {
    var YYYY_MM_DD_HH_mm_ss = qdata.schema({ $type: "datetime"    });
    var YYYY_MM_DD_HH_mm_ms = qdata.schema({ $type: "datetime-ms" });
    var YYYY_MM_DD_HH_mm_us = qdata.schema({ $type: "datetime-us" });

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

  it("should validate date - leap year handling", function() {
    var YYYY_MM_DD = qdata.schema({
      $type: "date"
    });

    var YYYY_MM_DD_no29thFeb = qdata.schema({
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

  it("should validate date - leap second handling", function() {
    var Schema = qdata.schema({ $type: "datetime", $leapSecond: true });

    pass("1972-06-30 23:59:60", Schema);
    pass("1972-12-31 23:59:60", Schema);
    pass("2012-06-30 23:59:60", Schema);

    // Leap seconds' dates are not defined from 1971 and below.
    fail("1971-06-30 23:59:60", Schema);
    fail("1971-12-31 23:59:60", Schema);

    // Leap seconds' dates that are known to not have leap second.
    fail("1973-06-30 23:59:60", Schema);
    fail("2013-06-30 23:59:60", Schema);
    fail("2013-12-31 23:59:60", Schema);
    fail("2014-06-30 23:59:60", Schema);
    fail("2014-12-31 23:59:60", Schema);

    // Leap seconds' dates in far future are not known at the moment.
    fail("2100-06-30 23:59:60", Schema);
    fail("2100-12-31 23:59:60", Schema);
  });

  it("should validate date - valid custom format YYYYMMDD", function() {
    var Schema = qdata.schema({ $type: "date", $format: "YYYYMMDD" });

    pass("19990101", Schema);
    pass("20041213", Schema);

    fail("invalid"  , Schema);
    fail("2011312"  , Schema);
    fail("20111312" , Schema);
    fail("20140132" , Schema);
    fail("20110101 ", Schema);
  });

  it("should validate date - valid custom format YYYYMMDD HHmmss", function() {
    var Schema = qdata.schema({ $type: "date", $format: "YYYYMMDD HHmmss" });

    pass("19990101 013030" , Schema);
    pass("20041213 013030" , Schema);

    fail("invalid"         , Schema);
    fail("19990101 253030" , Schema);
    fail("19990101 016030" , Schema);
    fail("19990101 013060" , Schema);
    fail("2011312 013030"  , Schema);
    fail("20111312 013030" , Schema);
    fail("20140132 013030" , Schema);
    fail("20110101 013030 ", Schema);
  });

  it("should validate date - valid custom format D.M.Y", function() {
    var Schema = qdata.schema({ $type: "date", $format: "D.M.Y" });

    pass("1.1.455"    , Schema);
    pass("2.8.2004"   , Schema);
    pass("20.12.2004" , Schema);

    fail("32.1.2004"  , Schema);
    fail("20.13.2004" , Schema);
    fail("20.13.10000", Schema);
  });

  it("should validate date - valid custom format D.M.Y H:m:s", function() {
    var Schema = qdata.schema({ $type: "date", $format: "D.M.Y H:m:s" });

    pass("1.1.455 1:30:30"    , Schema);
    pass("2.8.2004 1:30:30"   , Schema);
    pass("20.12.2004 1:30:30" , Schema);

    fail("1.1.1999 25:30:30"  , Schema);
    fail("1.1.1999 1:60:30"   , Schema);
    fail("1.1.1999 1:30:60"   , Schema);
    fail("32.1.2004 1:30:30"  , Schema);
    fail("20.13.2004 1:30:30" , Schema);
    fail("20.13.10000 1:30:30", Schema);
  });

  it("should validate date - invalid custom format", function() {
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YD"            }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YM"            }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YMD"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "DMY"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "M-D"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "MM-DD"         }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YYYY-DD"       }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YYYY-MM-DD mm" }); });
    assertThrow(function() { qdata.schema({ $type: "date", $format: "YYYY-MM-DD ss" }); });
  });

  it("should validate object - mandatory fields", function() {
    var def = qdata.schema({
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
    var def = qdata.schema({
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
    var def = qdata.schema({
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
    var def = qdata.schema({
      "\u0909": { $type: "string" },
      "\u0910": { $type: "string" }
    });

    pass({ "\u0909": "a", "\u0910": "b" }, def);
  });

  it("should validate object - escaped fields", function() {
    var def = qdata.schema({
      "\\$type"  : { $type: "string" },
      "\\\\value": { $type: "string" }
    });

    pass({ "$type": "int", "\\value": "13" }, def);
  });

  it("should validate object - strict/extract", function() {
    var def = qdata.schema({
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

    var noise1 = deepCopy(data);
    noise1.someNoise = true;

    var noise2 = deepCopy(noise1);
    noise2.nested.anotherNoise = true;

    pass(noise1, def, qdata.kExtractTopFields, null, data);
    pass(noise2, def, qdata.kExtractAllFields, null, data);

    fail(noise1, def, qdata.kNoOptions);
    fail(noise2, def, qdata.kExtractTopFields);
  });

  it("should validate array - nested values", function() {
    var defs = [
      { type: "bool"  , pass: [false, true]         , fail: [0, 1, "string", NaN, Infinity, [], {}] },
      { type: "int"   , pass: [-1, 0, 2, 3, 4]      , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "uint"  , pass: [ 0, 1, 2, 3, 4]      , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "number", pass: [-1.5, 0, 1.5, 1e100] , fail: [true, "string", NaN, Infinity, [], {}] },
      { type: "string", pass: ["", "a", "ab", "abc"], fail: [true, -1, 0, 1, NaN, Infinity, [], {}] }
    ];

    defs.forEach(function(def) {
      [false, true].forEach(function(canBeNull) {
        [false, true].forEach(function(canBeUndefined) {
          var type = def.type;

          var passData = def.pass;
          var failData = def.fail;

          var Schema = qdata.schema({
            $type: "array",
            $data: {
              $type: type,
              $null: canBeNull ? true : false,
              $undefined: canBeUndefined ? true : false
            }
          });

          if (canBeNull)
            passData = passData.concat([null]);
          else
            failData = failData.concat([null]);

          if (canBeUndefined)
            passData = passData.concat([undefined]);
          else
            failData = failData.concat([undefined]);

          passData.forEach(function(value) { pass([value], Schema); });
          failData.forEach(function(value) { fail([value], Schema); });
        });
      });
    });
  });

  it("should validate array - nested objects", function() {
    var def = qdata.schema({
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
    var defLen2 = qdata.schema({
      $type: "array",
      $data: {
        $type: "int"
      },
      $length: 2
    });

    var defMin2 = qdata.schema({
      $type: "array",
      $data: {
        $type: "int"
      },
      $minLength: 2
    });

    var defMax2 = qdata.schema({
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

  it("should properly handle type ending with '?'", function() {
    var def = qdata.schema({
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

  it("should properly handle type ending with '[]'", function() {
    var def = qdata.schema({
      a: { $type: "int"   },
      b: { $type: "int[]" }
    });

    pass({ a: 0, b: [0] }, def);

    fail({ a: 0           }, def);
    fail({ a: null, b: [] }, def);
    fail({ a: 0, b: null  }, def);
    fail({ a: 0, b: "s"   }, def);
    fail({ a: 0, b: ["s"] }, def);
  });

  it("should properly handle type ending with '[]?'", function() {
    var def = qdata.schema({
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

  it("should properly handle type ending with '?[]?'", function() {
    var def = qdata.schema({
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

  it("should properly handle invalid type ending", function() {
    assertThrow(function() { qdata.schema({ $type: "int??"    }); });
    assertThrow(function() { qdata.schema({ $type: "int??[]"  }); });
    assertThrow(function() { qdata.schema({ $type: "int[]??"  }); });
    assertThrow(function() { qdata.schema({ $type: "int?[]??" }); });
    assertThrow(function() { qdata.schema({ $type: "int??[]?" }); });
  });

  it("should accumulate errors", function() {
    var def = qdata.schema({
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
      out = qdata.process(data, def, qdata.kAccumulateErrors);
    }
    catch (err) {
      assert(err instanceof qdata.SchemaError, "Error thrown 'SchemaError' instance.");
      assert.deepEqual(err.details, [
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
});
