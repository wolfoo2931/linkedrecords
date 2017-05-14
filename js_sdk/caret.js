'use strict';

var Caret = function() {

}

Caret.prototype = {

    // endChild is optional, if given it must be child element
    // of the element passed in the first parameter
    _getContentLengthOfDOMElement: function(element, endChild) {

        var stopCounting = false;

        if (element === endChild) return 0;

        function countContentLengthOfChildren(childEl, endChild) {
            var result = 0;

            childEl.childNodes.forEach(function(childEl) {
                if (childEl === endChild) {
                    stopCounting = true;
                }

                if (childEl.length && !stopCounting) {
                    result += childEl.length;
                } else if(childEl.tagName === 'BR' && !stopCounting) {
                    result += 1;
                } else if (!stopCounting) {
                    result += countContentLengthOfChildren(childEl, endChild);
                }
            });

            return result;
        }

        return countContentLengthOfChildren(element, endChild);
    },


    saveSelection: function(rootEl) {
        var selection = window.getSelection();
        if(selection.anchorNode && selection.focusNode) {
            this.rangeStart = this._getContentLengthOfDOMElement(rootEl, selection.anchorNode) + selection.anchorOffset;
            this.rangeEnd = this._getContentLengthOfDOMElement(rootEl, selection.focusNode) + selection.focusOffset;
        }
    },

    restoreSelection: function(rootEl) {

    }
}
