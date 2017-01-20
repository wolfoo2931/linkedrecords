'use strict';

const nlp = require('nlp_compromise');

var Concept = function (attr) {
    this.name = attr.name;
    this.validateName();
};

Concept.prototype.getName = function () {
    return this.name;
};

Concept.prototype.getPluralName = function () {
    return nlp.noun(this.getName()).pluralize();
};

Concept.prototype.validateName = function () {
    var name_tags = nlp.sentence(this.getName()).tags();

    if (name_tags.length > 1) {
        throw new Error('name attribute must only be one word!');
    }

    if (name_tags[0] !== 'Noun' && name_tags[0] !== 'Actor') {
        throw new Error('name attribute must be a noun');
    }
};

module.exports = Concept;
