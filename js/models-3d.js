/* ===========================================================================
   Plié Pilates — models-3d.js
   ---------------------------------------------------------------------------
   Builds the two 3D illustrations on classes.html out of CSS 3D transforms.
   No WebGL and no library — every part is a cuboid, ring or sphere positioned
   in real 3D space, so it renders offline and costs nothing to download.

   Coordinate system (matches CSS):
     x → along the machine, positive to the right
     y → vertical, NEGATIVE is up
     z → across the machine, positive toward the viewer
   All units are px at scale 1; .p3d scales the whole stage responsively.

   EDIT: colours below are read from the palette in css/styles.css. Change
   them there, or override the hex values here.
   =========================================================================== */

(function () {
  'use strict';

  /* --- palette (kept in sync with :root in styles.css) -------------------- */
  const C = {
    wood:      '#E3D3C3',
    woodDark:  '#D3BCA8',
    carriage:  '#F8F1E9',
    pad:       '#F7DEE2',
    padDeep:   '#F0CBD2',
    metal:     '#B7AAA4',
    metalDark: '#9A8B85',
    springA:   '#C4818C',
    springB:   '#9B5A66',
    strap:     '#8A7C76',
    matTop:    '#F7DEE2',
    matSide:   '#EBC7CE',
    foam:      '#EFE4D8',
    foamAlt:   '#DCC8BE',
    ball:      '#C4818C',
    band:      '#9B5A66'
  };

  /* Whole-model offset, so a composition can be recentred in its scene
     without editing every part. Set by reformer() / mat(). */
  let OX = 0, OY = 0, OZ = 0;
  function origin(x, y, z) { OX = x; OY = y; OZ = z; }

  /* --- primitives --------------------------------------------------------- */

  /** A cuboid. o = {w,h,d,x,y,z,c,r,ry,rx,rz} */
  function cube(o) {
    const v = [
      '--w:' + o.w + 'px', '--h:' + o.h + 'px', '--d:' + o.d + 'px',
      '--x:' + ((o.x || 0) + OX) + 'px', '--y:' + ((o.y || 0) + OY) + 'px',
      '--z:' + ((o.z || 0) + OZ) + 'px', '--c:' + o.c
    ];
    if (o.r)  v.push('--r:' + o.r + 'px');
    if (o.ry) v.push('--ry:' + o.ry + 'deg');
    if (o.rx) v.push('--rx:' + o.rx + 'deg');
    if (o.rz) v.push('--rz:' + o.rz + 'deg');
    return '<div class="p3d-cube" style="' + v.join(';') + '">' +
      '<i class="f-tp"></i><i class="f-bm"></i><i class="f-fr"></i>' +
      '<i class="f-bk"></i><i class="f-lf"></i><i class="f-rt"></i></div>';
  }

  /** A torus-ish ring (magic circle, loop band, strap handle). */
  function ring(o) {
    const v = [
      '--w:' + o.w + 'px', '--h:' + o.h + 'px', '--t:' + (o.t || 8) + 'px',
      '--x:' + ((o.x || 0) + OX) + 'px', '--y:' + ((o.y || 0) + OY) + 'px',
      '--z:' + ((o.z || 0) + OZ) + 'px', '--c:' + o.c
    ];
    if (o.ry) v.push('--ry:' + o.ry + 'deg');
    if (o.rx) v.push('--rx:' + o.rx + 'deg');
    if (o.rz) v.push('--rz:' + o.rz + 'deg');
    return '<div class="p3d-ring" style="' + v.join(';') + '"></div>';
  }

  /** A sphere (soft ball). */
  function ball(o) {
    return '<div class="p3d-ball" style="--w:' + o.w + 'px;--x:' + ((o.x || 0) + OX) +
      'px;--y:' + ((o.y || 0) + OY) + 'px;--z:' + ((o.z || 0) + OZ) +
      'px;--c:' + o.c + '"></div>';
  }

  /** Soft contact shadow on the floor plane. */
  function shadow(o) {
    return '<div class="p3d-shadow" style="--w:' + o.w + 'px;--d:' + o.d +
      'px;--x:' + ((o.x || 0) + OX) + 'px;--y:' + (o.y + OY) +
      'px;--z:' + ((o.z || 0) + OZ) + 'px"></div>';
  }

  /* =========================================================================
     THE REFORMER
     A classical reformer: timber frame on four legs, sliding carriage with
     headrest and shoulder rests, footbar at the front, four springs to the
     spring plate, and rope/pulley risers at the back.
     ========================================================================= */
  function reformer() {
    const p = [];
    origin(0, -8, 0);
    const FLOOR = 56;

    p.push(shadow({ w: 400, d: 150, x: 0, y: FLOOR + 1 }));

    /* --- frame --- */
    p.push(cube({ w: 330, h: 16, d: 14, x: 0, y: 0, z: -46, c: C.wood, r: 3 }));
    p.push(cube({ w: 330, h: 16, d: 14, x: 0, y: 0, z:  46, c: C.wood, r: 3 }));
    p.push(cube({ w: 14,  h: 14, d: 106, x: -158, y: 0, z: 0, c: C.woodDark }));
    p.push(cube({ w: 14,  h: 14, d: 106, x:  158, y: 0, z: 0, c: C.woodDark }));

    /* --- legs --- */
    [-142, 142].forEach(function (x) {
      [-46, 46].forEach(function (z) {
        p.push(cube({ w: 16, h: 48, d: 16, x: x, y: 32, z: z, c: C.woodDark, r: 2 }));
      });
    });

    /* --- carriage --- */
    p.push(cube({ w: 126, h: 14, d: 100, x: -36, y: -15, z: 0, c: C.carriage, r: 4 }));
    p.push(cube({ w: 118, h: 8,  d: 92,  x: -36, y: -26, z: 0, c: C.pad, r: 5 }));
    p.push(cube({ w: 32,  h: 9,  d: 84,  x: -98, y: -35, z: 0, c: C.padDeep, r: 4 }));
    [-27, 27].forEach(function (z) {
      p.push(cube({ w: 18, h: 24, d: 24, x: -88, y: -42, z: z, c: C.padDeep, r: 7 }));
    });

    /* --- footbar --- */
    [-40, 40].forEach(function (z) {
      p.push(cube({ w: 10, h: 48, d: 10, x: -152, y: -32, z: z, c: C.metal, r: 3 }));
    });
    p.push(cube({ w: 10, h: 10, d: 90, x: -152, y: -61, z: 0, c: C.metalDark, r: 5 }));

    /* --- springs --- */
    [-27, -9, 9, 27].forEach(function (z, i) {
      p.push(cube({
        w: 62, h: 8, d: 8, x: 54, y: -14, z: z,
        c: i % 2 ? C.springB : C.springA, r: 4
      }));
    });
    p.push(cube({ w: 12, h: 20, d: 96, x: 92, y: -14, z: 0, c: C.metalDark, r: 2 }));

    /* --- rope risers and handles --- */
    [-40, 40].forEach(function (z) {
      p.push(cube({ w: 10, h: 58, d: 10, x: 156, y: -37, z: z, c: C.metal, r: 3 }));
      // Rope runs level from the riser top; the handle hangs off its free end,
      // so the ring's top edge must sit exactly on the rope line (y -64).
      p.push(cube({ w: 116, h: 6, d: 6, x: 98, y: -64, z: z, c: C.strap, r: 3 }));
      p.push(ring({ w: 26, h: 30, t: 5, x: 38, y: -49, z: z, c: C.strap, ry: 90 }));
    });
    p.push(cube({ w: 10, h: 10, d: 90, x: 156, y: -71, z: 0, c: C.metalDark, r: 5 }));

    return p.join('');
  }

  /* =========================================================================
     THE MAT SET-UP
     A mat with the props we actually hand out: magic circle, soft ball,
     loop band and two foam blocks.
     ========================================================================= */
  function mat() {
    const p = [];
    /* The props sit mostly to the right and behind, so the whole composition
       is nudged back to keep it centred in the scene. */
    origin(-34, 14, 12);

    p.push(shadow({ w: 430, d: 260, x: 0, y: 2 }));

    /* --- the mat: slab plus an inset panel on its upper face --- */
    p.push(cube({ w: 250, h: 11, d: 130, x: 0, y: -5,    z: 0, c: C.matTop,  r: 10 }));
    p.push(cube({ w: 222, h: 2,  d: 104, x: 0, y: -11.5, z: 0, c: C.matSide, r: 8 }));

    /* --- magic circle, standing on the floor beside the mat ---
       The grip pads sit at the ring's horizontal extremes, so they have to
       ORBIT the ring's centre rather than just spin in place: a point at
       local (dx, 0, 0) rotated by ry lands at (dx·cos, 0, −dx·sin). */
    const ringX = 148, ringZ = -92, ringRY = -18, padR = 47;
    const rad = ringRY * Math.PI / 180;
    p.push(ring({ w: 96, h: 96, t: 11, x: ringX, y: -50, z: ringZ, c: C.springA, ry: ringRY }));
    [-padR, padR].forEach(function (dx) {
      p.push(cube({
        w: 9, h: 26, d: 16, ry: ringRY, c: C.metalDark, r: 4,
        x: ringX + dx * Math.cos(rad),
        y: -50,
        z: ringZ - dx * Math.sin(rad)
      }));
    });

    /* Ground each free-standing prop with its own contact shadow. */
    p.push(shadow({ w: 116, d: 46, x: ringX, y: 1, z: ringZ }));
    p.push(shadow({ w: 96,  d: 68, x: -150,  y: 1, z: -66 }));
    p.push(shadow({ w: 74,  d: 54, x: 124,   y: 1, z: 114 }));

    /* --- soft ball, on the floor at the front --- */
    p.push(ball({ w: 54, x: 124, y: -27, z: 114, c: C.ball }));

    /* --- loop band, lying flat on the mat's upper face --- */
    p.push(ring({ w: 132, h: 54, t: 8, x: 6, y: -13, z: 18, c: C.band, rx: 90 }));

    /* --- foam blocks, stacked on the floor clear of the mat --- */
    p.push(cube({ w: 58, h: 28, d: 38, x: -152, y: -14, z: -66, c: C.foam,    r: 4 }));
    p.push(cube({ w: 58, h: 28, d: 38, x: -146, y: -42, z: -70, c: C.foamAlt, r: 4, ry: 16 }));

    return p.join('');
  }

  /* =========================================================================
     A COMPACT REFORMER
     A stripped-back version of the machine above — frame, legs, carriage and
     footbar only. Used where several appear at once and the detail of the
     full model would just turn to noise.
     ========================================================================= */
  function miniReformer(ox, oz, ry) {
    const p = [];
    const sx = ox || 0, sz = oz || 0;
    const c = function (o) {
      o.x = (o.x || 0) + sx;
      o.z = (o.z || 0) + sz;
      if (ry) o.ry = ry;
      return cube(o);
    };

    p.push(shadow({ w: 230, d: 96, x: sx, y: 37, z: sz }));
    p.push(c({ w: 190, h: 10, d: 9, y: 0, z: -28, c: C.wood, r: 2 }));
    p.push(c({ w: 190, h: 10, d: 9, y: 0, z:  28, c: C.wood, r: 2 }));
    p.push(c({ w: 9, h: 9, d: 64, x: -91, y: 0, c: C.woodDark }));
    p.push(c({ w: 9, h: 9, d: 64, x:  91, y: 0, c: C.woodDark }));
    [-80, 80].forEach(function (x) {
      [-28, 28].forEach(function (z) {
        p.push(c({ w: 10, h: 30, d: 10, x: x, y: 20, z: z, c: C.woodDark, r: 2 }));
      });
    });
    p.push(c({ w: 74, h: 9, d: 60, x: -20, y: -10, c: C.carriage, r: 3 }));
    p.push(c({ w: 68, h: 5, d: 54, x: -20, y: -17, c: C.pad, r: 3 }));
    [-16, 16].forEach(function (z) {
      p.push(c({ w: 11, h: 14, d: 14, x: -46, y: -26, z: z, c: C.padDeep, r: 5 }));
    });
    [-24, 24].forEach(function (z) {
      p.push(c({ w: 6, h: 28, d: 6, x: -88, y: -20, z: z, c: C.metal, r: 2 }));
    });
    p.push(c({ w: 6, h: 6, d: 54, x: -88, y: -37, c: C.metalDark, r: 3 }));
    [-14, 14].forEach(function (z, i) {
      p.push(c({ w: 36, h: 5, d: 5, x: 34, y: -9, z: z, c: i ? C.springB : C.springA, r: 3 }));
    });
    return p.join('');
  }

  /* =========================================================================
     THE STUDIO FLOOR — three reformers in the shallow arc we actually use
     ========================================================================= */
  function studioFloor() {
    const p = [];
    origin(0, -6, 0);
    p.push(miniReformer(-150, -96, 8));
    p.push(miniReformer(10, 6, 0));
    p.push(miniReformer(168, 110, -8));
    return p.join('');
  }

  /* =========================================================================
     THE MAT ROOM — a row of mats and the prop shelf along the wall
     ========================================================================= */
  function matRoom() {
    const p = [];
    origin(-10, 8, 0);

    /* three mats, staggered */
    [[-130, -70], [10, 10], [150, 90]].forEach(function (pos, i) {
      p.push(shadow({ w: 190, d: 110, x: pos[0], y: 2, z: pos[1] }));
      p.push(cube({ w: 150, h: 9, d: 78, x: pos[0], y: -4, z: pos[1],
                    c: i === 1 ? C.matTop : C.foam, r: 7 }));
      p.push(cube({ w: 132, h: 2, d: 62, x: pos[0], y: -9, z: pos[1],
                    c: i === 1 ? C.matSide : C.foamAlt, r: 5 }));
    });

    /* prop shelf standing behind them */
    p.push(cube({ w: 210, h: 8, d: 44, x: 30, y: -54, z: -170, c: C.wood, r: 3 }));
    p.push(cube({ w: 210, h: 8, d: 44, x: 30, y: -104, z: -170, c: C.wood, r: 3 }));
    [-95, 95].forEach(function (dx) {
      p.push(cube({ w: 9, h: 116, d: 44, x: 30 + dx, y: -66, z: -170, c: C.woodDark, r: 2 }));
    });

    /* props on the shelves */
    p.push(ring({ w: 62, h: 62, t: 8, x: -40, y: -89, z: -170, c: C.springA }));
    p.push(ring({ w: 62, h: 62, t: 8, x: 26, y: -89, z: -170, c: C.springB }));
    p.push(ball({ w: 38, x: 96, y: -77, z: -164, c: C.ball }));
    p.push(cube({ w: 46, h: 22, d: 30, x: -46, y: -69, z: -166, c: C.foam, r: 3 }));
    p.push(cube({ w: 46, h: 22, d: 30, x: 6, y: -69, z: -166, c: C.foamAlt, r: 3, ry: 10 }));
    p.push(cube({ w: 40, h: 18, d: 28, x: 92, y: -119, z: -166, c: C.foam, r: 3 }));

    return p.join('');
  }

  /* =========================================================================
     RECEPTION — the desk, a stack of towels, a plant
     ========================================================================= */
  function reception() {
    const p = [];
    origin(0, 16, 0);

    p.push(shadow({ w: 400, d: 200, x: -10, y: 2 }));

    /* desk */
    p.push(cube({ w: 260, h: 14, d: 104, x: -30, y: -96, z: 0, c: C.wood, r: 5 }));
    p.push(cube({ w: 244, h: 88, d: 88, x: -30, y: -47, z: -6, c: C.foam, r: 4 }));
    p.push(cube({ w: 252, h: 10, d: 12, x: -30, y: -86, z: 48, c: C.woodDark, r: 3 }));

    /* stacked towels on the desk */
    [0, 15, 30].forEach(function (dy, i) {
      p.push(cube({ w: 62, h: 13, d: 44, x: -122, y: -116 - dy, z: -6,
                    c: i % 2 ? C.pad : C.padDeep, r: 3, ry: i * 5 - 5 }));
    });

    /* a small sign */
    p.push(cube({ w: 8, h: 34, d: 8, x: 52, y: -120, z: 6, c: C.metalDark, r: 3 }));
    p.push(cube({ w: 74, h: 40, d: 6, x: 52, y: -156, z: 6, c: C.carriage, r: 4, ry: -12 }));

    /* plant beside the desk */
    p.push(cube({ w: 62, h: 66, d: 62, x: 158, y: -33, z: 30, c: C.foamAlt, r: 10 }));
    p.push(cube({ w: 10, h: 70, d: 10, x: 158, y: -100, z: 30, c: '#8FA89E', r: 4 }));
    [[-30, -140, 18], [26, -150, -14], [2, -168, 26]].forEach(function (l) {
      p.push(cube({ w: 46, h: 12, d: 30, x: 158 + l[0], y: l[1], z: 30 + l[2],
                    c: '#8FA89E', r: 12, ry: l[0] * 0.6, rz: l[0] > 0 ? 22 : -22 }));
    });

    return p.join('');
  }

  /* =========================================================================
     Mount + pointer control
     ========================================================================= */

  const MODELS = {
    reformer: reformer,
    mat: mat,
    studioFloor: studioFloor,
    matRoom: matRoom,
    reception: reception
  };

  const GRADIENTS = {
    reformer:    ['#F7DEE2', '#E4C3B4'],
    mat:         ['#EFE4D8', '#DCC8BE'],
    studioFloor: ['#F7DEE2', '#E3D3C3'],
    matRoom:     ['#EFE4D8', '#E8D5CB'],
    reception:   ['#DCE7E3', '#E3D3C3']
  };

  /* Camera limits. Yaw spins freely; pitch is clamped so the floor plane and
     its contact shadows never flip over and read as nonsense. */
  const BASE_YAW = -32;
  const BASE_PITCH = -20;
  const PITCH_MIN = -72;
  const PITCH_MAX = 8;

  const DRAG_HINT =
    '<span class="p3d-hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 7l-3 5 3 5M16 7l3 5-3 5"/></svg>Drag to spin</span>';

  /**
   * Markup for one scene.
   * @param {string} which  key of MODELS
   * @param {string} label  accessible description
   * @param {string} tag    caption chip, or '' for none
   */
  function scene(which, label, tag) {
    const build = MODELS[which] || MODELS.reformer;
    const grad = GRADIENTS[which] || GRADIENTS.reformer;

    return '<div class="p3d" data-p3d role="img" aria-label="' + label + '" ' +
      'style="--ph-a:' + grad[0] + ';--ph-b:' + grad[1] + '">' +
      '<div class="p3d-stage">' + build() + '</div>' +
      DRAG_HINT +
      (tag ? '<span class="p3d-tag" aria-hidden="true">' + tag + '</span>' : '') +
      '</div>';
  }

  /* ------------------------------------------------------------------------
     Drag to spin, with release momentum and an idle drift.

     One rAF loop per scene, started only while something is actually moving,
     so an untouched page settles to zero work.
     ------------------------------------------------------------------------ */
  function control(root) {
    if (root.dataset.p3dReady === 'true') return;
    root.dataset.p3dReady = 'true';

    const stage = root.querySelector('.p3d-stage');
    if (!stage) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let yaw = BASE_YAW;
    let pitch = BASE_PITCH;
    let vYaw = 0;
    let vPitch = 0;
    let dragging = false;
    let pointerId = null;
    let lastX = 0, lastY = 0, lastT = 0;
    let drift = 0;            // eased-in amplitude of the idle sway
    let phase = Math.random() * Math.PI * 2;
    let raf = null;

    /* ----------------------------------------------------------------------
       Fit the model to its scene automatically.

       Models are authored at whatever size suits them — the studio floor is
       several times wider than a single mat — so rather than hand-tuning a
       scale per model per breakpoint, measure the rendered bounding box and
       solve for the scale and offset that centre it in the box. Two passes:
       one to size it, one to centre what that produced.
       ---------------------------------------------------------------------- */
    function measure() {
      const box = root.getBoundingClientRect();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const parts = stage.querySelectorAll('.p3d-cube > i, .p3d-ring, .p3d-ball');
      for (let i = 0; i < parts.length; i++) {
        const r = parts[i].getBoundingClientRect();
        if (!r.width && !r.height) continue;
        if (r.left < minX) minX = r.left;
        if (r.right > maxX) maxX = r.right;
        if (r.top < minY) minY = r.top;
        if (r.bottom > maxY) maxY = r.bottom;
      }
      if (minX > maxX) return null;
      return {
        w: maxX - minX, h: maxY - minY,
        dx: (minX + maxX) / 2 - (box.left + box.right) / 2,
        dy: (minY + maxY) / 2 - (box.top + box.bottom) / 2,
        boxW: box.width, boxH: box.height
      };
    }

    function autoFit() {
      if (!root.offsetParent && root.offsetWidth === 0) return;   // hidden
      stage.style.setProperty('--p3d-fit', '1');
      stage.style.setProperty('--p3d-cx', '0px');
      stage.style.setProperty('--p3d-cy', '0px');

      const m = measure();
      if (!m || !m.w || !m.h) return;

      // Fit to 78%, not 100%: the idle drift swings the model a few degrees
      // after this measurement, which widens its projected bounds. Measured at
      // 84% a wide model clipped by ~3px at the drift extreme.
      const k = Math.min(m.boxW * 0.78 / m.w, m.boxH * 0.78 / m.h);
      stage.style.setProperty('--p3d-fit', k.toFixed(4));

      const c = measure();
      if (!c) return;
      stage.style.setProperty('--p3d-cx', (-c.dx).toFixed(1) + 'px');
      stage.style.setProperty('--p3d-cy', (-c.dy).toFixed(1) + 'px');
    }

    function apply() {
      const shownYaw = yaw + Math.sin(phase) * drift;
      stage.style.setProperty('--yaw', shownYaw.toFixed(2) + 'deg');
      stage.style.setProperty('--pitch', pitch.toFixed(2) + 'deg');
      // Keep billboarded parts (the soft balls) facing the camera.
      stage.style.setProperty('--bill-y', (-shownYaw).toFixed(2) + 'deg');
      stage.style.setProperty('--bill-x', (-pitch).toFixed(2) + 'deg');
    }

    function tick() {
      raf = null;
      let busy = false;

      if (!dragging) {
        if (Math.abs(vYaw) > 0.01 || Math.abs(vPitch) > 0.01) {
          yaw += vYaw;
          pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + vPitch));
          vYaw *= 0.995 - 0.055;       // ~0.94 friction
          vPitch *= 0.94;
          drift = Math.max(0, drift - 0.25);
          busy = true;
        } else if (!reduce) {
          vYaw = 0;
          vPitch = 0;
          drift = Math.min(4, drift + 0.06);
          phase += 0.007;
          busy = true;
        }
      }

      apply();
      if (busy) raf = requestAnimationFrame(tick);
    }

    function wake() {
      if (raf === null) raf = requestAnimationFrame(tick);
    }

    root.addEventListener('pointerdown', function (e) {
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      vYaw = 0;
      vPitch = 0;
      drift = 0;
      root.classList.add('is-grabbing', 'is-touched');
      root.setPointerCapture(e.pointerId);
      wake();
    });

    root.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dt = Math.max(1, e.timeStamp - lastT);

      yaw += dx * 0.45;
      pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy * 0.28));

      // px/ms → deg/frame, so a flick throws it at the speed it was moving
      vYaw = (dx * 0.45) / dt * 16;
      vPitch = (dy * 0.28) / dt * 16;

      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      apply();
    });

    function release(e) {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      root.classList.remove('is-grabbing');
      if (reduce) { vYaw = 0; vPitch = 0; }
      // A stale flick shouldn't fling it after the finger rested first
      if (e.timeStamp - lastT > 120) { vYaw = 0; vPitch = 0; }
      vYaw = Math.max(-14, Math.min(14, vYaw));
      vPitch = Math.max(-8, Math.min(8, vPitch));
      wake();
    }

    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);

    /* Keyboard: arrow keys nudge the model for anyone not using a pointer. */
    root.tabIndex = 0;
    root.addEventListener('keydown', function (e) {
      const step = e.shiftKey ? 24 : 8;
      let handled = true;
      if (e.key === 'ArrowLeft') yaw -= step;
      else if (e.key === 'ArrowRight') yaw += step;
      else if (e.key === 'ArrowUp') pitch = Math.max(PITCH_MIN, pitch - step / 2);
      else if (e.key === 'ArrowDown') pitch = Math.min(PITCH_MAX, pitch + step / 2);
      else handled = false;
      if (!handled) return;
      e.preventDefault();
      root.classList.add('is-touched');
      drift = 0;
      apply();
      wake();
    });

    /* Idle only while on screen — a scene scrolled out of view does no work. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) wake();
          else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { rootMargin: '120px' }).observe(root);
    } else {
      wake();
    }

    apply();
    autoFit();

    // Re-fit when the box changes size (breakpoint change, orientation flip)
    if ('ResizeObserver' in window) {
      let t = null;
      new ResizeObserver(function () {
        clearTimeout(t);
        t = setTimeout(autoFit, 120);
      }).observe(root);
    } else {
      window.addEventListener('resize', function () { setTimeout(autoFit, 150); });
    }
  }

  /** Attach the controller to every scene on the page. Safe to call twice. */
  function init(root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-p3d]'), control);
  }

  window.Models3D = {
    reformer: reformer,
    mat: mat,
    studioFloor: studioFloor,
    matRoom: matRoom,
    reception: reception,
    scene: scene,
    init: init
  };

  document.addEventListener('DOMContentLoaded', function () { init(); });
})();
