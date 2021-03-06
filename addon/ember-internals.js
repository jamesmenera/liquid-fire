/*
  This module is intended to encapsulate all the known places where
  liquid-fire depends on non-public Ember APIs.
 */

import Ember from "ember";
var require = Ember.__loader.require;
var internal = require('htmlbars-runtime').internal;
var registerKeyword = require('ember-htmlbars/keywords').registerKeyword;
var Stream = require('ember-metal/streams/stream').default;
var isStable = require('ember-htmlbars/keywords/real_outlet').default.isStable;

// Given an Ember.View, return the containing element
export function containingElement(view) {
  return view._renderNode.contextualElement;
}

// This is Ember's {{#if}} predicate semantics (where empty lists
// count as false, etc).
export var shouldDisplay = require('ember-views/streams/should_display').default;

// Finds the route name from a route state so we can apply our
// matching rules to it.
export function routeName(routeIdentity) {
  var o, r;
  if (routeIdentity && (o = routeIdentity.outletState) && (r = o.render)) {
    return [ r.name ];
  }
}

// Finds the route's model from a route state so we can apply our
// matching rules to it.
export function routeModel(routeIdentity) {
  var o;
  if (routeIdentity && (o = routeIdentity.outletState)) {
    return [ o._lf_model ];
  }
}

function withLockedModel(outletState) {
  var r, c;
  if (outletState && (r = outletState.render) && (c = r.controller) && !outletState._lf_model) {
    outletState = Ember.copy(outletState);
    outletState._lf_model = c.get('model');
  }
  return outletState;
}

export function registerKeywords() {
  registerKeyword('get-outlet-state', {
    willRender(renderNode, env) {
      env.view.ownerView._outlets.push(renderNode);
    },

    setupState(lastState, env, scope, params) {
      var outletName = env.hooks.getValue(params[0]);
      var stream = lastState.stream;
      var source = lastState.source;
      if (!stream) {
        source = { identity: {
            outletState: withLockedModel(env.outletState[outletName])
        }};
        stream = new Stream(function() {
          return source.identity;
        });
      }
      return { stream, source, outletName };
    },

    render(renderNode, env, scope, params, hash, template, inverse, visitor) {
      internal.hostBlock(renderNode, env, scope, template, null, null, visitor, function(options) {
        options.templates.template.yield([renderNode.state.stream]);
      });

    },
    rerender(morph, env) {
      var newState = withLockedModel(env.outletState[morph.state.outletName]);
      if (isStable(morph.state.source.identity, { outletState: newState })) {
        // If our own view was stable, we preserve the same object
        // identity so that liquid-versions will not animate us. But
        // we still need to propagate any child changes forward.
        Ember.set(morph.state.source.identity, 'outletState', newState);
      } else {
        // If our own view has changed, we present a whole new object,
        // so that liquid-versions will see the change.
        morph.state.source.identity = { outletState: newState };
      }
      morph.state.stream.notify();
    },
    isStable() {
      return true;
    }
  });

  registerKeyword('set-outlet-state', {
    setupState(state, env, scope, params) {
      var outletName = env.hooks.getValue(params[0]);
      var outletState = env.hooks.getValue(params[1]);
      return { outletState: { [ outletName ] : outletState }};
    },

    childEnv(state) {
      return { outletState: state.outletState };
    },

    render(renderNode, env, scope, params, hash, template, inverse, visitor) {
      internal.hostBlock(renderNode, env, scope, template, null, null, visitor, function(options) {
        options.templates.template.yield();
      });
    },

    isStable() {
      return true;
    }
  });


}
