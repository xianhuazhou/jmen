#!/usr/bin/env node
//
// jmen is a tool can merge javascript files into one file whenever one of those files is updated.
// Notice: it's only tested on Ubuntu Linux
//
// Usage: jmen --source /path/to/index.js --output /path/to/website/assets/app.js
//        jmen --help
//
// Author: xianhua.zhou@gmail.com
//
var fs = require('fs'),
  path = require('path'),
  os = require('os'),
  spawn = require('child_process').spawn,
  JMEN_VERSION = '0.1-dev';

(function(params){
  var files = [];

  function puts(msg) {
    console.log(msg);
  }

  function getTempFile(f) {
    var tmpFiles = f.split('/');
    var tmpFile = '.' + tmpFiles.pop();
    tmpFiles.push(tmpFile);
    return tmpFiles.join("/");
  }

  function printVersion() {
    puts('jmen version: ' + JMEN_VERSION + " on " + os.type() + " " + os.release());
  }

  function printHelp() {
    printVersion();
    puts("Usage: node jmen.js --file <file> <options>");
    puts("  --file | -f\t\tsource file path");
    puts("options:");
    puts("  --output | -o\t\ttarget file to save the final result");
    puts("  --encoding | -n\tfile encoding, default is utf8");
    process.exit(0);
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

    if (args.length == 0) {
      printHelp();
    }

    for (var i = 0; i < args.length; i++) { 
      if (args[i] == "--version" || args[i] == "-v") {
        printVersion();
        process.exit(0);
      }

      if (args[i] == "--help" || args[i] == "-h") {
        printHelp();
      }

      parseParam('file', /(\-\-file=[\w\.\/]+|\-f)/);
      parseParam('output', /(\-\-output=[\w\.\/]+|\-o)/);
      parseParam('encoding', /(\-\-encoding=[\w\.\/]+|\-e)/);
    }

    params.encoding = params.encoding || 'utf8';

    return params;
  })(process.argv.splice(2));

  var JMen = {
    isParsing: false,
    files: [],
    result: [],
    regexp: /^\/\/=\s+require\s+["']([\w\/\.]+)["']\s*$/,

    parseFile: function(file) {
      this.isParsing = true;
      this.files.push(file);

      try {
        var filePath = fs.realpathSync(file);
      } catch (e) {
        var filePath = fs.realpathSync(getTempFile(file));
      }

      var directory = path.dirname(filePath),
        data = fs.readFileSync(filePath, params.encoding),
        self = this;

      data.split(/\n|\r/).forEach(function(line){
        includeFile = line.match(self.regexp)
        if (includeFile) {
          self.parseFile(path.join(directory, includeFile[1]));
        } else {
          self.result.push(line + "\n");
        }
      });
    },

    run: function() {
      this.files = [];
      this.parseFile(params.file);

      var result = this.result;
      result.pop();

      result = result.join('');

      if (params.output) {
        fs.writeFileSync(params.output, result, params.encoding);
      } else {
        puts(result);
      }

      this.result = [];
      this.isParsing = false;
    }
  } 

  JMen.run();
  puts("jmen is running...");
  printVersion();

  JMen.files.forEach(function(f){
    fs.watchFile(f, function(curr, prev){
      if (curr.mtime != prev.mtime && !JMen.isParsing) {
        puts("file \"" + f + "\" is changed, creating new file...");
        var cat = spawn("cat", [f])
        cat.stdout.on('data', function(d){
          var tmpFile = getTempFile(f);
          fs.open(tmpFile, "w", function(err, fd){
            fs.writeSync(fd, d, 0, d.length, 0);
          });
          JMen.run();
          fs.unlink(tmpFile);
        });
      }
    });
  });
})();
