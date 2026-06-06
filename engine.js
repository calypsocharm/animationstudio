/* ==========================================================================
   STARBY ANIMATION STUDIO - INTERPOLATION ENGINE
   ========================================================================== */

/**
 * Standard easing functions.
 */
export const EASING_FUNCTIONS = {
  linear: (t) => t,
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  spring: (t) => {
    if (t === 0 || t === 1) return t;
    // Spring physics formula
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  }
};

/**
 * Parses hex color to RGB object.
 */
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

/**
 * Converts RGB numbers back to hex string.
 */
function rgbToHex(r, g, b) {
  const toHex = (c) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * Smoothly interpolates color channels.
 */
function interpolateColor(colorStart, colorEnd, progress) {
  const rgbStart = hexToRgb(colorStart);
  const rgbEnd = hexToRgb(colorEnd);

  const r = rgbStart.r + (rgbEnd.r - rgbStart.r) * progress;
  const g = rgbStart.g + (rgbEnd.g - rgbStart.g) * progress;
  const b = rgbStart.b + (rgbEnd.b - rgbStart.b) * progress;

  return rgbToHex(r, g, b);
}

/**
 * Main interpolation coordinator. Evaluates a single property's value at a target time.
 * @param {Array} keyframes - List of keyframes for a property
 * @param {number} time - Current playhead timestamp (seconds)
 * @param {*} defaultValue - Base value if no keyframes exist
 * @param {string} propertyType - The data type of the property ('number', 'color', 'string')
 */
export function interpolateProperty(keyframes, time, defaultValue, propertyType = 'number') {
  if (!keyframes || keyframes.length === 0) {
    return defaultValue;
  }

  // Sort keyframes chronologically
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // If time is before the first keyframe
  if (time <= sorted[0].time) {
    return sorted[0].value;
  }

  // If time is after the last keyframe
  if (time >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  // Find surrounding keyframes
  let kStart = sorted[0];
  let kEnd = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) {
      kStart = sorted[i];
      kEnd = sorted[i + 1];
      break;
    }
  }

  // Calculate interpolation progress
  const duration = kEnd.time - kStart.time;
  if (duration === 0) return kStart.value;

  const rawProgress = (time - kStart.time) / duration;

  // Apply easing defined at the starting keyframe (fallback to linear)
  const easingName = kStart.easing || 'linear';
  const easeFn = EASING_FUNCTIONS[easingName] || EASING_FUNCTIONS.linear;
  const easedProgress = easeFn(rawProgress);

  // Interpolate based on property type
  if (propertyType === 'color') {
    return interpolateColor(kStart.value, kEnd.value, easedProgress);
  } else if (propertyType === 'string') {
    // Discrete jump for text contents or fonts
    return easedProgress >= 0.5 ? kEnd.value : kStart.value;
  } else {
    // Standard numerical float values
    const valStart = parseFloat(kStart.value);
    const valEnd = parseFloat(kEnd.value);
    return valStart + (valEnd - valStart) * easedProgress;
  }
}

/**
 * Computes the complete state of a shape layer at a given playhead time.
 * @param {Object} element - The element configuration
 * @param {number} time - Current playhead time (seconds)
 */
export function getElementStateAtTime(element, time) {
  const kf = element.keyframes || {};
  
  return {
    name: element.name,
    type: element.type,
    text: interpolateProperty(kf.text, time, element.text || '', 'string'),
    x: interpolateProperty(kf.x, time, element.x, 'number'),
    y: interpolateProperty(kf.y, time, element.y, 'number'),
    width: interpolateProperty(kf.width, time, element.width, 'number'),
    height: interpolateProperty(kf.height, time, element.height, 'number'),
    rotation: interpolateProperty(kf.rotation, time, element.rotation, 'number'),
    scale: interpolateProperty(kf.scale, time, element.scale, 'number'),
    color: interpolateProperty(kf.color, time, element.color, 'color'),
    opacity: interpolateProperty(kf.opacity, time, element.opacity, 'number'),
    radius: interpolateProperty(kf.radius, time, element.radius, 'number'),
    stroke: interpolateProperty(kf.stroke, time, element.stroke, 'color'),
    strokeWidth: interpolateProperty(kf.strokeWidth, time, element.strokeWidth, 'number'),
    blur: interpolateProperty(kf.blur, time, element.blur, 'number'),
    pivotX: interpolateProperty(kf.pivotX, time, element.pivotX !== undefined ? element.pivotX : 50, 'number'),
    pivotY: interpolateProperty(kf.pivotY, time, element.pivotY !== undefined ? element.pivotY : 50, 'number')
  };
}

/**
 * Recursively resolves parent-child hierarchies to compute absolute coordinate states.
 */
export function getResolvedElementState(element, elements, time, cache = {}) {
  if (cache[element.id]) {
    return cache[element.id];
  }

  const localState = getElementStateAtTime(element, time);
  localState.id = element.id;
  localState.parentId = element.parentId || null;

  if (element.parentId) {
    const parent = elements.find(x => x.id === element.parentId);
    if (parent) {
      // Resolve parent first recursively
      const parentState = getResolvedElementState(parent, elements, time, cache);

      // Rotate child local offsets relative to parent rotation and parent scale
      const rad = parentState.rotation * (Math.PI / 180);
      const rx = localState.x * Math.cos(rad) - localState.y * Math.sin(rad);
      const ry = localState.x * Math.sin(rad) + localState.y * Math.cos(rad);

      localState.x = parentState.x + rx * parentState.scale;
      localState.y = parentState.y + ry * parentState.scale;
      localState.rotation = parentState.rotation + localState.rotation;
      localState.scale = parentState.scale * localState.scale;
    }
  }

  cache[element.id] = localState;
  return localState;
}

