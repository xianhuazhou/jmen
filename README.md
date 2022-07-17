# Introduction

jmen is a tool can merge javascript (including coffeescript) and css (including scss, less) files into one file whenever one of the included files is updated. 
To make it works, you need to install nodejs(http://www.nodejs.org/) first.

## Installation

    $ [sudo] npm install jmen -g

## Usage

    $ jmen --file /path/to/app/dev/index.js --output /path/to/website/assets/javascripts/app.js

file: /path/to/app/dev/index.js

```js
    //= require "dev/a.js"
    //= require "dev/b.js"
```

### Compress generated code

    $ jmen --file js/index.js --output web/compiled/main.js --compress

### Mixing JavaScript and CoffeeScript

file: js/main.js
```js
    //= require "a.js"
    //= require "my/first.coffee"
    // ....
```

file: my/first.coffee

```coffee
    #= require "second.coffee"
    # 
    # other coffee code here
```

The files structure looks like:

    js/
      main.js
      a.js
      my/
        first.coffee
        second.coffee

Then, you can do it with jmen:

    $ jmen --file js/main.js --output result.js

### Working with less files

    $ jmen -f less/index.scss -o css/app.css

file: less/index.scss

```scss
  //= require "header.less"
  //= require "bottom.less"
  // others ...
```

### Working with scss files

    $ jmen -f scss/index.scss -o css/app.css

file: scss/index.scss

```scss
  //= require "header.scss"
  //= require "bottom.scss"
  // others ...
```

### Notice

Included files can be added onto top only !!!

### Run once and quit

If you just need to generate or compress your css/js files once, just do it with the `--run-once`(`-r`) option, e.g.:

    $ jmen -f index.js -o compiled.js -c -r

### help

    $ jmen --help

## Latest Version

0.7.2

## TODO

Test

It's similar to the Ruby's sprockets (http://www.getsprockets.org) gem.
