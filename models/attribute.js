'use strict';

var nlp = require('nlp_compromise');

var Attribute = function (attr) {
    this.name = attr.name;

    this.validateName();
};

Attribute.prototype.getName = function () {
    return this.name;
};

Attribute.prototype.getPluralName = function () {
    return nlp.noun(this.getName()).pluralize();
};

Attribute.prototype.validateName = function () {
    var name_tags = nlp.sentence(this.getName()).tags();

    if (name_tags.length > 1) {
        throw new Error('name attribute must only be one word!');
    }

    if (name_tags[0] !== 'Noun' && name_tags[0] !== 'Actor') {
        throw new Error('name attribute must be a noun');
    }
};

module.exports = Attribute;
