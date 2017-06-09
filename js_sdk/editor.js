'use strict';

var $ = require('jquery'),
    Caret = require('../js_sdk/caret');

var Editor = function(domId) {
    var self = this;
    this.domId = domId;
    this.contentElement = document.getElementById(domId);
    this.caret = new Caret();

    this.subscribe(function() {
        self.cleanUpContent();
    });
}

Editor.prototype = {
    subscribe: function(callback) {
        var self = this;
        $('#value').on('input', function() {
            callback(self._cleanHTML(self.contentElement.innerHTML));
        });
    },

    cleanUpContent: function() {
        this.caret.saveSelection(this.contentElement);
        this.contentElement.innerHTML = this._cleanHTML(this.contentElement.innerHTML);
        this.caret.restoreSelection(this.contentElement);
    },

    setContent: function(content) {
        this.caret.saveSelection(this.contentElement);
        this.contentElement.innerHTML = this._cleanHTML(content);
        this.caret.restoreSelection(this.contentElement);
    },

    _cleanHTML: function(html) {
        html = html.replace(/<br\/>/g, '');
        html = html.replace(/<br>/g, '');
        html = html.replace(/<b><\/b>/g, '');
        html = html.replace(/<i><\/i>/g, '');
        html = html.replace(/<div>\s*<\/div>/g, '');
        html = html.replace(/<div>/g, '<p>');
        html = html.replace(/<\/div>/g, '</p>');
        html = html.replace(/<p>\s*<\/p>(<p>\s*<\/p>)+/g, '<p> </p>');
        return html;
    }
}

module.exports = Editor;
