/** Plain RSC → client DTO for pending conversion rows (no Prisma.Decimal). */
export type PendingConversionListItem = {
  id: string;
  offerNumber: string | null;
  acceptedAt: Date | null;
  ctc: number | null;
  currency: string | null;
  createdBy: { id: string; email: string | null } | null;
  application: {
    candidate: {
      id: string;
      fullName: string;
      email: string | null;
    };
    jobOpening: {
      id: string;
      title: string;
    };
  };
};

/** Plain RSC → client DTO for conversion history rows (no Prisma.Decimal). */
export type ConversionHistoryItem = {
  id: string;
  convertedAt: Date;
  application: {
    candidate: {
      id: string;
      fullName: string;
      email: string | null;
    };
    jobOpening: {
      id: string;
      title: string;
    };
  };
  employee: {
    id: number;
    employeeCode: string;
  };
  convertedBy: {
    id: string;
    email: string | null;
  };
};

/** Mapped employee fields from `previewConversion` before login provisioning UI fields. */
export type EmployeeConversionPreviewData = {
  employeeCode: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department: string;
  designation: string;
  managerId: number | null;
  employmentType: string;
  workLocation: string;
  joiningDate: string;
  grade: string;
  ctc: number;
};

/** Controlled form state for conversion preview / EmployeePreviewCard. */
export type EmployeeConversionFormData = EmployeeConversionPreviewData & {
  createLogin: boolean;
  password: string;
};

export type EmployeeConversionFormField = keyof EmployeeConversionFormData;
