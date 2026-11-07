// Seat booking for the booking page.
//
// SETUP: paste your Firebase web config below (see setup steps in the chat).
// Until then, bookings are saved only in this browser (demo mode).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBgR5utxmElQVPZCm1sscVVi9wdBRzG0Gw",
  authDomain: "nordheim-e6333.firebaseapp.com",
  projectId: "nordheim-e6333",
  storageBucket: "nordheim-e6333.firebasestorage.app",
  messagingSenderId: "343462841284",
  appId: "1:343462841284:web:b6e5fdf9cfa71384ba7291"
};

const FIREBASE_VERSION = "10.12.2";
const MAX_SEATS_PER_BOOKING = 6;
const DEMO_KEY = "nordheim-bookings";

// ----- Hall layout -----
// Floor rows, closest to the stage first. Seat counts per row.
const FLOOR_ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];
const FLOOR_SEATS = { A: 33, B: 35, C: 37, D: 37, E: 37, F: 37, G: 37, H: 37, I: 26, J: 37, K: 37, L: 37, M: 37, N: 37, O: 37, P: 37 };
// Rows split by an aisle: number of seats on the left block (the rest go on the right).
const FLOOR_AISLE_SPLIT = { I: 13 };
// Split rows line up with the 37-seat rows: their outer seats match the wider rows' ends.
const SPLIT_ROW_HALF_WIDTH = ((37 - 1) / 2) * 18; // 18 = seat spacing
const DEFAULT_FLOOR_SEATS = 24; // rows D to P: update when you know the counts
// Balcony rows, closest to the stage first.
const BALCONY_ROWS = ["U1", "U2", "U3", "U4", "U5"];
const BALCONY_SEATS = 37;

// Drawing settings (in map units, roughly pixels)
const SEAT_STEP = 18;          // distance between seats in a row
const ROW_STEP = 22;           // distance between rows
const SEAT_RADIUS = 7;
const FLOOR_RADIUS = 900;      // bigger = flatter, gentler curves
const BALCONY_RADIUS = 800;
const FLOOR_FIRST_ROW_Y = 130; // height of the first floor row (row A), just below the stage
const BALCONY_CENTER_Y = -200;
const STAGE = { x: -260, y: 40, width: 520, height: 60 };

const SVG_NS = "http://www.w3.org/2000/svg";

const bookableConcerts = window.NORDHEIM_CONCERTS || [];
const $ = (id) => document.getElementById(id);
const els = {
  concert: $("bkConcert"),
  name: $("bkName"),
  user: $("bkUser"),
  selected: $("bkSelected"),
  confirm: $("bkConfirm"),
  status: $("bkStatus"),
  grid: $("seatGrid")
};

let backend = null;      // Firestore helpers when configured
let booked = {};         // concertId -> Set of taken seat ids
let selected = new Set();

async function init() {
  bookableConcerts.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.title} (${c.date})`;
    els.concert.appendChild(opt);
  });

  // Pre-select the concert if a card link was used (booking.html?concert=...)
  const params = new URLSearchParams(location.search);
  if (params.get("concert")) els.concert.value = params.get("concert");

  updateHeading();
  els.concert.addEventListener("change", () => {
    selected.clear();
    updateHeading();
    render();
  });
  els.confirm.addEventListener("click", confirmBooking);

  if (FIREBASE_CONFIG) {
    try {
      await connectFirebase();
      setStatus("");
      await handleRobloxReturn();
    } catch (err) {
      console.error(err);
      setStatus("Could not connect to the booking database. Showing demo mode.", true);
      loadDemo();
    }
  } else {
    setStatus("Demo mode: bookings are saved only in this browser until the booking database is connected.");
    loadDemo();
  }
  render();
}

// ---------- Backend ----------

async function connectFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const appMod = await import(`${base}/firebase-app.js`);
  const fsMod = await import(`${base}/firebase-firestore.js`);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const db = fsMod.getFirestore(app);
  const authMod = await import(`${base}/firebase-auth.js`);
  const auth = authMod.getAuth(app);
  backend = { db, auth, authMod, ...fsMod };
  authMod.onAuthStateChanged(auth, () => updateLoginState());

  // Live updates: when someone books, everyone's seat map refreshes.
  fsMod.onSnapshot(fsMod.collection(db, "bookings"), (snap) => {
    booked = {};
    snap.forEach((d) => {
      const b = d.data();
      if (!booked[b.concertId]) booked[b.concertId] = new Set();
      booked[b.concertId].add(b.seat);
    });
    render();
  }, (err) => {
    console.error(err);
    setStatus("Lost connection to the booking database. Please refresh the page.", true);
  });
}

// After Roblox login, the server sends the visitor back here with a sign-in token after '#'.
async function handleRobloxReturn() {
  if (!backend) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("token");
  const robloxName = params.get("name");
  const robloxPicture = params.get("picture");
  if (!token) return;

  // Remove the token from the address bar straight away
  history.replaceState(null, "", location.pathname + location.search);

  try {
    const cred = await backend.authMod.signInWithCustomToken(backend.auth, token);
    if (robloxName) {
      await backend.authMod.updateProfile(cred.user, {
        displayName: robloxName,
        photoURL: robloxPicture || null
      });
    }
    updateLoginState();
    setStatus(`Logged in as ${robloxName || "player"}. Choose your seats below.`);
  } catch (err) {
    console.error(err);
    setStatus("Roblox login expired. Please log in again.", true);
  }
}

// Show the logged-in player's name, or the login button if nobody is logged in
function updateLoginState() {
  const user = backend && backend.auth ? backend.auth.currentUser : null;
  const loginBtn = $("robloxLoginBtn");
  if (loginBtn) loginBtn.hidden = !!user;

  // Player badge in the top-right corner
  const badge = $("playerBadge");
  if (badge) {
    badge.hidden = !user;
    if (user) {
      $("playerPhoto").src = user.photoURL || "";
      $("playerName").textContent = user.displayName || "";
    }
  }

  if (user) {
    els.name.value = user.displayName || "";
    els.user.value = user.displayName || "";
    els.name.readOnly = true;
    els.user.readOnly = true;
  } else {
    els.name.readOnly = false;
    els.user.readOnly = false;
  }
}

function loadDemo() {
  booked = {};
  readDemo().forEach((b) => {
    if (!booked[b.concertId]) booked[b.concertId] = new Set();
    booked[b.concertId].add(b.seat);
  });
}

function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
  } catch {
    return [];
  }
}

async function saveBooking(concertId, seats, name, username) {
  if (backend) {
    const { db, doc, runTransaction, serverTimestamp } = backend;
    await runTransaction(db, async (tx) => {
      const refs = seats.map((seat) => doc(db, "bookings", `${concertId}__${seat}`));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));
      if (snaps.some((s) => s.exists())) throw new Error("SEAT_TAKEN");
      refs.forEach((r, i) => {
        tx.set(r, {
          concertId,
          uid: backend.auth.currentUser.uid,
          seat: seats[i],
          name,
          username,
          createdAt: serverTimestamp()
        });
      });
    });
    return;
  }

  // Demo mode
  const all = readDemo();
  if (all.some((b) => b.concertId === concertId && seats.includes(b.seat))) {
    throw new Error("SEAT_TAKEN");
  }
  seats.forEach((seat) => all.push({ concertId, seat, name, username, createdAt: Date.now() }));
  localStorage.setItem(DEMO_KEY, JSON.stringify(all));
  loadDemo();
}

// ---------- Seat map (drawn as curved rows, like a real hall plan) ----------

// Place `count` seats along an arc of the given radius, centred at (0, centerY).
function layoutRow(count, radius, centerY, makeId) {
  const seats = [];
  for (let k = 0; k < count; k++) {
    const phi = ((k - (count - 1) / 2) * SEAT_STEP) / radius;
    seats.push({
      id: makeId(k + 1),
      x: radius * Math.sin(phi),
      y: centerY + radius * Math.cos(phi)
    });
  }
  return seats;
}

function buildLayout() {
  const rows = [];
  // Floor rows are straight lines, centred on the hall, one row below the other.
  FLOOR_ROWS.forEach((label, i) => {
    const count = FLOOR_SEATS[label] || DEFAULT_FLOOR_SEATS;
    const y = FLOOR_FIRST_ROW_Y + i * ROW_STEP;
    const split = FLOOR_AISLE_SPLIT[label];
    const seats = [];
    for (let k = 0; k < count; k++) {
      let x;
      if (split) {
        // Left block starts at the left edge and runs toward the aisle;
        // right block starts at the aisle and runs to the right edge.
        x = k < split
          ? -SPLIT_ROW_HALF_WIDTH + k * SEAT_STEP
          : SPLIT_ROW_HALF_WIDTH - (count - 1 - k) * SEAT_STEP;
      } else {
        x = (k - (count - 1) / 2) * SEAT_STEP;
      }
      seats.push({ id: `${label}${k + 1}`, x, y });
    }
    rows.push({ label, seats });
  });
  BALCONY_ROWS.forEach((label, i) => {
    rows.push({
      label,
      seats: layoutRow(BALCONY_SEATS, BALCONY_RADIUS + i * ROW_STEP, BALCONY_CENTER_Y, (n) => `${label}-${n}`)
    });
  });
  return rows;
}

const LAYOUT = buildLayout();

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

function render() {
  if (!els.grid) return;
  const concertId = els.concert.value;
  const taken = booked[concertId] || new Set();

  // Bounds of the drawing so the whole hall fits the viewBox
  const allSeats = LAYOUT.flatMap((r) => r.seats);
  const xs = allSeats.map((s) => s.x);
  const ys = allSeats.map((s) => s.y);
  const minX = Math.min(...xs, STAGE.x) - 60;
  const maxX = Math.max(...xs, STAGE.x + STAGE.width) + 60;
  const minY = Math.min(...ys, STAGE.y) - 30;
  const maxY = Math.max(...ys) + 40;

  const svg = svgEl("svg", {
    class: "seat-svg",
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    role: "group",
    "aria-label": "Seat map"
  });

  // Stage
  svg.appendChild(svgEl("rect", {
    class: "stage-shape",
    x: STAGE.x, y: STAGE.y, width: STAGE.width, height: STAGE.height, rx: 14
  }));
  const stageText = svgEl("text", {
    class: "stage-text",
    x: 0, y: STAGE.y + STAGE.height / 2 + 5, "text-anchor": "middle"
  });
  stageText.textContent = "STAGE";
  svg.appendChild(stageText);

  // Balcony label
  const balconyText = svgEl("text", { class: "section-text", x: 0, y: 560, "text-anchor": "middle" });
  balconyText.textContent = "Balcony";
  svg.appendChild(balconyText);

  // "FOH" label in the aisle gap of the split row
  const splitRowIndex = FLOOR_ROWS.findIndex((label) => FLOOR_AISLE_SPLIT[label]);
  if (splitRowIndex >= 0) {
    const foh = svgEl("text", {
      class: "section-text",
      x: 0,
      y: FLOOR_FIRST_ROW_Y + splitRowIndex * ROW_STEP + 4,
      "text-anchor": "middle"
    });
    foh.textContent = "FOH";
    svg.appendChild(foh);
  }

  // Rows: labels and seats
  LAYOUT.forEach((row) => {
    const first = row.seats[0];
    const last = row.seats[row.seats.length - 1];
    [[first, "end", first.x - 18], [last, "start", last.x + 18]].forEach(([s, anchor, x]) => {
      const t = svgEl("text", { class: "row-label", x, y: s.y + 4, "text-anchor": anchor });
      t.textContent = row.label;
      svg.appendChild(t);
    });

    row.seats.forEach((seat) => {
      const isTaken = taken.has(seat.id);
      const isSelected = selected.has(seat.id);
      const classes = ["seat"];
      if (isTaken) classes.push("booked");
      if (isSelected) classes.push("selected");

      const circle = svgEl("circle", {
        class: classes.join(" "),
        cx: seat.x.toFixed(1),
        cy: seat.y.toFixed(1),
        r: SEAT_RADIUS
      });
      const title = svgEl("title");
      title.textContent = isTaken ? `Seat ${seat.id} (booked)` : `Seat ${seat.id}`;
      circle.appendChild(title);

      if (!isTaken) {
        circle.addEventListener("click", () => toggleSeat(seat.id));
      }
      svg.appendChild(circle);
    });
  });

  els.grid.innerHTML = "";
  els.grid.appendChild(svg);

  const list = [...selected].sort();
  els.selected.textContent = list.length ? list.join(", ") : "none";
}

function toggleSeat(id) {
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    if (selected.size >= MAX_SEATS_PER_BOOKING) {
      setStatus(`You can book up to ${MAX_SEATS_PER_BOOKING} seats at once.`, true);
      return;
    }
    selected.add(id);
    setStatus("");
  }
  render();
}

// ---------- Confirm ----------

async function confirmBooking() {
  const name = els.name.value.trim();
  const username = els.user.value.trim();
  const concertId = els.concert.value;

  if (backend && !backend.auth.currentUser) {
    setStatus("Please log in with Roblox first.", true);
    return;
  }
  if (!name || !username) {
    setStatus("Please enter your name and Roblox username.", true);
    return;
  }
  if (selected.size === 0) {
    setStatus("Please choose at least one seat.", true);
    return;
  }

  els.confirm.disabled = true;
  const seats = [...selected].sort();
  try {
    await saveBooking(concertId, seats, name.slice(0, 40), username.slice(0, 20));
    const concert = bookableConcerts.find((c) => c.id === concertId);
    selected.clear();
    els.name.value = "";
    els.user.value = "";
    render();
    setStatus(`Booked seats ${seats.join(", ")} for ${concert ? concert.title : "your show"}. See you there!`);
  } catch (err) {
    if (err.message === "SEAT_TAKEN") {
      setStatus("Sorry, one of those seats was just taken. Please choose again.", true);
    } else {
      console.error(err);
      setStatus("Something went wrong. Please try again.", true);
    }
    if (!backend) loadDemo();
    render();
  } finally {
    els.confirm.disabled = false;
  }
}

function updateHeading() {
  const heading = $("bkHeading");
  const concert = bookableConcerts.find((c) => c.id === els.concert.value);
  if (heading && concert) heading.textContent = `Reserve seats: ${concert.title}`;
}

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

// Start up last, once every constant above has been defined.
if (els.grid && bookableConcerts.length) {
  init();
}
