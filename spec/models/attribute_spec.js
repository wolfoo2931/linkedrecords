'use strict';

var code = require('../helpers/code_example'),
    Argument = require('../../models/attribute'),
    DatabaseCleaner = require('database-cleaner'),
    PgPool = require('pg-pool'),
    dbPool = new PgPool();

describe('Attribute Object', () => {

    beforeEach((done) => {
        var databaseCleaner = new DatabaseCleaner('postgresql');
        databaseCleaner.clean(dbPool, done);
    });

    describe('Usage Sceanrios // Code examples', () => {
        describe('Simple Entity Management', () => {
            code.exampleUsage(() => {

                  //There already must exists an attribute called "name" and another one called "age"
                  var nameValueId = Attribute.newValue({conceptName: "user", userID: "4711", attribute: "name", value: "Peter"});
                  var ageValueId = Attribute.newValue({conceptName: "user", userID: "4711", attribute: "age", value: "23"});

                  var petersAge = Attribute.getValueByID(ageValueId);

                  // petersAge is set to 23 now

                  Attribute.submitValueChange({valueId: ageValueId, value: '24'});

                  petersAge = Attribute.findLastValueByID(ageValueId);

                  // petersAge is set to 24 now

                  var pater = Attribute.findAttributeValuesByConcept({conceptName: 'user', userID: '4711'});

                  // peter is set to:
                  //   { name: 'Peter', age: '24' }

              }, () => {});
        });

        describe('Calculation Functions', () => {
            code.exampleUsage(() => {

                new Attribute({
                    name: 'url',
                    representionRule: '{{url}}',
                    domain: 'global.specify.io/domains/webpage'
                });

                new Attribute({
                    name: 'html',
                    representionRule: '{{string}}',
                    domain: 'global.specify.io/domains/webpage',
                    revisioning: { active: true },
                    calculation: {
                      function: (webpageUrl, harvestFn) => { http.get(webpageUrl, (result) => {harvestFn(result.getBody());}) },
                      validity: 60 * 1000,
                      eagerCalculation: true
                    }
                });

                new Attribute({
                    name: 'link',
                    representionRule: '{{url}}|{{path}}',
                    domain: 'global.specify.io/domains/webpage',
                });

                new Attribute({
                    name: 'links',
                    collectionOf: 'link',
                    revisioning: { active: true },
                    calculation: {
                        function: (webpageHtml, harvestFn) => { harvestFn(/*calculate links from webpageHtml*/) },
                        eagerCalculation: true
                    }
                });

                var webpageUrlValueID = Attribute.newValue({
                                                    conceptName: "webpage",
                                                    webpageID: "4711",
                                                    attribute: "url",
                                                    value: "https://en.wikipedia.org/wiki/Object-relational_impedance_mismatch"});

                // - because the html attribute is configured with a validity of 60000 milliseconds this and
                //   with eager calculation this value will be recalculated every minute.
                // - because the html we pass the webpageUrlValueID in as a parameter and because the html
                //   attribute is configured with an eager calculation this value will be recalculated whenever the
                //   url attribute value with the passed id change.
                var webpageHtmlValueID = Attribute.newValue({
                                                    conceptName: "webpage",
                                                    webpageID: "4711",
                                                    attribute: "html",
                                                    inputAttributes: [webpageUrlValueID]});

                var linksValueID = Attribute.newValues({
                                                conceptName: "webpage",
                                                webpageID: "4711",
                                                attribute: "links",
                                                inputAttributes: [webpageHtmlValueID]});

            }, () => {});
        });
    });

    describe('new Attribute(arguments).save()', () => {

        beforeEach(() => {
            this.validArgumentForDescriptionAttribute = {
                name: 'description',
                representationRule: '{{string}}',
                domain: 'global.specify.io/domains/blog',
                revisioning: {active: true},
            };
        });

        describe('name Argument', () => {

            it('must be present', (done) => {
                delete this.validArgumentForDescriptionAttribute.name;

                new Argument(this.validArgumentForDescriptionAttribute).save((err) => {
                    expect(err.message).toEqual('name argument must be present');
                    done();
                });
            });

            it('must be a string', (done) => {
                this.validArgumentForDescriptionAttribute.name = 4711;
                new Argument(this.validArgumentForDescriptionAttribute).save((err) => {
                    expect(err.message).toEqual('name argument must be a string');
                    done();
                });
            });

            it('must not contain a "#"', (done) => {
                this.validArgumentForDescriptionAttribute.name = 'invalid#name';
                new Argument(this.validArgumentForDescriptionAttribute).save((err) => {
                    expect(err.message).toEqual('name argument must not include "#" character');
                    done();
                });
            });

            it('must be unique among all other attribute names within the same domain', (done) => {
                var self = this;
                new Argument(self.validArgumentForDescriptionAttribute).save((err) => {
                    new Argument(self.validArgumentForDescriptionAttribute).save((err) => {
                        expect(err.message).toEqual('description attribute already exists for the domain: global.specify.io/domains/blog');
                        done();
                    });
                });
            });

            it('can be already exists if the domain differs', (done) => {
                var self = this;
                self.validArgumentForDescriptionAttribute.domain = 'global.specify.io/domains/blog'

                new Argument(self.validArgumentForDescriptionAttribute).save((err) => {
                    self.validArgumentForDescriptionAttribute.domain = 'global.specify.io/domains/shop'
                    new Argument(self.validArgumentForDescriptionAttribute).save((err) => {
                        expect(err).toBe(null);
                        done();
                    });
                });
            });
        });

        describe('representionRule Argument', () => {
            it('must be present if collectionOf argument is not present');
            it('must not be present if collectionOf argument is present');
            it('must a string that represents a valid RepresentationRule');
        });

        describe('collectionOf Argument', () => {
            it('must be present if representionRule argument is not present');
            it('must not be present if representionRule argument is present');
            it('must be the name of another attribute');
        });

        describe('domain Argument', () => {
            it('must be present');
            it('must not contain a "#"');
            it('must be a domain identifier');
        });

        describe('revisioning Argument', () => {
            it('is optional');
            it('is an Object/Hash');
            it('must have required key "active"');
            it('can have key "revisionCount" when argument "lastRevisionDate" is not set');
            it('can have key "lastRevisionDate" when argument "revisionCount" is not set');
        });

        describe('calculation Argument', () => {
            it('is optional');
            it('is an Object/Hash');
            it('must have key "function"');
            it('can have key "inputAttributes" maps to an array');
            it('can have key "validity" representing milliseconds (default is 0)');
            it('can have key "eagerCalculation" which must map to a boolean value (default is false)');
        });
    });

    // Attribute.newValue({conceptName: 'user', userID: '4711', attribute: 'name', value: 'Peter'});
    // Attribute.newValue({conceptName: 'user', userID: '4711', attribute: 'age', value: '23'});
    // Attribute.newValue({conceptName: 'user', userID: '4711', attribute: 'bio', value: 'a long text descrbing the biography of the user'});
    describe('newValue Function', () => {
        describe('conceptName Argument', () => {
            it('must be present');
            it('must be a string');
            it('represents the name of a concept');
        });

        describe('*ID Argument', () => {
            it('is optional');
            it('is named like the conceptName and "ID" as suffix (e.g. \'userID\', when \'user\' is the conceptName)');
        });

        describe('attribute Argument', () => {
            it('must be present');
            it('must be the name of an existing attribute');
        });

        describe('value Argument', () => {
            describe('when the attribute is not a collection of another attribute', () => {
                it('must match the attribute representaion rule');
                it('must not be present if the attribute has a calculation function');
            });

            describe('when the attribute is a collection of another attribute', () => {
                it('must be an array');
                it('elements must match the attribute representation rule');
            });
        });

        describe('inputAttributes', () => {
            it('is optional');
            it('must be an array');
            it('must not be present (or empty) if the attribute hasn\'t a calculation function');
            it('elements must be IDs of other existing attribute values (the id which is returned by the newValue function)');
        });

        describe('Return Value', () => {
            it('is an id');
        });
    });

    // Attribute.submitValueChange({attributeValueId: '1147', value: '24'})
    // Attribute.submitValueChange({attributeValueId: ''1148', changeset: '=5-1+2=2+5=6+b|habeen -ish thing.|i'})
    describe('submitValueChange Function', () => {
        describe('attributeValueId Argument', () => {
            it('must be present');
            it('must be the ID of an existing attribute value which has been created with Attribute.newValue');
        });

        describe('value Argument', () => {
            it('must be present when the changeset argument is missing');
            it('must not be present when the changeset argument is given');
        });

        describe('changeset Argument', () => {
            it('must be present when the value argument is missing');
            it('must not be present when the value argument is given');
        });

        it('does\'t change the value when the attributes representation format is violated');
        it('throws an exception when the attributes representation format is violated');
        it('throws an exception when the use dosn\'t has the permission to submit a change');
        it('throws an exception when the attribute has a calculation function');

        it('returns a change id');
    });

    describe('undo Function', () => {
        it('reverts the last commited change made by the same user who executes the undo function');
    });

    describe('getWordingIssues', () => {
        it('behaves like http://www.hemingwayapp.com/');
    });

    // Attribute.getLastByID('1147')
    describe('getValueByID Function', () => {

        describe('ID Argument', () => {
            it('must be present');
            it('must be an ID of an attribute value which has been created with the newValue function');
        });

        describe('when the attribute has a calculation function', () => {
            it('dosn\'t calculate the value if the last known value is still valid');
            it('calculates the value on demand if eager calcuation is not enabled and the last known value is not valid anymore');
            it('returns the calculated or cached attribute value');
        });

        describe('when the attribute value has been changed via change sets', () => {
            it('returns the resulting text of all existing change sets');
        });

        describe('when the attribute value has NOT been changed via change sets', () => {
            it('returns the last attribute value');
        });
    });

    describe('getValueHistoryById Function', () => {

        describe('ID Argument', () => {
            it('must be present');
            it('must be an ID of an attribute value which has been created with the newValue function');
        });

        describe('resolution Argument', () => {
            it('is optional');
            it('must be an integer representing milliseconds');
        });

        describe('Return Value', () => {
            it('is an array');
            it('contains only objects');
            it('objects has the key time');
            it('objects has the key changeset if the key value is not present');
            it('objects has the key value if the key changeset is not present');
        });

    });


    // Attribute.findByConcept({conceptName: 'user', userID: '4711'});
    //  -> { name: 'Peter', age: '24', bio: 'a long text descrbing the bio...' }
    describe('findAttributeValuesByConcept Function', () => {
        describe('conceptName Argument', () => {
            it('must be present');
            it('must be a string');
            it('represents the name of a concept');
        });

        describe('*ID Argument', () => {
            it('must be present');
            it('is named like the conceptName and "ID" as suffix (e.g. \'userID\', when \'user\' is the conceptName)');
        });

        it('returns an Object with keys values pairs representing the attributes/values created for the given concept \n e.g. { name: \'Peter\', age: \'24\', bio: \'a long text descrbing the bio...\' }');
    })

});
