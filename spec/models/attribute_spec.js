'use strict';

var code = require('../helpers/code_example'),
    Attribute = require('../../models/attribute'),
    DatabaseCleaner = require('database-cleaner'),
    Changeset = require('changesets').Changeset,
    PgPool = require('pg-pool'),
    dbPool = new PgPool();

describe('Attribute Object', () => {

    beforeEach((done) => {
        var databaseCleaner = new DatabaseCleaner('postgresql');
        Attribute.deleteAllVariables(() => {
            databaseCleaner.clean(dbPool, done);
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
                        Attribute.getVariable({variableId: id}, (variable) => {
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
                            Attribute.getVariable({variableId: id}, (variable) => {
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
            var promises = [],
                actorId = '698aafe8-dcd5-4ced-b969-ffc34a43f645';
            this.validAttributeArguments = {
                name: 'name',
                representationRule: '{{string}}',
                domain: 'global.specify.io/domains/persons',
                revisioning: {active: true},
            };

            this.validVariablesArguments = {
                actorId: actorId,
                belonging: {concept: 'user', id: '4711'},
                attribute: 'name',
                value: 'Peter'
            };

            promises.push(new Promise((resolve, reject) => {

                new Attribute(this.validAttributeArguments).save(() => {
                    Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                        this.variableId = variableId;
                        this.validChangeVariableArguments = {
                            variableId: variableId,
                            actorId: actorId,
                            value: 'Hans Peter'
                        };
                        resolve();
                    });
                });

            }));

            promises.push(new Promise((resolve, reject) => {
                Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                    this.complicatedVariableId = variableId;
                    Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'klaus peter'}, (result) => {
                        Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '-1+1=5-1+1=4|KP|kp', parentVersion: result.id}}, (result) => {
                            Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'klaus peter pan'}, (result) => {
                                Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '-1+1=e|K|k', parentVersion: result.id}}, (result) => {
                                    Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '=6-1+1=8|P|p', parentVersion: result.id}}, (result) => {
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            }));

            Promise.all(promises).then(done);

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

            it('identifies the actor of this actions for auditing reasons', (done) => {
                Attribute.changeVariable(this.validChangeVariableArguments, (change) => {
                    Attribute.getVariable({variableId: this.validChangeVariableArguments.variableId, changeId: change.id}, (result) => {
                        expect(result.actorId).toEqual('698aafe8-dcd5-4ced-b969-ffc34a43f645');
                        done();
                    });
                });
            });
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

            it('must contain an existing parent change id', (done) => {
                delete this.validChangeVariableArguments.value;
                this.validChangeVariableArguments.change = {changeset: '=4+7=6| Jürgen|'};

                Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                    expect(result.message).toEqual('the changeset must also contain a parent version');
                    done();
                });
            });
        });

        describe('callback Function', () => {
            describe('id Argument', () => {

                it('is a integer', (done) => {
                    Attribute.changeVariable(this.validChangeVariableArguments, (result) => {
                        expect(result.id).toEqual(jasmine.any(Number));
                        done();
                    });
                });

                it('can be used to retrieve the change (even if there are newer changes)', (done) => {
                    Attribute.changeVariable(this.validChangeVariableArguments, (firstChange) => {
                        this.validChangeVariableArguments.value = 'Hans Juergen Peter';
                        Attribute.changeVariable(this.validChangeVariableArguments, (secondChange) => {
                            Attribute.getVariable({changeId: firstChange.id, variableId: this.validChangeVariableArguments.variableId}, (result) => {
                                expect(result.changeId).toEqual(2);
                                expect(result.value).toEqual('Hans Peter');
                                done();
                            });
                        });
                    });
                });

                it('represents the order of the changes', (done) => {
                    Attribute.changeVariable(this.validChangeVariableArguments, (firstChange) => {
                        this.validChangeVariableArguments.value = 'hans juergen peter';
                        Attribute.changeVariable(this.validChangeVariableArguments, (secondChange) => {
                            this.validChangeVariableArguments.value = 'Hans Juergen Peter';
                            Attribute.changeVariable(this.validChangeVariableArguments, (thirdChange) => {
                                expect(firstChange.id < secondChange.id < thirdChange.id).toBe(true)
                                done();
                            });
                        });
                    });
                });

            });

            describe('transformedServerChange Argument', () => {
                it('is set when changeVariable has been called with the change argument');
                it('is NOT set when changeVariable has been called with the value argument');
                fit('can be applied on the client (which emmited the change) to catch up the server state', (done) => {
                    var clientChange = '=c-1+1=2+3|Pium|p',
                        clientSateAfterChange = 'klaus peter Panium',
                        updatedClientSate;

                    Attribute.changeVariable({variableId: this.complicatedVariableId, actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645', change: {parentVersion: 4, changeset: clientChange}}, (change) => {
                        updatedClientSate = Changeset.unpack(change.transformedServerChange).apply(clientSateAfterChange);
                        Attribute.getVariable({variableId: this.complicatedVariableId}, (result) => {
                            expect(result.value).toEqual(updatedClientSate);
                            done();
                        });
                    });
                });
            });

            describe('transformedClientChange Argument', () => {
                it('is set when changeVariable has been called with the change argument');
                it('is NOT set when changeVariable has been called with the value argument');
                it('can be applied on all other clients (which did not emmited the change)');
            });

        });

        it('does\'t change the value when the attributes representation format is violated');
        it('throws an exception when the attributes representation format is violated');
        it('throws an exception when the actor (user) dosn\'t has the permission to change the attribute variable value');
        it('throws an exception when the attribute has a calculation function');
    });

    // Attribute.getLastByID('1147')
    describe('getVariable Function', () => {

        beforeEach((done) => {

            var promises = [],
                actorId = '698aafe8-dcd5-4ced-b969-ffc34a43f645';

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

            // create a variable its value has been changed by specifying the new value (absolute changes, no changeset)
            promises.push(new Promise((resolve, reject) => {
                new Attribute(this.validAttributeArguments).save(() => {
                    Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                        this.AbsoluteChangedVariableId = variableId;
                        Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'Klaus Peter'}, () => {
                            Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'Klaus Peter Pan'}, () => {
                                resolve();
                            });
                        });
                    });
                });
            }));

            // create a variable its value has been changed by applying changesets
            promises.push(new Promise((resolve, reject) => {
                new Attribute(this.validAttributeArguments).save(() => {
                    Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                        this.RelativeChangedVariableId = variableId;
                        Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '+6=5|Klaus |', parentVersion: 1}}, (result) => {
                            Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '=b+4| Pan|', parentVersion: result.id}}, () => {
                                resolve();
                            });
                        });
                    });
                });
            }));

            // create a variable its value has been changed by applying changesets and specifying absolute values
            promises.push(new Promise((resolve, reject) => {
                new Attribute(this.validAttributeArguments).save(() => {
                    Attribute.newVariable(this.validVariablesArguments, (variableId) => {
                        this.MixedChangedVariableId = variableId;
                        Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'klaus peter'}, (result) => {
                            Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '-1+1=5-1+1=4|KP|kp', parentVersion: result.id}}, (result) => {
                                Attribute.changeVariable({variableId: variableId, actorId: actorId, value: 'klaus peter pan'}, (result) => {
                                    Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '-1+1=e|K|k', parentVersion: result.id}}, (result) => {
                                        Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '=6-1+1=8|P|p', parentVersion: result.id}}, (result) => {
                                            Attribute.changeVariable({variableId: variableId, actorId: actorId, change: {changeset: '=c-1+1=2|P|p', parentVersion: result.id}}, (result) => {
                                                resolve();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            }));

            Promise.all(promises).then(done);
        });

        describe('variableId Argument', () => {
            it('must be present', (done) => {
                Attribute.getVariable({}, (result) => {
                    expect(result.message).toEqual('variableId argument must be present');
                    done();
                });
            });

            it('must be an ID of an attribute value which has been created with the newVariable function', (done) => {
                Attribute.getVariable({variableId: 'not-existing-variable-id'}, (result) => {
                    expect(result.message).toEqual('variable with id "not-existing-variable-id" does not exist');
                    done();
                });
            });
        });

        describe('changeId Argument', () => {
            it('is optional');
        });

        describe('callback Function', () => {
            describe('value Argument', () => {
                it('represents the current variable value when no change id is specifed', (done) => {
                    var promises = [];

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.AbsoluteChangedVariableId}, (result) => {
                            expect(result.value).toEqual('Klaus Peter Pan');
                            expect(result.changeId).toBe(3);
                            resolve();
                        });
                    }));

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.RelativeChangedVariableId}, (result) => {
                            expect(result.value).toEqual('Klaus Peter Pan');
                            expect(result.changeId).toBe(3);
                            resolve();
                        });
                    }));

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.MixedChangedVariableId}, (result) => {
                            expect(result.value).toEqual('Klaus Peter Pan');
                            expect(result.changeId).toBe(7);
                            resolve();
                        });
                    }));

                    Promise.all(promises).then(done);
                });

                it('represents the variable value at a given change id if a change id has been specified in the arguments of getVariable', (done) => {
                    var promises = [];

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.MixedChangedVariableId, changeId: 2}, (result) => {
                            expect(result.value).toEqual('klaus peter');
                            expect(result.changeId).toBe(2);
                            resolve();
                        });
                    }));

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.MixedChangedVariableId, changeId: 3}, (result) => {
                            expect(result.value).toEqual('Klaus Peter');
                            expect(result.changeId).toBe(3);
                            resolve();
                        });
                    }));

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.MixedChangedVariableId, changeId: 4}, (result) => {
                            expect(result.value).toEqual('klaus peter pan');
                            expect(result.changeId).toBe(4);
                            resolve();
                        });
                    }));

                    promises.push(new Promise((resolve, reject) => {
                        Attribute.getVariable({variableId: this.MixedChangedVariableId, changeId: 6}, (result) => {
                            expect(result.value).toEqual('Klaus Peter pan');
                            expect(result.changeId).toBe(6);
                            resolve();
                        });
                    }));

                    Promise.all(promises).then(done);
                });
            })
        });

        describe('when the attribute has a calculation function', () => {
            it('dosn\'t calculate the value if the last known value is still valid');
            it('calculates the value on demand if eager calcuation is not enabled and the last known value is not valid anymore');
            it('returns the calculated or cached attribute value');
        });

    });

});
