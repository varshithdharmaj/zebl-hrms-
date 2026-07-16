import { vi } from "vitest";

vi.mock("server-only", () => ({}));

process.env.AUTH_SECRET ??= "test-auth-secret-minimum-32-characters";
process.env.APPROVAL_TOKEN_SECRET ??= "test-approval-secret-minimum-32-chars";
process.env.APP_BASE_URL ??= "http://localhost:3000";

