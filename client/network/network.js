Template.network.created = function() {
  console.log("init network");
  console.log(this, Template.instance());
  this.editMode = this.data.editMode;

  // get reactive graphState
  this.graphState = this.view.parentView.parentView._templateInstance.graphState.get()

  // constants
  this.colors = d3.scale.category20c();

  // fetch data
  var nodes = Nodes.find().fetch(),
      edges = Edges.find().fetch();

  // init node/edge selector
  $('#infoBox').css('visibility', 'hidden'); // hide infobox by default
  Session.set( 'currentId', null );
  Session.set( 'currentType', null );

  // node merger
  Session.set("mergeSource", null)
  Session.set("mergeTargets", null)

};

Template.network.rendered = function() {
    var self = this;

    // init graph
    this.graph = cytoscape({
        container: document.getElementById("network"),
        hideLabelsOnViewport: true,
        ready: function() {
          // console.log('topogram ready');
        },
        // load existing positions
        layout: {
            name: 'preset'
        },
        // style
        style: cytoscape.stylesheet()
            .selector('node')
              .style({
                'font-size': this.graphState.fontSize,
                'text-valign': 'top',
                'color': 'black',
                'text-max-width': 100,
                'text-wrap': 'wrap',
                'min-zoomed-font-size': 0.4,
                'background-color' : "#CCC"
              })
            // node with degree zero
            .selector('node[[degree = 0]]')
              .style({
                  'background-color': '#555'
              })
            .selector('edge')
              .style({
                'background-color' : "#000"
              })
      });

    // fetch and parse data
    var edges = Edges.find().fetch(),
        nodes = Nodes.find().fetch();
    console.log("nodes", nodes.length)
    console.log("edges", edges.length)

    // init data
    this.graph.elements().remove(); // make sure evything is clean
    this.graph.add(nodes); // prevent edges to be added before nodes
    this.graph.add(edges);
    this.graph.reset(); // render layout

    console.log(this.graph);

    // mouse select actions
    this.graph.on('select', 'node', /*_.debounce(*/ function(e) {

        var node = e.cyTarget;
        console.log(node.data());
        Session.set('currentType', 'node');
        Session.set('currentId', node.id());

        // color focus
        self.graph.nodes().style({
            'opacity': '.1'
        });
        self.graph.edges().style({
            'opacity': '.1'
        });
        node.style({
            'opacity': '1'
        });
        node.neighborhood().style({
            'opacity': '1'
        });

        // make only the focus selectable
        self.graph.nodes().unselectify();
        self.graph.edges().unselectify(false);
        node.neighborhood().selectify();

        $('#infoBox').css('visibility', 'visible');
    });

    this.graph.on('select', 'edge', /*_.debounce(*/ function(e) {
        var edge = e.cyTarget;
        Session.set('currentType', 'edge');
        Session.set('currentId', edge.id());
        $('#infoBox').css('visibility', 'visible');
    });

    // drag node
    this.graph.on('free', 'node', /*_.debounce(*/ function(e) {
        var node = e.cyTarget;

        // update position
        Meteor.call('updateNodePosition', node.id(), node.position());

        // Node Merger
        // if (nodeEditMode == true) {
        //     // check for node merger
        //     console.log("check for node merger")
        //     var bb = node.boundingbox();
        //
        //     var targets = Nodes.find({
        //         "position.x": {
        //             "$lt": Math.max(bb.x1, bb.x2),
        //             "$gte": Math.min(bb.x1, bb.x2)
        //         },
        //         "position.y": {
        //             "$lt": Math.max(bb.y1, bb.y2),
        //             "$gte": Math.min(bb.y1, bb.y2)
        //         },
        //         "data.id": {
        //             "$not": node.id()
        //         }
        //     }).fetch();
        //
        //     var nodeSource = Nodes.findOne({
        //         "data.id": node.id()
        //     });
        //
        //     if (targets.length) {
        //         Session.set("mergeSource", nodeSource)
        //         Session.set("mergeTargets", targets)
        //         $('#modal-merge').openModal();
        //     }
        // };
    });

    // interactive edge creation
    this.graph.edgehandles({
        complete: function(source, target, addedEntities) {
            Meteor.call('addEdgeFromIds', self.topogramId, source.data('id'), target.data('id'));
        }
    });
    this.graph.edgehandles("disable"); // disbaled by default

    // qtip
    this.graph.elements('node:selectable').qtip({
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

    this.graph.elements('edge:selectable').qtip({
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

    if(!this.data.editMode) {
      self.graph.autolock(true); // prevent drag
      self.graph.edgehandles("disable");
    }

    // context menu (right click)
    if(!this.data.editMode)
      this.graph.cxtmenu({
        selector: 'node',
        commands: [{
            content: '<span><i class="small material-icons">delete</i></span>',
            select: function() {

                // remove the node plus all connected edges
                Meteor.call('deleteNodeAndConnectedEdges', this.id(), this.neighborhood('edge').map(function(d) {
                    return d.id()
                }));

                // remove from graph
                self.graph.remove(this.neighborhood('edge'));
                self.graph.remove(this);
            }
        }, {
            content: '<span><i class="small material-icons">star_rate</i></span>',
            select: function() {
                Meteor.call('starNode', this.id());
                this.data().starred = (this.data().starred) ? false : true;
                // console.log("starred", this.data("starred"), this.data("color"));
                this.style( {
                  'background-color': function(e){
                    return e.data("starred") ? "yellow" : e.data("color");
                  }
                });

            }
        }, {
            content: '<span><i class="small material-icons">lock</i></span>',
            select: function() {
                // console.log( this.position() );
                Meteor.call('lockNode', this.id(), this.position());
            },
        }, {
            content: '<span><i class="small material-icons">comment</i></span>',
            select: function() {
                Meteor.call('addComment', this.id());
            },

        }]
      });

    // handle layouts
    var changeLayout = function(layoutName) {
      // console.log("layoutName", layoutName)
      var layoutConfig = {
          name: layoutName,
          stop: function() {  // callback on layoutstop
              console.log( 'update position' );
              // var nodesLayout = self.graph.nodes().map(function(node) {
              //     return {
              //         id: node.id(),
              //         position: node.position()
              //     };
              // });
              // Meteor.call('updateNodesPositions', nodesLayout);
          }
      };
      // console.log("layoutConfig", layoutConfig)
      var layout = self.graph.makeLayout(layoutConfig);
      // console.log(layout);
      layout.run();
    };

    // set global var
    console.log(Template);
    this.view.parentView.parentView._templateInstance.network.set(this.graph);
    this.view.parentView.parentView._templateInstance.changeLayout.set(changeLayout);

    // watch changes
    /*
    nodes.observeChanges( {
        added: function( id, fields ) {
            // console.log( 'node added' );
            // network.addNode
        },
        changed: function( _id, fields ) {
            // console.log( 'node changed' );
            var item = self.graph.nodes().filter( function( i, node ) {
                return node.data().data._id == _id;
            } );
            // console.log( item );
            for ( var field in fields ) {
                var f = fieldFunctionMap[ field ];
                // console.log( _, f );
                if ( _.isFunction( f ) ) {
                    // console.log( 'test' );
                    f( item, fields[ field ] );
                }
            }
        },
        removed: function() {
            // console.log( 'node removed' );
        }
    } );

    edges.observeChanges( {
        added: function( id, fields ) {
            // console.log( 'edge inserted' );
        },
        changed: function( id, fields ) {
            // console.log( 'edge updated' );
        },
        removed: function() {
            // console.log( 'edge removed' );
        }
    } );
    */
    // console.log('network : ', topogramId, nodes .length, 'nodes', edges .length, 'edges' );
};
