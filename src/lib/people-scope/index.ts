export { PeopleScopeEngine } from "@/lib/people-scope/engine";
export { toManagerSafeEmployee } from "@/lib/people-scope/manager-safe-dto";
export {
  resolveMyTeamNavContext,
  type MyTeamNavContext,
} from "@/lib/people-scope/nav-context";
export {
  TERMINAL_EMPLOYEE_STATUSES,
  isTerminalEmployeeStatus,
  terminalEmployeeStatusesForQuery,
} from "@/lib/people-scope/terminal-statuses";
export type {
  EmployeeForManagerSafeDto,
  ManagerSafeEmployee,
  PeopleScope,
  PeopleScopeMode,
  ResolveScopeOptions,
} from "@/lib/people-scope/types";
