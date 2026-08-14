--
-- PostgreSQL database dump
--

\restrict n1b1HNzX1wXFQm3U7MKeG7okxsH5wIJO3be8BkYC3mQEFXly3Ym78cPnSwKIfzc

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountStatus" AS ENUM (
    'active',
    'inactive',
    'locked',
    'suspended',
    'pending',
    'terminated'
);


--
-- Name: AiInsightStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AiInsightStatus" AS ENUM (
    'pending_review',
    'accepted',
    'dismissed',
    'superseded'
);


--
-- Name: AiInsightType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AiInsightType" AS ENUM (
    'resume_parse',
    'profile_completion',
    'quality_score',
    'candidate_summary',
    'duplicate_suggestion',
    'job_match',
    'interview_summary',
    'decision_draft',
    'resume_field_recovery'
);


--
-- Name: AnalyticsScope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnalyticsScope" AS ENUM (
    'organization',
    'department',
    'team',
    'employee'
);


--
-- Name: AnomalySeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AnomalySeverity" AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: ApplicationPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApplicationPriority" AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);


--
-- Name: ApplicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApplicationStatus" AS ENUM (
    'active',
    'hired',
    'rejected',
    'on_hold',
    'withdrawn'
);


--
-- Name: ApprovalStepStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApprovalStepStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'skipped'
);


--
-- Name: ApprovalTokenAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApprovalTokenAction" AS ENUM (
    'approve',
    'reject'
);


--
-- Name: ApprovalTokenStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApprovalTokenStatus" AS ENUM (
    'active',
    'consumed',
    'expired',
    'revoked'
);


--
-- Name: ApproverRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ApproverRole" AS ENUM (
    'manager',
    'skip_level_manager',
    'hr_admin'
);


--
-- Name: AttendanceImportJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceImportJobStatus" AS ENUM (
    'UPLOADED',
    'PROCESSING',
    'FAILED',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: AttendanceOverrideType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AttendanceOverrideType" AS ENUM (
    'working_day',
    'weekly_off'
);


--
-- Name: AuthProvider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuthProvider" AS ENUM (
    'local',
    'microsoft'
);


--
-- Name: CalendarSyncStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CalendarSyncStatus" AS ENUM (
    'pending',
    'synced',
    'failed',
    'skipped',
    'deleted'
);


--
-- Name: CandidateSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CandidateSource" AS ENUM (
    'manual_upload',
    'referral',
    'csv_import',
    'google_forms_csv',
    'other',
    'manual',
    'import',
    'employee_referral',
    'career_portal_future'
);


--
-- Name: CandidateStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CandidateStatus" AS ENUM (
    'active',
    'hired',
    'talent_pool',
    'do_not_hire',
    'archived',
    'merged'
);


--
-- Name: HiringDecisionOutcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HiringDecisionOutcome" AS ENUM (
    'strong_hire',
    'hire',
    'borderline',
    'hold',
    'reject'
);


--
-- Name: HiringTeamRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HiringTeamRole" AS ENUM (
    'recruiter',
    'hiring_manager',
    'team_lead',
    'interviewer'
);


--
-- Name: IntakeItemStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IntakeItemStatus" AS ENUM (
    'received',
    'parse_pending',
    'parse_ready',
    'duplicate_review',
    'confirmed',
    'discarded'
);


--
-- Name: IntegrationJobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IntegrationJobStatus" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: InterviewRoundType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InterviewRoundType" AS ENUM (
    'screening',
    'hr',
    'technical',
    'team_lead',
    'manager',
    'client',
    'other'
);


--
-- Name: InterviewStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InterviewStatus" AS ENUM (
    'draft',
    'scheduled',
    'completed',
    'no_show',
    'cancelled'
);


--
-- Name: JobEmploymentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobEmploymentType" AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'intern',
    'temporary',
    'other'
);


--
-- Name: JobOpeningStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobOpeningStatus" AS ENUM (
    'draft',
    'open',
    'on_hold',
    'closed',
    'filled'
);


--
-- Name: LeaveRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeaveRequestStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'withdrawn',
    'cancelled'
);


--
-- Name: LeaveWorkflowStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeaveWorkflowStatus" AS ENUM (
    'submitted',
    'pending_approval',
    'approved',
    'rejected',
    'withdrawn',
    'cancelled'
);


--
-- Name: LoginSessionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LoginSessionStatus" AS ENUM (
    'active',
    'logged_out',
    'expired',
    'revoked',
    'failed'
);


--
-- Name: MetricPeriod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MetricPeriod" AS ENUM (
    'daily',
    'weekly',
    'monthly'
);


--
-- Name: NoteVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NoteVisibility" AS ENUM (
    'team',
    'private',
    'hr_only'
);


--
-- Name: NotificationChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationChannel" AS ENUM (
    'email',
    'teams',
    'push',
    'sms'
);


--
-- Name: NotificationDeliveryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationDeliveryStatus" AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed',
    'cancelled'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'leave_submitted',
    'approval_required',
    'leave_approved',
    'leave_rejected',
    'leave_withdrawn',
    'leave_cancelled',
    'escalation_reminder',
    'ticket_created',
    'ticket_assigned',
    'ticket_updated',
    'ticket_employee_replied',
    'ticket_status_changed',
    'ticket_resolved',
    'ticket_reopened',
    'ticket_anonymous_created',
    'ticket_anonymous_updated',
    'recruitment_interview_scheduled',
    'recruitment_stage_changed',
    'recruitment_decision_pending',
    'recruitment_offer_approval',
    'recruitment_offer_released',
    'recruitment_duplicate_found',
    'recruitment_parse_ready',
    'recruitment_mention',
    'recruitment_converted',
    'recruitment_sla_stale'
);


--
-- Name: OfferStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OfferStatus" AS ENUM (
    'draft',
    'manager_approval',
    'hr_approval',
    'released',
    'accepted',
    'declined',
    'withdrawn'
);


--
-- Name: PayrollHrDecision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PayrollHrDecision" AS ENUM (
    'no_action',
    'apply_leave',
    'salary_deduction',
    'warning',
    'approved_exception'
);


--
-- Name: PreferredWorkMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PreferredWorkMode" AS ENUM (
    'remote',
    'hybrid',
    'onsite'
);


--
-- Name: RecruitmentCommunicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentCommunicationStatus" AS ENUM (
    'draft',
    'scheduled',
    'sent',
    'delivered',
    'failed',
    'cancelled'
);


--
-- Name: RecruitmentCommunicationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentCommunicationType" AS ENUM (
    'email_sent',
    'email_received',
    'interview_invitation',
    'interview_reminder',
    'offer_letter',
    'rejection',
    'internal_note',
    'system_notification'
);


--
-- Name: RecruitmentDocumentType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentDocumentType" AS ENUM (
    'resume',
    'cover_letter',
    'portfolio',
    'assessment',
    'offer_letter',
    'identity',
    'other'
);


--
-- Name: RecruitmentEmailTemplateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentEmailTemplateType" AS ENUM (
    'interview_invitation',
    'interview_reminder',
    'interview_cancelled',
    'interview_rescheduled',
    'offer_letter',
    'offer_reminder',
    'offer_expired',
    'rejection',
    'welcome',
    'general'
);


--
-- Name: RecruitmentPipelineStage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentPipelineStage" AS ENUM (
    'resume_received',
    'screening',
    'assessment',
    'hr_round',
    'technical_round',
    'team_lead_round',
    'manager_round',
    'client_round',
    'reference_check',
    'decision',
    'offer',
    'hired',
    'rejected',
    'on_hold',
    'withdrawn'
);


--
-- Name: RecruitmentTimelineEntityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecruitmentTimelineEntityType" AS ENUM (
    'job_opening',
    'candidate',
    'application',
    'interview',
    'offer',
    'intake'
);


--
-- Name: SavedFilterEntity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SavedFilterEntity" AS ENUM (
    'applications',
    'candidates',
    'jobs',
    'interviews',
    'offers',
    'reports'
);


--
-- Name: TicketCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketCategory" AS ENUM (
    'attendance',
    'leave',
    'payroll',
    'salary',
    'it_technical',
    'hr',
    'workplace',
    'facilities',
    'suggestion',
    'other'
);


--
-- Name: TicketMessageVisibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketMessageVisibility" AS ENUM (
    'public_update',
    'internal_note',
    'employee_reply'
);


--
-- Name: TicketPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketPriority" AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'new',
    'open',
    'in_progress',
    'waiting_for_employee',
    'on_hold',
    'resolved',
    'closed',
    'canceled'
);


--
-- Name: TicketType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TicketType" AS ENUM (
    'complaint',
    'service_request',
    'suggestion',
    'meeting_request',
    'anonymous_complaint',
    'other'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'super_admin',
    'hr',
    'employee',
    'manager'
);


--
-- Name: WorkerRunStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkerRunStatus" AS ENUM (
    'running',
    'idle',
    'error',
    'stopped'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: analytics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_snapshots (
    id text NOT NULL,
    snapshot_type text NOT NULL,
    scope public."AnalyticsScope" NOT NULL,
    scope_key text NOT NULL,
    payload text DEFAULT '{}'::text NOT NULL,
    period_start timestamp(3) without time zone NOT NULL,
    period_end timestamp(3) without time zone NOT NULL,
    generated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    correlation_id text
);


--
-- Name: anomaly_detections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomaly_detections (
    id text NOT NULL,
    anomaly_type text NOT NULL,
    severity public."AnomalySeverity" NOT NULL,
    scope public."AnalyticsScope" NOT NULL,
    scope_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    explanation text NOT NULL,
    metadata text DEFAULT '{}'::text NOT NULL,
    detected_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_at timestamp(3) without time zone,
    notified_at timestamp(3) without time zone
);


--
-- Name: application_stage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_stage_history (
    id text NOT NULL,
    application_id text NOT NULL,
    from_stage public."RecruitmentPipelineStage",
    to_stage public."RecruitmentPipelineStage" NOT NULL,
    note text,
    is_override boolean DEFAULT false NOT NULL,
    actor_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: approval_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_tokens (
    id text NOT NULL,
    leave_request_id integer NOT NULL,
    approval_step_id integer NOT NULL,
    approver_id integer,
    approver_user_id text,
    action public."ApprovalTokenAction" NOT NULL,
    token_hash text NOT NULL,
    status public."ApprovalTokenStatus" DEFAULT 'active'::public."ApprovalTokenStatus" NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    used_at timestamp(3) without time zone,
    revoked_at timestamp(3) without time zone,
    viewed_at timestamp(3) without time zone,
    created_by text,
    metadata text DEFAULT '{}'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_date_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_date_overrides (
    id integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type public."AttendanceOverrideType" NOT NULL,
    reason text,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_date_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_date_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_date_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_date_overrides_id_seq OWNED BY public.attendance_date_overrides.id;


--
-- Name: attendance_import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_import_jobs (
    id text NOT NULL,
    created_by_user_id text NOT NULL,
    status public."AttendanceImportJobStatus" DEFAULT 'UPLOADED'::public."AttendanceImportJobStatus" NOT NULL,
    file_name text NOT NULL,
    source text NOT NULL,
    report_type text,
    form_attendance_date timestamp(3) without time zone,
    total_rows integer NOT NULL,
    next_row_index integer DEFAULT 0 NOT NULL,
    imported_count integer DEFAULT 0 NOT NULL,
    skipped_count integer DEFAULT 0 NOT NULL,
    employees_created integer DEFAULT 0 NOT NULL,
    users_created integer DEFAULT 0 NOT NULL,
    warnings_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    error_message text,
    payload_compressed bytea NOT NULL,
    parser_version text NOT NULL,
    started_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    upload_id integer,
    attendance_date timestamp(3) without time zone NOT NULL,
    shift text,
    check_in text,
    check_out text,
    work_duration text,
    worked_minutes integer DEFAULT 0 NOT NULL,
    overtime_minutes integer DEFAULT 0 NOT NULL,
    status text NOT NULL,
    remarks text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_records_id_seq OWNED BY public.attendance_records.id;


--
-- Name: attendance_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_sessions (
    id integer NOT NULL,
    attendance_id integer NOT NULL,
    check_in text NOT NULL,
    check_out text,
    worked_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_sessions_id_seq OWNED BY public.attendance_sessions.id;


--
-- Name: attendance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_settings (
    id text DEFAULT 'default'::text NOT NULL,
    monday_working boolean DEFAULT true NOT NULL,
    tuesday_working boolean DEFAULT true NOT NULL,
    wednesday_working boolean DEFAULT true NOT NULL,
    thursday_working boolean DEFAULT true NOT NULL,
    friday_working boolean DEFAULT true NOT NULL,
    saturday_working boolean DEFAULT false NOT NULL,
    sunday_working boolean DEFAULT false NOT NULL,
    expected_work_minutes integer DEFAULT 480 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: attendance_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_uploads (
    id integer NOT NULL,
    file_name text NOT NULL,
    uploaded_by text,
    record_count integer DEFAULT 0 NOT NULL,
    uploaded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_uploads_id_seq OWNED BY public.attendance_uploads.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    actor_user_id text,
    actor_email text,
    metadata text DEFAULT '{}'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    employee_id integer,
    module text,
    description text,
    old_value jsonb,
    new_value jsonb,
    status text DEFAULT 'success'::text NOT NULL,
    ip_address text,
    browser text,
    device text,
    operating_system text,
    user_agent text
);


--
-- Name: candidate_ai_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_ai_insights (
    id text NOT NULL,
    candidate_id text NOT NULL,
    application_id text,
    insight_type public."AiInsightType" NOT NULL,
    status public."AiInsightStatus" DEFAULT 'pending_review'::public."AiInsightStatus" NOT NULL,
    title text,
    content_json jsonb NOT NULL,
    confidence double precision,
    model_id text,
    created_by_user_id text,
    reviewed_by_user_id text,
    reviewed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: candidate_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_certifications (
    id text NOT NULL,
    candidate_id text NOT NULL,
    name text NOT NULL,
    issuer text,
    issued_at timestamp(3) without time zone,
    expires_at timestamp(3) without time zone,
    credential_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    credential_url text,
    expiry_date timestamp(3) without time zone,
    issue_date timestamp(3) without time zone
);


--
-- Name: candidate_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_chat_messages (
    id text NOT NULL,
    candidate_id text NOT NULL,
    body text NOT NULL,
    author_user_id text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    promoted_note_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: candidate_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_documents (
    id text NOT NULL,
    candidate_id text NOT NULL,
    document_type public."RecruitmentDocumentType" NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes integer,
    storage_key text NOT NULL,
    checksum text,
    version integer DEFAULT 1 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    uploaded_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone,
    file_type text,
    size integer,
    storage_path text
);


--
-- Name: candidate_educations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_educations (
    id text NOT NULL,
    candidate_id text NOT NULL,
    institution text NOT NULL,
    degree text,
    field text,
    start_year integer,
    end_year integer,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    field_of_study text,
    grade text
);


--
-- Name: candidate_experiences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_experiences (
    id text NOT NULL,
    candidate_id text NOT NULL,
    company text NOT NULL,
    title text NOT NULL,
    location text,
    start_date timestamp(3) without time zone,
    end_date timestamp(3) without time zone,
    is_current boolean DEFAULT false NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    company_name text,
    currently_working boolean DEFAULT false,
    designation text,
    employment_type text
);


--
-- Name: candidate_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_notes (
    id text NOT NULL,
    candidate_id text NOT NULL,
    body text NOT NULL,
    visibility public."NoteVisibility" DEFAULT 'team'::public."NoteVisibility" NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    author_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    content text
);


--
-- Name: candidate_personal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_personal (
    candidate_id text NOT NULL,
    nationality text,
    current_location text,
    preferred_location text,
    notice_period text,
    availability_date timestamp(3) without time zone,
    linkedin_url text,
    portfolio_url text
);


--
-- Name: candidate_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_projects (
    id text NOT NULL,
    candidate_id text NOT NULL,
    title text NOT NULL,
    summary text,
    tech_stack text,
    url text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    description text,
    duration text,
    role text,
    technologies text
);


--
-- Name: candidate_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_skills (
    id text NOT NULL,
    candidate_id text NOT NULL,
    name text NOT NULL,
    proficiency text,
    is_confirmed boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    skill_name text,
    years_of_experience integer
);


--
-- Name: candidate_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_tags (
    candidate_id text NOT NULL,
    tag_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidates (
    id text NOT NULL,
    full_name text NOT NULL,
    preferred_name text,
    email text,
    phone text,
    alternate_phone text,
    location text,
    current_company text,
    current_title text,
    linkedin_url text,
    source public."CandidateSource" DEFAULT 'manual_upload'::public."CandidateSource" NOT NULL,
    status public."CandidateStatus" DEFAULT 'active'::public."CandidateStatus" NOT NULL,
    do_not_hire_reason text,
    current_ctc numeric(14,2),
    expected_ctc numeric(14,2),
    currency text DEFAULT 'INR'::text,
    notice_period_days integer,
    earliest_join_date timestamp(3) without time zone,
    availability_notes text,
    timezone text,
    primary_recruiter_user_id text,
    referred_by_employee_id integer,
    employee_id integer,
    merged_into_candidate_id text,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    archived_at timestamp(3) without time zone,
    date_of_birth timestamp(3) without time zone,
    first_name text,
    last_name text,
    normalized_email text,
    normalized_phone text,
    tenant_id text,
    professional_summary text,
    headline text,
    total_experience_years numeric(4,1),
    github_url text,
    preferred_work_mode public."PreferredWorkMode",
    willing_to_relocate boolean
);


--
-- Name: employee_conversion_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_conversion_snapshots (
    id text NOT NULL,
    application_id text NOT NULL,
    candidate_id text NOT NULL,
    offer_id text NOT NULL,
    employee_id integer NOT NULL,
    field_map_version text NOT NULL,
    mapped_fields jsonb NOT NULL,
    override_reason text,
    converted_by_user_id text NOT NULL,
    converted_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_balances (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    el_balance double precision DEFAULT 0 NOT NULL,
    cl_balance double precision DEFAULT 0 NOT NULL,
    sl_balance double precision DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: employee_leave_balances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_leave_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_leave_balances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_leave_balances_id_seq OWNED BY public.employee_leave_balances.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    employee_code text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    department text,
    designation text,
    shift text,
    joining_date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    employee_status text DEFAULT 'Active'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    manager_id integer,
    cached_presence text,
    cached_presence_at timestamp(3) without time zone,
    external_profile_synced_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    first_name text,
    last_name text,
    preferred_name text,
    gender text,
    date_of_birth timestamp(3) without time zone,
    alternate_phone text,
    address text,
    emergency_contact text,
    employment_type text,
    work_location text
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: hiring_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_decisions (
    id text NOT NULL,
    application_id text NOT NULL,
    outcome public."HiringDecisionOutcome" NOT NULL,
    rationale text NOT NULL,
    strengths text NOT NULL,
    concerns text,
    salary_recommendation numeric(14,2),
    currency text,
    risk_tags_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    decided_by_user_id text NOT NULL,
    decided_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: hiring_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_team_members (
    id text NOT NULL,
    job_opening_id text NOT NULL,
    employee_id integer NOT NULL,
    role public."HiringTeamRole" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id integer NOT NULL,
    name text NOT NULL,
    holiday_date timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;


--
-- Name: integration_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_jobs (
    id text NOT NULL,
    job_type text NOT NULL,
    status public."IntegrationJobStatus" DEFAULT 'pending'::public."IntegrationJobStatus" NOT NULL,
    payload text DEFAULT '{}'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    correlation_id text,
    scheduled_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    locked_at timestamp(3) without time zone,
    locked_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: integration_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_settings (
    id text DEFAULT 'default'::text NOT NULL,
    teams_webhook_url text,
    teams_approvals_enabled boolean DEFAULT true NOT NULL,
    calendar_sync_enabled boolean DEFAULT true NOT NULL,
    org_sync_enabled boolean DEFAULT false NOT NULL,
    org_sync_policy text DEFAULT '{}'::text NOT NULL,
    escalation_hours integer DEFAULT 24 NOT NULL,
    graph_last_health_at timestamp(3) without time zone,
    graph_last_health_status text,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: interview_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_attachments (
    id text NOT NULL,
    interview_id text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes integer,
    storage_key text NOT NULL,
    uploaded_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: interview_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_feedback (
    id text NOT NULL,
    interview_id text NOT NULL,
    author_employee_id integer NOT NULL,
    overall_rating double precision,
    ratings_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    recommendation text,
    strengths text,
    concerns text,
    private_notes text,
    submitted_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: interview_panelists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_panelists (
    id text NOT NULL,
    interview_id text NOT NULL,
    employee_id integer NOT NULL,
    is_observer boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: job_opening_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_opening_documents (
    id text NOT NULL,
    job_opening_id text NOT NULL,
    document_type public."RecruitmentDocumentType" DEFAULT 'other'::public."RecruitmentDocumentType" NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes integer,
    storage_key text NOT NULL,
    checksum text,
    uploaded_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: job_opening_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_opening_notes (
    id text NOT NULL,
    job_opening_id text NOT NULL,
    body text NOT NULL,
    visibility public."NoteVisibility" DEFAULT 'team'::public."NoteVisibility" NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    author_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: job_opening_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_opening_stages (
    id text NOT NULL,
    job_opening_id text NOT NULL,
    stage public."RecruitmentPipelineStage" NOT NULL,
    sort_order integer NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    label text,
    sla_days integer
);


--
-- Name: job_openings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_openings (
    id text NOT NULL,
    title text NOT NULL,
    code text,
    status public."JobOpeningStatus" DEFAULT 'draft'::public."JobOpeningStatus" NOT NULL,
    department text,
    location text,
    work_mode text,
    employment_type public."JobEmploymentType" DEFAULT 'full_time'::public."JobEmploymentType" NOT NULL,
    description text,
    requirements text,
    openings_count integer DEFAULT 1 NOT NULL,
    headcount_approved boolean DEFAULT false NOT NULL,
    headcount_requested_by_employee_id integer,
    headcount_requested_at timestamp(3) without time zone,
    headcount_urgency text,
    compensation_currency text,
    compensation_min numeric(14,2),
    compensation_max numeric(14,2),
    target_start_date timestamp(3) without time zone,
    pipeline_template_id text,
    owner_recruiter_user_id text,
    published_at timestamp(3) without time zone,
    closed_at timestamp(3) without time zone,
    filled_at timestamp(3) without time zone,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: leave_approval_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_approval_steps (
    id integer NOT NULL,
    leave_request_id integer NOT NULL,
    step_order integer NOT NULL,
    approver_id integer,
    approver_role public."ApproverRole" NOT NULL,
    status public."ApprovalStepStatus" DEFAULT 'pending'::public."ApprovalStepStatus" NOT NULL,
    acted_at timestamp(3) without time zone,
    acted_by_user_id text,
    comment text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: leave_approval_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_approval_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_approval_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_approval_steps_id_seq OWNED BY public.leave_approval_steps.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type text DEFAULT 'CL'::text NOT NULL,
    start_date timestamp(3) without time zone NOT NULL,
    end_date timestamp(3) without time zone NOT NULL,
    days double precision DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    status public."LeaveRequestStatus" DEFAULT 'pending'::public."LeaveRequestStatus" NOT NULL,
    workflow_status public."LeaveWorkflowStatus" DEFAULT 'pending_approval'::public."LeaveWorkflowStatus" NOT NULL,
    submitted_at timestamp(3) without time zone,
    current_step_id integer,
    rejection_reason text,
    cancelled_at timestamp(3) without time zone,
    withdrawn_at timestamp(3) without time zone,
    final_approved_at timestamp(3) without time zone,
    reviewed_by text,
    reviewed_at timestamp(3) without time zone,
    version integer DEFAULT 0 NOT NULL,
    external_calendar_event_id text,
    calendar_sync_status public."CalendarSyncStatus" DEFAULT 'pending'::public."CalendarSyncStatus" NOT NULL,
    calendar_last_synced_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_transactions (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type text NOT NULL,
    transaction_type text NOT NULL,
    amount double precision NOT NULL,
    reason text,
    created_by text,
    leave_request_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: leave_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_transactions_id_seq OWNED BY public.leave_transactions.id;


--
-- Name: login_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_sessions (
    id text NOT NULL,
    user_id text,
    employee_id integer,
    attempted_email text,
    login_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    logout_at timestamp(3) without time zone,
    last_activity_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."LoginSessionStatus" DEFAULT 'active'::public."LoginSessionStatus" NOT NULL,
    ip_address text,
    browser text,
    browser_version text,
    device text,
    operating_system text,
    user_agent text,
    session_token text,
    session_duration integer,
    failure_reason text,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id text NOT NULL,
    user_id text NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    teams_notifications_enabled boolean DEFAULT true NOT NULL,
    teams_approval_cards_enabled boolean DEFAULT true NOT NULL,
    calendar_sync_enabled boolean DEFAULT true NOT NULL,
    future_teams_enabled boolean DEFAULT true NOT NULL,
    future_push_enabled boolean DEFAULT true NOT NULL,
    leave_approval_alerts boolean DEFAULT true NOT NULL,
    leave_status_alerts boolean DEFAULT true NOT NULL,
    escalation_alerts boolean DEFAULT true NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    type public."NotificationType" NOT NULL,
    channel public."NotificationChannel" NOT NULL,
    recipient text NOT NULL,
    subject text NOT NULL,
    payload text DEFAULT '{}'::text NOT NULL,
    status public."NotificationDeliveryStatus" DEFAULT 'pending'::public."NotificationDeliveryStatus" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    correlation_id text,
    scheduled_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_at timestamp(3) without time zone,
    locked_at timestamp(3) without time zone,
    locked_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: offer_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_revisions (
    id text NOT NULL,
    offer_id text NOT NULL,
    version integer NOT NULL,
    snapshot_json jsonb NOT NULL,
    change_note text,
    actor_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payroll_attendance_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_attendance_summaries (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    payroll_period_start timestamp(3) without time zone NOT NULL,
    payroll_period_end timestamp(3) without time zone NOT NULL,
    working_days integer DEFAULT 0 NOT NULL,
    required_minutes integer DEFAULT 0 NOT NULL,
    actual_minutes integer DEFAULT 0 NOT NULL,
    shortfall_minutes integer DEFAULT 0 NOT NULL,
    ot_minutes integer DEFAULT 0 NOT NULL,
    leave_days double precision DEFAULT 0 NOT NULL,
    absent_days integer DEFAULT 0 NOT NULL,
    late_count integer DEFAULT 0 NOT NULL,
    recommended_deduction text,
    hr_decision public."PayrollHrDecision" DEFAULT 'no_action'::public."PayrollHrDecision" NOT NULL,
    remarks text,
    computed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: payroll_attendance_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_attendance_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_attendance_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_attendance_summaries_id_seq OWNED BY public.payroll_attendance_summaries.id;


--
-- Name: payroll_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_settings (
    id text DEFAULT 'default'::text NOT NULL,
    payroll_start_day integer DEFAULT 25 NOT NULL,
    required_work_minutes integer DEFAULT 480 NOT NULL,
    break_minutes integer DEFAULT 60 NOT NULL,
    required_office_minutes integer DEFAULT 540 NOT NULL,
    ot_threshold_minutes integer DEFAULT 0 NOT NULL,
    half_day_threshold_minutes integer DEFAULT 240 NOT NULL,
    grace_minutes integer DEFAULT 15 NOT NULL,
    shift_rules_json text DEFAULT '{}'::text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: recruitment_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_applications (
    id text NOT NULL,
    candidate_id text NOT NULL,
    job_opening_id text NOT NULL,
    status public."ApplicationStatus" DEFAULT 'active'::public."ApplicationStatus" NOT NULL,
    current_stage public."RecruitmentPipelineStage" DEFAULT 'resume_received'::public."RecruitmentPipelineStage" NOT NULL,
    stage_entered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    priority public."ApplicationPriority" DEFAULT 'normal'::public."ApplicationPriority" NOT NULL,
    assigned_recruiter_user_id text,
    assigned_manager_employee_id integer,
    source public."CandidateSource",
    risk_flags_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    aggregate_score double precision,
    rejected_reason text,
    hold_reason text,
    withdrawn_reason text,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone,
    assessment text,
    assessment_updated_at timestamp(3) without time zone,
    assessment_updated_by_user_id text
);


--
-- Name: recruitment_communication_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_communication_attachments (
    id text NOT NULL,
    communication_id text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    storage_path text NOT NULL,
    uploaded_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: recruitment_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_communications (
    id text NOT NULL,
    type public."RecruitmentCommunicationType" NOT NULL,
    status public."RecruitmentCommunicationStatus" DEFAULT 'draft'::public."RecruitmentCommunicationStatus" NOT NULL,
    subject text,
    body text,
    candidate_id text,
    application_id text,
    job_opening_id text,
    interview_id text,
    offer_id text,
    template_id text,
    sender_user_id text,
    recipient_email text,
    thread_id text,
    parent_id text,
    sent_at timestamp(3) without time zone,
    delivered_at timestamp(3) without time zone,
    scheduled_for timestamp(3) without time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: recruitment_email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_email_templates (
    id text NOT NULL,
    name text NOT NULL,
    type public."RecruitmentEmailTemplateType" NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: recruitment_intake_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_intake_items (
    id text NOT NULL,
    status public."IntakeItemStatus" DEFAULT 'received'::public."IntakeItemStatus" NOT NULL,
    source public."CandidateSource" NOT NULL,
    raw_payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    file_name text,
    storage_key text,
    candidate_id text,
    job_opening_id text,
    duplicate_of_candidate_id text,
    duplicate_confidence double precision,
    error_message text,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: recruitment_interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_interviews (
    id text NOT NULL,
    application_id text NOT NULL,
    round_type public."InterviewRoundType" NOT NULL,
    status public."InterviewStatus" DEFAULT 'draft'::public."InterviewStatus" NOT NULL,
    title text,
    scheduled_start timestamp(3) without time zone,
    scheduled_end timestamp(3) without time zone,
    timezone text,
    location text,
    meeting_url text,
    transcript_text text,
    recording_url text,
    summary text,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: recruitment_metric_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_metric_snapshots (
    id text NOT NULL,
    metric_key text NOT NULL,
    scope_type text NOT NULL,
    scope_key text NOT NULL,
    period_start timestamp(3) without time zone NOT NULL,
    period_end timestamp(3) without time zone NOT NULL,
    value double precision NOT NULL,
    payload_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    computed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: recruitment_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_offers (
    id text NOT NULL,
    application_id text NOT NULL,
    hiring_decision_id text NOT NULL,
    status public."OfferStatus" DEFAULT 'draft'::public."OfferStatus" NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    base_salary numeric(14,2) NOT NULL,
    variable_pay numeric(14,2),
    benefits_notes text,
    proposed_start_date timestamp(3) without time zone,
    expires_at timestamp(3) without time zone,
    manager_approval_skipped boolean DEFAULT false NOT NULL,
    manager_approved_by_user_id text,
    manager_approved_at timestamp(3) without time zone,
    hr_approved_by_user_id text,
    hr_approved_at timestamp(3) without time zone,
    released_at timestamp(3) without time zone,
    accepted_at timestamp(3) without time zone,
    declined_at timestamp(3) without time zone,
    withdrawn_at timestamp(3) without time zone,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    offer_number text,
    employment_type text,
    department text,
    location text,
    grade text,
    reporting_manager_id integer,
    joining_date timestamp(3) without time zone,
    ctc numeric(14,2),
    salary_breakdown_json jsonb,
    bonus numeric(14,2),
    stock text,
    probation_days integer,
    notice_buyout boolean DEFAULT false NOT NULL,
    offer_pdf_key text,
    offer_notes text,
    sent_at timestamp(3) without time zone
);


--
-- Name: recruitment_pipeline_template_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_pipeline_template_stages (
    id text NOT NULL,
    template_id text NOT NULL,
    stage public."RecruitmentPipelineStage" NOT NULL,
    sort_order integer NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    label text,
    sla_days integer
);


--
-- Name: recruitment_pipeline_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_pipeline_templates (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    deleted_at timestamp(3) without time zone
);


--
-- Name: recruitment_saved_filters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_saved_filters (
    id text NOT NULL,
    user_id text NOT NULL,
    entity public."SavedFilterEntity" NOT NULL,
    name text NOT NULL,
    filter_json jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: recruitment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_settings (
    id text DEFAULT 'default'::text NOT NULL,
    default_pipeline_template_id text,
    sla_days_per_stage_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    ai_enabled boolean DEFAULT true NOT NULL,
    require_decision_for_offer boolean DEFAULT true NOT NULL,
    skip_manager_approval_if_no_hm boolean DEFAULT true NOT NULL,
    hm_compensation_visible boolean DEFAULT true NOT NULL,
    allow_duplicate_active_app boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: recruitment_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_tags (
    id text NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: recruitment_timeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_timeline_events (
    id text NOT NULL,
    entity_type public."RecruitmentTimelineEntityType" NOT NULL,
    entity_id text NOT NULL,
    application_id text,
    candidate_id text,
    job_opening_id text,
    event_type text NOT NULL,
    summary text NOT NULL,
    actor_user_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: talent_pool_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.talent_pool_entries (
    id text NOT NULL,
    candidate_id text NOT NULL,
    reason text,
    source_application_id text,
    entered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    exited_at timestamp(3) without time zone,
    created_by_user_id text
);


--
-- Name: ticket_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_history (
    id text NOT NULL,
    ticket_id text NOT NULL,
    action text NOT NULL,
    field_changed text,
    old_value text,
    new_value text,
    actor_user_id text NOT NULL,
    metadata text DEFAULT '{}'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_messages (
    id text NOT NULL,
    ticket_id text NOT NULL,
    visibility public."TicketMessageVisibility" NOT NULL,
    body text NOT NULL,
    author_user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id text NOT NULL,
    ticket_number text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    category public."TicketCategory" NOT NULL,
    type public."TicketType" NOT NULL,
    priority public."TicketPriority" DEFAULT 'medium'::public."TicketPriority" NOT NULL,
    status public."TicketStatus" DEFAULT 'new'::public."TicketStatus" NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    raised_by_employee_id integer NOT NULL,
    department text,
    assigned_to_user_id text,
    resolution_notes text,
    resolved_at timestamp(3) without time zone,
    closed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text,
    role public."UserRole" DEFAULT 'employee'::public."UserRole" NOT NULL,
    auth_provider public."AuthProvider" DEFAULT 'local'::public."AuthProvider" NOT NULL,
    azure_oid text,
    microsoft_tenant_id text,
    last_login_at timestamp(3) without time zone,
    profile_photo_url text,
    auth_metadata text DEFAULT '{}'::text NOT NULL,
    session_version integer DEFAULT 1 NOT NULL,
    "employeeId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    username text,
    account_status public."AccountStatus" DEFAULT 'active'::public."AccountStatus" NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    locked_at timestamp(3) without time zone,
    locked_reason text,
    recruitment_ops_access boolean DEFAULT false NOT NULL
);


--
-- Name: worker_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_heartbeats (
    worker_name text NOT NULL,
    status public."WorkerRunStatus" DEFAULT 'idle'::public."WorkerRunStatus" NOT NULL,
    last_beat_at timestamp(3) without time zone NOT NULL,
    last_run_at timestamp(3) without time zone,
    last_duration_ms integer,
    last_result text,
    last_error text,
    runs_total integer DEFAULT 0 NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: workflow_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_escalations (
    id text NOT NULL,
    leave_request_id integer NOT NULL,
    approval_step_id integer NOT NULL,
    escalation_type text NOT NULL,
    metadata text DEFAULT '{}'::text NOT NULL,
    sent_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workforce_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workforce_metrics (
    id text NOT NULL,
    scope public."AnalyticsScope" NOT NULL,
    scope_key text NOT NULL,
    metric_key text NOT NULL,
    period public."MetricPeriod" NOT NULL,
    period_start timestamp(3) without time zone NOT NULL,
    period_end timestamp(3) without time zone NOT NULL,
    value double precision NOT NULL,
    metadata text DEFAULT '{}'::text NOT NULL,
    computed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attendance_date_overrides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_date_overrides ALTER COLUMN id SET DEFAULT nextval('public.attendance_date_overrides_id_seq'::regclass);


--
-- Name: attendance_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records ALTER COLUMN id SET DEFAULT nextval('public.attendance_records_id_seq'::regclass);


--
-- Name: attendance_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions ALTER COLUMN id SET DEFAULT nextval('public.attendance_sessions_id_seq'::regclass);


--
-- Name: attendance_uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_uploads ALTER COLUMN id SET DEFAULT nextval('public.attendance_uploads_id_seq'::regclass);


--
-- Name: employee_leave_balances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances ALTER COLUMN id SET DEFAULT nextval('public.employee_leave_balances_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);


--
-- Name: leave_approval_steps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_approval_steps ALTER COLUMN id SET DEFAULT nextval('public.leave_approval_steps_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions ALTER COLUMN id SET DEFAULT nextval('public.leave_transactions_id_seq'::regclass);


--
-- Name: payroll_attendance_summaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_attendance_summaries ALTER COLUMN id SET DEFAULT nextval('public.payroll_attendance_summaries_id_seq'::regclass);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: analytics_snapshots analytics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_snapshots
    ADD CONSTRAINT analytics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: anomaly_detections anomaly_detections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomaly_detections
    ADD CONSTRAINT anomaly_detections_pkey PRIMARY KEY (id);


--
-- Name: application_stage_history application_stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_stage_history
    ADD CONSTRAINT application_stage_history_pkey PRIMARY KEY (id);


--
-- Name: approval_tokens approval_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_tokens
    ADD CONSTRAINT approval_tokens_pkey PRIMARY KEY (id);


--
-- Name: attendance_date_overrides attendance_date_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_date_overrides
    ADD CONSTRAINT attendance_date_overrides_pkey PRIMARY KEY (id);


--
-- Name: attendance_import_jobs attendance_import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_import_jobs
    ADD CONSTRAINT attendance_import_jobs_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_sessions attendance_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_pkey PRIMARY KEY (id);


--
-- Name: attendance_settings attendance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (id);


--
-- Name: attendance_uploads attendance_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_uploads
    ADD CONSTRAINT attendance_uploads_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: candidate_ai_insights candidate_ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_ai_insights
    ADD CONSTRAINT candidate_ai_insights_pkey PRIMARY KEY (id);


--
-- Name: candidate_certifications candidate_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_certifications
    ADD CONSTRAINT candidate_certifications_pkey PRIMARY KEY (id);


--
-- Name: candidate_chat_messages candidate_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_chat_messages
    ADD CONSTRAINT candidate_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: candidate_documents candidate_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_documents
    ADD CONSTRAINT candidate_documents_pkey PRIMARY KEY (id);


--
-- Name: candidate_educations candidate_educations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_educations
    ADD CONSTRAINT candidate_educations_pkey PRIMARY KEY (id);


--
-- Name: candidate_experiences candidate_experiences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_experiences
    ADD CONSTRAINT candidate_experiences_pkey PRIMARY KEY (id);


--
-- Name: candidate_notes candidate_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_notes
    ADD CONSTRAINT candidate_notes_pkey PRIMARY KEY (id);


--
-- Name: candidate_personal candidate_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_personal
    ADD CONSTRAINT candidate_personal_pkey PRIMARY KEY (candidate_id);


--
-- Name: candidate_projects candidate_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_projects
    ADD CONSTRAINT candidate_projects_pkey PRIMARY KEY (id);


--
-- Name: candidate_skills candidate_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_pkey PRIMARY KEY (id);


--
-- Name: candidate_tags candidate_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_tags
    ADD CONSTRAINT candidate_tags_pkey PRIMARY KEY (candidate_id, tag_id);


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: hiring_decisions hiring_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_decisions
    ADD CONSTRAINT hiring_decisions_pkey PRIMARY KEY (id);


--
-- Name: hiring_team_members hiring_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_team_members
    ADD CONSTRAINT hiring_team_members_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: integration_jobs integration_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_jobs
    ADD CONSTRAINT integration_jobs_pkey PRIMARY KEY (id);


--
-- Name: integration_settings integration_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_settings
    ADD CONSTRAINT integration_settings_pkey PRIMARY KEY (id);


--
-- Name: interview_attachments interview_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attachments
    ADD CONSTRAINT interview_attachments_pkey PRIMARY KEY (id);


--
-- Name: interview_feedback interview_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_pkey PRIMARY KEY (id);


--
-- Name: interview_panelists interview_panelists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panelists
    ADD CONSTRAINT interview_panelists_pkey PRIMARY KEY (id);


--
-- Name: job_opening_documents job_opening_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_documents
    ADD CONSTRAINT job_opening_documents_pkey PRIMARY KEY (id);


--
-- Name: job_opening_notes job_opening_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_notes
    ADD CONSTRAINT job_opening_notes_pkey PRIMARY KEY (id);


--
-- Name: job_opening_stages job_opening_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_stages
    ADD CONSTRAINT job_opening_stages_pkey PRIMARY KEY (id);


--
-- Name: job_openings job_openings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_openings
    ADD CONSTRAINT job_openings_pkey PRIMARY KEY (id);


--
-- Name: leave_approval_steps leave_approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_approval_steps
    ADD CONSTRAINT leave_approval_steps_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_transactions leave_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_pkey PRIMARY KEY (id);


--
-- Name: login_sessions login_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offer_revisions offer_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_revisions
    ADD CONSTRAINT offer_revisions_pkey PRIMARY KEY (id);


--
-- Name: payroll_attendance_summaries payroll_attendance_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_attendance_summaries
    ADD CONSTRAINT payroll_attendance_summaries_pkey PRIMARY KEY (id);


--
-- Name: payroll_settings payroll_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_settings
    ADD CONSTRAINT payroll_settings_pkey PRIMARY KEY (id);


--
-- Name: recruitment_applications recruitment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_pkey PRIMARY KEY (id);


--
-- Name: recruitment_communication_attachments recruitment_communication_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communication_attachments
    ADD CONSTRAINT recruitment_communication_attachments_pkey PRIMARY KEY (id);


--
-- Name: recruitment_communications recruitment_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_pkey PRIMARY KEY (id);


--
-- Name: recruitment_email_templates recruitment_email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_email_templates
    ADD CONSTRAINT recruitment_email_templates_pkey PRIMARY KEY (id);


--
-- Name: recruitment_intake_items recruitment_intake_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_intake_items
    ADD CONSTRAINT recruitment_intake_items_pkey PRIMARY KEY (id);


--
-- Name: recruitment_interviews recruitment_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_interviews
    ADD CONSTRAINT recruitment_interviews_pkey PRIMARY KEY (id);


--
-- Name: recruitment_metric_snapshots recruitment_metric_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_metric_snapshots
    ADD CONSTRAINT recruitment_metric_snapshots_pkey PRIMARY KEY (id);


--
-- Name: recruitment_offers recruitment_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_offers
    ADD CONSTRAINT recruitment_offers_pkey PRIMARY KEY (id);


--
-- Name: recruitment_pipeline_template_stages recruitment_pipeline_template_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_pipeline_template_stages
    ADD CONSTRAINT recruitment_pipeline_template_stages_pkey PRIMARY KEY (id);


--
-- Name: recruitment_pipeline_templates recruitment_pipeline_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_pipeline_templates
    ADD CONSTRAINT recruitment_pipeline_templates_pkey PRIMARY KEY (id);


--
-- Name: recruitment_saved_filters recruitment_saved_filters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_saved_filters
    ADD CONSTRAINT recruitment_saved_filters_pkey PRIMARY KEY (id);


--
-- Name: recruitment_settings recruitment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_settings
    ADD CONSTRAINT recruitment_settings_pkey PRIMARY KEY (id);


--
-- Name: recruitment_tags recruitment_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_tags
    ADD CONSTRAINT recruitment_tags_pkey PRIMARY KEY (id);


--
-- Name: recruitment_timeline_events recruitment_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_timeline_events
    ADD CONSTRAINT recruitment_timeline_events_pkey PRIMARY KEY (id);


--
-- Name: talent_pool_entries talent_pool_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.talent_pool_entries
    ADD CONSTRAINT talent_pool_entries_pkey PRIMARY KEY (id);


--
-- Name: ticket_history ticket_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);


--
-- Name: ticket_messages ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: worker_heartbeats worker_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_heartbeats
    ADD CONSTRAINT worker_heartbeats_pkey PRIMARY KEY (worker_name);


--
-- Name: workflow_escalations workflow_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_escalations
    ADD CONSTRAINT workflow_escalations_pkey PRIMARY KEY (id);


--
-- Name: workforce_metrics workforce_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workforce_metrics
    ADD CONSTRAINT workforce_metrics_pkey PRIMARY KEY (id);


--
-- Name: analytics_snapshots_scope_scope_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_snapshots_scope_scope_key_idx ON public.analytics_snapshots USING btree (scope, scope_key);


--
-- Name: analytics_snapshots_snapshot_type_generated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_snapshots_snapshot_type_generated_at_idx ON public.analytics_snapshots USING btree (snapshot_type, generated_at);


--
-- Name: anomaly_detections_anomaly_type_resolved_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anomaly_detections_anomaly_type_resolved_at_idx ON public.anomaly_detections USING btree (anomaly_type, resolved_at);


--
-- Name: anomaly_detections_detected_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anomaly_detections_detected_at_idx ON public.anomaly_detections USING btree (detected_at);


--
-- Name: anomaly_detections_scope_scope_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX anomaly_detections_scope_scope_key_idx ON public.anomaly_detections USING btree (scope, scope_key);


--
-- Name: application_stage_history_application_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_stage_history_application_id_created_at_idx ON public.application_stage_history USING btree (application_id, created_at);


--
-- Name: application_stage_history_to_stage_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_stage_history_to_stage_created_at_idx ON public.application_stage_history USING btree (to_stage, created_at);


--
-- Name: approval_tokens_approval_step_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tokens_approval_step_id_idx ON public.approval_tokens USING btree (approval_step_id);


--
-- Name: approval_tokens_approver_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tokens_approver_id_idx ON public.approval_tokens USING btree (approver_id);


--
-- Name: approval_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tokens_expires_at_idx ON public.approval_tokens USING btree (expires_at);


--
-- Name: approval_tokens_leave_request_id_approval_step_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tokens_leave_request_id_approval_step_id_idx ON public.approval_tokens USING btree (leave_request_id, approval_step_id);


--
-- Name: approval_tokens_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_tokens_token_hash_idx ON public.approval_tokens USING btree (token_hash);


--
-- Name: approval_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX approval_tokens_token_hash_key ON public.approval_tokens USING btree (token_hash);


--
-- Name: attendance_date_overrides_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_date_overrides_date_idx ON public.attendance_date_overrides USING btree (date);


--
-- Name: attendance_date_overrides_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_date_overrides_date_key ON public.attendance_date_overrides USING btree (date);


--
-- Name: attendance_import_jobs_created_by_user_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_import_jobs_created_by_user_id_status_created_at_idx ON public.attendance_import_jobs USING btree (created_by_user_id, status, created_at);


--
-- Name: attendance_records_attendance_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_records_attendance_date_idx ON public.attendance_records USING btree (attendance_date);


--
-- Name: attendance_records_employee_id_attendance_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_records_employee_id_attendance_date_key ON public.attendance_records USING btree (employee_id, attendance_date);


--
-- Name: attendance_sessions_attendance_id_check_out_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_sessions_attendance_id_check_out_idx ON public.attendance_sessions USING btree (attendance_id, check_out);


--
-- Name: attendance_sessions_attendance_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_sessions_attendance_id_idx ON public.attendance_sessions USING btree (attendance_id);


--
-- Name: attendance_sessions_one_open_per_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_sessions_one_open_per_day_idx ON public.attendance_sessions USING btree (attendance_id) WHERE (check_out IS NULL);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_user_id_idx ON public.audit_logs USING btree (actor_user_id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_employee_id_idx ON public.audit_logs USING btree (employee_id);


--
-- Name: audit_logs_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_entity_type_entity_id_idx ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: audit_logs_module_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_module_action_idx ON public.audit_logs USING btree (module, action);


--
-- Name: candidate_ai_insights_candidate_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_ai_insights_candidate_id_status_idx ON public.candidate_ai_insights USING btree (candidate_id, status);


--
-- Name: candidate_ai_insights_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_ai_insights_created_at_idx ON public.candidate_ai_insights USING btree (created_at);


--
-- Name: candidate_ai_insights_insight_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_ai_insights_insight_type_status_idx ON public.candidate_ai_insights USING btree (insight_type, status);


--
-- Name: candidate_ai_insights_one_pending_recovery_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidate_ai_insights_one_pending_recovery_uidx ON public.candidate_ai_insights USING btree (candidate_id) WHERE ((insight_type = 'resume_field_recovery'::public."AiInsightType") AND (status = 'pending_review'::public."AiInsightStatus"));


--
-- Name: candidate_ai_insights_one_pending_summary_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidate_ai_insights_one_pending_summary_uidx ON public.candidate_ai_insights USING btree (candidate_id) WHERE ((insight_type = 'candidate_summary'::public."AiInsightType") AND (status = 'pending_review'::public."AiInsightStatus"));


--
-- Name: candidate_certifications_candidate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_certifications_candidate_id_idx ON public.candidate_certifications USING btree (candidate_id);


--
-- Name: candidate_chat_messages_candidate_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_chat_messages_candidate_id_created_at_idx ON public.candidate_chat_messages USING btree (candidate_id, created_at);


--
-- Name: candidate_chat_messages_candidate_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_chat_messages_candidate_id_deleted_at_idx ON public.candidate_chat_messages USING btree (candidate_id, deleted_at);


--
-- Name: candidate_documents_candidate_id_document_type_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_documents_candidate_id_document_type_deleted_at_idx ON public.candidate_documents USING btree (candidate_id, document_type, deleted_at);


--
-- Name: candidate_documents_candidate_id_is_primary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_documents_candidate_id_is_primary_idx ON public.candidate_documents USING btree (candidate_id, is_primary);


--
-- Name: candidate_documents_one_primary_resume; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidate_documents_one_primary_resume ON public.candidate_documents USING btree (candidate_id) WHERE ((document_type = 'resume'::public."RecruitmentDocumentType") AND (is_primary = true) AND (deleted_at IS NULL));


--
-- Name: candidate_educations_candidate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_educations_candidate_id_idx ON public.candidate_educations USING btree (candidate_id);


--
-- Name: candidate_experiences_candidate_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_experiences_candidate_id_sort_order_idx ON public.candidate_experiences USING btree (candidate_id, sort_order);


--
-- Name: candidate_notes_candidate_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_notes_candidate_id_deleted_at_idx ON public.candidate_notes USING btree (candidate_id, deleted_at);


--
-- Name: candidate_notes_candidate_id_is_pinned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_notes_candidate_id_is_pinned_idx ON public.candidate_notes USING btree (candidate_id, is_pinned);


--
-- Name: candidate_projects_candidate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_projects_candidate_id_idx ON public.candidate_projects USING btree (candidate_id);


--
-- Name: candidate_skills_candidate_id_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidate_skills_candidate_id_name_key ON public.candidate_skills USING btree (candidate_id, name);


--
-- Name: candidate_skills_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_skills_name_idx ON public.candidate_skills USING btree (name);


--
-- Name: candidate_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_tags_tag_id_idx ON public.candidate_tags USING btree (tag_id);


--
-- Name: candidates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_created_at_idx ON public.candidates USING btree (created_at);


--
-- Name: candidates_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_deleted_at_idx ON public.candidates USING btree (deleted_at);


--
-- Name: candidates_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_email_idx ON public.candidates USING btree (email);


--
-- Name: candidates_email_live_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidates_email_live_unique ON public.candidates USING btree (lower(email)) WHERE ((deleted_at IS NULL) AND (email IS NOT NULL) AND (merged_into_candidate_id IS NULL));


--
-- Name: candidates_employee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX candidates_employee_id_key ON public.candidates USING btree (employee_id);


--
-- Name: candidates_full_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_full_name_idx ON public.candidates USING btree (full_name);


--
-- Name: candidates_normalized_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_normalized_email_idx ON public.candidates USING btree (normalized_email);


--
-- Name: candidates_normalized_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_normalized_phone_idx ON public.candidates USING btree (normalized_phone);


--
-- Name: candidates_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_phone_idx ON public.candidates USING btree (phone);


--
-- Name: candidates_primary_recruiter_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_primary_recruiter_user_id_idx ON public.candidates USING btree (primary_recruiter_user_id);


--
-- Name: candidates_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_source_idx ON public.candidates USING btree (source);


--
-- Name: candidates_status_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_status_deleted_at_idx ON public.candidates USING btree (status, deleted_at);


--
-- Name: candidates_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_tenant_id_idx ON public.candidates USING btree (tenant_id);


--
-- Name: employee_conversion_snapshots_application_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_conversion_snapshots_application_id_key ON public.employee_conversion_snapshots USING btree (application_id);


--
-- Name: employee_conversion_snapshots_candidate_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_conversion_snapshots_candidate_id_key ON public.employee_conversion_snapshots USING btree (candidate_id);


--
-- Name: employee_conversion_snapshots_converted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_conversion_snapshots_converted_at_idx ON public.employee_conversion_snapshots USING btree (converted_at);


--
-- Name: employee_conversion_snapshots_employee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_conversion_snapshots_employee_id_key ON public.employee_conversion_snapshots USING btree (employee_id);


--
-- Name: employee_conversion_snapshots_offer_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_conversion_snapshots_offer_id_key ON public.employee_conversion_snapshots USING btree (offer_id);


--
-- Name: employee_leave_balances_employee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_leave_balances_employee_id_key ON public.employee_leave_balances USING btree (employee_id);


--
-- Name: employees_employee_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employees_employee_code_key ON public.employees USING btree (employee_code);


--
-- Name: employees_employee_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employees_employee_status_idx ON public.employees USING btree (employee_status);


--
-- Name: employees_manager_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employees_manager_id_idx ON public.employees USING btree (manager_id);


--
-- Name: hiring_decisions_application_id_is_current_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_decisions_application_id_is_current_idx ON public.hiring_decisions USING btree (application_id, is_current);


--
-- Name: hiring_decisions_application_id_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hiring_decisions_application_id_version_key ON public.hiring_decisions USING btree (application_id, version);


--
-- Name: hiring_decisions_one_current_per_application; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hiring_decisions_one_current_per_application ON public.hiring_decisions USING btree (application_id) WHERE (is_current = true);


--
-- Name: hiring_decisions_outcome_decided_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_decisions_outcome_decided_at_idx ON public.hiring_decisions USING btree (outcome, decided_at);


--
-- Name: hiring_team_members_employee_id_job_opening_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_team_members_employee_id_job_opening_id_idx ON public.hiring_team_members USING btree (employee_id, job_opening_id);


--
-- Name: hiring_team_members_employee_id_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_team_members_employee_id_role_idx ON public.hiring_team_members USING btree (employee_id, role);


--
-- Name: hiring_team_members_job_opening_id_employee_id_role_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hiring_team_members_job_opening_id_employee_id_role_key ON public.hiring_team_members USING btree (job_opening_id, employee_id, role);


--
-- Name: hiring_team_members_job_opening_id_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_team_members_job_opening_id_role_idx ON public.hiring_team_members USING btree (job_opening_id, role);


--
-- Name: hiring_team_members_one_hm_per_job; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hiring_team_members_one_hm_per_job ON public.hiring_team_members USING btree (job_opening_id) WHERE (role = 'hiring_manager'::public."HiringTeamRole");


--
-- Name: holidays_holiday_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX holidays_holiday_date_key ON public.holidays USING btree (holiday_date);


--
-- Name: integration_jobs_job_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_jobs_job_type_idx ON public.integration_jobs USING btree (job_type);


--
-- Name: integration_jobs_status_locked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_jobs_status_locked_at_idx ON public.integration_jobs USING btree (status, locked_at);


--
-- Name: integration_jobs_status_scheduled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_jobs_status_scheduled_at_idx ON public.integration_jobs USING btree (status, scheduled_at);


--
-- Name: interview_attachments_interview_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interview_attachments_interview_id_idx ON public.interview_attachments USING btree (interview_id);


--
-- Name: interview_feedback_author_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interview_feedback_author_employee_id_idx ON public.interview_feedback USING btree (author_employee_id);


--
-- Name: interview_feedback_interview_id_author_employee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX interview_feedback_interview_id_author_employee_id_key ON public.interview_feedback USING btree (interview_id, author_employee_id);


--
-- Name: interview_panelists_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interview_panelists_employee_id_idx ON public.interview_panelists USING btree (employee_id);


--
-- Name: interview_panelists_interview_id_employee_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX interview_panelists_interview_id_employee_id_key ON public.interview_panelists USING btree (interview_id, employee_id);


--
-- Name: job_opening_documents_job_opening_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_opening_documents_job_opening_id_deleted_at_idx ON public.job_opening_documents USING btree (job_opening_id, deleted_at);


--
-- Name: job_opening_notes_job_opening_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_opening_notes_job_opening_id_deleted_at_idx ON public.job_opening_notes USING btree (job_opening_id, deleted_at);


--
-- Name: job_opening_notes_job_opening_id_is_pinned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_opening_notes_job_opening_id_is_pinned_idx ON public.job_opening_notes USING btree (job_opening_id, is_pinned);


--
-- Name: job_opening_stages_job_opening_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_opening_stages_job_opening_id_idx ON public.job_opening_stages USING btree (job_opening_id);


--
-- Name: job_opening_stages_job_opening_id_sort_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX job_opening_stages_job_opening_id_sort_order_key ON public.job_opening_stages USING btree (job_opening_id, sort_order);


--
-- Name: job_opening_stages_job_opening_id_stage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX job_opening_stages_job_opening_id_stage_key ON public.job_opening_stages USING btree (job_opening_id, stage);


--
-- Name: job_openings_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX job_openings_code_key ON public.job_openings USING btree (code);


--
-- Name: job_openings_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_openings_created_at_idx ON public.job_openings USING btree (created_at);


--
-- Name: job_openings_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_openings_deleted_at_idx ON public.job_openings USING btree (deleted_at);


--
-- Name: job_openings_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_openings_department_idx ON public.job_openings USING btree (department);


--
-- Name: job_openings_owner_recruiter_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_openings_owner_recruiter_user_id_status_idx ON public.job_openings USING btree (owner_recruiter_user_id, status);


--
-- Name: job_openings_status_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_openings_status_deleted_at_idx ON public.job_openings USING btree (status, deleted_at);


--
-- Name: leave_approval_steps_approver_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_approval_steps_approver_id_status_idx ON public.leave_approval_steps USING btree (approver_id, status);


--
-- Name: leave_approval_steps_leave_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_approval_steps_leave_request_id_idx ON public.leave_approval_steps USING btree (leave_request_id);


--
-- Name: leave_approval_steps_leave_request_id_step_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leave_approval_steps_leave_request_id_step_order_key ON public.leave_approval_steps USING btree (leave_request_id, step_order);


--
-- Name: leave_requests_current_step_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leave_requests_current_step_id_key ON public.leave_requests USING btree (current_step_id);


--
-- Name: leave_requests_employee_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_requests_employee_id_status_idx ON public.leave_requests USING btree (employee_id, status);


--
-- Name: leave_requests_employee_id_workflow_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_requests_employee_id_workflow_status_idx ON public.leave_requests USING btree (employee_id, workflow_status);


--
-- Name: leave_requests_workflow_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_requests_workflow_status_idx ON public.leave_requests USING btree (workflow_status);


--
-- Name: leave_transactions_employee_id_leave_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_transactions_employee_id_leave_type_idx ON public.leave_transactions USING btree (employee_id, leave_type);


--
-- Name: leave_transactions_one_per_request_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leave_transactions_one_per_request_type_idx ON public.leave_transactions USING btree (leave_request_id, transaction_type) WHERE (leave_request_id IS NOT NULL);


--
-- Name: leave_transactions_system_accrual_reason_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leave_transactions_system_accrual_reason_uidx ON public.leave_transactions USING btree (employee_id, reason) WHERE ((transaction_type = 'accrual'::text) AND (leave_request_id IS NULL) AND (reason IS NOT NULL));


--
-- Name: login_sessions_attempted_email_login_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_attempted_email_login_at_idx ON public.login_sessions USING btree (attempted_email, login_at);


--
-- Name: login_sessions_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_employee_id_idx ON public.login_sessions USING btree (employee_id);


--
-- Name: login_sessions_login_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_login_at_idx ON public.login_sessions USING btree (login_at);


--
-- Name: login_sessions_session_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX login_sessions_session_token_key ON public.login_sessions USING btree (session_token);


--
-- Name: login_sessions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_status_idx ON public.login_sessions USING btree (status);


--
-- Name: login_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_user_id_idx ON public.login_sessions USING btree (user_id);


--
-- Name: login_sessions_user_id_status_last_activity_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX login_sessions_user_id_status_last_activity_at_idx ON public.login_sessions USING btree (user_id, status, last_activity_at);


--
-- Name: notification_preferences_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_preferences_user_id_key ON public.notification_preferences USING btree (user_id);


--
-- Name: notifications_correlation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_correlation_id_idx ON public.notifications USING btree (correlation_id);


--
-- Name: notifications_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_recipient_idx ON public.notifications USING btree (recipient);


--
-- Name: notifications_status_locked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_status_locked_at_idx ON public.notifications USING btree (status, locked_at);


--
-- Name: notifications_status_scheduled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_status_scheduled_at_idx ON public.notifications USING btree (status, scheduled_at);


--
-- Name: offer_revisions_offer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offer_revisions_offer_id_idx ON public.offer_revisions USING btree (offer_id);


--
-- Name: offer_revisions_offer_id_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX offer_revisions_offer_id_version_key ON public.offer_revisions USING btree (offer_id, version);


--
-- Name: payroll_attendance_summaries_employee_id_payroll_period_start_k; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_attendance_summaries_employee_id_payroll_period_start_k ON public.payroll_attendance_summaries USING btree (employee_id, payroll_period_start, payroll_period_end);


--
-- Name: payroll_attendance_summaries_hr_decision_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payroll_attendance_summaries_hr_decision_idx ON public.payroll_attendance_summaries USING btree (hr_decision);


--
-- Name: payroll_attendance_summaries_payroll_period_start_payroll_per_i; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payroll_attendance_summaries_payroll_period_start_payroll_per_i ON public.payroll_attendance_summaries USING btree (payroll_period_start, payroll_period_end);


--
-- Name: recruitment_applications_active_candidate_job_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_applications_active_candidate_job_unique ON public.recruitment_applications USING btree (candidate_id, job_opening_id) WHERE ((deleted_at IS NULL) AND (status = 'active'::public."ApplicationStatus"));


--
-- Name: recruitment_applications_assigned_manager_employee_id_statu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_assigned_manager_employee_id_statu_idx ON public.recruitment_applications USING btree (assigned_manager_employee_id, status);


--
-- Name: recruitment_applications_assigned_recruiter_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_assigned_recruiter_user_id_status_idx ON public.recruitment_applications USING btree (assigned_recruiter_user_id, status);


--
-- Name: recruitment_applications_candidate_id_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_candidate_id_deleted_at_idx ON public.recruitment_applications USING btree (candidate_id, deleted_at);


--
-- Name: recruitment_applications_candidate_id_job_opening_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_candidate_id_job_opening_id_idx ON public.recruitment_applications USING btree (candidate_id, job_opening_id);


--
-- Name: recruitment_applications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_created_at_idx ON public.recruitment_applications USING btree (created_at);


--
-- Name: recruitment_applications_job_opening_id_current_stage_delet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_job_opening_id_current_stage_delet_idx ON public.recruitment_applications USING btree (job_opening_id, current_stage, deleted_at);


--
-- Name: recruitment_applications_priority_current_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_priority_current_stage_idx ON public.recruitment_applications USING btree (priority, current_stage);


--
-- Name: recruitment_applications_stage_entered_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_stage_entered_at_idx ON public.recruitment_applications USING btree (stage_entered_at);


--
-- Name: recruitment_applications_status_current_stage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_applications_status_current_stage_idx ON public.recruitment_applications USING btree (status, current_stage);


--
-- Name: recruitment_communication_attachments_communication_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communication_attachments_communication_id_idx ON public.recruitment_communication_attachments USING btree (communication_id);


--
-- Name: recruitment_communications_application_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_application_id_created_at_idx ON public.recruitment_communications USING btree (application_id, created_at);


--
-- Name: recruitment_communications_candidate_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_candidate_id_created_at_idx ON public.recruitment_communications USING btree (candidate_id, created_at);


--
-- Name: recruitment_communications_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_deleted_at_idx ON public.recruitment_communications USING btree (deleted_at);


--
-- Name: recruitment_communications_interview_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_interview_id_idx ON public.recruitment_communications USING btree (interview_id);


--
-- Name: recruitment_communications_job_opening_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_job_opening_id_created_at_idx ON public.recruitment_communications USING btree (job_opening_id, created_at);


--
-- Name: recruitment_communications_offer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_offer_id_idx ON public.recruitment_communications USING btree (offer_id);


--
-- Name: recruitment_communications_sender_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_sender_user_id_created_at_idx ON public.recruitment_communications USING btree (sender_user_id, created_at);


--
-- Name: recruitment_communications_status_scheduled_for_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_status_scheduled_for_idx ON public.recruitment_communications USING btree (status, scheduled_for);


--
-- Name: recruitment_communications_thread_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_thread_id_created_at_idx ON public.recruitment_communications USING btree (thread_id, created_at);


--
-- Name: recruitment_communications_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_communications_type_status_idx ON public.recruitment_communications USING btree (type, status);


--
-- Name: recruitment_email_templates_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_email_templates_deleted_at_idx ON public.recruitment_email_templates USING btree (deleted_at);


--
-- Name: recruitment_email_templates_type_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_email_templates_type_is_active_idx ON public.recruitment_email_templates USING btree (type, is_active);


--
-- Name: recruitment_intake_items_candidate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_intake_items_candidate_id_idx ON public.recruitment_intake_items USING btree (candidate_id);


--
-- Name: recruitment_intake_items_job_opening_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_intake_items_job_opening_id_idx ON public.recruitment_intake_items USING btree (job_opening_id);


--
-- Name: recruitment_intake_items_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_intake_items_status_created_at_idx ON public.recruitment_intake_items USING btree (status, created_at);


--
-- Name: recruitment_interviews_application_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_interviews_application_id_status_idx ON public.recruitment_interviews USING btree (application_id, status);


--
-- Name: recruitment_interviews_scheduled_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_interviews_scheduled_start_idx ON public.recruitment_interviews USING btree (scheduled_start);


--
-- Name: recruitment_interviews_status_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_interviews_status_deleted_at_idx ON public.recruitment_interviews USING btree (status, deleted_at);


--
-- Name: recruitment_interviews_status_scheduled_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_interviews_status_scheduled_start_idx ON public.recruitment_interviews USING btree (status, scheduled_start);


--
-- Name: recruitment_metric_snapshots_metric_key_period_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_metric_snapshots_metric_key_period_start_idx ON public.recruitment_metric_snapshots USING btree (metric_key, period_start);


--
-- Name: recruitment_metric_snapshots_metric_key_scope_type_scope_ke_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_metric_snapshots_metric_key_scope_type_scope_ke_key ON public.recruitment_metric_snapshots USING btree (metric_key, scope_type, scope_key, period_start, period_end);


--
-- Name: recruitment_metric_snapshots_scope_type_scope_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_metric_snapshots_scope_type_scope_key_idx ON public.recruitment_metric_snapshots USING btree (scope_type, scope_key);


--
-- Name: recruitment_offers_accepted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_accepted_at_idx ON public.recruitment_offers USING btree (accepted_at);


--
-- Name: recruitment_offers_application_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_application_id_status_idx ON public.recruitment_offers USING btree (application_id, status);


--
-- Name: recruitment_offers_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_department_idx ON public.recruitment_offers USING btree (department);


--
-- Name: recruitment_offers_hiring_decision_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_hiring_decision_id_idx ON public.recruitment_offers USING btree (hiring_decision_id);


--
-- Name: recruitment_offers_sent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_sent_at_idx ON public.recruitment_offers USING btree (sent_at);


--
-- Name: recruitment_offers_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_offers_status_created_at_idx ON public.recruitment_offers USING btree (status, created_at);


--
-- Name: recruitment_pipeline_template_stages_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_pipeline_template_stages_template_id_idx ON public.recruitment_pipeline_template_stages USING btree (template_id);


--
-- Name: recruitment_pipeline_template_stages_template_id_sort_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_pipeline_template_stages_template_id_sort_order_key ON public.recruitment_pipeline_template_stages USING btree (template_id, sort_order);


--
-- Name: recruitment_pipeline_template_stages_template_id_stage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_pipeline_template_stages_template_id_stage_key ON public.recruitment_pipeline_template_stages USING btree (template_id, stage);


--
-- Name: recruitment_pipeline_templates_is_active_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_pipeline_templates_is_active_deleted_at_idx ON public.recruitment_pipeline_templates USING btree (is_active, deleted_at);


--
-- Name: recruitment_saved_filters_user_id_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_saved_filters_user_id_entity_idx ON public.recruitment_saved_filters USING btree (user_id, entity);


--
-- Name: recruitment_saved_filters_user_id_entity_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_saved_filters_user_id_entity_name_key ON public.recruitment_saved_filters USING btree (user_id, entity, name);


--
-- Name: recruitment_tags_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recruitment_tags_name_key ON public.recruitment_tags USING btree (name);


--
-- Name: recruitment_timeline_events_application_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_timeline_events_application_id_created_at_idx ON public.recruitment_timeline_events USING btree (application_id, created_at);


--
-- Name: recruitment_timeline_events_candidate_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_timeline_events_candidate_id_created_at_idx ON public.recruitment_timeline_events USING btree (candidate_id, created_at);


--
-- Name: recruitment_timeline_events_entity_type_entity_id_created_a_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_timeline_events_entity_type_entity_id_created_a_idx ON public.recruitment_timeline_events USING btree (entity_type, entity_id, created_at);


--
-- Name: recruitment_timeline_events_event_type_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_timeline_events_event_type_created_at_idx ON public.recruitment_timeline_events USING btree (event_type, created_at);


--
-- Name: recruitment_timeline_events_job_opening_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recruitment_timeline_events_job_opening_id_created_at_idx ON public.recruitment_timeline_events USING btree (job_opening_id, created_at);


--
-- Name: talent_pool_entries_candidate_id_exited_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX talent_pool_entries_candidate_id_exited_at_idx ON public.talent_pool_entries USING btree (candidate_id, exited_at);


--
-- Name: talent_pool_entries_entered_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX talent_pool_entries_entered_at_idx ON public.talent_pool_entries USING btree (entered_at);


--
-- Name: ticket_history_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_history_action_idx ON public.ticket_history USING btree (action);


--
-- Name: ticket_history_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_history_actor_user_id_idx ON public.ticket_history USING btree (actor_user_id);


--
-- Name: ticket_history_ticket_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_history_ticket_id_created_at_idx ON public.ticket_history USING btree (ticket_id, created_at);


--
-- Name: ticket_history_ticket_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_history_ticket_id_idx ON public.ticket_history USING btree (ticket_id);


--
-- Name: ticket_messages_author_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_messages_author_user_id_idx ON public.ticket_messages USING btree (author_user_id);


--
-- Name: ticket_messages_ticket_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_messages_ticket_id_created_at_idx ON public.ticket_messages USING btree (ticket_id, created_at);


--
-- Name: ticket_messages_ticket_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_messages_ticket_id_idx ON public.ticket_messages USING btree (ticket_id);


--
-- Name: tickets_assigned_to_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_assigned_to_user_id_idx ON public.tickets USING btree (assigned_to_user_id);


--
-- Name: tickets_assigned_to_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_assigned_to_user_id_status_idx ON public.tickets USING btree (assigned_to_user_id, status);


--
-- Name: tickets_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_category_idx ON public.tickets USING btree (category);


--
-- Name: tickets_category_is_anonymous_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_category_is_anonymous_idx ON public.tickets USING btree (category, is_anonymous);


--
-- Name: tickets_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_created_at_idx ON public.tickets USING btree (created_at);


--
-- Name: tickets_created_at_is_anonymous_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_created_at_is_anonymous_idx ON public.tickets USING btree (created_at DESC, is_anonymous);


--
-- Name: tickets_department_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_department_status_idx ON public.tickets USING btree (department, status) WHERE (department IS NOT NULL);


--
-- Name: tickets_is_anonymous_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_is_anonymous_idx ON public.tickets USING btree (is_anonymous);


--
-- Name: tickets_is_anonymous_status_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_is_anonymous_status_priority_idx ON public.tickets USING btree (is_anonymous, status, priority);


--
-- Name: tickets_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_priority_idx ON public.tickets USING btree (priority);


--
-- Name: tickets_raised_by_employee_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_raised_by_employee_id_idx ON public.tickets USING btree (raised_by_employee_id);


--
-- Name: tickets_raised_by_employee_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_raised_by_employee_id_status_idx ON public.tickets USING btree (raised_by_employee_id, status);


--
-- Name: tickets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_status_idx ON public.tickets USING btree (status);


--
-- Name: tickets_status_is_anonymous_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_status_is_anonymous_idx ON public.tickets USING btree (status, is_anonymous);


--
-- Name: tickets_ticket_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_ticket_number_idx ON public.tickets USING btree (ticket_number);


--
-- Name: tickets_ticket_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tickets_ticket_number_key ON public.tickets USING btree (ticket_number);


--
-- Name: users_account_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_account_status_idx ON public.users USING btree (account_status);


--
-- Name: users_azure_oid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_azure_oid_key ON public.users USING btree (azure_oid);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_employeeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "users_employeeId_key" ON public.users USING btree ("employeeId");


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_role_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_is_active_idx ON public.users USING btree (role, is_active);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: worker_heartbeats_status_last_beat_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX worker_heartbeats_status_last_beat_at_idx ON public.worker_heartbeats USING btree (status, last_beat_at);


--
-- Name: workflow_escalations_approval_step_id_escalation_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workflow_escalations_approval_step_id_escalation_type_key ON public.workflow_escalations USING btree (approval_step_id, escalation_type);


--
-- Name: workflow_escalations_leave_request_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_escalations_leave_request_id_idx ON public.workflow_escalations USING btree (leave_request_id);


--
-- Name: workforce_metrics_metric_key_period_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workforce_metrics_metric_key_period_start_idx ON public.workforce_metrics USING btree (metric_key, period_start);


--
-- Name: workforce_metrics_scope_scope_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workforce_metrics_scope_scope_key_idx ON public.workforce_metrics USING btree (scope, scope_key);


--
-- Name: workforce_metrics_scope_scope_key_metric_key_period_period__key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workforce_metrics_scope_scope_key_metric_key_period_period__key ON public.workforce_metrics USING btree (scope, scope_key, metric_key, period, period_start);


--
-- Name: application_stage_history application_stage_history_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_stage_history
    ADD CONSTRAINT application_stage_history_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: application_stage_history application_stage_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_stage_history
    ADD CONSTRAINT application_stage_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: approval_tokens approval_tokens_approval_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_tokens
    ADD CONSTRAINT approval_tokens_approval_step_id_fkey FOREIGN KEY (approval_step_id) REFERENCES public.leave_approval_steps(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: approval_tokens approval_tokens_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_tokens
    ADD CONSTRAINT approval_tokens_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.attendance_uploads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: attendance_sessions attendance_sessions_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_sessions
    ADD CONSTRAINT attendance_sessions_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance_records(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_ai_insights candidate_ai_insights_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_ai_insights
    ADD CONSTRAINT candidate_ai_insights_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_certifications candidate_certifications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_certifications
    ADD CONSTRAINT candidate_certifications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_chat_messages candidate_chat_messages_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_chat_messages
    ADD CONSTRAINT candidate_chat_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_chat_messages candidate_chat_messages_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_chat_messages
    ADD CONSTRAINT candidate_chat_messages_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_documents candidate_documents_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_documents
    ADD CONSTRAINT candidate_documents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_documents candidate_documents_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_documents
    ADD CONSTRAINT candidate_documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: candidate_educations candidate_educations_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_educations
    ADD CONSTRAINT candidate_educations_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_experiences candidate_experiences_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_experiences
    ADD CONSTRAINT candidate_experiences_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_notes candidate_notes_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_notes
    ADD CONSTRAINT candidate_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_notes candidate_notes_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_notes
    ADD CONSTRAINT candidate_notes_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_personal candidate_personal_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_personal
    ADD CONSTRAINT candidate_personal_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_projects candidate_projects_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_projects
    ADD CONSTRAINT candidate_projects_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_skills candidate_skills_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_skills
    ADD CONSTRAINT candidate_skills_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_tags candidate_tags_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_tags
    ADD CONSTRAINT candidate_tags_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidate_tags candidate_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_tags
    ADD CONSTRAINT candidate_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.recruitment_tags(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: candidates candidates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: candidates candidates_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: candidates candidates_merged_into_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_merged_into_candidate_id_fkey FOREIGN KEY (merged_into_candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: candidates candidates_primary_recruiter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_primary_recruiter_user_id_fkey FOREIGN KEY (primary_recruiter_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: candidates candidates_referred_by_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_referred_by_employee_id_fkey FOREIGN KEY (referred_by_employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_converted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_converted_by_user_id_fkey FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee_conversion_snapshots employee_conversion_snapshots_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_conversion_snapshots
    ADD CONSTRAINT employee_conversion_snapshots_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.recruitment_offers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: hiring_decisions hiring_decisions_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_decisions
    ADD CONSTRAINT hiring_decisions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hiring_decisions hiring_decisions_decided_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_decisions
    ADD CONSTRAINT hiring_decisions_decided_by_user_id_fkey FOREIGN KEY (decided_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hiring_team_members hiring_team_members_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_team_members
    ADD CONSTRAINT hiring_team_members_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hiring_team_members hiring_team_members_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_team_members
    ADD CONSTRAINT hiring_team_members_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: interview_attachments interview_attachments_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_attachments
    ADD CONSTRAINT interview_attachments_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.recruitment_interviews(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: interview_feedback interview_feedback_author_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_author_employee_id_fkey FOREIGN KEY (author_employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: interview_feedback interview_feedback_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.recruitment_interviews(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: interview_panelists interview_panelists_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panelists
    ADD CONSTRAINT interview_panelists_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: interview_panelists interview_panelists_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_panelists
    ADD CONSTRAINT interview_panelists_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.recruitment_interviews(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: job_opening_documents job_opening_documents_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_documents
    ADD CONSTRAINT job_opening_documents_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: job_opening_documents job_opening_documents_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_documents
    ADD CONSTRAINT job_opening_documents_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: job_opening_notes job_opening_notes_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_notes
    ADD CONSTRAINT job_opening_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: job_opening_notes job_opening_notes_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_notes
    ADD CONSTRAINT job_opening_notes_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: job_opening_stages job_opening_stages_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_opening_stages
    ADD CONSTRAINT job_opening_stages_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: job_openings job_openings_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_openings
    ADD CONSTRAINT job_openings_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: job_openings job_openings_headcount_requested_by_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_openings
    ADD CONSTRAINT job_openings_headcount_requested_by_employee_id_fkey FOREIGN KEY (headcount_requested_by_employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: job_openings job_openings_owner_recruiter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_openings
    ADD CONSTRAINT job_openings_owner_recruiter_user_id_fkey FOREIGN KEY (owner_recruiter_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: job_openings job_openings_pipeline_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_openings
    ADD CONSTRAINT job_openings_pipeline_template_id_fkey FOREIGN KEY (pipeline_template_id) REFERENCES public.recruitment_pipeline_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leave_approval_steps leave_approval_steps_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_approval_steps
    ADD CONSTRAINT leave_approval_steps_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leave_approval_steps leave_approval_steps_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_approval_steps
    ADD CONSTRAINT leave_approval_steps_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_current_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_current_step_id_fkey FOREIGN KEY (current_step_id) REFERENCES public.leave_approval_steps(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: leave_transactions leave_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_transactions
    ADD CONSTRAINT leave_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: login_sessions login_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: login_sessions login_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_sessions
    ADD CONSTRAINT login_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: offer_revisions offer_revisions_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_revisions
    ADD CONSTRAINT offer_revisions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.recruitment_offers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payroll_attendance_summaries payroll_attendance_summaries_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_attendance_summaries
    ADD CONSTRAINT payroll_attendance_summaries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_applications recruitment_applications_assessment_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_assessment_updated_by_user_id_fkey FOREIGN KEY (assessment_updated_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_applications recruitment_applications_assigned_manager_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_assigned_manager_employee_id_fkey FOREIGN KEY (assigned_manager_employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_applications recruitment_applications_assigned_recruiter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_assigned_recruiter_user_id_fkey FOREIGN KEY (assigned_recruiter_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_applications recruitment_applications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: recruitment_applications recruitment_applications_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_applications recruitment_applications_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: recruitment_communication_attachments recruitment_communication_attachments_communication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communication_attachments
    ADD CONSTRAINT recruitment_communication_attachments_communication_id_fkey FOREIGN KEY (communication_id) REFERENCES public.recruitment_communications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_communications recruitment_communications_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.recruitment_interviews(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.recruitment_offers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.recruitment_communications(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_sender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_communications recruitment_communications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_communications
    ADD CONSTRAINT recruitment_communications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recruitment_email_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_email_templates recruitment_email_templates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_email_templates
    ADD CONSTRAINT recruitment_email_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_intake_items recruitment_intake_items_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_intake_items
    ADD CONSTRAINT recruitment_intake_items_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_intake_items recruitment_intake_items_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_intake_items
    ADD CONSTRAINT recruitment_intake_items_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_intake_items recruitment_intake_items_job_opening_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_intake_items
    ADD CONSTRAINT recruitment_intake_items_job_opening_id_fkey FOREIGN KEY (job_opening_id) REFERENCES public.job_openings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_interviews recruitment_interviews_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_interviews
    ADD CONSTRAINT recruitment_interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_interviews recruitment_interviews_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_interviews
    ADD CONSTRAINT recruitment_interviews_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_offers recruitment_offers_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_offers
    ADD CONSTRAINT recruitment_offers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruitment_applications(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_offers recruitment_offers_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_offers
    ADD CONSTRAINT recruitment_offers_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_offers recruitment_offers_hiring_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_offers
    ADD CONSTRAINT recruitment_offers_hiring_decision_id_fkey FOREIGN KEY (hiring_decision_id) REFERENCES public.hiring_decisions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: recruitment_pipeline_template_stages recruitment_pipeline_template_stages_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_pipeline_template_stages
    ADD CONSTRAINT recruitment_pipeline_template_stages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recruitment_pipeline_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_pipeline_templates recruitment_pipeline_templates_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_pipeline_templates
    ADD CONSTRAINT recruitment_pipeline_templates_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: recruitment_saved_filters recruitment_saved_filters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_saved_filters
    ADD CONSTRAINT recruitment_saved_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: recruitment_settings recruitment_settings_default_pipeline_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_settings
    ADD CONSTRAINT recruitment_settings_default_pipeline_template_id_fkey FOREIGN KEY (default_pipeline_template_id) REFERENCES public.recruitment_pipeline_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: talent_pool_entries talent_pool_entries_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.talent_pool_entries
    ADD CONSTRAINT talent_pool_entries_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ticket_messages ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_messages
    ADD CONSTRAINT ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tickets tickets_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tickets tickets_raised_by_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_raised_by_employee_id_fkey FOREIGN KEY (raised_by_employee_id) REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public.employees(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_escalations workflow_escalations_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_escalations
    ADD CONSTRAINT workflow_escalations_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict n1b1HNzX1wXFQm3U7MKeG7okxsH5wIJO3be8BkYC3mQEFXly3Ym78cPnSwKIfzc

