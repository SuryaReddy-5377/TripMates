import { formatINR } from '../finance/money';
import { AppNotification, NotificationType, NotificationPreference } from '../types';
import { AnyDb } from '../db/connection';

export interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  tripId?: number | null;
  expenseId?: number | null;
  repaymentId?: number | null;
  data?: Record<string, any> | null;
  eventKey?: string | null;
}

export async function getNotificationPreferences(db: AnyDb | any, userId: number): Promise<NotificationPreference> {
  const row = (await db.prepare(`
    SELECT user_id, trip_notifications, expense_notifications, repayment_notifications, browser_push_enabled, push_subscription_json, updated_at
    FROM notification_preferences
    WHERE user_id = ?
  `).get(userId)) as NotificationPreference | undefined;

  if (row) {
    return row;
  }

  // Default preferences: all enabled
  return {
    user_id: userId,
    trip_notifications: 1,
    expense_notifications: 1,
    repayment_notifications: 1,
    browser_push_enabled: 0,
    push_subscription_json: null,
    updated_at: new Date().toISOString(),
  };
}

export async function updateNotificationPreferences(
  db: AnyDb | any,
  userId: number,
  prefs: Partial<Pick<NotificationPreference, 'trip_notifications' | 'expense_notifications' | 'repayment_notifications' | 'browser_push_enabled' | 'push_subscription_json'>>
): Promise<NotificationPreference> {
  const current = await getNotificationPreferences(db, userId);
  const updated: NotificationPreference = {
    user_id: userId,
    trip_notifications: prefs.trip_notifications !== undefined ? (prefs.trip_notifications ? 1 : 0) : current.trip_notifications,
    expense_notifications: prefs.expense_notifications !== undefined ? (prefs.expense_notifications ? 1 : 0) : current.expense_notifications,
    repayment_notifications: prefs.repayment_notifications !== undefined ? (prefs.repayment_notifications ? 1 : 0) : current.repayment_notifications,
    browser_push_enabled: prefs.browser_push_enabled !== undefined ? (prefs.browser_push_enabled ? 1 : 0) : current.browser_push_enabled,
    push_subscription_json: prefs.push_subscription_json !== undefined ? prefs.push_subscription_json : current.push_subscription_json,
    updated_at: new Date().toISOString(),
  };

  await db.prepare(`
    INSERT INTO notification_preferences (user_id, trip_notifications, expense_notifications, repayment_notifications, browser_push_enabled, push_subscription_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      trip_notifications = excluded.trip_notifications,
      expense_notifications = excluded.expense_notifications,
      repayment_notifications = excluded.repayment_notifications,
      browser_push_enabled = excluded.browser_push_enabled,
      push_subscription_json = excluded.push_subscription_json,
      updated_at = excluded.updated_at
  `).run(
    updated.user_id,
    updated.trip_notifications,
    updated.expense_notifications,
    updated.repayment_notifications,
    updated.browser_push_enabled,
    updated.push_subscription_json,
    updated.updated_at
  );

  return updated;
}

export async function createNotification(db: AnyDb | any, params: CreateNotificationParams): Promise<number | null> {
  // Check if user is active
  const user = (await db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(params.userId)) as { id: number; is_active: number } | undefined;
  if (!user || user.is_active !== 1) {
    return null;
  }

  // Check notification preferences
  const prefs = await getNotificationPreferences(db, params.userId);
  if (params.type.startsWith('trip_') && prefs.trip_notifications === 0) {
    return null;
  }
  if ((params.type === 'new_expense' || params.type === 'expense_update') && prefs.expense_notifications === 0) {
    return null;
  }
  if (params.type === 'repayment' && prefs.repayment_notifications === 0) {
    return null;
  }

  const dataJson = params.data ? JSON.stringify(params.data) : null;

  try {
    const res = await db.prepare(`
      INSERT OR IGNORE INTO notifications (
        user_id, type, title, message, trip_id, expense_id, repayment_id, data_json, event_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.type,
      params.title,
      params.message,
      params.tripId ?? null,
      params.expenseId ?? null,
      params.repaymentId ?? null,
      dataJson,
      params.eventKey ?? null
    );

    if (res.changes === 0) {
      // Ignored due to duplicate event_key
      return null;
    }

    return Number(res.lastInsertRowid);
  } catch (err) {
    console.error('Failed to insert notification:', err);
    return null;
  }
}

/**
 * FEATURE 1: Trip Participant Notification Helper
 */
export async function notifyTripParticipantAdded(
  db: AnyDb | any,
  params: {
    tripId: number;
    personId: number;
    addedByUserId: number;
    tripName?: string;
    tripDates?: string;
  }
): Promise<void> {
  // Look up user_id of the person
  const person = (await db.prepare(`
    SELECT p.id, p.display_name, p.user_id, u.email
    FROM persons p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(params.personId)) as { id: number; display_name: string; user_id: number | null; email: string | null } | undefined;

  if (!person || !person.user_id) {
    return; // Person has no linked user account to notify in-app
  }

  // Don't notify the user if they added themselves
  if (person.user_id === params.addedByUserId) {
    return;
  }

  // Fetch trip details if not provided
  let tripName = params.tripName;
  let tripDates = params.tripDates;
  if (!tripName) {
    const trip = (await db.prepare('SELECT name, destination, start_date, end_date FROM trips WHERE id = ?').get(params.tripId)) as any;
    if (trip) {
      tripName = trip.name;
      if (trip.start_date) {
        tripDates = trip.end_date ? `${trip.start_date} to ${trip.end_date}` : trip.start_date;
      } else if (trip.destination) {
        tripDates = trip.destination;
      }
    }
  }

  // Fetch addedBy person display name
  let addedByName = 'The trip organizer';
  const adderPerson = (await db.prepare('SELECT display_name FROM persons WHERE user_id = ?').get(params.addedByUserId)) as { display_name: string } | undefined;
  if (adderPerson?.display_name) {
    addedByName = adderPerson.display_name;
  }

  const title = `Added to ${tripName || 'Trip'}`;
  const message = tripDates
    ? `${addedByName} added you to "${tripName}" (${tripDates}). Open trip details to confirm your attendance.`
    : `${addedByName} added you to "${tripName}". Open trip details to confirm your attendance.`;

  await createNotification(db, {
    userId: person.user_id,
    type: 'trip_added',
    title,
    message,
    tripId: params.tripId,
    eventKey: `trip_add:${params.tripId}:${person.user_id}`,
    data: {
      trip_name: tripName,
      trip_dates: tripDates,
      added_by: addedByName,
      person_id: params.personId,
    },
  });
}

/**
 * Notify all members of a family when the family is added to a trip
 */
export async function notifyTripFamilyAdded(
  db: AnyDb | any,
  params: {
    tripId: number;
    familyId: number;
    addedByUserId: number;
  }
): Promise<void> {
  const members = (await db.prepare(`
    SELECT person_id FROM family_memberships
    WHERE family_id = ? AND left_at IS NULL
  `).all(params.familyId)) as Array<{ person_id: number }>;

  const trip = (await db.prepare('SELECT name, destination, start_date, end_date FROM trips WHERE id = ?').get(params.tripId)) as any;
  const tripName = trip?.name || 'Trip';
  const tripDates = trip?.start_date ? (trip.end_date ? `${trip.start_date} to ${trip.end_date}` : trip.start_date) : trip?.destination;

  for (const m of members) {
    await notifyTripParticipantAdded(db, {
      tripId: params.tripId,
      personId: m.person_id,
      addedByUserId: params.addedByUserId,
      tripName,
      tripDates,
    });
  }
}

/**
 * FEATURE 2: Expense Notification Helper
 */
export async function notifyExpenseAdded(
  db: AnyDb | any,
  params: {
    tripId: number;
    expenseId: number;
    title: string;
    totalPaise: number;
    paidByType: 'person' | 'family';
    paidById: number;
    allocations: Array<{ id: string; amount: number }>;
    familyBreakdowns?: Record<string, Array<{ id: string; amount: number }>>;
    createdByUserId: number;
  }
): Promise<void> {
  // Get trip info
  const trip = (await db.prepare('SELECT name FROM trips WHERE id = ?').get(params.tripId)) as { name: string } | undefined;
  const tripName = trip ? trip.name : 'Trip';

  // Get payer name
  let payerName = 'Someone';
  if (params.paidByType === 'person') {
    const p = (await db.prepare('SELECT display_name FROM persons WHERE id = ?').get(params.paidById)) as { display_name: string } | undefined;
    if (p) payerName = p.display_name;
  } else {
    const f = (await db.prepare('SELECT name FROM families WHERE id = ?').get(params.paidById)) as { name: string } | undefined;
    if (f) payerName = f.name;
  }

  // Find all trip participants who have a user account
  const participants = (await db.prepare(`
    SELECT DISTINCT p.id as person_id, p.display_name, p.user_id, fm.family_id
    FROM trip_participants tp
    JOIN persons p ON tp.person_id = p.id
    LEFT JOIN family_memberships fm ON fm.person_id = p.id AND fm.left_at IS NULL
    WHERE tp.trip_id = ? AND p.user_id IS NOT NULL AND p.is_active = 1
  `).all(params.tripId)) as Array<{ person_id: number; display_name: string; user_id: number; family_id: number | null }>;

  // Build lookup of shares by person id
  // 1. Direct person allocations: account key 'p:<personId>'
  const personShares = new Map<number, number>();
  // 2. Family allocations: account key 'f:<familyId>'
  const familyShares = new Map<number, number>();

  for (const alloc of params.allocations) {
    if (alloc.id.startsWith('p:')) {
      const pid = Number(alloc.id.slice(2));
      personShares.set(pid, (personShares.get(pid) || 0) + alloc.amount);
    } else if (alloc.id.startsWith('f:')) {
      const fid = Number(alloc.id.slice(2));
      familyShares.set(fid, (familyShares.get(fid) || 0) + alloc.amount);
    }
  }

  // 3. If family share breakdowns are present, person has broken down share
  if (params.familyBreakdowns) {
    for (const members of Object.values(params.familyBreakdowns)) {
      for (const m of members) {
        if (m.id.startsWith('p:')) {
          const pid = Number(m.id.slice(2));
          personShares.set(pid, (personShares.get(pid) || 0) + m.amount);
        }
      }
    }
  }

  const formattedTotal = formatINR(params.totalPaise);

  for (const p of participants) {
    // Check if recipient is the payer
    const isPayer = params.paidByType === 'person' && params.paidById === p.person_id;

    // Determine recipient's assigned share
    let recipientSharePaise = 0;
    let isAssigned = false;

    if (personShares.has(p.person_id)) {
      recipientSharePaise = personShares.get(p.person_id)!;
      isAssigned = true;
    } else if (p.family_id && familyShares.has(p.family_id)) {
      recipientSharePaise = familyShares.get(p.family_id)!;
      isAssigned = true;
    }

    const title = `New expense added — ${params.title} — ${formattedTotal} — ${tripName}`;

    let message = '';
    if (isPayer && isAssigned) {
      message = `You paid ${formattedTotal} for "${params.title}" on ${tripName}. Your assigned share: ${formatINR(recipientSharePaise)}.`;
    } else if (isPayer && !isAssigned) {
      message = `You paid ${formattedTotal} for "${params.title}" on ${tripName}. You have ₹0 share in this expense.`;
    } else if (isAssigned) {
      message = `${payerName} paid ${formattedTotal} for "${params.title}" on ${tripName}. Your share: ${formatINR(recipientSharePaise)}.`;
    } else {
      // Authorized trip member but not assigned to this expense (e.g., idly/puri example)
      message = `${payerName} paid ${formattedTotal} for "${params.title}" on ${tripName}. (You have ₹0 share in this expense).`;
    }

    await createNotification(db, {
      userId: p.user_id,
      type: 'new_expense',
      title,
      message,
      tripId: params.tripId,
      expenseId: params.expenseId,
      eventKey: `expense_create:${params.expenseId}:${p.user_id}`,
      data: {
        trip_name: tripName,
        expense_title: params.title,
        total_paise: params.totalPaise,
        payer_name: payerName,
        share_paise: recipientSharePaise,
        is_assigned: isAssigned,
        is_payer: isPayer,
      },
    });
  }
}

/**
 * Notify repayment to recipient and payer
 */
export async function notifyRepaymentCreated(
  db: AnyDb | any,
  params: {
    tripId: number;
    repaymentId: number;
    fromType: 'person' | 'family';
    fromId: number;
    toType: 'person' | 'family';
    toId: number;
    amountPaise: number;
    paidOn: string;
    recordedByUserId: number;
  }
): Promise<void> {
  const trip = (await db.prepare('SELECT name FROM trips WHERE id = ?').get(params.tripId)) as { name: string } | undefined;
  const tripName = trip ? trip.name : 'Trip';

  let fromName = 'Someone';
  let fromUserId: number | null = null;
  if (params.fromType === 'person') {
    const p = (await db.prepare('SELECT display_name, user_id FROM persons WHERE id = ?').get(params.fromId)) as any;
    if (p) {
      fromName = p.display_name;
      fromUserId = p.user_id;
    }
  } else {
    const f = (await db.prepare('SELECT name, admin_user_id FROM families WHERE id = ?').get(params.fromId)) as any;
    if (f) {
      fromName = f.name;
      fromUserId = f.admin_user_id;
    }
  }

  let toName = 'Someone';
  let toUserId: number | null = null;
  if (params.toType === 'person') {
    const p = (await db.prepare('SELECT display_name, user_id FROM persons WHERE id = ?').get(params.toId)) as any;
    if (p) {
      toName = p.display_name;
      toUserId = p.user_id;
    }
  } else {
    const f = (await db.prepare('SELECT name, admin_user_id FROM families WHERE id = ?').get(params.toId)) as any;
    if (f) {
      toName = f.name;
      toUserId = f.admin_user_id;
    }
  }

  const formattedAmount = formatINR(params.amountPaise);

  // 1. Notify the recipient
  if (toUserId) {
    const title = `Repayment received — ${formattedAmount} — ${tripName}`;
    const message = `${fromName} recorded a repayment of ${formattedAmount} to you for ${tripName}.`;

    await createNotification(db, {
      userId: toUserId,
      type: 'repayment',
      title,
      message,
      tripId: params.tripId,
      repaymentId: params.repaymentId,
      eventKey: `repayment_recvd:${params.repaymentId}:${toUserId}`,
      data: {
        trip_name: tripName,
        amount_paise: params.amountPaise,
        from_name: fromName,
        paid_on: params.paidOn,
      },
    });
  }

  // 2. Notify the sender (if someone else recorded it on their behalf)
  if (fromUserId && fromUserId !== params.recordedByUserId) {
    const title = `Repayment recorded — ${formattedAmount} — ${tripName}`;
    const message = `A repayment of ${formattedAmount} to ${toName} was recorded on your behalf for ${tripName}.`;

    await createNotification(db, {
      userId: fromUserId,
      type: 'repayment',
      title,
      message,
      tripId: params.tripId,
      repaymentId: params.repaymentId,
      eventKey: `repayment_sent:${params.repaymentId}:${fromUserId}`,
      data: {
        trip_name: tripName,
        amount_paise: params.amountPaise,
        to_name: toName,
        paid_on: params.paidOn,
      },
    });
  }
}
