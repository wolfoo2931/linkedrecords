'use strict';

var Caret = function() {

}

Caret.prototype = {

    // endChild is optional, if given it must be child element
    // of the element passed in the first parameter
    //TODO: evaluate whether innerText can help to simpify this (seems not to be helpfull because it does not repsect img tags)
    _getContentLengthOfDOMElement: function(element, endChild) {

        var stopCounting = false;

        function countContentLengthOfChildren(childEl, endChild) {
            var result = 0;

            if(childEl === endChild) stopCounting = true;
            if(stopCounting) return 0;

            if(['BR', 'IMG'].includes(childEl.tagName)) return 1;
            if(childEl.length) return childEl.length;

            childEl.childNodes.forEach(function(childEl) {
                result += countContentLengthOfChildren(childEl, endChild);
            });

            return result;
        }

        return countContentLengthOfChildren(element, endChild);
    },

    restoreSelection: function(rootEl) {
    },

    // text|text
    // <div>text|</div><div>text</div>
    // <div>text</div><div>|text<,/div>
    // text|<br/><br/><br/>text
    // text<br/>|<br/><br/>text
    // text<br/><br/>|<br/>text
    // text<br/><br/><br/>|text
    // Preformatted stuff (root element includes <pre> tags)
    saveSelection: function(rootEl) {
        var selection = window.getSelection();
        if(selection.anchorNode && selection.focusNode) {
            this.rangeStart = this._getContentLengthOfDOMElement(rootEl, selection.anchorNode) + selection.anchorOffset;
            this.rangeEnd = this._getContentLengthOfDOMElement(rootEl, selection.focusNode) + selection.focusOffset;
        }

        console.log(this.rangeStart)
    }
}
