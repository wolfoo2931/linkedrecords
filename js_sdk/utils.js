'use strict';

module.exports = {
    getElementPosition: function (el) {
        var xPos = 0,
            yPos = 0;

        while (el) {
            xPos += el.offsetLeft + el.clientLeft;
            yPos += el.offsetTop  + el.clientTop;

            el = el.offsetParent;
        }

        return {
            x: xPos,
            y: yPos
        };
    }
};
