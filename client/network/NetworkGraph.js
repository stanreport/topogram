NetworkGraph = {
    initNetwork: function(_id, networkId) {
        // console.log( 'initNetwork' );
        this._id = _id;
        this.networkId = networkId;
        this.colors = d3.scale.category20c();

        var self = this;

        this.net = cytoscape({
            container: document.getElementById(_id),
            hideLabelsOnViewport: true,
            ready: function() {

                // console.log('network ready');

                // add everything
                // self.addQTip();
                self.addCxtMenu();
                self.addMouseBehaviours();
                self.addEdgehandles();
            },
            // load existing positions
            layout: {
                name: 'preset'
            },
            // style
            style: cytoscape.stylesheet()
                .selector('node')
                .style({
                    'content': '',
                    'background-color': function(e) {
                        return e.data('starred') ? 'yellow' : self.colors(e.data().data.country);
                    },
                    'font-size': 12,
                    'text-valign': 'center',
                    'color': 'white',
                    'text-outline-width': 2,
                    'text-outline-color': function(e) {
                        return e.locked() ? 'red' : '#888';
                    },
                    'min-zoomed-font-size': 8,
                    'width': function(e) {
                        var count = e.data().data.count || e.degree();
                        return count * 10; //'mapData('+ count +',0, 1, 20, 50)'
                    },
                    'height': function(e) {
                        var count = e.data().data.count || e.degree();
                        return count * 10; //'mapData('+ count +',0, 1, 20, 50)'
                    }
                })
                .selector('node[[degree = 0]]')
                .style({
                    'background-color': '#555'
                })
                .selector('edge')
                .style({
                    // 'content': function( e ){ return e.data('name')? e.data('name') : '';},
                    'target-arrow-shape': 'triangle',
                    'line-color': function(e) {
                        return self.colors(e.data().group);
                    }
                })
                .selector('.edgehandles-hover')
                .style({
                    'background-color': 'red'
                })
                .selector('.edgehandles-source')
                .selector('.edgehandles-target')
                .selector('.edgehandles-preview, .edgehandles-ghost-edge')
                .style({
                    'line-color': 'red',
                    'target-arrow-color': 'red',
                    'source-arrow-color': 'red'
                })
        });

        return this;
    },

    updateNetworkData: function(nodes, edges) {
        // console.log('updateNetworkData');

        this.net.elements().remove(); // make sure evything is clean

        // prevent edges to be added before nodes
        this.net.add(nodes);
        this.net.add(edges);

        this.net.reset(); // render layout
    },

    addQTip: function() {
        // qtip
        this.net.elements('node:selectable').qtip({
            content: function() {
                return this.data().data.type + ' - ' + this.data().data.name;
            },
            show: {
                event: 'mouseover'
            },
            hide: {
                event: 'mouseout'
            }
        });

        this.net.elements('edge:selectable').qtip({
            content: function() {
                return this.data().data.type;
            },
            show: {
                event: 'mouseover'
            },
            hide: {
                event: 'mouseout'
            }
        });
    },

    // contextual menu
    addCxtMenu: function() {
        this.net.cxtmenu({
            selector: 'node',
            commands: [{
                content: '<span class="medium material - icons">delete</span>',
                select: function() {

                    // remove the node plus all connected edges
                    Meteor.call('deleteNodeAndConnectedEdges', this.id(), this.neighborhood('edge').map(function(d){ return d.id() }));

                    // remove from graph
                    net.remove(this.neighborhood('edge'));
                    net.remove(this);
                }
            }, {
                content: '<span class="medium material - icons">star_rate</span>',
                select: function() {
                    Meteor.call('starNode', this.id());
                    this.style({
                        'background-color': 'yellow'
                    });
                }
            }, {
                content: '<span class="medium material - icons">lock</span>',
                select: function() {
                    // console.log( this.position() );
                    Meteor.call('lockNode', this.id(), this.position());
                },
            }, {
                content: '<span class="medium material - icons">comment</span>',
                select: function() {
                    Meteor.call('addComment', this.id());
                },

            }]
        });
    },

    // edgehandles
    addEdgehandles: function() {
        var self = this;

        var onComplete = function(source, target, addedEntities) {
            Meteor.call('addEdgeFromIds', self.networkId, source.data('id'), target.data('id'));
        };

        this.net.edgehandles({
            complete: onComplete
        });
    },

    // drag behaviour
    addMouseBehaviours: function() {
        var self = this;

        this.net.on('select', 'node', /*_.debounce(*/ function(e) {

            var node = e.cyTarget;
            Session.set('currentType', 'node');
            Session.set('currentId', node.id());

            // color focus
            self.net.nodes().style({
                'opacity': '.1'
            });
            self.net.edges().style({
                'opacity': '.1'
            });
            node.style({
                'opacity': '1'
            });
            node.neighborhood().style({
                'opacity': '1'
            });

            // make only the focus selectable 
            self.net.nodes().unselectify();
            self.net.edges().unselectify(false);
            node.neighborhood().selectify();

            // add tooltip
            self.addQTip();

            $('#infoBox').css('visibility', 'visible');
        });

        this.net.on('select', 'edge', /*_.debounce(*/ function(e) {
            var edge = e.cyTarget;
            Session.set('currentType', 'edge');
            Session.set('currentId', edge.id());
            $('#infoBox').css('visibility', 'visible');
        });

        this.net.on('drag', 'node', /*_.debounce(*/ function(e) {
            var node = e.cyTarget;
            Meteor.call('updateNodePosition', node.id(), node.position());
        });

        // check for node merger 
        this.net.on('cxtdragout', 'node', function(e) {
            console.log('test');
            console.log(e.boundingBox());
        });
    }
};