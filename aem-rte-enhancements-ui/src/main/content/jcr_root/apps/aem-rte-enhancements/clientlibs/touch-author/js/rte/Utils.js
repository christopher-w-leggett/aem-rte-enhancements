RTEExt = window.RTEExt || {};
RTEExt.rte = RTEExt.rte || {};
RTEExt.rte.Utils = (function(CUI){
    "use strict";

    /**
     * Gets the computed style of the current selection.  If a tagName is provided in the criteria, the closest parent
     * with that tagName will be considered.
     * If the selection isn't a range, it will find the computed style of the start node.
     * If the selection is a range, it will find the computed style of the start node and end node.  If the
     * start and end styles match, that style will be returned.
     */
    function getComputedStyle(selectionDef, criteria, rootNode){
        var startNode = selectionDef.startNode,
            endNode = selectionDef.endNode,
            startStyle,
            endStyle;

        //if we were provided a specific tag name to look for, move our start/end nodes to that position
        if(criteria.tagName && criteria.tagName !== '*'){
            while(startNode && (!startNode.tagName || startNode.tagName.toLowerCase() !== criteria.tagName)){
                startNode = startNode.parentNode;
                if(startNode === rootNode){
                    startNode = null;
                }
            }
            while(endNode && (!endNode.tagName || endNode.tagName.toLowerCase() !== criteria.tagName)){
                endNode = endNode.parentNode;
                if(endNode === rootNode){
                    endNode = null;
                }
            }
        }

        //get element from start/end nodes
        while(startNode && startNode.nodeType === 3){
            startNode = startNode.parentNode;
        }
        while(endNode && endNode.nodeType === 3){
            endNode = endNode.parentNode;
        }

        //get computed styles
        startStyle = startNode ? window.getComputedStyle(startNode, null).getPropertyValue(criteria.style) : '';
        endStyle = endNode ? window.getComputedStyle(endNode, null).getPropertyValue(criteria.style) : '';

        //return proper computed style
        return !selectionDef.endNode || startStyle === endStyle ? startStyle : '';
    }

    /**
     * Unwraps the provided node by moving all children to its parent and finally removing the provided node.
     */
    function unwrap(node){
        var parentNode = node.parentNode;

        while(node.firstChild){
            parentNode.insertBefore(node.firstChild, node);
        }

        parentNode.removeChild(node);
        parentNode.normalize();
    }

    /**
     * Determines if provided node is a specific tag.
     */
    function isTag(node, tagName){
        return node.tagName && node.tagName.toLowerCase() === tagName;
    }

    /**
     * Determines if the provided nodes attribute list is empty.
     */
    function hasNoAttributes(node){
        return !node.attributes || node.attributes.length === 0;
    }

    /**
     * Determines if the provided node contains only a single style attribute with no value.
     */
    function hasOnlyEmptyStyleAttribute(node){
        return node.attributes
            && node.attributes.length === 1
            && node.attributes[0].nodeName === 'style'
            && node.attributes[0].value === '';
    }

    /**
     * Determines if the node can be unwrapped.  This is true if the node is a coloring node.
     */
    function canUnwrap(node, tagName){
        return isTag(node, tagName) && (hasNoAttributes(node) || hasOnlyEmptyStyleAttribute(node));
    }

    /**
     * Strips styles from descendant nodes.  Any tag matching the unwrap tagName without any styles will be unwrapped.
     *
     * criteria = {
     *     'strip': {
     *         'tagName': <tag>,
     *         'styles': {
     *             '<style-name>': <regex>,
     *             ...
     *         }
     *     },
     *     'unwrap': {
     *         'tagName': <tag>,
     *     }
     * }
     */
    function stripDescendantStyle(node, criteria){
        var curChild = node.firstChild,
            curStyle,
            markerNode;

        while(curChild){
            if(curChild.style && curChild.tagName && curChild.tagName.toLowerCase() === criteria.strip.tagName){
                for(curStyle in criteria.strip.styles){
                    if(criteria.strip.styles.hasOwnProperty(curStyle)){
                        if(criteria.strip.styles[curStyle].test(curChild.style[curStyle])){
                            curChild.style[curStyle] = '';
                        }
                    }
                }
            }

            if(criteria.unwrap.tagName && canUnwrap(curChild, criteria.unwrap.tagName)){
                markerNode = curChild.previousSibling || node;
                unwrap(curChild);
                curChild = markerNode === node ? markerNode.firstChild : markerNode.nextSibling;
            }else{
                stripDescendantStyle(curChild, criteria);
                curChild = curChild.nextSibling;
            }
        }
    }

    function getAncestors(node, rootNode){
        var ancestors = [],
            curNode;

        if(node && node !== rootNode){
            curNode = node.parentNode;
            while(curNode !== rootNode){
                ancestors.push(curNode);
                curNode = curNode.parentNode;
            }

            ancestors.push(rootNode);
        }

        return ancestors;
    }

    function convertTagName(node, tagName){
        var newNode,
            i;

        if(node.tagName && tagName && node.tagName.toLowerCase() !== tagName){
            //convert tag
            newNode = document.createElement(tagName);
            for(i = 0; i < node.attributes.length; i++){
                newNode.setAttribute(node.attributes[i].name, node.attributes[i].value);
            }
            while(node.firstChild){
                newNode.appendChild(node.firstChild);
            }
            node.parentNode.insertBefore(newNode, node);
            node.parentNode.removeChild(node);

            return newNode;
        }else{
            return node;
        }
    }

    function cloneNode(node){
        var newNode = null,
            i;

        if(node.nodeType === 1){
            newNode = document.createElement(node.tagName);
            for(i = 0; i < node.attributes.length; i++){
                newNode.setAttribute(node.attributes[i].name, node.attributes[i].value);
            }
        } else if(node.nodeType === 3){
            newNode = document.createTextNode(node.textContent);
        }

        return newNode;
    }

    function splitTextNode(textNode, startOffset, endOffset){
        var splitNodes = {
            beginning: null,
            middle: null,
            end: null
        },
        normalizedStartOffset,
        normalizedEndOffset;

        if(textNode && textNode.nodeType === 3){
            //verify startOffset
            if(startOffset > textNode.textContent.length){
                //max startOffset can be text length
                normalizedStartOffset = textNode.textContent.length;
            } else if(startOffset > 0){
                //startOffset is valid value from 1 up to text length
                normalizedStartOffset = startOffset;
            } else {
                //startOffset is either invalid, non existent or 0. set to 0 so beginning split isn't performed.
                normalizedStartOffset = 0;
            }

            //verify endOffset
            if((endOffset < 0 || endOffset === 0 || endOffset > 0) && endOffset < normalizedStartOffset){
                //min endOffset is that of the normalizedStartOffset.  In this scenario, no middle text node will be
                //returned.
                normalizedEndOffset = normalizedStartOffset;
            } else if((endOffset === 0 || endOffset > 0) && endOffset <= textNode.textContent.length){
                //endOffset is valid value from normalizedStartOffset up to text length
                normalizedEndOffset = endOffset;
            } else {
                //endOffset is either invalid, non existent or greater than text length.
                //set to text length so end split isn't performed.
                normalizedEndOffset = textNode.textContent.length;
            }

            if(normalizedStartOffset > 0){
                //we need to do a beginning split up to start offset.
                splitNodes.beginning = document.createTextNode(
                    textNode.textContent.substring(0, normalizedStartOffset)
                );
            }
            if(normalizedEndOffset > normalizedStartOffset){
                //we need to do a middle split from start offset to end offset
                splitNodes.middle = document.createTextNode(
                    textNode.textContent.substring(normalizedStartOffset, normalizedEndOffset)
                );
            }
            if(normalizedEndOffset < textNode.textContent.length){
                //we need to  do an end split from end offset to remaining text
                splitNodes.end = document.createTextNode(
                    textNode.textContent.substring(normalizedEndOffset, textNode.textContent.length)
                );
            }
        }

        return splitNodes;
    }

    return {
        getComputedStyle: getComputedStyle,
        unwrap: unwrap,
        canUnwrap: canUnwrap,
        stripDescendantStyle: stripDescendantStyle,
        getAncestors: getAncestors,
        convertTagName: convertTagName,
        cloneNode: cloneNode,
        splitTextNode: splitTextNode
    };
})(window.CUI);
