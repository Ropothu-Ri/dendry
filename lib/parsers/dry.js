/* dendry
 * http://github.com/idmillington/dendry
 *
 * MIT License
 */
/*jshint indent:2 */
(function() {
  "use strict";

  var path = require('path');
  var fs = require('fs');
  var assert = require('assert');

  var RESERVED_PROPERTIES = {
    "id": true,
    "sections": true,
    "content": true,
    "options": true
  };

  var idReString = "[\\w-]+(?:\\.[\\w-]+)*";
  var idRe = new RegExp("^"+idReString+"$");

  var relativeIdReString = "(?:\\.+|[\\w-])[\\w-]*(?:\\.[\\w-]+)*";
  var relativeIdRe = new RegExp("^"+relativeIdReString+"$");

  var propRe = /^([a-z-]+)\s*:\s*([\s\S]*)$/;
  var parseProperty = function(propertyString) {
    propertyString = propertyString.trim();
    var match = propRe.exec(propertyString);
    if (match) {
      var name = match[1];
      name = name.replace(/-(.)/g, function(match, letter) {
        return letter.toUpperCase();
      });
      return {
        name: name,
        value: match[2]
      };
    } else {
      return null;
    }
  };

  var tagReString = "[\\w-]+";
  var ifReString = "\\s+if\\s+([^:]+)";
  var optionReString =
    "^(#"+tagReString+"|@"+relativeIdReString+")"+ // tag or id
    "(?:"+ifReString+")?"+ // if-clause
    "(?:\\s*:\\s*(.*))?$"; // colon and title
  var optionRe = new RegExp(optionReString);

  var parseOption = function(optionString) {
    optionString = optionString.trim();
    var match = optionRe.exec(optionString);
    if (match) {
      var obj = {
        id: match[1]
      };
      if (match[2]) obj.viewIf = match[2];
      if (match[3]) obj.title = match[3];
      return obj;
    } else {
      return null;
    }
  };

  var filenameRe = /^([\w-]+?(\.[\w-]+?)*?)(\.([\w-]+?))?$/;
  var parseFilename = function(filename) {
    var ext = path.extname(filename);
    var base = path.basename(filename, ext);
    var match = filenameRe.exec(base);
    if (match) {
      var obj = {
        id: match[1]
      };
      if (match[4]) obj.type = match[4];
      return obj;
    } else {
      return null;
    }
  };

  // Parses the given content, extracted from the given file.
  var parseFromContent = function(filename, content, callback) {
    // Magic is embedded scripting. This determines if the line ends still
    // inside the magic block.
    var endsInMagic = function(startsInMagic, thisLine) {
      var lastStart = thisLine.lastIndexOf("{!");
      var lastEnd = thisLine.lastIndexOf("!}");
      if (lastEnd > lastStart) {
        return false;
      } else if (lastStart > lastEnd) {
        return true;
      } else {
        // They are only equal if they are both -1
        return startsInMagic;
      }
    };

    // For properties and links, we can have follow on lines, this
    // checks and advances the current line, returning the accumulated
    // data.
    var gobbleFollowOnLines = function(canUseMagic) {
      var content;
      var inMagic = false;

      var indentRe = /^\s+\S/;
      var startMagic;
      var endMagic;

      // Test the initial content for magic.
      if (canUseMagic) {
        inMagic = endsInMagic(false, line);
      }
      content = [inMagic ? line+'\n' : line];

      // Gobble lines.
      for (var j = i+1; j <= lines.length; ++j) {
        var thisLine = lines[j-1];
        if (!inMagic) {
          // No indent at the start means we're done.
          if (!indentRe.test(thisLine)) break;
        }

        // Update whether we're in magic or not.
        var startedInMagic = inMagic;
        if (canUseMagic) {
          inMagic = endsInMagic(inMagic, thisLine);
        }

        // We have a continuation line, trim it down unless it is magic.
        i = j;
        if (!startedInMagic) {
          thisLine = " " + thisLine.trim();
        } else {
          // Always trim the end, ending whitespace is never significant.
          thisLine = thisLine.replace(/\s*$/, '');
        }
        if (inMagic) thisLine = thisLine + '\n';
        content.push(thisLine);
      }

      line = content.join("");
    };

    // Handles an error, adding line number.
    var error = function(message) {
      var fullMessage = i ?
        filename+" line "+i.toString()+": "+message :
        message;
      var error = new Error(fullMessage);
      error.line = i;
      callback(error);
    };

    var validateId = function(text) {
      if (!idRe.test(text)) {
        error("Malformed id '"+text+"' (use letters, numbers, _ and - only).");
        return false;
      }
      return true;
    };

    // Validate a property, returns null if the property is invalid
    // and an error was raised.
    var parseAndValidateProperty = function(text, whatami) {
      var property = parseProperty(text);
      if (property !== null) {
        if (RESERVED_PROPERTIES[property.name]) {
          return error("Property '"+property.name+"' is a reserved name.");
        } else if (currentSection[property.name] !== undefined) {
          return error("Property '"+property.name+"' is already defined.");
        } else {
          return property;
        }
      } else {
        return error("Invalid "+whatami+" definition.");
      }
    };

    var finishCurrentSection = function() {
      currentSection.content = contentLines.join("\n");
    };

    // Blank lines are used as the primary transitions between content chunks.
    var handleBlankLine = function() {
      switch (context) {
      case 'content':
        context = 'blank-content';
        break;
      case 'properties':
        context = 'first-content';
        break;
      case 'options':
        // Transitions into no-context, we can have no more content.
        context = null;
        break;
      case null:
        // We're after any content, so ignore any blank lines.
        break;
      }
      return true;
    };

    // Lines beginning with '@' introduce a new section.
    var createNewSection = function() {
      if (result.sections === undefined) result.sections = [];
      finishCurrentSection();

      var id = line.substr(1).trim();
      if (!validateId(id)) return false;

      // Check for id reuse.
      if (id === result.id) {
        error("Section can't use the file id '"+id+"'.");
        return false;
      }
      if (sectionIds[id] !== undefined) {
        error("Section with id '"+id+"' already defined.");
        return false;
      } else {
        sectionIds[id] = true;
      }

      // Combine with the file id
      id = [result.id, id].join('.');

      // Create a new section and register it.
      currentSection = {
        id: id
      };
      contentLines = [];
      optionIds = {};
      result.sections.push(currentSection);

      context = 'properties';
      return true;
    };

    var beginOptionsBlock = function() {
      context = 'options';
      currentSection.options = {
        options: []
      };
      return true;
    };

    var handlePropertyLine = function() {
      gobbleFollowOnLines(true);
      var property = parseAndValidateProperty(line, "property");
      if (property !== undefined) {
        currentSection[property.name] = {$value:property.value,
                                         $file:filename,
                                         $line:i};
        return true;
      } else {
        // Error has been raised, just exit.
        return false;
      }
    };

    var handleOptionLine = function() {
      gobbleFollowOnLines(false);
      if (line.substr(0,1) !== '-') {
        error("Hyphens are required in an option block.");
        return false;
      }

      var lineTrimmed = line.substr(1).trim();
      var option = parseOption(lineTrimmed);
      if (option !== null) {
        // Check for redefinitions.
        if (optionIds[option.id] !== undefined) {
          error("Option with id/tag '"+option.id+"' already specified.");
          return false;
        } else {
          optionIds[option.id] = true;
        }
        currentSection.options.options.push({$value:option,
                                             $file:filename,
                                             $line:i});
      } else {
        // See if we can interpret it as a property.
        option = parseAndValidateProperty(line.substr(1).trim(),
                                          "property or option");
        if (option !== undefined) {
          currentSection.options[option.name] = {$value:option.value,
                                                 $file:filename,
                                                 $line:i};
        } else {
          // Error has been raised, just exit.
          return false;
        }
      }
      return true;
    };

    // ......................................................................
    // Parsing algorithm.
    var i;
    var line;
    var lines = content.split(/\n/);
    var context = 'properties';
    var contentLines = [];
    var sectionIds = {};
    var optionIds = {};
    var result = parseFilename(filename);
    if (!result) {
      return error("Cannot extract id or type from filename.");
    }
    var currentSection = result;

    // Interpret lines in sequence.
    for (i = 1; i <= lines.length; ++i) {
      line = lines[i-1];

      // Ignore comments.
      if (line.substring(0, 1) == '#') continue;

      // A blank line transitions between chunk types
      if (line.trim().length === 0) {
        assert.ok(handleBlankLine());
        continue;
      }

      // If we have an id, then create a new section.
      if (line.substring(0, 1) == '@') {
        if (!createNewSection()) return;
        continue;
      }

      // Hyphens separated by content by a blank link begin options.
      if (line.substring(0, 1) == '-' && (context == 'blank-content' ||
                                          context == 'first-content')) {
        assert.ok(beginOptionsBlock());
      }

      // Otherwise deal with the appropriate content.
      switch(context) {
      case null:
        return error("Found content after an options block.");

      case 'blank-content':
        contentLines.push('');
        /* falls through */
      case 'first-content':
      case 'content':
        contentLines.push(line);
        context = 'content';
        break;

      case 'properties':
        if (!handlePropertyLine()) return;
        break;

      case 'options':
        if (!handleOptionLine()) return;
        break;
      }
    }

    finishCurrentSection();
    return callback(null, result);
  };

  // Loads and parses the given file.
  var parseFromFile = function(filename, callback) {
    fs.readFile(filename, function(err, content) {
      if (err) return callback(err);
      parseFromContent(filename, content.toString(), callback);
    });
  };

  // ======================================================================

  // Accessors for property values, which cope with raw property
  // values, or with augmented values containing a line number.
  var propval = function(property) {
    if (property !== undefined && property.$value !== undefined) {
      return property.$value;
    } else {
      return property;
    }
  };

  var properr = function(property, msg) {
    if (property !== undefined && property.$line !== undefined) {
      if (property.$file !== undefined) {
        msg = property.$file+" line "+property.$line+": "+msg;
      } else {
        msg = "Line "+property.$line+": "+msg;
      }
    }
    return new Error(msg);
  };

  var propline = function(property) {
    return property.$line;
  };

  var propfile = function(property) {
    return property.$file;
  };

  module.exports = {
    parseFromContent: parseFromContent,
    parseFromFile: parseFromFile,

    regexes: {
      id: idRe,
      relativeId: relativeIdRe
    },

    propval: propval,
    properr: properr,
    propline: propline,
    propfile: propfile
  };

}());