/* dendry
 * http://github.com/idmillington/dendry
 *
 * MIT License
 */
/*jshint indent:2 */
(function() {
  "use strict";

  var _ = require('lodash');
  var should = require('should');
  // Disable errors from using the should library.
  /*jshint -W030 */


  var engine = require('../lib/engine');

  describe("dendry engine", function() {

    it("should allow game to be terminated", function() {
      var game = {
        scenes: {
          "root": {id: "root", options:{options:[{id:'@foo', title:'Foo'}]}},
            "foo": {id: "foo"}
        }
      };
      var ui = new engine.NullUserInterface();
      var dendryEngine = new engine.DendryEngine(ui, game);
      dendryEngine.beginGame().gameOver();
      dendryEngine.isGameOver().should.be.true;
    });

    // ---------------------------------------------------------------------

    describe("loading game", function() {
      it("should load a functionless JSON file", function(done) {
        var json = '{"title":"The Title", "author":"The Author"}';
        engine.convertJSONToGame(json, function(err, game) {
          (!!err).should.be.false;
          game.title.should.equal("The Title");
          game.author.should.equal("The Author");
          done();
        });
      });

      it("should convert function definitions into functions", function(done) {
        var json = '{"title":"The Title", "fun":{"$code":"return true;"}}';
        engine.convertJSONToGame(json, function(err, game) {
          (!!err).should.be.false;
          game.title.should.equal("The Title");
          _.isFunction(game.fun).should.be.true;
          game.fun().should.be.true;
          done();
        });
      });

      it("should report malformed JSON", function(done) {
        var json = '{"title":"The Title", "author":a}';
        engine.convertJSONToGame(json, function(err, game) {
          (!!err).should.be.true;
          err.toString().should.equal("SyntaxError: Unexpected token a");
          done();
        });
      });

    });

    // ---------------------------------------------------------------------

    describe("scene", function() {

      it("should start at the root scene", function() {
        var game = {
          scenes: {
            "root": {id: "root", content:"Root content", newPage: true,
                    options:{options:[{id:"@foo", title:"Foo"}]}},
            "foo": {id: "foo", content:"Foo content"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('root');
        dendryEngine.isGameOver().should.be.false;
      });

      it("should explicitly allow game to be terminated", function() {
        var game = {
          scenes: {
            "root": {id: "root", options:{options:[{id:'@foo', title:'Foo'}]}},
            "foo": {id: "foo", gameOver:true}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame().choose(0);
        dendryEngine.isGameOver().should.be.true;
      });

      it("terminates if the root has no choices", function() {
        var game = {
          scenes: {
            "root": {id: "root"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.isGameOver().should.be.true;
      });

      it("should start at an explicit scene, if given", function() {
        var game = {
          firstScene: "foo",
          scenes: {
            "root": {id: "root", content:"Root content"},
            "foo": {id: "foo", content:"Foo content",
                    options:{options:[{id:"@root", title:"Root"}]}}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('foo');
      });

      it("should honor goto, if given", function() {
        var game = {
          scenes: {
            "root": {id: "root", content:"Root content", goTo:"foo"},
            "foo": {id: "foo", content:"Foo content"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('foo');
      });
    });

    // ---------------------------------------------------------------------

    describe("actions", function() {
      it(
        "should call on-arrival, on-display and on-departure appropriately",
        function() {
          var rootArrival = 0;
          var rootDisplay = 0;
          var rootDeparture = 0;
          var fooArrival = 0;
          var fooDisplay = 0;
          var fooDeparture = 0;
          var game = {
            scenes: {
              "root": {
                id: "root",
                onArrival: [function() {rootArrival++;}],
                onDisplay: [function() {rootDisplay++;}],
                onDeparture: [function() {rootDeparture++;}]
              },
              "foo": {
                id: "foo",
                onArrival: [function() {fooArrival++;}],
                onDisplay: [function() {fooDisplay++;}],
                onDeparture: [function() {fooDeparture++;}]
              }
            }
          };
          var check = function(rootArrivalTarget, rootDisplayTarget,
                               rootDepartureTarget, fooArrivalTarget,
                               fooDisplayTarget, fooDepartureTarget) {
            rootArrival.should.equal(rootArrivalTarget);
            rootDisplay.should.equal(rootDisplayTarget);
            rootDeparture.should.equal(rootDepartureTarget);
            fooArrival.should.equal(fooArrivalTarget);
            fooDisplay.should.equal(fooDisplayTarget);
            fooDeparture.should.equal(fooDepartureTarget);
          };
          var ui = new engine.NullUserInterface();
          var dendryEngine = new engine.DendryEngine(ui, game);
          dendryEngine.beginGame();
          check(1,1,0, 0,0,0);

          dendryEngine.goToScene('foo');
          check(1,1,1, 1,1,0);

          dendryEngine.displaySceneContent();
          check(1,1,1, 1,2,0);

          dendryEngine.goToScene(dendryEngine.getRootSceneId());
          check(2,2,1, 1,2,1);

          // Go to the scene without transitioning.
          dendryEngine.goToScene('foo', true);
          check(2,2,1, 1,3,1);
        });

      it("should not fail when errors are found in actions", function() {
        var rootDisplay = 0;
        var game = {
          scenes: {
            "root": {
              id: "root",
              // Lack of rootArrival variable shouldn't prevent initial scene.
              onArrival: [function() {rootArrival++;}],
              onDisplay: [function() {rootDisplay++;}]
            },
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        rootDisplay.should.equal(1);
      });
    });

    // ---------------------------------------------------------------------

    describe("choices", function() {
      it("should give a default choice if none is available", function() {
        var game = {
          scenes: {
            "root": {id: "root"},
            "foo": {id: "foo"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame().goToScene('foo');
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(1);
        choices[0].id.should.equal('root');
        choices[0].title.should.equal('Scene Complete');
      });

      it("should not give a default choice if we're at the root", function() {
        var game = {
          scenes: {
            "root": {id: "root"},
            "foo": {id: "foo"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        (choices === null).should.be.true;
      });

      it("can choose an choice and have it change scene", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"To the Foo"}
              ]}
            },
            "foo": {id: "foo"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('root');
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(1);
        dendryEngine.choose(0);
        dendryEngine.getCurrentScene().id.should.equal('foo');
      });

      it("should use the scene title if no option title is given", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[ {id:"@foo"} ]}
            },
            "foo": {id: "foo", title: "The Foo"}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(1);
        choices[0].title.should.equal("The Foo");
      });

      it("can generate choices from tags", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[ {id:"#alpha"} ]}
            },
            "foo": {id: "foo", title: "The Foo"},
            "bar": {id: "bar", title: "The Bar"}
          },
          tagLookup: {
            alpha: {foo:true, bar:true}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(2);
      });

      it("orders choices correctly", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"Foo Link"},
                {id:"@bar", title:"Bar Link"},
                {id:"@sun", title:"Sun Link"},
                {id:"@dock", title:"Dock Link"},
                {id:"@trog", title:"Trog Link"},
              ]}
            },
            "foo": {id: "foo", title: "The Foo", order:3},
            "bar": {id: "bar", title: "The Bar", order:1},
            "sun": {id: "sun", title: "The Sun", order:5},
            "dock": {id: "dock", title: "The Dock", order:2},
            "trog": {id: "trog", title: "The Trog", order:4}
          },
          tagLookup: {}
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        _.map(choices, function(choice) { return choice.title; }).should.eql([
          "Bar Link",
          "Dock Link",
          "Foo Link",
          "Trog Link",
          "Sun Link"
        ]);
      });

      it("only displays highest visible priority", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"Foo Link"},
                {id:"@bar", title:"Bar Link"},
                {id:"@sun", title:"Sun Link"},
                {id:"@dock", title:"Dock Link"},
                {id:"@trog", title:"Trog Link"},
              ]}
            },
            "foo": {id: "foo", title: "The Foo", priority:1},
            "bar": {id: "bar", title: "The Bar", priority:1},
            "sun": {id: "sun", title: "The Sun", priority:3},
            "dock": {id: "dock", title: "The Dock", priority:2},
            "trog": {id: "trog", title: "The Trog", priority:2}
          },
          tagLookup: {}
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(1);
        choices[0].title.should.equal("Sun Link");
      });

      it("displays lower priorities if minimum not reached", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: {
                minChoices: 3,
                maxChoices: 3,
                options:[
                  {id:"@foo", title:"Foo Link"},
                  {id:"@bar", title:"Bar Link"},
                  {id:"@sun", title:"Sun Link"},
                  {id:"@dock", title:"Dock Link"},
                  {id:"@trog", title:"Trog Link"},
                ]
              }
            },
            "foo": {id: "foo", title: "The Foo", priority:1, order:1},
            "bar": {id: "bar", title: "The Bar", priority:1, order:2},
            "sun": {id: "sun", title: "The Sun", priority:3, order:3},
            "dock": {id: "dock", title: "The Dock", priority:2, order:4},
            "trog": {id: "trog", title: "The Trog", priority:2, order:5}
          },
          tagLookup: {}
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        _.map(choices, function(choice) { return choice.title; }).should.eql([
          "Sun Link",
          "Dock Link",
          "Trog Link"
        ]);
      });

      it("samples lower priority choices if too many are viable", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: {
                minChoices: 3,
                maxChoices: 3,
                options:[
                  {id:"@foo", title:"Foo Link"},
                  {id:"@bar", title:"Bar Link"},
                  {id:"@sun", title:"Sun Link"},
                  {id:"@dock", title:"Dock Link"},
                  {id:"@trog", title:"Trog Link"},
                ]
              }
            },
            "foo": {id: "foo", title: "The Foo", priority:2, order:1},
            "bar": {id: "bar", title: "The Bar", priority:2, order:2},
            "sun": {id: "sun", title: "The Sun", priority:1, order:3},
            "dock": {id: "dock", title: "The Dock", priority:1, order:4},
            "trog": {id: "trog", title: "The Trog", priority:1, order:5}
          },
          tagLookup: {}
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(3);
        // First two should always be the higher priority options, the
        // other can be anything (they're first because of their order
        // value, not because of their priority).
        choices[0].id.should.equal('foo');
        choices[1].id.should.equal('bar');
      });

      it("overrides tag choices with explicit choice", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"#alpha"},
                {id:"@foo", title:"Foo Link"}
              ]}
            },
            "foo": {id: "foo", title: "The Foo"},
            "bar": {id: "bar", title: "The Bar"}
          },
          tagLookup: {
            alpha: {foo:true, bar:true}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(2);
        var which = (choices[0].id === 'foo') ? 0 : 1;
        choices[which].title.should.equal("Foo Link");
      });

      it("doesn't override explicit choices from a tag", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"Foo Link"},
                {id:"#alpha"}
              ]}
            },
            "foo": {id: "foo", title: "The Foo"},
            "bar": {id: "bar", title: "The Bar"}
          },
          tagLookup: {
            alpha: {foo:true, bar:true}
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        var choices = dendryEngine.getCurrentChoices();
        choices.length.should.equal(2);
        var which = (choices[0].id === 'foo') ? 0 : 1;
        choices[which].title.should.equal("Foo Link");
      });

      it("can't choose an invalid choice", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"To the Foo"}
              ]}
            },
            "foo": {
              id: "foo",
              options: { options:[
                {id:"@root", title:"Back to the Root"}
              ]}
            }
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        (function() { dendryEngine.choose(1); }).should.throw(
          "No choice at index 1, only 1 choices are available."
        );
      });

      it("removes a choice visited too much", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"To the Foo"},
                {id:"@bar", title:"To the Bar"}
              ]}
            },
            "foo": {
              id: "foo",
              maxVisits: 1,
              options: { options:[
                {id:"@root", title:"Back to the Root"}
              ]}
            },
            "bar": {
              id: "bar",
              options: { options:[
                {id:"@root", title:"Back to the Root"}
              ]}
            }
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('root');
        dendryEngine.getCurrentChoices().length.should.equal(2);
        dendryEngine.choose(0).choose(0);
        dendryEngine.getCurrentScene().id.should.equal('root');
        dendryEngine.getCurrentChoices().length.should.equal(1);
      });

      it("honors view-if checks when compiling choices", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"To the Foo"},
                {id:"@bar", title:"To the Bar"}
              ]}
            },
            "foo": {
              id: "foo",
              viewIf: function(state, Q) { return false; }
            },
            "bar": {
              id: "bar",
              viewIf: function(state, Q) { return true; }
            }
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentScene().id.should.equal('root');
        dendryEngine.getCurrentChoices().length.should.equal(1);
      });

      it("ends the game when no valid choices remain", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              options: { options:[
                {id:"@foo", title:"To the Foo"}
              ]}
            },
            "foo": {
              id: "foo",
              maxVisits: 1,
              options: { options:[
                {id:"@root", title:"Back to the Root"}
              ]}
            }
          }
        };
        var ui = new engine.NullUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        dendryEngine.getCurrentChoices().length.should.equal(1);
        dendryEngine.choose(0).choose(0);
        dendryEngine.isGameOver().should.be.true;
      });
    });

    describe("display", function() {
      var TestUserInterface = function() {
        this.content = [];
        this.choices = [];
        this.page = 0;
      };
      engine.UserInterface.makeParentOf(TestUserInterface);
      TestUserInterface.prototype.displayContent = function(content) {
        this.content.push(content);
      };
      TestUserInterface.prototype.displayChoices = function(choices) {
        this.choices.push(choices);
      };
      TestUserInterface.prototype.newPage = function() {
        this.content = [];
        this.page++;
      };

      it("displays the initial scene content when first begun", function() {
        var game = {
          scenes: {
            "root": {
              id: "root",
              content: "This is the root content.",
              options: { options:[
                {id:"@foo", title:"To the Foo"}
              ]},
            },
            "foo": {id:"foo"}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();

        // We should have recieved one set of content, the root content.
        ui.content.length.should.equal(1);
        ui.content[0].should.equal("This is the root content.");

        // We should have received one set of choices, and it should have one
        // choice.
        ui.choices.length.should.equal(1);
        var choices = ui.choices[0];
        choices.length.should.equal(1);
        choices[0].id.should.equal('foo');
        choices[0].title.should.equal("To the Foo");
      });

      it("displays no content if a scene has no content", function() {
        var game = {
          scenes: {
            "root": {id: "root", options:{options:[{id:'@foo', title:'Foo'}]}},
            "foo": {id: "foo"}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        ui.content.length.should.equal(0);
      });

      it("clears the page when a new-page scene is found", function() {
        var game = {
          scenes: {
            "root": {id: "root", content: "Root content",
                     newPage: true,
                     options:{options:[{id:'@foo', title:'Foo'}]}},
            "foo": {id: "foo", content: "Foo content"}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame();
        ui.content.length.should.equal(1);
        dendryEngine.choose(0);
        ui.content.length.should.equal(2);
        ui.page.should.equal(1);
        dendryEngine.choose(0);
        ui.content.length.should.equal(1);
        ui.page.should.equal(2);
      });

      it("displays game over if we're done", function() {
        var game = {
          scenes: {
            "root": {id:"root", options:{options:[{id:"@foo", title:"Foo"}]}},
            "foo": {id:"foo", content:"Foo content"}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame().gameOver();
        ui.content.length.should.equal(1);
        ui.content[0].should.equal("Game Over");
      });

      it("displays game over scene content", function() {
        var game = {
          scenes: {
            "root": {id:"root", options:{options:[{id:"@foo", title:"Foo"}]}},
            "foo": {id:"foo", content:"Foo content", gameOver:true}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame().choose(0);
        ui.content.length.should.equal(2);
        ui.content[0].should.equal("Foo content");
        ui.content[1].should.equal("Game Over");
        dendryEngine.isGameOver().should.be.true;
      });

      it("displays content from scene with go-to", function() {
        var game = {
          scenes: {
            "root": {id:"root", options:{options:[{id:"@foo", title:"Foo"}]}},
            "foo": {id:"foo", content:"Foo content", goTo:"bar"},
            "bar": {id:"bar", content:"Bar content"}
          }
        };
        var ui = new TestUserInterface();
        var dendryEngine = new engine.DendryEngine(ui, game);
        dendryEngine.beginGame().choose(0);
        ui.content.length.should.equal(2);
        ui.content[0].should.equal("Foo content");
        ui.content[1].should.equal("Bar content");
      });
    });
  });
}());