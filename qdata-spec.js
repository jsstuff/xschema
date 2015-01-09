// QData <https://github.com/jshq/qdata>
"use strict";

var assert = require("assert");
var qdata = require("./qdata");

function assertThrow(fn) {
  try {
    fn();
  } catch (ex) {
    return;
  }

  throw new Error("Should have thrown exception.");
}

var deepCopy = qdata.deepCopy;
var deepEqual = qdata.deepEqual;
var process = qdata.process;

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

  it("should test qdata.enum", function() {
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
      assert(process(null     , qdata.schema({ $type: type, $null: true, $undefined: true })) === null      );
      assert(process(undefined, qdata.schema({ $type: type, $null: true, $undefined: true })) === undefined );

      assert(process(null     , qdata.schema({ $type: type, $null: true      })) === null      );
      assert(process(undefined, qdata.schema({ $type: type, $undefined: true })) === undefined );

      assertThrow(function() { process(undefined, qdata.schema({ $type: type, $null: true      })) });
      assertThrow(function() { process(null     , qdata.schema({ $type: type, $undefined: true })) });
    });
  });

  it("should validate bool", function() {
    var Schema = qdata.schema({ $type: "bool" });

    var pass = [false, true];
    var fail = [0, 1, "", "string", {}, [], Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, Schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, Schema); });
    });
  });

  it("should validate number - int", function() {
    var Schema = qdata.schema({ $type: "int" });

    var pass = [0, 1, -1];
    var fail = [false, true, "", "0", "string", {}, [], 0.1, -0.23211, Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, Schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, Schema); });
    });
  });

  it("should validate number - intxx", function() {
    assert(process(-128, qdata.schema({ $type: "int8"  })) === -128);
    assert(process( 127, qdata.schema({ $type: "int8"  })) ===  127);
    assert(process( 255, qdata.schema({ $type: "uint8" })) ===  255);

    assert(process(-32768, qdata.schema({ $type: "int16"  })) === -32768);
    assert(process( 32767, qdata.schema({ $type: "int16"  })) ===  32767);
    assert(process( 65535, qdata.schema({ $type: "uint16" })) ===  65535);

    assert(process(-2147483648, qdata.schema({ $type: "int32"  })) === -2147483648);
    assert(process( 2147483647, qdata.schema({ $type: "int32"  })) ===  2147483647);
    assert(process( 4294967295, qdata.schema({ $type: "uint32" })) ===  4294967295);

    assertThrow(function() { process(-129, qdata.schema({ $type: "int8" })); });
    assertThrow(function() { process( 128, qdata.schema({ $type: "int8" })); });
    assertThrow(function() { process(-1  , qdata.schema({ $type: "uint8" })); });
    assertThrow(function() { process( 256, qdata.schema({ $type: "uint8" })); });

    assertThrow(function() { process(-32769, qdata.schema({ $type: "int16" })); });
    assertThrow(function() { process( 32768, qdata.schema({ $type: "int16" })); });
    assertThrow(function() { process(-1    , qdata.schema({ $type: "uint16" })); });
    assertThrow(function() { process( 65536, qdata.schema({ $type: "uint16" })); });

    assertThrow(function() { process(-2147483649, qdata.schema({ $type: "int32" })); });
    assertThrow(function() { process( 2147483648, qdata.schema({ $type: "int32" })); });
    assertThrow(function() { process(-1         , qdata.schema({ $type: "uint32" })); });
    assertThrow(function() { process( 4294967296, qdata.schema({ $type: "uint32" })); });
  });

  it("should validate number - double", function() {
    var Schema = qdata.schema({ $type: "number" });

    var pass = [0, 1, -1, 0.1, -0.23211];
    var fail = [false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, Schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, Schema); });
    });
  });

  it("should validate number - lat/lon", function() {
    var SchemaLat = qdata.schema({ $type: "lat" });
    var SchemaLon = qdata.schema({ $type: "lon" });

    var passLat = [-90, -45.5334, 0, 34.4432, 90];
    var failLat = [-90.0001, 90.0001, "", true, null, undefined];

    var passLon = [-180, -144.4322, 0, 99.2332, 180];
    var failLon = [-180.0001, 180.0001, "", true, null, undefined];

    passLat.forEach(function(value) {
      assert(process(value, SchemaLat) === value);
    });

    failLat.forEach(function(value) {
      assertThrow(function() { process(value, SchemaLat); });
    });

    passLon.forEach(function(value) {
      assert(process(value, SchemaLon) === value);
    });

    failLon.forEach(function(value) {
      assertThrow(function() { process(value, SchemaLon); });
    });
  });

  it("should validate number - $min/$max $gt/$lt $ge/$le", function() {
    ["int", "number"].forEach(function(type) {
      assert(process(0, qdata.schema({ $type: type, $min: 0, $max: 5 })) === 0);
      assert(process(5, qdata.schema({ $type: type, $min: 0, $max: 5 })) === 5);

      assert(process(0, qdata.schema({ $type: type, $ge: 0, $le: 5 })) === 0);
      assert(process(5, qdata.schema({ $type: type, $ge: 0, $le: 5 })) === 5);

      assert(process(1, qdata.schema({ $type: type, $gt: 0, $lt: 5 })) === 1);
      assert(process(4, qdata.schema({ $type: type, $gt: 0, $lt: 5 })) === 4);

      assertThrow(function() { process(-1, qdata.schema({ $type: type, $min: 0, $max: 5 })); });
      assertThrow(function() { process( 6, qdata.schema({ $type: type, $min: 0, $max: 5 })); });

      assertThrow(function() { process(-1, qdata.schema({ $type: type, $ge: 0, $le: 5 })); });
      assertThrow(function() { process( 6, qdata.schema({ $type: type, $ge: 0, $le: 5 })); });

      assertThrow(function() { process( 0, qdata.schema({ $type: type, $gt: 0, $lt: 5 })); });
      assertThrow(function() { process( 5, qdata.schema({ $type: type, $gt: 0, $lt: 5 })); });
    });
  });

  it("should validate number - $divBy", function() {
    ["int", "number"].forEach(function(type) {
      assert(process(-9, qdata.schema({ $type: type, $divBy: 9 })) === -9);
      assert(process( 0, qdata.schema({ $type: type, $divBy: 1 })) ===  0);
      assert(process( 1, qdata.schema({ $type: type, $divBy: 1 })) ===  1);
      assert(process( 2, qdata.schema({ $type: type, $divBy: 1 })) ===  2);
      assert(process( 4, qdata.schema({ $type: type, $divBy: 2 })) ===  4);
      assert(process(10, qdata.schema({ $type: type, $divBy: 5 })) === 10);

      assertThrow(function() { process(-3, qdata.schema({ $type: type, $divBy: 2 })); });
      assertThrow(function() { process( 3, qdata.schema({ $type: type, $divBy: 6 })); });
    });
  });

  it("should validate string", function() {
    assert(process("\x00"  , qdata.schema({ $type: "string" })) === "\x00");
    assert(process("xxxx"  , qdata.schema({ $type: "string" })) === "xxxx");

    assert(process("abc"   , qdata.schema({ $type: "string", $length   : 3 })) === "abc"   );

    assert(process("abc"   , qdata.schema({ $type: "string", $minLength: 3 })) === "abc"   );
    assert(process("abcdef", qdata.schema({ $type: "string", $minLength: 3 })) === "abcdef");

    assert(process("abc"   , qdata.schema({ $type: "string", $maxLength: 6 })) === "abc"   );
    assert(process("abcdef", qdata.schema({ $type: "string", $maxLength: 6 })) === "abcdef");

    assertThrow(function() { process("abc", qdata.schema({ $type: "string", $length   : 2 })); });
    assertThrow(function() { process("abc", qdata.schema({ $type: "string", $minLength: 4 })); });
    assertThrow(function() { process("abc", qdata.schema({ $type: "string", $maxLength: 2 })); });
  });

  it("should validate text", function() {
    // Text goes through the same validator as "string", so test only parts
    // where "string" vs "text" differ.
    var Schema = qdata.schema({ $type: "text" });

    // Should accept some characters below 32.
    assert(process("some text \x09", Schema) === "some text \x09");
    assert(process("some text \x0A", Schema) === "some text \x0A");
    assert(process("some text \x0D", Schema) === "some text \x0D");

    // Should refuse NULL and other characters below 32.
    assertThrow(function() { process("some text \x00", Schema); });
    assertThrow(function() { process("some text \x1B", Schema); });
    assertThrow(function() { process("some text \x1F", Schema); });
  });

  it("should validate date - basics", function() {
    var YYYY_MM    = qdata.schema({ $type: "date", $format: "YYYY-MM" });
    var YYYY_MM_DD = qdata.schema({ $type: "date" });

    assert(process("1968-08"   , YYYY_MM   ) === "1968-08"   );
    assert(process("1968-08-20", YYYY_MM_DD) === "1968-08-20");

    assertThrow(function() { process("0000-01"    , YYYY_MM   ); });
    assertThrow(function() { process("1999-00"    , YYYY_MM   ); });
    assertThrow(function() { process("1999-13"    , YYYY_MM   ); });

    assertThrow(function() { process(""           , YYYY_MM_DD); });
    assertThrow(function() { process("invalidDate", YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-01 ", YYYY_MM_DD); });
    assertThrow(function() { process(" 1999-01-01", YYYY_MM_DD); });

    assertThrow(function() { process("0000-01-01" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-00-01" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-00" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-32" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-02-29" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-13-01" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-0a" , YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-001", YYYY_MM_DD); });
    assertThrow(function() { process("1999-01-01 ", YYYY_MM_DD); });
  });

  it("should validate date - datetime", function() {
    var YYYY_MM_DD_HH_mm_ss = qdata.schema({ $type: "datetime"    });
    var YYYY_MM_DD_HH_mm_ms = qdata.schema({ $type: "datetime-ms" });
    var YYYY_MM_DD_HH_mm_us = qdata.schema({ $type: "datetime-us" });

    assert(process("1968-08-20 12:00:59"       , YYYY_MM_DD_HH_mm_ss) === "1968-08-20 12:00:59"       );
    assert(process("1968-08-20 12:00:59.999"   , YYYY_MM_DD_HH_mm_ms) === "1968-08-20 12:00:59.999"   );
    assert(process("1968-08-20 12:00:59.999999", YYYY_MM_DD_HH_mm_us) === "1968-08-20 12:00:59.999999");

    assertThrow(function() { process("1968-08-20 24:00:00", YYYY_MM_DD_HH_mm_ss); });
    assertThrow(function() { process("1968-08-20 23:60:00", YYYY_MM_DD_HH_mm_ss); });
    assertThrow(function() { process("1968-08-20 23:59:60", YYYY_MM_DD_HH_mm_ss); });

    assertThrow(function() { process("1968-08-20 24:00:00.000", YYYY_MM_DD_HH_mm_ms); });
    assertThrow(function() { process("1968-08-20 23:60:00.000", YYYY_MM_DD_HH_mm_ms); });
    assertThrow(function() { process("1968-08-20 23:59:60.000", YYYY_MM_DD_HH_mm_ms); });

    assertThrow(function() { process("1968-08-20 24:00:00.000000", YYYY_MM_DD_HH_mm_us); });
    assertThrow(function() { process("1968-08-20 23:60:00.000000", YYYY_MM_DD_HH_mm_us); });
    assertThrow(function() { process("1968-08-20 23:59:60.000000", YYYY_MM_DD_HH_mm_us); });
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
    assert(process("2000-02-29", YYYY_MM_DD) === "2000-02-29");
    assert(process("2004-02-29", YYYY_MM_DD) === "2004-02-29");
    assert(process("2008-02-29", YYYY_MM_DD) === "2008-02-29");
    assert(process("2012-02-29", YYYY_MM_DD) === "2012-02-29");
    assert(process("2016-02-29", YYYY_MM_DD) === "2016-02-29");
    assert(process("2400-02-29", YYYY_MM_DD) === "2400-02-29");

    // Disabled leap year.
    assertThrow(function() { process("2000-02-29", YYYY_MM_DD_no29thFeb); });
    assertThrow(function() { process("2004-02-29", YYYY_MM_DD_no29thFeb); });
    assertThrow(function() { process("2008-02-29", YYYY_MM_DD_no29thFeb); });
    assertThrow(function() { process("2012-02-29", YYYY_MM_DD_no29thFeb); });
    assertThrow(function() { process("2016-02-29", YYYY_MM_DD_no29thFeb); });
    assertThrow(function() { process("2400-02-29", YYYY_MM_DD_no29thFeb); });

    // Invalid leap year.
    assertThrow(function() { process("1999-02-29", YYYY_MM_DD); });
    assertThrow(function() { process("2100-02-29", YYYY_MM_DD); });
  });

  it("should validate date - leap second handling", function() {
    var Schema = qdata.schema({ $type: "datetime", $leapSecond: true });

    assert(process("1972-06-30 23:59:60", Schema) === "1972-06-30 23:59:60");
    assert(process("1972-12-31 23:59:60", Schema) === "1972-12-31 23:59:60");
    assert(process("2012-06-30 23:59:60", Schema) === "2012-06-30 23:59:60");

    // Leap seconds data start from 1972, 1971 and below are not in the table.
    assertThrow(function() { process("1971-06-30 23:59:60", Schema); });
    assertThrow(function() { process("1971-12-31 23:59:60", Schema); });

    // Leap seconds dates that are known.
    assertThrow(function() { process("1973-06-30 23:59:60", Schema); });
    assertThrow(function() { process("2013-06-30 23:59:60", Schema); });
    assertThrow(function() { process("2013-12-31 23:59:60", Schema); });
    assertThrow(function() { process("2014-06-30 23:59:60", Schema); });
    assertThrow(function() { process("2014-12-31 23:59:60", Schema); });

    // Future leap seconds are not known at the moment.
    assertThrow(function() { process("2100-06-30 23:59:60", Schema); });
    assertThrow(function() { process("2100-12-31 23:59:60", Schema); });
  });

  it("should validate date - valid custom format YYYYMMDD", function() {
    var Schema = qdata.schema({ $type: "date", $format: "YYYYMMDD" });

    assert(process("19990101", Schema) === "19990101");
    assert(process("20041213", Schema) === "20041213");

    assertThrow(function() { process("invalid"  , Schema); });
    assertThrow(function() { process("2011312"  , Schema); });
    assertThrow(function() { process("20111312" , Schema); });
    assertThrow(function() { process("20140132" , Schema); });
    assertThrow(function() { process("20110101 ", Schema); });
  });

  it("should validate date - valid custom format YYYYMMDD HHmmss", function() {
    var Schema = qdata.schema({ $type: "date", $format: "YYYYMMDD HHmmss" });

    assert(process("19990101 013030", Schema) === "19990101 013030");
    assert(process("20041213 013030", Schema) === "20041213 013030");

    assertThrow(function() { process("invalid"         , Schema); });
    assertThrow(function() { process("19990101 253030" , Schema); });
    assertThrow(function() { process("19990101 016030" , Schema); });
    assertThrow(function() { process("19990101 013060" , Schema); });
    assertThrow(function() { process("2011312 013030"  , Schema); });
    assertThrow(function() { process("20111312 013030" , Schema); });
    assertThrow(function() { process("20140132 013030" , Schema); });
    assertThrow(function() { process("20110101 013030 ", Schema); });
  });

  it("should validate date - valid custom format D.M.Y", function() {
    var Schema = qdata.schema({ $type: "date", $format: "D.M.Y" });

    assert(process("1.1.455"   , Schema) === "1.1.455"   );
    assert(process("2.8.2004"  , Schema) === "2.8.2004"  );
    assert(process("20.12.2004", Schema) === "20.12.2004");

    assertThrow(function() { process("32.1.2004"  , Schema); });
    assertThrow(function() { process("20.13.2004" , Schema); });
    assertThrow(function() { process("20.13.10000", Schema); });
  });

  it("should validate date - valid custom format D.M.Y H:m:s", function() {
    var Schema = qdata.schema({ $type: "date", $format: "D.M.Y H:m:s" });

    assert(process("1.1.455 1:30:30"   , Schema) === "1.1.455 1:30:30"   );
    assert(process("2.8.2004 1:30:30"  , Schema) === "2.8.2004 1:30:30"  );
    assert(process("20.12.2004 1:30:30", Schema) === "20.12.2004 1:30:30");

    assertThrow(function() { process("1.1.1999 25:30:30"  , Schema); });
    assertThrow(function() { process("1.1.1999 1:60:30"   , Schema); });
    assertThrow(function() { process("1.1.1999 1:30:60"   , Schema); });
    assertThrow(function() { process("32.1.2004 1:30:30"  , Schema); });
    assertThrow(function() { process("20.13.2004 1:30:30" , Schema); });
    assertThrow(function() { process("20.13.10000 1:30:30", Schema); });
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

  it("should validate color - #XXX and #XXXXXX", function() {
    var Schema = qdata.schema({ $type: "color" });

    assert(process("#000", Schema) === "#000");
    assert(process("#123", Schema) === "#123");
    assert(process("#F00", Schema) === "#F00");
    assert(process("#0AF", Schema) === "#0AF");
    assert(process("#0af", Schema) === "#0af");
    assert(process("#DEF", Schema) === "#DEF");
    assert(process("#fff", Schema) === "#fff");

    assert(process("#000000", Schema) === "#000000");
    assert(process("#112233", Schema) === "#112233");
    assert(process("#FF0000", Schema) === "#FF0000");
    assert(process("#00AAFF", Schema) === "#00AAFF");
    assert(process("#00aaff", Schema) === "#00aaff");
    assert(process("#DDEEFF", Schema) === "#DDEEFF");
    assert(process("#ffffff", Schema) === "#ffffff");

    assertThrow(function() { process(" #FFF", Schema); });
    assertThrow(function() { process("#FFF ", Schema); });

    assertThrow(function() { process("#FF"  , Schema); });
    assertThrow(function() { process("#FFFF", Schema); });

    assertThrow(function() { process("#FFg" , Schema); });
    assertThrow(function() { process("#FgF" , Schema); });
    assertThrow(function() { process("#gFF" , Schema); });

    assertThrow(function() { process("#FF " , Schema); });
    assertThrow(function() { process("#F F" , Schema); });
    assertThrow(function() { process("# FF" , Schema); });
  });

  it("should validate color - color names", function() {
    var SchemaDefault       = qdata.schema({ $type: "color" });
    var SchemaAllowNames    = qdata.schema({ $type: "color", $allowNames: true  });
    var SchemaDisallowNames = qdata.schema({ $type: "color", $allowNames: false });

    for (var k in qdata.util.colorNames) {
      var K = k.toUpperCase();

      assert(process(k, SchemaDefault) === k);
      assert(process(K, SchemaDefault) === K);

      assert(process(k, SchemaAllowNames) === k);
      assert(process(K, SchemaAllowNames) === K);

      assertThrow(function() { process(k      , SchemaDisallowNames); });
      assertThrow(function() { process(K      , SchemaDisallowNames); });
      assertThrow(function() { process(k + " ", SchemaDisallowNames); });
      assertThrow(function() { process("#" + k, SchemaDisallowNames); });
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

    assert(process("#FFF"        , Schema) === "#FFF"        );
    assert(process("#FFFFFF"     , Schema) === "#FFFFFF"     );
    assert(process("red"         , Schema) === "red"         );
    assert(process("RED"         , Schema) === "RED"         );
    assert(process("none"        , Schema) === "none"        );
    assert(process("NONE"        , Schema) === "NONE"        );
    assert(process("transparent" , Schema) === "transparent" );
    assert(process("TRANSPARENT" , Schema) === "TRANSPARENT" );
    assert(process("currentcolor", Schema) === "currentcolor");
    assert(process("currentColor", Schema) === "currentColor");
    assert(process("CURRENTCOLOR", Schema) === "CURRENTCOLOR");
  });

  it("should validate net - mac address", function() {
    var MAC  = qdata.schema({ $type: "mac" });
    var MACd = qdata.schema({ $type: "mac", $separator: "-" });

    assert(process("00:00:00:00:00:00", MAC) === "00:00:00:00:00:00");
    assert(process("01:02:03:04:05:06", MAC) === "01:02:03:04:05:06");
    assert(process("a1:a2:a3:a4:a5:a6", MAC) === "a1:a2:a3:a4:a5:a6");
    assert(process("F1:F2:F3:F4:F5:F6", MAC) === "F1:F2:F3:F4:F5:F6");
    assert(process("ab:cd:ef:ab:cd:ef", MAC) === "ab:cd:ef:ab:cd:ef");
    assert(process("aB:cD:eF:aB:cD:eF", MAC) === "aB:cD:eF:aB:cD:eF");
    assert(process("Ab:Cd:Ef:Ab:Cd:Ef", MAC) === "Ab:Cd:Ef:Ab:Cd:Ef");
    assert(process("AB:CD:EF:AB:CD:EF", MAC) === "AB:CD:EF:AB:CD:EF");

    assert(process("ab-cd-ef-ab-cd-ef", MACd) === "ab-cd-ef-ab-cd-ef");

    assertThrow(function() { process(true                , MAC); });
    assertThrow(function() { process("invalid"           , MAC); });

    assertThrow(function() { process(":12:34:56:78:90:AB", MAC); });
    assertThrow(function() { process(" 12:34:56:78:90:AB", MAC); });
    assertThrow(function() { process("12:34:56:78:90:AB:", MAC); });
    assertThrow(function() { process("12:34:56:78:90:AB ", MAC); });

    assertThrow(function() { process("1:34:56:78:90:AB"  , MAC); });
    assertThrow(function() { process("12:3:56:78:90:AB"  , MAC); });
    assertThrow(function() { process("12:34:5:78:90:AB"  , MAC); });
    assertThrow(function() { process("12:34:56:7:90:AB"  , MAC); });
    assertThrow(function() { process("12:34:56:78:9:AB"  , MAC); });
    assertThrow(function() { process("12:34:56:78:90:A"  , MAC); });

    assertThrow(function() { process("12:34:56:78:90:Ag" , MAC); });
    assertThrow(function() { process("12:34:56:78:90:gB" , MAC); });
    assertThrow(function() { process("12:34:56:78:9g:AB" , MAC); });
    assertThrow(function() { process("12:34:56:78:g0:AB" , MAC); });
    assertThrow(function() { process("12:34:56:7g:90:AB" , MAC); });
    assertThrow(function() { process("12:34:56:g8:90:AB" , MAC); });
    assertThrow(function() { process("12:34:5g:78:90:AB" , MAC); });
    assertThrow(function() { process("12:34:g6:78:90:AB" , MAC); });
    assertThrow(function() { process("12:3g:56:78:90:AB" , MAC); });
    assertThrow(function() { process("12:g4:56:78:90:AB" , MAC); });
    assertThrow(function() { process("1g:34:56:78:90:AB" , MAC); });
    assertThrow(function() { process("g2:34:56:78:90:AB" , MAC); });

    assertThrow(function() { process("12:34:56:78:90-AB" , MAC); });
    assertThrow(function() { process("12:34:56:78-90:AB" , MAC); });
    assertThrow(function() { process("12:34:56-78:90:AB" , MAC); });
    assertThrow(function() { process("12:34-56:78:90:AB" , MAC); });
    assertThrow(function() { process("12-34:56:78:90:AB" , MAC); });
  });

  it("should validate net - ipv4 address", function() {
    var IPV4 = qdata.schema({
      $type: "ipv4"
    });

    assert(process("0.0.0.0"        , IPV4) === "0.0.0.0"        );
    assert(process("1.1.1.1"        , IPV4) === "1.1.1.1"        );
    assert(process("1.1.1.10"       , IPV4) === "1.1.1.10"       );
    assert(process("1.1.10.1"       , IPV4) === "1.1.10.1"       );
    assert(process("1.10.1.1"       , IPV4) === "1.10.1.1"       );
    assert(process("10.1.1.1"       , IPV4) === "10.1.1.1"       );
    assert(process("1.1.1.255"      , IPV4) === "1.1.1.255"      );
    assert(process("1.1.255.1"      , IPV4) === "1.1.255.1"      );
    assert(process("1.255.1.1"      , IPV4) === "1.255.1.1"      );
    assert(process("255.1.1.1"      , IPV4) === "255.1.1.1"      );
    assert(process("192.168.1.1"    , IPV4) === "192.168.1.1"    );
    assert(process("255.255.255.255", IPV4) === "255.255.255.255");

    assertThrow(function() { process(true        , IPV4); });
    assertThrow(function() { process("invalid"   , IPV4); });
    assertThrow(function() { process("0"         , IPV4); });
    assertThrow(function() { process("0.0"       , IPV4); });
    assertThrow(function() { process("0.0.0"     , IPV4); });
    assertThrow(function() { process("0.0.0.0."  , IPV4); });
    assertThrow(function() { process("0.0.0.0 "  , IPV4); });
    assertThrow(function() { process(".0.0.0.0"  , IPV4); });
    assertThrow(function() { process(" 0.0.0.0"  , IPV4); });
    assertThrow(function() { process("1.1.1..1"  , IPV4); });
    assertThrow(function() { process("1.1..1.1"  , IPV4); });
    assertThrow(function() { process("1..1.1.1"  , IPV4); });
    assertThrow(function() { process("1.1.1.01"  , IPV4); });
    assertThrow(function() { process("1.1.01.1"  , IPV4); });
    assertThrow(function() { process("1.01.1.1"  , IPV4); });
    assertThrow(function() { process("01.1.1.1"  , IPV4); });
    assertThrow(function() { process("1.1.1.256" , IPV4); });
    assertThrow(function() { process("1.1.256.1" , IPV4); });
    assertThrow(function() { process("1.256.1.1" , IPV4); });
    assertThrow(function() { process("256.1.1.1" , IPV4); });
    assertThrow(function() { process("1.1.1.1000", IPV4); });
    assertThrow(function() { process("1.1.1000.1", IPV4); });
    assertThrow(function() { process("1.1000.1.1", IPV4); });
    assertThrow(function() { process("1000.1.1.1", IPV4); });
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

    var data = {
      a: true,
      b: 1,
      c: 1.5,
      d: "string",
      nested: {
        a: 6,
        b: null
      }
    };
    assert(deepEqual(qdata.process(data, def), data));
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

    var data = { nested: {} };
    assert(deepEqual(qdata.process(data, def), data));
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

    assert(deepEqual(qdata.process(none, def), none));
    assert(deepEqual(qdata.process(data, def), data));
  });

  it("should validate object - unicode fields", function() {
    var def = qdata.schema({
      "\u0909": { $type: "string" },
      "\u0910": { $type: "string" }
    });

    var data = { "\u0909": "a", "\u0910": "b" };
    assert(deepEqual(qdata.process(data, def), data));
  });

  it("should validate object - escaped fields", function() {
    var def = qdata.schema({
      "\\$type"  : { $type: "string" },
      "\\\\value": { $type: "string" }
    });

    var data = { "$type": "int", "\\value": "13" };
    assert(deepEqual(qdata.process(data, def), data));
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

    assert(deepEqual(qdata.process(noise1, def, qdata.kExtractTopFields), data));
    assert(deepEqual(qdata.process(noise2, def, qdata.kExtractAllFields), data));

    assertThrow(function() { qdata.process(noise1, def, qdata.kNoOptions);        });
    assertThrow(function() { qdata.process(noise2, def, qdata.kExtractTopFields); });
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
          var pass = def.pass;
          var fail = def.fail;

          var Schema = qdata.schema({
            $type: "array",
            $data: {
              $type: type,
              $null: canBeNull ? true : false,
              $undefined: canBeUndefined ? true : false
            }
          });

          if (canBeNull)
            pass = pass.concat([null]);
          else
            fail = fail.concat([null]);

          if (canBeUndefined)
            pass = pass.concat([undefined]);
          else
            fail = fail.concat([undefined]);

          assert(deepEqual(qdata.process(pass, Schema), pass));

          fail.forEach(function(failValue) {
            assertThrow(function() { qdata.process([failValue], Schema); });
          });
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

    assert(deepEqual(qdata.process(data, def), data));
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

    assert(deepEqual(qdata.process([0, 1], defLen2), [0, 1]));
    assert(deepEqual(qdata.process([0, 1], defMin2), [0, 1]));
    assert(deepEqual(qdata.process([0, 1], defMax2), [0, 1]));

    assertThrow(function() { qdata.process([0, 1, 2], defLen2); });
    assertThrow(function() { qdata.process([1234567], defMin2); });
    assertThrow(function() { qdata.process([0, 1, 2], defMax2); });
  });

  it("should properly handle type ending with '?'", function() {
    var def = qdata.schema({
      a: { $type: "int"  },
      b: { $type: "int?" }
    });

    assert(deepEqual(qdata.process({ a: 0, b: 1    }, def), { a: 0, b: 1    }));
    assert(deepEqual(qdata.process({ a: 0, b: null }, def), { a: 0, b: null }));

    assertThrow(function() { qdata.process({ a: 0               }, def); });
    assertThrow(function() { qdata.process({ a: null, b: 1      }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: undefined }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: "string"  }, def); });
  });

  it("should properly handle type ending with '[]'", function() {
    var def = qdata.schema({
      a: { $type: "int"   },
      b: { $type: "int[]" }
    });

    assert(deepEqual(qdata.process({ a: 0, b: [0] }, def), { a: 0, b: [0] }));

    assertThrow(function() { qdata.process({ a: 0           }, def); });
    assertThrow(function() { qdata.process({ a: null, b: [] }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: null  }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: "s"   }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: ["s"] }, def); });
  });

  it("should properly handle type ending with '[]?'", function() {
    var def = qdata.schema({
      a: { $type: "int"    },
      b: { $type: "int[]?" }
    });

    assert(deepEqual(qdata.process({ a: 0, b: []   }, def), { a: 0, b: []   }));
    assert(deepEqual(qdata.process({ a: 0, b: [0]  }, def), { a: 0, b: [0]  }));
    assert(deepEqual(qdata.process({ a: 0, b: null }, def), { a: 0, b: null }));

    assertThrow(function() { qdata.process({ a: 0               }, def); });
    assertThrow(function() { qdata.process({ a: null, b: []     }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: undefined }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: "s"       }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: ["s"]     }, def); });
  });

  it("should properly handle type ending with '?[]?'", function() {
    var def = qdata.schema({
      a: { $type: "int"     },
      b: { $type: "int?[]?" }
    });

    assert(deepEqual(qdata.process({ a: 0, b: []     }, def), { a: 0, b: []     }));
    assert(deepEqual(qdata.process({ a: 0, b: [0]    }, def), { a: 0, b: [0]    }));
    assert(deepEqual(qdata.process({ a: 0, b: null   }, def), { a: 0, b: null   }));
    assert(deepEqual(qdata.process({ a: 0, b: [null] }, def), { a: 0, b: [null] }));

    assertThrow(function() { qdata.process({ a: 0               }, def); });
    assertThrow(function() { qdata.process({ a: null, b: []     }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: undefined }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: "s"       }, def); });
    assertThrow(function() { qdata.process({ a: 0, b: ["s"]     }, def); });
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
      assert(err instanceof qdata.SchemaError);
      assert(deepEqual(err.details, [
        { code: "BoolCheckFailure"  , path: "a" },
        { code: "IntCheckFailure"   , path: "b" },
        { code: "DoubleCheckFailure", path: "c" },
        { code: "StringCheckFailure", path: "d" },
        { code: "IntCheckFailure"   , path: "nested.a" },
        { code: "IntCheckFailure"   , path: "nested.b" }
      ]));
    }

    if (out)
      throw new Error("Should have thrown exception.");
  });
});
