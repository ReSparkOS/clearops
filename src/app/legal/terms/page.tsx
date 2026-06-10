const SECTION_TITLE = "mt-8 text-base font-semibold text-ink";
const BODY = "mt-2 text-sm leading-6 text-ink-muted";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-900">
        Template — have a licensed attorney review and finalize this document before accepting paying customers.
      </p>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-1 text-xs text-ink-subtle">Last updated: June 9, 2026</p>

      <h2 className={SECTION_TITLE}>1. The service</h2>
      <p className={BODY}>
        Clear Close IQ provides AI-assisted review of real-estate transaction documents: it extracts key terms,
        computes deadlines, and raises review flags for transaction coordinators and their teams.
      </p>

      <h2 className={SECTION_TITLE}>2. Not legal advice — human review required</h2>
      <p className={BODY}>
        Clear Close IQ is a review aid, not a lawyer, broker, or fiduciary. Output may be incomplete or incorrect, and
        AI-extracted values can contain errors. You are responsible for verifying every extracted field, deadline, and
        flag against the source documents before acting on it. Nothing in the service constitutes legal, financial, or
        professional advice.
      </p>

      <h2 className={SECTION_TITLE}>3. Your account and data</h2>
      <p className={BODY}>
        You are responsible for safeguarding your credentials and for the activity of teammates you invite into your
        workspace. You confirm you have the right to upload the documents you process and that doing so does not
        violate any agreement or law that applies to you.
      </p>

      <h2 className={SECTION_TITLE}>4. Acceptable use</h2>
      <p className={BODY}>
        No reselling the service, probing or disrupting its security, uploading malicious content, or processing
        documents you have no authorization to handle.
      </p>

      <h2 className={SECTION_TITLE}>5. Subprocessors</h2>
      <p className={BODY}>
        Documents are stored with Supabase and processed by AI providers (OpenAI and Anthropic) to perform extraction.
        See the Privacy Policy for details.
      </p>

      <h2 className={SECTION_TITLE}>6. Disclaimer of warranties and limitation of liability</h2>
      <p className={BODY}>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum extent permitted by
        law, Clear Close IQ is not liable for indirect, incidental, or consequential damages, including missed
        deadlines or losses arising from reliance on extracted data.
      </p>

      <h2 className={SECTION_TITLE}>7. Termination</h2>
      <p className={BODY}>
        You may stop using the service at any time. We may suspend or terminate accounts that violate these terms.
      </p>

      <h2 className={SECTION_TITLE}>8. Changes</h2>
      <p className={BODY}>
        We may update these terms; material changes will be communicated through the service or by email.
      </p>
    </>
  );
}
