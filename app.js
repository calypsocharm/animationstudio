/* ==========================================================================
   STARBY ANIMATION STUDIO - MAIN APP ORCHESTRATOR
   ========================================================================== */

import { CanvasController } from './canvas.js';
import { TimelineController } from './timeline.js';
import { getResolvedElementState } from './engine.js';
import { exportToProjectJSON, compileToCSSHTML } from './exporter.js';

class AnimationStudioApp {
  constructor() {
    this.elements = [];
    this.selectedElementId = null;
    this.currentTime = 0;
    this.duration = 5; // seconds
    this.fps = 30;
    this.isPlaying = false;
    this.loopEnabled = true;
    this.zoom = 1;
    this.gridSnap = true;
    
    // Playback loop timing
    this.lastFrameTime = 0;
    this.animationFrameId = null;

    this.initControllers();
    this.bindDOMEvents();
    this.loadDemoProject(); // Load beautiful default on startup
  }

  initControllers() {
    // 1. Canvas Controller
    this.canvasCtrl = new CanvasController(
      'canvas-viewport',
      'animation-container',
      'transform-overlay',
      (selectedId) => this.handleSelectionChanged(selectedId),
      (element) => this.handleElementModified(element)
    );

    // 2. Timeline Controller
    this.timelineCtrl = new TimelineController(
      'timeline-ruler',
      'timeline-tracks-container',
      'track-headers-container',
      (newTime) => this.handleTimeChanged(newTime),
      (elId, prop, kf) => this.handleKeyframeSelected(elId, prop, kf)
    );
  }

  /* ── EVENT LISTENER SYNCING ── */
  
  handleSelectionChanged(id) {
    this.selectedElementId = id;
    this.timelineCtrl.setSelectedElement(id);
    this.updateInspector();
    this.updateLayerListUI();
  }

  handleTimeChanged(time) {
    this.currentTime = time;
    this.canvasCtrl.setCurrentTime(time);
    
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) timeDisplay.innerText = `${time.toFixed(2)}s`;
    
    this.updateInspector();
  }

  handleElementModified(element) {
    // Sync updates back to timeline markers
    this.timelineCtrl.render();
    this.saveToLocalStorage();
  }

  handleKeyframeSelected(elId, property, kf) {
    // Enable "Delete Keyframe" button in properties panel
    const btnDel = document.getElementById('btn-delete-keyframe');
    if (btnDel) {
      btnDel.removeAttribute('disabled');
      btnDel.dataset.elId = elId;
      btnDel.dataset.property = property;
      btnDel.dataset.time = kf.time;
    }
  }

  updateInspector() {
    const infoPanel = document.getElementById('inspector-selection-info');
    const controls = document.getElementById('inspector-controls');
    
    if (!this.selectedElementId) {
      infoPanel.style.display = 'block';
      controls.style.display = 'none';
      return;
    }

    infoPanel.style.display = 'none';
    controls.style.display = 'block';

    const el = this.elements.find(x => x.id === this.selectedElementId);
    if (!el) return;

    // Get current animated state of the selected layer at this frame
    const state = getResolvedElementState(el, this.elements, this.currentTime);

    // Set form fields
    document.getElementById('el-name').value = state.name;
    document.getElementById('val-x').value = Math.round(state.x);
    document.getElementById('val-y').value = Math.round(state.y);
    document.getElementById('val-width').value = Math.round(state.width);
    document.getElementById('val-height').value = Math.round(state.height);
    document.getElementById('val-rotation').value = Math.round(state.rotation);
    document.getElementById('val-scale').value = parseFloat(state.scale.toFixed(1));
    document.getElementById('val-color').value = state.color;
    document.getElementById('color-hex').innerText = state.color.toUpperCase();
    document.getElementById('val-opacity').value = state.opacity;
    document.getElementById('val-radius').value = state.radius;
    document.getElementById('val-stroke').value = state.stroke;
    document.getElementById('stroke-hex').innerText = state.stroke.toUpperCase();
    document.getElementById('val-stroke-width').value = state.strokeWidth;
    document.getElementById('val-blur').value = state.blur;

    // Populate and set parent selector drop-down
    const parentSelect = document.getElementById('val-parent');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">None (Independent Layer)</option>';
      
      const isDescendant = (pId, cId) => {
        if (pId === cId) return true;
        const p = this.elements.find(x => x.id === pId);
        if (p && p.parentId) return isDescendant(p.parentId, cId);
        return false;
      };

      this.elements.forEach(other => {
        if (other.id !== el.id && !isDescendant(other.id, el.id)) {
          const opt = document.createElement('option');
          opt.value = other.id;
          opt.innerText = other.name;
          parentSelect.appendChild(opt);
        }
      });
      parentSelect.value = el.parentId || "";
    }

    // Text specific field
    const textContainer = document.getElementById('text-value-container');
    if (el.type === 'text') {
      textContainer.style.display = 'block';
      document.getElementById('val-text').value = state.text;
    } else {
      textContainer.style.display = 'none';
    }

    // Disable keyframe deletion since we haven't clicked one yet
    const btnDel = document.getElementById('btn-delete-keyframe');
    if (btnDel) btnDel.setAttribute('disabled', 'true');
  }

  bindDOMEvents() {
    // 1. Layer/Asset Spawners
    const spawnerBtns = document.querySelectorAll('.tool-btn');
    spawnerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.addElement(type);
      });
    });

    // 2. Load Demo Button
    const btnDemo = document.getElementById('btn-load-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => this.loadDemoProject());
    }

    // 3. New Project
    document.getElementById('btn-new').addEventListener('click', () => {
      if (confirm('Start a fresh canvas? All current elements will be wiped.')) {
        this.elements = [];
        this.selectedElementId = null;
        this.currentTime = 0;
        this.duration = 5;
        document.getElementById('project-title').value = 'New Magical Canvas';
        document.getElementById('timeline-duration').value = 5;
        document.getElementById('duration-val').innerText = '5s';
        
        this.canvasCtrl.setElements(this.elements);
        this.canvasCtrl.setCurrentTime(0);
        this.timelineCtrl.setDuration(5);
        this.timelineCtrl.setElements(this.elements);
        this.timelineCtrl.setSelectedElement(null);
        
        this.updateLayerListUI();
        this.updateInspector();
        this.saveToLocalStorage();
      }
    });

    // 4. Zoom Controls
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.zoom = Math.min(2.5, this.zoom + 0.1);
      this.updateZoomUI();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.zoom = Math.max(0.4, this.zoom - 0.1);
      this.updateZoomUI();
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
      this.zoom = 1.0;
      this.updateZoomUI();
    });

    // 5. Grid Snap Toggle
    const gridBtn = document.getElementById('toggle-grid');
    gridBtn.addEventListener('click', () => {
      this.gridSnap = !this.gridSnap;
      this.canvasCtrl.setSnapToGrid(this.gridSnap);
      gridBtn.classList.toggle('active', this.gridSnap);
    });

    // 6. Canvas Background Style toggle
    const bgBtn = document.getElementById('canvas-bg-toggle');
    const backdrop = document.getElementById('grid-backdrop');
    let bgState = 0; // 0: Dotted dark, 1: Solid black, 2: Solid light
    bgBtn.addEventListener('click', () => {
      bgState = (bgState + 1) % 3;
      backdrop.className = 'grid-backdrop';
      if (bgState === 1) backdrop.classList.add('dark-bg');
      if (bgState === 2) backdrop.classList.add('light-bg');
    });

    // 7. Playback Buttons
    const btnPlay = document.getElementById('btn-timeline-play');
    btnPlay.addEventListener('click', () => {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    });

    document.getElementById('btn-timeline-rewind').addEventListener('click', () => {
      this.currentTime = 0;
      this.handleTimeChanged(0);
      this.timelineCtrl.setCurrentTime(0);
    });

    document.getElementById('btn-timeline-prev').addEventListener('click', () => {
      let prevTime = this.currentTime - (1 / this.fps);
      if (prevTime < 0) prevTime = 0;
      this.handleTimeChanged(prevTime);
      this.timelineCtrl.setCurrentTime(prevTime);
    });

    document.getElementById('btn-timeline-next').addEventListener('click', () => {
      let nextTime = this.currentTime + (1 / this.fps);
      if (nextTime > this.duration) nextTime = this.duration;
      this.handleTimeChanged(nextTime);
      this.timelineCtrl.setCurrentTime(nextTime);
    });

    const loopBtn = document.getElementById('btn-timeline-loop');
    loopBtn.addEventListener('click', () => {
      this.loopEnabled = !this.loopEnabled;
      loopBtn.classList.toggle('active', this.loopEnabled);
    });

    // 8. FPS & Duration sliders
    const fpsSelect = document.getElementById('fps-select');
    fpsSelect.addEventListener('change', () => {
      this.fps = parseInt(fpsSelect.value);
      this.timelineCtrl.setFPS(this.fps);
    });

    const durSlider = document.getElementById('timeline-duration');
    durSlider.addEventListener('input', () => {
      this.duration = parseInt(durSlider.value);
      document.getElementById('duration-val').innerText = `${this.duration}s`;
      document.getElementById('total-time').innerText = `${this.duration.toFixed(2)}s`;
      this.timelineCtrl.setDuration(this.duration);
      this.saveToLocalStorage();
    });

    // 9. Input properties forms bindings
    const updateProp = (key, value, isNumeric = true) => {
      if (!this.selectedElementId) return;
      const el = this.elements.find(x => x.id === this.selectedElementId);
      if (!el) return;

      const parsed = isNumeric ? parseFloat(value) : value;
      
      // Auto-Keyframing engine integration:
      // If this attribute already has keyframes, we insert a keyframe at the current frame.
      // Otherwise we edit the base static value of the element.
      const kfList = el.keyframes[key];
      const hasKeyframes = kfList && kfList.length > 0;

      if (hasKeyframes) {
        // Find if keyframe exists at current time
        const match = kfList.find(k => Math.abs(k.time - this.currentTime) < 0.01);
        if (match) {
          match.value = parsed;
        } else {
          kfList.push({
            time: this.currentTime,
            value: parsed,
            easing: document.getElementById('val-easing').value || 'linear'
          });
        }
      } else {
        el[key] = parsed;
      }

      this.canvasCtrl.render();
      this.canvasCtrl.updateTransformOverlay();
      this.timelineCtrl.render();
      this.saveToLocalStorage();
    };

    // Transform inputs
    document.getElementById('val-x').addEventListener('input', (e) => updateProp('x', e.target.value));
    document.getElementById('val-y').addEventListener('input', (e) => updateProp('y', e.target.value));
    document.getElementById('val-width').addEventListener('input', (e) => updateProp('width', e.target.value));
    document.getElementById('val-height').addEventListener('input', (e) => updateProp('height', e.target.value));
    document.getElementById('val-rotation').addEventListener('input', (e) => updateProp('rotation', e.target.value));
    document.getElementById('val-scale').addEventListener('input', (e) => updateProp('scale', e.target.value));

    // Styles inputs
    document.getElementById('val-color').addEventListener('input', (e) => {
      document.getElementById('color-hex').innerText = e.target.value.toUpperCase();
      updateProp('color', e.target.value, false);
    });
    document.getElementById('val-stroke').addEventListener('input', (e) => {
      document.getElementById('stroke-hex').innerText = e.target.value.toUpperCase();
      updateProp('stroke', e.target.value, false);
    });
    document.getElementById('val-stroke-width').addEventListener('input', (e) => updateProp('strokeWidth', e.target.value));
    document.getElementById('val-radius').addEventListener('input', (e) => updateProp('radius', e.target.value));
    document.getElementById('val-opacity').addEventListener('input', (e) => updateProp('opacity', e.target.value));
    document.getElementById('val-blur').addEventListener('input', (e) => updateProp('blur', e.target.value));
    document.getElementById('val-text').addEventListener('input', (e) => updateProp('text', e.target.value, false));

    // 10. Keyframe additions / deletions
    document.getElementById('btn-add-keyframe').addEventListener('click', () => {
      if (!this.selectedElementId) return;
      const el = this.elements.find(x => x.id === this.selectedElementId);
      if (!el) return;

      // Force add keyframes for crucial values to seal a pose at this playhead
      const state = getResolvedElementState(el, this.elements, this.currentTime);
      const props = ['x', 'y', 'rotation', 'scale', 'opacity', 'color', 'blur'];
      if (el.type === 'text') props.push('text');
      
      const easing = document.getElementById('val-easing').value;

      props.forEach(key => {
        if (!el.keyframes[key]) el.keyframes[key] = [];
        
        // Remove duplicate keyframe if it sits at this exact time
        el.keyframes[key] = el.keyframes[key].filter(k => Math.abs(k.time - this.currentTime) > 0.01);
        
        el.keyframes[key].push({
          time: this.currentTime,
          value: state[key],
          easing: easing
        });
      });

      this.timelineCtrl.render();
      this.saveToLocalStorage();
    });

    document.getElementById('btn-delete-keyframe').addEventListener('click', (e) => {
      const { elId, property, time } = e.target.dataset;
      if (!elId || !property || !time) return;

      const el = this.elements.find(x => x.id === parseInt(elId));
      if (!el) return;

      const parsedTime = parseFloat(time);
      if (el.keyframes[property]) {
        el.keyframes[property] = el.keyframes[property].filter(k => Math.abs(k.time - parsedTime) > 0.01);
      }

      this.timelineCtrl.render();
      this.updateInspector();
      this.saveToLocalStorage();
    });

    // 11. Presets Integration
    const presetBtns = document.querySelectorAll('.preset-card');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.preset;
        this.applyPreset(type);
      });
    });

    // 12. Modal panels
    const exportBtn = document.getElementById('btn-export-css');
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('btn-close-export');

    exportBtn.addEventListener('click', () => {
      const projTitle = document.getElementById('project-title').value;
      const compiled = compileToCSSHTML(projTitle, this.elements, this.duration, this.loopEnabled);
      
      document.getElementById('export-code-box').innerText = compiled.combined;
      modal.style.display = 'flex';
      
      // Store compiled values inside data attributes of tabs
      const tabs = modal.querySelectorAll('.code-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tabs[0].classList.add('active');
      
      modal.dataset.combined = compiled.combined;
      modal.dataset.cssOnly = compiled.cssOnly;
      modal.dataset.htmlOnly = compiled.htmlOnly;
    });

    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Code copy
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('export-code-box').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const copyBtn = document.getElementById('btn-copy-code');
        const oldHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="material-symbols-rounded">done</span> Copied!';
        setTimeout(() => copyBtn.innerHTML = oldHtml, 2000);
      });
    });

    // Code Tabs inside Modal
    const codeTabs = modal.querySelectorAll('.code-tab');
    codeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        codeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const target = tab.dataset.tab;
        if (target === 'combined') {
          document.getElementById('export-code-box').innerText = modal.dataset.combined;
        } else if (target === 'css-only') {
          document.getElementById('export-code-box').innerText = modal.dataset.cssOnly;
        } else if (target === 'html-only') {
          document.getElementById('export-code-box').innerText = modal.dataset.htmlOnly;
        }
      });
    });

    // 13. File saving/loading
    document.getElementById('btn-export-project').addEventListener('click', () => {
      const projTitle = document.getElementById('project-title').value;
      const json = exportToProjectJSON(projTitle, this.elements, this.duration, this.fps);
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projTitle.toLowerCase().replace(/\s+/g, '-')}.staranim`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import project triggers click on hidden input
    document.getElementById('btn-import').addEventListener('click', (e) => {
      if (e.target.id === 'file-import-input') return;
      document.getElementById('file-import-input').click();
    });

    document.getElementById('file-import-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          this.loadProjectFromJSON(data);
        } catch (err) {
          alert('Could not parse project file. Ensure it is a valid .staranim project.');
        }
      };
      reader.readAsText(file);
    });

    // Parenting selection drop-down trigger
    const parentSelect = document.getElementById('val-parent');
    if (parentSelect) {
      parentSelect.addEventListener('change', (e) => {
        const parentId = e.target.value ? parseInt(e.target.value) : null;
        const el = this.elements.find(x => x.id === this.selectedElementId);
        if (!el) return;

        if (parentId) {
          const parent = this.elements.find(x => x.id === parentId);
          if (parent) {
            const currentTime = this.currentTime;
            const cache = {};
            const childState = getResolvedElementState(el, this.elements, currentTime, cache);
            const parentState = getResolvedElementState(parent, this.elements, currentTime, cache);

            // Compute local offsets relative to parent center to maintain absolute layout pos
            const dx = (childState.x - parentState.x) / parentState.scale;
            const dy = (childState.y - parentState.y) / parentState.scale;
            const rad = -parentState.rotation * (Math.PI / 180);
            const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = dx * Math.sin(rad) + dy * Math.cos(rad);

            el.parentId = parentId;
            this.updateElementProperty(el, 'x', Math.round(lx));
            this.updateElementProperty(el, 'y', Math.round(ly));
            this.updateElementProperty(el, 'rotation', Math.round(childState.rotation - parentState.rotation));
            this.updateElementProperty(el, 'scale', childState.scale / parentState.scale);
          }
        } else {
          // Unparent: convert local offsets back to absolute canvas coords
          const childState = getResolvedElementState(el, this.elements, this.currentTime);
          el.parentId = null;
          this.updateElementProperty(el, 'x', Math.round(childState.x));
          this.updateElementProperty(el, 'y', Math.round(childState.y));
          this.updateElementProperty(el, 'rotation', Math.round(childState.rotation));
          this.updateElementProperty(el, 'scale', childState.scale);
        }

        this.canvasCtrl.render();
        this.canvasCtrl.updateTransformOverlay();
        this.timelineCtrl.render();
        this.saveToLocalStorage();
      });
    }

    // Onion Skin toggling
    const onionBtn = document.getElementById('toggle-onion');
    if (onionBtn) {
      onionBtn.addEventListener('click', () => {
        const active = onionBtn.classList.toggle('active');
        this.canvasCtrl.setOnionSkin(active);
      });
    }

    // Global listener for dynamic timeline track selection
    window.addEventListener('selectLayer', (e) => {
      this.selectElement(e.detail);
    });

    // Inspector tab panel swapping
    const tabs = document.querySelectorAll('.inspector-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`pane-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  updateZoomUI() {
    this.canvasCtrl.setZoom(this.zoom);
    document.getElementById('zoom-level').innerText = `${Math.round(this.zoom * 100)}%`;
  }

  /* ── PLAYBACK CONTROL LOOP ── */

  play() {
    if (this.isPlaying) return;
    
    // Wrap to start if at boundary
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }

    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    
    const playBtn = document.getElementById('btn-timeline-play');
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
    
    this.animationLoop();
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    const playBtn = document.getElementById('btn-timeline-play');
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
  }

  animationLoop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this.currentTime += delta;

    if (this.currentTime >= this.duration) {
      if (this.loopEnabled) {
        this.currentTime = 0;
      } else {
        this.currentTime = this.duration;
        this.pause();
      }
    }

    // Render Canvas and Timeline at current frame time
    this.canvasCtrl.setCurrentTime(this.currentTime);
    this.timelineCtrl.setCurrentTime(this.currentTime);
    
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) timeDisplay.innerText = `${this.currentTime.toFixed(2)}s`;

    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  /* ── DOM ELEMENTS CREATION ── */

  addElement(type) {
    const id = Date.now();
    const count = this.elements.filter(e => e.type === type).length + 1;
    
    // Set nice layout defaults centered on the stage
    const newEl = {
      id: id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`,
      type: type,
      x: 400,
      y: 250,
      width: type === 'text' ? 220 : 100,
      height: type === 'text' ? 50 : 100,
      rotation: 0,
      scale: 1,
      color: type === 'star' ? '#ffe600' : (type === 'circle' ? '#00f0ff' : '#a855f7'),
      opacity: 100,
      radius: type === 'rect' ? 8 : 0,
      stroke: '#ffffff',
      strokeWidth: 0,
      blur: 0,
      pivotX: 50,
      pivotY: 50,
      parentId: null,
      text: type === 'text' ? 'Magical Starby' : '',
      locked: false,
      hidden: false,
      keyframes: {
        x: [], y: [], width: [], height: [], rotation: [], scale: [], 
        opacity: [], color: [], radius: [], stroke: [], strokeWidth: [], blur: [], text: [],
        pivotX: [], pivotY: []
      }
    };

    this.elements.push(newEl);
    this.canvasCtrl.setElements(this.elements);
    this.timelineCtrl.setElements(this.elements);
    
    this.selectElement(id);
    this.saveToLocalStorage();
  }

  selectElement(id) {
    this.selectedElementId = id;
    this.canvasCtrl.selectElement(id);
    this.timelineCtrl.setSelectedElement(id);
    this.updateInspector();
    this.updateLayerListUI();
  }

  deleteElement(id) {
    this.elements = this.elements.filter(x => x.id !== id);
    if (this.selectedElementId === id) {
      this.selectedElementId = null;
    }
    
    this.canvasCtrl.setElements(this.elements);
    this.canvasCtrl.selectElement(this.selectedElementId);
    this.timelineCtrl.setElements(this.elements);
    this.timelineCtrl.setSelectedElement(this.selectedElementId);
    
    this.updateLayerListUI();
    this.updateInspector();
    this.saveToLocalStorage();
  }

  updateLayerListUI() {
    const list = document.getElementById('layer-list');
    
    if (this.elements.length === 0) {
      list.innerHTML = `
        <div class="empty-layers-state">
          <span class="material-symbols-rounded">layers_clear</span>
          <p>No elements created yet.</p>
          <button id="btn-load-demo" class="btn secondary small">Load Magical Demo</button>
        </div>`;
      // Re-bind demo click
      document.getElementById('btn-load-demo').addEventListener('click', () => this.loadDemoProject());
      document.getElementById('layer-count').innerText = '0 layers';
      return;
    }

    list.innerHTML = '';
    document.getElementById('layer-count').innerText = `${this.elements.length} layer${this.elements.length > 1 ? 's' : ''}`;

    // Render layers in reverse order (top layer is on top of list)
    [...this.elements].reverse().forEach(el => {
      const item = document.createElement('div');
      item.className = `layer-item ${el.id === this.selectedElementId ? 'active' : ''}`;
      
      let icon = 'star';
      if (el.type === 'circle') icon = 'circle';
      else if (el.type === 'rect') icon = 'rectangle';
      else if (el.type === 'triangle') icon = 'change_history';
      else if (el.type === 'text') icon = 'title';
      else if (el.type === 'wave') icon = 'waves';

      item.innerHTML = `
        <div class="layer-meta">
          <span class="material-symbols-rounded">${icon}</span>
          <span class="layer-name">${el.name}</span>
        </div>
        <div class="layer-actions">
          <button class="layer-action-btn visibility-btn ${el.hidden ? 'hidden-layer' : ''}" title="Hide/Show Layer">
            <span class="material-symbols-rounded">${el.hidden ? 'visibility_off' : 'visibility'}</span>
          </button>
          <button class="layer-action-btn lock-btn" title="Lock/Unlock Layer">
            <span class="material-symbols-rounded">${el.locked ? 'lock' : 'lock_open'}</span>
          </button>
          <button class="layer-action-btn delete-btn" title="Delete Layer">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>`;

      // Item selection click
      item.addEventListener('mousedown', (e) => {
        if (e.target.closest('.layer-action-btn')) return;
        this.selectElement(el.id);
      });

      // Visibility Toggle
      item.querySelector('.visibility-btn').addEventListener('click', () => {
        el.hidden = !el.hidden;
        this.canvasCtrl.render();
        this.canvasCtrl.updateTransformOverlay();
        this.updateLayerListUI();
        this.saveToLocalStorage();
      });

      // Lock Toggle
      item.querySelector('.lock-btn').addEventListener('click', () => {
        el.locked = !el.locked;
        this.updateLayerListUI();
        this.saveToLocalStorage();
      });

      // Delete Layer
      item.querySelector('.delete-btn').addEventListener('click', () => {
        this.deleteElement(el.id);
      });

      list.appendChild(item);
    });
  }

  /* ── PRESETS INTERPOLATION INTEGRATOR ── */

  applyPreset(presetType) {
    if (!this.selectedElementId) return;
    const el = this.elements.find(x => x.id === this.selectedElementId);
    if (!el) return;

    // Wipe prior keyframe coordinates for the properties we'll animate
    if (presetType === 'spin') {
      el.keyframes.rotation = [
        { time: 0, value: 0, easing: 'linear' },
        { time: this.duration / 2, value: 180, easing: 'linear' },
        { time: this.duration, value: 360, easing: 'linear' }
      ];
    } else if (presetType === 'float') {
      const baseValY = el.y;
      el.keyframes.y = [
        { time: 0, value: baseValY, easing: 'ease-in-out' },
        { time: this.duration / 2, value: baseValY - 40, easing: 'ease-in-out' },
        { time: this.duration, value: baseValY, easing: 'ease-in-out' }
      ];
    } else if (presetType === 'pulse') {
      el.keyframes.scale = [
        { time: 0, value: 1.0, easing: 'ease-in-out' },
        { time: this.duration / 4, value: 1.25, easing: 'ease-in-out' },
        { time: this.duration / 2, value: 1.0, easing: 'ease-in-out' },
        { time: (3 * this.duration) / 4, value: 1.25, easing: 'ease-in-out' },
        { time: this.duration, value: 1.0, easing: 'ease-in-out' }
      ];
    } else if (presetType === 'fade-in') {
      el.keyframes.opacity = [
        { time: 0, value: 0, easing: 'ease-out' },
        { time: 1.5, value: 100, easing: 'ease-out' }
      ];
      el.keyframes.scale = [
        { time: 0, value: 0.4, easing: 'spring' },
        { time: 1.5, value: 1.0, easing: 'spring' }
      ];
    }

    this.canvasCtrl.render();
    this.timelineCtrl.render();
    this.updateInspector();
    this.saveToLocalStorage();
  }

  /* ── LOCAL STORAGE SAVING/LOADING ── */

  saveToLocalStorage() {
    const projTitle = document.getElementById('project-title').value;
    const json = exportToProjectJSON(projTitle, this.elements, this.duration, this.fps);
    localStorage.setItem('starby_studio_autosave', json);
  }

  loadProjectFromJSON(data) {
    if (!data.elements) return;

    this.elements = data.elements;
    this.duration = data.duration || 5;
    this.fps = data.fps || 30;
    this.currentTime = 0;
    
    document.getElementById('project-title').value = data.title || 'Magical Canvas';
    document.getElementById('timeline-duration').value = this.duration;
    document.getElementById('duration-val').innerText = `${this.duration}s`;
    document.getElementById('total-time').innerText = `${this.duration.toFixed(2)}s`;
    
    this.canvasCtrl.setElements(this.elements);
    this.canvasCtrl.setCurrentTime(0);
    this.timelineCtrl.setFPS(this.fps);
    this.timelineCtrl.setDuration(this.duration);
    this.timelineCtrl.setElements(this.elements);

    // Selected defaults
    if (this.elements.length > 0) {
      this.selectElement(this.elements[0].id);
    } else {
      this.selectElement(null);
    }

    this.updateLayerListUI();
    this.updateInspector();
  }

  /* ── LOAD BEAUTIFUL DEMO CANVAS ── */

  loadDemoProject() {
    const demo = {
      title: 'Magical Puppet Dance',
      duration: 5,
      fps: 30,
      elements: [
        {
          id: 1,
          name: 'Main Body (Torso)',
          type: 'rect',
          x: 400,
          y: 200,
          width: 80,
          height: 120,
          rotation: 0,
          scale: 1.0,
          color: '#a855f7',
          opacity: 100,
          radius: 12,
          stroke: '#ffffff',
          strokeWidth: 2,
          blur: 10,
          pivotX: 50,
          pivotY: 50,
          parentId: null,
          text: '',
          locked: false,
          hidden: false,
          keyframes: {
            y: [
              { time: 0, value: 200, easing: 'ease-in-out' },
              { time: 1.25, value: 240, easing: 'ease-in-out' },
              { time: 2.5, value: 200, easing: 'ease-in-out' },
              { time: 3.75, value: 240, easing: 'ease-in-out' },
              { time: 5, value: 200, easing: 'ease-in-out' }
            ]
          }
        },
        {
          id: 2,
          name: 'Glowing Head',
          type: 'circle',
          x: 0,
          y: -95,
          width: 70,
          height: 70,
          rotation: 0,
          scale: 1.0,
          color: '#00f0ff',
          opacity: 100,
          radius: 0,
          stroke: '#ffffff',
          strokeWidth: 2,
          blur: 20,
          pivotX: 50,
          pivotY: 90,
          parentId: 1,
          text: '',
          locked: false,
          hidden: false,
          keyframes: {
            rotation: [
              { time: 0, value: 0, easing: 'ease-in-out' },
              { time: 1.25, value: 12, easing: 'ease-in-out' },
              { time: 2.5, value: -12, easing: 'ease-in-out' },
              { time: 3.75, value: 12, easing: 'ease-in-out' },
              { time: 5, value: 0, easing: 'ease-in-out' }
            ]
          }
        },
        {
          id: 3,
          name: 'Shoulder joint (Right)',
          type: 'circle',
          x: 60,
          y: -40,
          width: 20,
          height: 20,
          rotation: 0,
          scale: 1.0,
          color: '#ff6b8b',
          opacity: 100,
          radius: 0,
          stroke: '#ffffff',
          strokeWidth: 0,
          blur: 5,
          pivotX: 50,
          pivotY: 50,
          parentId: 1,
          text: '',
          locked: false,
          hidden: false,
          keyframes: {}
        },
        {
          id: 4,
          name: 'Upper Arm (Right)',
          type: 'rect',
          x: 45,
          y: 0,
          width: 80,
          height: 22,
          rotation: 0,
          scale: 1.0,
          color: '#a855f7',
          opacity: 100,
          radius: 6,
          stroke: '#ffffff',
          strokeWidth: 1,
          blur: 0,
          pivotX: 10,
          pivotY: 50,
          parentId: 3,
          text: '',
          locked: false,
          hidden: false,
          keyframes: {
            rotation: [
              { time: 0, value: 0, easing: 'ease-in-out' },
              { time: 1.25, value: -60, easing: 'ease-in-out' },
              { time: 2.5, value: 45, easing: 'ease-in-out' },
              { time: 3.75, value: -60, easing: 'ease-in-out' },
              { time: 5, value: 0, easing: 'ease-in-out' }
            ]
          }
        },
        {
          id: 5,
          name: 'Hand Star (Right)',
          type: 'star',
          x: 95,
          y: 0,
          width: 36,
          height: 36,
          rotation: 0,
          scale: 1.0,
          color: '#ffd700',
          opacity: 100,
          radius: 0,
          stroke: '#ffffff',
          strokeWidth: 0,
          blur: 15,
          pivotX: 50,
          pivotY: 50,
          parentId: 4,
          text: '',
          locked: false,
          hidden: false,
          keyframes: {
            rotation: [
              { time: 0, value: 0, easing: 'linear' },
              { time: 5, value: 360, easing: 'linear' }
            ]
          }
        }
      ]
    };
    
    this.loadProjectFromJSON(demo);
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('starby_studio_autosave');
  const app = new AnimationStudioApp();
  
  if (saved) {
    try {
      app.loadProjectFromJSON(JSON.parse(saved));
    } catch(e) {
      console.warn("Failed to load autosaved project. Restoring default demo.");
    }
  }
});
