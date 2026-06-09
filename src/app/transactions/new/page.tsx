import { AppShell } from "@/components/app-shell";
import { NewTransactionForm } from "@/components/transactions/new-transaction-form";

export default function NewTransactionPage() {
  return (
    <AppShell active="Dashboard" title="New transaction" eyebrow="Create transaction">
      <NewTransactionForm />
    </AppShell>
  );
}
