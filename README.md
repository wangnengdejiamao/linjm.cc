# linjm.cc — Jiamao Lin (林佳茂)

Personal academic site for Jiamao Lin, School of Physics and Astronomy,
Sun Yat-sen University. Static HTML/CSS/JS — **no build step, no dependencies**.

## Contents
- Interactive **cyclotron emission** animation of a polar (AM Her star), with a
  live, geometry-driven beaming light curve.
- A **cyclotron spectrum lab**: drag the magnetic field strength `B` and watch the
  harmonic humps slide across the optical band (λ_n ≈ 107.1 / (n·B[MG]) µm).
- Research, publications and contact sections.

The two visualizations are **schematic teaching tools**, clearly labelled as such —
they illustrate the physics, they are not fits to specific data.

## Local preview
```bash
cd "个人网页"
python3 -m http.server 8000   # then open http://localhost:8000
```

## File layout
```
index.html        markup + content
css/styles.css    all styling
js/starfield.js   background star field
js/hero.js        hero white-dwarf figure
js/cyclotron.js   main accretion animation + light curve
js/spectrum.js    interactive harmonic spectrum
js/main.js        nav / scroll / stats
CNAME             custom domain (linjm.cc)
.nojekyll         tells GitHub Pages to serve files as-is
```

## Deploy on GitHub Pages (custom domain linjm.cc)
1. Create a repo named **`linjm.cc`** (or `<username>.github.io`) on GitHub.
2. Push this folder to the `main` branch.
3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
4. Under **Custom domain**, enter `linjm.cc` and save (the `CNAME` file already sets this).
5. At your DNS provider, add records pointing to GitHub Pages:
   - Apex `linjm.cc` → four `A` records:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (and optionally the matching `AAAA` records for IPv6).
   - `www` → `CNAME` → `<username>.github.io`
6. Wait for DNS to propagate, then tick **Enforce HTTPS** in Pages settings.

> Content note: the publications list intentionally contains only the one paper that
> could be verified. Add the rest (with correct author orders and DOIs) before sharing.


## Black-hole superradiance (Figure 5)

Open `research.html#superradiance`. The new figure connects an original local-wave
Canvas schematic to the analytic sufficient stability bounds in Lin et al.,
Physics Letters B 819 (2021) 136392, https://arxiv.org/abs/2105.02161.
It supports extremal Kerr and Kerr–Newman backgrounds, scalar mass/frequency
controls, charged-case rotation/coupling controls, and a clickable parameter map.
All formulas are dimensionless (G = c = hbar = M = 1), with m = 1 fixed.
The region outside the sufficient proof is not labeled unstable. The animation
is explanatory, not a numerical wave evolution or an amplification calculation.

Files: `js/superradiance-model.js`, `js/superradiance.js`, `css/superradiance.css`.
The component has no external dependencies and pauses outside the viewport.
Reduced-motion settings start it paused; all parameters have keyboard controls.

Run the physics boundary checks:
```bash
node tests/superradiance-model.test.cjs
```


### Schwarzschild optical view

Figure 5 now opens with an original WebGL light-bending view. Drag sideways to orbit;
use the angle and zoom sliders, three camera presets, pause, color-shift toggle or
full-screen mode. On touchscreens, vertical gestures continue scrolling the page.
Keyboard users can focus the canvas and use arrows to orbit/tilt and +/- to zoom.

`js/blackhole-optics.js` traces null rays in the Schwarzschild orbital plane with
u'' = 3u² - u, G = c = M = 1, RK4 step 0.025, maximum 480 steps. The static observer
is at 36M, the horizon at 2M, and the illustrative opaque disk spans 6M–22M.
The color-shift toggle applies gravitational and circular-orbit Doppler shifts,
with illustrative emissivity, tone mapping and mild photographic glow. Extremely
near-critical rays that exhaust the finite angular budget are drawn dark; this is
an optical illustration, not a precision image of Kerr or an accretion-flow model.
The separate Kerr/Kerr–Newman superradiance classifier is unchanged.

The renderer has no external assets or dependencies. Pixel work is capped, input
renders are coalesced, motion pauses offscreen/in background, reduced-motion starts
paused, and context loss/no-WebGL shows a fallback without affecting the science
controls. Camera controls are independent of the paper's field parameters.

Additional numerical validation (CPU double precision, not a GPU accuracy claim):
```bash
node tests/blackhole-geodesic.test.cjs
```
This checks the independent null constraint, analytic critical impact parameter,
step convergence, disk intersections, and the distinction between angular-budget
exhaustion and physical capture.


### Compatibility rendering (2026-10-01)

If WebGL creation, compilation, framebuffer allocation or the active GPU context
fails, the optical view switches automatically to an interactive Canvas 2D renderer.
The software renderer caches the same Schwarzschild null-ray geometry and re-shades
it for animation. A Worker keeps calculations off the UI thread; without Worker
support the tracing is divided into small row batches. Camera changes first show
a fast 80,000-pixel preview. After 350 ms without camera movement, it traces the
display resolution (up to 2.6 million pixels, device scale up to 2). Animation
reuses that detailed geometry and cannot reset the refinement timer or reduce
its resolution. It omits the GPU bloom pass. Camera, zoom, color shifts and pause
remain available.

An adaptive lookup table accelerates the same RK4 orbital equation. Cubic
interpolation is used between impact parameters; near-critical rays and uncertain
disk-edge intersections use direct integration. Frames are committed as complete
images, and cancelled camera jobs cannot overwrite a later view.

Files: `js/blackhole-software-core.js`, `js/blackhole-software-runner.js`,
`js/blackhole-software-worker.js`, `js/blackhole-software.js`.
They have no external dependencies.
Explicit compatibility preview: `research.html?blackhole=software#superradiance`.
Main-thread compatibility test: `research.html?blackhole=software-main#superradiance`.
Regression check for rapid camera changes while a partial view is being traced:
```bash
node tests/blackhole-software-cache.test.cjs
node tests/blackhole-software-runner.test.cjs
```
