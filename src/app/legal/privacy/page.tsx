const SECTION_TITLE = "mt-8 text-base font-semibold text-ink";
const BODY = "mt-2 text-sm leading-6 text-ink-muted";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-900">
        Template — have a licensed attorney review and finalize this document before accepting paying customers.
      </p>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-1 text-xs text-ink-subtle">Last updated: June 9, 2026</p>

      <h2 className={SECTION_TITLE}>1. What we collect</h2>
      <p className={BODY}>
        Account details (name, email), workspace membership, and the transaction documents you upload — which may
        contain personal information about parties to a transaction (names, addresses, prices, signatures).
      </p>

      <h2 className={SECTION_TITLE}>2. How we use it</h2>
      <p className={BODY}>
        Solely to provide the service: extracting terms and deadlines from your documents, raising review flags,
        sending deadline reminders, and maintaining an audit trail of activity in your workspace. We do not sell your
        data or use it for advertising.
      </p>

      <h2 className={SECTION_TITLE}>3. Where it lives</h2>
      <p className={BODY}>
        Data is stored with Supabase (SOC 2 Type 2; encryption at rest with AES-256 and TLS in transit) in a private
        storage bucket and an access-controlled database. Access is limited to members of your workspace.
      </p>

      <h2 className={SECTION_TITLE}>4. AI processing</h2>
      <p className={BODY}>
        Document text is sent to AI providers (OpenAI and Anthropic) to perform extraction. Per their API terms, this
        data is not used to train their models. Processing is transient; results are stored back in your workspace.
      </p>

      <h2 className={SECTION_TITLE}>5. Retention and deletion</h2>
      <p className={BODY}>
        Documents and extracted data are retained while your account is active. Contact us to export or delete your
        workspace data; deletion removes documents, extractions, and flags from production systems and scheduled
        backups on their rotation cycle.
      </p>

      <h2 className={SECTION_TITLE}>6. Your choices</h2>
      <p className={BODY}>
        You can correct account details in the app, remove teammates from your workspace, and request a copy or
        deletion of your data at any time.
      </p>

      <h2 className={SECTION_TITLE}>7. Contact</h2>
      <p className={BODY}>Questions about this policy: contact the workspace owner or the Clear Close IQ operator.</p>
    </>
  );
}
