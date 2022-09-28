var Changeset = require('changesets')

var serverState, clienteAState, serverChange, clientebState, a, b, bStrich, aStrich;

serverState = '<p>initial</p>';
clienteAState = '<p>initialo</p>';
clienteBState = '<p>initiald</p>';

a = Changeset.unpack('-e+f|<p>initialo</p>|<p>initial</p>');
b = Changeset.unpack('-e+f|<p>initiald</p>|<p>initial</p>');

console.log('a', 'transmitChange', a.inspect())
console.log('b', 'transmitChange', b.inspect())

// Server: Handle client "a" change
serverChange = Changeset.unpack('=e||');
console.log('serverChange', serverChange.inspect())
serverState = a.apply(serverState);
bStrich = b.transformAgainst(serverChange, false);
aStrich = serverChange.transformAgainst(b, true);

console.log('a', 'processApproval', aStrich.inspect());
console.log('b', 'processForeignChange', bStrich.inspect());

// Handle client "b" change
serverChange = Changeset.unpack('=a+1=4|o|'); // ==========o====

console.log('serverChange', serverChange.inspect())
bStrich = b.transformAgainst(serverChange, false);
aStrich = serverChange.transformAgainst(b, true);

console.log('send approval', aStrich.inspect());
console.log('send change', bStrich.inspect());


console.log('a', 'apply value, changeset', clienteAState, bStrich.inspect())
console.log('b', 'apply value, changeset', clienteBState, aStrich.inspect())
clienteAState = bStrich.apply(clienteAState);
clienteBState = aStrich.apply(clienteBState);

console.log(clienteAState === clienteBState);
console.log(clienteAState);
console.log(clienteBState);
