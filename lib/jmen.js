var fs = require('fs'),
path = require('path'),
os = require('os'),
coffee = require('coffee-script'),
less = require('less'),
sass = require('node-sass'),
cleanCSS = require('clean-css'),
exec = require('child_process').exec,
JMEN_VERSION = '0.6.1';

(function(){
    var files = [];
    var FUTUREFILES_INTERVAL = 1000;
    var CALLBACK_CHECK_INTERVAL = 500;

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
        help("  --run-once | -r\trun once and quit");
        process.exit(0);
    }

    // Parse parameters
    var params = (function(args){
        var params = {};
        var parseParam = function(index, prop, regexp){
            if (args[index] && args[index].match(regexp)) {
                if (args[index].indexOf('=') != -1) {
                    params[prop] = args[index].split('=')[1];
                } else {
                    argv = args[++index];
                    params[prop] = typeof(argv) == "undefined" ? true : argv;
                }
            }
        }

        if (args.length == 0) {
            printHelp();
        }

        for (var index = 0; index < args.length; index++) { 
            if (args[index] == "--version" || args[index] == "-v") {
                printVersion();
                process.exit(0);
            }

            if (args[index] == "--help" || args[index] == "-h") {
                printHelp();
            }

            parseParam(index, 'file', /(\-\-file=[\w\.\/]+|\-f)/);
            parseParam(index, 'output', /(\-\-output=[\w\.\/]+|\-o)/);
            parseParam(index, 'encoding', /(\-\-encoding=[\w\.\/]+|\-e)/);
            parseParam(index, 'compress', /(\-\-compress|\-c)/);
            parseParam(index, 'runOnce', /(\-\-run\-once|\-r)/);
        }

        params.encoding = params.encoding || 'utf8';

        return params;
    })(process.argv.splice(2));

    var JMen = {
        isParsing: false,
        files: [],
        futureFiles: [],
        result: {},
        regexp: /^(\/\/|\#)=\s+require\s+["']([\w\d\/\-\_\.]+)["']\s*$/,

        // Compress data 
        compress: function(ext, data) {
            try {
                switch (ext) {
                    case '.js':
                    case '.coffee':
                        // see https://github.com/mishoo/UglifyJS2
                        var UglifyJS = require('uglify-js');
                        var uglify = UglifyJS.minify(data);
                        if (uglify.error) {
                            puts("javascript parser error: " + JSON.stringify(uglify.error));
                        }
                        return uglify.code;
                    case '.scss':
                    case '.css':
                    case '.less':
                        var cleancss = new cleanCSS({compatibility: 'ie8'}).minify(data);
                        if (cleancss.errors.length > 0) {
                            puts("css parser error: " + cleancss.errors);
                        }
                        return cleancss.styles;
                }
            } catch (e) {
                puts("* Compress Error: " + e.stack);
                self.compressedResult = data;
            }
        },

        // Parse a file
        parseData: function(filePath, fileExt, data) {
            var self = this;
            try {
                switch (fileExt) {
                    case '.coffee':
                        self.result[filePath] = coffee.compile(data);
                        break;
                    case '.scss':
                        self.result[filePath] = sass.renderSync({
                            data: data,
                            includePaths: [path.dirname(filePath)]
                        }).css;
                        break;
                    case '.css':
                        self.result[filePath] = data;
                        break;
                    case '.less':
                        less.render(data, function(e, css) {
                            self.result[filePath] = css;
                        });
                        break;
                    default:
                        throw "Unsupported file extension: " + fileExt;
                        break;
                }
            } catch (e) {
                puts("* Error (File: " + filePath  + "): " + e.stack);
                self.result[filePath] = data;
            }
        },

        // Parse file one by one
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
                puts(" * Warn: file \"" + file + "\" is a directory. SKIPPED!");
                return; 
            }

            this.isParsing = true;

            var directory = path.dirname(filePath),
            data = fs.readFileSync(filePath, params.encoding),
            coffeeData = null,
            self = this;

            fileExt = path.extname(filePath);
            if (fileExt != '.js') {
                // process scss, less, coffee-script code ...
                this.parseData(filePath, fileExt, data);
                data.split(/\n|\r/).forEach(function(line) {
                    if (line.trim() == '') {
                        return;
                    }
                    includeFile = line.match(self.regexp);
                    if (includeFile) {
                        self.parseFile(path.join(directory, includeFile[2]));
                    }
                });

            } else {
                // process javascript code
                self.result[filePath] = "";
                data.split(/\n|\r/).forEach(function(line) {
                    if (line.trim() == '') {
                        return;
                    }
                    includeFile = line.match(self.regexp);
                    if (includeFile) {
                        self.parseFile(path.join(directory, includeFile[2]));
                    } else {
                        self.result[filePath] += line + "\n";
                    }
                });
            }
        },

        // Check if parsing is done
        checkProgress: function() {
            var self = this;

            if (Object.keys(self.result).length >= self.files.length - self.futureFiles.length) {
                return self.parseFileCallback();
            }

            setTimeout(function(){
                self.checkProgress();
            },  CALLBACK_CHECK_INTERVAL);
        },

        // It's called after all of files are parsed. 
        parseFileCallback: function() {
            var self = this;

            // sorting and joining results
            result = self.files.map(function(file) {
                return self.result[file];
            }).join('');

            if (params.compress) {
                puts("compressing code ...");
                self.processFinalResult(
                    self,
                    this.compress(path.extname(self.files[0]), result)
                );
            } else {
                self.processFinalResult(self, result);
            }
        },

        // Last step
        processFinalResult: function(jmen, result) {
            if (params.output) { 
                puts("Saving to: " + params.output + "\n")
                fs.writeFileSync(params.output, result, params.encoding);
            } else {
                puts(result);
            }

            if (params.runOnce) {
                process.exit(0);
            }

            jmen.result = [];
            jmen.isParsing = false;
        },

        // Need optimize this.
        // Currently, it only supports including files in the top !!
        sortingFiles: function(file) {
            var currentFile = file, self = this;
            if (!fs.existsSync(currentFile)) {
                currentFile = path.join(process.cwd(), currentFile);
            }
            if (!fs.existsSync(currentFile)) {
                this.futureFiles.push(currentFile);
                this.files.push(currentFile);
                return;
            }
            var currentFilePath = fs.realpathSync(currentFile);
            var directory = path.dirname(currentFilePath);
            var lines = fs.readFileSync(currentFilePath, params.encoding).split(/\n|\r/);
            var linesLength = lines.length;
            lines.forEach(function(line, index) {
                var includeFile = line.match(self.regexp);
                if (includeFile) {
                    self.sortingFiles(path.join(directory, includeFile[2]));
                }
            });
            this.files.push(currentFilePath);
        },

        // Start from here
        run: function() {
            var self = this;
            self.files = [];
            self.sortingFiles(params.file);
            self.parseFile(params.file);

            setTimeout(function(){
                self.checkProgress();
            }, CALLBACK_CHECK_INTERVAL);

            // monitor future files
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
            }, FUTUREFILES_INTERVAL);

            this.watchFiles();
        },

        watchFiles: function() {
            this.files.forEach(function(f){
                fs.unwatchFile(f);
                fs.watchFile(f, function(curr, prev){
                    if (curr.mtime != prev.mtime && !JMen.isParsing) {
                        puts("file \"" + f + "\" is changed, creating new file ...");
                        JMen.run();
                    }
                });
            });
        }
    }

    printVersion();
    puts("---------------------")
    JMen.run(); 
})();
