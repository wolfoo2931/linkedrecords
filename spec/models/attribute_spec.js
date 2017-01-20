'use strict';

var Attribute = require('../../models/attribute.js');

describe('Attribute', function () {
    describe('Constructor ', function () {
        it('sets the name attribute', function () {
            var attr = new Attribute({name: 'user'});
            expect(attr.getName()).toBe('user');
        });

        it('ensures the given attribute name is a noun', function () {
            expect(function() { new Attribute({name: 'green'}) })
              .toThrow(new Error('name attribute must be a noun'));

            expect(function() { new Attribute({name: 'two words'}) })
              .toThrow(new Error('name attribute must only be one word!'));
        });

        it('allows compound nouns separated by white spaces', function () {
            var attr = new Attribute({name: 'water tank'});
            expect(attr.getPluralName()).toBe('water tanks');
        });

        it('sets the plural name attribute automatically when it is not provided', function () {
            var attr = new Attribute({name: 'user'});
            expect(attr.getPluralName()).toBe('users');
        });
    });
});
