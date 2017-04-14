'use strict';

var code = require('../helpers/code_example'),
    Attribute = require('../../models/attribute'),
    DatabaseCleaner = require('database-cleaner'),
    PgPool = require('pg-pool'),
    dbPool = new PgPool();

describe('Attribute Object', () => {

    beforeEach((done) => {
        var databaseCleaner = new DatabaseCleaner('postgresql');
        Attribute.deleteAllVariables(() => {
            databaseCleaner.clean(dbPool, done);
        });

    });

    describe('Usage Sceanrios // Code examples', () => {
        describe('Simple Entity Management', () => {
            code.exampleUsage(() => {

                  //There already must exists an attribute called "name" and another one called "age"
                  var nameValueId = Attribute.newVariable({belonging: {concept: "user", id: "4711"}, attribute: "name", value: "Peter"});
                  var ageValueId = Attribute.newVariable({belonging: {concept: "user", id: "4711"}, attribute: "age", value: "23"});

                  var petersAge = Attribute.getValueByID(ageValueId);

                  // petersAge is set to 23 now

                  Attribute.changeVariable({valueId: ageValueId, value: '24'});

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

                var webpageUrlVariableID = Attribute.newVariable({
                                                    attribute: "url",
                                                    belonging: {concept: "webpage", id: "4711"},
                                                    value: "https://en.wikipedia.org/wiki/Object-relational_impedance_mismatch"});

                // - because the html attribute is configured with a validity of 60000 milliseconds this and
                //   with eager calculation this value will be recalculated every minute.
                // - because the html we pass the webpageUrlValueID in as a parameter and because the html
                //   attribute is configured with an eager calculation this value will be recalculated whenever the
                //   url attribute value with the passed id change.
                var webpageHtmlVariableID = Attribute.newVariable({
                                                    attribute: "html",
                                                    belonging: {concept: "webpage", id: "4711"},
                                                    inputAttributes: [webpageUrlValueID]});

                var linksVariableID = Attribute.newVariables({
                                                attribute: "links",
                                                belonging: {concept: "webpage", id: "4711"},
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

                new Attribute(this.validArgumentForDescriptionAttribute).save((result) => {
                    expect(result.message).toEqual('name argument must be present');
                    done();
                });
            });

            it('must be a string', (done) => {
                this.validArgumentForDescriptionAttribute.name = 4711;
                new Attribute(this.validArgumentForDescriptionAttribute).save((result) => {
                    expect(result.message).toEqual('name argument must be a string');
                    done();
                });
            });

            it('must not contain a "#"', (done) => {
                this.validArgumentForDescriptionAttribute.name = 'invalid#name';
                new Attribute(this.validArgumentForDescriptionAttribute).save((result) => {
                    expect(result.message).toEqual('name argument must not include "#" character');
                    done();
                });
            });

            it('must be unique among all other attribute names within the same domain', (done) => {
                var self = this;
                new Attribute(self.validArgumentForDescriptionAttribute).save((result) => {
                    new Attribute(self.validArgumentForDescriptionAttribute).save((result) => {
                        expect(result.message).toEqual('description attribute already exists for the domain: global.specify.io/domains/blog');
                        done();
                    });
                });
            });

            it('can be already exists if the domain differs', (done) => {
                var self = this;
                self.validArgumentForDescriptionAttribute.domain = 'global.specify.io/domains/blog'

                new Attribute(self.validArgumentForDescriptionAttribute).save((result) => {
                    self.validArgumentForDescriptionAttribute.domain = 'global.specify.io/domains/shop'
                    new Attribute(self.validArgumentForDescriptionAttribute).save((result) => {
                        expect(result).toBe(null);
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

            it('must be present', (done) => {
                delete this.validArgumentForDescriptionAttribute.domain;

                new Attribute(this.validArgumentForDescriptionAttribute).save((result) => {
                    expect(result.message).toEqual('domain argument must be present');
                    done();
                });
            });

            it('must not contain a "#"', (done) => {
                this.validArgumentForDescriptionAttribute.domain = 'not#valid';

                new Attribute(this.validArgumentForDescriptionAttribute).save((result) => {
                    expect(result.message).toEqual('domain argument must not include "#" character');
                    done();
                });
            });

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

    // Alternative names:
    // Attribute.addValue
    // Attribute.newInstance
    // Attribute.newTimeSeries
    // Attribute.newRecord
    // Attribute.record
    // Attribute.newVariable
    //
    // Attribute.newVariable({belonging: {concept: 'user', id: '4711'}, attribute: 'name', value: 'Peter'});
    // Attribute.newVariable({belonging: {concept: 'user', id: '4711'}, attribute: 'age', value: '23'});
    // Attribute.newVariable({belonging: {concept: 'user', id: '4711'}, attribute: 'bio', value: 'a long text descrbing the biography of the user'});
    describe('newVariable Function', () => {

        beforeEach((done) => {

            this.validAttributeArguments = {
                name: 'name',
                representationRule: '{{string}}',
                domain: 'global.specify.io/domains/persons',
                revisioning: {active: true},
            };

            this.validVariablesArguments = {
                actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
                belonging: {concept: 'user', id: '4711'},
                attribute: 'name',
                value: 'Peter'
            };

            new Attribute(this.validAttributeArguments).save(() => {
                done();
            });
        });

        describe('attribute Argument', () => {

            it('must be present', (done) => {
                delete this.validVariablesArguments.attribute;

                Attribute.newVariable(this.validVariablesArguments, (result) => {
                    expect(result.message).toEqual('attribute argument must be present');
                    done();
                });
            });

            it('must be the name of an existing attribute', (done) => {
                this.validVariablesArguments.attribute = 'notexistingattributename'
                Attribute.newVariable(this.validVariablesArguments, (result) => {
                    expect(result.message).toEqual('attribute "notexistingattributename" does not exist');
                    done();
                });
            });
        });

        describe('actorId Argument', () => {
            it('must be present', (done) => {
                delete this.validVariablesArguments.actorId;
                Attribute.newVariable(this.validVariablesArguments, (result) => {
                    expect(result.message).toEqual('actorId argument must be present');
                    done();
                });
            });

            it('must be a uuid', (done) => {
                this.validVariablesArguments.actorId = 'not-a-valid-uuid';
                Attribute.newVariable(this.validVariablesArguments, (result) => {
                    expect(result.message).toEqual('actorId is "not-a-valid-uuid" but it must be a valid uuid');
                    done();
                });
            });

            it('identifies the actor of this actions for authorization and auditing reasons');
        });

        describe('belonging Argument', () => {
            it('is optional');
            it('must pe a flat object if present');
            it('identifies the thing to which the attribute belongs to');
        });

        describe('value Argument', () => {
            describe('when the attribute is not a collection of another attribute', () => {
                it('must be present', (done) => {
                    delete this.validVariablesArguments.value;
                    Attribute.newVariable(this.validVariablesArguments, (result) => {
                        expect(result.message).toEqual('value argument must be present');
                        done();
                    });
                });

                it('must match the attribute representaion rule');
                it('must not be present if the attribute has a calculation function');
            });

            describe('when the attribute is a collection of another attribute', () => {
                it('must be an array');
                it('elements must match the attribute representation rule');
            });
        });

        describe('inputAttributes Argument', () => {
            it('is optional');
            it('must be an array if present');
            it('must not be present (or empty) if the attribute hasn\'t a calculation function');
            it('elements must be IDs of other existing attribute values (the id which is returned by the newVariable function)');
        });

        describe('callback Function', () => {
            describe('id Argument', () => {
                it('is a String', (done) => {
                    Attribute.newVariable(this.validVariablesArguments, (id) => {
                        expect(id.length).not.toBe(0);
                        done();
                    });
                });

                it('can be used to retrieve the current variable value', (done) => {
                    Attribute.newVariable(this.validVariablesArguments, (id) => {
                        Attribute.getVariableByID({variableId: id}, (variable) => {
                            expect(variable.value).toEqual('Peter');
                            done();
                        });
                    });
                });

                it('can be used to change the variable value', (done) => {
                  Attribute.newVariable(this.validVariablesArguments, (id) => {
                      var changeArguments = {
                          variableId: id,
                          actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
                          value: 'Paul'
                      }

                      Attribute.changeVariable(changeArguments, (changeId) => {
                          Attribute.getVariableByID({variableId: id}, (variable) => {
                              expect(variable.value).toEqual('Paul');
                              done();
                          });
                      });
                  });
                });

            });

        });
    });

    // Attribute.changeVariable({variableId: '1147', value: '24'})
    // Attribute.changeVariable({variableId: ''1148', changeset: '=5-1+2=2+5=6+b|habeen -ish thing.|i'})
    describe('changeVariable Function', () => {

        beforeEach((done) => {
            this.validAttributeArguments = {
                name: 'name',
                representationRule: '{{string}}',
                domain: 'global.specify.io/domains/persons',
                revisioning: {active: true},
            };

            this.validVariablesArguments = {
                actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
                belonging: {concept: 'user', id: '4711'},
                attribute: 'name',
                value: 'Peter'
            };

            new Attribute(this.validAttributeArguments).save(() => {
                Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                    this.validChangeVariableArguments = {
                        variableId: variableId,
                        actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
                        value: 'Hans Peter'
                    };
                    done();
                });
            });
        });

        describe('variableId Argument', () => {
            it('must be present', (done) => {
                delete this.validChangeVariableArguments.variableId;

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('variableId argument must be present');
                    done();
                });
            });

            it('must be the ID of an existing attribute variable which has been created with Attribute.newVariable', (done) => {
                this.validChangeVariableArguments.variableId = 'not-existing-variable-id';
                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('variable with id "not-existing-variable-id" does not exist');
                    done();
                });
            });
        });

        describe('actorId Argument', () => {

            it('must be present', (done) => {
                delete this.validChangeVariableArguments.actorId;

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('actorId argument must be present');
                    done();
                });
            });

            it('must be a uuid', (done) => {
                this.validChangeVariableArguments.actorId = 'not-a-valid-uuid';

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('actorId is "not-a-valid-uuid" but it must be a valid uuid');
                    done();
                });
            });

            it('identifies the actor of this actions for auditing reasons');
        });

        describe('value Argument', () => {
            it('must be present when the changeset argument is missing', (done) => {
                delete this.validChangeVariableArguments.value;
                delete this.validChangeVariableArguments.change;

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('either value or changeset argument must be present');
                    done();
                });
            });

            it('must not be present when the changeset argument is given', (done) => {
                this.validChangeVariableArguments.value;
                this.validChangeVariableArguments.change = {changeset: '==+a'};

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('either value or changeset argument must be present (specifying both is not allowed)');
                    done();
                });
            });
        });

        describe('change Argument', () => {
            it('must be present when the value argument is missing', (done) => {
                delete this.validChangeVariableArguments.value;
                delete this.validChangeVariableArguments.change;

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('either value or changeset argument must be present');
                    done();
                });
            });

            it('must not be present when the value argument is given', (done) => {
                this.validChangeVariableArguments.value;
                this.validChangeVariableArguments.change = {changeset: '=4+7=6| Jürgen|'};

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('either value or changeset argument must be present (specifying both is not allowed)');
                    done();
                });
            });

            it('must contain a valid changeset string', (done) => {
                delete this.validChangeVariableArguments.value;
                this.validChangeVariableArguments.change = {changeset: '=4'}; //invalid changeset

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)');
                    done();
                });
            });

            // it('must contain an existing parent version', (done) => {
            //     delete this.validChangeVariableArguments.value;
            //     this.validChangeVariableArguments.change = {changeset: '=4+7=6| Jürgen|'}
            //
            //     Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
            //         expect(result.message).toEqual('change must contain a perant version');
            //         done();
            //     });
            // });
        });

        describe('callback Function', () => {
            describe('id Argument', () => {

                it('is a integer', (done) => {
                    Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                        expect(result).toEqual(jasmine.any(Number));
                        done();
                    });
                });

                it('represents the order of the changes');

                it('can be used to retrieve the change');
            });
        });

        it('does\'t change the value when the attributes representation format is violated');
        it('throws an exception when the attributes representation format is violated');
        it('throws an exception when the actor (user) dosn\'t has the permission to change the attribute variable value');
        it('throws an exception when the attribute has a calculation function');
    });

    describe('undo Function', () => {
        it('reverts the last commited change made by the same user who executes the undo function');
    });

    // Attribute.getLastByID('1147')
    describe('getVariableByID Function', () => {

        beforeEach((done) => {
            this.validAttributeArguments = {
                name: 'name',
                representationRule: '{{string}}',
                domain: 'global.specify.io/domains/persons',
                revisioning: {active: true},
            };

            this.validVariablesArguments = {
                actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
                belonging: {concept: 'user', id: '4711'},
                attribute: 'name',
                value: 'Peter'
            };

            new Attribute(this.validAttributeArguments).save(() => {
                Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                    this.variableId = variableId;
                    done();
                });
            });
        });

        describe('ID Argument', () => {

            it('must be present', (done) => {
                Attribute.getVariableByID({}, (result) => {
                    expect(result.message).toEqual('variableId argument must be present');
                    done();
                });
            });

            it('must be an ID of an attribute value which has been created with the newVariable function', (done) => {
                Attribute.getVariableByID({variableId: 'not-existing-variable-id'}, (result) => {
                    expect(result.message).toEqual('variable with id "not-existing-variable-id" does not exist');
                    done();
                });
            });
        });

        describe('return Value', () => {
            it('is an object containing a key called "value"', (done) => {
                Attribute.getVariableByID({variableId: this.variableId}, (result) => {
                    expect(typeof result).toEqual('object');
                    done();
                });
            });

            it('contains the last variable value', (done) => {
                Attribute.getVariableByID({variableId: this.variableId}, (result) => {
                    expect(result.value).toEqual('Peter');
                    done();
                });
            });
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

});
