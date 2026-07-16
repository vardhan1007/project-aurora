document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // --- Canvas Setup ---
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvas-wrapper');

  // --- Drawing State ---
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let currentTool = 'brush'; // 'brush', 'rect', 'circle', 'eraser'
  let currentColor = '#ff758f';
  let currentSize = 5;
  
  // History Stacks
  const undoStack = [];
  const redoStack = [];
  const maxStackSize = 30;
  let snapshotBeforeStroke = null;

  // Save current canvas state to history
  function saveState() {
    if (undoStack.length >= maxStackSize) {
      undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack.length = 0; // Clear redo
    triggerAISuggestion();
  }

  // Restore the last saved state
  function restoreState() {
    if (undoStack.length > 0) {
      ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Save snapshot before a shape drag starts
  function saveSnapshotBeforeStroke() {
    snapshotBeforeStroke = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function restoreSnapshotBeforeStroke() {
    if (snapshotBeforeStroke) {
      ctx.putImageData(snapshotBeforeStroke, 0, 0);
    }
  }

  // Use ResizeObserver for absolute robustness on initial loads and layout updates
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const w = Math.floor(entry.contentRect.width) || 800;
      const h = Math.floor(entry.contentRect.height) || 600;
      
      if (canvas.width !== w || canvas.height !== h) {
        // Save current contents
        let tempImage = null;
        if (canvas.width > 0 && canvas.height > 0) {
          try {
            tempImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (e) {
            console.warn("Could not save image data before resize:", e);
          }
        }

        canvas.width = w;
        canvas.height = h;

        // Restore content
        if (tempImage) {
          try {
            ctx.putImageData(tempImage, 0, 0);
          } catch (e) {
            console.warn("Could not restore image data directly, using fallback:", e);
          }
        }

        // Re-apply context configurations
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = currentSize;
        ctx.strokeStyle = currentColor;

        // If history is empty, save the first empty state
        if (undoStack.length === 0) {
          saveState();
        }
      }
    }
  });

  resizeObserver.observe(wrapper);

  // --- Coordinates Mapping ---
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    
    // Scale factors to handle mismatch between CSS dimensions and internal canvas dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // --- Drawing Handlers ---
  function startDraw(e) {
    isDrawing = true;
    const coords = getCoordinates(e);
    startX = coords.x;
    startY = coords.y;
    lastX = coords.x;
    lastY = coords.y;

    saveSnapshotBeforeStroke();

    // Set configuration values for the stroke
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentTool === 'eraser' ? '#0b0c10' : currentColor; // Match background color for eraser

    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentSize;

    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = currentTool === 'eraser' ? '#0b0c10' : currentColor;
      ctx.stroke();
      
      // Update last point
      lastX = coords.x;
      lastY = coords.y;
    } else {
      // Shapes preview restoration
      restoreSnapshotBeforeStroke();
      ctx.beginPath();
      ctx.strokeStyle = currentColor;

      if (currentTool === 'rect') {
        const w = coords.x - startX;
        const h = coords.y - startY;
        ctx.strokeRect(startX, startY, w, h);
      } else if (currentTool === 'circle') {
        const r = Math.sqrt(Math.pow(coords.x - startX, 2) + Math.pow(coords.y - startY, 2));
        ctx.arc(startX, startY, r, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function stopDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    saveState();
  }

  // Event Listeners (Bound directly to canvas for crisp coordinate detection)
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  // --- Toolbar Controls ---
  document.getElementById('tool-brush').addEventListener('click', (e) => setTool('brush', e.currentTarget));
  document.getElementById('tool-eraser').addEventListener('click', (e) => setTool('eraser', e.currentTarget));
  document.getElementById('tool-rect').addEventListener('click', (e) => setTool('rect', e.currentTarget));
  document.getElementById('tool-circle').addEventListener('click', (e) => setTool('circle', e.currentTarget));

  function setTool(tool, button) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
  }

  // Color Palette Popover
  const colorBtn = document.getElementById('btn-color');
  const colorPopover = document.querySelector('.color-palette-popover');
  
  colorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    colorPopover.classList.toggle('active');
    sizePopover.classList.remove('active');
  });

  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      currentColor = swatch.getAttribute('data-color');
      colorBtn.style.backgroundColor = currentColor;
      
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      colorPopover.classList.remove('active');
    });
  });

  // Brush Size popover
  const sizeBtn = document.getElementById('btn-size');
  const sizePopover = document.querySelector('.size-slider-popover');
  const sizeSlider = document.getElementById('brush-size');
  const sizeVal = document.getElementById('size-val');

  sizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sizePopover.classList.toggle('active');
    colorPopover.classList.remove('active');
  });

  sizeSlider.addEventListener('input', (e) => {
    currentSize = e.target.value;
    sizeVal.textContent = `${currentSize}px`;
  });

  // Dismiss popovers
  document.addEventListener('click', () => {
    colorPopover.classList.remove('active');
    sizePopover.classList.remove('active');
  });
  
  colorPopover.addEventListener('click', (e) => e.stopPropagation());
  sizePopover.addEventListener('click', (e) => e.stopPropagation());

  // History controls
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (undoStack.length > 1) {
      const state = undoStack.pop();
      redoStack.push(state);
      restoreState();
    }
  });

  document.getElementById('btn-redo').addEventListener('click', () => {
    if (redoStack.length > 0) {
      const state = redoStack.pop();
      undoStack.push(state);
      restoreState();
    }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  });

  // Export & Share
  document.getElementById('btn-export').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'aurora-whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  });

  document.getElementById('btn-share').addEventListener('click', () => {
    alert('📋 Collaborative board link copied to clipboard!');
  });

  // --- Collaborative Cursors & Drawing ---
  const cursors = {
    yuki: { el: document.getElementById('cursor-yuki'), x: 100, y: 150, targetX: 100, targetY: 150, phase: 0 },
    alex: { el: document.getElementById('cursor-alex'), x: 300, y: 250, targetX: 300, targetY: 250, phase: Math.PI / 3 },
    chloe: { el: document.getElementById('cursor-chloe'), x: 500, y: 350, targetX: 500, targetY: 350, phase: Math.PI * (2/3) }
  };

  function updateCursors() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    for (const key in cursors) {
      const c = cursors[key];
      c.phase += 0.003;

      const ampX = w * 0.35;
      const ampY = h * 0.35;
      
      c.targetX = w / 2 + Math.sin(c.phase) * ampX + Math.cos(c.phase * 0.7) * 40;
      c.targetY = h / 2 + Math.cos(c.phase * 1.2) * ampY + Math.sin(c.phase * 0.5) * 40;

      c.x += (c.targetX - c.x) * 0.05;
      c.y += (c.targetY - c.y) * 0.05;

      c.el.style.left = `${c.x}px`;
      c.el.style.top = `${c.y}px`;
    }
    requestAnimationFrame(updateCursors);
  }
  
  requestAnimationFrame(updateCursors);

  // Collaborative drawings
  function simulateRemoteDrawing() {
    if (!isDrawing && Math.random() < 0.25) {
      const designers = ['yuki', 'alex', 'chloe'];
      const activeDesigner = designers[Math.floor(Math.random() * designers.length)];
      const cursor = cursors[activeDesigner];
      
      ctx.beginPath();
      ctx.moveTo(cursor.x, cursor.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4 + Math.random() * 4;
      ctx.strokeStyle = activeDesigner === 'yuki' ? '#ff0055' : (activeDesigner === 'alex' ? '#00d4ff' : '#ffb700');
      
      const length = 5 + Math.floor(Math.random() * 8);
      let curX = cursor.x;
      let curY = cursor.y;
      for (let step = 0; step < length; step++) {
        curX += (Math.random() - 0.5) * 15;
        curY += (Math.random() - 0.5) * 12;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
      ctx.closePath();
      
      saveState();
    }
    setTimeout(simulateRemoteDrawing, 6000);
  }

  setTimeout(simulateRemoteDrawing, 3000);

  // --- AI Design Suggestions (Reactive) ---
  const aiPrompts = [
    "Suggested: Your drawing is abstract. Let's auto-clean the border spacing and center your element to match UX grid alignment.",
    "Recognized brush stroke: soft curves. Suggested action: convert your curves into high-fidelity layout blocks.",
    "Recognized organic shape. Suggested action: Add an amber accent glow to create visual depth in your sketch.",
    "Detected high density of sketches. Suggested: Group these shapes into a single component layer.",
    "Suggested: Try adding a neon cyan accent line at the bottom boundary to balance the bright pink color theme."
  ];

  const aiIdeaText = document.getElementById('ai-idea-text');
  const aiDynamicCard = document.getElementById('ai-dynamic-prompt');

  function triggerAISuggestion() {
    aiDynamicCard.classList.add('gradient-border');
    aiIdeaText.style.opacity = 0.5;
    
    setTimeout(() => {
      const prompt = aiPrompts[Math.floor(Math.random() * aiPrompts.length)];
      aiIdeaText.textContent = prompt;
      aiIdeaText.style.opacity = 1;
    }, 400);
  }

  document.querySelector('.apply-btn').addEventListener('click', () => {
    currentColor = '#ff758f';
    colorBtn.style.backgroundColor = currentColor;
    alert('🎨 Color Palette applied! Brush color set to Soft Pink.');
  });
});
