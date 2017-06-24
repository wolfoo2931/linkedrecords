'use strict';

var $ = require('jquery'),
    Caret = require('./caret'),
    Utils = require('./utils');

var Editor = function(domId) {
    var self = this;

    this.domId = domId;
    this.contentElement = document.getElementById(domId);
    this.caret = new Caret();

    this.sectionTypeSelector = document.createElement('div');
    this.sectionTypeSelector.id = 'sectionTypeSelector';
    this.sectionTypeSelector.innerHTML = "<div>paragraph</div>";
    document.body.appendChild(this.sectionTypeSelector);

    this.subscribe(function() {
        self.cleanUpContent();
    });

    document.addEventListener('selectionchange', function(e) {
        self.focusSection();
    });

    this.contentElement.addEventListener('mouseover', function(e) {
        self.focusSection(e.path[0]);
    });
}

Editor.prototype = {
    subscribe: function(callback) {
        var self = this;
        $('#' + this.domId).on('input', function() {
            callback(self._cleanHTML(self.contentElement.innerHTML));
        });
    },

    focusSection: function(element) {

        element = this.focusedSection() || element || this.focusedElement;

        if(!element || element.parentElement !== this.contentElement) {
            return false;
        }

        if(this.focusedElement && this.focusedElement != element) {
            this.focusedElement.className = '';
        }

        if(this.focusedElement != element) {
            this.focusedElement = element;
            this.focusedElement.className = 'focused';
            this.displaySectionTypeSelectorNextTo(this.focusedElement);
        }

        return true;
    },

    displaySectionTypeSelectorNextTo: function(focusedElement) {
        var focusedElementPosition = Utils.getElementPosition(focusedElement),
            sectionTypeSelectorElement = document.getElementById('sectionTypeSelector'),
            posX,
            posY;

        if(focusedElement) {
            posX = focusedElementPosition.x + focusedElement.offsetWidth - Math.floor(sectionTypeSelectorElement.offsetWidth/2);
            posY = focusedElementPosition.y;

            if(posY > focusedElementPosition.y + focusedElementPosition.offsetHeight) {
                posY = focusedElementPosition.y + focusedElementPosition.offsetHeight;
            }

            sectionTypeSelectorElement.style.left = posX + 'px';
            sectionTypeSelectorElement.style.top = posY + 'px';
        }
    },

    focusedSection: function() {
        var caretTarget = this.caret.targetElement();

        if(caretTarget && caretTarget.parentElement) {
            if(caretTarget.parentElement.parentElement === this.contentElement) {
                return caretTarget.parentElement;
            } else if (caretTarget.parentElement === this.contentElement) {
                return caretTarget;
            }
        }
    },

    //FIXME: maybe use the TreeWalker to cleanup the content instead of
    // replacing it compleatly after cleanup
    cleanUpContent: function() {
        this.caret.saveSelection(this.contentElement);
        this.contentElement.innerHTML = this._cleanHTML(this.contentElement.innerHTML);
        this.caret.restoreSelection(this.contentElement);
        this.focusSection();
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
