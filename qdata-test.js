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
  var schema = qdata.schema({ $type: "date" });
  var date = "2016-02-28";

  Utils.test(function() {
    for (var i = 0; i < 3000000; i++) {
      qdata.process(date, schema);
    }
  }, "test YYYY-MM-DD");
})();

(function() {
  var schema = qdata.schema({ $type: "date", $form: "D.M.Y" });
  var date = "28.2.2016";

  Utils.test(function() {
    for (var i = 0; i < 3000000; i++) {
      qdata.process(date, schema);
    }
  }, "test D.M.Y");
})();

/*
(function() {

var schema = qdata.schema({
  a: { $type: "int" },
  b: { $type: "int[]" }
});

try {
  var out = qdata.process({ a:0, b:[1] }, schema);
  console.log(out);
} catch (ex) {
  console.log(ex.details);
}
})();
*/
