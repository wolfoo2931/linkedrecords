'use strict';

var util = require('util'),
    nlp = require('nlp_compromise'),
    Concept = require('./concept');

var Attribute = function (attr) {
    Concept.call(this, attr);
};

util.inherits(Attribute, Concept);
module.exports = Attribute;
