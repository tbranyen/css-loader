/* CSS Loader v0.1.0
 * Copyright 2013, Tim Branyen (@tbranyen).
 * loader.js may be freely distributed under the MIT license.
 */
(function(global) {
"use strict";

// Cache used to map configuration options between load and write.
var buildMap = {};

// Alias the correct `nodeRequire` method.
var nodeRequire = typeof requirejs === "function" && requirejs.nodeRequire;

// If in Node, get access to the filesystem.
if (nodeRequire) {
  var fs = nodeRequire("fs");
}

// Define the plugin using the CommonJS syntax.
define(function(require, exports) {
  var ScopedCss = require("scopedcss");

  exports.version = "0.1.0";

  // Invoked by the AMD builder, passed the path to resolve, the require
  // function, done callback, and the configuration options.
  exports.load = function(name, req, load, config) {
    // Dojo provides access to the config object through the req function.
    if (!config) {
      config = require.rawConfig;
    }

    var settings = configure(config);

    // Builds with r.js require Node.js to be installed.
    if (config.isBuild) {
      var path = settings.root + name + settings.ext;
      var contents = "";

      // First try reading the filepath as-is.
      try {
        contents = String(fs.readFileSync(path));
      }
      // If it failed, it's most likely because of a leading `/` and not an
      // absolute path.
      catch(ex) {
        // Remove the leading slash and try again.
        if (path[0] === "/") {
          path = path.slice(1);
        }

        // Try reading again with the leading `/`.
        contents = String(fs.readFileSync(path));
      }

      // Read in the file synchronously, as RequireJS expects, and return the
      // contents.
      buildMap[name] = contents;

      return load();
    }

    // Create a basic XHR.
    var xhr = new XMLHttpRequest();

    // Wait for it to load.
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        // Process as a Lo-Dash template and cache.
        var scoped = buildMap[name] = new ScopedCss(null, xhr.responseText);

        // Run the initial process.
        scoped.process();

        // Return the ScopedCss instance.
        load(scoped);
      }
    };

    // Initiate the fetch.
    xhr.open("GET", settings.root + name + settings.ext, true);
    xhr.send(null);
  };

  // Also invoked by the AMD builder, this writes out a compatible define
  // call that will work with loaders such as almond.js that cannot read
  // the configuration data.
  exports.write = function(pluginName, moduleName, write) {
    var contents = buildMap[moduleName];

    // Write out the actual definition
    write(strDefine(pluginName, moduleName, contents));
  };

  // This is for curl.js/cram.js build-time support.
  exports.compile = function(pluginName, moduleName, req, io, config) {
    configure(config);

    // Ask cram to fetch the template file (resId) and pass it to `write`.
    io.read(moduleName, write, io.error);

    function write(contents) {
      // Write-out define(id,function(){return{/* template */}});
      io.write(strDefine(pluginName, moduleName, contents));
    }
  };

  // Crafts the written definition form of the module during a build.
  function strDefine(pluginName, moduleName, contents) {
    contents = contents.replace(/\n/g, "");

    return [
      "define('", pluginName, "!", moduleName, "', ", "['scopedcss'], ",
        [
          "function(ScopedCss) {",
            "var scoped = new ScopedCss(null, '", contents, "');",
            "scoped.process();",
            "return scoped;",
          "}"
        ].join(""),
      ");\n"
    ].join("");
  }

  function configure(config) {
    var cssLoader = config.cssLoader || {};

    // Default settings point to the project root and using html files.
    var settings = {
      ext: cssLoader.ext || ".css",
      root: cssLoader.root || config.baseUrl,
    };

    // Ensure the root has been properly configured with a trailing slash,
    // unless it's an empty string or undefined, in which case work off the
    // baseUrl.
    if (settings.root && settings.root[settings.root.length-1] !== "/") {
      settings.root += "/";
    }

    return settings;
  }
});

})(typeof global === "object" ? global : this);
