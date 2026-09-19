/**
 * ==========================================================================
 * KISSAN – Procure Smart Mandi
 * Farmer Dashboard Operations (js/farmer.js)
 * Supabase Realtime integration for live bookings and queue status updates
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('farmer-dashboard.html')) {
    await initFarmerDashboard();
    setupFarmerDashboardRealtime();
  }
});

/**
 * Initialize Farmer Dashboard UI & Metrics
 */
async function initFarmerDashboard() {
  const farmer = KissanDB.get('current_farmer', {
    name: 'Rameshwar Singh',
    id: 'F-10024',
    district: 'Karnal',
    village: 'Taraori',
    landholding: '6.5 Acres',
    mobile: '9876543210'
  });

  // 1. Update Farmer Profile Info
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingEl = document.getElementById('farmerGreeting');
  if (greetingEl) {
    const emoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';
    greetingEl.textContent = `${emoji} ${timeOfDay}, ${farmer.name.split(' ')[0]}!`;
  }

  const farmerMetaEl = document.getElementById('farmerMeta');
  if (farmerMetaEl) {
    farmerMetaEl.textContent = `ID: ${farmer.id || 'F-10024'} · ${farmer.village || 'Karnal'} · ${farmer.landholding || '5 Acres'}`;
  }

  // Update avatar letter
  const avatarEl = document.getElementById('farmerAvatarLetter');
  if (avatarEl) avatarEl.textContent = (farmer.name || 'F').charAt(0).toUpperCase();

  // Render in-app notifications feed
  if (window.renderFarmerDashboardNotifications) {
    await window.renderFarmerDashboardNotifications();
  }

  // 2. Fetch Farmer Bookings from Authoritative Backend API
  let farmerBookings = [];
  try {
    const qPhone = encodeURIComponent(farmer.mobile || '9876543210');
    const qId = encodeURIComponent(farmer.id || 'F-10024');
    const res = await fetch(`/api/bookings?farmer_phone=${qPhone}&farmer_id=${qId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.bookings && Array.isArray(data.bookings) && data.bookings.length > 0) {
        farmerBookings = data.bookings.map(b => ({
          ...b,
          tokenNumber: b.token_number || b.tokenNumber,
          farmerName: b.farmer_name || b.farmerName,
          farmerPhone: b.farmer_phone || b.farmerPhone,
          mandiName: b.mandi_name || b.mandiName,
          centreId: b.centre_id || b.centreId,
          slotDate: b.slot_date || b.slotDate,
          slotTime: b.slot_time || b.slotTime,
          vehicleNumber: b.vehicle_number || b.vehicleNumber,
          vehicleType: b.vehicle_type || b.vehicleType
        }));
      }
    }
  } catch (apiErr) {
    console.warn('Dashboard /api/bookings notice:', apiErr);
  }

  // Fallback to Supabase
  if (farmerBookings.length === 0) {
    try {
      const supabase = window.supabaseClient;
      if (supabase && farmer && farmer.id) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('farmer_id', farmer.id)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          farmerBookings = data.map(b => ({
            ...b,
            tokenNumber: b.token_number || b.tokenNumber,
            farmerName: b.farmer_name || b.farmerName,
            farmerPhone: b.farmer_phone || b.farmerPhone,
            mandiName: b.mandi_name || b.mandiName,
            centreId: b.centre_id || b.centreId,
            slotDate: b.slot_date || b.slotDate,
            slotTime: b.slot_time || b.slotTime,
            vehicleNumber: b.vehicle_number || b.vehicleNumber,
            vehicleType: b.vehicle_type || b.vehicleType
          }));
        }
      }
    } catch (err) {
      console.warn('Dashboard Supabase lookup notice:', err);
    }
  }

  // Fallback to local storage if both returned nothing
  if (farmerBookings.length === 0) {
    const allBookings = KissanDB.get('bookings', []);
    farmerBookings = allBookings.filter(b => 
      (b.farmerId === farmer.id || b.farmer_id === farmer.id) ||
      (b.farmerPhone === farmer.mobile || b.farmer_phone === farmer.mobile) ||
      (!b.farmerId && !b.farmer_id)
    );
  }

  // Sync to local cache
  if (farmerBookings.length > 0) {
    const local = KissanDB.get('bookings', []);
    const merged = [...farmerBookings];
    local.forEach(lb => {
      if (!merged.find(m => m.id === lb.id)) merged.push(lb);
    });
    KissanDB.set('bookings', merged);
  }

  const activeBookings = farmerBookings.filter(b => {
    const s = (b.status || '').toUpperCase().replace(/\s+/g, '_');
    return s === 'WAITING' || s === 'CALLED' || s === 'IN_PROGRESS' || s === 'CONFIRMED' || s === 'IN_QUEUE' || s === 'WEIGHING';
  });

  const completedBookings = farmerBookings.filter(b => {
    const s = (b.status || '').toUpperCase().replace(/\s+/g, '_');
    return s === 'COMPLETED' || s === 'PROCURED' || s === 'SETTLED';
  });

  // 3. Fetch Farmer's Procurements & Payouts from Authoritative Backend API
  let farmerProcurements = [];
  try {
    const qPhone = encodeURIComponent(farmer.mobile || '');
    const qId = encodeURIComponent(farmer.id || '');
    const pRes = await fetch(`/api/procurements?farmer_phone=${qPhone}&farmer_id=${qId}`);
    if (pRes.ok) {
      const pJson = await pRes.json();
      if (pJson.procurements && Array.isArray(pJson.procurements)) {
        farmerProcurements = pJson.procurements;
      }
    }
  } catch (pErr) {
    console.warn('Notice loading farmer procurements from API:', pErr);
  }

  // Fallback to local storage STRICTLY SCOPED to this farmer
  if (farmerProcurements.length === 0) {
    const procurements = KissanDB.get('procurements', []);
    farmerProcurements = procurements.filter(p => 
      (farmer.id && (p.farmer_id === farmer.id || p.farmerId === farmer.id)) ||
      (farmer.mobile && (p.farmer_phone === farmer.mobile || p.farmerPhone === farmer.mobile))
    );
  }
  
  const totalPayout = farmerProcurements.reduce((sum, p) => sum + (parseFloat(p.amount || p.netPayout) || 0), 0);

  // Update Metric Elements (Strictly scoped to logged-in farmer)
  const statActiveBookings = document.getElementById('statActiveBookings');
  if (statActiveBookings) statActiveBookings.textContent = activeBookings.length;

  const statCompletedProcurements = document.getElementById('statCompletedProcurements');
  if (statCompletedProcurements) statCompletedProcurements.textContent = completedBookings.length || farmerProcurements.length;

  const statTotalPayout = document.getElementById('statTotalPayout');
  if (statTotalPayout) {
    statTotalPayout.textContent = `₹${Math.round(totalPayout).toLocaleString('en-IN')}`;
  }

  // 3. Render Active Token / Today's Pass Banner
  const activeTokenContainer = document.getElementById('activeTokenBanner');
  if (activeTokenContainer) {
    if (activeBookings.length > 0) {
      const currentActive = activeBookings[0];
      const activeStatus = (currentActive.status || 'WAITING').toUpperCase();
      const tokenNum = currentActive.tokenNumber || currentActive.token_number || 'KMN-000';
      const centreName = currentActive.mandiName || currentActive.mandi_name || 'Procurement Centre';
      const dateStr = currentActive.slotDate || currentActive.slot_date || 'Today';
      const timeStr = currentActive.slotTime || currentActive.slot_time || 'Morning Window';

      let statusBadgeClass = 'badge-waiting';
      if (activeStatus === 'CALLED') statusBadgeClass = 'badge-called';
      else if (activeStatus === 'IN_PROGRESS') statusBadgeClass = 'badge-in-progress';

      activeTokenContainer.innerHTML = `
        <div class="booking-hero-card" style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1.25rem;">
          <div style="flex:1; min-width:200px;">
            <span class="badge ${statusBadgeClass}" style="margin-bottom:0.6rem;">${activeStatus}</span>
            <h3 style="color:var(--green-dark); margin-bottom:0.3rem; font-size:1.1rem;">Active Mandi Slot — Show QR at Gate</h3>
            <p style="margin:0; font-size:0.875rem; color:var(--text-muted);">📍 ${centreName} &nbsp;·&nbsp; 📅 ${dateStr} &nbsp;·&nbsp; 🕐 ${timeStr}</p>
            <p style="margin:0.25rem 0 0; font-size:0.875rem; color:var(--text-muted);">🌾 ${currentActive.crop || 'Produce'} — ~${currentActive.quantity || 0} Qtl &nbsp;·&nbsp; 🚜 ${currentActive.vehicleNumber || currentActive.vehicle_number || 'Tractor'}</p>
          </div>
          <div style="text-align:center; background:white; padding:1rem 1.5rem; border-radius:var(--radius-lg); border:2px solid var(--green-200); box-shadow:var(--shadow);">
            <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.8px; color:var(--green); font-weight:700; margin-bottom:0.25rem;">Your Token</div>
            <div style="font-size:2.5rem; font-weight:900; color:var(--green-dark); line-height:1; font-family:monospace;">${tokenNum}</div>
            <div style="margin-top:0.75rem; display:flex; gap:0.5rem; justify-content:center;">
              <a href="queue.html" class="btn btn-sm btn-accent">📍 Queue</a>
              <a href="my-booking.html" class="btn btn-sm btn-primary">🎫 Pass</a>
            </div>
          </div>
        </div>
      `;
    } else {
      activeTokenContainer.innerHTML = `
        <div class="empty-state" style="border:1.5px dashed var(--green-200); background:var(--green-50);">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No Active Slot Booking</div>
          <p class="empty-state-desc">Book your mandi slot in advance to get a digital token and skip the wait at the gate.</p>
          <a href="book-slot.html" class="btn btn-primary">+ Book Procurement Slot</a>
        </div>
      `;
    }
  }

  // 4. Render Recent Bookings Table
  const recentTableBody = document.getElementById('recentBookingsTableBody');
  if (recentTableBody) {
    if (farmerBookings.length === 0) {
      recentTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--slate-400);">No bookings found yet. Click "Book New Slot" to create one.</td></tr>`;
    } else {
      recentTableBody.innerHTML = farmerBookings.slice(0, 5).map(booking => {
        const status = (booking.status || 'WAITING').toUpperCase();
        let badgeClass = 'badge-waiting';
        if (status === 'CALLED') badgeClass = 'badge-called';
        else if (status === 'IN_PROGRESS' || status === 'IN_QUEUE' || status === 'WEIGHING') badgeClass = 'badge-in-progress';
        else if (status === 'COMPLETED' || status === 'PROCURED') badgeClass = 'badge-completed';
        else if (status === 'CANCELLED') badgeClass = 'badge-cancelled';

        const token = booking.tokenNumber || booking.token_number || 'KMN-000';
        const dateStr = booking.slotDate || booking.slot_date || 'Today';
        const timeStr = booking.slotTime || booking.slot_time || 'Window';

        return `
          <tr>
            <td><strong>${token}</strong></td>
            <td>${booking.crop || 'Produce'}</td>
            <td>${booking.quantity || 0} Qtl</td>
            <td>${dateStr}<br><small style="color: var(--slate-500);">${timeStr}</small></td>
            <td><span class="badge ${badgeClass}">${status}</span></td>
            <td>
              <a href="my-booking.html" class="btn btn-sm btn-secondary">View</a>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 5. Render Government MSP Ticker / Table
  const mspGrid = document.getElementById('mspRateGrid');
  if (mspGrid) {
    const crops = KissanDB.get('crops', []);
    const cropImages = {
      'Wheat (गेहूं)': 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80',
      'Paddy (धान - Grade A)': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=120&q=80',
      'Mustard (सरसों)': 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=120&q=80',
      'Cotton (कपास - Medium)': 'https://images.unsplash.com/photo-1606041008023-472dfb5e530f?auto=format&fit=crop&w=120&q=80',
      'Gram / Chana (चना)': 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=120&q=80',
      'Maize (मक्का)': 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=120&q=80'
    };

    mspGrid.innerHTML = crops.map(crop => `
      <div style="background-color: var(--slate-50); border: 1px solid var(--slate-200); border-radius: var(--radius-md); padding: 0.75rem; display: flex; align-items: center; gap: 0.75rem;">
        <img src="${cropImages[crop.name] || 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=120&q=80'}" alt="${crop.name}" class="crop-badge-img">
        <div style="flex: 1;">
          <h4 style="font-size: 0.9rem; margin: 0; color: var(--slate-800);">${crop.name}</h4>
          <span style="font-size: 0.75rem; color: var(--slate-500);">Max Moisture: ${crop.maxMoisture}%</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.05rem; font-weight: 800; color: var(--primary-700);">₹${crop.msp}</span>
          <span style="display: block; font-size: 0.7rem; color: var(--slate-500);">${crop.unit}</span>
        </div>
      </div>
    `).join('');
  }

  // 6. Update Journey Timeline on dashboard
  updateJourneyTimeline(activeBookings, farmerProcurements, completedBookings);
}

/**
 * Update the visual journey progress timeline on the farmer dashboard
 */
function updateJourneyTimeline(activeBookings, procurements, completedBookings) {
  const hasPending   = activeBookings.length > 0;
  const hasCompleted = completedBookings.length > 0 || procurements.length > 0;
  const hasPaid      = procurements.some(p => (p.payment_status || p.paymentStatus || '').toLowerCase().includes('credit'));

  function setStage(id, state) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('done', 'active', 'upcoming');
    el.classList.add(state);
  }

  if (hasPaid) {
    setStage('jStageBooked', 'done');
    setStage('jStageToken', 'done');
    setStage('jStageQueue', 'done');
    setStage('jStageProcure', 'done');
    setStage('jStagePayment', 'done');
    const badge = document.getElementById('journeyStatusBadge');
    if (badge) { badge.textContent = '💰 Payment Credited'; badge.className = 'badge badge-success'; }
  } else if (hasCompleted) {
    setStage('jStageBooked', 'done');
    setStage('jStageToken', 'done');
    setStage('jStageQueue', 'done');
    setStage('jStageProcure', 'done');
    setStage('jStagePayment', 'active');
    const badge = document.getElementById('journeyStatusBadge');
    if (badge) { badge.textContent = '⏳ Payment Pending'; badge.className = 'badge badge-warning'; }
  } else if (hasPending) {
    const status = (activeBookings[0].status || 'WAITING').toUpperCase();
    setStage('jStageBooked', 'done');
    setStage('jStageToken', 'done');
    if (status === 'WAITING') {
      setStage('jStageQueue', 'active');
      setStage('jStageProcure', 'upcoming');
      setStage('jStagePayment', 'upcoming');
      const badge = document.getElementById('journeyStatusBadge');
      if (badge) { badge.textContent = '⏳ Waiting in Queue'; badge.className = 'badge badge-warning'; }
    } else if (status === 'CALLED') {
      setStage('jStageQueue', 'done');
      setStage('jStageProcure', 'active');
      setStage('jStagePayment', 'upcoming');
      const badge = document.getElementById('journeyStatusBadge');
      if (badge) { badge.textContent = '📢 Token Called!'; badge.className = 'badge badge-called'; }
    } else if (status === 'IN_PROGRESS') {
      setStage('jStageQueue', 'done');
      setStage('jStageProcure', 'active');
      setStage('jStagePayment', 'upcoming');
      const badge = document.getElementById('journeyStatusBadge');
      if (badge) { badge.textContent = '⚙️ Being Weighed'; badge.className = 'badge badge-in-progress'; }
    }
  } else {
    setStage('jStageBooked', 'upcoming');
    setStage('jStageToken', 'upcoming');
    setStage('jStageQueue', 'upcoming');
    setStage('jStageProcure', 'upcoming');
    setStage('jStagePayment', 'upcoming');
    const badge = document.getElementById('journeyStatusBadge');
    if (badge) { badge.textContent = 'Book to Start'; badge.className = 'badge badge-neutral'; }
  }
}

/**
 * ==============================================================================
 * 6. SUPABASE REALTIME LISTENER FOR FARMER DASHBOARD
 * Automatically updates active tokens and stats when admin changes booking status
 * ==============================================================================
 */
function setupFarmerDashboardRealtime() {
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Subscribing to Supabase Realtime for farmer dashboard...');
      supabase
        .channel('realtime-farmer-dashboard-bookings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          async (payload) => {
            console.log('Realtime change received for farmer dashboard:', payload);
            await initFarmerDashboard();
            if (typeof showToast === 'function') {
              showToast('Live queue updated', 'info');
            }
          }
        )
        .subscribe((status) => {
          console.log('Farmer dashboard realtime subscription status:', status);
        });
    }
  } catch (err) {
    console.warn('Realtime subscription notice for dashboard:', err);
  }

  // Also listen for cross-tab or local state changes
  window.addEventListener('storage', async (e) => {
    if (e.key === 'kissan_bookings' || e.key === 'kissan_queue_state' || e.key === 'kissan_notifications') {
      await initFarmerDashboard();
      if (typeof showToast === 'function') {
        showToast('Live queue updated', 'info');
      }
    }
  });

  window.addEventListener('kissan-booking-changed', async () => {
    await initFarmerDashboard();
    if (typeof showToast === 'function') {
      showToast('Live queue updated', 'info');
    }
  });
}
