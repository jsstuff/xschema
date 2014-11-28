var assert = require("assert");
var qdata = require("./qdata");

var Utils = {
  padLeft: function(s, n) {
    while (s.length < n)
      s = " " + s;
    return s;
  },

  test: function(fn, name) {
    var timeStart = +new Date();

    fn();

    var timeEnd = +new Date();
    var timeStr = Utils.padLeft(((timeEnd - timeStart) / 1000).toFixed(3), 6);

    console.log(name + ":" + timeStr + " [s] ");
  }
};

/*
(function() {

var schema = qdata.schema({
  nested: {
    array: {
      $type: "array",
      $data: {
        date: { $type: "date" }
      }
    }
  }
});

try {
  var out = qdata.process({
    nested: {
      array: [
        { date: "2000-02-29" },
        { date: "1999-12-33" },
        { date: "1999-02-01" },
        { date: "0000-12-01" }
      ]
    }
  }, schema, qdata.kAccumulateErrors);

  console.log("SUCCESS:");
  console.log(JSON.stringify(out, null, 2));
}
catch (ex) {
  console.log("FAILURE:");
  console.log(ex);
}

})();
*/

/*
(function() {

var schema = qdata.schema({
  nested: {
    a: { $type: "string", $optional: true  },
    b: { $type: "string", $optional: false }
  }
});

try {
  var out = qdata.process({
    nested: {
    }
  }, schema, qdata.kAccumulateErrors);

  console.log("SUCCESS:");
  console.log(JSON.stringify(out, null, 2));
}
catch (ex) {
  console.log("FAILURE:");
  console.log(ex);
}

})();
*/


(function() {

var schema = qdata.schema({
  a: { $type: "date" },
  b: { $type: "date" }
});

var obj = {
  a: "2010-01-01",
  b: "2016-02-29"
};

Utils.test(function() {
  for (var i = 0; i < 1000000; i++) {
    qdata.process(obj, schema);
  }
}, "test");

})();
