import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" description="You followed a reset link — set your new password below.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
