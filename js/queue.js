/**
 * ==========================================================================
 * KISSAN – Procure Smart Mandi
 * Live Mandi Queue & Farmer Token Tracking (js/queue.js)
 * Real Supabase Integration with Dynamic "People Before Me" Calculation
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname.includes('queue.html')) {
    await initQueuePage();
  }
});

/**
 * Initialize Queue Page with Supabase Realtime
 */
async function initQueuePage() {
  await renderQueueStatus();
  setupQueueRealtimeSubscription();

  // Refresh Queue Button
  const refreshBtn = document.getElementById('refreshQueueBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Updating...';
      await renderQueueStatus();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Queue Status';
      showToast('Live queue updated', 'info');
    });
  }
}

/**
 * Helper to parse numeric part of token string (e.g. "KMN-042" -> 42)
 */
function parseTokenNumber(tokenStr) {
  if (!tokenStr) return 0;
  const num = parseInt(tokenStr.toString().replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize Status String
 */
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

/**
 * Get Status Badge HTML for WAITING, CALLED, IN_PROGRESS, COMPLETED, CANCELLED
 */
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

/**
 * Retrieve active logged-in farmer
 */
async function getActiveFarmer() {
  let farmer = null;
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        farmer = {
          id: user.id,
          name: profile?.full_name || user.user_metadata?.full_name || 'Farmer',
          mobile: profile?.mobile || user.user_metadata?.mobile || '9876543210'
        };
      }
    }
  } catch (err) {
    console.warn('Notice getting user for queue:', err);
  }

  if (!farmer) {
    farmer = KissanDB.get('current_farmer', {
      id: 'F-10024',
      name: 'Rameshwar Singh',
      mobile: '9876543210'
    });
  }

  const nameEl = document.getElementById('farmerNameDisplay');
  if (nameEl && farmer) {
    nameEl.textContent = farmer.name;
  }

  return farmer;
}

/**
 * ==============================================================================
 * RENDER LIVE QUEUE STATUS (SUPABASE SYNC & PEOPLE BEFORE ME CALCULATION)
 * Metrics:
 * 1. My Token
 * 2. Current Token (Active at Mandi Gate / Bay)
 * 3. People Before Me (earlier tokens with status WAITING or CALLED)
 * 4. Status (WAITING, CALLED, IN_PROGRESS, COMPLETED, CANCELLED)
 * ==============================================================================
 */
async function renderQueueStatus() {
  const farmer = await getActiveFarmer();
  const today = new Date().toISOString().split('T')[0];

  let todayBookings = [];

  // 1. Fetch Today's Bookings from Authoritative Backend API
  try {
    const res = await fetch(`/api/bookings?slot_date=${encodeURIComponent(today)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.bookings && Array.isArray(json.bookings) && json.bookings.length > 0) {
        todayBookings = json.bookings;
      }
    }
  } catch (apiErr) {
    console.warn('Queue API notice:', apiErr);
  }

  // Fallback to Supabase if API returned nothing
  if (todayBookings.length === 0) {
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('slot_date', today);

        if (!error && data && data.length > 0) {
          todayBookings = data;
        }
      }
    } catch (err) {
      console.warn('Notice querying Supabase queue:', err);
    }
  }

  // Fallback to local storage if Supabase returned nothing
  if (todayBookings.length === 0) {
    const allBookings = KissanDB.get('bookings', []);
    todayBookings = allBookings.filter(b => (b.slot_date === today || b.slotDate === today));
    // If no bookings match today's date, use all uncancelled for demonstration
    if (todayBookings.length === 0) {
      todayBookings = allBookings.filter(b => b.status !== 'Cancelled' && b.status !== 'CANCELLED');
    }
  }

  // Sort today's bookings sequentially by token number
  todayBookings.sort((a, b) => {
    const tokenA = a.token_number || a.tokenNumber || '';
    const tokenB = b.token_number || b.tokenNumber || '';
    return parseTokenNumber(tokenA) - parseTokenNumber(tokenB);
  });

  // 2. Locate Logged-in Farmer's Booking in Today's Queue
  const farmerBooking = todayBookings.find(b => 
    (b.farmer_id === farmer.id || b.farmerId === farmer.id) ||
    (b.farmer_phone === farmer.mobile || b.farmerPhone === farmer.mobile)
  ) || KissanDB.get('bookings', []).find(b => 
    (b.farmer_id === farmer.id || b.farmerId === farmer.id) &&
    normalizeStatus(b.status) !== 'CANCELLED'
  );

  // 3. Determine Current Token at Mandi
  // Priority: IN_PROGRESS token -> CALLED token -> first WAITING token -> fallback
  const inProgressBooking = todayBookings.find(b => normalizeStatus(b.status) === 'IN_PROGRESS');
  const calledBooking = todayBookings.find(b => normalizeStatus(b.status) === 'CALLED');
  const firstWaitingBooking = todayBookings.find(b => normalizeStatus(b.status) === 'WAITING');

  let currentServingToken = '--';
  let activeStageText = 'Mandi Gate & Bay Active';

  if (inProgressBooking) {
    currentServingToken = inProgressBooking.token_number || inProgressBooking.tokenNumber;
    activeStageText = 'At Weighbridge Scale';
  } else if (calledBooking) {
    currentServingToken = calledBooking.token_number || calledBooking.tokenNumber;
    activeStageText = 'Called to Gate Bay';
  } else if (firstWaitingBooking) {
    currentServingToken = firstWaitingBooking.token_number || firstWaitingBooking.tokenNumber;
    activeStageText = 'Next in Line';
  } else {
    const queueState = KissanDB.get('queue_state', {});
    currentServingToken = queueState.currentServingToken || '--';
  }

  // 4. Calculate "People Before Me"
  // Rule: Count bookings with earlier token numbers whose status is WAITING or CALLED
  let peopleBeforeMe = 0;
  let farmerStatus = farmerBooking ? normalizeStatus(farmerBooking.status) : 'NO_BOOKING';

  if (farmerBooking && farmerStatus !== 'CANCELLED') {
    const farmerTokenNum = parseTokenNumber(farmerBooking.token_number || farmerBooking.tokenNumber);

    if (farmerStatus === 'WAITING') {
      // Count earlier tokens with status WAITING or CALLED
      peopleBeforeMe = todayBookings.filter(b => {
        const otherTokenNum = parseTokenNumber(b.token_number || b.tokenNumber);
        const otherStatus = normalizeStatus(b.status);
        const isEarlier = otherTokenNum < farmerTokenNum;
        const isWaitingOrCalled = (otherStatus === 'WAITING' || otherStatus === 'CALLED');
        return isEarlier && isWaitingOrCalled;
      }).length;
    } else if (farmerStatus === 'CALLED' || farmerStatus === 'IN_PROGRESS' || farmerStatus === 'COMPLETED') {
      peopleBeforeMe = 0;
    }
  }

  // 5. Update the 4 Core KPI Displays
  // 1. My Token
  const myTokenEl = document.getElementById('qStatMyToken');
  const myCentreEl = document.getElementById('qStatMyCentre');
  if (myTokenEl) {
    myTokenEl.textContent = farmerBooking ? (farmerBooking.token_number || farmerBooking.tokenNumber) : '--';
  }
  if (myCentreEl) {
    myCentreEl.textContent = farmerBooking ? (farmerBooking.mandi_name || farmerBooking.mandiName || 'Procurement Centre') : 'No Active Booking';
  }

  // 2. Current Token
  const currentTokenEl = document.getElementById('qStatCurrentToken');
  const currentStageEl = document.getElementById('qStatCurrentStage');
  if (currentTokenEl) {
    currentTokenEl.textContent = currentServingToken;
  }
  if (currentStageEl) {
    currentStageEl.textContent = activeStageText;
  }

  // 3. People Before Me
  const peopleAheadEl = document.getElementById('qStatPeopleAhead');
  const estWaitEl = document.getElementById('qStatEstWait');
  if (peopleAheadEl) {
    if (!farmerBooking || farmerStatus === 'CANCELLED') {
      peopleAheadEl.textContent = '--';
    } else if (farmerStatus === 'CALLED') {
      peopleAheadEl.textContent = '0 (CALLED)';
    } else if (farmerStatus === 'IN_PROGRESS') {
      peopleAheadEl.textContent = '0 (ON SCALE)';
    } else {
      peopleAheadEl.textContent = peopleBeforeMe;
    }
  }
  if (estWaitEl) {
    if (farmerBooking && farmerStatus === 'WAITING') {
      const estMinutes = peopleBeforeMe * 10;
      estWaitEl.textContent = `~${estMinutes} mins estimated wait`;
    } else if (farmerStatus === 'CALLED') {
      estWaitEl.textContent = 'Proceed immediately to Gate 1';
    } else if (farmerStatus === 'IN_PROGRESS') {
      estWaitEl.textContent = 'Weighing in progress';
    } else {
      estWaitEl.textContent = 'Vehicles waiting ahead in line';
    }
  }

  // 4. Status Badge
  const statusBadgeEl = document.getElementById('qStatStatusBadge');
  const statusNoteEl = document.getElementById('qStatStatusNote');
  if (statusBadgeEl) {
    if (farmerBooking) {
      statusBadgeEl.innerHTML = getStatusBadgeMarkup(farmerStatus);
    } else {
      statusBadgeEl.innerHTML = `<span class="badge badge-waiting">NO BOOKING</span>`;
    }
  }
  if (statusNoteEl) {
    statusNoteEl.textContent = farmerBooking ? `Slot: ${farmerBooking.slot_date || farmerBooking.slotDate || today}` : 'Book a slot to enter queue';
  }

  // Timestamp
  const lastUpdatedEl = document.getElementById('queueLastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Live Mandi database • Last updated at ${new Date().toLocaleTimeString()}`;
  }

  // Trigger SMS notification when token is approaching turn (3 or fewer vehicles ahead)
  if (farmerBooking && farmerStatus === 'WAITING' && peopleBeforeMe <= 3 && peopleBeforeMe > 0) {
    if (window.SMSClient) {
      try {
        window.SMSClient.triggerTokenApproaching(farmerBooking, peopleBeforeMe);
      } catch (smsErr) {}
    }
  }

  // 6. Render Farmer Queue Alert / Instruction Box
  const alertBox = document.getElementById('farmerQueueAlertBox');
  if (alertBox) {
    if (!farmerBooking || farmerStatus === 'CANCELLED') {
      alertBox.innerHTML = `
        <div class="empty-state" style="border:1.5px dashed var(--green-200); background:white;">
          <div class="empty-state-icon">📍</div>
          <div class="empty-state-title">No Active Token in Today's Queue</div>
          <p class="empty-state-desc">You do not have a booking scheduled for today. Book a slot to get your queue token.</p>
          <a href="book-slot.html" class="btn btn-primary">+ Book Slot</a>
        </div>
      `;
    } else if (farmerStatus === 'CALLED') {
      alertBox.innerHTML = `
        <div class="card" style="border: 2px solid var(--amber); background: linear-gradient(135deg, #fffbeb, #ffffff); padding: 1.5rem;">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1rem;">
            <div>
              <span class="badge badge-called" style="font-size:0.85rem; padding:0.35rem 0.85rem; margin-bottom:0.4rem;">
                🔔 YOUR TOKEN IS CALLED
              </span>
              <h2 style="color:var(--amber-dark); margin:0.3rem 0; font-size:1.4rem;">
                Token ${farmerBooking.token_number || farmerBooking.tokenNumber} — Gate Entry Open
              </h2>
              <p style="margin:0; color:var(--text); font-size:0.9rem;">
                Drive vehicle <strong>${farmerBooking.vehicle_number || farmerBooking.vehicleNumber || 'your vehicle'}</strong> immediately to <strong>Mandi Gate 1 / Weighbridge Bay</strong>.
              </p>
            </div>
            <a href="my-booking.html" class="btn btn-accent btn-lg">Show Gate Pass QR →</a>
          </div>
        </div>
      `;
    } else if (farmerStatus === 'IN_PROGRESS') {
      alertBox.innerHTML = `
        <div class="card" style="border: 2px solid var(--blue); background: linear-gradient(135deg, #eff6ff, #ffffff); padding: 1.5rem;">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1rem;">
            <div>
              <span class="badge badge-in-progress" style="font-size:0.85rem; padding:0.35rem 0.85rem; margin-bottom:0.4rem;">
                ⚙️ WEIGHMENT IN PROGRESS
              </span>
              <h2 style="color:var(--blue-dark); margin:0.3rem 0; font-size:1.4rem;">
                Token ${farmerBooking.token_number || farmerBooking.tokenNumber} — On Weighbridge Scale
              </h2>
              <p style="margin:0; color:var(--text); font-size:0.9rem;">
                Your produce (${farmerBooking.crop || 'crop'} — ~${farmerBooking.quantity || 0} Qtl) is being weighed and quality-tested.
              </p>
            </div>
            <a href="procurement.html" class="btn btn-primary">View Procurement →</a>
          </div>
        </div>
      `;
    } else if (farmerStatus === 'COMPLETED') {
      alertBox.innerHTML = `
        <div class="card" style="border: 2px solid var(--green); background: linear-gradient(135deg, var(--green-50), #ffffff); padding: 1.5rem;">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1rem;">
            <div>
              <span class="badge badge-completed" style="font-size:0.85rem; padding:0.35rem 0.85rem; margin-bottom:0.4rem;">
                ✅ PROCUREMENT COMPLETED
              </span>
              <h2 style="color:var(--green-dark); margin:0.3rem 0; font-size:1.4rem;">
                Token ${farmerBooking.token_number || farmerBooking.tokenNumber} — Settled
              </h2>
              <p style="margin:0; color:var(--text); font-size:0.9rem;">
                Your produce procurement is complete. DBT payment has been initiated to your bank account.
              </p>
            </div>
            <a href="procurement.html" class="btn btn-success btn-lg">Download J-Form →</a>
          </div>
        </div>
      `;
    } else {
      // WAITING
      const estMinutes = peopleBeforeMe * 10;
      alertBox.innerHTML = `
        <div class="card" style="border: 2px solid var(--green-300); background: linear-gradient(135deg, white, var(--green-50)); padding: 1.25rem;">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:1rem;">
            <div>
              <span class="badge badge-waiting" style="margin-bottom:0.35rem;">⏳ WAITING IN QUEUE</span>
              <h3 style="color:var(--green-dark); margin:0.2rem 0;">
                Your Token: ${farmerBooking.token_number || farmerBooking.tokenNumber} (${farmerBooking.crop || 'Produce'} — ~${farmerBooking.quantity || 0} Qtl)
              </h3>
              <p style="margin: 0; color: var(--slate-600); font-size: 0.9rem;">
                There ${peopleBeforeMe === 1 ? 'is <strong>1 vehicle</strong>' : `are <strong>${peopleBeforeMe} vehicles</strong>`} ahead of you. Estimated wait: <strong>~${estMinutes} minutes</strong>. Please wait in the farmer holding area.
              </p>
            </div>
            <div>
              <a href="my-booking.html" class="btn btn-secondary">View My Gate Pass</a>
            </div>
          </div>
        </div>
      `;
    }
  }

  // 7. Render Today's Live Queue Stream Table
  const tableBody = document.getElementById('liveQueueListBody');
  const countBadge = document.getElementById('liveQueueCountBadge');

  if (countBadge) {
    countBadge.textContent = `${todayBookings.length} Tokens in Queue`;
  }

  if (tableBody) {
    if (todayBookings.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--slate-400);">
            No procurement bookings in today's queue.
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = todayBookings.map(b => {
        const tokenNum = b.token_number || b.tokenNumber || 'KMN-000';
        const isMyToken = farmerBooking && (b.id === farmerBooking.id || tokenNum === (farmerBooking.token_number || farmerBooking.tokenNumber));
        const status = normalizeStatus(b.status || 'WAITING');
        const isServing = (status === 'CALLED' || status === 'IN_PROGRESS');

        return `
          <tr class="${isMyToken ? 'row-mine' : ''}" style="${isServing && !isMyToken ? 'background-color:#fffbeb;' : ''}">
            <td>
              <strong style="color:${isMyToken ? 'var(--green-dark)' : 'var(--text)'}; font-size:1rem; font-family:monospace;">
                ${tokenNum}
              </strong>
              ${isMyToken ? '<span class="badge badge-success" style="font-size:0.65rem; margin-left:0.35rem; vertical-align:middle;">YOU</span>' : ''}
            </td>
            <td><strong>${b.farmer_name || b.farmerName || 'Farmer'}</strong></td>
            <td>${b.crop || 'Produce'} (${b.quantity || 0} Qtl)</td>
            <td>${getStatusBadgeMarkup(status)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Update badge counts
  const cnt = document.getElementById('liveQueueCountBadge');
  const cnt2 = document.getElementById('liveQueueCountBadge2');
  if (cnt) cnt.textContent = todayBookings.length + ' Tokens';
  if (cnt2) cnt2.textContent = todayBookings.length + ' Tokens';

  // Last updated — preserve live-indicator HTML
  const lastUpdatedEl = document.getElementById('queueLastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.innerHTML = `
      <div class="live-indicator">
        <div class="live-dot"></div>
        Real-time · Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>`;
  }

  // Fire token chain render hook (picked up by queue.html inline script)
  if (typeof window._onQueueDataLoaded === 'function') {
    const myToken = farmerBooking ? (farmerBooking.token_number || farmerBooking.tokenNumber) : null;
    window._onQueueDataLoaded(todayBookings, myToken);
  }
}

/**
 * ==============================================================================
 * SUPABASE REALTIME QUEUE LISTENER & NOTIFICATIONS
 * Listens for live Postgres changes on public.bookings table
 * ==============================================================================
 */
function showLiveQueueUpdatedNotice() {
  if (typeof showToast === 'function') {
    showToast('Live queue updated', 'info');
  }
}

function setupQueueRealtimeSubscription() {
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Subscribing to Supabase Realtime for bookings table on queue page...');
      supabase
        .channel('realtime-queue-bookings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          async (payload) => {
            console.log('Supabase Realtime update received on bookings:', payload);
            await renderQueueStatus();
            showLiveQueueUpdatedNotice();
          }
        )
        .subscribe((status) => {
          console.log('Supabase Realtime queue subscription status:', status);
        });
    }
  } catch (err) {
    console.warn('Realtime subscription notice:', err);
  }

  // Also listen for cross-tab or local storage state changes
  window.addEventListener('storage', async (e) => {
    if (e.key === 'kissan_bookings' || e.key === 'kissan_queue_state') {
      await renderQueueStatus();
      showLiveQueueUpdatedNotice();
    }
  });

  window.addEventListener('kissan-booking-changed', async () => {
    await renderQueueStatus();
    showLiveQueueUpdatedNotice();
  });
}

