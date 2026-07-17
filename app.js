document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // --- Canvas Dimensions & DOM ---
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  
  const layersStack = document.getElementById('canvas-layers-stack');
  const layersListMount = document.getElementById('layers-list-mount');
  const canvasCard = document.getElementById('canvas-card');
  const canvasTextOverlay = document.getElementById('canvas-text-input');
  
  // Properties DOM
  const brushSizeInput = document.getElementById('input-brush-size');
  const brushSizeVal = document.getElementById('brush-size-val');
  const brushOpacityInput = document.getElementById('input-brush-opacity');
  const brushOpacityVal = document.getElementById('brush-opacity-val');
  const brushStabilizerInput = document.getElementById('input-brush-stabilizer');
  const brushStabilizerVal = document.getElementById('brush-stabilizer-val');
  const blendModeSelect = document.getElementById('select-blend-mode');
  const activeToolDisplay = document.getElementById('active-tool-display');
  
  // Floating View Controls
  const zoomPercentageText = document.getElementById('zoom-percentage');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnResetView = document.getElementById('btn-reset-view');

  // --- State Variables ---
  let currentTool = 'pen'; // 'select', 'pen', 'brush', 'eraser', 'bucket', 'rect', 'circle', 'text'
  let currentColor = '#ff758f';
  let currentSize = 5;
  let currentOpacity = 1.0;
  let stabilizerLevel = 8;
  let currentBlendMode = 'source-over';
  let zoomScale = 1.0;
  
  // Undo/Redo Stacks
  const undoHistory = [];
  const redoHistory = [];
  const maxHistorySteps = 20;

  // Drawing Cursors Queue for Stabilizer
  let pointsQueue = [];
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  // --- Stacked Layers Management ---
  let layers = [];
  let activeLayer = null;
  let tempCanvas = null; // Top layer for dragging previews
  let tempCtx = null;

  function initLayers() {
    layersStack.innerHTML = '';
    layers = [];

    // Create 2 default layers
    createLayer('Background');
    createLayer('Line Art');

    // Fill background layer with white
    const bgLayer = layers.find(l => l.name === 'Background');
    bgLayer.ctx.fillStyle = '#ffffff';
    bgLayer.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Create top interaction canvas
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    tempCanvas.className = 'interaction-layer';
    layersStack.appendChild(tempCanvas);
    tempCtx = tempCanvas.getContext('2d');

    setActiveLayer('layer-2'); // Set Line Art active
    saveHistoryState();
  }

  function createLayer(name = 'New Layer') {
    const id = `layer-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = CANVAS_WIDTH;
    newCanvas.height = CANVAS_HEIGHT;
    newCanvas.id = id;

    // Insert layer before the temp interaction canvas
    if (tempCanvas) {
      layersStack.insertBefore(newCanvas, tempCanvas);
    } else {
      layersStack.appendChild(newCanvas);
    }

    const layerObj = {
      id: id,
      name: name,
      visible: true,
      canvas: newCanvas,
      ctx: newCanvas.getContext('2d')
    };

    layers.push(layerObj);
    renderLayersList();
    return layerObj;
  }

  function renderLayersList() {
    layersListMount.innerHTML = '';
    // Draw layers from top-to-bottom in the sidebar list (reversed order of stacking)
    [...layers].reverse().forEach(layer => {
      const li = document.createElement('li');
      li.className = `layer-item ${layer.id === activeLayer.id ? 'active' : ''}`;
      li.setAttribute('data-id', layer.id);

      li.innerHTML = `
        <button class="layer-visibility" title="Toggle Visibility">
          <i data-lucide="${layer.visible ? 'eye' : 'eye-off'}"></i>
        </button>
        <span class="layer-name">${layer.name}</span>
      `;

      // Active switch
      li.addEventListener('click', (e) => {
        if (!e.target.closest('.layer-visibility')) {
          setActiveLayer(layer.id);
        }
      });

      // Visibility Toggle
      li.querySelector('.layer-visibility').addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        layer.canvas.style.display = layer.visible ? 'block' : 'none';
        renderLayersList();
      });

      layersListMount.appendChild(li);
    });
    lucide.createIcons();
  }

  function setActiveLayer(id) {
    const match = layers.find(l => l.id === id);
    if (match) {
      activeLayer = match;
      renderLayersList();
    }
  }

  // --- HSV Color Wheel Rendering ---
  const colorWheel = document.getElementById('color-wheel');
  const wheelCtx = colorWheel.getContext('2d');
  const wheelPicker = document.getElementById('wheel-picker');
  const activeColorPreview = document.getElementById('active-color-preview');
  
  const rInput = document.getElementById('color-r');
  const gInput = document.getElementById('color-g');
  const bInput = document.getElementById('color-b');

  function drawColorWheel() {
    const cx = colorWheel.width / 2;
    const cy = colorWheel.height / 2;
    const radius = colorWheel.width / 2 - 2;

    for (let y = 0; y < colorWheel.height; y++) {
      for (let x = 0; x < colorWheel.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= radius) {
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angle < 0) angle += 360;

          const hue = angle;
          const saturation = dist / radius;
          const value = 1.0;

          // Convert HSV to HSL for canvas draw
          const l = (2 - saturation) * value / 2;
          const s = l && l < 1 ? saturation * value / (l < 0.5 ? l * 2 : 2 - l * 2) : saturation;

          wheelCtx.fillStyle = `hsl(${hue}, ${s * 100}%, ${l * 100}%)`;
          wheelCtx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  function handleColorWheelClick(e) {
    const rect = colorWheel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cx = colorWheel.width / 2;
    const cy = colorWheel.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const radius = colorWheel.width / 2 - 2;

    if (dist <= radius) {
      // Position picker dot
      wheelPicker.style.left = `${x}px`;
      wheelPicker.style.top = `${y}px`;

      // Read RGB color directly from clicked pixel coordinate
      const pixel = wheelCtx.getImageData(x, y, 1, 1).data;
      const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
      
      currentColor = hex;
      activeColorPreview.style.backgroundColor = hex;
      
      // Update inputs
      rInput.value = pixel[0];
      gInput.value = pixel[1];
      bInput.value = pixel[2];
    }
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function updateColorFromRGBInputs() {
    const r = Math.max(0, Math.min(255, parseInt(rInput.value, 10) || 0));
    const g = Math.max(0, Math.min(255, parseInt(gInput.value, 10) || 0));
    const b = Math.max(0, Math.min(255, parseInt(bInput.value, 10) || 0));

    currentColor = rgbToHex(r, g, b);
    activeColorPreview.style.backgroundColor = currentColor;
  }

  // Bind Color Wheel Events
  colorWheel.addEventListener('mousedown', (e) => {
    handleColorWheelClick(e);
    const onMouseMove = (moveEvent) => handleColorWheelClick(moveEvent);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  [rInput, gInput, bInput].forEach(inp => {
    inp.addEventListener('input', updateColorFromRGBInputs);
  });

  // --- Zoom & View Controls ---
  function updateZoomDisplay() {
    zoomPercentageText.textContent = `${Math.round(zoomScale * 100)}%`;
    canvasCard.style.transform = `scale(${zoomScale})`;
  }

  btnZoomIn.addEventListener('click', () => {
    if (zoomScale < 4.0) {
      zoomScale += 0.1;
      updateZoomDisplay();
    }
  });

  btnZoomOut.addEventListener('click', () => {
    if (zoomScale > 0.25) {
      zoomScale -= 0.1;
      updateZoomDisplay();
    }
  });

  btnResetView.addEventListener('click', () => {
    zoomScale = 1.0;
    updateZoomDisplay();
  });

  // --- Complex Drawing Engine with Stabilizer ---
  function getCanvasCoords(e) {
    const rect = tempCanvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Translate coordinates relative to the canvas aspect zoom
    return {
      x: (clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
    };
  }

  function startDrawingStroke(e) {
    if (!activeLayer.visible) return;
    
    // Hide text input overlay if active and clicking elsewhere
    if (currentTool !== 'text' && !canvasTextOverlay.classList.contains('hidden')) {
      commitTextStroke();
    }

    isDrawing = true;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
    
    // Initialize Stabilizer inputs
    pointsQueue = [];
    for (let i = 0; i < stabilizerLevel; i++) {
      pointsQueue.push({ x: coords.x, y: coords.y });
    }
    
    lastX = coords.x;
    lastY = coords.y;

    if (currentTool === 'pen' || currentTool === 'brush' || currentTool === 'eraser') {
      tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw initial spot on temp preview canvas
      tempCtx.beginPath();
      tempCtx.arc(coords.x, coords.y, currentSize / 2, 0, 2 * Math.PI);
      tempCtx.fillStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor;
      tempCtx.fill();
    } else if (currentTool === 'bucket') {
      floodFillActiveLayer(Math.floor(coords.x), Math.floor(coords.y), currentColor);
      saveHistoryState();
      isDrawing = false;
    } else if (currentTool === 'text') {
      showTextInputOverlay(e);
      isDrawing = false;
    }
  }

  function drawStrokeMovement(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);

    // Apply Stabilizer running average filter
    pointsQueue.push({ x: coords.x, y: coords.y });
    if (pointsQueue.length > stabilizerLevel) {
      pointsQueue.shift();
    }

    let smoothX = 0;
    let smoothY = 0;
    pointsQueue.forEach(pt => {
      smoothX += pt.x;
      smoothY += pt.y;
    });
    smoothX /= pointsQueue.length;
    smoothY /= pointsQueue.length;

    // Draw tools logic
    if (currentTool === 'pen') {
      // Draw segment onto temp canvas
      tempCtx.beginPath();
      tempCtx.moveTo(lastX, lastY);
      tempCtx.lineTo(smoothX, smoothY);
      tempCtx.strokeStyle = currentColor;
      tempCtx.lineWidth = currentSize;
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.globalCompositeOperation = 'source-over';
      tempCtx.stroke();
    } else if (currentTool === 'brush') {
      // Watercolor soft brush
      tempCtx.beginPath();
      tempCtx.moveTo(lastX, lastY);
      tempCtx.lineTo(smoothX, smoothY);
      
      // Create subtle wet edges
      tempCtx.strokeStyle = currentColor;
      tempCtx.lineWidth = currentSize;
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.globalAlpha = currentOpacity * 0.15; // lower opacity segments layered together
      tempCtx.globalCompositeOperation = 'source-over';
      tempCtx.stroke();
      tempCtx.globalAlpha = 1.0; // Reset
    } else if (currentTool === 'eraser') {
      // Eraser clears pixels on temp canvas (which will commit as destination-out overlay later)
      tempCtx.beginPath();
      tempCtx.moveTo(lastX, lastY);
      tempCtx.lineTo(smoothX, smoothY);
      tempCtx.strokeStyle = 'rgba(0,0,0,1)';
      tempCtx.lineWidth = currentSize;
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.globalCompositeOperation = 'source-over';
      tempCtx.stroke();
    } else if (currentTool === 'rect') {
      // Shapes preview draws on fresh temp canvas every tick
      tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      tempCtx.beginPath();
      tempCtx.rect(startX, startY, coords.x - startX, coords.y - startY);
      tempCtx.strokeStyle = currentColor;
      tempCtx.lineWidth = currentSize;
      tempCtx.stroke();
    } else if (currentTool === 'circle') {
      tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      tempCtx.beginPath();
      const radius = Math.sqrt(Math.pow(coords.x - startX, 2) + Math.pow(coords.y - startY, 2));
      tempCtx.arc(startX, startY, radius, 0, 2 * Math.PI);
      tempCtx.strokeStyle = currentColor;
      tempCtx.lineWidth = currentSize;
      tempCtx.stroke();
    }

    lastX = smoothX;
    lastY = smoothY;
  }

  function commitStrokeDraw() {
    if (!isDrawing) return;
    isDrawing = false;

    // Draw temp canvas results onto active layer canvas
    const activeCtx = activeLayer.ctx;
    activeCtx.save();
    
    // Blending Mode
    activeCtx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : currentBlendMode;
    activeCtx.globalAlpha = currentTool === 'brush' ? 1.0 : currentOpacity; // Opacity handled within brush segment drawing
    
    activeCtx.drawImage(tempCanvas, 0, 0);
    activeCtx.restore();

    // Clear temp overlay canvas
    tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    saveHistoryState();
  }

  // Bind Canvas Pointer Listeners
  layersStack.addEventListener('mousedown', startDrawingStroke);
  document.addEventListener('mousemove', drawStrokeMovement);
  document.addEventListener('mouseup', commitStrokeDraw);

  layersStack.addEventListener('touchstart', startDrawingStroke, { passive: false });
  document.addEventListener('touchmove', drawStrokeMovement, { passive: false });
  document.addEventListener('touchend', commitStrokeDraw);

  // --- Paint Bucket Flood Fill Algorithm (Stack-based) ---
  function floodFillActiveLayer(startX, startY, fillColorHex) {
    const activeCtx = activeLayer.ctx;
    const imgData = activeCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;

    // Get color components
    const fillR = parseInt(fillColorHex.slice(1, 3), 16);
    const fillG = parseInt(fillColorHex.slice(3, 5), 16);
    const fillB = parseInt(fillColorHex.slice(5, 7), 16);
    const fillA = 255;

    const startIdx = (startY * CANVAS_WIDTH + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    // Avoid infinite loop if colors match
    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    const pixelStack = [[startX, startY]];

    while (pixelStack.length > 0) {
      const curr = pixelStack.pop();
      const x = curr[0];
      const y = curr[1];

      let pixelIdx = (y * CANVAS_WIDTH + x) * 4;

      // Move up to the top of the column
      while (y >= 0 && matchColor(pixelIdx, targetR, targetG, targetB, targetA, data)) {
        pixelIdx -= CANVAS_WIDTH * 4;
      }
      pixelIdx += CANVAS_WIDTH * 4;

      let reachLeft = false;
      let reachRight = false;

      // Move down coloring column
      for (let currY = y; currY < CANVAS_HEIGHT; currY++) {
        const idx = (currY * CANVAS_WIDTH + x) * 4;
        if (!matchColor(idx, targetR, targetG, targetB, targetA, data)) break;

        // Set pixel color
        data[idx] = fillR;
        data[idx + 1] = fillG;
        data[idx + 2] = fillB;
        data[idx + 3] = fillA;

        // Check left
        if (x > 0) {
          const leftIdx = idx - 4;
          if (matchColor(leftIdx, targetR, targetG, targetB, targetA, data)) {
            if (!reachLeft) {
              pixelStack.push([x - 1, currY]);
              reachLeft = true;
            }
          } else {
            reachLeft = false;
          }
        }

        // Check right
        if (x < CANVAS_WIDTH - 1) {
          const rightIdx = idx + 4;
          if (matchColor(rightIdx, targetR, targetG, targetB, targetA, data)) {
            if (!reachRight) {
              pixelStack.push([x + 1, currY]);
              reachRight = true;
            }
          } else {
            reachRight = false;
          }
        }
      }
    }

    activeCtx.putImageData(imgData, 0, 0);
  }

  function matchColor(idx, r, g, b, a, data) {
    // Exact match target color within threshold tolerance (20)
    const threshold = 20;
    return (
      Math.abs(data[idx] - r) <= threshold &&
      Math.abs(data[idx + 1] - g) <= threshold &&
      Math.abs(data[idx + 2] - b) <= threshold &&
      Math.abs(data[idx + 3] - a) <= threshold
    );
  }

  // --- Text Input Overlay Tool ---
  let textInputCoords = { x: 0, y: 0 };
  
  function showTextInputOverlay(e) {
    const coords = getCanvasCoords(e);
    textInputCoords = coords;

    const rect = tempCanvas.getBoundingClientRect();
    const styleScaleX = rect.width / CANVAS_WIDTH;
    const styleScaleY = rect.height / CANVAS_HEIGHT;

    canvasTextOverlay.style.left = `${coords.x * styleScaleX}px`;
    canvasTextOverlay.style.top = `${coords.y * styleScaleY}px`;
    canvasTextOverlay.style.fontSize = `${currentSize * 3 * styleScaleX}px`; // scale text input font dynamically
    canvasTextOverlay.style.color = currentColor;
    canvasTextOverlay.value = '';
    canvasTextOverlay.classList.remove('hidden');
    
    setTimeout(() => canvasTextOverlay.focus(), 50);
  }

  function commitTextStroke() {
    const val = canvasTextOverlay.value.trim();
    canvasTextOverlay.classList.add('hidden');

    if (val) {
      const activeCtx = activeLayer.ctx;
      activeCtx.save();
      activeCtx.font = `${currentSize * 3}px 'Inter', sans-serif`;
      activeCtx.fillStyle = currentColor;
      activeCtx.fillText(val, textInputCoords.x, textInputCoords.y + (currentSize * 2.5));
      activeCtx.restore();

      saveHistoryState();
    }
  }

  canvasTextOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitTextStroke();
    }
  });

  // --- Toolbar Icon Selectors ---
  const toolIcons = document.querySelectorAll('.tool-icon');
  toolIcons.forEach(icon => {
    icon.addEventListener('click', () => {
      toolIcons.forEach(i => i.classList.remove('active'));
      icon.classList.add('active');
      
      const id = icon.id.replace('tool-', '');
      currentTool = id;
      activeToolDisplay.textContent = `Tool: ${id.toUpperCase()}`;
    });
  });

  // --- Sidebar Property Slider Event listeners ---
  brushSizeInput.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value, 10);
    brushSizeVal.textContent = `${currentSize}px`;
  });

  brushOpacityInput.addEventListener('input', (e) => {
    currentOpacity = parseInt(e.target.value, 10) / 100;
    brushOpacityVal.textContent = `${e.target.value}%`;
  });

  brushStabilizerInput.addEventListener('input', (e) => {
    stabilizerLevel = parseInt(e.target.value, 10);
    brushStabilizerVal.textContent = stabilizerLevel;
  });

  blendModeSelect.addEventListener('change', (e) => {
    currentBlendMode = e.target.value;
  });

  // --- Layer Manager Actions ---
  document.getElementById('btn-add-layer').addEventListener('click', () => {
    const count = layers.length + 1;
    const layer = createLayer(`Layer ${count}`);
    setActiveLayer(layer.id);
    saveHistoryState();
  });

  document.getElementById('btn-delete-layer').addEventListener('click', () => {
    if (layers.length <= 1) {
      alert("At least one layer must remain in the project.");
      return;
    }
    
    // Remove element
    activeLayer.canvas.remove();
    layers = layers.filter(l => l.id !== activeLayer.id);
    
    // Set fallback active layer
    setActiveLayer(layers[layers.length - 1].id);
    saveHistoryState();
  });

  document.getElementById('btn-move-up').addEventListener('click', () => {
    const idx = layers.findIndex(l => l.id === activeLayer.id);
    if (idx !== -1 && idx < layers.length - 1) {
      // Swap order
      const temp = layers[idx];
      layers[idx] = layers[idx + 1];
      layers[idx + 1] = temp;
      
      // Update DOM stack order
      layersStack.insertBefore(layers[idx + 1].canvas, layers[idx].canvas);
      
      renderLayersList();
      saveHistoryState();
    }
  });

  document.getElementById('btn-move-down').addEventListener('click', () => {
    const idx = layers.findIndex(l => l.id === activeLayer.id);
    if (idx > 0) {
      // Swap order
      const temp = layers[idx];
      layers[idx] = layers[idx - 1];
      layers[idx - 1] = temp;
      
      // Update DOM stack order
      layersStack.insertBefore(layers[idx].canvas, layers[idx - 1].canvas);
      
      renderLayersList();
      saveHistoryState();
    }
  });

  // --- Top Menu Bar Trigger Handlers ---
  document.getElementById('menu-new').addEventListener('click', () => {
    if (confirm("Create a new project? Unsaved changes will be lost.")) {
      initLayers();
    }
  });

  document.getElementById('menu-clear').addEventListener('click', () => {
    activeLayer.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    saveHistoryState();
  });

  document.getElementById('menu-export').addEventListener('click', () => {
    // Merge layers onto temporary export canvas
    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = CANVAS_WIDTH;
    mergeCanvas.height = CANVAS_HEIGHT;
    const mergeCtx = mergeCanvas.getContext('2d');

    // Draw visible layers in stacking order
    layers.forEach(layer => {
      if (layer.visible) {
        mergeCtx.drawImage(layer.canvas, 0, 0);
      }
    });

    // Trigger download
    const link = document.createElement('a');
    link.download = 'aurora-project-export.png';
    link.href = mergeCanvas.toDataURL();
    link.click();
  });

  // --- Multi-Layer Workspace Undo/Redo Engine ---
  function saveHistoryState() {
    if (undoHistory.length >= maxHistorySteps) {
      undoHistory.shift();
    }
    
    // We capture snapshots of ALL layers in stacking order to restore correctly
    const snap = layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      data: layer.ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }));

    undoHistory.push(snap);
    redoHistory.length = 0; // Clear redo
  }

  function restoreHistorySnapshot(snapshot) {
    // Clear and rebuild canvas nodes to match history stack
    layersStack.innerHTML = '';
    
    // Reconstruct stack
    layers = snapshot.map(layerSnap => {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = CANVAS_WIDTH;
      newCanvas.height = CANVAS_HEIGHT;
      newCanvas.id = layerSnap.id;
      newCanvas.style.display = layerSnap.visible ? 'block' : 'none';
      layersStack.appendChild(newCanvas);

      const ctx = newCanvas.getContext('2d');
      ctx.putImageData(layerSnap.data, 0, 0);

      return {
        id: layerSnap.id,
        name: layerSnap.name,
        visible: layerSnap.visible,
        canvas: newCanvas,
        ctx: ctx
      };
    });

    // Reconstruct interaction canvas on top
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_WIDTH;
    tempCanvas.height = CANVAS_HEIGHT;
    tempCanvas.className = 'interaction-layer';
    layersStack.appendChild(tempCanvas);
    tempCtx = tempCanvas.getContext('2d');

    // Reset active layer link reference
    const currentActive = layers.find(l => l.id === activeLayer.id) || layers[layers.length - 1];
    setActiveLayer(currentActive.id);
  }

  document.getElementById('menu-undo').addEventListener('click', () => {
    if (undoHistory.length > 1) {
      const current = undoHistory.pop();
      redoHistory.push(current);
      const prev = undoHistory[undoHistory.length - 1];
      restoreHistorySnapshot(prev);
    }
  });

  document.getElementById('menu-redo').addEventListener('click', () => {
    if (redoHistory.length > 0) {
      const next = redoHistory.pop();
      undoHistory.push(next);
      restoreHistorySnapshot(next);
    }
  });

  // --- Image Filters (Raster Matrix Manipulations) ---
  document.getElementById('filter-invert').addEventListener('click', () => {
    const activeCtx = activeLayer.ctx;
    const imgData = activeCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];       // R
      data[i+1] = 255 - data[i+1];   // G
      data[i+2] = 255 - data[i+2];   // B
    }
    activeCtx.putImageData(imgData, 0, 0);
    saveHistoryState();
  });

  document.getElementById('filter-grayscale').addEventListener('click', () => {
    const activeCtx = activeLayer.ctx;
    const imgData = activeCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      data[i] = gray;
      data[i+1] = gray;
      data[i+2] = gray;
    }
    activeCtx.putImageData(imgData, 0, 0);
    saveHistoryState();
  });

  // Initialize
  drawColorWheel();
  initLayers();
});
