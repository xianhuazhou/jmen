# Introduction

jmen is a tool can merge javascript files into one file whenever one of those files is updated. 
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

### compress generated code

    $ jmen --file js/index.js --output web/compiled/main.js --compress

### mixing JavaScript and CoffeeScript

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

### help

    $ jmen --help

## Latest Version

0.3.0

## TODO

Test

It's similar to the Ruby's sprockets (http://www.getsprockets.org) gem.
