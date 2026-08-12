import { FormPageSkeleton } from "@/components/loading";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <FormPageSkeleton label="Loading sign in" className="w-full max-w-md" />
    </div>
  );
}
