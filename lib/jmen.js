var fs = require('fs'),
path = require('path'),
os = require('os'),
coffee = require('coffee-script'),
spawn = require('child_process').spawn,
JMEN_VERSION = '0.2.0';

(function(){
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
        puts('jmen version: ' + JMEN_VERSION + " on " + os.type() + " " + os.release() + ", nodejs: " + process.version);
    }

    function printHelp() {
        printVersion();
        puts("Usage: node jmen.js --file <file> [options]");
        puts("  --file | -f\t\tsource file path");
        puts("options:");
        puts("  --output | -o\t\ttarget file to save the final result");
        puts("  --encoding | -n\tfile encoding, default is utf8");
        puts("  --compress | -c\tcompress the generated code");
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
        result: [],
        regexp: /^(\/\/|\#)=\s+require\s+["']([\w\/\.]+)["']\s*$/,

        // see https://github.com/mishoo/UglifyJS
        compress: function(code) {
            var jsp = require("uglify-js").parser;
            var pro = require("uglify-js").uglify;

            var ast = jsp.parse(code); // parse code and get the initial AST
            ast = pro.ast_mangle(ast); // get a new AST with mangled names
            ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
            return pro.gen_code(ast); // compressed code here 
        },

        parseFile: function(file) {
            if (!fs.existsSync(file)) {
                file = path.join(process.cwd(), file);
            }

            if (!fs.existsSync(file)) {
                puts("Error: file \"" + file + "\" doesn't exists.");
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

            if (params.output) {
                if (params.compress) {
                    puts("compressing code.")
                    result = JMen.compress(result); 
                }
                puts("Saving to: " + params.output)
                fs.writeFileSync(params.output, result, params.encoding);
            } else {
                puts(result);
            }

            this.result = [];
            this.isParsing = false;
        }
    } 

    printVersion();
    puts("---------------------")
    JMen.run();

    JMen.files.forEach(function(f){
        fs.watchFile(f, function(curr, prev){
            if (curr.mtime != prev.mtime && !JMen.isParsing) {
                puts("file \"" + f + "\" is changed, creating new file...");
                JMen.run();
            }
        });
    });
})();
