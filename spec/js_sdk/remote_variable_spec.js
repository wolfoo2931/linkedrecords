'use strict';

// Termenology used in this test suite:
// variable:
// change:
// client:

exports = {} // because of the export system used in diff_match_patch

var changesets = require('changesets'),
    RemoteVariable = require('../../js_sdk/remote_variable'),
    UUID = require('../../js_sdk/uuid'),
    Attribute = require('../../models/attribute'),
    PgPool = require('pg-pool'),
    dbPool = new PgPool(),
    DatabaseCleaner = require('database-cleaner'),
    faye = require('faye');

fdescribe('RemoteVariable Object', () => {

    beforeEach((done) => {
        var self = this,
            databaseCleaner = new DatabaseCleaner('postgresql'),
            attributeArguments = { name: 'content', representationRule: '{{string}}', domain: 'global.specify.io/domains/blog', revisioning: {active: true}},
            variableArguments = { actorId: new UUID().getValue(), belonging: {concept: 'blog', id: '4711'}, attribute: 'content', value: 'initial content'};

        Attribute.deleteAllVariables(() => {
            databaseCleaner.clean(dbPool, function() {
                new Attribute(attributeArguments).save(() => {
                    Attribute.newVariable(variableArguments, (variableId) => {
                        self.variableId = variableId;
                        done();
                    });
                });
            });
        });

    });

    describe('load Function', () => {
        describe('callback Function', () => {
            it('is executed when the connection to the server is initiated');
        });
    });

    describe('getValue Function', () => {
        describe('return Value', () => {
            it('represents the value of the variable');
            fit('represents the value of the variable even if it has been changed by another client', (done) => {

                var client1, client2, variableClient1, variableClient2;

                client1 = {id: new UUID().getValue(), bayeuxClient: new faye.Client('http://localhost:3000/bayeux')};
                client2 = {id: new UUID().getValue(), bayeuxClient: new faye.Client('http://localhost:3000/bayeux')};

                variableClient1 = new RemoteVariable(this.variableId, client1.bayeuxClient, client1.id, client1.id).load(() => {
                    variableClient2 = new RemoteVariable(this.variableId, client2.bayeuxClient, client2.id, client2.id).load(() => {

                        // Initial checks if the setup and variable initialization worked
                        var value = variableClient1.getValue();
                        expect(value).toBe('initial content');
                        expect(value).toBe(variableClient2.getValue());

                        variableClient1.setValue(value + 'x');
                        variableClient1.setValue(value + 'xy');
                        variableClient2.setValue(value + 'a');

                        setTimeout(() => {
                            console.log(variableClient2.getValue());
                            done();
                        }, 1000);

                    });
                });

            });
        });
    });

    describe('setValue Function', () => {
        describe('newValue Argument', () => {
            it('represents the new value of the variable');
            it('is replicated to the server so that other clients recieve the new value');
        });

        describe('when multiple clients change the value at the same time', () => {
            it('respects the change of each client (It is NOT "last one wins", it is operational transformation)');
        });

        describe('when there are many changes from different clients at the same time', () => {
            it('ensures each client sees exaclty the same value');
        });
    });

    describe('onChange', () => {
        describe('callback Function', () => {
            it('is executed when the value changes on the server side (because another client updated the variable value)')
        });
    });
});
