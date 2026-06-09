"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function NewTransactionForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const propertyAddress = String(formData.get("propertyAddress") ?? "").trim();

    if (!propertyAddress) {
      setLoading(false);
      toast({ title: "Property address is required.", variant: "error" });
      return;
    }

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress,
          agentTeam: stringValue(formData, "agentTeam"),
          buyerNames: listValue(formData, "buyerNames"),
          sellerNames: listValue(formData, "sellerNames"),
          closingDate: stringValue(formData, "closingDate"),
          purchasePrice: moneyValue(formData, "purchasePrice"),
          financingType: stringValue(formData, "financingType"),
        }),
      });
      const data = (await response.json()) as { id?: string; error?: string; hint?: string };

      if (!response.ok || !data.id) {
        throw new Error([data.error, data.hint].filter(Boolean).join(" ") || "Transaction create failed.");
      }

      toast({ title: "Transaction created", variant: "success" });
      router.push(`/transactions/${data.id}/upload`);
      router.refresh();
    } catch (caught) {
      setLoading(false);
      toast({
        title: "Couldn't create transaction",
        description: caught instanceof Error ? caught.message : undefined,
        variant: "error",
      });
    }
  }

  return (
    <div className="max-w-3xl rounded-xl border border-line bg-surface p-6 shadow-card">
      <form className="grid gap-5" onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Property address" htmlFor="propertyAddress">
            <Input id="propertyAddress" name="propertyAddress" required placeholder="123 Main St, City, MO" />
          </Field>
          <Field label="Agent / team" htmlFor="agentTeam">
            <Input id="agentTeam" name="agentTeam" placeholder="Team name" />
          </Field>
          <Field label="Buyer names" htmlFor="buyerNames" hint="Comma-separated">
            <Input id="buyerNames" name="buyerNames" placeholder="Buyer one, buyer two" />
          </Field>
          <Field label="Seller names" htmlFor="sellerNames" hint="Comma-separated">
            <Input id="sellerNames" name="sellerNames" placeholder="Seller one, seller two" />
          </Field>
          <Field label="Closing date" htmlFor="closingDate">
            <Input id="closingDate" name="closingDate" type="date" />
          </Field>
          <Field label="Purchase price" htmlFor="purchasePrice">
            <Input id="purchasePrice" name="purchasePrice" inputMode="decimal" placeholder="$" />
          </Field>
          <Field label="Financing type" htmlFor="financingType">
            <Input id="financingType" name="financingType" placeholder="Conventional, cash, FHA…" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create transaction"}
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function stringValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function listValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function moneyValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").replace(/[$,]/g, "").trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
