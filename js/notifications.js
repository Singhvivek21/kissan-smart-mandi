/**
 * ==========================================================================
 * KISSAN – Procure Smart Mandi
 * In-App Notification System (js/notifications.js)
 * Real Supabase Integration: notifications table (id, farmer_id, title, message, is_read, created_at)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Header Notification Bell if navigation exists
  initNotificationHeader();

  // If on farmer dashboard, render notification feed
  if (window.location.pathname.includes('farmer-dashboard.html')) {
    await renderFarmerDashboardNotifications();
  }
});

/**
 * Retrieve active farmer ID
 */
function getActiveNotificationFarmerId() {
  const farmer = KissanDB.get('current_farmer', { id: 'F-10024' });
  return farmer.id || 'F-10024';
}

/**
 * ==============================================================================
 * 1. CREATE NOTIFICATION (Triggered across system events)
 * ==============================================================================
 */
window.createFarmerNotification = async function({ farmer_id, title, message }) {
  if (!farmer_id || !title || !message) {
    console.warn('Missing parameters for createFarmerNotification');
    return null;
  }

  const notifId = 'NOTIF-' + Math.floor(10000 + Math.random() * 90000);
  const notificationRecord = {
    id: notifId,
    farmer_id: String(farmer_id),
    title: title.trim(),
    message: message.trim(),
    is_read: false,
    created_at: new Date().toISOString()
  };

  // 1. Insert into Supabase notifications table
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      console.log('Inserting notification into Supabase:', notificationRecord);
      const { error } = await supabase
        .from('notifications')
        .insert(notificationRecord);

      if (error) {
        console.warn('Notice inserting notification into Supabase:', error.message);
      } else {
        console.log('Notification record saved in Supabase.');
      }
    }
  } catch (err) {
    console.warn('Notification database notice:', err);
  }

  // 2. Insert into Local Storage Cache
  const localNotifs = KissanDB.get('notifications', []);
  localNotifs.unshift(notificationRecord);
  KissanDB.set('notifications', localNotifs);

  // 3. Update UI if active
  await updateHeaderNotificationBadge();
  if (window.location.pathname.includes('farmer-dashboard.html')) {
    await renderFarmerDashboardNotifications();
  }

  return notificationRecord;
};

/**
 * ==============================================================================
 * 2. FETCH FARMER NOTIFICATIONS
 * ==============================================================================
 */
window.fetchFarmerNotifications = async function(farmerId) {
  const targetId = farmerId || getActiveNotificationFarmerId();
  let notifications = [];

  try {
    const supabase = window.supabaseClient;
    if (supabase && targetId) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('farmer_id', targetId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        notifications = data;
        // Merge into local cache
        const local = KissanDB.get('notifications', []);
        const merged = [...data];
        local.forEach(ln => {
          if (!merged.find(m => m.id === ln.id)) merged.push(ln);
        });
        KissanDB.set('notifications', merged);
      }
    }
  } catch (err) {
    console.warn('Notice querying Supabase notifications:', err);
  }

  // Fallback to local cache
  if (notifications.length === 0) {
    const local = KissanDB.get('notifications', []);
    notifications = local.filter(n => String(n.farmer_id) === String(targetId) || String(n.farmerId) === String(targetId));
  }

  return notifications;
};

/**
 * ==============================================================================
 * 3. MARK NOTIFICATION AS READ
 * ==============================================================================
 */
window.markNotificationAsRead = async function(notifId) {
  console.log(`Marking notification ${notifId} as read...`);

  // 1. Update in Supabase
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);

      if (error) {
        console.warn('Notice updating notification in Supabase:', error.message);
      }
    }
  } catch (err) {
    console.warn('Notification update notice:', err);
  }

  // 2. Update in Local Storage Cache
  const local = KissanDB.get('notifications', []);
  const updated = local.map(n => {
    if (n.id === notifId) {
      return { ...n, is_read: true };
    }
    return n;
  });
  KissanDB.set('notifications', updated);

  // 3. Refresh UI
  await updateHeaderNotificationBadge();
  if (window.location.pathname.includes('farmer-dashboard.html')) {
    await renderFarmerDashboardNotifications();
  }
};

/**
 * ==============================================================================
 * 4. MARK ALL NOTIFICATIONS AS READ
 * ==============================================================================
 */
window.markAllNotificationsAsRead = async function(farmerId) {
  const targetId = farmerId || getActiveNotificationFarmerId();
  console.log(`Marking all notifications as read for farmer ${targetId}...`);

  // 1. Update in Supabase
  try {
    const supabase = window.supabaseClient;
    if (supabase) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('farmer_id', targetId)
        .eq('is_read', false);

      if (error) {
        console.warn('Notice batch updating notifications in Supabase:', error.message);
      }
    }
  } catch (err) {
    console.warn('Notification batch update notice:', err);
  }

  // 2. Update in Local Storage Cache
  const local = KissanDB.get('notifications', []);
  const updated = local.map(n => {
    if (String(n.farmer_id) === String(targetId) || String(n.farmerId) === String(targetId)) {
      return { ...n, is_read: true };
    }
    return n;
  });
  KissanDB.set('notifications', updated);

  showToast('All notifications marked as read.', 'info');

  // 3. Refresh UI
  await updateHeaderNotificationBadge();
  if (window.location.pathname.includes('farmer-dashboard.html')) {
    await renderFarmerDashboardNotifications();
  }
};

/**
 * Format timestamp into readable human time
 */
function formatNotificationTime(isoStr) {
  if (!isoStr) return 'Just now';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * ==============================================================================
 * 5. NAVIGATION HEADER NOTIFICATION BELL COMPONENT
 * ==============================================================================
 */
function initNotificationHeader() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions || document.getElementById('navNotificationWrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'navNotificationWrapper';
  wrapper.className = 'notification-nav-wrapper';
  wrapper.innerHTML = `
    <button id="navNotificationBtn" class="notification-bell-btn" title="Notifications" aria-label="Notifications">
      <span class="bell-text">Alerts</span>
      <span id="navUnreadBadge" class="notification-badge" style="display: none;">0</span>
    </button>
    <div id="navNotificationDropdown" class="notification-dropdown">
      <div class="notif-dropdown-header">
        <span style="font-weight: 700; color: var(--slate-900); font-size: 0.95rem;">Notifications</span>
        <button onclick="markAllNotificationsAsRead()" class="btn btn-sm btn-secondary" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">
          Mark All Read
        </button>
      </div>
      <div id="navNotificationItems" class="notif-dropdown-body">
        <div style="padding: 1.5rem; text-align: center; color: var(--slate-500); font-size: 0.85rem;">
          Loading alerts...
        </div>
      </div>
      <div class="notif-dropdown-footer">
        <a href="farmer-dashboard.html#farmerNotificationsCard" style="font-size: 0.8rem; color: var(--primary-700); font-weight: 600; text-decoration: none;">
          View All in Dashboard ->
        </a>
      </div>
    </div>
  `;

  // Insert before the user chip in nav-actions
  const userChip = navActions.querySelector('.user-chip');
  if (userChip) {
    navActions.insertBefore(wrapper, userChip);
  } else {
    navActions.prepend(wrapper);
  }

  // Toggle dropdown on button click
  const btn = document.getElementById('navNotificationBtn');
  const dropdown = document.getElementById('navNotificationDropdown');

  if (btn && dropdown) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isActive = dropdown.classList.toggle('active');
      if (isActive) {
        await updateHeaderNotificationDropdown();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  }

  // Initial badge update
  updateHeaderNotificationBadge();
}

/**
 * Update unread count badge in header
 */
async function updateHeaderNotificationBadge() {
  const badge = document.getElementById('navUnreadBadge');
  if (!badge) return;

  const farmerId = getActiveNotificationFarmerId();
  const notifs = await fetchFarmerNotifications(farmerId);
  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Render items inside the header dropdown
 */
async function updateHeaderNotificationDropdown() {
  const container = document.getElementById('navNotificationItems');
  if (!container) return;

  const farmerId = getActiveNotificationFarmerId();
  const notifs = await fetchFarmerNotifications(farmerId);

  if (notifs.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--slate-400); font-size: 0.85rem;">
        No notifications yet. Updates about your slots and payments will appear here.
      </div>
    `;
    return;
  }

  container.innerHTML = notifs.slice(0, 6).map(n => {
    const isUnread = !n.is_read;
    const timeStr = formatNotificationTime(n.created_at);

    return `
      <div class="notif-dropdown-item ${isUnread ? 'unread' : ''}" onclick="markNotificationAsRead('${n.id}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.2rem;">
          <strong style="font-size: 0.85rem; color: var(--slate-900);">${n.title}</strong>
          ${isUnread ? '<span class="badge badge-warning" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">NEW</span>' : ''}
        </div>
        <p style="margin: 0 0 0.35rem; font-size: 0.8rem; color: var(--slate-600); line-height: 1.35;">${n.message}</p>
        <span style="font-size: 0.7rem; color: var(--slate-400);">${timeStr}</span>
      </div>
    `;
  }).join('');
}

/**
 * ==============================================================================
 * 6. RENDER FARMER DASHBOARD NOTIFICATIONS FEED
 * ==============================================================================
 */
window.renderFarmerDashboardNotifications = async function() {
  const listContainer = document.getElementById('farmerNotificationsList');
  const countBadge = document.getElementById('unreadNotifCountBadge');
  const statUnread = document.getElementById('statUnreadNotifications');
  if (!listContainer) return;

  const farmerId = getActiveNotificationFarmerId();
  const notifs = await fetchFarmerNotifications(farmerId);
  const unreadList = notifs.filter(n => !n.is_read);

  if (countBadge) {
    countBadge.textContent = `${unreadList.length} Unread`;
    countBadge.className = unreadList.length > 0 ? 'badge badge-warning' : 'badge badge-neutral';
  }

  if (statUnread) {
    statUnread.textContent = unreadList.length;
  }

  if (notifs.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-400); font-size: 0.9rem;">
        No notifications recorded. System updates for slot bookings, token calls, procurement, and payment will be displayed here.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = notifs.map(n => {
    const isUnread = !n.is_read;
    const timeStr = formatNotificationTime(n.created_at);

    return `
      <div class="notification-card-item ${isUnread ? 'unread' : 'read'}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <strong style="color: var(--slate-900); font-size: 0.95rem;">${n.title}</strong>
              ${isUnread ? '<span class="badge badge-warning" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;">NEW</span>' : '<span class="badge badge-neutral" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;">READ</span>'}
            </div>
            <p style="margin: 0 0 0.5rem; color: var(--slate-700); font-size: 0.875rem; line-height: 1.45;">
              ${n.message}
            </p>
            <span style="font-size: 0.75rem; color: var(--slate-500); font-weight: 500;">
              ${timeStr}
            </span>
          </div>
          <div>
            ${isUnread ? `
              <button onclick="markNotificationAsRead('${n.id}')" class="btn btn-sm btn-secondary" style="font-size: 0.75rem; padding: 0.3rem 0.65rem; white-space: nowrap;">
                Mark as Read
              </button>
            ` : `
              <span style="font-size: 0.75rem; color: var(--slate-400); font-weight: 600;">Verified</span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
};
