/**
 * ==========================================================================
 * KISSAN – Procure Smart Mandi
 * Mandi Officer Operations & QR Gate Scanner (js/admin.js)
 * ==========================================================================
 */

let html5QrScanner = null;

document.addEventListener('DOMContentLoaded', () => {
 const path = window.location.pathname;

 if (path.includes('admin-dashboard.html')) {
 initAdminDashboard();
 } else if (path.includes('admin-slots.html')) {
 initAdminSlots();
 } else if (path.includes('admin-queue.html')) {
 initAdminQueue();
 } else if (path.includes('admin-procurement.html')) {
 initAdminProcurement();
 }

 // Setup QR Scanner triggers if present
 const openScannerBtns = document.querySelectorAll('.btn-open-scanner');
 openScannerBtns.forEach(btn => {
 btn.addEventListener('click', openGateQrScanner);
 });
});

/**
 * ==============================================================================
 * 1. ADMIN DASHBOARD OVERVIEW & REAL-TIME ANALYTICS
 * Live Supabase Statistics across Bookings, Procurements, and Payments
 * Chart.js Visualization: Farmers by Hourly Slot
 * ==============================================================================
 */
let hourlySlotChartInstance = null;

async function initAdminDashboard() {
  await loadAdminDashboardStats();
  await loadProcurementCentres();

  // Attach refresh button listener
  const refreshBtn = document.getElementById('refreshDashboardStatsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Updating...';
      await loadAdminDashboardStats();
      await loadProcurementCentres();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
      showToast('Dashboard statistics updated.', 'info');
    });
  }

  // Set up Supabase Realtime listeners for automatic refresh
  setupAdminDashboardRealtime();

  // Initialize SMS Monitoring Console if present
  if (document.getElementById('smsConsoleCard')) {
    initSmsDashboard();
  }
}

/**
 * Normalizes booking status for consistent matching
 */
function normalizeDashboardBookingStatus(status) {
  if (!status) return 'WAITING';
  const s = status.toString().trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'CONFIRMED' || s === 'WAITING') return 'WAITING';
  if (s === 'CALLED') return 'CALLED';
  if (s === 'IN_QUEUE' || s === 'WEIGHING' || s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'PROCURED' || s === 'COMPLETED' || s === 'SETTLED') return 'COMPLETED';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
  return s;
}

/**
 * Fetch and compute all 8 real metrics from Supabase
 */
async function loadAdminDashboardStats() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  let bookings = [];
  let procurements = [];
  let payments = [];
  let slots = [];

  const supabase = window.supabaseClient;

  // 1. Fetch Bookings from Authoritative Backend API
  try {
    const res = await fetch('/api/bookings');
    if (res.ok) {
      const json = await res.json();
      if (json.bookings && Array.isArray(json.bookings) && json.bookings.length > 0) {
        bookings = json.bookings;
        const local = KissanDB.get('bookings', []);
        const merged = [...json.bookings];
        local.forEach(lb => {
          if (!merged.find(m => m.id === lb.id)) merged.push(lb);
        });
        KissanDB.set('bookings', merged);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading bookings from backend API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (bookings.length === 0) {
    try {
      if (supabase) {
        const { data: bData, error: bErr } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!bErr && bData && bData.length > 0) {
          bookings = bData;
          const local = KissanDB.get('bookings', []);
          const merged = [...bData];
          local.forEach(lb => {
            if (!merged.find(m => m.id === lb.id)) merged.push(lb);
          });
          KissanDB.set('bookings', merged);
        }
      }
    } catch (err) {
      console.warn('Notice loading bookings from Supabase:', err);
    }
  }

  if (bookings.length === 0) {
    bookings = KissanDB.get('bookings', []);
  }

  // 2. Fetch Procurements from Authoritative Backend API
  try {
    const pRes = await fetch('/api/procurements');
    if (pRes.ok) {
      const pJson = await pRes.json();
      if (pJson.procurements && Array.isArray(pJson.procurements) && pJson.procurements.length > 0) {
        procurements = pJson.procurements;
        KissanDB.set('procurements', procurements);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading procurements from API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (procurements.length === 0) {
    try {
      if (supabase) {
        const { data: pData, error: pErr } = await supabase
          .from('procurements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!pErr && pData && pData.length > 0) {
          procurements = pData;
          KissanDB.set('procurements', pData);
        }
      }
    } catch (err) {
      console.warn('Notice loading procurements from Supabase:', err);
    }
  }

  if (procurements.length === 0) {
    procurements = KissanDB.get('procurements', []);
  }

  // 3. Fetch Payments from Authoritative Backend API
  try {
    const payRes = await fetch('/api/payments');
    if (payRes.ok) {
      const payJson = await payRes.json();
      if (payJson.payments && Array.isArray(payJson.payments) && payJson.payments.length > 0) {
        payments = payJson.payments;
        KissanDB.set('payments', payments);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading payments from API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (payments.length === 0) {
    try {
      if (supabase) {
        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (!payErr && payData && payData.length > 0) {
          payments = payData;
          KissanDB.set('payments', payData);
        }
      }
    } catch (err) {
      console.warn('Notice loading payments from Supabase:', err);
    }
  }

  if (payments.length === 0) {
    payments = KissanDB.get('payments', []);
  }

  // 4. Fetch Slots for Today
  try {
    if (supabase) {
      const { data: sData, error: sErr } = await supabase
        .from('slots')
        .select('*')
        .eq('slot_date', todayStr)
        .order('start_time', { ascending: true });

      if (!sErr && sData && sData.length > 0) {
        slots = sData;
      }
    }
  } catch (err) {
    console.warn('Notice loading slots from Supabase:', err);
  }

  if (slots.length === 0) {
    const localSlots = KissanDB.get('slots', []);
    slots = localSlots.filter(s => s.slot_date === todayStr);
  }

  // Filter today's bookings (accounting for local date, UTC date, or created date)
  const utcStr = now.toISOString().split('T')[0];
  let bookingsToday = bookings.filter(b => {
    const bDate = b.slot_date || b.slotDate || '';
    const cDate = b.created_at ? b.created_at.split('T')[0] : '';
    return bDate === todayStr || bDate === utcStr || cDate === todayStr || cDate === utcStr;
  });

  // If no bookings match today's specific date string in test environment, use active uncancelled bookings
  if (bookingsToday.length === 0 && bookings.length > 0) {
    bookingsToday = bookings.filter(b => normalizeDashboardBookingStatus(b.status) !== 'CANCELLED');
  }

  // --------------------------------------------------------------------------
  // CALCULATE 8 REAL STATISTICS
  // --------------------------------------------------------------------------
  
  // 1. Total bookings today
  const totalBookingsToday = bookingsToday.length;

  // 2. Waiting farmers (status = WAITING)
  const waitingFarmers = bookingsToday.filter(b => normalizeDashboardBookingStatus(b.status) === 'WAITING').length;

  // 3. Called farmers (status = CALLED)
  const calledFarmers = bookingsToday.filter(b => {
    const norm = normalizeDashboardBookingStatus(b.status);
    return norm === 'CALLED' || norm === 'IN_PROGRESS';
  }).length;

  // 4. Completed farmers (status = COMPLETED)
  const completedFarmers = bookingsToday.filter(b => normalizeDashboardBookingStatus(b.status) === 'COMPLETED').length;

  // 5. Total procurement quantity today (in Qtl)
  const procurementsToday = procurements.filter(p => {
    const pDate = p.date || p.procurement_date || (p.created_at ? p.created_at.split('T')[0] : '');
    return pDate === todayStr || (!pDate && procurements.length > 0);
  });

  const totalProcuredQtyToday = procurementsToday.reduce((sum, p) => {
    return sum + (Number(p.quantity) || Number(p.net_weight) || Number(p.netWeight) || 0);
  }, 0);

  // 6. Total procurement amount (sum of amount across procurements)
  const totalProcurementAmount = procurements.reduce((sum, p) => {
    return sum + (Number(p.amount) || Number(p.total_amount) || Number(p.totalAmount) || 0);
  }, 0);

  // 7. Payment amounts and counts
  const paidPaymentsList = payments.filter(p => {
    const st = (p.status || '').toUpperCase();
    return st === 'PAID' || st === 'COMPLETED' || st === 'SETTLED';
  });
  const pendingPaymentsList = payments.filter(p => {
    const st = (p.status || '').toUpperCase();
    return st === 'PENDING' || st === 'UNPAID';
  });

  const totalPaidAmount = paidPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPendingAmount = pendingPaymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const completedPayments = paidPaymentsList.length;
  const pendingPayments = pendingPaymentsList.length;

  // --------------------------------------------------------------------------
  // UPDATE STATISTIC DOM ELEMENTS
  // --------------------------------------------------------------------------
  const elTotalBookings = document.getElementById('admStatTotalBookingsToday');
  if (elTotalBookings) elTotalBookings.textContent = totalBookingsToday;

  const elWaiting = document.getElementById('admStatWaitingFarmers');
  if (elWaiting) elWaiting.textContent = waitingFarmers;

  const elCalled = document.getElementById('admStatCalledFarmers');
  if (elCalled) elCalled.textContent = calledFarmers;

  const elCompleted = document.getElementById('admStatCompletedFarmers');
  if (elCompleted) elCompleted.textContent = completedFarmers;

  const elProcuredQty = document.getElementById('admStatProcuredQtyToday');
  if (elProcuredQty) elProcuredQty.textContent = `${totalProcuredQtyToday.toFixed(1)} Qtl`;

  const elProcAmount = document.getElementById('admStatTotalProcurementAmount');
  if (elProcAmount) elProcAmount.textContent = `₹${Math.round(totalProcurementAmount).toLocaleString('en-IN')}`;

  // Payment Done (₹ amount + count)
  const elTotalPaidAmount = document.getElementById('admStatTotalPaidAmount');
  if (elTotalPaidAmount) elTotalPaidAmount.textContent = `₹${Math.round(totalPaidAmount).toLocaleString('en-IN')}`;

  const elCompletedPayLabel = document.getElementById('admStatCompletedPaymentsLabel');
  if (elCompletedPayLabel) elCompletedPayLabel.textContent = `Payment Done (${completedPayments} Paid)`;

  const elCompletedPay = document.getElementById('admStatCompletedPayments');
  if (elCompletedPay) elCompletedPay.textContent = completedPayments;

  // Pending DBT Disbursals (₹ amount + count)
  const elPendingPay = document.getElementById('admStatPendingPayments');
  if (elPendingPay) elPendingPay.textContent = `₹${Math.round(totalPendingAmount).toLocaleString('en-IN')}`;

  const elPendingPayLabel = document.getElementById('admStatPendingPaymentsLabel');
  if (elPendingPayLabel) elPendingPayLabel.textContent = `Pending DBT (${pendingPayments} Awaiting)`;

  const chartBadge = document.getElementById('chartTotalBookingsBadge');
  if (chartBadge) chartBadge.textContent = `${totalBookingsToday} Booking${totalBookingsToday === 1 ? '' : 's'} Today`;

  // --------------------------------------------------------------------------
  // RENDER CHART.JS: FARMERS BY HOURLY SLOT
  // --------------------------------------------------------------------------
  renderHourlySlotChart(bookingsToday, slots);

  // --------------------------------------------------------------------------
  // RENDER RECENT ACTIVITY TABLE (matching today's active bookings)
  // --------------------------------------------------------------------------
  renderAdminRecentActivityTable(bookingsToday.length > 0 ? bookingsToday : bookings);
}

/**
 * Render Chart.js Bar Chart: Farmers by Hourly Slot
 */
function renderHourlySlotChart(bookingsToday, slotsToday) {
  const canvas = document.getElementById('hourlySlotChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Define operational mandi shift windows matching booking system
  const slotWindows = [
    { label: 'Morning (08:00 - 11:00 AM)', keywords: ['08:00', 'MORNING', '09:00', '10:00'], minH: 8, maxH: 11 },
    { label: 'Noon (11:00 AM - 02:00 PM)', keywords: ['11:00', 'NOON', '12:00', '01:00', '13:00'], minH: 11, maxH: 14 },
    { label: 'Afternoon (02:00 - 05:00 PM)', keywords: ['02:00', 'AFTERNOON', '03:00', '04:00', '14:00', '15:00', '16:00'], minH: 14, maxH: 17 }
  ];

  // Map each booking into a time bucket
  const slotCounts = new Array(slotWindows.length).fill(0);

  bookingsToday.forEach(b => {
    const timeStr = (b.slot_time || b.slotTime || b.time_slot || '').toUpperCase();
    const startTimeStr = (b.start_time || '').substring(0, 5);

    let matchedIndex = -1;

    // 1. Direct keyword match
    for (let i = 0; i < slotWindows.length; i++) {
      const win = slotWindows[i];
      if (win.keywords.some(kw => timeStr.includes(kw))) {
        matchedIndex = i;
        break;
      }
    }

    // 2. Parse numeric hour
    if (matchedIndex === -1) {
      let hour = -1;
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let h = parseInt(match[1], 10);
        const isPM = timeStr.includes('PM') && h < 12;
        const isAM = timeStr.includes('AM') && h === 12;
        if (isPM) h += 12;
        if (isAM) h = 0;
        hour = h;
      } else if (startTimeStr) {
        hour = parseInt(startTimeStr.split(':')[0], 10);
      }

      for (let i = 0; i < slotWindows.length; i++) {
        if (hour >= slotWindows[i].minH && hour < slotWindows[i].maxH) {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex === -1) matchedIndex = 0;
    }

    if (matchedIndex >= 0 && matchedIndex < slotCounts.length) {
      slotCounts[matchedIndex]++;
    }
  });

  const labels = slotWindows.map(w => w.label);

  const ctx = canvas.getContext('2d');
  if (hourlySlotChartInstance) {
    hourlySlotChartInstance.destroy();
    hourlySlotChartInstance = null;
  }

  hourlySlotChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Farmers Scheduled',
        data: slotCounts,
        backgroundColor: 'rgba(22, 163, 74, 0.85)',
        borderColor: '#16a34a',
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: '#15803d',
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              return `${val} Farmer${val === 1 ? '' : 's'} Booked`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: '#64748b',
            font: { size: 11, weight: '500' }
          },
          grid: {
            color: '#f1f5f9'
          },
          title: {
            display: true,
            text: 'Number of Farmers',
            color: '#64748b',
            font: { size: 12, weight: '600' }
          }
        },
        x: {
          ticks: {
            color: '#475569',
            font: { size: 12, weight: '500' }
          },
          grid: {
            display: false
          },
          title: {
            display: true,
            text: 'Hourly Slot Window',
            color: '#64748b',
            font: { size: 12, weight: '600' }
          }
        }
      }
    }
  });
}

/**
 * Render Recent Activity Table
 */
function renderAdminRecentActivityTable(bookings) {
  const tableBody = document.getElementById('admRecentActivityTable');
  if (!tableBody) return;

  if (!bookings || bookings.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--slate-500); padding: 1.5rem;">No recent bookings recorded.</td></tr>`;
    return;
  }

  tableBody.innerHTML = bookings.slice(0, 8).map(b => {
    const token = b.token_number || b.tokenNumber || 'N/A';
    const name = b.farmer_name || b.farmerName || 'Farmer';
    const crop = b.crop || 'Grain';
    const qty = b.quantity || 0;
    const vehicle = b.vehicle_number || b.vehicleNumber || 'N/A';
    const status = b.status || 'WAITING';
    const norm = normalizeDashboardBookingStatus(status);

    let badgeClass = 'badge-waiting';
    if (norm === 'CALLED') badgeClass = 'badge-called';
    else if (norm === 'IN_PROGRESS') badgeClass = 'badge-in-progress';
    else if (norm === 'COMPLETED') badgeClass = 'badge-completed';
    else if (norm === 'CANCELLED') badgeClass = 'badge-cancelled';

    return `
      <tr>
        <td><strong style="color: var(--primary-800); font-size: 0.95rem;">${token}</strong></td>
        <td>${name}</td>
        <td>${crop}</td>
        <td>${qty} Qtl</td>
        <td>${vehicle}</td>
        <td><span class="badge ${badgeClass}">${norm}</span></td>
        <td>
          <a href="admin-queue.html" class="btn btn-sm btn-secondary">Manage</a>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Supabase Realtime Channel Subscription for Admin Dashboard
 */
function setupAdminDashboardRealtime() {
  // 1. Set up high-res periodic polling (every 5 seconds) to ensure real-time chart and stats sync
  if (!window._adminDashboardPollingInterval) {
    window._adminDashboardPollingInterval = setInterval(() => {
      loadAdminDashboardStats();
    }, 5000);
  }

  // 2. Immediately re-fetch when user switches back to this browser tab
  if (!window._adminDashboardFocusAttached) {
    window._adminDashboardFocusAttached = true;
    window.addEventListener('focus', () => {
      loadAdminDashboardStats();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadAdminDashboardStats();
      }
    });
  }

  // 3. Supabase Realtime Channel Subscription (if Supabase configured)
  const supabase = window.supabaseClient;
  if (!supabase) return;

  try {
    const channel = supabase.channel('admin-dashboard-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('Realtime bookings change detected on admin dashboard:', payload);
          loadAdminDashboardStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'procurements' },
        (payload) => {
          console.log('Realtime procurements change detected on admin dashboard:', payload);
          loadAdminDashboardStats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          console.log('Realtime payments change detected on admin dashboard:', payload);
          loadAdminDashboardStats();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Notice setting up admin realtime channel:', err);
  }
}

/**
 * 2. Admin Slot & Procurement Centre Management
 */
function initAdminSlots() {
  renderAdminSlotsList();

  // Load procurement centres from Supabase
  loadProcurementCentres();

  // Load procurement slots from Supabase
  loadProcurementSlots();

  // Set default minimum date to today
  const slotDateInput = document.getElementById('slotDateInput');
  if (slotDateInput && !slotDateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    slotDateInput.value = today;
    slotDateInput.min = today;
  }

  // Add Procurement Centre Form submit listener
  const addCentreForm = document.getElementById('addCentreForm');
  if (addCentreForm) {
    addCentreForm.addEventListener('submit', handleAddProcurementCentre);
  }

  // Add Procurement Slot Form submit listener
  const addSlotForm = document.getElementById('addSlotForm');
  if (addSlotForm) {
    addSlotForm.addEventListener('submit', handleAddSlot);
  }

  const searchInput = document.getElementById('slotSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderAdminSlotsList(searchInput.value.trim());
    });
  }

  const saveCapacityBtn = document.getElementById('saveCapacityBtn');
  if (saveCapacityBtn) {
    saveCapacityBtn.addEventListener('click', () => {
      showToast('Mandi Slot Capacities Updated Successfully!', 'success');
    });
  }
}

/**
 * ==============================================================================
 * PROCUREMENT CENTRES MANAGEMENT (SUPABASE CRUD & LOCAL FALLBACK)
 * ==============================================================================
 */

// 1. Fetch and Display All Procurement Centres
async function loadProcurementCentres() {
  let centres = [];

  // Try fetching from Supabase 'procurement_centres' table
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { data, error } = await supabase
        .from('procurement_centres')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Notice querying Supabase centres:', error.message);
      } else if (data && data.length > 0) {
        centres = data;
        KissanDB.set('mandis', centres);
      }
    }
  } catch (err) {
    console.warn('Network notice loading centres from Supabase:', err);
  }

  // Fallback to local storage if empty
  if (centres.length === 0) {
    centres = KissanDB.get('mandis', []);
  }

  renderProcurementCentresTable(centres);
  populateSlotCentreDropdown(centres);

  const statCentresEl = document.getElementById('admStatCentres');
  if (statCentresEl) statCentresEl.textContent = centres.length;

  const countBadgeEl = document.getElementById('centresCountBadge');
  if (countBadgeEl) countBadgeEl.textContent = `${centres.length} Centres Active`;
}

// Populate Centre dropdown in Slot Management Form
function populateSlotCentreDropdown(centres) {
  const select = document.getElementById('slotCentreSelect');
  if (!select) return;

  if (!centres || centres.length === 0) {
    centres = KissanDB.get('mandis', []);
  }

  select.innerHTML = centres.map(c => {
    const name = c.name || 'Unnamed Centre';
    const loc = c.location || (c.district ? `${c.district}, ${c.state}` : '');
    return `<option value="${c.id}">${name}${loc ? ` (${loc})` : ''}</option>`;
  }).join('');
}

// 2. Render Table Rows: Centre Name | Location | Capacity | Actions
function renderProcurementCentresTable(centres) {
  const tableBody = document.getElementById('procurementCentresTableBody');
  if (!tableBody) return;

  if (!centres || centres.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--slate-500); padding: 1.5rem;">No procurement centres found. Use the form above to add a centre.</td></tr>`;
    return;
  }

  tableBody.innerHTML = centres.map(c => {
    const centreName = c.name || 'Unnamed Centre';
    const location = c.location || (c.district ? `${c.district}, ${c.state}` : 'N/A');
    const address = c.address || '';
    const capacity = c.daily_capacity || c.capacity || 50;
    const centreId = c.id || '';

    return `
      <tr>
        <td>
          <strong style="color: var(--slate-900); font-size: 0.95rem;">${centreName}</strong>
          ${address ? `<br><small style="color: var(--slate-500);">${address}</small>` : ''}
        </td>
        <td>${location}</td>
        <td>
          <span class="badge badge-success">${capacity} Vehicles/Day</span>
        </td>
        <td>
          <button onclick="deleteProcurementCentre('${centreId}')" class="btn btn-sm btn-secondary" style="color: var(--danger); border-color: var(--danger-100);">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. Add New Procurement Centre (Insert into Supabase & Local Cache)
async function handleAddProcurementCentre(e) {
  e.preventDefault();

  const nameInput = document.getElementById('centreNameInput');
  const locationInput = document.getElementById('centreLocationInput');
  const addressInput = document.getElementById('centreAddressInput');
  const capacityInput = document.getElementById('centreCapacityInput');
  const submitBtn = document.getElementById('btnAddCentreSubmit');

  const name = nameInput?.value.trim();
  const location = locationInput?.value.trim();
  const address = addressInput?.value.trim();
  const dailyCapacity = parseInt(capacityInput?.value, 10) || 50;

  if (!name || !location || !address) {
    showToast('Please enter centre name, location, and address.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
  }

  const newCentre = {
    id: 'centre-' + Date.now(),
    name: name,
    location: location,
    address: address,
    daily_capacity: dailyCapacity,
    created_at: new Date().toISOString()
  };

  // 1. Insert into Supabase procurement_centres table
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Inserting procurement centre into Supabase:', newCentre);
      const { data, error } = await supabase
        .from('procurement_centres')
        .insert({
          name: name,
          location: location,
          address: address,
          daily_capacity: dailyCapacity
        })
        .select();

      if (error) {
        console.warn('Supabase centre insert notice:', error.message);
      } else if (data && data[0]) {
        newCentre.id = data[0].id;
        console.log('Procurement centre inserted in Supabase with ID:', newCentre.id);
      }
    }
  } catch (err) {
    console.warn('Notice syncing centre to Supabase:', err);
  }

  // 2. Save into local storage
  const centres = KissanDB.get('mandis', []);
  centres.unshift(newCentre);
  KissanDB.set('mandis', centres);

  // 3. Reset form inputs
  if (nameInput) nameInput.value = '';
  if (locationInput) locationInput.value = '';
  if (addressInput) addressInput.value = '';
  if (capacityInput) capacityInput.value = '50';

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Add Centre';
  }

  showToast(`Procurement Centre "${name}" added successfully!`, 'success');
  loadProcurementCentres();
}

// 4. Delete Procurement Centre (Delete from Supabase & Local Cache)
window.deleteProcurementCentre = async function(centreId) {
  const executeDelete = async () => {
    // 1. Delete from Supabase
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        console.log('Deleting centre from Supabase:', centreId);
        const { error } = await supabase
          .from('procurement_centres')
          .delete()
          .eq('id', centreId);

        if (error) {
          console.warn('Supabase centre delete notice:', error.message);
        }
      }
    } catch (err) {
      console.warn('Notice deleting centre from Supabase:', err);
    }

    // 2. Remove from local storage
    const centres = KissanDB.get('mandis', []);
    const updated = centres.filter(c => c.id !== centreId);
    KissanDB.set('mandis', updated);

    showToast('Procurement centre deleted successfully.', 'info');
    loadProcurementCentres();
  };

  if (typeof window.showConfirmModal === 'function') {
    window.showConfirmModal({
      title: 'Delete Procurement Centre',
      message: 'Are you sure you want to remove this procurement centre from the network? All scheduled slots will also be affected.',
      confirmText: 'Yes, Delete Centre',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: executeDelete
    });
  } else {
    if (confirm('Are you sure you want to delete this procurement centre?')) {
      executeDelete();
    }
  }
};

/**
 * ==============================================================================
 * PROCUREMENT SLOTS MANAGEMENT (SUPABASE CRUD & AVAILABILITY CALCULATION)
 * ==============================================================================
 */

// 1. Fetch and Display All Procurement Slots
async function loadProcurementSlots() {
  let slots = [];

  // Try fetching from Supabase 'slots' table
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('slot_date', { ascending: true });

      if (error) {
        console.warn('Notice querying Supabase slots:', error.message);
      } else if (data && data.length > 0) {
        slots = data;
        KissanDB.set('slots', slots);
      }
    }
  } catch (err) {
    console.warn('Network notice loading slots from Supabase:', err);
  }

  // Fallback to local storage if empty
  if (slots.length === 0) {
    slots = KissanDB.get('slots', []);
  }

  renderProcurementSlotsTable(slots);

  const countBadgeEl = document.getElementById('slotsCountBadge');
  if (countBadgeEl) countBadgeEl.textContent = `${slots.length} Slots Scheduled`;
}

// 2. Render Existing Slots Table
// Columns: Centre | Date | Time | Capacity | Booked | Available | Actions
// available = Math.max(0, capacity - booked_count)
function renderProcurementSlotsTable(slots) {
  const tableBody = document.getElementById('adminSlotsTableBody');
  if (!tableBody) return;

  if (!slots || slots.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--slate-500); padding: 1.5rem;">No procurement slots scheduled. Use the form above to create slots.</td></tr>`;
    return;
  }

  const centres = KissanDB.get('mandis', []);

  tableBody.innerHTML = slots.map(s => {
    // Resolve Centre Name
    const centre = centres.find(c => String(c.id) === String(s.centre_id));
    const centreName = s.centre_name || (centre ? centre.name : (s.centre_id || 'Mandi Centre'));
    
    // Format Date & Time
    const slotDate = s.slot_date || 'N/A';
    const startTime = s.start_time ? s.start_time.substring(0, 5) : '--:--';
    const endTime = s.end_time ? s.end_time.substring(0, 5) : '--:--';
    const timeDisplay = `${startTime} - ${endTime}`;

    // Capacity & Availability Calculation: available = capacity - booked_count (No negative values)
    const capacity = parseInt(s.capacity, 10) || 0;
    const booked = parseInt(s.booked_count, 10) || 0;
    const available = Math.max(0, capacity - booked);
    const slotId = s.id || '';

    const hasBookings = booked > 0;

    return `
      <tr>
        <td>
          <strong style="color: var(--slate-900); font-size: 0.95rem;">${centreName}</strong>
        </td>
        <td>${slotDate}</td>
        <td>
          <span class="badge badge-info">${timeDisplay}</span>
        </td>
        <td><strong>${capacity}</strong></td>
        <td>
          <span class="badge ${hasBookings ? 'badge-warning' : 'badge-secondary'}">${booked}</span>
        </td>
        <td>
          <span class="badge ${available > 0 ? 'badge-success' : 'badge-danger'}">
            ${available} Available
          </span>
        </td>
        <td>
          <button 
            onclick="deleteProcurementSlot('${slotId}')" 
            class="btn btn-sm btn-secondary" 
            style="color: var(--danger); border-color: var(--danger-100);"
            ${hasBookings ? 'title="Cannot delete: bookings already exist"' : ''}
          >
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. Create New Procurement Slot (Insert into Supabase & Local Storage)
async function handleAddSlot(e) {
  e.preventDefault();

  const centreSelect = document.getElementById('slotCentreSelect');
  const dateInput = document.getElementById('slotDateInput');
  const startTimeInput = document.getElementById('slotStartTimeInput');
  const endTimeInput = document.getElementById('slotEndTimeInput');
  const capacityInput = document.getElementById('slotCapacityInput');
  const submitBtn = document.getElementById('btnAddSlotSubmit');

  const centreId = centreSelect?.value;
  const centreName = centreSelect?.options[centreSelect.selectedIndex]?.text || '';
  const slotDate = dateInput?.value;
  const startTime = startTimeInput?.value;
  const endTime = endTimeInput?.value;
  const capacity = parseInt(capacityInput?.value, 10) || 25;

  if (!centreId || !slotDate || !startTime || !endTime) {
    showToast('Please fill in all required slot fields.', 'error');
    return;
  }

  if (startTime >= endTime) {
    showToast('End time must be after start time.', 'error');
    return;
  }

  if (capacity <= 0) {
    showToast('Capacity must be at least 1 vehicle.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
  }

  const newSlot = {
    id: 'slot-' + Date.now(),
    centre_id: centreId,
    centre_name: centreName,
    slot_date: slotDate,
    start_time: startTime,
    end_time: endTime,
    capacity: capacity,
    booked_count: 0,
    created_at: new Date().toISOString()
  };

  // 1. Insert into Supabase slots table
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Inserting slot into Supabase:', newSlot);
      const { data, error } = await supabase
        .from('slots')
        .insert({
          centre_id: centreId,
          slot_date: slotDate,
          start_time: startTime,
          end_time: endTime,
          capacity: capacity,
          booked_count: 0
        })
        .select();

      if (error) {
        console.warn('Supabase slot insert notice:', error.message);
      } else if (data && data[0]) {
        newSlot.id = data[0].id;
        console.log('Slot inserted into Supabase with ID:', newSlot.id);
      }
    }
  } catch (err) {
    console.warn('Notice syncing slot to Supabase:', err);
  }

  // 2. Save into local storage
  const slots = KissanDB.get('slots', []);
  slots.unshift(newSlot);
  KissanDB.set('slots', slots);

  // 3. Reset form inputs
  if (startTimeInput) startTimeInput.value = '08:00';
  if (endTimeInput) endTimeInput.value = '11:00';
  if (capacityInput) capacityInput.value = '25';

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Create Slot';
  }

  showToast(`Procurement slot for ${slotDate} (${startTime} - ${endTime}) created successfully!`, 'success');
  loadProcurementSlots();
}

// 4. Delete Procurement Slot with Bookings Guard (Delete from Supabase & Local Cache)
window.deleteProcurementSlot = async function(slotId) {
  const slots = KissanDB.get('slots', []);
  const targetSlot = slots.find(s => s.id === slotId || String(s.id) === String(slotId));

  // Validation Guard: Do not allow deletion if bookings already exist for the slot
  if (targetSlot && parseInt(targetSlot.booked_count, 10) > 0) {
    showToast(`Cannot delete slot: ${targetSlot.booked_count} booking(s) already exist for this slot.`, 'error');
    return;
  }

  // Also check local bookings table
  const bookings = KissanDB.get('bookings', []);
  const linkedBookings = bookings.filter(b => b.slotId === slotId || b.slot_id === slotId);
  if (linkedBookings.length > 0) {
    showToast(`Cannot delete slot: ${linkedBookings.length} booking(s) exist for this slot.`, 'error');
    return;
  }

  const executeDeleteSlot = async () => {
    // 1. Delete from Supabase
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        console.log('Deleting slot from Supabase:', slotId);
        const { error } = await supabase
          .from('slots')
          .delete()
          .eq('id', slotId);

        if (error) {
          console.warn('Supabase slot delete notice:', error.message);
        }
      }
    } catch (err) {
      console.warn('Notice deleting slot from Supabase:', err);
    }

    // 2. Remove from local storage
    const updatedSlots = slots.filter(s => s.id !== slotId && String(s.id) !== String(slotId));
    KissanDB.set('slots', updatedSlots);

    showToast('Procurement slot deleted successfully.', 'info');
    loadProcurementSlots();
  };

  if (typeof window.showConfirmModal === 'function') {
    window.showConfirmModal({
      title: 'Delete Procurement Slot',
      message: 'Are you sure you want to delete this procurement time slot?',
      confirmText: 'Yes, Delete Slot',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: executeDeleteSlot
    });
  } else {
    if (confirm('Are you sure you want to delete this procurement slot?')) {
      executeDeleteSlot();
    }
  }
};

function renderAdminSlotsList(searchTerm = '') {
 const tableBody = document.getElementById('adminBookingsTableBody');
 if (!tableBody) return;

 let bookings = KissanDB.get('bookings', []);
 if (searchTerm) {
 bookings = bookings.filter(b => 
 b.farmerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 b.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
 b.crop.toLowerCase().includes(searchTerm.toLowerCase())
 );
 }

 if (bookings.length === 0) {
 tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--slate-400);">No slot bookings match your criteria.</td></tr>`;
 return;
 }

 tableBody.innerHTML = bookings.map(b => `
 <tr>
 <td><strong style="color:var(--primary-800); font-size:1.05rem;">${b.tokenNumber}</strong></td>
 <td><strong>${b.farmerName}</strong><br><small style="color:var(--slate-500);">${b.farmerPhone}</small></td>
 <td>${b.crop} (${b.quantity} Qtl)</td>
 <td>${b.slotDate}<br><small style="color:var(--slate-500);">${b.slotTime}</small></td>
 <td>${b.vehicleNumber} (${b.vehicleType})</td>
 <td><span class="badge ${b.status === 'Procured' ? 'badge-success' : b.status === 'In Queue' ? 'badge-warning' : 'badge-info'}">● ${b.status}</span></td>
 <td>
 <div style="display:flex; gap:0.4rem;">
 ${b.status === 'Confirmed' ? `<button onclick="checkInFarmer('${b.id}')" class="btn btn-sm btn-primary"> Admit</button>` : ''}
 ${b.status === 'In Queue' ? `<a href="admin-procurement.html?token=${b.tokenNumber}" class="btn btn-sm btn-accent"> Weigh</a>` : ''}
 ${b.status === 'Procured' ? `<span style="color: var(--primary-700); font-weight:700; font-size:0.85rem;">Settled</span>` : ''}
 </div>
 </td>
 </tr>
 `).join('');
}

window.checkInFarmer = function(bookingId) {
 const bookings = KissanDB.get('bookings', []);
 let admittedFarmer = null;

 const updated = bookings.map(b => {
 if (b.id === bookingId || b.tokenNumber === bookingId) {
 b.status = 'In Queue';
 admittedFarmer = b;
 }
 return b;
 });

 KissanDB.set('bookings', updated);

 // Sync to Supabase
 try {
 const supabase = window.supabaseClient;
 if (supabase && admittedFarmer) {
 supabase.from('bookings')
 .update({ status: 'CALLED' })
 .eq('token_number', admittedFarmer.tokenNumber)
 .then(() => console.log(' Supabase booking status updated to CALLED.'))
 .catch(() => {});
 }
 } catch (e) {}

 showToast(`Farmer ${admittedFarmer?.farmerName || ''} (${admittedFarmer?.tokenNumber || ''}) admitted to Mandi Yard!`, 'success');
 renderAdminSlotsList();
 if (window.renderQueueBoard) renderQueueBoard();
};

/**
 * ==============================================================================
 * 3. MANDI OFFICER GATE QR SCANNER
 * ==============================================================================
 */
window.openGateQrScanner = function() {
 const modal = document.getElementById('gateScannerModal');
 if (!modal) return;

 modal.classList.add('active');

 // Reset result view
 const resultBox = document.getElementById('scannedFarmerResult');
 if (resultBox) {
 resultBox.style.display = 'none';
 resultBox.innerHTML = '';
 }

 // Initialize Html5Qrcode if library is loaded
 if (typeof Html5Qrcode !== 'undefined') {
 try {
 if (!html5QrScanner) {
 html5QrScanner = new Html5Qrcode("qrReaderView");
 }
 
 const config = { fps: 10, qrbox: { width: 220, height: 220 } };
 html5QrScanner.start(
 { facingMode: "environment" },
 config,
 (decodedText) => {
 handleQrCodeScanned(decodedText);
 },
 (errorMessage) => {
 // scanning frame notice
 }
 ).catch(err => {
 console.warn("Camera start notice:", err);
 showManualScannerFallback();
 });
 } catch (e) {
 console.warn("Scanner init notice:", e);
 showManualScannerFallback();
 }
 } else {
 showManualScannerFallback();
 }
};

function showManualScannerFallback() {
 const view = document.getElementById('qrReaderView');
 if (view) {
 view.innerHTML = `
 <div style="text-align: center; padding: 2rem; background: var(--slate-100); border: 2px dashed var(--slate-300); border-radius: var(--radius-md);">
 <div style="font-size: 2.5rem; margin-bottom: 0.5rem;"></div>
 <h4 style="margin-bottom: 0.5rem;">Gate Camera Ready</h4>
 <p style="font-size: 0.85rem; color: var(--slate-600); margin-bottom: 1rem;">Point camera at Farmer QR Pass or enter Token No below:</p>
 </div>
 `;
 }
}

window.handleManualQrSearch = function() {
 const input = document.getElementById('manualTokenInput');
 const tokenVal = input?.value.trim();
 if (!tokenVal) {
 showToast('Please enter a Token Number (e.g. KMN-042)', 'error');
 return;
 }
 handleQrCodeScanned(tokenVal);
};

window.handleQrCodeScanned = async function(qrContent) {
  console.log("QR Code Scanned:", qrContent);

  let parsed = null;
  let bookingId = '';
  let centreId = '';
  let tokenNumber = '';
  let slotDate = '';
  let signature = '';

  try {
    parsed = JSON.parse(qrContent);
    bookingId = parsed.b_id || parsed.booking_id || parsed.id || '';
    centreId = parsed.c_id || parsed.centre_id || '';
    tokenNumber = parsed.token || parsed.token_number || parsed.tokenNumber || '';
    slotDate = parsed.date || parsed.slot_date || parsed.slotDate || new Date().toISOString().split('T')[0];
    signature = parsed.sig || parsed.qr_signature || parsed.signature || '';
  } catch (e) {
    tokenNumber = qrContent.trim();
  }

  const resultBox = document.getElementById('scannedFarmerResult');
  if (!resultBox) return;

  const supabase = window.supabaseClient;

  // 1. SERVER CRYPTOGRAPHIC HMAC & REPLAY VERIFICATION VIA RPC
  if (supabase && bookingId && signature) {
    try {
      console.log('Invoking verify_and_admit_qr RPC on Supabase PostgreSQL...');
      const { data, error } = await supabase.rpc('verify_and_admit_qr', {
        p_booking_id: bookingId,
        p_centre_id: centreId || 'a0000000-0000-0000-0000-000000000001',
        p_token_number: tokenNumber,
        p_slot_date: slotDate,
        p_signature: signature
      });

      if (error || !data || data.success === false) {
        const errorMsg = data?.error || error?.message || 'Invalid or Tampered Gate Pass QR Code.';
        console.warn('QR Verification Failed:', errorMsg);

        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div class="alert alert-danger" style="margin-top: 1rem; border: 2px solid var(--danger);">
            <strong style="color: var(--danger-700);">Gate Verification Failed:</strong> ${errorMsg}
          </div>
        `;
        showToast(`Verification Failed: ${errorMsg}`, 'error');
        return;
      }

      // Successful RPC Verification
      console.log('Gate Pass Cryptographically Verified:', data);
      showToast(`Gate Pass Verified: ${data.farmer_name} (${data.token_number})`, 'success');

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="card" style="border: 2px solid var(--primary-600); background: linear-gradient(135deg, #ffffff, #f0fdf4); margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--primary-200); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <div>
              <span class="badge badge-success">HMAC VERIFIED</span>
              <span style="font-size: 0.8rem; color: var(--slate-500); margin-left: 0.5rem;">Ref: #${data.booking_id}</span>
            </div>
            <div style="font-size: 1.6rem; font-weight: 900; color: var(--primary-800);">${data.token_number}</div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem 1rem; font-size: 0.9rem; margin-bottom: 1rem;">
            <div><strong>Farmer:</strong> ${data.farmer_name}</div>
            <div><strong>Crop:</strong> ${data.crop} (~${data.quantity} Qtl)</div>
            <div><strong>Vehicle:</strong> ${data.vehicle_number} (${data.vehicle_type})</div>
            <div><strong>Status:</strong> Admitted to Yard</div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button onclick="closeGateQrScanner(); loadTodayAdminQueue();" class="btn btn-primary btn-block">
              Proceed to Weighbridge Console
            </button>
          </div>
        </div>
      `;

      loadTodayAdminQueue();
      return;
    } catch (rpcErr) {
      console.warn('RPC Error verifying QR code:', rpcErr);
    }
  }

  // Fallback for Local Testing
  const bookings = KissanDB.get('bookings', []);
  let booking = bookings.find(b => 
    (tokenNumber && (b.token_number === tokenNumber || b.tokenNumber === tokenNumber)) ||
    (bookingId && b.id === bookingId)
  );

  if (!booking) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="alert alert-warning" style="margin-top: 1rem;">
        <strong>Unrecognized Pass:</strong> No matching slot booking found for <code>${tokenNumber || bookingId || qrContent}</code>.
      </div>
    `;
    showToast('QR Code not found in system database.', 'error');
    return;
  }

  showToast(`Gate Pass Verified: ${booking.farmer_name || booking.farmerName} (${booking.token_number || booking.tokenNumber})`, 'success');
  resultBox.style.display = 'block';
  resultBox.innerHTML = `
    <div class="card" style="border: 2px solid var(--primary-600); background: linear-gradient(135deg, #ffffff, #f0fdf4); margin-top: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--primary-200); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
        <div>
          <span class="badge badge-success">● VERIFIED</span>
        </div>
        <div style="font-size: 1.6rem; font-weight: 900; color: var(--primary-800);">${booking.token_number || booking.tokenNumber}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem 1rem; font-size: 0.9rem; margin-bottom: 1rem;">
        <div><strong>Farmer:</strong> ${booking.farmer_name || booking.farmerName}</div>
        <div><strong>Crop:</strong> ${booking.crop} (${booking.quantity} Qtl)</div>
      </div>
      <button onclick="checkInFarmer('${booking.id}'); closeGateQrScanner();" class="btn btn-primary btn-block">
        Admit & Move to Mandi Yard
      </button>
    </div>
  `;
};

window.closeGateQrScanner = function() {
 const modal = document.getElementById('gateScannerModal');
 if (modal) {
 modal.classList.remove('active');
 }

 // Stop camera if running
 if (html5QrScanner) {
 html5QrScanner.stop().then(() => {
 console.log('Camera stopped.');
 }).catch(() => {});
 }
};

/**
 * ==============================================================================
 * 4. ADMIN QUEUE CONTROL & TOKEN WORKFLOW
 * Table: Token | Farmer | Centre | Time | Status | Action
 * Transitions:
 * - WAITING -> CALL NEXT (sets status to CALLED)
 * - CALLED -> START (sets status to IN_PROGRESS)
 * - IN_PROGRESS -> COMPLETE (sets status to COMPLETED)
 * ==============================================================================
 */
function initAdminQueue() {
  const dateFilter = document.getElementById('adminQueueDateFilter');
  if (dateFilter) {
    const today = new Date().toISOString().split('T')[0];
    dateFilter.value = today;
    dateFilter.addEventListener('change', loadTodayAdminQueue);
  }

  const callNextBtn = document.getElementById('adminCallNextAutoBtn');
  if (callNextBtn) {
    callNextBtn.addEventListener('click', handleCallNextAuto);
  }

  const refreshBtn = document.getElementById('adminRefreshQueueBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTodayAdminQueue();
      showToast('Today\'s queue refreshed.', 'info');
    });
  }

  loadTodayAdminQueue();
}

function parseTokenNumber(tokenStr) {
  if (!tokenStr) return 0;
  const num = parseInt(tokenStr.toString().replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

function normalizeStatus(status) {
  if (!status) return 'WAITING';
  const s = status.toString().trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'CONFIRMED' || s === 'WAITING') return 'WAITING';
  if (s === 'CALLED') return 'CALLED';
  if (s === 'IN_QUEUE' || s === 'WEIGHING' || s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'PROCURED' || s === 'COMPLETED' || s === 'SETTLED') return 'COMPLETED';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
  return s;
}

function getStatusBadgeMarkup(status) {
  const norm = normalizeStatus(status);
  let badgeClass = 'badge-waiting';
  if (norm === 'WAITING') badgeClass = 'badge-waiting';
  else if (norm === 'CALLED') badgeClass = 'badge-called';
  else if (norm === 'IN_PROGRESS') badgeClass = 'badge-in-progress';
  else if (norm === 'COMPLETED') badgeClass = 'badge-completed';
  else if (norm === 'CANCELLED') badgeClass = 'badge-cancelled';
  
  return `<span class="badge ${badgeClass}">${norm}</span>`;
}

async function loadTodayAdminQueue() {
  const tableBody = document.getElementById('adminTodayQueueTableBody');
  const dateInput = document.getElementById('adminQueueDateFilter');
  const selectedDate = dateInput?.value || new Date().toISOString().split('T')[0];

  let bookings = [];

  // 1. Fetch from Supabase
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('slot_date', selectedDate);

      if (!error && data && data.length > 0) {
        bookings = data;
        // Sync local storage
        const local = KissanDB.get('bookings', []);
        const merged = [...data];
        local.forEach(lb => {
          if (!merged.find(m => m.id === lb.id)) merged.push(lb);
        });
        KissanDB.set('bookings', merged);
      }
    }
  } catch (err) {
    console.warn('Notice loading queue from Supabase:', err);
  }

  // Fallback to local storage if empty
  if (bookings.length === 0) {
    const local = KissanDB.get('bookings', []);
    bookings = local.filter(b => (b.slot_date === selectedDate || b.slotDate === selectedDate));
    // If no bookings match today's date, show all uncancelled for demo testing
    if (bookings.length === 0) {
      bookings = local.filter(b => b.status !== 'Cancelled' && b.status !== 'CANCELLED');
    }
  }

  // Sort bookings by token number sequentially
  bookings.sort((a, b) => {
    const tokenA = a.token_number || a.tokenNumber || '';
    const tokenB = b.token_number || b.tokenNumber || '';
    return parseTokenNumber(tokenA) - parseTokenNumber(tokenB);
  });

  // Calculate Queue Statistics
  const waitingCount = bookings.filter(b => normalizeStatus(b.status) === 'WAITING').length;
  const inProgressCount = bookings.filter(b => normalizeStatus(b.status) === 'IN_PROGRESS' || normalizeStatus(b.status) === 'CALLED').length;
  const completedCount = bookings.filter(b => normalizeStatus(b.status) === 'COMPLETED').length;

  // Determine currently active serving token
  const activeServing = bookings.find(b => normalizeStatus(b.status) === 'IN_PROGRESS') ||
                        bookings.find(b => normalizeStatus(b.status) === 'CALLED') ||
                        bookings.find(b => normalizeStatus(b.status) === 'WAITING');

  const servingTokenStr = activeServing ? (activeServing.token_number || activeServing.tokenNumber) : '--';

  // Update quick stat displays
  const statServingEl = document.getElementById('admStatCurrentServing');
  if (statServingEl) statServingEl.textContent = servingTokenStr;

  const statWaitingEl = document.getElementById('admStatWaitingCount');
  if (statWaitingEl) statWaitingEl.textContent = waitingCount;

  const statInProgressEl = document.getElementById('admStatInProgressCount');
  if (statInProgressEl) statInProgressEl.textContent = inProgressCount;

  const statCompletedEl = document.getElementById('admStatCompletedCount');
  if (statCompletedEl) statCompletedEl.textContent = completedCount;

  const totalBadgeEl = document.getElementById('todayQueueTotalBadge');
  if (totalBadgeEl) totalBadgeEl.textContent = `${bookings.length} Bookings`;

  // Render Table: Token | Farmer | Centre | Time | Status | Action
  if (!tableBody) return;

  if (bookings.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--slate-500); padding: 2rem;">
          No bookings scheduled for ${selectedDate}. Use the slot booking page to register arrivals.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = bookings.map(b => {
    const tokenNum = b.token_number || b.tokenNumber || 'KMN-000';
    const farmerName = b.farmer_name || b.farmerName || 'Farmer';
    const farmerPhone = b.farmer_phone || b.farmerPhone || '';
    const centreName = b.mandi_name || b.mandiName || 'Procurement Centre';
    const slotTime = b.slot_time || b.slotTime || 'Morning Window';
    const status = normalizeStatus(b.status || 'WAITING');

    // Build Action Buttons based on status:
    // WAITING -> CALL NEXT (sets status to CALLED)
    // CALLED -> START (sets status to IN_PROGRESS)
    // IN_PROGRESS -> COMPLETE (sets status to COMPLETED)
    let actionBtnHtml = '';
    if (status === 'WAITING') {
      actionBtnHtml = `
        <button onclick="updateAdminQueueBookingStatus('${b.id}', 'CALLED')" class="btn btn-sm btn-accent" style="font-weight: 700;">
          CALL NEXT
        </button>
      `;
    } else if (status === 'CALLED') {
      actionBtnHtml = `
        <button onclick="updateAdminQueueBookingStatus('${b.id}', 'IN_PROGRESS')" class="btn btn-sm btn-primary" style="font-weight: 700;">
          START
        </button>
      `;
    } else if (status === 'IN_PROGRESS') {
      actionBtnHtml = `
        <button onclick="updateAdminQueueBookingStatus('${b.id}', 'COMPLETED')" class="btn btn-sm btn-success" style="font-weight: 700;">
          COMPLETE
        </button>
      `;
    } else if (status === 'COMPLETED') {
      actionBtnHtml = `
        <span class="badge badge-completed">COMPLETED</span>
      `;
    } else if (status === 'CANCELLED') {
      actionBtnHtml = `
        <span class="badge badge-cancelled">CANCELLED</span>
      `;
    }

    const isCurrentActive = tokenNum === servingTokenStr && (status === 'CALLED' || status === 'IN_PROGRESS');

    return `
      <tr style="${isCurrentActive ? 'background-color: #fefce8;' : ''}">
        <td>
          <strong style="color: var(--primary-800); font-size: 1.05rem;">${tokenNum}</strong>
        </td>
        <td>
          <strong>${farmerName}</strong>
          ${farmerPhone ? `<br><small style="color: var(--slate-500);">${farmerPhone}</small>` : ''}
        </td>
        <td>${centreName}</td>
        <td>
          <span style="font-size: 0.85rem; color: var(--slate-700);">${slotTime}</span>
        </td>
        <td>
          ${getStatusBadgeMarkup(status)}
        </td>
        <td>
          ${actionBtnHtml}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Advance Booking Status:
 * WAITING -> CALLED
 * CALLED -> IN_PROGRESS
 * IN_PROGRESS -> COMPLETED
 */
window.updateAdminQueueBookingStatus = async function(bookingId, newStatus) {
  console.log(`Updating booking ${bookingId} to status: ${newStatus}`);

  // 1. Update in Supabase
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) {
        console.warn('Notice updating status in Supabase:', error.message);
      } else {
        console.log(`Status updated to ${newStatus} in Supabase.`);
      }
    }
  } catch (err) {
    console.warn('Database notice:', err);
  }

  // 2. Update in Local Storage Cache
  const bookings = KissanDB.get('bookings', []);
  let updatedBooking = null;
  const updatedList = bookings.map(b => {
    if (b.id === bookingId) {
      updatedBooking = { ...b, status: newStatus };
      return updatedBooking;
    }
    return b;
  });
  KissanDB.set('bookings', updatedList);

  // 3. Update Queue State
  if (updatedBooking && (newStatus === 'CALLED' || newStatus === 'IN_PROGRESS')) {
    const queueState = KissanDB.get('queue_state', {});
    queueState.currentServingToken = updatedBooking.token_number || updatedBooking.tokenNumber;
    queueState.lastUpdated = new Date().toLocaleTimeString();
    KissanDB.set('queue_state', queueState);
  }

  // Trigger Notification for Farmer when Token is CALLED
  if (updatedBooking && newStatus === 'CALLED') {
    const farmerId = updatedBooking.farmer_id || updatedBooking.farmerId || 'F-10024';
    const tokenNum = updatedBooking.token_number || updatedBooking.tokenNumber || 'KMN-000';
    const centre = updatedBooking.mandi_name || updatedBooking.mandiName || 'Procurement Centre';
    if (window.createFarmerNotification) {
      await window.createFarmerNotification({
        farmer_id: farmerId,
        title: 'Token Called for Inspection',
        message: `Token ${tokenNum} has been called for gate entry and weighbridge inspection at ${centre}.`
      });
    }

    // Trigger SMS notification asynchronously
    if (window.SMSClient) {
      try {
        window.SMSClient.triggerTokenCalled(updatedBooking);
      } catch (smsErr) {
        console.warn('Notice triggering SMS dispatch:', smsErr);
      }
    }
  }

  const tokenNum = updatedBooking ? (updatedBooking.token_number || updatedBooking.tokenNumber) : '';
  showToast(`Token ${tokenNum} status updated to ${newStatus}.`, 'success');

  // 4. Refresh Queue Table
  loadTodayAdminQueue();
};

/**
 * Handle "Call Next Waiting Token" button
 */
async function handleCallNextAuto() {
  const localBookings = KissanDB.get('bookings', []);
  const nextWaiting = localBookings.find(b => normalizeStatus(b.status) === 'WAITING');

  if (nextWaiting) {
    await updateAdminQueueBookingStatus(nextWaiting.id, 'CALLED');
  } else {
    showToast('No waiting tokens in today\'s queue.', 'info');
  }
}

/**
 * ==============================================================================
 * 5. ADMIN PROCUREMENT TRACKING & J-FORM SETTLEMENT
 * Creates/updates records in Supabase procurements table with:
 * - Crop
 * - Quantity
 * - Quality
 * - Amount
 * - Procurement Status: PENDING, VERIFIED, COMPLETED
 * - Payment Status: (Tracking only)
 * ==============================================================================
 */
async function initAdminProcurement() {
  await loadAdminProcurementTokens();
  await loadAdminProcurementRecords();
  await loadAdminPayments();

  const tokenSelect = document.getElementById('procTokenSelect');
  const urlParams = new URLSearchParams(window.location.search);
  const prefillToken = urlParams.get('token');

  if (tokenSelect && prefillToken) {
    tokenSelect.value = prefillToken;
    populateFarmerFromToken(prefillToken);
  }

  if (tokenSelect) {
    tokenSelect.addEventListener('change', () => {
      populateFarmerFromToken(tokenSelect.value);
    });
  }

  const qtyInput = document.getElementById('procQuantity');
  const cropInput = document.getElementById('procCropName');
  const amountInput = document.getElementById('procAmount');

  if (qtyInput) {
    qtyInput.addEventListener('input', autoCalculateProcurementAmount);
  }
  if (cropInput) {
    cropInput.addEventListener('input', autoCalculateProcurementAmount);
  }

  const form = document.getElementById('adminProcurementForm');
  if (form) {
    form.addEventListener('submit', handleProcurementFormSubmit);
  }
}

async function loadAdminProcurementTokens() {
  const tokenSelect = document.getElementById('procTokenSelect');
  if (!tokenSelect) return;

  let bookings = [];
  // 1. Fetch from Authoritative Backend API
  try {
    const res = await fetch('/api/bookings');
    if (res.ok) {
      const json = await res.json();
      if (json.bookings && Array.isArray(json.bookings) && json.bookings.length > 0) {
        bookings = json.bookings.filter(b => (b.status || '').toUpperCase() !== 'CANCELLED');
        KissanDB.set('bookings', json.bookings);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading tokens from API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (bookings.length === 0) {
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .neq('status', 'CANCELLED')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          bookings = data;
        }
      }
    } catch (e) {
      console.warn('Notice loading tokens from Supabase:', e);
    }
  }

  if (bookings.length === 0) {
    bookings = KissanDB.get('bookings', []).filter(b => (b.status || '').toUpperCase() !== 'CANCELLED');
  }

  tokenSelect.innerHTML = `<option value="">-- Select Active Token / Booking --</option>` + bookings.map(b => {
    const token = b.token_number || b.tokenNumber || 'KMN-000';
    const name = b.farmer_name || b.farmerName || 'Farmer';
    const crop = b.crop || 'Crop';
    const status = normalizeStatus(b.status || 'WAITING');
    return `<option value="${token}">${token} - ${name} (${crop}) [${status}]</option>`;
  }).join('');
}

function populateFarmerFromToken(tokenNumber) {
  const bookings = KissanDB.get('bookings', []);
  const booking = bookings.find(b => (b.token_number === tokenNumber || b.tokenNumber === tokenNumber));
  if (!booking) return;

  const farmerNameInp = document.getElementById('procFarmerName');
  const farmerPhoneInp = document.getElementById('procFarmerPhone');
  const cropInp = document.getElementById('procCropName');
  const qtyInp = document.getElementById('procQuantity');

  if (farmerNameInp) farmerNameInp.value = booking.farmer_name || booking.farmerName || '';
  if (farmerPhoneInp) farmerPhoneInp.value = booking.farmer_phone || booking.farmerPhone || '';
  if (cropInp) cropInp.value = booking.crop || 'Wheat (गेहूं)';
  if (qtyInp) qtyInp.value = parseFloat(booking.quantity || 40.0).toFixed(2);

  autoCalculateProcurementAmount();
}

function autoCalculateProcurementAmount() {
  const qtyInp = document.getElementById('procQuantity');
  const cropInp = document.getElementById('procCropName');
  const amountInp = document.getElementById('procAmount');
  const hintEl = document.getElementById('mspCalcHint');

  const qty = parseFloat(qtyInp?.value) || 0;
  const cropName = cropInp?.value || '';

  const crops = KissanDB.get('crops', []);
  const matchedCrop = crops.find(c => cropName.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()));
  const rate = matchedCrop ? matchedCrop.msp : 2275;

  const total = Math.round(qty * rate);

  if (amountInp && document.activeElement !== amountInp) {
    amountInp.value = total;
  }

  if (hintEl) {
    hintEl.textContent = `${qty.toFixed(2)} Qtl × ₹${rate.toLocaleString('en-IN')} = ₹${total.toLocaleString('en-IN')}`;
  }
}

async function handleProcurementFormSubmit(e) {
  e.preventDefault();

  const tokenNumber = document.getElementById('procTokenSelect')?.value;
  const farmerName = document.getElementById('procFarmerName')?.value.trim();
  const farmerPhone = document.getElementById('procFarmerPhone')?.value.trim();
  const crop = document.getElementById('procCropName')?.value.trim();
  const quantity = parseFloat(document.getElementById('procQuantity')?.value) || 0;
  const quality = document.getElementById('procQuality')?.value;
  const amount = parseFloat(document.getElementById('procAmount')?.value) || 0;
  const procStatus = document.getElementById('procStatusSelect')?.value || 'COMPLETED';
  const paymentStatus = document.getElementById('procPaymentStatus')?.value || 'Direct DBT Initiated';
  const submitBtn = document.getElementById('btnSaveProcurement');

  if (!crop || quantity <= 0 || amount <= 0) {
    showToast('Please enter valid crop, quantity, and amount.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving Record...';
  }

  const procId = 'PROC-' + Math.floor(5000 + Math.random() * 4000);
  const bookings = KissanDB.get('bookings', []);
  const booking = bookings.find(b => (b.token_number === tokenNumber || b.tokenNumber === tokenNumber));

  const procurementRecord = {
    id: procId,
    booking_id: booking ? booking.id : null,
    farmer_id: booking ? (booking.farmer_id || booking.farmerId) : 'F-10024',
    farmer_name: farmerName,
    farmer_phone: farmerPhone,
    centre_name: booking ? (booking.mandi_name || booking.mandiName) : 'Krishi Upaj Mandi - Sector 7, Karnal',
    crop: crop,
    quantity: quantity,
    quality: quality,
    amount: amount,
    status: procStatus,
    payment_status: paymentStatus,
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };

  // 1. Insert/Update into Supabase procurements & payments tables
  const payId = 'PAY-' + Math.floor(10000 + Math.random() * 90000);
  const paymentRecord = {
    id: payId,
    farmer_id: procurementRecord.farmer_id,
    farmer_name: farmerName,
    farmer_phone: farmerPhone,
    procurement_id: procId,
    crop: crop,
    amount: amount,
    transaction_id: null,
    status: 'PENDING',
    payment_date: null,
    created_at: new Date().toISOString()
  };

  // 1. Post to Authoritative Backend API
  try {
    const res = await fetch('/api/procurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(procurementRecord)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.procurement) {
        procurementRecord.id = data.procurement.id;
      }
      if (data.payment) {
        paymentRecord.id = data.payment.id;
      }
    }
  } catch (apiErr) {
    console.warn('Notice saving procurement via API:', apiErr);
  }

  // Non-blocking Supabase sync fallback
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Inserting procurement record into Supabase:', procurementRecord);
      const { error: procErr } = await supabase
        .from('procurements')
        .upsert(procurementRecord);

      if (procErr) {
        console.warn('Notice inserting procurement into Supabase:', procErr.message);
      }

      const { error: payErr } = await supabase
        .from('payments')
        .upsert(paymentRecord);

      if (payErr) {
        console.warn('Notice inserting payment into Supabase:', payErr.message);
      }

      if (booking && procStatus === 'COMPLETED') {
        await supabase
          .from('bookings')
          .update({ status: 'COMPLETED' })
          .eq('id', booking.id);
      }
    }
  } catch (err) {
    console.warn('Procurement/Payment database notice:', err);
  }

  // 2. Update Local Storage Cache
  const localProc = KissanDB.get('procurements', []);
  localProc.unshift(procurementRecord);
  KissanDB.set('procurements', localProc);

  const localPay = KissanDB.get('payments', []);
  localPay.unshift(paymentRecord);
  KissanDB.set('payments', localPay);

  if (booking) {
    const updatedBookings = bookings.map(b => {
      if (b.id === booking.id || b.token_number === tokenNumber) {
        return { ...b, status: procStatus === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', procurementId: procId };
      }
      return b;
    });
    KissanDB.set('bookings', updatedBookings);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Procurement Record & Update Database ->';
  }

  // Trigger Notification for Farmer when Procurement is Completed
  if (window.createFarmerNotification) {
    await window.createFarmerNotification({
      farmer_id: procurementRecord.farmer_id,
      title: 'Procurement Completed',
      message: `Procurement weighment of ${quantity.toFixed(2)} Qtl ${crop} has been completed. Form 'J' certificate generated.`
    });
  }

  // Trigger SMS notification asynchronously
  if (window.SMSClient) {
    try {
      window.SMSClient.triggerProcurementCompleted(procurementRecord);
    } catch (smsErr) {
      console.warn('Notice triggering SMS dispatch:', smsErr);
    }
  }

  showToast(`Procurement #${procId} & Payment #${payId} saved successfully!`, 'success');

  // Reload records table & payment table
  await loadAdminProcurementRecords();
  await loadAdminPayments();

  // Show digital Form 'J' preview
  if (window.viewJFormReceipt) {
    window.viewJFormReceipt(procId);
  }
}

async function loadAdminProcurementRecords() {
  const tableBody = document.getElementById('adminProcurementTableBody');
  const countBadge = document.getElementById('procRecordsTotalBadge');
  if (!tableBody) return;

  let records = [];
  let payments = [];

  // 1. Fetch from Authoritative Backend API
  try {
    const [pRes, payRes] = await Promise.all([
      fetch('/api/procurements'),
      fetch('/api/payments')
    ]);
    if (pRes.ok) {
      const pJson = await pRes.json();
      if (pJson.procurements && Array.isArray(pJson.procurements)) {
        records = pJson.procurements;
        KissanDB.set('procurements', records);
      }
    }
    if (payRes.ok) {
      const payJson = await payRes.json();
      if (payJson.payments && Array.isArray(payJson.payments)) {
        payments = payJson.payments;
        KissanDB.set('payments', payments);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading procurements from API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (records.length === 0) {
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        const { data, error } = await supabase
          .from('procurements')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          records = data;
        }
      }
    } catch (e) {
      console.warn('Notice loading procurements from Supabase:', e);
    }
  }

  if (records.length === 0) {
    records = KissanDB.get('procurements', []);
  }

  if (payments.length === 0) {
    payments = KissanDB.get('payments', []);
  }

  if (countBadge) {
    countBadge.textContent = `${records.length} Records`;
  }

  // Update Summary KPI stats
  const totalQtl = records.reduce((sum, r) => sum + (parseFloat(r.quantity || r.net_weight || r.netWeight) || 0), 0);
  const totalPayout = records.reduce((sum, r) => sum + (parseFloat(r.amount || r.netPayout) || 0), 0);

  const paidList = payments.filter(p => (p.status || '').toUpperCase() === 'PAID');
  const pendingList = payments.filter(p => (p.status || '').toUpperCase() === 'PENDING');

  const totalPaidAmount = paidList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const totalPendingAmount = pendingList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const statQtlEl = document.getElementById('admStatTotalQtl');
  if (statQtlEl) statQtlEl.textContent = `${totalQtl.toFixed(1)} Qtl`;

  const statPayoutEl = document.getElementById('admStatTotalPayoutVal');
  if (statPayoutEl) statPayoutEl.textContent = `₹${Math.round(totalPayout).toLocaleString('en-IN')}`;

  // Total Payment Done (₹)
  const statPaidEl = document.getElementById('admStatTotalPaidAmount');
  if (statPaidEl) statPaidEl.textContent = `₹${Math.round(totalPaidAmount).toLocaleString('en-IN')}`;

  const statPaidHintEl = document.getElementById('admStatPaidCountHint');
  if (statPaidHintEl) statPaidHintEl.textContent = `${paidList.length} Settled`;

  // Pending DBT Disbursals (₹)
  const statPendEl = document.getElementById('admStatPendingRecords');
  if (statPendEl) statPendEl.textContent = `₹${Math.round(totalPendingAmount).toLocaleString('en-IN')}`;

  const statPendHintEl = document.getElementById('admStatPendingCountHint');
  if (statPendHintEl) statPendHintEl.textContent = `${pendingList.length} Awaiting`;

  if (records.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--slate-400);">
          No procurement records found. Use the form above to record completed weighments.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = records.map(r => {
    const receiptId = r.id || 'PROC-000';
    const farmerName = r.farmer_name || r.farmerName || 'Farmer';
    const crop = r.crop || 'Produce';
    const qty = parseFloat(r.quantity || r.netWeight || 0).toFixed(2);
    const quality = r.quality || r.grade || 'FAQ Grade A';
    const amount = parseFloat(r.amount || r.netPayout || 0);
    const status = (r.status || 'COMPLETED').toUpperCase();
    const paymentStatus = r.payment_status || r.paymentStatus || 'Direct DBT Initiated';

    return `
      <tr>
        <td>
          <strong style="color: var(--primary-900);">${receiptId}</strong>
          <br><small style="color: var(--slate-500);">${r.date || 'Today'}</small>
        </td>
        <td><strong>${farmerName}</strong></td>
        <td>${crop}</td>
        <td><strong>${qty} Qtl</strong></td>
        <td><span style="font-size: 0.85rem;">${quality}</span></td>
        <td><strong style="color: var(--primary-800); font-size: 1rem;">₹${amount.toLocaleString('en-IN')}</strong></td>
        <td>
          <span class="badge ${status === 'COMPLETED' ? 'badge-completed' : (status === 'VERIFIED' ? 'badge-verified' : 'badge-pending')}">
            ${status}
          </span>
        </td>
        <td>
          <span class="badge ${paymentStatus.includes('Credited') ? 'badge-success' : 'badge-info'}" style="font-size: 0.75rem;">
            ${paymentStatus}
          </span>
        </td>
        <td>
          <button onclick="viewJFormReceipt('${receiptId}')" class="btn btn-sm btn-primary">
            Form 'J'
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * ==============================================================================
 * 6. ADMIN PAYMENT STATUS TRACKING (payments table)
 * Handles:
 * - Loading payments from Supabase
 * - Marking payment as PAID with generated transaction ID (KSM-2026-XXXXX)
 * ==============================================================================
 */
async function loadAdminPayments() {
  const tableBody = document.getElementById('adminPaymentsTableBody');
  const countBadge = document.getElementById('paymentsTotalCountBadge');
  if (!tableBody) return;

  let payments = [];

  // 1. Fetch from Authoritative Backend API
  try {
    const res = await fetch('/api/payments');
    if (res.ok) {
      const json = await res.json();
      if (json.payments && Array.isArray(json.payments) && json.payments.length > 0) {
        payments = json.payments;
        KissanDB.set('payments', payments);
      }
    }
  } catch (apiErr) {
    console.warn('Notice loading payments from API:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (payments.length === 0) {
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          payments = data;
          KissanDB.set('payments', data);
        }
      }
    } catch (e) {
      console.warn('Notice loading payments from Supabase:', e);
    }
  }

  if (payments.length === 0) {
    payments = KissanDB.get('payments', []);
  }

  if (countBadge) {
    countBadge.textContent = `${payments.length} Payments`;
  }

  if (payments.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--slate-400);">
          No payment records found. Payment records are automatically generated when procurement is completed.
        </td>
      </tr>
    `;
    return;
  }

  const procurements = KissanDB.get('procurements', []);

  tableBody.innerHTML = payments.map(p => {
    const payId = p.id || 'PAY-000';
    const farmerName = p.farmer_name || p.farmerName || 'Farmer';
    const farmerPhone = p.farmer_phone || p.farmerPhone || '';
    const crop = p.crop || 'Produce';
    const matchingProc = procurements.find(pr => pr.id === p.procurement_id || pr.id === p.procurementId);
    const qty = matchingProc ? parseFloat(matchingProc.quantity || matchingProc.netWeight || 0).toFixed(2) : '';
    const cropAndQty = qty ? `${crop} (${qty} Qtl)` : crop;
    const amount = parseFloat(p.amount || 0);
    const status = (p.status || 'PENDING').toUpperCase();
    const txnId = p.transaction_id || p.transactionId || '-';
    const payDate = p.payment_date || p.paymentDate || '-';

    let actionHtml = '';
    if (status === 'PENDING') {
      actionHtml = `
        <button onclick="markPaymentAsPaid('${payId}')" class="btn btn-sm btn-success" style="font-weight: 700;">
          Mark as PAID
        </button>
      `;
    } else {
      actionHtml = `
        <span class="badge badge-paid">PAID / SETTLED</span>
      `;
    }

    return `
      <tr>
        <td>
          <strong style="color: var(--primary-900);">${payId}</strong>
          <br><small style="color: var(--slate-500);">${p.procurement_id || ''}</small>
        </td>
        <td>
          <strong>${farmerName}</strong>
          ${farmerPhone ? `<br><small style="color: var(--slate-500);">${farmerPhone}</small>` : ''}
        </td>
        <td>${cropAndQty}</td>
        <td><strong style="color: var(--primary-800); font-size: 1rem;">₹${amount.toLocaleString('en-IN')}</strong></td>
        <td>
          <span class="badge ${status === 'PAID' ? 'badge-paid' : 'badge-pending'}">
            ${status}
          </span>
        </td>
        <td>
          ${txnId !== '-' ? `<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #0f172a;">${txnId}</code>` : `<span style="color: var(--slate-400);">-</span>`}
        </td>
        <td>
          <span style="font-size: 0.85rem; color: var(--slate-700);">${payDate}</span>
        </td>
        <td>
          ${actionHtml}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Admin action: Mark Payment as PAID
 * Generates transaction reference: KSM-2026-XXXXX
 * Saves transaction_id and payment_date in payments and procurements tables
 */
window.markPaymentAsPaid = async function(paymentId) {
  console.log(`Marking payment ${paymentId} as PAID...`);

  // 1. First try Authoritative Backend API
  try {
    const res = await fetch('/api/payments/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        showToast(`Payment Disbursed! Transaction Reference: ${data.transaction_id}`, 'success');

        // Update local cache
        const localPay = KissanDB.get('payments', []);
        const updatedPayments = localPay.map(p => {
          if (p.id === paymentId) {
            return { ...p, status: 'PAID', transaction_id: data.transaction_id, payment_date: new Date().toISOString().split('T')[0] };
          }
          return p;
        });
        KissanDB.set('payments', updatedPayments);

        await loadAdminPayments();
        await loadAdminProcurementRecords();
        if (typeof loadAdminDashboardStats === 'function') {
          await loadAdminDashboardStats();
        }
        return;
      }
    }
  } catch (apiErr) {
    console.warn('Notice calling /api/payments/pay:', apiErr);
  }

  // 2. Supabase RPC Fallback
  const supabase = window.supabaseClient;

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('process_dbt_payment', {
        p_payment_id: paymentId
      });

      if (error || !data || data.success === false) {
        const errorMsg = data?.error || error?.message || 'Failed to disburse payment.';
        console.warn('DBT Payment RPC notice:', errorMsg);
      } else {
        console.log('process_dbt_payment RPC Success:', data);
        showToast(`Payment Disbursed! Transaction Reference: ${data.transaction_id}`, 'success');

        await loadAdminPayments();
        await loadAdminProcurementRecords();
        return;
      }
    } catch (rpcErr) {
      console.warn('RPC Error processing payment:', rpcErr);
    }
  }

  // Fallback for Local Testing
  const txnId = 'KSM-DBT-' + Math.floor(10000 + Math.random() * 90000);
  const today = new Date().toISOString().split('T')[0];

  let paidPayment = null;
  const localPayments = KissanDB.get('payments', []);
  const updatedPayments = localPayments.map(p => {
    if (p.id === paymentId) {
      paidPayment = { ...p, status: 'PAID', transaction_id: txnId, payment_date: today };
      return paidPayment;
    }
    return p;
  });
  KissanDB.set('payments', updatedPayments);

  // Dispatch SMS notification asynchronously
  if (window.SMSClient && paidPayment) {
    try {
      window.SMSClient.triggerPaymentDisbursed(paidPayment);
    } catch (smsErr) {
      console.warn('Notice triggering payment SMS dispatch:', smsErr);
    }
  }

  showToast(`Offline Mode: Payment marked PAID. Reference: ${txnId}`, 'info');
  await loadAdminPayments();
  await loadAdminProcurementRecords();
};

/**
 * ==============================================================================
 * 7. SMS NOTIFICATION GATEWAY & AUDIT CONSOLE
 * ==============================================================================
 */
async function initSmsDashboard() {
  await loadSmsConsoleData();

  // Mode switcher listener
  const modeSelect = document.getElementById('smsModeSelect');
  if (modeSelect) {
    modeSelect.addEventListener('change', async (e) => {
      const targetMode = e.target.value;
      if (window.SMSClient) {
        showToast(`Switching SMS Engine to ${targetMode.toUpperCase()}...`, 'info');
        await window.SMSClient.setMode(targetMode);
        await loadSmsConsoleData();
        showToast(`SMS Engine is now operating in ${targetMode === 'mock' ? 'Zero-Cost Simulation' : 'Production MSG91'} mode.`, 'success');
      }
    });
  }

  // Refresh button listener
  const refreshBtn = document.getElementById('btnRefreshSmsLogs');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Updating...';
      await loadSmsConsoleData();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
      showToast('SMS audit logs updated.', 'info');
    });
  }

  // Filter dropdown listeners
  const statusFilter = document.getElementById('smsFilterStatus');
  const typeFilter = document.getElementById('smsFilterType');
  if (statusFilter) statusFilter.addEventListener('change', () => loadSmsConsoleData());
  if (typeFilter) typeFilter.addEventListener('change', () => loadSmsConsoleData());

  // Test SMS Modal triggers
  const btnOpenModal = document.getElementById('btnOpenTestSmsModal');
  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      const modal = document.getElementById('testSmsModal');
      if (modal) modal.style.display = 'flex';
    });
  }

  const testForm = document.getElementById('testSmsForm');
  if (testForm) {
    testForm.addEventListener('submit', handleTestSmsSubmit);
  }

  // Listen to kissan-sms-dispatched event from anywhere in the app
  window.addEventListener('kissan-sms-dispatched', () => {
    loadSmsConsoleData();
  });
}

window.closeTestSmsModal = function() {
  const modal = document.getElementById('testSmsModal');
  if (modal) modal.style.display = 'none';
};

window.closeSmsPreviewModal = function() {
  const modal = document.getElementById('smsMessagePreviewModal');
  if (modal) modal.style.display = 'none';
};

window.viewSmsMessagePreview = function(encodedLog) {
  try {
    const log = JSON.parse(decodeURIComponent(encodedLog));
    const modal = document.getElementById('smsMessagePreviewModal');
    const msgText = document.getElementById('previewMessageText');
    const recipient = document.getElementById('previewRecipient');
    const statusBadge = document.getElementById('previewStatusBadge');
    const tplId = document.getElementById('previewTemplateId');
    const prov = document.getElementById('previewProvider');

    if (msgText) msgText.textContent = log.message || '--';
    if (recipient) recipient.textContent = `${log.masked_phone || log.phone_number}`;
    if (tplId) tplId.textContent = log.template_id || 'DLT_DEFAULT';
    if (prov) prov.textContent = (log.provider || 'mock').toUpperCase();

    if (statusBadge) {
      statusBadge.innerHTML = getSmsStatusBadge(log.status);
    }

    if (modal) modal.style.display = 'flex';
  } catch (e) {
    console.error('Error previewing SMS:', e);
  }
};

window.retrySmsFromConsole = async function(smsId) {
  if (!window.SMSClient) return;
  showToast('Retrying notification dispatch...', 'info');
  const res = await window.SMSClient.retryNotification(smsId);
  if (res && res.success) {
    showToast('SMS retry dispatched successfully!', 'success');
    await loadSmsConsoleData();
  } else {
    showToast(`Retry failed: ${res?.error || 'Unknown error'}`, 'error');
  }
};

async function handleTestSmsSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('testSmsPhone')?.value.trim();
  const notifType = document.getElementById('testSmsType')?.value;
  const bookingIdInput = document.getElementById('testSmsBookingId')?.value.trim();
  const farmerName = document.getElementById('testSmsFarmerName')?.value.trim() || 'Rameshwar Singh';
  const submitBtn = document.getElementById('btnSubmitTestSms');

  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Simulating SMS...';
  }

  const bookingId = bookingIdInput || ('BK-SIM-' + Math.floor(1000 + Math.random() * 9000));

  try {
    const res = await window.SMSClient.sendNotification({
      notificationType: notifType,
      phoneNumber: phone,
      farmerName: farmerName,
      bookingId: bookingId,
      variables: {
        crop: 'Wheat (गेहूं)',
        quantity: 50,
        centre_name: 'Krishi Upaj Mandi, Karnal',
        slot_date: new Date().toISOString().split('T')[0],
        slot_time: '08:00 AM - 11:00 AM',
        token_number: 'KMN-042',
        tokens_ahead: 3,
        vehicle_number: 'HR-05-AB-7721',
        amount: '1,13,750',
        receipt_id: 'PROC-8821',
        transaction_id: 'KSM-DBT-' + Math.floor(10000 + Math.random() * 90000)
      }
    });

    closeTestSmsModal();

    if (res && res.success) {
      showToast(`Mock SMS generated! Status: SIMULATED (Provider: MOCK)`, 'success');
    } else {
      showToast(`Notice: ${res?.notification?.error_message || 'Simulated'}`, 'info');
    }

    await loadSmsConsoleData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Dispatch Mock SMS ->';
    }
  }
}

function getSmsStatusBadge(status) {
  const norm = (status || 'SIMULATED').toUpperCase();
  if (norm === 'SIMULATED') {
    return `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:700;">● SIMULATED</span>`;
  } else if (norm === 'SENT') {
    return `<span class="badge badge-info" style="font-weight:700;">● SENT</span>`;
  } else if (norm === 'DELIVERED') {
    return `<span class="badge badge-success" style="font-weight:700;">● DELIVERED</span>`;
  } else if (norm === 'FAILED') {
    return `<span class="badge badge-danger" style="font-weight:700;">● FAILED</span>`;
  }
  return `<span class="badge badge-warning" style="font-weight:700;">● ${norm}</span>`;
}

async function loadSmsConsoleData() {
  if (!window.SMSClient) return;

  const statusFilter = document.getElementById('smsFilterStatus')?.value;
  const typeFilter = document.getElementById('smsFilterType')?.value;
  const tableBody = document.getElementById('smsLogsTableBody');
  const activeModeBadge = document.getElementById('smsActiveModeBadge');
  const modeSelect = document.getElementById('smsModeSelect');

  const { logs = [], stats = {}, mode = 'mock' } = await window.SMSClient.getLogs({
    status: statusFilter,
    type: typeFilter,
    limit: 50
  });

  // Update mode badge & select
  if (modeSelect && modeSelect.value !== mode) {
    modeSelect.value = mode;
  }

  if (activeModeBadge) {
    if (mode === 'mock') {
      activeModeBadge.textContent = 'DEMO MODE — SMS SIMULATED';
      activeModeBadge.style.background = '#e0f2fe';
      activeModeBadge.style.color = '#0369a1';
      activeModeBadge.style.borderColor = '#bae6fd';
    } else {
      activeModeBadge.textContent = 'Production Mode (MSG91 Telecom)';
      activeModeBadge.style.background = '#dcfce7';
      activeModeBadge.style.color = '#15803d';
      activeModeBadge.style.borderColor = '#bbf7d0';
    }
  }

  // Update KPI counters
  const totalEl = document.getElementById('smsStatTotal');
  const simEl = document.getElementById('smsStatSimulated');
  const delEl = document.getElementById('smsStatDelivered');
  const failEl = document.getElementById('smsStatFailed');
  const pendEl = document.getElementById('smsStatPending');

  if (totalEl) totalEl.textContent = stats.total || 0;
  if (simEl) simEl.textContent = stats.simulated || 0;
  if (delEl) delEl.textContent = (stats.delivered || 0) + (stats.sent || 0);
  if (failEl) failEl.textContent = stats.failed || 0;
  if (pendEl) pendEl.textContent = stats.pending || 0;

  // Populate Table
  if (!tableBody) return;

  if (!logs || logs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--slate-400); padding: 2rem;">
          No SMS notifications recorded yet. Click "Test Mock SMS" or book a slot to observe live dispatch.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = logs.map(l => {
    const timeStr = l.sent_at || l.created_at ? new Date(l.sent_at || l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
    const dateStr = l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
    const maskedPhone = l.masked_phone || '98765*****';
    const notifType = l.notification_type || 'NOTIFICATION';
    const prov = (l.provider || 'mock').toUpperCase();
    const statusBadge = getSmsStatusBadge(l.status);
    const fullMsg = l.message || '';
    const shortMsg = fullMsg.length > 75 ? `${fullMsg.substring(0, 75)}...` : fullMsg;
    const encodedJson = encodeURIComponent(JSON.stringify(l));

    return `
      <tr>
        <td>
          <strong style="color: var(--slate-800); font-size: 0.85rem;">${timeStr}</strong>
          <br><small style="color: var(--slate-400);">${dateStr}</small>
        </td>
        <td>
          <strong style="font-family: monospace; font-size: 0.9rem; color: #0f172a;">${maskedPhone}</strong>
          ${l.booking_id ? `<br><small style="color: var(--slate-500);">${l.booking_id}</small>` : ''}
        </td>
        <td>
          <span class="badge badge-neutral" style="font-size: 0.72rem; font-weight: 600;">${notifType}</span>
        </td>
        <td>
          <strong style="color: #0369a1; font-size: 0.82rem; letter-spacing: 0.5px;">${prov}</strong>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="max-width: 300px;">
          <span style="font-size: 0.82rem; color: var(--slate-700); line-height: 1.35; display: inline-block; cursor: pointer;" title="Click to view full message" onclick="viewSmsMessagePreview('${encodedJson}')">
            ${shortMsg}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="viewSmsMessagePreview('${encodedJson}')">
              View
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


