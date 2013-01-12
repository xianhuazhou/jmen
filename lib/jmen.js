var fs = require('fs'),
path = require('path'),
os = require('os'),
coffee = require('coffee-script'),
spawn = require('child_process').spawn,
JMEN_VERSION = '0.3.0';

(function(){
    var files = [];
    var FUTUREFILES_INTERVAL = 1000;

    function puts(msg) {
        console.log("[" + (new Date()).toLocaleTimeString() + "] " + msg);
    }

    function help(msg) {
        console.log(msg);
    }

    function getTempFile(f) {
        var tmpFiles = f.split('/');
        var tmpFile = '.' + tmpFiles.pop();
        tmpFiles.push(tmpFile);
        return tmpFiles.join("/");
    }

    function printVersion() {
        help('jmen version: ' + JMEN_VERSION + " on " + os.type() + " " + os.release() + ", nodejs: " + process.version);
    }

    function printHelp() {
        printVersion();
        help("Usage: node jmen.js --file <file> [options]");
        help("  --file | -f\t\tsource file path");
        help("options:");
        help("  --output | -o\t\ttarget file to save the final result");
        help("  --encoding | -n\tfile encoding, default is utf8");
        help("  --compress | -c\tcompress the generated code");
        process.exit(0);
    }

    var params = (function(args){
        var params = {};
        var parseParam = function(prop, regexp){
            if (args[i].match(regexp)) {
                if (args[i].indexOf('=') != -1) {
                    params[prop] = args[i].split('=')[1];
                } else {
                    argv = args[++i];
                    params[prop] = typeof(argv) == "undefined" ? true : argv;
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
            parseParam('compress', /(\-\-compress|\-c)/);
        }

        params.encoding = params.encoding || 'utf8';

        return params;
    })(process.argv.splice(2));

    var JMen = {
        isParsing: false,
        files: [],
        futureFiles: [],
        result: [],
        regexp: /^(\/\/|\#)=\s+require\s+["']([\w\/\.]+)["']\s*$/,

        // see https://github.com/mishoo/UglifyJS
        compress: function(code) {
            try {
                var UglifyJS = require('uglify-js');
                return UglifyJS.minify(code, {fromString: true}).code;
            } catch (e) {
                puts("* Error: compress error: " + e);
                return code;
            }
        },

        parseFile: function(file) {
            if (!fs.existsSync(file)) {
                this.futureFiles.push(file);
                file = path.join(process.cwd(), file);
            }

            if (!fs.existsSync(file)) {
                this.futureFiles.push(file);
                puts("* Warn: file \"" + file + "\" will be added later.");
                return;
            }

            filePath = fs.realpathSync(file);

            if (fs.statSync(filePath).isDirectory()) {
                return; 
            }

            this.isParsing = true;
            this.files.push(file);

            var directory = path.dirname(filePath),
            data = fs.readFileSync(filePath, params.encoding),
            coffeeData = null,
            self = this;

            // process coffee script
            if (path.extname(filePath) == '.coffee') {
                coffeeData = coffee.compile(data);
                self.result.push(coffeeData);
                data.split(/\n|\r/).forEach(function(line){
                    includeFile = line.match(self.regexp)
                    if (includeFile) {
                        self.parseFile(path.join(directory, includeFile[2]));
                    }
                });
                return;
            }

            // process javascript
            data.split(/\n|\r/).forEach(function(line){
                includeFile = line.match(self.regexp)
                if (includeFile) {
                    self.parseFile(path.join(directory, includeFile[2]));
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

            if (params.compress) {
                puts("compressing code.")
                result = JMen.compress(result); 
            }

            if (params.output) { 
                puts("Saving to: " + params.output + "\n")
                fs.writeFileSync(params.output, result, params.encoding);
            } else {
                puts(result);
            }

            this.result = [];
            this.isParsing = false;

            // monitor future files
            var self = this;
            setInterval(function() {
                if (self.isParsing) {
                    return;
                }
                for (var i = 0; i < self.futureFiles.length; i++) {
                    var futureFile = self.futureFiles[i];
                    if (fs.existsSync(futureFile)) {
                        self.futureFiles.splice(i, 1);
                        puts("new file \"" + futureFile + "\" is added, creating new file ...");
                        self.run();
                        break;
                    }
                }
            }, FUTUREFILES_INTERVAL)
        }
    }

    printVersion();
    puts("---------------------")
    JMen.run();

    JMen.files.forEach(function(f){
        fs.watchFile(f, function(curr, prev){
            if (curr.mtime != prev.mtime && !JMen.isParsing) {
                puts("file \"" + f + "\" is changed, creating new file ...");
                JMen.run();
            }
        });
    });
})();
