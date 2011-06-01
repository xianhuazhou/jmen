#!/usr/bin/env node
//
// jmen is a tool can merge javascript files into one file whenever one of those files is updated.
//
// Usage: jmen --source /path/to/index.js --output /path/to/website/assets/app.js
//        jmen --help
//
// Author: xianhua.zhou@gmail.com
//
var fs = require('fs');
var path = require('path');
var os = require('os');
var JMEN_VERSION = '0.1';

(function(params){
  var result = [];

  function puts(msg) {
    console.log(msg);
  }

  function printVersion() {
    puts('jmen version: ' + JMEN_VERSION + " on " + os.type() + " " + os.release());
  }

  var params = (function(args){
    var params = {};
    var parseParam = function(prop, regexp){
      if (args[i].match(regexp)) {
        if (args[i].indexOf('=') != -1) {
          params[prop] = args[i].split('=')[1];
        } else {
          params[prop] = args[++i];
        }
      }
    }
    for (var i = 0; i < args.length; i++) { 
      if (args[i] == "--version" || args[i] == "-v") {
        printVersion();
        process.exit(0);
      }

      if (args[i] == "--help" || args[i] == "-h") {
        printVersion();
        puts("Usage: node jmen.js --file <file> <options>");
        puts("  --file | -f\t\tsource file path");
        puts("options:");
        puts("  --output | -o\t\ttarget file to save the final result");
        puts("  --add-newline | -n\tadd a new line into the end of each javascript file, default is true");
        puts("  --encoding | -n\tfile encoding, default is utf8");
        process.exit(0);
      }

      parseParam('file', /(\-\-file=[\w\.\/]+|\-f)/);
      parseParam('output', /(\-\-output=[\w\.\/]+|\-o)/);
      parseParam('newline', /(\-\-add\-newline=[\w\.\/]+|\-n)/);
      parseParam('encoding', /(\-\-encoding=[\w\.\/]+|\-e)/);
    }

    params.encoding = params.encoding || 'utf8';
    params.newline = params.newline == 'true' || params.newline == null;

    return params;
  })(process.argv.splice(2));

  function parseFile(file) {
    var directory = path.dirname(fs.realpathSync(file));
    var data = fs.readFileSync(file, params.encoding); 
    data.split(/\n|\r/).forEach(function(line){
      includeFile = line.match(/^\/\/=\s+require\s+["']([\w\/\.]+)["']\s*$/)
      if (includeFile) {
        parseFile(path.join(directory, includeFile[1]));
        if (params.newline) {
          result.push("\n")
        }
      } else {
        result.push(line);
      }
    });  
  }

  parseFile(params.file);
  if (params.newline) {
    result.pop();
  }
  result = result.join('');

  if (params.output) {
    fs.writeFileSync(params.output, result, params.encoding);
  } else {
    puts(result);
  }
})();
