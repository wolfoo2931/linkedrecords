'use strict';

var Concept = require('../../models/concept');

describe('Concept', () => {
    describe('Constructor ', () => {
        it('sets the name attribute', () => {
            var attr = new Concept({name: 'user'});
            expect(attr.getName()).toBe('user');
        });

        it('ensures the given attribute name is a noun', () => {
            expect(function() { new Concept({name: 'green'}) })
              .toThrow(new Error('name attribute must be a noun'));

            expect(function() { new Concept({name: 'two words'}) })
              .toThrow(new Error('name attribute must only be one word!'));
        });

        it('allows compound nouns separated by white spaces', () => {
            var attr = new Concept({name: 'water tank'});
            expect(attr.getPluralName()).toBe('water tanks');
        });

        it('sets the plural name attribute automatically if it is not provided', () => {
            var attr = new Concept({name: 'user'});
            expect(attr.getPluralName()).toBe('users');
        });
    });
});
