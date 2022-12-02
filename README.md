## Noise

3D Uber noise javscript class for all your noise needs.

- seeded
- scaling, pow
- fBM
- erosion-like fBM
- domain warping
- ridges, billows
- stepped noise
- combined noise
- tileable noise

### Get noise

noise.get(x, y, z, up [optional]);

OR

noise.get(vector);

Change settings of individual noise layers with .layers = [{}, {}] or .all = {}
Set relative amplitude of layers with .amp.

### Seeding

set .seed to a number

### Scaling, pow

set .scale to zoom in or out.
set .power to do n^(power) where n between 0 - 1

### fBM (and erosion-like fBM)

Does fBM by setting .octaves > 0
Control fBM with .persistence and .lacunarity
Advanced erosion like fBM with .erosion > 0
(currently very slow, needs up vector if not [0, 1, 0])

### Domain warping (slow-ish)

set .warp != 0 for domain warping.
Uses the same noise per default, can be changed by settings .warpNoise
Second order domain warping available with .warp2 and .warpNoise2

### Ridges, billows

set .sharpness > 0 for billowed noise (1.0 completely billowed).
set .sharpness < 0 for ridged noise (-1.0 completely ridged).

### Stepped noise

set .steps > 0 for stepped noise with .steps as number of steps.

### tileable noise

set .tileX = true to tile on x axis between 0 and 1
set .tileY = true to tile on y axis between 0 and 1
set .tileZ = true to tile on z axis between 0 and 1

### Combine

set .combine = another noise to get

### all options:

seed: Math.random() \* 100000,
scale (scl): 1,
power (pow): 1,
amp: 1,
octaves (oct): 0,
persistence (per): 0.5,
lacunarity (lac): 2,
layers: undefined,
combine: {}, (noise opts)
mod: (val, this, x, y, z, up) => val,
sharpness: 0, (-1 -> 1)
warp: 0,
warp2: 0,
erosion: 0,
steps: undefined (1, 2, 3, 4, ...)
min: -1,
max: 1,
defaultUp: (x, y, z) => new Vector(0, 1, 0),
tileX: false,
tileY: false,
tileZ: false,

## TODO

- [ ] measure noise speed

- [ ] create examples/tests
  - 1D noise on line
  - 2D noise on plane
  - noise on sphere
  - tileable 1D and 2D noise
  - seeded noise
  - erosion 2D noise
  - erosion on sphere
  - stepped noise
  - combine noise
