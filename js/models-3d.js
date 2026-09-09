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
     Mount
     ========================================================================= */

  /**
   * Render a model into a scene element.
   * @param {string} which  'reformer' | 'mat'
   * @param {string} label  accessible description
   * @param {string} tag    small caption chip
   */
  function scene(which, label, tag) {
    const build = which === 'reformer' ? reformer : mat;
    const grad = which === 'reformer'
      ? ['#F7DEE2', '#E4C3B4']
      : ['#EFE4D8', '#DCC8BE'];

    return '<div class="p3d" role="img" aria-label="' + label + '" ' +
      'style="--ph-a:' + grad[0] + ';--ph-b:' + grad[1] + '">' +
      '<div class="p3d-stage">' + build() + '</div>' +
      (tag ? '<span class="p3d-tag" aria-hidden="true">' + tag + '</span>' : '') +
      '</div>';
  }

  window.Models3D = { reformer: reformer, mat: mat, scene: scene };
})();
