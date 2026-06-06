/* ==========================================================================
   STARBY ANIMATION STUDIO - TIMELINE CONTROLLER
   ========================================================================== */

export class TimelineController {
  constructor(rulerId, tracksContainerId, headersContainerId, onTimeChanged, onKeyframeSelected) {
    this.ruler = document.getElementById(rulerId);
    this.tracksContainer = document.getElementById(tracksContainerId);
    this.headersContainer = document.getElementById(headersContainerId);
    
    this.onTimeChanged = onTimeChanged;
    this.onKeyframeSelected = onKeyframeSelected;

    this.duration = 5; // seconds
    this.fps = 30;
    this.currentTime = 0; // seconds
    this.elements = [];
    this.selectedElementId = null;
    
    this.pixelsPerSecond = 140; // width sizing
    
    this.isScrubbing = false;
    this.draggedKeyframe = null; // { element, property, keyframe, elementId }
    
    this.initEvents();
  }

  setElements(elements) {
    this.elements = elements;
    this.render();
  }

  setSelectedElement(id) {
    this.selectedElementId = id;
    this.render();
  }

  setDuration(duration) {
    this.duration = duration;
    if (this.currentTime > duration) {
      this.currentTime = duration;
    }
    this.render();
  }

  setFPS(fps) {
    this.fps = fps;
    this.render();
  }

  setCurrentTime(time) {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.updatePlayheadPosition();
  }

  initEvents() {
    // 1. Scrubber event (ruler clicks)
    const handleScrub = (e) => {
      const rect = this.ruler.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      let newTime = pct * this.duration;
      
      // Snap to nearest frame
      const frameIndex = Math.round(newTime * this.fps);
      newTime = frameIndex / this.fps;
      
      this.currentTime = newTime;
      this.updatePlayheadPosition();
      this.onTimeChanged(this.currentTime);
    };

    this.ruler.addEventListener('mousedown', (e) => {
      this.isScrubbing = true;
      handleScrub(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isScrubbing) {
        handleScrub(e);
      } else if (this.draggedKeyframe) {
        this.handleKeyframeDragMove(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isScrubbing) this.isScrubbing = false;
      if (this.draggedKeyframe) {
        this.draggedKeyframe = null;
        this.render(); // Re-render to sort timelines
      }
    });

    // 2. Track container scroll syncing (if scrolling horizontally)
    this.tracksContainer.addEventListener('scroll', () => {
      this.ruler.style.transform = `translateX(-${this.tracksContainer.scrollLeft}px)`;
    });
  }

  handleKeyframeDragMove(e) {
    const { element, property, keyframe } = this.draggedKeyframe;
    const rect = this.tracksContainer.getBoundingClientRect();
    const x = e.clientX - rect.left + this.tracksContainer.scrollLeft;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    let newTime = pct * this.duration;

    // Snap to frame
    const frameIndex = Math.round(newTime * this.fps);
    newTime = frameIndex / this.fps;

    // Ensure we do not overlap another keyframe on the same timeline property
    const others = element.keyframes[property].filter(k => k !== keyframe);
    const hasConflict = others.some(k => Math.abs(k.time - newTime) < 0.01);
    
    if (!hasConflict) {
      keyframe.time = newTime;
      this.render();
      // Keep playhead aligned to dragging keyframe for feedback preview
      this.currentTime = newTime;
      this.updatePlayheadPosition();
      this.onTimeChanged(this.currentTime);
    }
  }

  updatePlayheadPosition() {
    const playhead = document.getElementById('timeline-playhead');
    if (playhead) {
      const pct = (this.currentTime / this.duration) * 100;
      playhead.style.left = `${pct}%`;
    }
  }

  render() {
    // 1. Resize timeline widths
    const width = this.duration * this.pixelsPerSecond;
    this.ruler.style.width = `${width}px`;
    
    const masterTrack = document.getElementById('master-track-content');
    if (masterTrack) masterTrack.style.width = `${width}px`;

    // 2. Render Ruler Ticks
    this.renderRulerTicks(width);

    // 3. Render Track Headers (Left Pane)
    this.renderTrackHeaders();

    // 4. Render Dynamic Track Lanes & Keyframes (Right Pane)
    this.renderTracks(width);

    // 5. Update Playhead
    this.updatePlayheadPosition();
  }

  renderRulerTicks(width) {
    this.ruler.innerHTML = '';
    const totalFrames = this.duration * this.fps;
    
    // Choose step sizes dynamically to prevent label crowding
    let stepSeconds = 1;
    if (this.duration > 10) stepSeconds = 2;
    
    // Minor ticks (e.g. 5 minor divisions per second)
    const minorDivisions = this.fps / 5; 

    for (let f = 0; f <= totalFrames; f++) {
      const t = f / this.fps;
      const left = (t / this.duration) * width;
      const isMajor = f % this.fps === 0;
      const isLabel = isMajor && (f / this.fps) % stepSeconds === 0;
      const isMinor = f % minorDivisions === 0;

      if (isLabel) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick major';
        tick.style.left = `${left}px`;
        
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.innerText = `${t.toFixed(0)}s`;
        tick.appendChild(label);
        
        this.ruler.appendChild(tick);
      } else if (isMinor) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick minor';
        tick.style.left = `${left}px`;
        this.ruler.appendChild(tick);
      }
    }
  }

  renderTrackHeaders() {
    // Keep master header and clear the rest
    const cells = this.headersContainer.querySelectorAll('.track-header-cell:not(.master-header)');
    cells.forEach(c => c.remove());

    this.elements.forEach(el => {
      const cell = document.createElement('div');
      cell.className = 'track-header-cell';
      if (el.id === this.selectedElementId) {
        cell.classList.add('active');
      }

      // Pick icon based on element type
      let icon = 'star';
      if (el.type === 'circle') icon = 'circle';
      else if (el.type === 'rect') icon = 'rectangle';
      else if (el.type === 'triangle') icon = 'change_history';
      else if (el.type === 'text') icon = 'title';
      else if (el.type === 'wave') icon = 'waves';
      else if (el.type === 'draw') icon = 'brush';

      cell.innerHTML = `<span class="material-symbols-rounded">${icon}</span> ${el.name}`;
      
      // Click selection syncing
      cell.addEventListener('mousedown', () => {
        // Find click handler dynamically via event delegation or direct app bind
        const event = new CustomEvent('selectLayer', { detail: el.id });
        window.dispatchEvent(event);
      });

      this.headersContainer.appendChild(cell);
    });
  }

  renderTracks(width) {
    // Clear dynamic tracks (keep master and playhead)
    const tracks = this.tracksContainer.querySelectorAll('.timeline-track:not(.master-track)');
    tracks.forEach(t => t.remove());

    // Clean master track diamonds
    const masterTrack = document.getElementById('master-track-content');
    masterTrack.innerHTML = '';

    // Create a tracker for all keyframe timestamps
    const masterTimestamps = new Set();

    // Render layers
    this.elements.forEach(el => {
      const track = document.createElement('div');
      track.className = 'timeline-track';
      track.style.width = `${width}px`;
      if (el.id === this.selectedElementId) {
        track.classList.add('active');
      }

      // Render keyframes inside track
      if (el.keyframes) {
        Object.keys(el.keyframes).forEach(prop => {
          el.keyframes[prop].forEach(kf => {
            masterTimestamps.add(kf.time);
            
            const diamond = document.createElement('div');
            diamond.className = 'keyframe-node';
            diamond.style.left = `${(kf.time / this.duration) * 100}%`;
            diamond.title = `${prop}: ${kf.value} (${kf.time.toFixed(2)}s)`;

            // Drag start listener
            diamond.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.draggedKeyframe = {
                element: el,
                property: prop,
                keyframe: kf,
                elementId: el.id
              };
              
              // Select the element and keyframe
              const event = new CustomEvent('selectLayer', { detail: el.id });
              window.dispatchEvent(event);
              this.onKeyframeSelected(el.id, prop, kf);
            });

            track.appendChild(diamond);
          });
        });
      }

      this.tracksContainer.appendChild(track);
    });

    // Populate Master Track summarizing all keyframes
    masterTimestamps.forEach(time => {
      if (time >= 0 && time <= this.duration) {
        const masterNode = document.createElement('div');
        masterNode.className = 'keyframe-node master-node';
        masterNode.style.left = `${(time / this.duration) * 100}%`;
        masterNode.style.backgroundColor = 'var(--accent-coral)';
        masterNode.title = `Multiple keyframes (${time.toFixed(2)}s)`;
        
        masterNode.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          // Jump playhead to this master keyframe
          this.currentTime = time;
          this.updatePlayheadPosition();
          this.onTimeChanged(this.currentTime);
        });

        masterTrack.appendChild(masterNode);
      }
    });
  }
}
