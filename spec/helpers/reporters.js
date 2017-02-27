const SpecReporter = require('jasmine-spec-reporter').SpecReporter;

jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
    prefixes: {
        failed: '',
        pending: '',
        successful: ''
    },
    spec: {
        displayPending: true,
        displayErrorMessages: false
    },
    summary: {
        displayPending: false
    }
}));
