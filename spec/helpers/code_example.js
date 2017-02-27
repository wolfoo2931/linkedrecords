var beautify = require('js-beautify').js_beautify;

function exampleUsage(exampleCode, fn) {
  var code = beautify(exampleCode.toString(), { wrap_line_length: 500, max_preserve_newlines: 500 })

  if(code.match(/^\(\) => {/)) {
    code = code.replace(/^\(\) => {/, '');
    code = code.replace(/}$/, '');
  }

  it(code, fn);
}

exports.exampleUsage = exampleUsage;
