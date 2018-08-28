RTEExt = window.RTEExt || {};
RTEExt.rte = RTEExt.rte || {};
RTEExt.rte.features = RTEExt.rte.features || {};
(function(CUI){
    "use strict";

    const NAME = 'block';

    RTEExt.rte.features.AutoBlockFormatting = new Class({
        toString: 'AutoBlockFormatting',

        extend: RTEExt.rte.features.Feature,

        _activationKey: null,

        getName: function(){
            return NAME;
        },

        getCommands: function(){
            return [RTEExt.rte.commands.AutoBlockFormatting.COMMAND_NAME];
        },

        notifyConfig: function(config){
            //set config
            const defaultConfig = {
                elementMapping: {
                    unorderedList: {
                        charPattern: ['*', '-'],
                        nodeTree: ['ul', 'li']
                    },
                    orderedList: {
                        charPattern: ['1.', '1)'],
                        nodeTree: ['ol', 'li']
                    },
                    h1: {
                        charPattern: ['#'],
                        nodeTree: ['h1']
                    },
                    h2: {
                        charPattern: ['##'],
                        nodeTree: ['h2']
                    },
                    h3: {
                        charPattern: ['###'],
                        nodeTree: ['h3']
                    },
                    h4: {
                        charPattern: ['####'],
                        nodeTree: ['h4']
                    },
                    h5: {
                        charPattern: ['#####'],
                        nodeTree: ['h5']
                    },
                    h6: {
                        charPattern: ['######'],
                        nodeTree: ['h6']
                    },
                    blockquote: {
                        charPattern: ['>'],
                        nodeTree: ['blockquote']
                    },
                    pre: {
                        charPattern: ['_'],
                        nodeTree: ['pre']
                    }
                }
            };
            CUI.rte.Utils.applyDefaults(config, defaultConfig);
            this.config = config;

            //initialize properties
            this._activationKey = ' ';

            //register listeners
            this.editorKernel.addPluginListener('keyup', this._keyup, this, this.plugin, false);
        },

        _keyup: function(event){
            const key = event.nativeEvent.key,
                root = event.editContext.root,
                selection = CUI.rte.Selection.createProcessingSelection(event.editContext),
                cursorNode = selection.startNode;

            //see if we are applying formatting
            if(this._activationKey === key && this._canCreateBlockFormatting(cursorNode, root)){
                //find element mapping from our configuration
                const elementMappingName = Object.keys(this.config.elementMapping).find(function(prop){
                        return this.config.elementMapping.hasOwnProperty(prop)
                            && !this.config.elementMapping[prop].disabled
                            && this.config.elementMapping[prop].charPattern.includes(
                                cursorNode.textContent.substring(0, cursorNode.textContent.length - 1)
                            );
                    }.bind(this)),
                    elementMapping = elementMappingName ? this.config.elementMapping[elementMappingName] : null;

                //modify top level block if we found a mapping
                if(elementMapping){
                    this.editorKernel.relayCmd(RTEExt.rte.commands.AutoBlockFormatting.COMMAND_NAME, {
                        createTree: true,
                        tree: elementMapping.nodeTree
                    });
                }
            } else if('Enter' === key && this._canRemoveBlockFormatting(cursorNode, root)){
                //see if we should remove current formatting
                //find element mapping from our configuration
                const elementMappingName = Object.keys(this.config.elementMapping).find(function(prop){
                        let match = true;

                        if(this.config.elementMapping.hasOwnProperty(prop)
                            && !this.config.elementMapping[prop].disabled){
                            let curNode = cursorNode.parentNode;
                            for(let i = this.config.elementMapping[prop].nodeTree.length - 1; match && i >= 0; i--){
                                match = match
                                    && this.config.elementMapping[prop].nodeTree[i] === curNode.tagName.toLowerCase();
                                curNode = curNode.parentNode;
                            }
                            match = match && curNode === root;
                        } else {
                            match = false;
                        }

                        return match;
                    }.bind(this)),
                    elementMapping = elementMappingName ? this.config.elementMapping[elementMappingName] : null;

                //modify top level block if we found a mapping
                if(elementMapping){
                    this.editorKernel.relayCmd(RTEExt.rte.commands.AutoBlockFormatting.COMMAND_NAME, {
                        createTree: false,
                        tree: elementMapping.nodeTree
                    });
                }
            }
        },

        _canCreateBlockFormatting: function(node, root){
            const parentNode = node.parentNode,
                defaultEditBlockTag = this.editorKernel.getHtmlRules().blockHandling.defaultEditBlockType;

            return node.nodeType === 3
                && parentNode !== root
                && parentNode.nodeType === 1
                && parentNode.childNodes.length === 1
                && parentNode.tagName.toLowerCase() === defaultEditBlockTag;
        },

        _canRemoveBlockFormatting: function(node, root){
            //node is empty text node, has no siblings and intermediate parent nodes don't have siblings
            const defaultEditBlockTag = this.editorKernel.getHtmlRules().blockHandling.defaultEditBlockType;
            let curNode = node,
                removable = (curNode.nodeType === 3 && curNode.textContent === '') || this._isPlaceholderBr(curNode);

            //check no siblings up to top level block node
            while(removable && curNode.parentNode !== root){
                removable = removable && !curNode.previousSibling && !curNode.nextSibling;
                curNode = curNode.parentNode;
            }

            //check current top level block node isn't already the default
            removable = removable && curNode.tagName.toLowerCase() !== defaultEditBlockTag;

            return removable;
        },

        _isPlaceholderBr: function(node){
            return node.nodeType === 1
                && node.tagName.toLowerCase() === 'br'
                && node.attributes.hasOwnProperty(CUI.rte.Common.BR_TEMP_ATTRIB);
        }
    });
})(window.CUI);
