// QData <https://github.com/jshq/qdata>
"use strict";

var assert = require("assert");
var qclass = require("qclass");
var qdata = require("./qdata");

var isEqual = qdata.isEqual;
var cloneDeep = qdata.cloneDeep;

var isArray = Array.isArray;

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

var printableSchema = qdata.printableSchema;

function printableOptions(options) {
  var arr = [];

  if ((options & qdata.kExtractAll) === qdata.kExtractTop)
    arr.push("kExtractTop");

  if ((options & qdata.kExtractAll) === qdata.kExtractNested)
    arr.push("kExtractNested");

  if ((options & qdata.kExtractAll) === qdata.kExtractAll)
    arr.push("kExtractAll");

  if ((options & qdata.kDeltaMode) !== 0)
    arr.push("kDeltaMode");

  if ((options & qdata.kAccumulateErrors) !== 0)
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
    var fn = qdata.precompile("process", schema, options, access);
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
qclass({
  $extend: Error,
  $construct: TestError
});

function pass(input, schema, options, access, expected) {
  var output = null;
  var err = null;

  try {
    output = qdata.process(input, schema, options, access);
  }
  catch (ex) {
    err = ex;
  }

  if (err) {
    var errors = err instanceof qdata.SchemaError ? err.errors : undefined;
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
    output = qdata.process(input, schema, options, access);
  }
  catch (ex) {
    if (ex instanceof qdata.SchemaError)
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

describe("QData", function() {
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
    assert(qdata.util.isDirectiveName("$")          === true);
    assert(qdata.util.isDirectiveName("$directive") === true);
    assert(qdata.util.isDirectiveName("")           === false);
    assert(qdata.util.isDirectiveName("fieldName")  === false);

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

    assert(isEqual(AnimalEnum.$keyMap, AnimalDef));
    assert(isEqual(AnimalEnum.$keyList, [
      "Horse",
      "Dog",
      "Cat",
      "Mouse",
      "Hamster"
    ]));

    assert(isEqual(AnimalEnum.$valueMap, {
      "0": "Horse",
      "1": "Dog",
      "2": "Cat",
      "3": "Hamster",
      "4": "Mouse"
    }));
    assert(isEqual(AnimalEnum.$valueList, [
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

    assert(isEqual(TypeIdNonUniqueEnum.$valueMap, {
      "1299": "String",
      "3345": "Number",
      "6563": "Object"
    }));
    assert(isEqual(TypeIdNonUniqueEnum.$valueList, [1299, 3345, 6563]));

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

    assert(isEqual(ReservedEnum.$keyMap, ReservedDef));

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

  it("should validate null and fail if undefined", function() {
    ["bool", "int", "number", "string", "text", "date", "datetime", "object"].forEach(function(type) {
      pass(null     , qdata.schema({ $type: type, $null: true      }));
      fail(undefined, qdata.schema({ $type: type, $null: true      }));
    });
  });

  it("should validate any - anything", function() {
    var def = qdata.schema({ $type: "any" });

    var passData = [false, true, 0, 1, 42.42, "", "string", {}, [], { a: true }, [[[1, 2], 3], 4, { a: true }]];
    var failData = [null, undefined];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate any - $allowed", function() {
    var def = qdata.schema({ $type: "any" });

    var passData = [false, true, 0, 1, 42.42, "", "string", {}, [], { a: true }, [[[1, 2], 3], 4, { a: true }]];
    var failData = [null, undefined];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate bool", function() {
    var def = qdata.schema({ $type: "bool" });

    var passData = [false, true];
    var failData = [0, 1, "", "string", {}, [], Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
  });

  it("should validate number - int", function() {
    var def = qdata.schema({ $type: "int" });

    var passData = [0, 1, -1];
    var failData = [false, true, "", "0", "string", {}, [], 0.1, -0.23211, Infinity, -Infinity, NaN];

    passData.forEach(function(value) { pass(value, def); });
    failData.forEach(function(value) { fail(value, def); });
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
    var def = qdata.schema({ $type: "number" });

    var valuesToPass = [0, 1, -1, 0.1, -0.23211];
    var valuesToFail = [false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN];

    valuesToPass.forEach(function(value) { pass(value, def); });
    valuesToFail.forEach(function(value) { fail(value, def); });
  });

  it("should validate number - lat/lon", function() {
    var defLat = qdata.schema({ $type: "lat" });
    var defLon = qdata.schema({ $type: "lon" });

    var passLat = [-90, -45.5334, 0, 34.4432, 90];
    var failLat = [-90.0001, 90.0001, "", true, null, undefined];

    var passLon = [-180, -144.4322, 0, 99.2332, 180];
    var failLon = [-180.0001, 180.0001, "", true, null, undefined];

    passLat.forEach(function(value) { pass(value, defLat); });
    failLat.forEach(function(value) { fail(value, defLat); });

    passLon.forEach(function(value) { pass(value, defLon); });
    failLon.forEach(function(value) { fail(value, defLon); });
  });

  it("should validate number - $min/$max $gt/$lt", function() {
    ["int", "number"].forEach(function(type) {
      pass(0, qdata.schema({ $type: type, $min: 0, $max: 5 }));
      pass(5, qdata.schema({ $type: type, $min: 0, $max: 5 }));

      pass(1, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));
      pass(4, qdata.schema({ $type: type, $gt: 0, $lt: 5 }));

      fail(-1, qdata.schema({ $type: type, $min: 0, $max: 5 }));
      fail( 6, qdata.schema({ $type: type, $min: 0, $max: 5 }));

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
    var def = qdata.schema({ $type: "text" });

    // Should accept some characters below 32.
    pass("some text \x09", def);
    pass("some text \x0A", def);
    pass("some text \x0D", def);

    // Should refuse NULL and other characters below 32.
    fail("some text \x00", def);
    fail("some text \x1B", def);
    fail("some text \x1F", def);
  });

  it("should validate bigint", function() {
    var def = qdata.schema({ $type: "bigint" });

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

  it("should validate color - #XXX and #XXXXXX", function() {
    var def = qdata.schema({ $type: "color" });

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
    var defDefault          = qdata.schema({ $type: "color" });
    var defAllowCssNames    = qdata.schema({ $type: "color", $cssNames: true  });
    var defDisallowCssNames = qdata.schema({ $type: "color", $cssNames: false });

    for (var k in qdata.util.colorNames) {
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

    var def = qdata.schema({
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

    var IPV4AllowPort = qdata.schema({
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

  it("should validate net - ipv6 address", function() {
    var IPV6 = qdata.schema({
      $type: "ipv6"
    });

    var IPV6AllowPort = qdata.schema({
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
    var def = qdata.schema({ $type: "datetime", $leapSecond: true });

    pass("1972-06-30 23:59:60", def);
    pass("1972-12-31 23:59:60", def);
    pass("2012-06-30 23:59:60", def);

    // Leap seconds' dates are not defined from 1971 and below.
    fail("1971-06-30 23:59:60", def);
    fail("1971-12-31 23:59:60", def);

    // Leap seconds' dates that are known to not have leap second.
    fail("1973-06-30 23:59:60", def);
    fail("2013-06-30 23:59:60", def);
    fail("2013-12-31 23:59:60", def);
    fail("2014-06-30 23:59:60", def);
    fail("2014-12-31 23:59:60", def);

    // Leap seconds' dates in far future are not known at the moment.
    fail("2100-06-30 23:59:60", def);
    fail("2100-12-31 23:59:60", def);
  });

  it("should validate date - valid custom format YYYYMMDD", function() {
    var def = qdata.schema({ $type: "date", $format: "YYYYMMDD" });

    pass("19990101", def);
    pass("20041213", def);

    fail("invalid"  , def);
    fail("2011312"  , def);
    fail("20111312" , def);
    fail("20140132" , def);
    fail("20110101 ", def);
  });

  it("should validate date - valid custom format YYYYMMDD HHmmss", function() {
    var def = qdata.schema({ $type: "date", $format: "YYYYMMDD HHmmss" });

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

  it("should validate date - valid custom format D.M.Y", function() {
    var def = qdata.schema({ $type: "date", $format: "D.M.Y" });

    pass("1.1.455"    , def);
    pass("2.8.2004"   , def);
    pass("20.12.2004" , def);

    fail("32.1.2004"  , def);
    fail("20.13.2004" , def);
    fail("20.13.10000", def);
  });

  it("should validate date - valid custom format D.M.Y H:m:s", function() {
    var def = qdata.schema({ $type: "date", $format: "D.M.Y H:m:s" });

    pass("1.1.455 1:30:30"    , def);
    pass("2.8.2004 1:30:30"   , def);
    pass("20.12.2004 1:30:30" , def);

    fail("1.1.1999 25:30:30"  , def);
    fail("1.1.1999 1:60:30"   , def);
    fail("1.1.1999 1:30:60"   , def);
    fail("32.1.2004 1:30:30"  , def);
    fail("20.13.2004 1:30:30" , def);
    fail("20.13.10000 1:30:30", def);
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

  it("should validate object - empty object", function() {
    var def = qdata.schema({});

    pass({}, def);
    fail({ a: true }, def);
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

  it("should validate object - default fields", function() {
    var def = qdata.schema({
      a: { $type: "bool"  , $default: true    },
      b: { $type: "int"   , $default: 42      },
      c: { $type: "double", $default: 3.14    },
      d: { $type: "string", $default: "qdata" },
      e: { $type: "object", $default: {}      }
    });

    pass({}, def, 0, null, {
      a: true,
      b: 42,
      c: 3.14,
      d: "qdata",
      e: {}
    });

    // QData should always copy all defaults.
    assert(qdata.process({}, def, 0, null).e !==
           qdata.process({}, def, 0, null).e);
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

    var noise1 = cloneDeep(data);
    noise1.someNoise = true;

    var noise2 = cloneDeep(noise1);
    noise2.nested.anotherNoise = true;

    pass(noise1, def, qdata.kExtractTop, null, data);
    pass(noise2, def, qdata.kExtractAll, null, data);

    fail(noise1, def, qdata.kNoOptions);
    fail(noise1, def, qdata.kExtractNested);

    fail(noise2, def, qdata.kNoOptions);
    fail(noise2, def, qdata.kExtractTop);
  });

  it("should validate object - delta mode", function() {
    var def = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  },
      nested: {
        c: { $type: "string"   },
        d: { $type: "string[]" }
      }
    });

    pass({ a: true }, def, qdata.kDeltaMode);
    pass({ b: 1234 }, def, qdata.kDeltaMode);

    pass({ a: true, nested: {} }, def, qdata.kDeltaMode);
    pass({ b: 1234, nested: {} }, def, qdata.kDeltaMode);

    pass({ a: true, nested: { c: "qdata" } }, def, qdata.kDeltaMode);
    pass({ b: 1234, nested: { d: ["qqq"] } }, def, qdata.kDeltaMode);

    // This is just a delta mode, invalid properties shouldn't be allowed.
    fail({ invalid: true }, def);
    fail({ nested: { invalid: true } }, def);
  });

  it("should validate object - delta mode with $delta", function() {
    var def = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  },
      nested: {
        $delta: false,
        c: { $type: "string"   },
        d: { $type: "string[]" }
      }
    });

    pass({ a: true }, def, qdata.kDeltaMode);
    pass({ b: 1234 }, def, qdata.kDeltaMode);

    pass({ a: true, nested: { c: "qdata", d: ["qqq" ] } }, def, qdata.kDeltaMode);
    pass({ b: 1234, nested: { c: "qdata", d: ["qqq" ] } }, def, qdata.kDeltaMode);

    fail({ a: true, nested: {} }, def, qdata.kDeltaMode);
    fail({ b: 1234, nested: {} }, def, qdata.kDeltaMode);

    fail({ a: true, nested: { c: "qdata" } }, def, qdata.kDeltaMode);
    fail({ b: 1234, nested: { d: ["qqq"] } }, def, qdata.kDeltaMode);
  });

  it("should validate map - any", function() {
    var def0 = qdata.schema({
      $type: "map",
      $data: {
        $type: "any"
      }
    });

    pass({ a: 1, b: true, c: "qdata", d: [[[1, 2], 3], 4] }, def0);
    fail(null, def0);
    fail({ a: null }, def0);

    var def1 = qdata.schema({
      $type: "map",
      $null: true,
      $data: {
        $type: "any"
      }
    });

    pass({ a: 1, b: true, c: "qdata", d: [[[1, 2], 3], 4] }, def1);
    pass(null, def1);
    fail({ a: null }, def1);

    var def2 = qdata.schema({
      $type: "map",
      $null: true,
      $data: {
        $type: "any",
        $null: true
      }
    });

    pass({ a: 1, b: true, c: "qdata", d: [[[1, 2], 3], 4] }, def2);
    pass(null, def2);
    pass({ a: null }, def2);
  });

  it("should validate map - types", function() {
    var def0 = qdata.schema({
      $type: "map",
      $data: {
        $type: "int",
        $max: 50
      }
    });

    pass({ a: 0, b: 49 }, def0);
    fail({ a: 0, b: 51 }, def0);

    var def1 = qdata.schema({
      $type: "map",
      $data: {
        $type: "string"
      }
    });

    pass({ a: "Hi", b: "Bye" }, def1);
    fail({ a: "Hi", b: null  }, def1);
  });

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

        var def = qdata.schema({
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

  it("should handle shortcut '?'", function() {
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

  it("should handle shortcut '[]'", function() {
    var def0 = qdata.schema({
      a: { $type: "int"   },
      b: { $type: "int[]" }
    });

    pass({ a: 0, b: [0]   }, def0);
    fail({ a: 0           }, def0);
    fail({ a: null, b: [] }, def0);
    fail({ a: 0, b: null  }, def0);
    fail({ a: 0, b: "s"   }, def0);
    fail({ a: 0, b: ["s"] }, def0);

    var def1 = qdata.schema({
      a: { $type: "int[]", $optional: true }
    });

    pass({        }, def1);
    pass({ a: [0] }, def1);
  });

  it("should handle shortcut '[x..y]'", function() {
    var Exact  = qdata.schema({ $type: "int[2]"    });
    var Min    = qdata.schema({ $type: "int[2..]"  });
    var Max    = qdata.schema({ $type: "int[..2]"  });
    var MinMax = qdata.schema({ $type: "int[2..4]" });

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

  it("should handle shortcut '?[]?'", function() {
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

  it("should handle shortcut (invalid)", function() {
    assertThrow(function() { qdata.schema({ $type: "int??"    }); });
    assertThrow(function() { qdata.schema({ $type: "int??[]"  }); });
    assertThrow(function() { qdata.schema({ $type: "int[]??"  }); });
    assertThrow(function() { qdata.schema({ $type: "int?[]??" }); });
    assertThrow(function() { qdata.schema({ $type: "int??[]?" }); });
  });

  it("should enrich object - properties having $group", function() {
    var def0 = qdata.schema({
      id         : { $type: "int"  },
      type       : { $type: "int"  },
      flags      : { $type: "int"  },

      title      : { $type: "text", $group: "" }, // Normalized to "default".
      description: { $type: "text", $group: "" },
      metadata   : { $type: "text", $group: undefined }
    });

    // If group is not specified everything goes to a "default" group.
    assert.deepEqual(def0.$groupMap, {
      default: ["id", "type", "flags", "title", "description", "metadata"]
    });

    var def1 = qdata.schema({
      id         : { $type: "int" , $group: "info" },
      type       : { $type: "int" , $group: "info" },
      flags      : { $type: "int" , $group: "info" },

      title      : { $type: "text", $group: "more" },
      description: { $type: "text", $group: "more" },
      metadata   : { $type: "text", $group: null } // Won't be added to $groupMap.
    });

    // Handle groups specified/skipped.
    assert.deepEqual(def1.$groupMap, {
      info: ["id", "type", "flags"],
      more: ["title", "description"]
    });
  });

  it("should enrich object - properties having $pk and $fk", function() {
    var def0 = qdata.schema({
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
    var def0 = qdata.schema({
      id         : { $type: "int", $pk: true     },
      name       : { $type: "int", $unique: true },
      taxId      : { $type: "int", $unique: true }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def0.$uniqueArray),
      sortedArrayOfArrays([["id"], ["name"], ["taxId"]]));

    var def1 = qdata.schema({
      id         : { $type: "int", $pk: true    },
      name       : { $type: "int", $unique: "nameAndTax" },
      taxId      : { $type: "int", $unique: "nameAndTax" }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def1.$uniqueArray),
      sortedArrayOfArrays([["id"], ["name", "taxId"]]));

    var def2 = qdata.schema({
      userId     : { $type: "int"   , $pk: true, $unique: "name|id" },
      tagId      : { $type: "int"   , $pk: true, $unique: "id"      },
      tagName    : { $type: "string"           , $unique: "name"    }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def2.$uniqueArray),
      sortedArrayOfArrays([["tagId", "userId"], ["tagName", "userId"]]));

    var def3 = qdata.schema({
      a: { $type: "int", $unique: "ac|ad" },
      b: { $type: "int", $unique: true    },
      c: { $type: "int", $unique: "ac"    },
      d: { $type: "int", $unique: "ad"    }
    });

    assert.deepEqual(
      sortedArrayOfArrays(def3.$uniqueArray),
      sortedArrayOfArrays([["a", "c"], ["a", "d"], ["b"]]));
  });

  it("should extend schema - use as nested (directly)", function() {
    var nestedDef = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var rootDef = qdata.schema({
      nested: nestedDef
    });

    pass({ nested: { a: true, b: 1234 } }, rootDef);
  });

  it("should extend schema - use as nested ($extend)", function() {
    var nestedDef = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var rootDef = qdata.schema({
      nested: {
        $extend: nestedDef
      }
    });

    pass({ nested: { a: true, b: 1234 } }, rootDef);
  });

  it("should extend schema - add field", function() {
    var def0 = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var def1 = qdata.schema({
      $extend: def0,
      c: { $type: "string" }
    });

    var def2 = qdata.schema({
      $extend: def1,
      d: { $type: "string[]" }
    });

    pass({ a: true, b: 1234                         }, def0);
    pass({ a: true, b: 1234, c: "qdata"             }, def1);
    pass({ a: true, b: 1234, c: "qdata", d: ["qqq"] }, def2);
  });

  it("should extend schema - delete field", function() {
    var def0 = qdata.schema({
      a: { $type: "bool"     },
      b: { $type: "int"      },
      c: { $type: "string"   },
      d: { $type: "string[]" }
    });

    var def1 = qdata.schema({
      $extend: def0,
      d: undefined
    });

    var def2 = qdata.schema({
      $extend: def1,
      c: undefined
    });

    pass({ a: true, b: 1234, c: "qdata", d: ["qqq"] }, def0);
    pass({ a: true, b: 1234, c: "qdata"             }, def1);
    pass({ a: true, b: 1234                         }, def2);

    fail({ a: true, b: 1234, c: "qdata", d: ["qqq"] }, def1);
    fail({ a: true, b: 1234, c: "qdata"             }, def2);
  });

  it("should extend schema - delete nonexisting field", function() {
    var def0 = qdata.schema({
      a: { $type: "bool" },
      b: { $type: "int"  }
    });

    var def1 = qdata.schema({
      $extend: def0,
      nonExisting: undefined
    });

    pass({ a: true, b: 1234 }, def1);
  });

  it("should extend schema - modify field (optional)", function() {
    var def0 = qdata.schema({
      a: { $type: "bool"   },
      b: { $type: "int"    },
      c: { $type: "string", $optional: true }
    });

    var def1 = qdata.schema({
      $extend: def0,
      a: { $optional: true  },
      b: { $optional: undefined },
      c: { $optional: false }
    });

    pass({ a: true, b: 1234             }, def0);
    pass({ a: true, b: 1234, c: "qdata" }, def0);

    pass({ a: true, b: 1234, c: "qdata" }, def1);
    pass({          b: 1234, c: "qdata" }, def1);

    fail({ a: true, b: 1234             }, def1);
    fail({          b: 1234             }, def1);
  });

  it("should validate access rights - write one", function() {
    var def = qdata.schema({
      a: { $type: "bool"     , $r: "*", $w: "basic" },
      b: { $type: "int"      , $r: "*", $w: "basic" },
      c: { $type: "string"   , $r: "*", $w: "basic" },
      d: { $type: "object"   , $r: "*", $w: "extra" },
      e: { $type: "string[]" , $r: "*", $w: "extra" }
    });

    var data = {
      a: true,
      b: 0,
      c: "qdata",
      d: {},
      e: ["test"]
    };

    // `null` disables access rights checking (the default).
    pass(data, def, qdata.kNoOptions, null, data);
    pass(data, def, qdata.kNoOptions, { basic: true, extra: true }, data);

    // Empty object means enabled access rights checks, but no access rights.
    fail(data, def, qdata.kNoOptions, {});

    // Incomplete access rights.
    fail(data, def, qdata.kNoOptions, { basic: true });
    fail(data, def, qdata.kNoOptions, { extra: true });

    // Delta mode cares only about access rights required by the fields specified.
    pass({ a: true                        }, def, qdata.kDeltaMode, { basic: true });
    pass({ a: true, b: 0                  }, def, qdata.kDeltaMode, { basic: true });
    pass({ a: true, b: 0, c: "s"          }, def, qdata.kDeltaMode, { basic: true });
    pass({ d: {}                          }, def, qdata.kDeltaMode, { extra: true });
    pass({ e: []                          }, def, qdata.kDeltaMode, { extra: true });

    // No access.
    fail({ a: true, b: 0, c: "s", d: null }, def, qdata.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", d: {}   }, def, qdata.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", e: null }, def, qdata.kDeltaMode, { basic: true });
    fail({ a: true, b: 0, c: "s", e: []   }, def, qdata.kDeltaMode, { basic: true });
    fail({ a: true                        }, def, qdata.kDeltaMode, { extra: true });
    fail({ a: true, b: 0                  }, def, qdata.kDeltaMode, { extra: true });
    fail({ a: true, b: 0, c: "s"          }, def, qdata.kDeltaMode, { extra: true });
  });

  it("should validate access rights - write a|b", function() {
    var def = qdata.schema({
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
    pass(data, def, qdata.kNoOptions, null);
    pass(data, def, qdata.kNoOptions, { a: true, b: true });
    pass(data, def, qdata.kNoOptions, { a: true, c: true });
    fail(data, def, qdata.kNoOptions, { b: true, c: true });

    pass({ a: 0 }, def, qdata.kDeltaMode, { a: true });
    pass({ b: 0 }, def, qdata.kDeltaMode, { a: true });
    pass({ b: 0 }, def, qdata.kDeltaMode, { b: true });
    pass({ c: 0 }, def, qdata.kDeltaMode, { a: true });
    pass({ c: 0 }, def, qdata.kDeltaMode, { c: true });
    pass({ d: 0 }, def, qdata.kDeltaMode, { b: true });
    pass({ d: 0 }, def, qdata.kDeltaMode, { c: true });

    fail({ a: 0 }, def, qdata.kDeltaMode, { b: true });
    fail({ b: 0 }, def, qdata.kDeltaMode, { c: true });
    fail({ c: 0 }, def, qdata.kDeltaMode, { b: true });
    fail({ d: 0 }, def, qdata.kDeltaMode, { a: true });
  });

 it("should validate access rights - write inherit", function() {
    var def = qdata.schema({
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

    pass(data0, def, qdata.kDeltaMode, null);
    pass(data0, def, qdata.kDeltaMode, { user: true });
    pass(data0, def, qdata.kDeltaMode, { admin: true });
    fail(data0, def, qdata.kDeltaMode, {});

    var data1 = {
      nested: {
        a: 0,
        b: 1,
        onlyUser: 2,
        inheritUser: 3
      }
    };

    pass(data1, def, qdata.kDeltaMode, null);
    pass(data1, def, qdata.kDeltaMode, { user: true });
    fail(data1, def, qdata.kDeltaMode, {});
    fail(data1, def, qdata.kDeltaMode, { admin: true });

    var data2 = {
      nested: {
        a: 0,
        b: 1,
        onlyAdmin: 2,
        inheritAdmin: 3
      }
    };

    pass(data2, def, qdata.kDeltaMode, null);
    pass(data2, def, qdata.kDeltaMode, { admin: true });
    fail(data2, def, qdata.kDeltaMode, {});
    fail(data2, def, qdata.kDeltaMode, { user: true });

    var data3 = {
      nested: {
        a: 0,
        b: 1,
        onlyUser: 2,
        onlyAdmin: 3
      }
    };

    pass(data3, def, qdata.kDeltaMode, null);
    pass(data3, def, qdata.kDeltaMode, { admin: true, user: true });
    fail(data3, def, qdata.kDeltaMode, {});
    fail(data3, def, qdata.kDeltaMode, { user: true });
    fail(data3, def, qdata.kDeltaMode, { admin: true });

    var data4 = {
      nested: {
        none: 5
      }
    };

    pass(data4, def, qdata.kDeltaMode, null);
    fail(data4, def, qdata.kDeltaMode, {});
    fail(data4, def, qdata.kDeltaMode, { user: true });
    fail(data4, def, qdata.kDeltaMode, { admin: true });
    fail(data4, def, qdata.kDeltaMode, { admin: true, user: true });
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
      assertThrow(function() { qdata.schema({ field: { $type: "int", $a: access } }); });
      assertThrow(function() { qdata.schema({ field: { $type: "int", $r: access } }); });
      assertThrow(function() { qdata.schema({ field: { $type: "int", $w: access } }); });
    });
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
    assertThrow(function() { qdata.schema({ $type: "invalid"               }); });
    assertThrow(function() { qdata.schema({ $type: "object", $null: 55     }); });
  });
});
