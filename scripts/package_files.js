var compressor = require('node-minify');

compressor.minify({
    compressor: 'no-compress',
    input: [
      'node_modules/changesets/client-side.js',
      'node_modules/diff_match_patch/lib/diff_match_patch.js',
      'js_sdk/uuid.js',
      'js_sdk/caret.js',
      'js_sdk/remote_variable.js'
    ],
    output: 'staticfiles/sdk.min.js',
    callback: function (err, min) {}
});
