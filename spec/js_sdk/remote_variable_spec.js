'use strict';

var changesets = require('changesets'),
    RemoteVariable = require('../../js_sdk/remote_variable'),
    UUID = require('../../js_sdk/uuid'),
    Attribute = require('../../models/attribute'),
    PgPool = require('pg-pool'),
    dbPool = new PgPool(),
    DatabaseCleaner = require('database-cleaner'),
    faye = require('faye'),
    app = require('../../index.js');

describe('RemoteVariable Object', () => {

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
            it('represents the value of the variable even if it has been changed by another client', (done) => {

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
                        variableClient2.setValue(value + 'a');

                        setTimeout(() => {
                            expect(variableClient1.getValue().length).toBe(17);
                            expect(variableClient1.getValue()).toBe(variableClient2.getValue());
                            done();
                        }, 200);

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
            it('respects the change of each client (It is NOT "last one wins", changes are merged)');
        });

        describe('when there are many changes from different clients at the same time', () => {
            it('ensures each client sees exaclty the same value', (done) => {
                var client1, client2, variableClient1, variableClient2;

                client1 = {id: '8c2574a7-921e-41f8-822b-000000000001', bayeuxClient: new faye.Client('http://localhost:3000/bayeux')};
                client2 = {id: '8c2574a7-921e-41f8-822b-000000000002', bayeuxClient: new faye.Client('http://localhost:3000/bayeux')};

                variableClient1 = new RemoteVariable(this.variableId, client1.bayeuxClient, client1.id, client1.id).load(() => {
                    variableClient2 = new RemoteVariable(this.variableId, client2.bayeuxClient, client2.id, client2.id).load(() => {

                        // Initial checks if the setup and variable initialization worked
                        const value = variableClient1.getValue();
                        expect(value).toBe('initial content');
                        expect(value).toBe(variableClient2.getValue());

                        variableClient1.setValue(value + 'x');
                        variableClient1.setValue(value + 'xyz');
                        variableClient2.setValue(value + 'a');

                        setTimeout(() => {
                            expect(variableClient1.getValue().length).toBe(19);
                            expect(variableClient1.getValue()).toBe(variableClient2.getValue());
                            done();
                        }, 400);

                    });
                });
            });
        });
    });

    describe('onChange', () => {
        describe('callback Function', () => {
            it('is executed when the value changes on the server side (because another client updated the variable value)')
        });
    });
});
