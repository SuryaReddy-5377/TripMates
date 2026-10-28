export type UserRole = 'super_admin' | 'family_admin' | 'member';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

export interface Person {
  id: number;
  display_name: string;
  user_id: number | null;
  is_active: number;
}

export interface Family {
  id: number;
  name: string;
  admin_user_id: number | null;
  is_active: number;
  created_at: string;
}

export interface SessionData {
  user: User;
  person: Person | null;
  family: Family | null;
}

export interface Trip {
  id: number;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  notes: string | null;
  cover_image?: string | null;
  budget_paise: number | null;
  status: 'planning' | 'upcoming' | 'ongoing' | 'completed';
  is_private: number;
  created_by: number;
  completed_at: string | null;
  created_at: string;
}

export type NotificationType =
  | 'trip_invitation'
  | 'trip_added'
  | 'trip_update'
  | 'new_expense'
  | 'expense_update'
  | 'repayment'
  | 'system';

export interface AppNotification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  trip_id: number | null;
  expense_id: number | null;
  repayment_id: number | null;
  data_json: string | null;
  is_read: number;
  read_at: string | null;
  event_key: string | null;
  created_at: string;
}

export interface NotificationPreference {
  user_id: number;
  trip_notifications: number;
  expense_notifications: number;
  repayment_notifications: number;
  browser_push_enabled: number;
  push_subscription_json: string | null;
  updated_at: string;
}
