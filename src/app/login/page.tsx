import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Access your transaction coordination workspace.">
      <LoginForm />
    </AuthCard>
  );
}
