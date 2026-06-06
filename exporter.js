/* ==========================================================================
   STARBY ANIMATION STUDIO - EXPORTER MODULE
   ========================================================================== */

import { getElementStateAtTime } from './engine.js';

/**
 * Serializes the current studio workspace into a .staranim JSON schema.
 */
export function exportToProjectJSON(projectTitle, elements, duration, fps) {
  const projectData = {
    version: '1.0.0',
    title: projectTitle,
    duration: duration,
    fps: fps,
    elements: elements
  };
  return JSON.stringify(projectData, null, 2);
}

/**
 * Compiles the current vector workspace into a production-ready HTML/CSS bundle.
 */
export function compileToCSSHTML(projectTitle, elements, duration, loopEnabled) {
  const canvasWidth = 800;
  const canvasHeight = 500;
  const animationDuration = duration;
  const loopString = loopEnabled ? 'infinite' : 'forward';

  // 1. Start building CSS styles
  let css = `/* 
   Starby Art Suite - CSS Animation Export
   Project: ${projectTitle}
   Generated: ${new Date().toLocaleDateString()}
*/

.starby-stage-container {
  position: relative;
  width: ${canvasWidth}px;
  height: ${canvasHeight}px;
  background-color: #0d121f;
  background-image: 
    radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.starby-animated-el {
  position: absolute;
  transform-origin: center center;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;

  // 2. Build HTML body elements
  let html = `<div class="starby-stage-container">\n`;

  // 3. Generate keyframes and classes for each layer
  elements.forEach((el, index) => {
    const layerId = `starby-el-${el.id}`;
    const animName = `starby-kf-${el.id}`;

    // Add CSS properties for static layout
    css += `\n/* Layer: ${el.name} */\n`;
    css += `.${layerId} {\n`;
    
    // Add default shape styling based on element type
    if (el.type === 'text') {
      css += `  font-family: 'Outfit', 'Inter', sans-serif;\n`;
      css += `  font-weight: 700;\n`;
      css += `  white-space: nowrap;\n`;
    }

    css += `  animation: ${animName} ${animationDuration}s linear ${loopString};\n`;
    css += `}\n`;

    // Gather distinct keyframe times for this element to build timeline steps
    const times = new Set();
    times.add(0); // Ensure start frame
    times.add(animationDuration); // Ensure end frame

    // Scan all properties for custom timestamps
    if (el.keyframes) {
      Object.keys(el.keyframes).forEach(prop => {
        el.keyframes[prop].forEach(kf => {
          if (kf.time >= 0 && kf.time <= animationDuration) {
            times.add(kf.time);
          }
        });
      });
    }

    // Sort times numerically
    const sortedTimes = Array.from(times).sort((a, b) => a - b);

    // Build CSS Keyframes
    css += `@keyframes ${animName} {\n`;
    sortedTimes.forEach(time => {
      const percentage = ((time / animationDuration) * 100).toFixed(1);
      
      // Compute the state at this exact moment
      const state = getElementStateAtTime(el, time);

      css += `  ${percentage}% {\n`;
      css += `    left: ${state.x}px;\n`;
      css += `    top: ${state.y}px;\n`;
      css += `    width: ${state.width}px;\n`;
      css += `    height: ${state.height}px;\n`;
      css += `    opacity: ${(state.opacity / 100).toFixed(2)};\n`;

      if (state.type !== 'text' && state.type !== 'wave') {
        css += `    background-color: ${state.color};\n`;
        css += `    border-radius: ${state.radius}px;\n`;
        css += `    border: ${state.strokeWidth}px solid ${state.stroke};\n`;
      } else if (state.type === 'text') {
        css += `    color: ${state.color};\n`;
        css += `    font-size: ${state.height * 0.75}px;\n`;
      }

      // Drop shadows / glows
      if (state.blur > 0) {
        if (state.type === 'text') {
          css += `    text-shadow: 0 0 ${state.blur}px ${state.color};\n`;
        } else {
          css += `    box-shadow: 0 0 ${state.blur}px ${state.color};\n`;
        }
      } else {
        if (state.type !== 'text' && state.type !== 'wave') {
          css += `    box-shadow: none;\n`;
        }
      }

      // Anchor translate(-50%, -50%) makes the position centered on x,y
      css += `    transform: translate(-50%, -50%) rotate(${state.rotation}deg) scale(${state.scale});\n`;
      css += `  }\n`;
    });
    css += `}\n`;

    // Build the HTML node
    if (el.type === 'text') {
      html += `  <div class="starby-animated-el ${layerId}">${el.text}</div>\n`;
    } else if (el.type === 'circle') {
      html += `  <div class="starby-animated-el ${layerId}"></div>\n`;
    } else if (el.type === 'rect') {
      html += `  <div class="starby-animated-el ${layerId}"></div>\n`;
    } else if (el.type === 'triangle') {
      html += `  <div class="starby-animated-el ${layerId}">\n`;
      html += `    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%;">\n`;
      html += `      <polygon points="50,0 100,100 0,100" fill="currentColor" style="color: inherit;"></polygon>\n`;
      html += `    </svg>\n`;
      html += `  </div>\n`;
    } else if (el.type === 'star') {
      html += `  <div class="starby-animated-el ${layerId}">\n`;
      html += `    <svg viewBox="0 0 24 24" style="width:100%; height:100%;">\n`;
      html += `      <path d="M12 2L14.8 8.6L22 9.2L16.5 13.8L18.2 20.8L12 17.1L5.8 20.8L7.5 13.8L2 9.2L9.2 8.6L12 2Z" fill="currentColor" style="color: inherit;"></path>\n`;
      html += `    </svg>\n`;
      html += `  </div>\n`;
    } else if (el.type === 'wave') {
      html += `  <div class="starby-animated-el ${layerId}">\n`;
      html += `    <svg viewBox="0 0 100 20" preserveAspectRatio="none" style="width:100%; height:100%;">\n`;
      html += `      <path d="M0,10 Q25,0 50,10 T100,10" fill="none" stroke="currentColor" stroke-width="2" style="color: inherit;"></path>\n`;
      html += `    </svg>\n`;
      html += `  </div>\n`;
    }
  });

  html += `</div>`;

  return {
    combined: `<style>\n${css}</style>\n\n${html}`,
    cssOnly: css,
    htmlOnly: html
  };
}
