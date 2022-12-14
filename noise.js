/*
 *
 * uber noise class
 *
 */

const defaultUp = new Vector(0, 1, 0);

class Noise {
  constructor(opts) {
    opts = opts || {};

    this.pos = new Vector(0, 0, 0);

    this.scale = opts.scale || opts.scl || 1;
    this.checkValue("scale");

    this.power = opts.power || opts.pow || 1;
    this.checkValue("power");

    this.shift = opts.shift || new Vector(0, 0, 0);

    // fbm stuff
    // how many layers
    this.octaves = opts.octaves || opts.oct || 0;
    this.checkValue("octaves");
    // how much to multiply amplitude per layer
    this.gain = opts.gain || opts.persistence || opts.per || 0.5;
    this.checkValue("gain");
    // how much to multiply scale per layer
    this.lacunarity = opts.lacunarity || opts.lac || 2;
    this.checkValue("lacunarity");

    // how much previous layers influence amplitude of later layers
    this.erosion = opts.erosion != undefined ? opts.erosion : 0;
    this.checkValue("erosion");
    // how much to move x, y, z to calculate derivative
    // (x2 - x1) / delta, (y2 - y1) / delta, (z2 - z1) / delta
    this.delta =
      opts.delta != undefined
        ? opts.delta
        : 0.0001 * this.getValue("scale", 0, 0, 0);

    // amp is also only used for fbm
    this.amp = opts.amplitude || opts.amp;
    this.checkValue("amp");

    if (this.octaves > 0 || opts.layers != undefined) {
      this.layers = [];
      for (
        let i = 0;
        i <= this.octaves || (opts.layers && i < opts.layers.length);
        i++
      ) {
        let settings =
          opts.layers != undefined && opts.layers.length > i
            ? opts.layers[i]
            : {};
        if (settings.seed == undefined) settings.seed = this.seed * 3 + i * 5;

        let n = settings;
        if (opts.all) {
          for (let k of Object.keys(opts.all)) {
            n[k] = opts.all[k];
          }
        }
        if (n.isNoise != true) {
          n = new Noise(settings);
        }
        this.layers.push(n);
      }
    } else {
      this.simplex = new SimplexNoise(this.seed);
    }

    if (opts.combine != undefined) {
      this.combine = opts.combine;
      this.checkValue("combine");
    }

    this.mod = opts.mod;

    this.sharpness = opts.sharpness;
    this.checkValue("sharpness");

    if (opts.warp != undefined) {
      this.warp = opts.warp;
      this.checkValue("warp");
      if (opts.warpNoise) {
        this.warpNoise = opts.warpNoise;
        if (this.warpNoise.isNoise != true)
          this.warpNoise = new Noise(opts.warpNoise);
      }
    }
    if (opts.warp2 != undefined) {
      this.warp2 = opts.warp2;
      this.checkValue("warp2");

      if (opts.warpNoise2) {
        this.warpNoise2 = opts.warpNoise2;
        if (this.warpNoise2.isNoise != true)
          this.warpNoise2 = new Noise(opts.warpNoise2);
      }
    }

    this.steps = opts.steps;
    this.checkValue("steps");

    this.min = opts.min != undefined ? opts.min : -1;
    this.checkValue("min");

    this.max = opts.max != undefined ? opts.max : 1;
    this.checkValue("max");

    this.defaultUp = opts.defaultUp;

    if (opts.amps) {
      this.multiplyAmps(opts.amps);
    }

    this.central = opts.central;

    this.tileX = opts.tileX;
    this.tileY = opts.tileY;

    this.isNoise = true;

    this.seed = opts.seed;
  }

  // checks if this[key] is an object or a number and
  // if it is an object but .isNoise != true
  // turns that into a new Noise object
  checkValue(key) {
    let v = this[key];
    if (v != undefined && typeof v != "number" && !v.isNoise)
      this[key] = new Noise(v);
  }

  get seed() {
    return this._seed;
  }
  set seed(seed) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this._seed = seed || Math.random() * 100000;
    if (this.simplex) this.simplex = new SimplexNoise(this._seed);
    if (this.layers) {
      let i = 13;
      for (let l of this.layers) {
        l.setSeed(this._seed * 3 + i++ * 7);
      }
    }

    for (let k of Object.keys(this)) {
      if (this[k] != undefined && this[k].isNoise) {
        this[k].setSeed(this._seed * 17 + 513);
      }
    }

    return seed;
  }

  set x(x) {
    this.shift.x = x;
  }
  get x() {
    return this.shift.x;
  }
  set y(y) {
    this.shift.y = y;
  }
  get y() {
    return this.shift.y;
  }
  set z(z) {
    this.shift.z = z;
  }
  get z() {
    return this.shift.z;
  }
  shift(dX, dY, dZ) {
    this.shift.x += dX;
    this.shift.y += dY;
    this.shift.z += dZ;
  }

  multiplyAmps(arr) {
    if (this.layers == undefined) return;

    for (let i = 0; i < this.layers.length && i < arr.length; i++) {
      this.layers[i].amp *= arr[i];
    }
  }

  getFBM(x, y, z, up, noErosion) {
    let scale = this.getValue("scale", x, y, z);

    // if no layers exit early
    if (this.layers == undefined) {
      // if object has simplex noise return result of that
      if (this.simplex != undefined)
        return this.simplex.noise3D(x * scale, y * scale, z * scale);
      // no data
      return 0;
    }
    // for calculating angle between derivative and tangent
    // when erosion > 0
    up =
      up || (this.defaultUp != undefined ? this.defaultUp(x, y, z) : defaultUp);

    let maxAmp = 1;
    let amp = 1,
      freq = scale;

    let lac = this.getValue("lacunarity", x, y, z);
    let gain = this.getValue("gain", x, y, z);

    // reuse vector
    this.sum = this.sum || new Vector();
    this.sum.set(0, 0, 0);

    let n = 0;
    let erosion = noErosion ? 0 : this.getValue("erosion", x, y, z);
    let octaves = this.getValue("octaves", x, y, z);
    for (let i = 0; i <= octaves && i < this.layers.length; i++) {
      let l = this.layers[i];
      let layerAmp = l.getValue("amp", x, y, z) || 1;
      let val = l.get(x * freq, y * freq, z * freq, up) * amp * layerAmp;
      if (erosion > 0) {
        let d = l.getDerivative(x * freq, y * freq, z * freq);
        d.setLength(amp * layerAmp);

        this.sum.add(d);
        // calculate normalized angle between sum of derivatives and tangent, should be between 0 and 1
        let mult = Math.abs(1 - up.angleTo(this.sum) / Math.PI);

        n += val * (mult * erosion + 1 - erosion);
      } else {
        n += val;
      }
      amp *= gain;
      freq *= lac;
      maxAmp += amp * layerAmp;
    }
    return n / maxAmp;
  }

  // main method, returns value between -1 and +1
  getNoise(x, y, z, up) {
    x += this.shift.x;
    y += this.shift.y;
    z += this.shift.z;

    let warp = this.getValue("warp", x, y, z);
    if (warp) {
      if (this.warpNoise) {
        let scl = this.warpNoise.getValue("scale", x, y, z);
        x +=
          this.warpNoise.get(
            x - 74.98 * scl,
            y + 49.33 * scl,
            z + 11.11 * scl
          ) * warp;
        y +=
          this.warpNoise.get(
            x + 13.23 * scl,
            y + 56.79 * scl,
            z + 93.31 * scl
          ) * warp;
        z +=
          this.warpNoise.get(
            x + 11.47 * scl,
            y + 17.98 * scl,
            z + 23.56 * scl
          ) * warp;
      } else {
        let scl = this.getValue("scale", x, y, z);
        x +=
          this.getFBM(
            x - 74.98 * scl,
            y + 41.33 * scl,
            z + 18.1 * scl,
            up,
            true
          ) * warp;
        y +=
          this.getFBM(
            x + 1.23 * scl,
            y + 5.79 * scl,
            z + 9.31 * scl,
            up,
            true
          ) * warp;
        z +=
          this.getFBM(
            x + 11.47 * scl,
            y + 17.98 * scl,
            z + 23.56 * scl,
            up,
            true
          ) * warp;
      }
    }

    let warp2 = this.getValue("warp2", x, y, z);
    if (warp2) {
      if (this.warpNoise2) {
        let scl = this.warpNoise2.getValue("scale", x, y, z);
        x +=
          this.warpNoise2.get(x + 1.23 * scl, y + 5.79 * scl, z + 9.31 * scl) *
          warp2;
        y +=
          this.warpNoise2.get(
            x + 11.47 * scl,
            y + 17.98 * scl,
            z + 23.56 * scl
          ) * warp2;
        z +=
          this.warpNoise2.get(
            x - 71.98 * scl,
            y + 43.33 * scl,
            z + 93.1 * scl
          ) * warp2;
      } else {
        let scl = this.getValue("scale", x, y, z);
        x +=
          this.getFBM(
            x + 11.47 * scl,
            y + 17.98 * scl,
            z + 23.56 * scl,
            up,
            true
          ) * warp2;
        y +=
          this.getFBM(
            x - 73.98 * scl,
            y + 44.33 * scl,
            z + 15.13 * scl,
            up,
            true
          ) * warp2;
        z +=
          this.getFBM(
            x + 11.23 * scl,
            y + 53.79 * scl,
            z + 96.31 * scl,
            up,
            true
          ) * warp2;
      }
    }

    let norm = this.getFBM(x, y, z, up);

    if (this.clamp) {
      norm = Math.min(norm, 1);
      norm = Math.max(norm, -1);
    }

    if (this.sharpness) {
      let sharp = this.getValue("sharpness", x, y, z);
      let billow = (Math.abs(norm) - 0.5) * 2;
      let ridged = (0.5 - Math.abs(norm)) * 2;

      norm = MathUtils.lerp(norm, billow, Math.max(0, sharp));
      norm = MathUtils.lerp(norm, ridged, Math.abs(Math.min(0, sharp)));
    }

    // modify with function
    if (this.mod) {
      norm = this.mod(norm, x, y, z, this, up);
    }

    let power = this.getValue("power", x, y, z);
    if (power && power != 1) {
      // convert to [0 - 1], apply power and back to [-1, 1]
      norm = (Math.pow((norm + 1) * 0.5, power) - 0.5) * 2;
    }

    //combine with other noise:
    if (this.combine) {
      norm *= this.getValue("combine", x, y, z);
    }

    // turn into steps
    // (e.g. 2 steps => only 0 or 1, 3 steps => 0, 0.5 and 1)
    let steps = Math.round(this.getValue("steps", x, y, z));
    if (steps != undefined && steps > 1) {
      let s = (Math.floor((norm + 1) * steps * 0.5) / (steps - 1) - 0.5) * 2;
      return s;
    }

    return norm;
  }

  getDerivative(x, y, z, n) {
    // left side or central difference
    // very expensive (four/six noise calls), should be changed to analytical derivatives
    // see https://iquilezles.org/www/articles/morenoise/morenoise.htm

    n = n || this.get(x, y, z);
    let mov = this.delta;

    let dx =
      (this.central ? this.get(x - mov, y, z) : n) - this.get(x + mov, y, z);
    let dy =
      (this.central ? this.get(x, y - mov, z) : n) - this.get(x, y + mov, z);
    let dz =
      (this.central ? this.get(x, y, z - mov) : n) - this.get(x, y, z + mov);

    let d = new Vector(dx, dy, dz);
    d.normalize();
    return d;
  }

  // returns value of property at x, y, z
  getValue(key, x, y, z) {
    x = x || 0;
    y = y || 0;
    z = z || 0;
    let v = this[key];
    if (typeof v == "number") return v;
    if (v != undefined && v.isNoise) return v.get(x, y, z);
  }

  // returns noise between -1 and 1
  getNormXYZ(x, y, z, up) {
    x = x || 0;
    y = y || 0;
    z = z || 0;
    if (!this.tileX && !this.tileY) {
      return this.getNoise(x, y, z, up);
    } else {
      let newX = 0,
        newY = 0,
        newZ = 0;
      if (this.tileX) {
        newX = Math.sin(x * Math.PI * 2);
        newY = Math.cos(x * Math.PI * 2);
      }
      if (this.tileY) {
        newY += Math.sin(y * Math.PI * 2);
        newZ = Math.cos(y * Math.PI * 2);
      }
      return this.getNoise(
        (this.tileX ? 0 : x) + newX,
        (this.tileY ? 0 : y) + newY,
        z + newZ
      );
    }
  }
  getNorm(vecOrX, y, z, up) {
    if (typeof vecOrX == "number") {
      return this.getNormXYZ(vecOrX, y, z, up);
    }
    return this.getNormXYZ(vecOrX.x, vecOrX.y, vecOrX.z, vecOrX.up);
  }

  // converts from -1, 1 to min, max
  normToMinMax(norm, x, y, z) {
    let min = this.getValue("min", x, y, z);
    let max = this.getValue("max", x, y, z);
    return (norm + 1) * 0.5 * (max - min) + min;
  }
  // converts from min, max to -1, 1
  minMaxToNorm(minMax, x, y, z) {
    let min = this.getValue("min", x, y, z);
    let max = this.getValue("max", x, y, z);
    return ((minMax - min) / (max - min) - 0.5) * 2;
  }

  // returns noise between min and max
  getXYZ(x, y, z, up) {
    return this.normToMinMax(this.getNormXYZ(x, y, z, up), x, y, z);
  }
  get(vecOrX, y, z, up) {
    if (typeof vecOrX == "number") {
      return this.getXYZ(vecOrX, y, z, up);
    }
    return this.getXYZ(vecOrX.x, vecOrX.y, vecOrX.z, vecOrX.up);
  }
  getValue(x, y, z, up) {
    return this.get(x, y, z, up);
  }
}

/*
 *
 * vector class
 *
 */
class Vector {
  constructor(x, y, z) {
    this.x = x == undefined ? 0 : x;
    this.y = y == undefined ? 0 : y;
    this.z = z == undefined ? 0 : z;

    this.isVector = true;
    this.is2D = z == undefined;
  }
  copy(vec) {
    this.x = vec.x;
    this.y = vec.y;
    this.z = vec.z;
    return this;
  }
  clone() {
    return new Vector(this.x, this.y, this.z);
  }
  set(x, y, z) {
    if (typeof x != "number" && x.x != undefined) {
      return this.set(x.x, x.y, x.z);
    }
    this.x = x == undefined ? 0 : x;
    this.y = y == undefined ? 0 : y;
    this.z = z == undefined ? 0 : z;
    return this;
  }
  add(x, y, z) {
    if (typeof x != "number" && x.x != undefined) {
      return this.add(x.x, x.y, x.z);
    }
    this.x += x == undefined ? 0 : x;
    this.y += y == undefined ? 0 : y;
    this.z += z == undefined ? 0 : z;
    return this;
  }
  sub(x, y, z) {
    if (typeof x != "number" && x.x != undefined) {
      return this.sub(x.x, x.y, x.z);
    }
    this.x -= x == undefined ? 0 : x;
    this.y -= y == undefined ? 0 : y;
    this.z -= z == undefined ? 0 : z;
    return this;
  }
  mult(x, y, z) {
    if (typeof x != "number" && x.x != undefined) {
      return this.mult(x.x, x.y, x.z);
    }
    this.x *= x == undefined ? 0 : x;
    this.y *= y == undefined ? (x == undefined ? 0 : x) : y;
    this.z *= z == undefined ? (x == undefined ? 0 : x) : z;
    return this;
  }
  div(x, y, z) {
    if (typeof x != "number" && x.x != undefined) {
      return this.div(m.x, x.y, x.z);
    }
    this.x /= x == undefined ? 0 : x;
    this.y /= y == undefined ? (x == undefined ? 0 : x) : y;
    this.z /= z == undefined ? (x == undefined ? 0 : x) : z;
    return this;
  }
  dot(vec) {
    return this.x * vec.x + this.y * vec.y + this.z * vec.z;
  }
  cross(vec) {
    return new Vector(
      this.y * vec.z - this.z * vec.y,
      this.z * vec.x - this.x * vec.z,
      this.x * vec.y - this.y * vec.x
    );
  }

  distXYZ(bx, by, bz) {
    let dx = this.x - bx;
    let dy = (this.y || 0) - (by || 0);
    let dz = (this.z || 0) - (bz || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  dist(vec) {
    return this.distXYZ(vec.x, vec.y, vec.z);
  }
  distance(vec) {
    return this.dist(vec);
  }
  distanceTo(vec) {
    return this.dist(vec);
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  setLength(l) {
    this.mult(l / this.length());
    return this;
  }
  limit(l) {
    if (this.length() > l) this.setLength(l);
    return this;
  }

  // 2d only
  heading() {
    return Math.atan2(this.x, this.y);
  }
  // 2d only
  rotate(a) {
    let ca = Math.cos(a);
    let sa = Math.sin(a);
    this.set(ca * this.x - sa * this.y, sa * this.x + ca * this.y);
    return this;
  }

  angleBetween(vec) {
    let d = this.dot(vec);
    let l = this.length() * vec.length();
    return Math.acos(d / l);
  }
  equals(vec) {
    return this.x == vec.x && this.y == vec.y && this.z == vec.z;
  }

  normalize() {
    this.setLength(1);
    return this;
  }
  mag() {
    return this.length();
  }
  setMag(m) {
    this.setLength(m);
    return this;
  }
  manhattanLength() {
    return this.x + this.y + this.z;
  }
  lerp(vec, a) {
    let dx = vec.x - this.x;
    let dy = vec.y - this.y;
    let dz = vec.z - this.z;
    this.add(dx * a, dy * a, dz * a);
    return this;
  }

  // 2d vector from angle and optional length (default length 1)
  static fromAngle2D(a, l) {
    let v = new Vector(Math.cos(a), Math.sin(a));
    if (l) v.setLength(l);
    return v;
  }

  // random 2d vector with length between 0 and 1
  // or set length
  static random2D(l) {
    let v = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (v.length() > 1) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1);
    }
    if (l) v.setLength(l);
    return v;
  }

  // random 3d vector with length between 0 and 1
  // or set length
  static random3D(l) {
    let v = new Vector(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    );
    while (v.length() > 1) {
      v.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
    }
    if (l) v.setLength(l);
    return v;
  }

  static breakIntoParts(a, b, parts) {
    if (a == undefined || b == undefined || !a.isVector || !b.isVector) return;

    parts = Math.floor(parts || 2);
    let arr = [a.clone()];
    for (let i = 1; i < parts; i++) {
      arr.push(a.clone().lerp(b, i / parts));
    }
    arr.push(b.clone());
    return arr;
  }
}

/*
 *
 * simplex-noise.js from https://github.com/jwagner/simplex-noise.js
 *
 */
!(function () {
  "use strict";
  var r = 0.5 * (Math.sqrt(3) - 1),
    e = (3 - Math.sqrt(3)) / 6,
    t = 1 / 6,
    a = (Math.sqrt(5) - 1) / 4,
    o = (5 - Math.sqrt(5)) / 20;
  function i(r) {
    var e;
    (e =
      "function" == typeof r
        ? r
        : r
        ? (function () {
            var r = 0,
              e = 0,
              t = 0,
              a = 1,
              o =
                ((i = 4022871197),
                function (r) {
                  r = r.toString();
                  for (var e = 0; e < r.length; e++) {
                    var t = 0.02519603282416938 * (i += r.charCodeAt(e));
                    (t -= i = t >>> 0),
                      (i = (t *= i) >>> 0),
                      (i += 4294967296 * (t -= i));
                  }
                  return 2.3283064365386963e-10 * (i >>> 0);
                });
            var i;
            (r = o(" ")), (e = o(" ")), (t = o(" "));
            for (var n = 0; n < arguments.length; n++)
              (r -= o(arguments[n])) < 0 && (r += 1),
                (e -= o(arguments[n])) < 0 && (e += 1),
                (t -= o(arguments[n])) < 0 && (t += 1);
            return (
              (o = null),
              function () {
                var o = 2091639 * r + 2.3283064365386963e-10 * a;
                return (r = e), (e = t), (t = o - (a = 0 | o));
              }
            );
          })(r)
        : Math.random),
      (this.p = n(e)),
      (this.perm = new Uint8Array(512)),
      (this.permMod12 = new Uint8Array(512));
    for (var t = 0; t < 512; t++)
      (this.perm[t] = this.p[255 & t]), (this.permMod12[t] = this.perm[t] % 12);
  }
  function n(r) {
    var e,
      t = new Uint8Array(256);
    for (e = 0; e < 256; e++) t[e] = e;
    for (e = 0; e < 255; e++) {
      var a = e + ~~(r() * (256 - e)),
        o = t[e];
      (t[e] = t[a]), (t[a] = o);
    }
    return t;
  }
  (i.prototype = {
    grad3: new Float32Array([
      1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1,
      0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
    ]),
    grad4: new Float32Array([
      0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1,
      -1, 0, -1, -1, 1, 0, -1, -1, -1, 1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1,
      0, -1, -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1, 1, 1,
      0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1,
      -1, -1, 0, 1, -1, -1, 0, -1, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1,
      -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0,
    ]),
    noise2D: function (t, a) {
      var o,
        i,
        n = this.permMod12,
        f = this.perm,
        s = this.grad3,
        v = 0,
        h = 0,
        l = 0,
        u = (t + a) * r,
        d = Math.floor(t + u),
        p = Math.floor(a + u),
        M = (d + p) * e,
        m = t - (d - M),
        c = a - (p - M);
      m > c ? ((o = 1), (i = 0)) : ((o = 0), (i = 1));
      var y = m - o + e,
        w = c - i + e,
        g = m - 1 + 2 * e,
        A = c - 1 + 2 * e,
        x = 255 & d,
        q = 255 & p,
        D = 0.5 - m * m - c * c;
      if (D >= 0) {
        var S = 3 * n[x + f[q]];
        v = (D *= D) * D * (s[S] * m + s[S + 1] * c);
      }
      var U = 0.5 - y * y - w * w;
      if (U >= 0) {
        var b = 3 * n[x + o + f[q + i]];
        h = (U *= U) * U * (s[b] * y + s[b + 1] * w);
      }
      var F = 0.5 - g * g - A * A;
      if (F >= 0) {
        var N = 3 * n[x + 1 + f[q + 1]];
        l = (F *= F) * F * (s[N] * g + s[N + 1] * A);
      }
      return 70 * (v + h + l);
    },
    noise3D: function (r, e, a) {
      var o,
        i,
        n,
        f,
        s,
        v,
        h,
        l,
        u,
        d,
        p = this.permMod12,
        M = this.perm,
        m = this.grad3,
        c = (r + e + a) * (1 / 3),
        y = Math.floor(r + c),
        w = Math.floor(e + c),
        g = Math.floor(a + c),
        A = (y + w + g) * t,
        x = r - (y - A),
        q = e - (w - A),
        D = a - (g - A);
      x >= q
        ? q >= D
          ? ((s = 1), (v = 0), (h = 0), (l = 1), (u = 1), (d = 0))
          : x >= D
          ? ((s = 1), (v = 0), (h = 0), (l = 1), (u = 0), (d = 1))
          : ((s = 0), (v = 0), (h = 1), (l = 1), (u = 0), (d = 1))
        : q < D
        ? ((s = 0), (v = 0), (h = 1), (l = 0), (u = 1), (d = 1))
        : x < D
        ? ((s = 0), (v = 1), (h = 0), (l = 0), (u = 1), (d = 1))
        : ((s = 0), (v = 1), (h = 0), (l = 1), (u = 1), (d = 0));
      var S = x - s + t,
        U = q - v + t,
        b = D - h + t,
        F = x - l + 2 * t,
        N = q - u + 2 * t,
        C = D - d + 2 * t,
        P = x - 1 + 0.5,
        T = q - 1 + 0.5,
        _ = D - 1 + 0.5,
        j = 255 & y,
        k = 255 & w,
        z = 255 & g,
        B = 0.6 - x * x - q * q - D * D;
      if (B < 0) o = 0;
      else {
        var E = 3 * p[j + M[k + M[z]]];
        o = (B *= B) * B * (m[E] * x + m[E + 1] * q + m[E + 2] * D);
      }
      var G = 0.6 - S * S - U * U - b * b;
      if (G < 0) i = 0;
      else {
        var H = 3 * p[j + s + M[k + v + M[z + h]]];
        i = (G *= G) * G * (m[H] * S + m[H + 1] * U + m[H + 2] * b);
      }
      var I = 0.6 - F * F - N * N - C * C;
      if (I < 0) n = 0;
      else {
        var J = 3 * p[j + l + M[k + u + M[z + d]]];
        n = (I *= I) * I * (m[J] * F + m[J + 1] * N + m[J + 2] * C);
      }
      var K = 0.6 - P * P - T * T - _ * _;
      if (K < 0) f = 0;
      else {
        var L = 3 * p[j + 1 + M[k + 1 + M[z + 1]]];
        f = (K *= K) * K * (m[L] * P + m[L + 1] * T + m[L + 2] * _);
      }
      return 32 * (o + i + n + f);
    },
    noise4D: function (r, e, t, i) {
      var n,
        f,
        s,
        v,
        h,
        l,
        u,
        d,
        p,
        M,
        m,
        c,
        y,
        w,
        g,
        A,
        x,
        q = this.perm,
        D = this.grad4,
        S = (r + e + t + i) * a,
        U = Math.floor(r + S),
        b = Math.floor(e + S),
        F = Math.floor(t + S),
        N = Math.floor(i + S),
        C = (U + b + F + N) * o,
        P = r - (U - C),
        T = e - (b - C),
        _ = t - (F - C),
        j = i - (N - C),
        k = 0,
        z = 0,
        B = 0,
        E = 0;
      P > T ? k++ : z++,
        P > _ ? k++ : B++,
        P > j ? k++ : E++,
        T > _ ? z++ : B++,
        T > j ? z++ : E++,
        _ > j ? B++ : E++;
      var G = P - (l = k >= 3 ? 1 : 0) + o,
        H = T - (u = z >= 3 ? 1 : 0) + o,
        I = _ - (d = B >= 3 ? 1 : 0) + o,
        J = j - (p = E >= 3 ? 1 : 0) + o,
        K = P - (M = k >= 2 ? 1 : 0) + 2 * o,
        L = T - (m = z >= 2 ? 1 : 0) + 2 * o,
        O = _ - (c = B >= 2 ? 1 : 0) + 2 * o,
        Q = j - (y = E >= 2 ? 1 : 0) + 2 * o,
        R = P - (w = k >= 1 ? 1 : 0) + 3 * o,
        V = T - (g = z >= 1 ? 1 : 0) + 3 * o,
        W = _ - (A = B >= 1 ? 1 : 0) + 3 * o,
        X = j - (x = E >= 1 ? 1 : 0) + 3 * o,
        Y = P - 1 + 4 * o,
        Z = T - 1 + 4 * o,
        $ = _ - 1 + 4 * o,
        rr = j - 1 + 4 * o,
        er = 255 & U,
        tr = 255 & b,
        ar = 255 & F,
        or = 255 & N,
        ir = 0.6 - P * P - T * T - _ * _ - j * j;
      if (ir < 0) n = 0;
      else {
        var nr = (q[er + q[tr + q[ar + q[or]]]] % 32) * 4;
        n =
          (ir *= ir) *
          ir *
          (D[nr] * P + D[nr + 1] * T + D[nr + 2] * _ + D[nr + 3] * j);
      }
      var fr = 0.6 - G * G - H * H - I * I - J * J;
      if (fr < 0) f = 0;
      else {
        var sr = (q[er + l + q[tr + u + q[ar + d + q[or + p]]]] % 32) * 4;
        f =
          (fr *= fr) *
          fr *
          (D[sr] * G + D[sr + 1] * H + D[sr + 2] * I + D[sr + 3] * J);
      }
      var vr = 0.6 - K * K - L * L - O * O - Q * Q;
      if (vr < 0) s = 0;
      else {
        var hr = (q[er + M + q[tr + m + q[ar + c + q[or + y]]]] % 32) * 4;
        s =
          (vr *= vr) *
          vr *
          (D[hr] * K + D[hr + 1] * L + D[hr + 2] * O + D[hr + 3] * Q);
      }
      var lr = 0.6 - R * R - V * V - W * W - X * X;
      if (lr < 0) v = 0;
      else {
        var ur = (q[er + w + q[tr + g + q[ar + A + q[or + x]]]] % 32) * 4;
        v =
          (lr *= lr) *
          lr *
          (D[ur] * R + D[ur + 1] * V + D[ur + 2] * W + D[ur + 3] * X);
      }
      var dr = 0.6 - Y * Y - Z * Z - $ * $ - rr * rr;
      if (dr < 0) h = 0;
      else {
        var pr = (q[er + 1 + q[tr + 1 + q[ar + 1 + q[or + 1]]]] % 32) * 4;
        h =
          (dr *= dr) *
          dr *
          (D[pr] * Y + D[pr + 1] * Z + D[pr + 2] * $ + D[pr + 3] * rr);
      }
      return 27 * (n + f + s + v + h);
    },
  }),
    (i._buildPermutationTable = n),
    "undefined" != typeof define &&
      define.amd &&
      define(function () {
        return i;
      }),
    "undefined" != typeof exports
      ? (exports.SimplexNoise = i)
      : "undefined" != typeof window && (window.SimplexNoise = i),
    "undefined" != typeof module && (module.exports = i);
})();
