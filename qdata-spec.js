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
  it("should test deepEqual functionality", function() {
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

  it("should test deepCopy functionality", function() {
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
    var schema = qdata.schema({ $type: "bool" });

    var pass = [false, true];
    var fail = [0, 1, "", "string", {}, [], Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, schema); });
    });
  });

  it("should validate number - int", function() {
    var schema = qdata.schema({ $type: "int" });

    var pass = [0, 1, -1];
    var fail = [false, true, "", "0", "string", {}, [], 0.1, -0.23211, Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, schema); });
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
    var schema = qdata.schema({ $type: "number" });

    var pass = [0, 1, -1, 0.1, -0.23211];
    var fail = [false, true, "", "0", "string", {}, [], Infinity, -Infinity, NaN];

    pass.forEach(function(value) {
      assert(process(value, schema) === value);
    });

    fail.forEach(function(value) {
      assertThrow(function() { process(value, schema); });
    });
  });

  it("should validate number - lat/lon", function() {
    var schemaLat = qdata.schema({ $type: "lat" });
    var schemaLon = qdata.schema({ $type: "lon" });

    var passLat = [-90, -45.5334, 0, 34.4432, 90];
    var failLat = [-90.0001, 90.0001, "", true, null, undefined];

    var passLon = [-180, -144.4322, 0, 99.2332, 180];
    var failLon = [-180.0001, 180.0001, "", true, null, undefined];

    passLat.forEach(function(value) {
      assert(process(value, schemaLat) === value);
    });

    failLat.forEach(function(value) {
      assertThrow(function() { process(value, schemaLat); });
    });

    passLon.forEach(function(value) {
      assert(process(value, schemaLon) === value);
    });

    failLon.forEach(function(value) {
      assertThrow(function() { process(value, schemaLon); });
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
    var schema = qdata.schema({ $type: "text" });

    // Should accept some characters below 32.
    assert(process("some text \x09", schema) === "some text \x09");
    assert(process("some text \x0A", schema) === "some text \x0A");
    assert(process("some text \x0D", schema) === "some text \x0D");

    // Should refuse NULL and other characters below 32.
    assertThrow(function() { process("some text \x00", schema); });
    assertThrow(function() { process("some text \x1B", schema); });
    assertThrow(function() { process("some text \x1F", schema); });
  });

  it("should validate date - basics", function() {
    var YYYY_MM    = qdata.schema({ $type: "date", $form: "YYYY-MM" });
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
    var YYYY_MM_DD = qdata.schema({ $type: "date" });

    assert(process("2000-02-29", YYYY_MM_DD) === "2000-02-29");
    assert(process("2004-02-29", YYYY_MM_DD) === "2004-02-29");
    assert(process("2008-02-29", YYYY_MM_DD) === "2008-02-29");
    assert(process("2012-02-29", YYYY_MM_DD) === "2012-02-29");
    assert(process("2016-02-29", YYYY_MM_DD) === "2016-02-29");
    assert(process("2400-02-29", YYYY_MM_DD) === "2400-02-29");

    assertThrow(function() { process("1999-02-29", YYYY_MM_DD); });
    assertThrow(function() { process("2100-02-29", YYYY_MM_DD); });
  });

  it("should validate date - leap second handling", function() {
    var schema = qdata.schema({ $type: "datetime", $leapSecond: true });

    assert(process("1972-06-30 23:59:60", schema) === "1972-06-30 23:59:60");
    assert(process("1972-12-31 23:59:60", schema) === "1972-12-31 23:59:60");
    assert(process("2012-06-30 23:59:60", schema) === "2012-06-30 23:59:60");

    // Leap seconds data start from 1972, 1971 and below are not in the table.
    assertThrow(function() { process("1971-06-30 23:59:60", schema); });
    assertThrow(function() { process("1971-12-31 23:59:60", schema); });

    // Leap seconds dates that are known.
    assertThrow(function() { process("1973-06-30 23:59:60", schema); });
    assertThrow(function() { process("2013-06-30 23:59:60", schema); });
    assertThrow(function() { process("2013-12-31 23:59:60", schema); });
    assertThrow(function() { process("2014-06-30 23:59:60", schema); });
    assertThrow(function() { process("2014-12-31 23:59:60", schema); });

    // Future leap seconds are not known at the moment.
    assertThrow(function() { process("2100-06-30 23:59:60", schema); });
    assertThrow(function() { process("2100-12-31 23:59:60", schema); });
  });

  it("should validate date - valid custom format YYYYMMDD", function() {
    var schema = qdata.schema({ $type: "date", $form: "YYYYMMDD" });

    assert(process("19990101", schema) === "19990101");
    assert(process("20041213", schema) === "20041213");

    assertThrow(function() { process("invalid"  , schema); });
    assertThrow(function() { process("2011312"  , schema); });
    assertThrow(function() { process("20111312" , schema); });
    assertThrow(function() { process("20140132" , schema); });
    assertThrow(function() { process("20110101 ", schema); });
  });

  it("should validate date - valid custom format D.M.Y", function() {
    var schema = qdata.schema({ $type: "date", $form: "D.M.Y" });

    assert(process("1.1.455", schema) === "1.1.455");
    assert(process("2.8.2004", schema) === "2.8.2004");
    assert(process("20.12.2004", schema) === "20.12.2004");

    assertThrow(function() { process("32.1.2004", schema); });
    assertThrow(function() { process("20.13.2004", schema); });
    assertThrow(function() { process("20.13.10000", schema); });
  });

  it("should validate date - invalid custom format", function() {
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YD"            }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YM"            }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YMD"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "DMY"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "M-D"           }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "MM-DD"         }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YYYY-DD"       }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YYYY-MM-DD mm" }); });
    assertThrow(function() { qdata.schema({ $type: "date", $form: "YYYY-MM-DD ss" }); });
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

          var schema = qdata.schema({
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

          assert(deepEqual(qdata.process(pass, schema), pass));

          fail.forEach(function(failValue) {
            assertThrow(function() { qdata.process([failValue], schema); });
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
