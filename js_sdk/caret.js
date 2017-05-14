'use strict';

var Caret = function() {

}

Caret.prototype = {

    _getElementsContentLengthIncrement(element) {
        if(['BR', 'IMG'].includes(element.tagName)) return 1;
        if(!element.length) return 0;
        return element.length;
    },

    _getContentLengthOfDOMElement: function(element, endChild) {
        var treeWalker = document.createTreeWalker(element),
            currentEl,
            length = 0;

        while(currentEl = treeWalker.currentNode) {
            if(currentEl === endChild) return length;

            length += this._getElementsContentLengthIncrement(currentEl);

            treeWalker.nextNode();
        }

        return length;
    },

    // rightMatch: when root element contains: '<p>Hello</p><p>World</p>' and contentLength is '5'
    //             it is not clear which element to return, if rightMatch is true then '<p>World</p>' will
    //             be returned, '<p>Hello</p>' otherwise
    _getElementByContentLength: function(rootEl, contentLength, rightMatch) {
        var treeWalker = document.createTreeWalker(rootEl),
            currentEl,
            length = 0,
            currentElLength;

        while(currentEl = treeWalker.currentNode) {
            currentElLength = this._getElementsContentLengthIncrement(currentEl);

            if((length + currentElLength) < contentLength) {
                length += currentElLength;
            } else if((length + currentElLength) === contentLength) {
                return rightMatch ? (treeWalker.nextNode() || currentEl) : currentEl;
            } else {
                return currentEl;
            }

            treeWalker.nextNode();
        }

        return null;
    },

    restoreSelection: function(rootEl) {
        if(this.rangeStart && this.rangeEnd) {

            var range,
                selection = window.getSelection(),
                startNode = this._getElementByContentLength(rootEl, this.rangeStart, this.rangeStartAtZeroOffset),
                endNode = this._getElementByContentLength(rootEl, this.rangeEnd, this.rangeEndAtZeroOffset),
                startOffset = this.rangeStart - this._getContentLengthOfDOMElement(rootEl, startNode),
                endOffset = this.rangeEnd - this._getContentLengthOfDOMElement(rootEl, endNode);

            range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            selection.removeAllRanges();
            selection.addRange(range);
        }
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
            this.rangeStartAtZeroOffset = selection.anchorOffset == 0;
            this.rangeEndAtZeroOffset = selection.focusOffset == 0;
        }
    }
}
