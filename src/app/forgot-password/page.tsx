import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="We'll email you a secure link to set a new password.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
