/**
 * FX registry + inlinable browser runtime.
 *
 * Each FX module exports { name, label, defaultParams, initState(w,h,p)->state,
 * draw(ctx,state,t,p,w,h) }. initState/draw are self-contained so they can be
 * serialized via .toString() into a single inlined runtime that powers BOTH the
 * present/export HTML and (by importing the same modules) the editor canvas.
 */
const gradientBlob = require('./gradient-blob.js')
const starfield = require('./starfield.js')
const matrixRain = require('./matrix-rain.js')
const constellation = require('./constellation.js')
const particleBurst = require('./particle-burst.js')
const knowledgeGraph = require('./knowledge-graph.js')
const orbitRing = require('./orbit-ring.js')
const sparkleTrail = require('./sparkle-trail.js')

const FX_LIST = [
  gradientBlob, starfield, matrixRain, constellation,
  particleBurst, knowledgeGraph, orbitRing, sparkleTrail,
]

const FX_MODULES = FX_LIST.reduce((acc, m) => {
  acc[m.name] = m
  return acc
}, {})

/** Look up an FX module by name; null for unknown (never throws). */
function getFxModule(name) {
  return (name && FX_MODULES[name]) || null
}

/** Array of all registered FX modules. */
function listFx() {
  return FX_LIST.slice()
}

/**
 * Build the inlined browser runtime <script> that:
 *  - embeds the registry (initState/draw serialized as real functions),
 *  - starts the active slide's rAF loop and stops others,
 *  - hooks BOTH Reveal 'ready' (initial load) AND 'slidechanged' (so slide 1's
 *    FX is not dead until you navigate away — reveal does NOT fire slidechanged
 *    on initial load),
 *  - honors prefers-reduced-motion (static first frame, no animation).
 */
function buildFxRuntimeScript() {
  const entries = FX_LIST.map((m) => {
    const params = JSON.stringify(m.defaultParams || {})
    return `${JSON.stringify(m.name)}:{defaultParams:${params},initState:${m.initState.toString()},draw:${m.draw.toString()}}`
  }).join(',')

  return `  <script>
  /* navslides-fx-runtime */
  (function(){
    var registry = {${entries}};
    window.__navslidesFxRuntime = { registry: registry };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function startCanvas(canvas){
      if (canvas._fxRunning) return;
      var mod = registry[canvas.getAttribute('data-fx-name')];
      if (!mod) return;
      var params = {};
      try { params = JSON.parse(canvas.getAttribute('data-fx-params') || '{}'); } catch(e){}
      for (var k in mod.defaultParams) { if (!(k in params)) params[k] = mod.defaultParams[k]; }
      var w = canvas.offsetWidth || canvas.parentNode.offsetWidth || 960;
      var h = canvas.offsetHeight || canvas.parentNode.offsetHeight || 540;
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      var state = mod.initState(w, h, params);
      canvas._fxRunning = true;
      if (reduce) { try { mod.draw(ctx, state, 0, params, w, h); } catch(e){} return; }
      function frame(ms){
        try { mod.draw(ctx, state, ms / 1000, params, w, h); } catch(e){}
        canvas._fxRaf = window.requestAnimationFrame(frame);
      }
      canvas._fxRaf = window.requestAnimationFrame(frame);
    }
    function stopCanvas(canvas){
      if (canvas._fxRaf) window.cancelAnimationFrame(canvas._fxRaf);
      canvas._fxRaf = null; canvas._fxRunning = false;
    }
    function fxSyncActive(){
      var current = (window.Reveal && Reveal.getCurrentSlide) ? Reveal.getCurrentSlide() : null;
      var all = document.querySelectorAll('canvas[data-fx-name]');
      for (var i = 0; i < all.length; i++){
        var c = all[i];
        if (current && current.contains(c)) startCanvas(c); else stopCanvas(c);
      }
    }
    window.__navslidesFxRuntime.sync = fxSyncActive;
    if (window.Reveal && Reveal.on){
      Reveal.on('ready', fxSyncActive);
      Reveal.on('slidechanged', fxSyncActive);
    } else {
      window.addEventListener('load', fxSyncActive);
    }
  })();
  </script>`
}

module.exports = { FX_MODULES, getFxModule, listFx, buildFxRuntimeScript }
