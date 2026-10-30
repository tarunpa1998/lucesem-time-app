// Row shapes returned by server functions (shared with the browser; no server imports).
export type ApprovalState = "Approved" | "Pending_Admin_Review" | "Rejected";
export type RoleName = "admin" | "team_lead" | "user";

export interface ProjectRow {
  id: string;
  name: string;
  order_number: string | null;
  color: string;
  approval_state: ApprovalState;
  hourly_rate: string | null;
  time_budget_hours: string | null;
  monetary_budget: string | null;
  is_visible: boolean;
  created_by: string | null;
  customer_name: string;
  customer_id: string;
  used_hours: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  company_number: string | null;
  vat_id: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  color: string;
  internal_comment: string | null;
  time_budget_hours: string | null;
  monetary_budget: string | null;
  budget_type: "Total" | "Monthly";
  is_visible: boolean;
  team_ids: string[];
}

export interface TeamRow {
  id: string;
  name: string;
  color: string;
  members: { userId: string; isLead: boolean }[];
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  weekly_target_hours: string;
  work_days: number[];
  vacation_days_per_year: number;
  include_carinthia: boolean;
  requires_timesheet_approval: boolean;
  is_active: boolean;
  roles: RoleName[];
}

export interface NotificationRow {
  id: string;
  kind: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
