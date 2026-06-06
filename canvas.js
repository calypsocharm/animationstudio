/* ==========================================================================
   STARBY ANIMATION STUDIO - CANVAS CONTROLLER
   ========================================================================== */

import { getResolvedElementState } from './engine.js';
import { particles } from './particles.js';

export class CanvasController {
  constructor(viewportId, containerId, overlayId, onSelectionChanged, onElementModified) {
    this.viewport = document.getElementById(viewportId);
    this.container = document.getElementById(containerId);
    this.overlay = document.getElementById(overlayId);
    this.onSelectionChanged = onSelectionChanged;
    this.onElementModified = onElementModified;

    this.selectedElementId = null;
    this.elements = [];
    this.currentTime = 0;
    this.duration = 5;
    this.fps = 30;
    this.zoom = 1;
    this.snapToGrid = true;
    this.gridSize = 10;
    
    this.onionSkinEnabled = false;

    // Drag and transform variables
    this.isDragging = false;
    this.isTransforming = false;
    this.transformType = null; // 'drag', 'rotate', 'tl', 'tr', 'bl', 'br', 'l', 'r', 't', 'b', 'pivot'
    this.dragStart = { x: 0, y: 0 };
    this.elementStart = {};
    
    this.initEvents();
    
    // Initialize magical particle overlay
    setTimeout(() => particles.init('canvas-stage-wrapper'), 100);
  }

  setElements(elements) {
    this.elements = elements;
    this.render();
  }

  setCurrentTime(time) {
    this.currentTime = time;
    this.render();
    this.updateTransformOverlay();
  }

  setDuration(duration) {
    this.duration = duration;
  }

  setFPS(fps) {
    this.fps = fps;
  }

  setOnionSkin(enabled) {
    this.onionSkinEnabled = enabled;
    this.render();
  }

  setZoom(zoom) {
    this.zoom = zoom;
    const stage = document.getElementById('canvas-stage-wrapper');
    if (stage) {
      stage.style.transform = `scale(${zoom})`;
    }
  }

  setSnapToGrid(snap) {
    this.snapToGrid = snap;
  }

  selectElement(id) {
    this.selectedElementId = id;
    this.render();
    this.updateTransformOverlay();
    this.onSelectionChanged(id);
  }

  initEvents() {
    // Stage-wide clicks and drags
    this.container.addEventListener('mousedown', (e) => {
      // Clear selection if clicking empty canvas space
      if (e.target === this.container || e.target.classList.contains('grid-backdrop')) {
        this.selectElement(null);
        return;
      }
      
      const elNode = e.target.closest('.canvas-element');
      if (elNode && !elNode.classList.contains('onion-skin-ghost')) {
        const id = parseInt(elNode.dataset.id);
        this.selectElement(id);
        
        // Start dragging
        const el = this.elements.find(x => x.id === id);
        if (el && !el.locked) {
          const state = getResolvedElementState(el, this.elements, this.currentTime);
          this.isDragging = true;
          this.transformType = 'drag';
          this.dragStart = { x: e.clientX, y: e.clientY };
          this.elementStart = { ...state };
          e.preventDefault();
        }
      }
    });

    // Handle button transform starts
    this.overlay.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.handle');
      if (!handle || !this.selectedElementId) return;

      e.stopPropagation();
      e.preventDefault();

      const el = this.elements.find(x => x.id === this.selectedElementId);
      if (!el || el.locked) return;

      const state = getResolvedElementState(el, this.elements, this.currentTime);
      this.isTransforming = true;
      this.transformType = handle.dataset.handle;
      this.dragStart = { x: e.clientX, y: e.clientY };
      
      // Compute center coordinates for rotation/pivot calculations
      const stageRect = document.getElementById('canvas-stage-wrapper').getBoundingClientRect();
      const centerStageX = stageRect.left + state.x * this.zoom;
      const centerStageY = stageRect.top + state.y * this.zoom;
      
      this.elementStart = { 
        ...state,
        centerX: centerStageX,
        centerY: centerStageY,
        angleStart: Math.atan2(e.clientY - centerStageY, e.clientX - centerStageX) * (180 / Math.PI)
      };
    });

    // Global drag moves
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.selectedElementId) {
        this.handleDragMove(e);
        
        // Emit sparkles at mouse coords scaled by zoom
        const rect = this.container.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / this.zoom;
        const my = (e.clientY - rect.top) / this.zoom;
        particles.emitSparkle(mx, my, 1);
      } else if (this.isTransforming && this.selectedElementId) {
        this.handleTransformMove(e);
        
        const rect = this.container.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / this.zoom;
        const my = (e.clientY - rect.top) / this.zoom;
        particles.emitSparkle(mx, my, 1);
      }
    });

    // Drag stops
    window.addEventListener('mouseup', () => {
      if (this.isDragging || this.isTransforming) {
        this.isDragging = false;
        this.isTransforming = false;
        this.transformType = null;
        
        const el = this.elements.find(x => x.id === this.selectedElementId);
        if (el) {
          this.onElementModified(el);
        }
      }
    });
  }

  handleDragMove(e) {
    const el = this.elements.find(x => x.id === this.selectedElementId);
    if (!el) return;

    // Translate client movement scaled by zoom factor
    let dx = (e.clientX - this.dragStart.x) / this.zoom;
    let dy = (e.clientY - this.dragStart.y) / this.zoom;

    let newX = this.elementStart.x + dx;
    let newY = this.elementStart.y + dy;

    if (this.snapToGrid) {
      newX = Math.round(newX / this.gridSize) * this.gridSize;
      newY = Math.round(newY / this.gridSize) * this.gridSize;
    }

    // Lock position boundary logic
    newX = Math.max(-100, Math.min(900, newX));
    newY = Math.max(-100, Math.min(600, newY));

    // Write directly into active state
    this.updateElementProperty(el, 'x', newX);
    this.updateElementProperty(el, 'y', newY);

    this.render();
    this.updateTransformOverlay();
  }

  handleTransformMove(e) {
    const el = this.elements.find(x => x.id === this.selectedElementId);
    if (!el) return;

    const start = this.elementStart;
    const zoom = this.zoom;

    if (this.transformType === 'rotate') {
      // Rotation relative to center
      const currentAngle = Math.atan2(e.clientY - start.centerY, e.clientX - start.centerX) * (180 / Math.PI);
      let angleDiff = currentAngle - start.angleStart;
      let newRotation = start.rotation + angleDiff;

      if (this.snapToGrid) {
        // Snap to 15 degree intervals
        newRotation = Math.round(newRotation / 15) * 15;
      }
      
      this.updateElementProperty(el, 'rotation', Math.round(newRotation));
    } else if (this.transformType === 'pivot') {
      // Shifting the joint rotation center point
      const stageRect = document.getElementById('canvas-stage-wrapper').getBoundingClientRect();
      const mouseStageX = (e.clientX - stageRect.left) / zoom;
      const mouseStageY = (e.clientY - stageRect.top) / zoom;

      // Rotate mouse position back to unrotated element space
      const dx = mouseStageX - start.x;
      const dy = mouseStageY - start.y;
      const rad = -start.rotation * (Math.PI / 180);
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

      // Convert local coordinate to top-left boundary percentages
      let newPivotX = ((localX + start.width / 2) / start.width) * 100;
      let newPivotY = ((localY + start.height / 2) / start.height) * 100;

      // Clamp
      newPivotX = Math.max(0, Math.min(100, newPivotX));
      newPivotY = Math.max(0, Math.min(100, newPivotY));

      this.updateElementProperty(el, 'pivotX', Math.round(newPivotX));
      this.updateElementProperty(el, 'pivotY', Math.round(newPivotY));
    } else {
      // Scale and resize calculations
      let dx = (e.clientX - this.dragStart.x) / zoom;
      let dy = (e.clientY - this.dragStart.y) / zoom;

      // Rotate delta to match shape space orientation
      const rad = -start.rotation * (Math.PI / 180);
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

      let newWidth = start.width;
      let newHeight = start.height;

      const type = this.transformType;
      
      if (type === 'r') {
        newWidth = Math.max(10, start.width + rx);
      } else if (type === 'l') {
        newWidth = Math.max(10, start.width - rx);
        const offsetRad = start.rotation * (Math.PI / 180);
        const shiftX = (rx / 2) * Math.cos(offsetRad);
        const shiftY = (rx / 2) * Math.sin(offsetRad);
        this.updateElementProperty(el, 'x', start.x + shiftX);
        this.updateElementProperty(el, 'y', start.y + shiftY);
      } else if (type === 'b') {
        newHeight = Math.max(10, start.height + ry);
      } else if (type === 't') {
        newHeight = Math.max(10, start.height - ry);
        const offsetRad = start.rotation * (Math.PI / 180);
        const shiftX = (-ry / 2) * Math.sin(offsetRad);
        const shiftY = (ry / 2) * Math.cos(offsetRad);
        this.updateElementProperty(el, 'x', start.x + shiftX);
        this.updateElementProperty(el, 'y', start.y + shiftY);
      } else if (type === 'br') {
        newWidth = Math.max(10, start.width + rx);
        newHeight = Math.max(10, start.height + ry);
      } else if (type === 'tl') {
        newWidth = Math.max(10, start.width - rx);
        newHeight = Math.max(10, start.height - ry);
        const offsetRad = start.rotation * (Math.PI / 180);
        const shiftX = (rx / 2) * Math.cos(offsetRad) - (-ry / 2) * Math.sin(offsetRad);
        const shiftY = (rx / 2) * Math.sin(offsetRad) + (-ry / 2) * Math.cos(offsetRad);
        this.updateElementProperty(el, 'x', start.x + shiftX);
        this.updateElementProperty(el, 'y', start.y + shiftY);
      } else if (type === 'tr') {
        newWidth = Math.max(10, start.width + rx);
        newHeight = Math.max(10, start.height - ry);
        const offsetRad = start.rotation * (Math.PI / 180);
        const shiftX = (-ry / 2) * Math.sin(offsetRad);
        const shiftY = (ry / 2) * Math.cos(offsetRad);
        this.updateElementProperty(el, 'x', start.x + shiftX);
        this.updateElementProperty(el, 'y', start.y + shiftY);
      } else if (type === 'bl') {
        newWidth = Math.max(10, start.width - rx);
        newHeight = Math.max(10, start.height + ry);
        const offsetRad = start.rotation * (Math.PI / 180);
        const shiftX = (rx / 2) * Math.cos(offsetRad);
        const shiftY = (rx / 2) * Math.sin(offsetRad);
        this.updateElementProperty(el, 'x', start.x + shiftX);
        this.updateElementProperty(el, 'y', start.y + shiftY);
      }

      if (this.snapToGrid) {
        newWidth = Math.round(newWidth / this.gridSize) * this.gridSize;
        newHeight = Math.round(newHeight / this.gridSize) * this.gridSize;
      }

      this.updateElementProperty(el, 'width', newWidth);
      this.updateElementProperty(el, 'height', newHeight);
    }

    this.render();
    this.updateTransformOverlay();
  }

  /**
   * Safe property modification helper.
   * If a keyframe already exists at the current frame/playhead time, it updates that keyframe value.
   * Otherwise it writes to the static element base value.
   */
  updateElementProperty(element, key, value) {
    const kfs = element.keyframes[key];
    const timeMatch = kfs ? kfs.find(k => Math.abs(k.time - this.currentTime) < 0.01) : null;
    
    if (timeMatch) {
      timeMatch.value = value;
    } else {
      element[key] = value;
    }
  }

  updateTransformOverlay() {
    if (!this.selectedElementId) {
      this.overlay.style.display = 'none';
      return;
    }

    const el = this.elements.find(x => x.id === this.selectedElementId);
    if (!el) {
      this.overlay.style.display = 'none';
      return;
    }

    const state = getResolvedElementState(el, this.elements, this.currentTime);
    this.overlay.style.display = 'block';
    this.overlay.style.left = `${state.x}px`;
    this.overlay.style.top = `${state.y}px`;
    this.overlay.style.width = `${state.width * state.scale}px`;
    this.overlay.style.height = `${state.height * state.scale}px`;
    this.overlay.style.transform = `translate(-50%, -50%) rotate(${state.rotation}deg)`;

    // Draw/Position Pivot Joint handle inside overlay container
    let pivotNode = this.overlay.querySelector('.pivot-handle');
    if (!pivotNode) {
      pivotNode = document.createElement('div');
      pivotNode.className = 'pivot-handle handle';
      pivotNode.dataset.handle = 'pivot';
      this.overlay.appendChild(pivotNode);
    }
    pivotNode.style.left = `${state.pivotX}%`;
    pivotNode.style.top = `${state.pivotY}%`;
  }

  renderElementDOM(el, state, isGhost = false, ghostDir = '') {
    const div = document.createElement('div');
    
    div.className = 'canvas-element';
    if (isGhost) {
      div.classList.add('onion-skin-ghost', ghostDir);
    } else {
      div.className += ` ${state.type}-element`;
      if (this.selectedElementId === el.id) {
        div.classList.add('selected');
      }
      div.dataset.id = el.id;
    }
    
    div.style.left = `${state.x}px`;
    div.style.top = `${state.y}px`;
    div.style.width = `${state.width}px`;
    div.style.height = `${state.height}px`;
    div.style.opacity = isGhost ? 0.20 : state.opacity / 100;
    
    // Set custom transform origin center point for limb/joint rotations
    div.style.transformOrigin = `${state.pivotX}% ${state.pivotY}%`;

    // Glow and drop shadow styling
    let shadowFilter = '';
    if (state.blur > 0) {
      shadowFilter = `drop-shadow(0 0 ${state.blur}px ${state.color})`;
    }

    // Squash-and-Stretch calculations (chef's kiss motion path deformers)
    let transform = `translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale})`;
    if (state.squishScaleX !== 1 || state.squishScaleY !== 1) {
      transform += ` rotate(${state.motionAngle}deg) scale(${state.squishScaleX}, ${state.squishScaleY}) rotate(${-state.motionAngle}deg)`;
    }
    div.style.transform = transform;
    
    // Inline template structures for different shapes
    if (state.type === 'circle') {
      div.style.backgroundColor = state.color;
      div.style.borderRadius = '50%';
      div.style.border = `${state.strokeWidth}px solid ${state.stroke}`;
      if (state.blur > 0 && !isGhost) div.style.boxShadow = `0 0 ${state.blur}px ${state.color}`;
    } else if (state.type === 'rect') {
      div.style.backgroundColor = state.color;
      div.style.borderRadius = `${state.radius}px`;
      div.style.border = `${state.strokeWidth}px solid ${state.stroke}`;
      if (state.blur > 0 && !isGhost) div.style.boxShadow = `0 0 ${state.blur}px ${state.color}`;
    } else if (state.type === 'triangle') {
      div.classList.add('svg-element');
      div.innerHTML = `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 100%; filter: ${shadowFilter};">
          <polygon points="50,0 100,100 0,100" fill="${state.color}" stroke="${state.stroke}" stroke-width="${state.strokeWidth * 2}"></polygon>
        </svg>`;
    } else if (state.type === 'star') {
      div.classList.add('svg-element');
      div.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 100%; height: 100%; filter: ${shadowFilter};">
          <path d="M12 2L14.8 8.6L22 9.2L16.5 13.8L18.2 20.8L12 17.1L5.8 20.8L7.5 13.8L2 9.2L9.2 8.6L12 2Z" fill="${state.color}" stroke="${state.stroke}" stroke-width="${state.strokeWidth * 0.2}"></path>
        </svg>`;
    } else if (state.type === 'wave') {
      div.classList.add('svg-element');
      div.innerHTML = `
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" style="width: 100%; height: 100%; filter: ${shadowFilter};">
          <path d="M0,10 Q25,0 50,10 T100,10" fill="none" stroke="${state.color}" stroke-width="${state.strokeWidth || 2}"></path>
        </svg>`;
    } else if (state.type === 'text') {
      div.innerText = state.text;
      div.style.color = state.color;
      div.style.fontSize = `${state.height * 0.75}px`;
      if (state.blur > 0 && !isGhost) {
        div.style.textShadow = `0 0 ${state.blur}px ${state.color}`;
      }
    }

    this.container.appendChild(div);
  }

  render() {
    this.container.innerHTML = '';
    
    // 1. Draw Onion Skins (past and future ghost outlines)
    if (this.onionSkinEnabled) {
      const offsets = [-2, -1, 1, 2];
      offsets.forEach(offset => {
        const skinTime = this.currentTime + (offset / this.fps);
        if (skinTime >= 0 && skinTime <= this.duration) {
          const cache = {};
          this.elements.forEach(el => {
            if (el.hidden) return;
            const skinState = getResolvedElementState(el, this.elements, skinTime, cache);
            this.renderElementDOM(el, skinState, true, offset < 0 ? 'past' : 'future');
          });
        }
      });
    }

    // 2. Draw normal interactive active layers
    const activeCache = {};
    this.elements.forEach(el => {
      if (el.hidden) return;
      const state = getResolvedElementState(el, this.elements, this.currentTime, activeCache);
      this.renderElementDOM(el, state, false);
    });
  }
}
