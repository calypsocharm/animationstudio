/* ==========================================================================
   STARBY ANIMATION STUDIO - PARTICLE TRAILS SYSTEM
   ========================================================================== */

class ParticleEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.isActive = false;
  }

  init(containerId) {
    const parent = document.getElementById(containerId);
    if (!parent) return;

    // Create a transparent absolute particle canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particle-canvas';
    this.canvas.width = 800;
    this.canvas.height = 500;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '4'; // behind transforms but above layers

    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    this.isActive = true;
    this.loop();
  }

  emitSparkle(x, y, count = 3, customColor = null) {
    if (!this.ctx) return;
    
    const colors = customColor ? [customColor] : ['#ffe600', '#00f0ff', '#ff6b8b', '#ffffff'];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2, // Drift upwards
        size: Math.random() * 6 + 4,
        alpha: 1.0,
        fade: Math.random() * 0.03 + 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.1
      });
    }
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color, alpha) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  loop() {
    if (!this.isActive) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.fade;
      p.rotation += p.rotSpeed;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw star particle
      this.drawStar(this.ctx, p.x, p.y, 4, p.size, p.size / 2.5, p.color, p.alpha);
    }

    requestAnimationFrame(() => this.loop());
  }
}

export const particles = new ParticleEngine();
