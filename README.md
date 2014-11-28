QData
=====

  * [Official Repository (jshq/qdata)](https://github.com/jshq/qdata)
  * [Unlicense] (http://unlicense.org)

QData is a high performance and extensible data library based on an extensible schema builder. It allows to build a schema that can be then used to validate any kind of JavaScript data (the root variable can be object, array, or any other primitive type). The library is designed for critical systems that have to process a lot of data by moving data validation into extreme. QData uses a JIT compiler that compiles a schema into highly optimized JavaScript function, which executes many times faster than traditional validators.

QData itself has been designed to be extensible as there are always cases that require more than is supported by built-in types and validators. The schema structure is always declarative and most of the schemas (if no custom functions were used) can be serialized to JSON (unlike other libraries QData doesn't use type objects to describe data types). The library also allows to associate a custom information (we call it metadata) with any field that doesn't have to be used by QData itself, but is used by QData consumers.

QData has also several processing options that can be used to change the behavior of data processing (validation). For example a data processor can be configured to extract all keys from top-level object (if it's for example a HTTP request data), but follow strictly all nested objects (or extract all nested objects too). Validation options are described later as there are many of them and can be combined together.

QData has also support for error accumulation that can be used to store _all_ errors that happened during validation. This can be used on the client to highlight all invalid fields (for example) or by server that wants to provide complete information about failure. There are no performance penalties as every data processing function having different options is compiled separately and then cached if called multiple times.

Disclaimer
----------

QData library has been designed to solve common, but also very specific problems. It's very fast and the support for metadata allows to simply extend it to support new features. All features are actually used in production and you will find many of them handy if implementing web services that do CRUD operations, as single schema can be used to validate data that is inserted, updated, queried, or deleted. There are theoretically no limits on usage. The library was designed to be high performance (hence the JIT compiler), but is also very friendly in terms of extensibility and allows it to be extended in runtime rather than trying to implement everything.

Introduction
------------

TO BE DOCUMENTED

License
-------

QData follows [Unlicense](http://unlicense.org/).
