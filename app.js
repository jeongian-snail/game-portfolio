const stage = document.getElementById("stage");
const pages = Object.fromEntries(
  [...stage.querySelectorAll(".page")].map((node) => [node.id.slice(5), node]),
);
const ids = Object.keys(pages).filter((key) => key !== "home");
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};
const lerp = (a, b, p) => a + (b - a) * p;
function scale() {
  stage.style.setProperty(
    "--scale",
    Math.min(innerWidth / 1440, innerHeight / 810),
  );
}
scale();
addEventListener("resize", scale);
const angles = { verdure: -4, yoju: 0, nyang: 4 };
const shelfVideoStart = 2.16,
  zoomStart = 3.48,
  closeupAt = 4.88,
  detailsAt = 5.04,
  shelfTrip = 5.72,
  ejectTrip = 2.65;
const films = Object.fromEntries(
  [...stage.querySelectorAll("[data-film]")].map((el) => [el.dataset.film, el]),
);
const chromeBar = stage.querySelector("#chrome");

// The bottom centre of the printed cartridge is its contact point. Keep the
// entire cartridge above the shelf until it is centred over the console slot.
function shelfMotion(home, id, t) {
  const unit = home.querySelector(".shelf-station");
  const power = id ? smooth((t - 1.72) / 0.1) : 0;
  unit.style.setProperty("--power", power);
  const boot = id ? smooth((t - 1.76) / 0.35) : 0;
  unit.style.setProperty("--boot-width", smooth(boot / 0.42));
  unit.style.setProperty(
    "--boot-height",
    0.018 + 0.98 * smooth((boot - 0.35) / 0.65),
  );
  unit.style.setProperty(
    "--boot-light",
    id ? smooth((t - 1.76) / 0.12) * (1 - smooth((t - 2.02) / 0.19)) * 0.82 : 0,
  );
  for (const key of ids) {
    const button = home.querySelector(`.shelf-case.${key}`);
    const rest = button.querySelector(".pack-rest"),
      pack = rest.firstElementChild;
    const moving = key === id;
    button.classList.toggle("carrying", moving);
    pack.style.clipPath = "";
    button.querySelector(".cast-shadow").style.opacity = moving
      ? 1 - smooth(t / 0.31)
      : 1;
    if (!moving) {
      pack.style.transform = `rotate(${angles[key]}deg)`;
      continue;
    }
    const start = rest.getBoundingClientRect(),
      slot = unit.querySelector(".socket-line").getBoundingClientRect();
    if (!start.width) continue;
    const zoom = stage.getBoundingClientRect().width / stage.offsetWidth;
    const dx =
      (slot.left + slot.width / 2 - start.left - start.width / 2) / zoom;
    const dy = (slot.top - start.bottom) / zoom;
    const high = Math.min(118, rest.offsetHeight * 0.66),
      hover = Math.min(50, rest.offsetHeight * 0.29);
    const pickup = smooth(t / 0.37),
      across = smooth((t - 0.37) / 0.82),
      down = smooth((t - 1.36) / 0.36);
    const size = lerp(1, slot.width / start.width, across);
    const fullHeight = (start.height * size) / zoom;
    const y =
      lerp(-high * pickup, dy - hover, across) -
      Math.sin(across * Math.PI) * high * 0.85 +
      down * (hover + fullHeight * 0.36);
    pack.style.transform = `translate(${dx * across}px,${y}px) rotate(${angles[key] * (1 - pickup)}deg) scale(${size})`;
    // Hide only the portion that has actually passed the physical front lip.
    const inside = Math.max(0, y - dy);
    if (down > 0)
      pack.style.clipPath = `inset(0 0 ${Math.min(36, (inside / fullHeight) * 100)}% 0)`;
  }
}
// Stage-local coordinates keep the moving video aligned with the real CRT
// and the detail page at any viewport scale, including portrait layouts.
function stageBox(el) {
  const r = el.getBoundingClientRect(),
    s = stage.getBoundingClientRect(),
    zoom = s.width / stage.offsetWidth;
  return {
    x: (r.x - s.x) / zoom,
    y: (r.y - s.y) / zoom,
    w: r.width / zoom,
    h: r.height / zoom,
  };
}
function widescreen(r) {
  const w = Math.min(r.w, (r.h * 16) / 9),
    h = (w * 9) / 16;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}
function mixBox(a, b, p) {
  return {
    x: lerp(a.x, b.x, p),
    y: lerp(a.y, b.y, p),
    w: lerp(a.w, b.w, p),
    h: lerp(a.h, b.h, p),
  };
}
function project(id, box, opacity = 1, settled = false) {
  for (const [key, node] of Object.entries(films)) {
    node.hidden = key !== id;
    node.inert = key !== id || !settled;
    if (node.hidden) continue;
    node.toggleAttribute("data-settled", settled);
    node.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;opacity:${opacity}`;
    const video = node.querySelector("video");
    if (video && video.controls !== settled) video.controls = settled;
  }
}
function paintShelf(k, prev, age) {
  const home = pages.home,
    unloading = k === "home" && prev && prev !== "home",
    loading = k !== "home" && prev === "home";
  const trip = unloading ? ejectTrip : shelfTrip;
  chromeBar.style.opacity = "";
  if ((!loading && !unloading) || age >= trip) {
    delete stage.dataset.transport;
    if (k === "home") {
      shelfMotion(home, null, 0);
      project(null);
    } else
      project(
        k,
        widescreen(stageBox(pages[k].querySelector(".screen-target"))),
        1,
        true,
      );
    return;
  }
  const id = loading ? k : prev,
    game = pages[id],
    t = loading ? age : shelfTrip * (1 - age / ejectTrip);
  stage.dataset.transport = "camera";
  game.classList.add("transport-detail");
  home.style.visibility = "visible";
  game.style.visibility = "visible";
  home.style.zIndex = 1;
  game.style.zIndex = 2;
  const advance = smooth((t - zoomStart) / (closeupAt - zoomStart)),
    reveal = smooth((t - detailsAt) / (shelfTrip - detailsAt));
  game.style.opacity = smooth((reveal - 0.18) / 0.82);
  home.style.opacity = 1 - smooth(reveal / 0.55);
  if (reveal < 0.99) game.style.pointerEvents = "none";
  shelfMotion(home, id, t);
  if (t < shelfVideoStart) {
    project(null);
    return;
  }
  const source = stageBox(home.querySelector(".tv-aperture")),
    dest = widescreen(stageBox(game.querySelector(".screen-target")));
  const origin = stageBox(home);
  const width = stage.offsetWidth;
  const portrait = matchMedia(
    "(max-width:760px) and (orientation:portrait)",
  ).matches;
  const closeWidth = width * (portrait ? 0.98 : 0.94);
  const centerY = portrait ? dest.y + dest.h * 0.52 : stage.offsetHeight * 0.5;
  const close = {
    x: (width - closeWidth) / 2,
    y: centerY - (closeWidth * 9) / 32,
    w: closeWidth,
    h: (closeWidth * 9) / 16,
  };
  const box = mixBox(mixBox(source, close, advance), dest, reveal);
  const scale = box.w / source.w;
  const dx = box.x - origin.x - (source.x - origin.x) * scale,
    dy = box.y - origin.y - (source.y - origin.y) * scale;
  home.style.transform = `translate(${dx}px,${dy}px) scale(${scale})`;
  chromeBar.style.opacity = 1 - advance * (1 - reveal);
  project(id, box, smooth((t - shelfVideoStart) / 0.14));
}
function paint(key, previous, age) {
  const page = pages[key];
  for (const node of Object.values(pages)) {
    node.style.cssText = "";
    node.classList.remove("transport-detail");
    node.classList.toggle("current", node === page);
    node.setAttribute("aria-hidden", String(node !== page));
    node.inert = node !== page;
  }
  page.style.visibility = "visible";
  page.style.zIndex = 2;
  paintShelf(key, previous, age);
}

function linkedGame() {
  const name = location.hash.slice(1);
  return Object.hasOwn(pages, name) ? name : "home";
}

let current = linkedGame(),
  previous = null,
  started = performance.now(),
  raf = 0;
let queuedPack = null,
  playingFilm = null;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

function elapsed(now) {
  return motionPreference.matches ? 10 : (now - started) / 1000;
}

function render(now) {
  const age = elapsed(now);
  paint(current, previous, age);
  const movie = stage.querySelector(".projected-film:not([hidden]) video");
  if (movie !== playingFilm) {
    playingFilm?.pause();
    playingFilm = movie;
    if (movie) movie.play().catch(() => {});
  }
  if (queuedPack && current === "home" && age >= ejectTrip) {
    const next = queuedPack;
    queuedPack = null;
    select(next);
    return;
  }
  const duration = current === "home" ? ejectTrip : shelfTrip;
  if (previous && age < duration) raf = requestAnimationFrame(render);
}

function select(next) {
  if (!Object.hasOwn(pages, next)) return;
  const now = performance.now(),
    age = elapsed(now);
  if (
    !motionPreference.matches &&
    current !== "home" &&
    next !== "home" &&
    next !== current
  ) {
    queuedPack = next;
    next = "home";
  } else if (
    !motionPreference.matches &&
    current === "home" &&
    next !== "home" &&
    previous &&
    age < ejectTrip
  ) {
    queuedPack = next;
    return;
  } else queuedPack = null;
  if (next === current) return;

  const previousFocus =
    pages[current].contains(document.activeElement) ||
    films[current]?.contains(document.activeElement);
  const reversing =
    !motionPreference.matches && previous === "home" && next === "home";
  const reverseAge = reversing ? ejectTrip * (1 - clamp(age / shelfTrip)) : 0;
  previous = current;
  current = next;
  started = now - reverseAge * 1000;
  const movie = films[next]?.querySelector("video");
  if (movie) {
    movie.currentTime = 0;
    if (movie.readyState === 0) movie.load();
  }
  cancelAnimationFrame(raf);
  render(now);
  if (matchMedia("(max-width:760px) and (orientation:portrait)").matches)
    scrollTo(0, 0);
  if (previousFocus)
    pages[next].querySelector("h1,h2").focus({ preventScroll: true });
}

function navigate(next) {
  if (next !== linkedGame()) {
    const url = new URL(location.href);
    url.hash = next === "home" ? "" : next;
    history.pushState(null, "", url);
  }
  select(next);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-go]");
  if (button) navigate(button.dataset.go);
});
addEventListener("keydown", (event) => {
  if (event.key === "Escape") navigate("home");
});
addEventListener("hashchange", () => select(linkedGame()));
function reflow() {
  paint(current, previous, elapsed(performance.now()));
}
addEventListener("resize", reflow);
new ResizeObserver(reflow).observe(stage);
motionPreference.addEventListener("change", () => {
  cancelAnimationFrame(raf);
  render(performance.now());
});
render(started);
