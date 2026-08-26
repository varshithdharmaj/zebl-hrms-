export type GraphScope =
  | "User.Read"
  | "User.Read.All"
  | "Calendars.ReadWrite"
  | "Presence.Read.All"
  | "Mail.Send"
  | "Chat.ReadWrite"
  | "Group.Read.All";

export type GraphClientConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: GraphScope[];
};

export type GraphTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export type GraphCalendarEvent = {
  id?: string;
  subject: string;
  body?: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  categories?: string[];
  transactionId?: string;
};

export type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  manager?: { id: string };
};

export type GraphPresence = {
  id: string;
  availability?: string;
  activity?: string;
};

export type GraphRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  correlationId?: string;
};

export type GraphRequestResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; retryAfterMs?: number };

export type OrgSyncPolicy = {
  syncDepartment?: boolean;
  syncDesignation?: boolean;
  syncPhoto?: boolean;
  syncManager?: boolean;
  overwriteLocal?: boolean;
};
