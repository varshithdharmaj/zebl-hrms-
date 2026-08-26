/** Standard server action result shape */
export type ActionState = {
  error?: string;
  success?: string;
};

export type BulkActionState = ActionState & {
  processed?: number;
  failed?: number;
};

export type WorkflowActionState = ActionState;

export type SettingsActionState = ActionState;

export type NotificationActionState = ActionState;

export type IntegrationActionState = ActionState;

export type AnalyticsActionState = ActionState;
