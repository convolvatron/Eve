var uiEditorRenderer = (function uiRenderer(document, api, microReact) {

  var ixer = api.ixer;
  var code = api.code;

  /*-------------------------------------------------------
  - UI Editor Renderer
  - this renderer is a bit of a hack until we can easily
  - translate ui editor facts into views that generate
  - uiRenderedFactors
  -------------------------------------------------------*/

  var renderer = new microReact.Renderer();
  renderer.content.classList.add("rendered-program");

  renderer.queued = false;
  function render() {
    if(renderer.queued === false) {
      renderer.queued = true;
      requestAnimationFrame(function() {
        renderer.queued = false;
        renderer.render(rendererRoot());
      });
    }
  }

  var parentLayerIndex = ixer.index("parentLayerToLayers");

  function rendererRoot() {
    var componentId = code.activeItemId();
    var layers = parentLayerIndex[componentId];
    if(!layers) return {};

    var layerItems = layers.map(function(layer) {
      return renderLayer(layer);
    });
    return {id: "root", children: layerItems};
  }

  var bindingIndex = ixer.index("groupToBinding");

  function renderLayer(layer) {
    var layerId = layer[1];
    var layerIx = layer[3];
    var elements = ixer.index("uiLayerToElements")[layerId];
    var subLayers = parentLayerIndex[layerId];
    var binding = bindingIndex[layerId];
    var offset = elements && binding ? elementsToBoundingBox(elements) : {top: 0, left: 0, width: "100%", height: "100%"};
    var boundRows;
    var layerChildren = [];
    if(binding) {
      boundRows = ixer.facts(binding);
    } else {
      boundRows = [[]];
    }
    boundRows.forEach(function(row) {
      var items = [];
      if(subLayers) {
        subLayers.forEach(function(subLayer) {
          items.push(renderLayer(subLayer));
        })
      }
      if(elements) {
        elements.forEach(function(element) {
          items.push(renderElement(element, offset, row));
        });
      }
      if(binding) {
        layerChildren.push({c: "repeat-container", width: offset.width, height: offset.height, children: items});
      } else {
        layerChildren = items;
      }
    })
    return {c: "layer", id: layerId, top: offset.top, left: offset.left, zIndex:layerIx, children: layerChildren};
  }

  function elementsToBoundingBox(elements) {
    var finalTop = Infinity;
    var finalLeft = Infinity;
    var finalBottom = -Infinity;
    var finalRight = -Infinity;
    elements.forEach(function(element) {
      var left = element[5];
      var top = element[6];
      var right = element[7];
      var bottom = element[8];
      if(left < finalLeft) {
        finalLeft = left;
      }
      if(top < finalTop) {
        finalTop = top;
      }
      if(right > finalRight) {
        finalRight = right;
      }
      if(bottom > finalBottom) {
        finalBottom = bottom;
      }
    });
    return {top: finalTop, left: finalLeft, right: finalRight, bottom: finalBottom,
            width: finalRight - finalLeft, height: finalBottom - finalTop};
  }

  var attrsIndex = ixer.index("uiStyleToAttrs");
  var stylesIndex = ixer.index("uiElementToStyles");
  var attrBindingsIndex = ixer.index("elementAttrBindings");

  function renderElement(element, offset, row) {
    var elementId = element[1];
    var type = element[4];
    var left = element[5];
    var top = element[6];
    var right = element[7];
    var bottom = element[8];
    var zIndex = element[9];
    var elem = {c: "absolute", left: left - offset.left, top: top - offset.top,
                width: right - left, height: bottom - top, elementId: elementId,
                zIndex: zIndex, row: row};

    var attrs = [];
    var styles = stylesIndex[elementId] || [];
    for(var ix = 0, len = styles.length; ix < len; ix++) {
      var style = styles[ix];
      attrs.push.apply(attrs, attrsIndex[style[1]]);
    }

    if(attrs.length) {
      for(var i = 0, len = attrs.length; i < len; i++) {
        var curAttr = attrs[i];
        var name = curAttr[2];
        elem[name] = curAttr[3];
      }
    }

    var bindings = attrBindingsIndex[elementId];
    if(bindings) {
      bindings.forEach(function(binding) {
        var attr = binding[1];
        var value = bindingToValue(binding, row);
        elem[attr] = value;
      })
    }

    if(type === "button") {
      elem.click = handleMouseEvent;
      elem.dblclick = handleMouseEvent;
    } else if(type === "input") {
      elem.input = handleInputEvent;
      elem.keydown = handleKeyEvent;
    } else {
      elem.c += " non-interactive";
    }

    return elem;
  }

  var fieldToViewIndex = ixer.index("field to view");

  function bindingToValue(binding, row) {
    var fieldId = binding[2];
    var viewId = fieldToViewIndex[fieldId];
    var fieldIx = code.sortedViewFields(viewId).indexOf(fieldId);
    return row[fieldIx];
  }

  var eventId = 0;
  //TODO: How do we associate events to sessions?
  var session = uuid();

  function handleMouseEvent(e, elem) {
    var boundId = elem.row.length ? JSON.stringify(elem.row) : "";
    var diffs = [["client event", "inserted", [session, ++eventId, e.type, elem.elementId, boundId]],
                 ["mouse position", "inserted", [session, eventId, e.clientX, e.clientY]]]
    if(e.type === "click") {
      diffs.push(["click", "inserted", [eventId, elem.elementId, boundId]]);
    }
    window.client.sendToServer(diffs);
  }

  function handleInputEvent(e, elem) {
  }

  function handleKeyEvent(e, elem) {
  }

  return {
    render: render,
    root: renderer.content
  };
})(window.document, api, microReact);