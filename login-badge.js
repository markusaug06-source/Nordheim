// Shows the logged-in player's Roblox picture and name in the header.
// Used on pages that don't already load the booking script (for example the Concerts page).

(async () => {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBgR5utxmElQVPZCm1sscVVi9wdBRzG0Gw",
    authDomain: "nordheim-e6333.firebaseapp.com",
    projectId: "nordheim-e6333",
    storageBucket: "nordheim-e6333.firebasestorage.app",
    messagingSenderId: "343462841284",
    appId: "1:343462841284:web:b6e5fdf9cfa71384ba7291"
  };
  const base = "https://www.gstatic.com/firebasejs/10.12.2";

  const badge = document.getElementById("playerBadge");
  const photo = document.getElementById("playerPhoto");
  const name = document.getElementById("playerName");
  const loginLink = document.getElementById("headerLogin");

  function render(user) {
    if (badge) badge.hidden = !user;
    if (loginLink) loginLink.hidden = !!user;
    if (user) {
      if (photo) photo.src = user.photoURL || "";
      if (name) name.textContent = user.displayName || "";
    }
  }

  try {
    const appMod = await import(`${base}/firebase-app.js`);
    const authMod = await import(`${base}/firebase-auth.js`);
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    authMod.onAuthStateChanged(auth, (user) => render(user));
  } catch (err) {
    console.error(err);
    render(null);
  }
})();
