document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // --- Canvas Setup ---
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas.getContext('2d');
  const wrapper = document.getElementById('canvas-wrapper');

  // Set canvas scale relative to backing store
  function resizeCanvas() {
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    // Redraw the history stack if needed
    restoreState();
  }
  
  // --- Drawing State ---
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentTool = 'brush'; // 'brush', 'rect', 'circle', 'eraser'
  let currentColor = '#ff758f';
  let currentSize = 5;
  
  // History Stacks for Undo/Redo
  const undoStack = [];
  const redoStack = [];
  const maxStackSize = 30;

  // Save current canvas state
  function saveState() {
    if (undoStack.length >= maxStackSize) {
      undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack.length = 0; // Clear redo on new action
    
    // Trigger AI suggestion update
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

  // Initialize
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Capture initial state (empty canvas)
  saveState();

  // --- Drawing Core Logic ---
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function startDraw(e) {
    isDrawing = true;
    const coords = getCoordinates(e);
    startX = coords.x;
    startY = coords.y;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentTool === 'eraser' ? '#12131a' : currentColor;
    
    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.lineTo(startX, startY);
      ctx.stroke();
    }
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);

    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else {
      // Shapes (requires drawing temporary preview on top of previous state)
      restoreState();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = currentSize;
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
    ctx.closePath();
    saveState();
  }

  // Mouse & Touch Event Listeners
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', startDraw);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDraw);

  // --- Toolbar Controls ---
  
  // Tools selection
  document.getElementById('tool-brush').addEventListener('click', (e) => setTool('brush', e.currentTarget));
  document.getElementById('tool-eraser').addEventListener('click', (e) => setTool('eraser', e.currentTarget));
  document.getElementById('tool-rect').addEventListener('click', (e) => setTool('rect', e.currentTarget));
  document.getElementById('tool-circle').addEventListener('click', (e) => setTool('circle', e.currentTarget));

  function setTool(tool, button) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
  }

  // Color picker popover
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

  // Brush Size slider popover
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

  // Dismiss popovers on click outside
  document.addEventListener('click', () => {
    colorPopover.classList.remove('active');
    sizePopover.classList.remove('active');
  });
  
  colorPopover.addEventListener('click', (e) => e.stopPropagation());
  sizePopover.addEventListener('click', (e) => e.stopPropagation());

  // History controls
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (undoStack.length > 1) { // Leave the base empty state
      const state = undoStack.pop();
      redoStack.push(state);
      restoreState();
      triggerAISuggestion();
    }
  });

  document.getElementById('btn-redo').addEventListener('click', () => {
    if (redoStack.length > 0) {
      const state = redoStack.pop();
      undoStack.push(state);
      restoreState();
      triggerAISuggestion();
    }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  });

  // Share and Export
  document.getElementById('btn-export').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'aurora-canvas.png';
    link.href = canvas.toDataURL();
    link.click();
  });

  document.getElementById('btn-share').addEventListener('click', () => {
    alert('📋 Collaboration link copied to clipboard!');
  });

  // --- Mock Collaboration Cursors & Drawing ---
  const cursors = {
    yuki: { el: document.getElementById('cursor-yuki'), x: 100, y: 150, targetX: 100, targetY: 150, phase: 0 },
    alex: { el: document.getElementById('cursor-alex'), x: 300, y: 250, targetX: 300, targetY: 250, phase: Math.PI / 3 },
    chloe: { el: document.getElementById('cursor-chloe'), x: 500, y: 350, targetX: 500, targetY: 350, phase: Math.PI * (2/3) }
  };

  function updateCursors(time) {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;

    for (const key in cursors) {
      const c = cursors[key];
      c.phase += 0.005;
      
      // Let cursors wander smoothly using trigonometric pathing
      const ampX = w * 0.35;
      const ampY = h * 0.35;
      
      c.targetX = w / 2 + Math.sin(c.phase) * ampX + Math.cos(c.phase * 0.7) * 40;
      c.targetY = h / 2 + Math.cos(c.phase * 1.2) * ampY + Math.sin(c.phase * 0.5) * 40;

      // Soft lerp positions to filter movement jitter
      c.x += (c.targetX - c.x) * 0.05;
      c.y += (c.targetY - c.y) * 0.05;

      c.el.style.left = `${c.x}px`;
      c.el.style.top = `${c.y}px`;
    }
    requestAnimationFrame(updateCursors);
  }
  
  // Start cursor animation loop
  requestAnimationFrame(updateCursors);

  // Programmatic Drawing (Yuki or Alex occasionally drawing lines!)
  let drawTimer = 0;
  function simulateRemoteDrawing() {
    if (!isDrawing && Math.random() < 0.25) { // 25% chance every few seconds
      const designers = ['yuki', 'alex', 'chloe'];
      const activeDesigner = designers[Math.floor(Math.random() * designers.length)];
      const cursor = cursors[activeDesigner];
      
      ctx.beginPath();
      ctx.moveTo(cursor.x, cursor.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4 + Math.random() * 4;
      ctx.strokeStyle = activeDesigner === 'yuki' ? '#ff0055' : (activeDesigner === 'alex' ? '#00d4ff' : '#ffb700');
      
      // Draw a tiny wiggle stroke
      const length = 5 + Math.floor(Math.random() * 10);
      let curX = cursor.x;
      let curY = cursor.y;
      for (let step = 0; step < length; step++) {
        curX += (Math.random() - 0.5) * 20;
        curY += (Math.random() - 0.5) * 15;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();
      ctx.closePath();
      
      // Trigger undo save point
      saveState();
    }
    setTimeout(simulateRemoteDrawing, 5000);
  }

  // Trigger collaboration drawing wiggles
  setTimeout(simulateRemoteDrawing, 4000);

  // --- AI Design Suggestions (Reactive Mock) ---
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
    // Pulse animation on card
    aiDynamicCard.classList.add('gradient-border');
    aiIdeaText.style.opacity = 0.5;
    
    setTimeout(() => {
      // Pick a random creative layout suggestion
      const prompt = aiPrompts[Math.floor(Math.random() * aiPrompts.length)];
      aiIdeaText.textContent = prompt;
      aiIdeaText.style.opacity = 1;
    }, 400);
  }

  // Trigger apply suggestion palette
  document.querySelector('.apply-btn').addEventListener('click', () => {
    currentColor = '#ff758f'; // Primary strip color
    colorBtn.style.backgroundColor = currentColor;
    alert('🎨 Color Palette applied! Brush color set to Soft Pink.');
  });
});
