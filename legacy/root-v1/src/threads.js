/* Threads — vanilla WebGL2 port of the React Bits component. */
(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};

  var LINE_VERTEX = `#version 300 es
precision highp float;
in vec2 aPoint;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFrame;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;
uniform float uCount;
uniform float uThickness;
uniform float uSoftness;
uniform float uWaves;
uniform float uSplit;
uniform float uFray;
uniform float uSeed;
uniform vec2 uTurn;
uniform vec4 uPart;
uniform float uTaper;
out float vEdge;
out float vBand;
out float vDraw;
out float vAlpha;
out float vIndex;

float Perlin2D(vec2 P) {
  vec2 Pi = floor(P);
  vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
  vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
  Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
  Pt += vec2(26.0, 161.0).xyxy;
  Pt *= Pt;
  Pt = Pt.xzxz * Pt.yyww;
  vec4 hash_x = fract(Pt * (1.0 / 951.135664));
  vec4 hash_y = fract(Pt * (1.0 / 642.949883));
  vec4 grad_x = hash_x - 0.49999;
  vec4 grad_y = hash_y - 0.49999;
  vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y) * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
  grad_results *= 1.4142135623730950;
  vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
  vec4 blend2 = vec4(blend, vec2(1.0 - blend));
  return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

void main() {
  float perc = float(gl_InstanceID) / uCount;
  float x = aPoint.x;
  float pixel = 1.0 / max(uResolution.x, uResolution.y);
  float splitPoint = uSplit + perc * uFray;
  float amplitudeNormal = smoothstep(splitPoint, max(0.7, splitPoint + 0.2), x);
  float finalAmplitude = amplitudeNormal * 0.5 * uAmplitude * (1.0 + (uMouse.y - 0.5) * 0.2);
  float timeScaled = uTime / 10.0 + (uMouse.x - 0.5);
  float blur = smoothstep(splitPoint, splitPoint + 0.05, x) * perc;
  float xnoise = mix(
    Perlin2D(vec2(timeScaled * 2.5 + uSeed, (x * uWaves + perc) * 2.5)),
    Perlin2D(vec2(timeScaled * 3.5 + uSeed, (x * uWaves + timeScaled) * 3.5)) / 1.5,
    x * 0.3
  );
  float y = 0.5 + (perc - 0.5) * uDistance + xnoise / 2.0 * finalAmplitude;
  vec2 local = vec2((x - 0.5) * uFrame.x, (y - 0.5) * uFrame.y);
  if (uPart.z > 0.0) {
    vec2 delta = local - uPart.xy;
    float reach = uPart.w;
    float pull = exp(-dot(delta, delta) / (reach * reach));
    local.y += delta.y * pull * uPart.z;
  }
  float width = 7.0 * uThickness * pixel * (1.0 - perc);
  float band = (width / 2.0 + 10.0 * uSoftness * pixel * blur) * uFrame.y;
  float draw = max(band, 1.0);
  local.y += aPoint.y * draw;
  vec2 turned = vec2(local.x * uTurn.x - local.y * uTurn.y, local.x * uTurn.y + local.y * uTurn.x);
  gl_Position = vec4(turned / (uResolution * 0.5), 0.0, 1.0);
  vEdge = aPoint.y * draw;
  vBand = band;
  vDraw = draw;
  vAlpha = 1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3)) * uTaper;
  vIndex = perc;
}`;

  var LINE_FRAGMENT = `#version 300 es
precision highp float;
in float vEdge;
in float vBand;
in float vDraw;
in float vAlpha;
in float vIndex;
uniform vec3 uColor;
uniform vec3 uAccent;
out vec4 outColor;
void main() {
  float coverage = (1.0 - smoothstep(0.0, vDraw, abs(vEdge))) * (vBand / vDraw) * vAlpha;
  outColor = vec4(mix(uColor, uAccent, vIndex) * coverage, coverage);
}`;

  var SCREEN_VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  var SCREEN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLines;
uniform vec2 uResolution;
uniform float uFade;
uniform float uOpacity;
uniform float uCurve;
out vec4 outColor;

float smootherstep(float edge, float x) {
  float t = clamp(x / edge, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec4 lines = texture(uLines, vUv);
  float alpha = lines.a;
  vec3 color = alpha > 0.0001 ? lines.rgb / alpha : vec3(0.0);
  float mask = uOpacity;
  if (uFade > 0.0) {
    vec2 px = vUv * uResolution;
    float edge = uFade * min(uResolution.x, uResolution.y) * 0.5;
    mask *= smootherstep(edge, px.x) * smootherstep(edge, uResolution.x - px.x);
    mask *= smootherstep(edge, px.y) * smootherstep(edge, uResolution.y - px.y);
  }
  outColor = vec4(color * pow(alpha, uCurve), alpha) * mask;
}`;

  var MAX_RENDER_DIM = 1920;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  }

  function link(gl, vertexSource, fragmentSource) {
    var vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    gl.deleteProgram(program);
    return null;
  }

  function locate(gl, program, names) {
    var result = {};
    names.forEach(function (name) { result[name] = gl.getUniformLocation(program, name); });
    return result;
  }

  var DEFAULTS = {
    color: [1, 1, 1],
    accentColor: null,
    amplitude: 1.7,
    distance: 0.4,
    enableMouseInteraction: false,
    lineCount: 90,
    thickness: 0.6,
    softness: 1.3,
    speed: 0.6,
    waves: 1.05,
    split: 0.04,
    fray: 0.5,
    angle: 25,
    seed: 0,
    parting: 0,
    taper: 0.85,
    brightness: 1.4,
    fade: 0,
    opacity: 1,
    paused: false
  };

  function createThreads(container, options) {
    if (!container) return null;
    var settings = Object.assign({}, DEFAULTS, options || {});
    settings.lineCount = clamp(Math.round(settings.lineCount), 1, 400);
    settings.thickness = Math.max(0, settings.thickness);
    settings.softness = Math.max(0, settings.softness);
    settings.waves = Math.max(0, settings.waves);
    settings.split = clamp(settings.split, 0, 1);
    settings.fray = clamp(settings.fray, 0, 1);
    settings.parting = clamp(settings.parting, 0, 1);
    settings.taper = clamp(settings.taper, 0, 1);
    settings.brightness = clamp(settings.brightness, 0.25, 2);
    settings.fade = clamp(settings.fade, 0, 1);
    settings.opacity = clamp(settings.opacity, 0, 1);

    var canvas = document.createElement('canvas');
    canvas.className = 'threads-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    var gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false
    });
    if (!gl) {
      container.classList.add('threads-unsupported');
      return { setOptions: function () {}, destroy: function () { container.removeChild(canvas); } };
    }

    var lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT);
    var screenProgram = link(gl, SCREEN_VERTEX, SCREEN_FRAGMENT);
    if (!lineProgram || !screenProgram) {
      container.classList.add('threads-unsupported');
      return { setOptions: function () {}, destroy: function () { container.removeChild(canvas); } };
    }

    var lineUniforms = locate(gl, lineProgram, [
      'uTime', 'uResolution', 'uFrame', 'uAmplitude', 'uDistance', 'uMouse', 'uCount',
      'uThickness', 'uSoftness', 'uWaves', 'uSplit', 'uFray', 'uSeed', 'uTurn',
      'uPart', 'uTaper', 'uColor', 'uAccent'
    ]);
    var screenUniforms = locate(gl, screenProgram, ['uLines', 'uResolution', 'uFade', 'uOpacity', 'uCurve']);

    var lineVao = gl.createVertexArray();
    var lineBuffer = gl.createBuffer();
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    var pointLocation = gl.getAttribLocation(lineProgram, 'aPoint');
    gl.enableVertexAttribArray(pointLocation);
    gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0);

    var screenVao = gl.createVertexArray();
    var screenBuffer = gl.createBuffer();
    gl.bindVertexArray(screenVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var positionLocation = gl.getAttribLocation(screenProgram, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var target = gl.createTexture();
    var framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    var probeContext = probe.getContext('2d', { willReadFrequently: true });
    var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    var state = {
      time: 0,
      width: 1,
      height: 1,
      segments: 0,
      colorKey: '',
      color: [1, 1, 1],
      accent: [1, 1, 1],
      mouse: [0.5, 0.5],
      targetMouse: [0.5, 0.5],
      pointer: [0, 0],
      targetPointer: [0, 0],
      presence: 0,
      inside: false
    };

    var raf = 0;
    var last = 0;
    var frames = 0;
    var visible = true;
    var alive = true;

    function toRgb(value) {
      if (Array.isArray(value)) {
        return [0, 1, 2].map(function (i) { return clamp(Number(value[i] == null ? 1 : value[i]), 0, 1); });
      }
      if (!probeContext) return [1, 1, 1];
      probeContext.clearRect(0, 0, 1, 1);
      probeContext.fillStyle = '#ffffff';
      probeContext.fillStyle = String(value);
      probeContext.fillRect(0, 0, 1, 1);
      var data = probeContext.getImageData(0, 0, 1, 1).data;
      return [data[0] / 255, data[1] / 255, data[2] / 255];
    }

    function colorKeyOf(s) {
      var c = Array.isArray(s.color) ? s.color.join(',') : String(s.color);
      var a = Array.isArray(s.accentColor) ? s.accentColor.join(',') : String(s.accentColor == null ? '' : s.accentColor);
      return c + '|' + a;
    }

    function resolveColors(s) {
      var key = colorKeyOf(s);
      if (key === state.colorKey) return;
      state.colorKey = key;
      state.color = toRgb(s.color);
      state.accent = s.accentColor == null ? state.color : toRgb(s.accentColor);
    }

    function buildStrip(segments) {
      if (segments === state.segments) return;
      state.segments = segments;
      var points = new Float32Array((segments + 1) * 4);
      for (var i = 0; i <= segments; i++) {
        var u = i / segments;
        points.set([u, -1, u, 1], i * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    }

    function render() {
      frames++;
      var s = settings;
      resolveColors(s);
      var w = canvas.width;
      var h = canvas.height;
      var radians = (s.angle * Math.PI) / 180;
      var cos = Math.cos(radians);
      var sin = Math.sin(radians);
      var length = Math.abs(w * cos) + Math.abs(h * sin);
      var across = Math.abs(w * sin) + Math.abs(h * cos);
      var scale = w / state.width;
      var mouse = s.enableMouseInteraction ? state.mouse : [0.5, 0.5];
      var strength = s.parting * state.presence * 2;
      var px = state.pointer[0] * scale;
      var py = state.pointer[1] * scale;
      var local = [px * cos + py * sin, -px * sin + py * cos];

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lineProgram);
      gl.uniform1f(lineUniforms.uTime, state.time);
      gl.uniform2f(lineUniforms.uResolution, w, h);
      gl.uniform2f(lineUniforms.uFrame, length, across);
      gl.uniform1f(lineUniforms.uAmplitude, s.amplitude);
      gl.uniform1f(lineUniforms.uDistance, s.distance);
      gl.uniform2f(lineUniforms.uMouse, mouse[0], mouse[1]);
      gl.uniform1f(lineUniforms.uCount, s.lineCount);
      gl.uniform1f(lineUniforms.uThickness, s.thickness);
      gl.uniform1f(lineUniforms.uSoftness, s.softness);
      gl.uniform1f(lineUniforms.uWaves, s.waves);
      gl.uniform1f(lineUniforms.uSplit, s.split);
      gl.uniform1f(lineUniforms.uFray, s.fray);
      gl.uniform1f(lineUniforms.uSeed, s.seed * 13.37);
      gl.uniform2f(lineUniforms.uTurn, cos, sin);
      gl.uniform4f(lineUniforms.uPart, local[0], local[1], strength, Math.min(w, h) * 0.16);
      gl.uniform1f(lineUniforms.uTaper, s.taper);
      gl.uniform3f(lineUniforms.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform3f(lineUniforms.uAccent, state.accent[0], state.accent[1], state.accent[2]);
      gl.bindVertexArray(lineVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (state.segments + 1) * 2, s.lineCount);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.uniform1i(screenUniforms.uLines, 0);
      gl.uniform2f(screenUniforms.uResolution, w, h);
      gl.uniform1f(screenUniforms.uFade, s.fade);
      gl.uniform1f(screenUniforms.uOpacity, s.opacity);
      gl.uniform1f(screenUniforms.uCurve, 2 / s.brightness);
      gl.bindVertexArray(screenVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      var s = settings;
      if (s.paused) {
        state.mouse[0] = state.targetMouse[0];
        state.mouse[1] = state.targetMouse[1];
        state.pointer[0] = state.targetPointer[0];
        state.pointer[1] = state.targetPointer[1];
        state.presence = (state.inside && s.parting > 0) ? 1 : 0;
        render();
        last = 0;
        return;
      }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var moving = !s.paused && !reduce;
      if (moving) state.time += dt * s.speed;
      var follow = 1 - Math.exp(-dt * 3);
      state.mouse[0] += (state.targetMouse[0] - state.mouse[0]) * follow;
      state.mouse[1] += (state.targetMouse[1] - state.mouse[1]) * follow;
      var glide = 1 - Math.exp(-dt * 10);
      state.pointer[0] += (state.targetPointer[0] - state.pointer[0]) * glide;
      state.pointer[1] += (state.targetPointer[1] - state.pointer[1]) * glide;
      state.presence += ((state.inside && s.parting > 0 ? 1 : 0) - state.presence) * (1 - Math.exp(-dt * 4));
      render();
      var settling =
        Math.abs(state.targetMouse[0] - state.mouse[0]) > 0.0005 ||
        Math.abs(state.targetMouse[1] - state.mouse[1]) > 0.0005 ||
        Math.abs(state.targetPointer[0] - state.pointer[0]) > 0.05 ||
        Math.abs(state.targetPointer[1] - state.pointer[1]) > 0.05 ||
        Math.abs((state.inside && s.parting > 0 ? 1 : 0) - state.presence) > 0.002;
      if (moving || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    function wake() {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function resize() {
      var width = Math.max(1, container.clientWidth);
      var height = Math.max(1, container.clientHeight);
      var baseDpr = Math.min(window.devicePixelRatio || 1, 2);
      var longest = Math.max(width, height) * baseDpr;
      var dpr = longest > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longest : baseDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      state.width = width;
      state.height = height;
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      buildStrip(clamp(Math.round(width / 3), 96, 640));
      render();
    }

    function onPointerMove(event) {
      var rect = container.getBoundingClientRect();
      var x = (event.clientX - rect.left) / Math.max(1, rect.width);
      var y = (event.clientY - rect.top) / Math.max(1, rect.height);
      var inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      if (inside) {
        state.targetMouse = [x, 1 - y];
        state.targetPointer = [
          event.clientX - rect.left - rect.width / 2,
          rect.height / 2 - (event.clientY - rect.top)
        ];
        if (!state.inside && state.presence < 0.01) state.pointer = [state.targetPointer[0], state.targetPointer[1]];
      } else if (state.inside) {
        state.targetMouse = [0.5, 0.5];
      }
      state.inside = inside;
      wake();
    }

    function onPointerLeave() {
      state.inside = false;
      state.targetMouse = [0.5, 0.5];
      wake();
    }

    function onVisibility() {
      last = 0;
      wake();
    }

    var resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    var intersection = null;
    if (window.IntersectionObserver) {
      intersection = new IntersectionObserver(function (entries) {
        visible = entries.some(function (entry) { return entry.isIntersecting; });
        if (visible) {
          last = 0;
          wake();
        }
      });
      intersection.observe(container);
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    wake();

    return {
      setOptions: function (patch) {
        Object.assign(settings, patch || {});
        settings.lineCount = clamp(Math.round(settings.lineCount), 1, 400);
        settings.opacity = clamp(settings.opacity, 0, 1);
        settings.brightness = clamp(settings.brightness, 0.25, 2);
        if (!raf) render();
        wake();
      },
      getState: function () {
        return {
          time: state.time,
          paused: !!settings.paused,
          frames: frames,
          visible: visible,
          segments: state.segments
        };
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        if (resizeObserver) resizeObserver.disconnect();
        if (intersection) intersection.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        document.documentElement.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('visibilitychange', onVisibility);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(target);
        gl.deleteBuffer(lineBuffer);
        gl.deleteBuffer(screenBuffer);
        gl.deleteVertexArray(lineVao);
        gl.deleteVertexArray(screenVao);
        gl.deleteProgram(lineProgram);
        gl.deleteProgram(screenProgram);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  Falcon.threads = { createThreads: createThreads };
})(window);
