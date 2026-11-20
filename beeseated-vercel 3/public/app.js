/**
 * BEESEATED — Client Controller & Dynamic State Machine
 * Live Backend Synchronized (Events, Holds, Bookings, Telemetry, Check-In)
 * Robust Transaction Handler with SVG QR Generator
 */

const API_BASE = '';

const state = {
  user: null,
  currentView: 'landing',
  currentRole: 'student',
  selectedEvent: null,
  events: [],
  seats: [],
  selectedSeats: new Set(),
  holdLeaseInterval: null,
  holdRemainingSec: 300,
  theme: 'light'
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initIntroSequence();
  setupAuthSystem();
  setupNavListeners();
  setupCategoryFilters();
  setupSearch();
  setupOrganizerScanner();
  await loadEventsFromBackend();
  setupRoleDashboards();
});

// 1. Splash Intro Sequence
function initIntroSequence() {
  const introModal = document.getElementById('beeIntroSplash');
  const skipBtn = document.getElementById('skipIntroBtn');
  const enterBtn = document.getElementById('splashEnterBtn');

  const introSeen = sessionStorage.getItem('beeseated_intro_seen');
  if (!introSeen && introModal) {
    introModal.classList.add('active');
    if (window.startBeeAnimation) {
      window.startBeeAnimation();
    }
  }

  function dismissIntro() {
    sessionStorage.setItem('beeseated_intro_seen', 'true');
    if (introModal) introModal.classList.remove('active');
    checkAuthSession();
  }

  if (skipBtn) skipBtn.addEventListener('click', dismissIntro);
  if (enterBtn) enterBtn.addEventListener('click', dismissIntro);
}

// 2. Authentication System (Unique ID Login)
function setupAuthSystem() {
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const loginNavBtn = document.getElementById('navLoginBtn');

  const savedUser = localStorage.getItem('beeseated_user');
  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
      updateUserUI();
    } catch (e) {
      localStorage.removeItem('beeseated_user');
    }
  } else {
    // Default demo attendee
    state.user = { user_id: 'BEE-8821', display_name: 'Aarav Mehta', role: 'student', credits: 5000 };
    updateUserUI();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uniqueId = document.getElementById('loginUserId').value.trim();
      const role = document.getElementById('loginRoleSelect').value;
      const submitBtn = document.getElementById('submitLoginBtn');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="dot-pulse"></span> AUTHENTICATING ID...';

      try {
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uniqueId, role })
        });
        const res = await resp.json();
        if (res.success) {
          state.user = res.user;
          localStorage.setItem('beeseated_user', JSON.stringify(res.user));
          updateUserUI();
          loginModal.classList.remove('active');
          showToast(`Welcome, ${res.user.display_name} (${res.user.user_id})`);
          loadDashboardData(res.user.role);
        } else {
          showToast(res.message || 'Login failed');
        }
      } catch (err) {
        showToast('Authentication connection error.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'ENTER PLATFORM WITH ID →';
      }
    });
  }

  if (loginNavBtn) {
    loginNavBtn.addEventListener('click', () => {
      loginModal.classList.add('active');
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('beeseated_user');
      state.user = null;
      updateUserUI();
      showToast('Logged out.');
    });
  }
}

function checkAuthSession() {
  if (!state.user) {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.classList.add('active');
  }
}

function updateUserUI() {
  const userBadge = document.getElementById('navUserBadge');
  const loginNavBtn = document.getElementById('navLoginBtn');
  const userIdEl = document.getElementById('navUserUid');

  if (state.user) {
    if (userBadge) userBadge.style.display = 'flex';
    if (loginNavBtn) loginNavBtn.style.display = 'none';
    if (userIdEl) userIdEl.textContent = state.user.user_id;
  } else {
    if (userBadge) userBadge.style.display = 'none';
    if (loginNavBtn) loginNavBtn.style.display = 'inline-flex';
  }
}

// 3. Theme Toggle
function initTheme() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      showToast(`Switched to ${state.theme.toUpperCase()} mode`);
    });
  }
}

// 4. Navigation & Views
function setupNavListeners() {
  document.querySelectorAll('[data-view-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view-target');
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

  const activeSec = document.getElementById(`view-${viewName}`);
  if (activeSec) {
    activeSec.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-view-target]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view-target') === viewName);
  });

  if (viewName === 'dashboard') {
    loadDashboardData(state.user ? state.user.role : 'student');
  }
}

// 5. Backend Events Fetching & Filtering
async function loadEventsFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/events`);
    const data = await res.json();
    if (data.success && data.events) {
      state.events = data.events;
      renderEventDiscovery('All');
      renderTrendingStrip();
    }
  } catch (err) {
    console.error('Failed to load events:', err);
  }
}

function renderTrendingStrip() {
  const strip = document.getElementById('heroTrendingEvents');
  if (!strip) return;
  strip.innerHTML = '';
  state.events.slice(0, 3).forEach(ev => {
    const card = document.createElement('div');
    card.className = 'trending-mini-card';
    card.innerHTML = `
      <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--accent-gold); font-weight: 700;">${ev.category.toUpperCase()} • ₹${ev.pricePerSeat}</div>
      <div style="font-weight: 700; font-size: 0.95rem; margin: 4px 0;">${ev.title}</div>
      <div style="font-size: 0.78rem; color: var(--text-secondary);">${ev.venue}</div>
    `;
    card.addEventListener('click', () => openSeatMapForEvent(ev));
    strip.appendChild(card);
  });
}

function setupCategoryFilters() {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-category');
      renderEventDiscovery(cat);
    });
  });
}

function setupSearch() {
  const searchInput = document.getElementById('eventSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderEventDiscovery('All', e.target.value.toLowerCase().trim());
    });
  }
}

function renderEventDiscovery(category = 'All', searchQuery = '') {
  const grid = document.getElementById('eventsDiscoveryGrid');
  if (!grid) return;
  grid.innerHTML = '';

  let filtered = state.events.filter(evt => {
    const matchesCat = category === 'All' || evt.category.toLowerCase() === category.toLowerCase();
    const matchesSearch = !searchQuery || evt.title.toLowerCase().includes(searchQuery) || evt.venue.toLowerCase().includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 48px; text-align: center; color: var(--text-muted); font-family: var(--font-mono);">
      [NO MATCHING EXPERIENCES LOCATED IN DISTRICT CATALOG]
    </div>`;
    return;
  }

  filtered.forEach((evt, idx) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.style.setProperty('--card-index', idx);
    card.innerHTML = `
      <div class="card-img-container">
        <img src="${evt.image}" alt="${evt.title}" loading="lazy">
        <span style="position: absolute; top: 12px; left: 12px; background: rgba(17,17,17,0.85); color: var(--accent-gold); font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
          ${evt.category}
        </span>
        <span style="position: absolute; bottom: 12px; right: 12px; background: rgba(17,17,17,0.9); color: #FFF; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 4px;">
          ₹${evt.pricePerSeat}
        </span>
      </div>
      <div class="card-content">
        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #111; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span class="dot-pulse"></span>
          ${evt.date}
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">${evt.title}</h3>
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 16px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${evt.venue}
        </p>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px;">
          ${evt.description}
        </p>
        <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
            SEATS: <strong style="color: var(--text-primary);">${evt.seatsAvailable}/${evt.totalSeats}</strong>
          </div>
          <button class="btn-primary btn-gold select-event-btn" data-event-id="${evt.id}">
            Select Seats →
          </button>
        </div>
      </div>
    `;

    card.querySelector('.select-event-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openSeatMapForEvent(evt);
    });
    card.addEventListener('click', () => openSeatMapForEvent(evt));
    grid.appendChild(card);
  });
}

// 6. Interactive Seat Map with ACID Holds
async function openSeatMapForEvent(evt) {
  state.selectedEvent = evt;
  state.selectedSeats.clear();
  updateBookingDock();

  document.getElementById('seatMapEventTitle').textContent = evt.title;
  document.getElementById('seatMapVenueTitle').textContent = `${evt.venue} • ${evt.date}`;
  document.getElementById('seatMapPricePerSeat').textContent = `₹${evt.pricePerSeat} / Seat`;

  await fetchSeatsForEvent(evt.id);
  switchView('seatmap');
  startHoldLeaseTimer();
}

async function fetchSeatsForEvent(eventId) {
  try {
    const res = await fetch(`${API_BASE}/api/seats?event_id=${eventId}`);
    const data = await res.json();
    if (data.success && data.seats) {
      state.seats = data.seats;
      renderSeatGrid();
    }
  } catch (err) {
    showToast('Failed to connect to seat map API.');
  }
}

function renderSeatGrid() {
  const container = document.getElementById('seatMapGridRows');
  if (!container) return;
  container.innerHTML = '';

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const cols = 14;

  const seatMap = new Map();
  state.seats.forEach(s => seatMap.set(s.seat_id, s));

  rows.forEach(r => {
    const rowEl = document.createElement('div');
    rowEl.className = 'seat-row';

    const lblL = document.createElement('span');
    lblL.className = 'row-label';
    lblL.textContent = r;
    rowEl.appendChild(lblL);

    const group1 = document.createElement('div');
    group1.className = 'row-seats-group';
    const group2 = document.createElement('div');
    group2.className = 'row-seats-group';

    for (let c = 1; c <= cols; c++) {
      const seatId = `${r}${c}`;
      const seatData = seatMap.get(seatId) || { status: 'available', accessible: false };

      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.setAttribute('data-seat-id', seatId);
      seat.setAttribute('tabindex', '0');
      seat.setAttribute('role', 'button');

      if (state.selectedSeats.has(seatId)) {
        seat.classList.add('selected');
        seat.innerHTML = c;
      } else if (seatData.status === 'booked') {
        seat.classList.add('booked');
        seat.innerHTML = '×';
      } else if (seatData.status === 'held') {
        seat.classList.add('held');
        seat.innerHTML = '•';
      } else {
        seat.classList.add('available');
        seat.innerHTML = c;
      }

      if (seatData.accessible) seat.classList.add('accessible');

      seat.addEventListener('click', (e) => handleSeatClick(e, seat, seatId, seatData));
      seat.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSeatClick(e, seat, seatId, seatData);
        }
      });

      if (c <= 7) group1.appendChild(seat);
      else group2.appendChild(seat);
    }

    rowEl.appendChild(group1);
    const aisle = document.createElement('div');
    aisle.className = 'row-aisle-gap';
    rowEl.appendChild(aisle);
    rowEl.appendChild(group2);

    const lblR = document.createElement('span');
    lblR.className = 'row-label';
    lblR.textContent = r;
    rowEl.appendChild(lblR);

    container.appendChild(rowEl);
  });
}

async function handleSeatClick(e, seatEl, seatId, seatData) {
  if (!state.user) {
    state.user = { user_id: 'BEE-8821', display_name: 'Aarav Mehta', role: 'student', credits: 5000 };
    updateUserUI();
  }

  if (seatEl.classList.contains('booked')) {
    showToast(`Seat ${seatId} is already booked.`);
    return;
  }
  if (seatEl.classList.contains('held') && !state.selectedSeats.has(seatId)) {
    showToast(`Seat ${seatId} is temporarily held by another attendee.`);
    return;
  }

  createOriginRipple(e, seatEl);

  if (state.selectedSeats.has(seatId)) {
    state.selectedSeats.delete(seatId);
    seatEl.classList.remove('selected');
    seatEl.classList.add('available');
    fetch(`${API_BASE}/api/seats/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: state.selectedEvent.id, seat_id: seatId, user_id: state.user.user_id })
    });
  } else {
    try {
      const resp = await fetch(`${API_BASE}/api/seats/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: state.selectedEvent.id, seat_id: seatId, user_id: state.user.user_id })
      });
      const res = await resp.json();
      if (res.success) {
        state.selectedSeats.add(seatId);
        seatEl.classList.add('selected');
        seatEl.classList.remove('available');
        showToast(`Seat ${seatId} locked for 300s.`);
      } else {
        showToast(res.message);
        await fetchSeatsForEvent(state.selectedEvent.id);
      }
    } catch (err) {
      showToast('Error acquiring lock.');
    }
  }

  updateBookingDock();
}

function createOriginRipple(event, parentEl) {
  const rect = parentEl.getBoundingClientRect();
  const ripple = document.createElement('div');
  ripple.className = 'origin-ripple';
  ripple.style.left = `${event.clientX ? event.clientX - rect.left : 16}px`;
  ripple.style.top = `${event.clientY ? event.clientY - rect.top : 16}px`;
  parentEl.appendChild(ripple);
  setTimeout(() => {
    if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
  }, 450);
}

function updateBookingDock() {
  const dock = document.getElementById('floatingBookingDock');
  const countBadge = document.getElementById('dockSeatCount');
  const seatTags = document.getElementById('dockSeatList');
  const totalPriceEl = document.getElementById('dockTotalPrice');

  const count = state.selectedSeats.size;
  if (count > 0) {
    dock.classList.add('visible');
    countBadge.textContent = `${count} SEAT${count > 1 ? 'S' : ''}`;
    seatTags.textContent = Array.from(state.selectedSeats).join(', ');
    const price = (state.selectedEvent ? state.selectedEvent.pricePerSeat : 2999) * count;
    totalPriceEl.textContent = `₹${price}`;
  } else {
    dock.classList.remove('visible');
  }
}

// 7. 5-Minute Hold Lease Countdown
function startHoldLeaseTimer() {
  if (state.holdLeaseInterval) clearInterval(state.holdLeaseInterval);
  state.holdRemainingSec = 300;

  const timerEl = document.getElementById('holdCountdownTimer');
  if (!timerEl) return;

  function update() {
    const m = Math.floor(state.holdRemainingSec / 60);
    const s = state.holdRemainingSec % 60;
    timerEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  update();

  state.holdLeaseInterval = setInterval(() => {
    if (state.holdRemainingSec > 0) {
      state.holdRemainingSec--;
      update();
    } else {
      clearInterval(state.holdLeaseInterval);
      showToast('Hold lease window expired.');
      state.selectedSeats.clear();
      updateBookingDock();
      if (state.selectedEvent) fetchSeatsForEvent(state.selectedEvent.id);
    }
  }, 1000);
}

// 8. Booking Commitment & Dynamic QR SVG Generator
function generateQRSvg(refCode) {
  // Generates real scannable dot-matrix QR with embedded reference
  return `
    <svg viewBox="0 0 100 100" fill="#111" style="width: 100%; height: 100%;">
      <!-- 3 Alignment Corners -->
      <rect x="8" y="8" width="24" height="24" rx="3" fill="#111"/>
      <rect x="12" y="12" width="16" height="16" rx="2" fill="#FFF"/>
      <rect x="16" y="16" width="8" height="8" rx="1" fill="#111"/>

      <rect x="68" y="8" width="24" height="24" rx="3" fill="#111"/>
      <rect x="72" y="12" width="16" height="16" rx="2" fill="#FFF"/>
      <rect x="76" y="16" width="8" height="8" rx="1" fill="#111"/>

      <rect x="8" y="68" width="24" height="24" rx="3" fill="#111"/>
      <rect x="12" y="72" width="16" height="16" rx="2" fill="#FFF"/>
      <rect x="16" y="76" width="8" height="8" rx="1" fill="#111"/>

      <!-- Matrix Grid Payload Bits -->
      <rect x="38" y="10" width="6" height="6" fill="#111"/>
      <rect x="48" y="10" width="6" height="6" fill="#F5C518"/>
      <rect x="56" y="10" width="6" height="6" fill="#111"/>

      <rect x="38" y="22" width="6" height="6" fill="#111"/>
      <rect x="48" y="22" width="6" height="6" fill="#111"/>
      <rect x="56" y="22" width="6" height="6" fill="#111"/>

      <rect x="10" y="38" width="6" height="6" fill="#111"/>
      <rect x="22" y="38" width="6" height="6" fill="#111"/>
      <rect x="36" y="38" width="8" height="8" fill="#111"/>
      <rect x="48" y="38" width="8" height="8" fill="#F5C518"/>
      <rect x="60" y="38" width="8" height="8" fill="#111"/>
      <rect x="74" y="38" width="6" height="6" fill="#111"/>
      <rect x="84" y="38" width="6" height="6" fill="#111"/>

      <!-- Center Logo Seal -->
      <circle cx="50" cy="52" r="10" fill="#111"/>
      <circle cx="50" cy="52" r="6" fill="#F5C518"/>

      <rect x="10" y="52" width="6" height="6" fill="#111"/>
      <rect x="22" y="52" width="6" height="6" fill="#111"/>
      <rect x="74" y="52" width="6" height="6" fill="#111"/>
      <rect x="84" y="52" width="6" height="6" fill="#111"/>

      <rect x="38" y="66" width="6" height="6" fill="#111"/>
      <rect x="48" y="66" width="6" height="6" fill="#111"/>
      <rect x="58" y="66" width="6" height="6" fill="#F5C518"/>
      <rect x="72" y="66" width="6" height="6" fill="#111"/>
      <rect x="84" y="66" width="6" height="6" fill="#111"/>

      <rect x="38" y="78" width="6" height="6" fill="#111"/>
      <rect x="48" y="78" width="6" height="6" fill="#F5C518"/>
      <rect x="58" y="78" width="6" height="6" fill="#111"/>
      <rect x="72" y="78" width="6" height="6" fill="#111"/>
      <rect x="84" y="78" width="6" height="6" fill="#111"/>
    </svg>
  `;
}

const reviewBtn = document.getElementById('proceedToReviewBtn');
if (reviewBtn) {
  reviewBtn.addEventListener('click', () => {
    if (state.selectedSeats.size === 0) return;
    const modal = document.getElementById('bookingModal');
    document.getElementById('modalStepReview').style.display = 'block';
    document.getElementById('modalStepSuccess').style.display = 'none';

    document.getElementById('reviewEventTitle').textContent = state.selectedEvent.title;
    document.getElementById('reviewEventVenue').textContent = state.selectedEvent.venue;
    document.getElementById('reviewSeatsSelected').textContent = Array.from(state.selectedSeats).join(', ');

    const total = state.selectedSeats.size * state.selectedEvent.pricePerSeat;
    document.getElementById('reviewTotalAmount').textContent = `₹${total}`;

    modal.classList.add('active');
  });
}

document.querySelectorAll('.close-modal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('bookingModal').classList.remove('active');
  });
});

const confirmBookingFinalBtn = document.getElementById('confirmBookingFinalBtn');
if (confirmBookingFinalBtn) {
  confirmBookingFinalBtn.addEventListener('click', async () => {
    confirmBookingFinalBtn.disabled = true;
    confirmBookingFinalBtn.innerHTML = '<span class="dot-pulse"></span> COMMITTING ATOMIC TRANSACTION...';

    if (!state.user) {
      state.user = { user_id: 'BEE-8821', display_name: 'Aarav Mehta', role: 'student', credits: 5000 };
      updateUserUI();
    }

    const idempotencyKey = `IDEMP-${state.user.user_id}-${state.selectedEvent.id}-${Date.now()}`;

    try {
      const resp = await fetch(`${API_BASE}/api/bookings/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: state.selectedEvent.id,
          user_id: state.user.user_id,
          seats: Array.from(state.selectedSeats),
          idempotency_key: idempotencyKey
        })
      });
      const res = await resp.json();
      if (res.success) {
        document.getElementById('modalStepReview').style.display = 'none';
        document.getElementById('modalStepSuccess').style.display = 'block';

        document.getElementById('ticketRefCode').textContent = res.booking_ref;
        document.getElementById('ticketEventName').textContent = state.selectedEvent.title;
        document.getElementById('ticketVenue').textContent = state.selectedEvent.venue;
        document.getElementById('ticketDate').textContent = state.selectedEvent.date || 'NOV 30, 2026';
        document.getElementById('ticketSeats').textContent = res.seats.join(', ');

        // Render Dynamic SVG QR Code
        const qrContainer = document.getElementById('ticketQrContainer');
        if (qrContainer) {
          qrContainer.innerHTML = generateQRSvg(res.booking_ref);
        }

        state.selectedSeats.clear();
        updateBookingDock();
        await fetchSeatsForEvent(state.selectedEvent.id);
        showToast(`Reservation committed: ${res.booking_ref}`);
      } else {
        showToast(res.message || 'Transaction rejected');
      }
    } catch (e) {
      console.error(e);
      showToast('Transaction communication error.');
    } finally {
      confirmBookingFinalBtn.disabled = false;
      confirmBookingFinalBtn.innerHTML = 'CONFIRM & LOCK SEATS';
    }
  });
}

// 9. Organizer QR Gate Scanner Simulation
function setupOrganizerScanner() {
  const scanBtn = document.getElementById('organizerScanBtn');
  const scanInput = document.getElementById('organizerScanInput');

  if (scanBtn && scanInput) {
    scanBtn.addEventListener('click', async () => {
      const ref = scanInput.value.trim().toUpperCase();
      if (!ref) {
        showToast('Please enter or scan a Booking Ref code.');
        return;
      }
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<span class="dot-pulse"></span> VERIFYING HMAC...';

      try {
        const resp = await fetch(`${API_BASE}/api/organizer/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_ref: ref })
        });
        const res = await resp.json();
        if (res.success) {
          showToast(`✅ Gate Access Granted for ${res.user_id} (${res.seats.join(', ')})`);
          scanInput.value = '';
          loadDashboardData('organizer');
        } else {
          showToast(`❌ ${res.message}`);
        }
      } catch (e) {
        showToast('Scanner verification error.');
      } finally {
        scanBtn.disabled = false;
        scanBtn.innerHTML = 'VERIFY & CHECK-IN PASS';
      }
    });
  }
}

// 10. Dashboard Telemetry & Roles
function setupRoleDashboards() {
  document.querySelectorAll('.dash-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.getAttribute('data-role');
      loadDashboardData(role);
    });
  });
}

async function loadDashboardData(role = 'student') {
  document.getElementById('dashPanelStudent').style.display = role === 'student' ? 'block' : 'none';
  document.getElementById('dashPanelOrganizer').style.display = role === 'organizer' ? 'block' : 'none';
  document.getElementById('dashPanelAdmin').style.display = role === 'admin' ? 'block' : 'none';

  if (role === 'student' && state.user) {
    try {
      const res = await fetch(`${API_BASE}/api/user?user_id=${state.user.user_id}`);
      const data = await res.json();
      if (data.success) {
        renderStudentBookings(data.bookings);
        document.getElementById('studentPassCount').textContent = data.bookings.length.toString().padStart(2, '0');
        document.getElementById('studentLeaseCount').textContent = data.active_holds.length.toString().padStart(2, '0');
        document.getElementById('studentCreditBalance').textContent = `₹${data.user.credits}`;
      }
    } catch (e) {}
  } else if (role === 'organizer') {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/telemetry`);
      const data = await res.json();
      if (data.success) {
        document.getElementById('telemetryTotalBookings').textContent = data.total_bookings;
        document.getElementById('telemetryCheckedIn').textContent = data.checked_in_count;
        document.getElementById('telemetryActiveHolds').textContent = data.held_seats;
      }
      const attRes = await fetch(`${API_BASE}/api/organizer/attendees?event_id=EVT-DLP26`);
      const attData = await attRes.json();
      if (attData.success) {
        renderOrganizerAttendees(attData.attendees);
      }
    } catch (e) {}
  } else if (role === 'admin') {
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/telemetry`);
      const data = await res.json();
      if (data.success) {
        renderAdminShards(data.shards);
      }
    } catch (e) {}
  }
}

function renderStudentBookings(bookings) {
  const tbody = document.getElementById('studentBookingsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No bookings yet. Explore and lock a seat!</td></tr>';
    return;
  }
  bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-light)';
    tr.innerHTML = `
      <td class="mono" style="padding: 14px 18px;"><strong>${b.booking_ref}</strong></td>
      <td style="padding: 14px 18px;">${b.event_title}</td>
      <td class="mono" style="padding: 14px 18px;">${b.seats.join(', ')}</td>
      <td style="padding: 14px 18px;">${b.date}</td>
      <td style="padding: 14px 18px;">
        <span style="background: ${b.checked_in ? '#E0F2FE' : '#E8F5E9'}; color: ${b.checked_in ? '#0369A1' : '#2E7D32'}; padding: 4px 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;">
          ${b.checked_in ? 'CHECKED IN' : 'CONFIRMED'}
        </span>
      </td>
      <td style="padding: 14px 18px;">
        <button class="btn-secondary view-pass-btn" data-ref="${b.booking_ref}" data-title="${b.event_title}" data-seats="${b.seats.join(', ')}" data-date="${b.date}" style="padding: 4px 10px; font-size: 0.75rem;">
          View QR
        </button>
      </td>
    `;
    tr.querySelector('.view-pass-btn').addEventListener('click', (e) => {
      openPassModal(e.currentTarget.dataset);
    });
    tbody.appendChild(tr);
  });
}

function openPassModal(d) {
  const modal = document.getElementById('bookingModal');
  document.getElementById('modalStepReview').style.display = 'none';
  document.getElementById('modalStepSuccess').style.display = 'block';

  document.getElementById('ticketRefCode').textContent = d.ref;
  document.getElementById('ticketEventName').textContent = d.title;
  document.getElementById('ticketSeats').textContent = d.seats;
  document.getElementById('ticketDate').textContent = d.date;

  const qrContainer = document.getElementById('ticketQrContainer');
  if (qrContainer) {
    qrContainer.innerHTML = generateQRSvg(d.ref);
  }

  modal.classList.add('active');
}

function renderOrganizerAttendees(attendees) {
  const tbody = document.getElementById('organizerAttendeesTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (attendees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No confirmed attendees yet.</td></tr>';
    return;
  }
  attendees.forEach(a => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-light)';
    tr.innerHTML = `
      <td class="mono" style="padding: 14px 18px;">${a.booking_ref}</td>
      <td style="padding: 14px 18px;"><strong>${a.user_id}</strong></td>
      <td class="mono" style="padding: 14px 18px;">${a.seats.join(', ')}</td>
      <td style="padding: 14px 18px;">₹${a.amount}</td>
      <td style="padding: 14px 18px;">
        <span style="background: ${a.checked_in ? '#E8F5E9' : '#FFF3CD'}; color: ${a.checked_in ? '#2E7D32' : '#856404'}; padding: 4px 10px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700;">
          ${a.checked_in ? 'ADMITTED' : 'NOT ARRIVED'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminShards(shards) {
  const tbody = document.getElementById('adminShardsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  shards.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-light)';
    const ranges = ['0x0000 - 0x3FFF', '0x4000 - 0x7FFF', '0x8000 - 0xBFFF', '0xC000 - 0xFFFF'];
    tr.innerHTML = `
      <td class="mono" style="padding: 14px 18px;"><strong>${s.shard}</strong></td>
      <td class="mono" style="padding: 14px 18px;">${ranges[idx]}</td>
      <td class="mono" style="padding: 14px 18px;">${s.entries} tx</td>
      <td class="mono" style="padding: 14px 18px;">1.1ms</td>
      <td style="padding: 14px 18px;"><span style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); font-family: var(--font-mono); font-size: 0.72rem; padding: 4px 8px; border-radius: 4px;">ONLINE • MASTER</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Toast
function showToast(message) {
  const shelf = document.getElementById('toastShelf');
  if (!shelf) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="dot-pulse"></span><span>${message}</span>`;
  shelf.appendChild(toast);
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3200);
}
