"use strict";

// NOTE: To run the benchmark suite you need to `npm install` these packages:
const ajv = require("ajv");
const ismyjsonvalid = require("is-my-json-valid");
const jayschema = require("jayschema");
const jsonschema = require("jsonschema");
const tv4 = require("tv4");

const xschema = require("./xschema");

const DUMP = false;
const N_ITERATIONS = 100000;

const Utils = {
  padLeft: function(s, n) {
    return " ".repeat(Math.max(0, n - s.length)) + s;
  },

  testOne: function(test, spec) {
    var time = process.hrtime();
    test.func(spec);
    time = process.hrtime(time);

    return {
      name: test.name,
      time: (time[0] * 10000000 + time[1]) / 1000000
    }
  },

  testAll: function(tests, spec) {
    var i;
    var results = [];

    for (i = 0; i < tests.length; i++)
      results.push(this.testOne(tests[i], spec));

    results.sort(function(a, b) {
      return a.time - b.time;
    });

    console.log(spec.name + ":");
    for (i = 0; i < results.length; i++)
      console.log(Utils.padLeft(results[i].time.toFixed(3), 10) + " [ms]: " + results[i].name);
    console.log();
  }
};

// ============================================================================
// [DataSets]
// ============================================================================

const SimpleSpec = {
  name: "SimpleSpec",

  XSchema: xschema.schema({
    id         : { $type: "string" },
    int1       : { $type: "int"    },
    int2       : { $type: "int"    },
    int3       : { $type: "int"    },
  }),

  JSONSchema: {
    "type": "object",
    "properties": {
      "id"         : { "type": "string"  },
      "int1"       : { "type": "integer" },
      "int2"       : { "type": "integer" },
      "int3"       : { "type": "integer" },
    },
    "additionalProperties": false
  },

  Data: {
    id: "Some ID",
    int1: 0,
    int2: 1,
    int3: 2
  }
};

const PersonSpec = {
  name: "PersonSpec",

  XSchema: xschema.schema({
    name       : { $type: "string" },
    registered : { $type: "date" },
    ipAddress  : { $type: "ipv4" },
    address: {
      lines    : { $type: "string[]" },
      zip      : { $type: "string" },
      city     : { $type: "string" },
      country  : { $type: "string" }
    },
    likes      : { $type: "int32", $min: 1 }
  }),

  JSONSchema: {
    "type": "object",
    "properties": {
      "name"       : { "type": "string" },
      "registered" : { "type": "string", format: "date" },
      "ipAddress"  : { "type": "string", format: "ipv4" },
      "address": {
        "type"     : "object",
        "properties": {
          "lines": {
            "type" : "array",
            "items": { "type": "string" }
          },
          "zip"    : { "type": "string" },
          "city"   : { "type": "string" },
          "country": { "type": "string" }
        },
        "additionalProperties": false
      },
      "likes"      : { "type": "integer", "minimum": 1 }
    },
    "additionalProperties": false
  },

  Data: {
    name: "Some person",
    registered: "2000-02-29",
    ipAddress: "192.168.1.1",
    address: {
      lines: ["1600 Pennsylvania Avenue Northwest"],
      zip: "DC 20500",
      city: "Washington",
      country: "USA"
    },
    likes: 10212
  }
};

// ============================================================================
// [Tests]
// ============================================================================

const Tests = [];

Tests.push({
  name: "jayschema",
  func: function(spec) {
    const schema = spec.JSONSchema;
    const data = spec.Data;

    const jay = new jayschema();
    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(jay.validate(data, schema), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      jay.validate(data, schema);

  }
});

Tests.push({
  name: "jsonschema",
  func: function(spec) {
    const schema = spec.JSONSchema;
    const data = spec.Data;

    const v = new jsonschema.Validator();
    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(v.validate(data, schema), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      v.validate(data, schema);
  }
});

Tests.push({
  name: "tv4",
  func: function(spec) {
    const schema = spec.JSONSchema;
    const data = spec.Data;

    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(tv4.validate(data, schema), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      tv4.validate(data, schema);
  }
});

Tests.push({
  name: "ajv",
  func: function(spec) {
    const schema = spec.JSONSchema;
    const data = spec.Data;

    const validate = ajv().compile(schema);
    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(validate(data), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      validate(data);
  }
});

Tests.push({
  name: "ismyjsonvalid",
  func: function(spec) {
    const schema = spec.JSONSchema;
    const data = spec.Data;

    const validate = ismyjsonvalid(schema);
    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(validate(data), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      validate(data);
  }
});

Tests.push({
  name: "xschema.process",
  func: function(spec) {
    const schema = spec.XSchema;
    const data = spec.Data;

    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(xschema.process(data, schema), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      xschema.process(data, schema);
  }
});

Tests.push({
  name: "xschema.test",
  func: function(spec) {
    const schema = spec.XSchema;
    const data = spec.Data;

    if (DUMP)
      console.log("Result of '" + this.name + "':\n" + JSON.stringify(xschema.test(data, schema), null, 2));

    for (var i = 0, n = N_ITERATIONS; i < n; i++)
      xschema.test(data, schema);
  }
});

Utils.testAll(Tests, SimpleSpec);
Utils.testAll(Tests, PersonSpec);
