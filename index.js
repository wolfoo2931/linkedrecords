'use strict';

var Attribute = require('./models/attribute.js'),
    express = require('express'),
    app = express();

app.get('/attributes', function (req, res) {
    var attr = new Attribute({name: 'atname'});
    res.send(attr.getName());
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});
