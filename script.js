// Placeholder data. Replace with your real concerts and books.
const concerts = [
  {
    id: "winter-strings",
    date: "Fri 12 Dec, 19:30",
    title: "Winter Strings Evening",
    description: "A chamber orchestra playing Nordic folk and classical pieces.",
    tag: "Orchestra",
    price: "Free for members"
  },
  {
    id: "aurora-jazz",
    date: "Sat 20 Dec, 20:00",
    title: "Aurora Jazz Night",
    description: "Live jazz quartet with a late-night set in the main hall.",
    tag: "Jazz",
    price: "Tickets: 15"
  },
  {
    id: "midwinter-choir",
    date: "Sun 28 Dec, 18:00",
    title: "Midwinter Choir",
    description: "A candlelit choral concert for the longest night of the year.",
    tag: "Choir",
    price: "Tickets: 10"
  }
];

const books = [
  { title: "The Northern Lights Almanac", author: "E. Halvorsen" },
  { title: "A History of the Harbour Opera", author: "M. Strand" },
  { title: "Notes on Cold-Weather Piano", author: "J. Vik" },
  { title: "Songs of the Fjord", author: "A. Lund" }
];

// Share the concert list with bookings.js
window.NORDHEIM_CONCERTS = concerts;

// Concert cards (only on the concerts page)
const eventList = document.getElementById("eventList");
if (eventList) {
  concerts.forEach((c) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <span class="date"></span>
      <h3></h3>
      <p class="desc"></p>
      <span class="tag"></span>
      <p class="desc"></p>
      <a class="btn">Reserve a seat</a>
    `;
    card.querySelector(".date").textContent = c.date;
    card.querySelector("h3").textContent = c.title;
    const descs = card.querySelectorAll(".desc");
    descs[0].textContent = c.description;
    descs[1].textContent = c.price;
    card.querySelector(".tag").textContent = c.tag;
    card.querySelector("a.btn").href = `booking.html?concert=${encodeURIComponent(c.id)}`;
    eventList.appendChild(card);
  });
}

// Book list (only on the library page)
const bookList = document.getElementById("bookList");
if (bookList) {
  books.forEach((b) => {
    const li = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = b.title;
    const author = document.createElement("span");
    author.className = "author";
    author.textContent = b.author;
    li.append(title, author);
    bookList.appendChild(li);
  });
}

// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");
if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Footer year
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();
