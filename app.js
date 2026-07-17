document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // --- SVG Artwork Path Dataset (Expressive vectors) ---
  const artworkData = {
    sakura: {
      viewBox: "0 0 400 300",
      paths: [
        // Mountain fuji background
        "M 50 250 L 150 120 L 180 150 L 250 80 L 350 250 Z",
        // Torii Gate - Left Pillar
        "M 130 250 L 130 110 L 120 110 L 120 100 L 140 100 L 140 250 Z",
        // Torii Gate - Right Pillar
        "M 270 250 L 270 110 L 260 110 L 260 100 L 280 100 L 280 250 Z",
        // Torii Gate - Lower Beam
        "M 100 130 L 300 130 L 300 140 L 100 140 Z",
        // Torii Gate - Upper Curved Roof
        "M 80 100 Q 200 80 320 100 L 310 115 Q 200 95 90 115 Z",
        // Center Tablet
        "M 188 105 L 212 105 L 212 130 L 188 130 Z",
        // Sakura Branch
        "M 30 50 Q 120 30 220 80",
        "M 100 42 Q 130 90 110 120",
        // Sakura Petals
        "M 130 50 C 135 45, 145 45, 140 55 C 135 65, 125 60, 130 50 Z",
        "M 190 70 C 195 65, 205 65, 200 75 C 195 85, 185 80, 190 70 Z",
        "M 250 140 C 255 135, 265 135, 260 145 C 255 155, 245 150, 250 140 Z",
        "M 220 190 C 225 185, 235 185, 230 195 C 225 205, 215 200, 220 190 Z"
      ]
    },
    ninja: {
      viewBox: "0 0 400 300",
      paths: [
        // Headband Border
        "M 100 100 L 300 100 L 290 70 L 110 70 Z",
        // Headband Ties (Left)
        "M 100 85 Q 50 80 40 120",
        "M 100 85 Q 60 110 35 155",
        // Metal Plate
        "M 150 75 L 250 75 L 245 95 L 155 95 Z",
        // Hidden Leaf Leaf Symbol
        "M 180 85 Q 200 75 220 85 Q 200 95 180 85 Z",
        "M 180 85 L 175 80",
        // Right Eye Outlines
        "M 215 130 Q 235 110 255 125",
        "M 218 135 Q 235 145 252 133",
        // Left Eye Outlines
        "M 145 125 Q 165 110 185 130",
        "M 148 133 Q 165 145 182 135",
        // Right Pupil
        "M 230 125 A 5 5 0 1 1 240 125 A 5 5 0 1 1 230 125 Z",
        // Left Pupil
        "M 160 128 A 5 5 0 1 1 170 128 A 5 5 0 1 1 160 128 Z",
        // Eyebrows / Angry Crease
        "M 140 110 L 175 122",
        "M 260 110 L 225 122",
        // Nose outline
        "M 195 140 L 200 155 L 192 158",
        // Mask / Face curve
        "M 115 100 C 110 160, 140 230, 200 260 C 260 230, 290 160, 285 100 Z",
        // Hair Spikes (Top Outlines)
        "M 110 70 L 80 40 L 130 50 L 150 15 L 180 45 L 210 10 L 240 45 L 270 20 L 290 55 L 320 30 L 300 70"
      ]
    },
    eye: {
      viewBox: "0 0 400 300",
      paths: [
        // Upper Eyelash curve (Thick manga line)
        "M 100 150 Q 200 80 300 150",
        "M 110 140 Q 200 90 290 140",
        // Lower Eyelash curve
        "M 130 180 Q 200 210 270 180",
        // Double Eyelid line
        "M 120 110 Q 200 65 280 110",
        // Outer Iris Circle
        "C 200 110, 250 110, 250 150 C 250 190, 200 190, 150 190 C 150 150, 150 110, 200 110 Z",
        // Inner Pupil Circle
        "M 185 150 A 15 15 0 1 1 215 150 A 15 15 0 1 1 185 150 Z",
        // Iris reflection details (large sparkle)
        "M 175 130 A 10 10 0 1 1 195 130 A 10 10 0 1 1 175 130 Z",
        // Iris reflection details (small sparkle)
        "M 215 165 A 5 5 0 1 1 225 165 A 5 5 0 1 1 215 165 Z",
        // Iris shading lines (lines radiating inwards)
        "M 160 140 L 180 145",
        "M 240 140 L 220 145",
        "M 165 170 L 182 160",
        "M 235 170 L 218 160",
        "M 200 115 L 200 130",
        "M 200 185 L 200 170",
        // Eyebrow Arch
        "M 90 80 Q 200 30 310 75 L 300 85 Q 200 45 100 90 Z"
      ]
    }
  };

  // --- Active State ---
  let selectedArtworkKey = 'sakura';
  let isTracingActive = true;
  let isDrawingAnimation = false;
  let activeTraceColor = '#ff4d6d';
  let activeTraceSize = 3;

  // --- DOM Elements ---
  const svgMount = document.getElementById('svg-mount');
  const traceCanvas = document.getElementById('trace-canvas');
  const ctx = traceCanvas.getContext('2d');
  
  const btnPlay = document.getElementById('btn-play');
  const btnClear = document.getElementById('btn-clear');
  const btnToggleTrace = document.getElementById('btn-toggle-trace');
  
  const traceSettings = document.getElementById('trace-settings');
  const traceBrushSlider = document.getElementById('trace-brush-size');
  
  const drawingTip = document.getElementById('drawing-tip');
  const floatingSfx = document.getElementById('floating-sfx');

  // --- Tracing Canvas Sizing & Logic ---
  function resizeTraceCanvas() {
    const rect = traceCanvas.getBoundingClientRect();
    traceCanvas.width = rect.width;
    traceCanvas.height = rect.height;
    
    // Reset canvas configurations
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = activeTraceSize;
    ctx.strokeStyle = activeTraceColor;
  }

  window.addEventListener('resize', resizeTraceCanvas);
  resizeTraceCanvas();

  // --- Tracing Drawing Code ---
  let isDrawingUser = false;
  let lastX = 0;
  let lastY = 0;

  function getMouseCoords(e) {
    const rect = traceCanvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startTraceDraw(e) {
    if (!isTracingActive || isDrawingAnimation) return;
    isDrawingUser = true;
    const coords = getMouseCoords(e);
    lastX = coords.x;
    lastY = coords.y;
  }

  function traceDraw(e) {
    if (!isDrawingUser) return;
    e.preventDefault();
    const coords = getMouseCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = activeTraceColor;
    ctx.lineWidth = activeTraceSize;
    ctx.stroke();

    lastX = coords.x;
    lastY = coords.y;
  }

  function stopTraceDraw() {
    isDrawingUser = false;
  }

  // Bind trace canvas events
  traceCanvas.addEventListener('mousedown', startTraceDraw);
  traceCanvas.addEventListener('mousemove', traceDraw);
  traceCanvas.addEventListener('mouseup', stopTraceDraw);
  traceCanvas.addEventListener('mouseleave', stopTraceDraw);

  traceCanvas.addEventListener('touchstart', startTraceDraw, { passive: false });
  traceCanvas.addEventListener('touchmove', traceDraw, { passive: false });
  traceCanvas.addEventListener('touchend', stopTraceDraw);

  // Trace tools
  document.querySelectorAll('.trace-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.trace-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      activeTraceColor = swatch.getAttribute('data-color');
    });
  });

  traceBrushSlider.addEventListener('input', (e) => {
    activeTraceSize = parseInt(e.target.value, 10);
  });

  // Toggle Trace Mode
  btnToggleTrace.addEventListener('click', () => {
    isTracingActive = !isTracingActive;
    if (isTracingActive) {
      btnToggleTrace.textContent = 'Active';
      btnToggleTrace.className = 'toggle-switch';
      traceSettings.classList.add('active');
      traceCanvas.style.pointerEvents = 'all';
    } else {
      btnToggleTrace.textContent = 'Inactive';
      btnToggleTrace.className = 'toggle-switch inactive';
      traceSettings.classList.remove('active');
      traceCanvas.style.pointerEvents = 'none';
      stopTraceDraw();
    }
  });

  // Trigger default active settings on load
  traceSettings.classList.add('active');

  // --- SVG Dynamic Drawing Animation System ---
  let animationQueue = [];
  let currentPathIndex = 0;
  let drawRafId = null;

  function loadArtwork(key) {
    // Reset any active animations
    cancelAnimationFrame(drawRafId);
    isDrawingAnimation = false;
    drawingTip.style.display = 'none';

    selectedArtworkKey = key;
    const art = artworkData[key];
    
    // Construct SVG container
    svgMount.innerHTML = `
      <svg viewBox="${art.viewBox}" xmlns="http://www.w3.org/2000/svg">
        ${art.paths.map((p, idx) => `
          <path id="path-${idx}" class="sketch-path" d="${p}" />
        `).join('')}
      </svg>
    `;

    // Initialize all paths as transparent
    const paths = svgMount.querySelectorAll('path');
    paths.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
  }

  function playDrawingAnimation() {
    if (isDrawingAnimation) return;
    
    // Clear user drawings to focus on the animation
    ctx.clearRect(0, 0, traceCanvas.width, traceCanvas.height);

    isDrawingAnimation = true;
    btnPlay.disabled = true;
    drawingTip.style.display = 'block';

    const paths = Array.from(svgMount.querySelectorAll('path'));
    currentPathIndex = 0;

    // Reset offsets
    paths.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDashoffset = len;
    });

    animateNextPath(paths);
  }

  function animateNextPath(paths) {
    if (currentPathIndex >= paths.length) {
      // Completed Drawing Animation!
      isDrawingAnimation = false;
      btnPlay.disabled = false;
      drawingTip.style.display = 'none';
      return;
    }

    const path = paths[currentPathIndex];
    const len = path.getTotalLength();
    let currentOffset = len;
    const speed = len / 40; // Adjust for uniform drawing rate

    function step() {
      if (currentOffset <= 0) {
        path.style.strokeDashoffset = 0;
        currentPathIndex++;
        animateNextPath(paths);
        return;
      }

      currentOffset -= speed;
      path.style.strokeDashoffset = Math.max(0, currentOffset);

      // Stylus Pen Tip Tracking
      const progress = len - currentOffset;
      try {
        const point = path.getPointAtLength(progress);
        
        // Convert SVG viewport coordinates into screen pixels
        const svgEl = svgMount.querySelector('svg');
        const svgRect = svgEl.getBoundingClientRect();
        const panelRect = document.getElementById('manga-panel-element').getBoundingClientRect();

        const scaleX = svgRect.width / 400; // viewBox width 400
        const scaleY = svgRect.height / 300; // viewBox height 300

        // Relative to the manga-panel element
        const screenX = (svgRect.left - panelRect.left) + point.x * scaleX;
        const screenY = (svgRect.top - panelRect.top) + point.y * scaleY;

        drawingTip.style.left = `${screenX}px`;
        drawingTip.style.top = `${screenY}px`;
      } catch (err) {
        // getPointAtLength fallback
      }

      drawRafId = requestAnimationFrame(step);
    }

    drawRafId = requestAnimationFrame(step);
  }

  // Bind Buttons
  btnPlay.addEventListener('click', playDrawingAnimation);
  
  btnClear.addEventListener('click', () => {
    ctx.clearRect(0, 0, traceCanvas.width, traceCanvas.height);
    loadArtwork(selectedArtworkKey);
  });

  // Switch Art selection
  document.querySelectorAll('.artwork-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.artwork-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sketchKey = btn.getAttribute('data-sketch');
      loadArtwork(sketchKey);
    });
  });

  // --- Manga Sound Effects (ゴゴゴ, ドン, スッ) ---
  document.querySelectorAll('.sfx-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const sfx = btn.textContent.split(' ')[0];
      
      // Update text and classes
      floatingSfx.textContent = sfx;
      floatingSfx.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
      floatingSfx.style.top = `${50 + (Math.random() - 0.5) * 30}%`;
      
      floatingSfx.classList.add('active');
      setTimeout(() => {
        floatingSfx.classList.remove('active');
      }, 800);
    });
  });

  // Initial Load
  loadArtwork(selectedArtworkKey);
});
