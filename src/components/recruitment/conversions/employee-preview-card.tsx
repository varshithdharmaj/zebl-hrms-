import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeePreviewCardProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  managers: { id: number; name: string; employeeCode: string }[];
}

export function EmployeePreviewCard({ formData, onChange, managers }: EmployeePreviewCardProps) {
  const departments = ["Engineering", "HR", "Sales", "Marketing", "Product", "Finance", "Operations"];
  const employmentTypes = ["Full-time", "Part-time", "Contract", "Intern"];
  const locations = ["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Remote"];

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-slate-900">
          Employee Profile Setup
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Review and customize the fields that will populate the new employee record in the HRMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Employee Number */}
          <div className="space-y-1.5">
            <Label htmlFor="employeeCode" className="text-xs font-semibold text-slate-700">
              Employee Number / Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="employeeCode"
              value={formData.employeeCode}
              onChange={(e) => onChange("employeeCode", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              placeholder="e.g. EMP-1024"
              required
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              placeholder="Full Name"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              placeholder="Email Address"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
              Phone Number
            </Label>
            <Input
              id="phone"
              value={formData.phone || ""}
              onChange={(e) => onChange("phone", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              placeholder="Phone Number"
            />
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label htmlFor="department" className="text-xs font-semibold text-slate-700">
              Department <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.department}
              onValueChange={(val) => onChange("department", val)}
            >
              <SelectTrigger id="department" className="text-xs rounded-lg border-slate-200 h-9">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept} className="text-xs">
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Designation */}
          <div className="space-y-1.5">
            <Label htmlFor="designation" className="text-xs font-semibold text-slate-700">
              Designation / Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="designation"
              value={formData.designation}
              onChange={(e) => onChange("designation", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              placeholder="e.g. Senior Software Engineer"
              required
            />
          </div>

          {/* Reporting Manager */}
          <div className="space-y-1.5">
            <Label htmlFor="managerId" className="text-xs font-semibold text-slate-700">
              Reporting Manager
            </Label>
            <Select
              value={formData.managerId ? String(formData.managerId) : "none"}
              onValueChange={(val) => onChange("managerId", val === "none" ? null : parseInt(val, 10))}
            >
              <SelectTrigger id="managerId" className="text-xs rounded-lg border-slate-200 h-9">
                <SelectValue placeholder="Select Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">No Manager (Direct Report)</SelectItem>
                {managers.map((mgr) => (
                  <SelectItem key={mgr.id} value={String(mgr.id)} className="text-xs">
                    {mgr.name} ({mgr.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employment Type */}
          <div className="space-y-1.5">
            <Label htmlFor="employmentType" className="text-xs font-semibold text-slate-700">
              Employment Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.employmentType}
              onValueChange={(val) => onChange("employmentType", val)}
            >
              <SelectTrigger id="employmentType" className="text-xs rounded-lg border-slate-200 h-9">
                <SelectValue placeholder="Select Employment Type" />
              </SelectTrigger>
              <SelectContent>
                {employmentTypes.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="workLocation" className="text-xs font-semibold text-slate-700">
              Work Location <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.workLocation}
              onValueChange={(val) => onChange("workLocation", val)}
            >
              <SelectTrigger id="workLocation" className="text-xs rounded-lg border-slate-200 h-9">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc} className="text-xs">
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Joining Date */}
          <div className="space-y-1.5">
            <Label htmlFor="joiningDate" className="text-xs font-semibold text-slate-700">
              Joining Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="joiningDate"
              type="date"
              value={formData.joiningDate}
              onChange={(e) => onChange("joiningDate", e.target.value)}
              className="text-xs rounded-lg border-slate-200"
              required
            />
          </div>
        </div>

        <hr className="border-slate-100 my-4" />

        {/* User Account Provisioning */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createLogin"
              checked={formData.createLogin}
              onCheckedChange={(checked) => onChange("createLogin", !!checked)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="createLogin"
                className="text-xs font-semibold text-slate-800 cursor-pointer"
              >
                Provision System Login Account
              </Label>
              <p className="text-[10px] text-slate-500">
                Check this to automatically create a user login for this employee with their email.
              </p>
            </div>
          </div>

          {formData.createLogin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Initial Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => onChange("password", e.target.value)}
                  className="text-xs rounded-lg border-slate-200"
                  placeholder="At least 8 characters"
                  required={formData.createLogin}
                  minLength={8}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
