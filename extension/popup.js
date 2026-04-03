// --- Config ---
const SUPABASE_URL = "https://jibbeetyogbfkjvazysy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYmJlZXR5b2diZmtqdmF6eXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzUwNzYsImV4cCI6MjA4ODgxMTA3Nn0.C20BJLWyo9A3c2ouT097uddJrrJJwM-K09RhEQ3bf0E";

// --- DOM refs ---
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const mainError = document.getElementById("main-error");
const noImageState = document.getElementById("no-image-state");
const generateForm = document.getElementById("generate-form");
const generatingState = document.getElementById("generating-state");
const resultState = document.getElementById("result-state");
const previewImage = document.getElementById("preview-image");
const brandSelect = document.getElementById("brand-select");
const formatGrid = document.getElementById("format-grid");
const generateBtn = document.getElementById("generate-btn");
const resultImage = document.getElementById("result-image");
const downloadBtn = document.getElementById("download-btn");
const newBtn = document.getElementById("new-btn");

let selectedFormat = "square";
let session = null;
let selectedImageUrl = "";

// --- Helpers ---
function showView(view) {
  loginView.style.display = "none";
  mainView.style.display = "none";
  view.style.display = "block";
}

function showMainSection(section) {
  noImageState.style.display = "none";
  generateForm.style.display = "none";
  generatingState.style.display = "none";
  resultState.style.display = "none";
  section.style.display = "block";
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

async function supabaseRequest(path, options = {}) {
  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  return res;
}

// --- Auth ---
async function signIn(email, password) {
  // Support username login (append @internal.brandtonic if no @)
  if (!email.includes("@")) {
    email = `${email}@internal.brandtonic`;
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
  return data;
}

async function loadSession() {
  const stored = await chrome.storage.local.get(["bt_session"]);
  if (stored.bt_session) {
    session = stored.bt_session;
    // Check if token is expired
    const exp = session.expires_at * 1000;
    if (Date.now() > exp) {
      // Try refresh
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        if (!res.ok) throw new Error("Refresh failed");
        session = await res.json();
        await chrome.storage.local.set({ bt_session: session });
      } catch {
        session = null;
        await chrome.storage.local.remove(["bt_session"]);
      }
    }
  }
  return session;
}

// --- Brands ---
async function loadBrands() {
  const res = await supabaseRequest("/rest/v1/brands?select=id,name&order=name");
  if (!res.ok) return [];
  return res.json();
}

async function populateBrands() {
  brandSelect.innerHTML = '<option value="">Loading…</option>';
  try {
    const brands = await loadBrands();
    if (brands.length === 0) {
      brandSelect.innerHTML = '<option value="">No brands found</option>';
      return;
    }
    brandSelect.innerHTML = brands.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
  } catch {
    brandSelect.innerHTML = '<option value="">Failed to load brands</option>';
  }
}

// --- Format selection ---
formatGrid.addEventListener("click", (e) => {
  const option = e.target.closest(".format-option");
  if (!option) return;
  formatGrid.querySelectorAll(".format-option").forEach(o => o.classList.remove("active"));
  option.classList.add("active");
  selectedFormat = option.dataset.format;
});

// --- Generate ---
async function generateCreative() {
  const brandId = brandSelect.value;
  if (!brandId) { showError(mainError, "Please select a brand."); return; }
  if (!selectedImageUrl) { showError(mainError, "No image selected."); return; }

  showMainSection(generatingState);

  try {
    const res = await supabaseRequest("/functions/v1/generate-creative", {
      method: "POST",
      body: JSON.stringify({
        brandId,
        referenceImageUrl: selectedImageUrl,
        outputFormat: selectedFormat,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");

    if (data.imageUrl) {
      resultImage.src = data.imageUrl;
      showMainSection(resultState);
    } else {
      throw new Error("No image returned");
    }
  } catch (err) {
    showMainSection(generateForm);
    showError(mainError, err.message);
  }
}

// --- Download ---
downloadBtn.addEventListener("click", async () => {
  const url = resultImage.src;
  if (!url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brandtonic-creative-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    showError(mainError, "Download failed.");
  }
});

// --- New ---
newBtn.addEventListener("click", () => {
  showMainSection(generateForm);
});

// --- Login handler ---
loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) { showError(loginError, "Enter your credentials."); return; }
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  try {
    session = await signIn(email, password);
    await chrome.storage.local.set({ bt_session: session });
    await initMainView();
  } catch (err) {
    showError(loginError, err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
});

// --- Logout ---
logoutBtn.addEventListener("click", async () => {
  session = null;
  await chrome.storage.local.remove(["bt_session"]);
  showView(loginView);
});

// --- Init ---
async function initMainView() {
  showView(mainView);
  await populateBrands();

  // Check for stored image URL from context menu
  const stored = await chrome.storage.local.get(["selectedImageUrl"]);
  if (stored.selectedImageUrl) {
    selectedImageUrl = stored.selectedImageUrl;
    previewImage.src = selectedImageUrl;
    showMainSection(generateForm);
    // Clear it so next open shows fresh state
    await chrome.storage.local.remove(["selectedImageUrl"]);
  } else {
    showMainSection(noImageState);
  }
}

generateBtn.addEventListener("click", generateCreative);

// --- Boot ---
(async () => {
  await loadSession();
  if (session) {
    await initMainView();
  } else {
    showView(loginView);
  }
})();
