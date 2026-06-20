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
