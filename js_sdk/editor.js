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

    document.addEventListener('selectionchange', function(e) {
        self.focusElement();
    });

    this.contentElement.addEventListener('mouseover', function(e) {
        self.focusElement(e.path[0]);
    });

}

Editor.prototype = {
    subscribe: function(callback) {
        var self = this;
        $('#' + this.domId).on('input', function() {
            callback(self._cleanHTML(self.contentElement.innerHTML));
        });
    },

    focusElement: function(element) {

        element = this.caretTargetSection() || element || this.focusedElement;

        if(!element) {
            return false;
        }

        if(this.focusedElement) {
            this.focusedElement.className = '';
        }

        this.focusedElement = element;
        this.focusedElement.className = 'focused';
        return true;
    },

    caretTargetSection: function() {
        var caretTarget = this.caret.targetElement();

        if(caretTarget && caretTarget.parentElement) {
            if(caretTarget.parentElement.parentElement === this.contentElement) {
                return caretTarget.parentElement;
            } else if (caretTarget.parentElement === this.contentElement) {
                return caretTarget;
            }
        }
    },

    cleanUpContent: function() {
        this.caret.saveSelection(this.contentElement);
        this.contentElement.innerHTML = this._cleanHTML(this.contentElement.innerHTML);
        this.caret.restoreSelection(this.contentElement);
        this.focusElement();
    },

    setContent: function(content) {
        this.caret.saveSelection(this.contentElement);
        this.contentElement.innerHTML = this._cleanHTML(content);
        this.caret.restoreSelection(this.contentElement);
    },

    _cleanHTML: function(html) {
        html = html.replace(/<b><\/b>|<i><\/i>|<div>\s*<\/div>/g, '');
        html = html.replace(/<div>/g, '<p>');
        html = html.replace(/<\/div>/g, '</p>');
        html = html.replace(/<p.*?>/g, '<p>');
        html = html.replace(/<p>(\s*|<br>)<\/p>(<p>(\s*|<br>)<\/p>)+/g, '<p><br></p>');
        return html;
    }
}

module.exports = Editor;
