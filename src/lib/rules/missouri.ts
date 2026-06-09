import type {
  AmendmentReview,
  DeadlineResult,
  DocumentType,
  ExtractedDeadline,
  FlagCategory,
  FlagSeverity,
  HealthCheckStatus,
  PacketDocument,
  PacketFlag,
  ReferencedDocument,
  RiskStatus,
  RuleEngineInput,
  RuleEngineResult,
} from "@/lib/domain/types";
import { isoToday, toIsoDate } from "@/lib/domain/dates";

const financingDocumentsByType: Record<string, DocumentType[]> = {
  fha: ["fha_addendum", "financing_addendum", "appraisal_addendum"],
  va: ["va_addendum", "financing_addendum", "appraisal_addendum"],
  usda: ["usda_addendum", "financing_addendum", "appraisal_addendum"],
  conventional: ["conventional_financing_document", "financing_addendum", "appraisal_addendum"],
};

const deadlineDayMs = 24 * 60 * 60 * 1000;

export function runMissouriResidentialRules(input: RuleEngineInput): RuleEngineResult {
  const flags: PacketFlag[] = [];
  const documents = input.documents;
  const facts = input.facts;

  const addFlag = (flag: Omit<PacketFlag, "id" | "source" | "status"> & { status?: PacketFlag["status"] }) => {
    flags.push({
      id: `flag-${flags.length + 1}`,
      source: "rule",
      status: flag.status ?? "open",
      ...flag,
    });
  };

  if (facts.property_year_built == null) {
    addFlag({
      category: "unclear_terms",
      severity: "medium",
      title: "Lead-based paint requirement unknown",
      explanation: "Could not determine whether lead-based paint disclosure is required because year built is missing.",
      suggestedAction: "Verify year built and confirm with broker/compliance whether a disclosure is needed.",
      confidence: 0.74,
      status: "needs_follow_up",
    });
  } else if (facts.property_year_built < 1978 && !hasDocument(documents, "lead_based_paint_disclosure")) {
    addFlag({
      category: "missing_doc",
      severity: "high",
      title: "Lead-based paint disclosure likely required",
      explanation: "The property appears to have been built before 1978, but no lead-based paint disclosure was found in the packet.",
      suggestedAction: "Request or verify the lead-based paint disclosure before marking the packet cleared.",
      confidence: 0.92,
      requiredDocument: "lead_based_paint_disclosure",
      status: "needs_follow_up",
    });
  }

  const financingType = normalizeText(facts.financing_type);
  const isCash = facts.cash_or_financed === "cash" || financingType === "cash";
  const isFinanced = facts.cash_or_financed === "financed" || Object.keys(financingDocumentsByType).includes(financingType);

  if (isFinanced) {
    const required = financingDocumentsByType[financingType] ?? ["financing_addendum"];
    if (!required.some((documentType) => hasDocument(documents, documentType))) {
      addFlag({
        category: "missing_doc",
        severity: "high",
        title: "Financing documentation missing or unclear",
        explanation: "The transaction appears financed, but matching financing terms or addenda were not found with enough confidence.",
        suggestedAction: "Verify financing terms and add the applicable financing addendum or lender documentation.",
        confidence: 0.86,
        requiredDocument: required[0],
        status: "needs_follow_up",
      });
    }
  }

  if (isCash && !hasDocument(documents, "cash_proof_of_funds")) {
    addFlag({
      category: "missing_doc",
      severity: "medium",
      title: "Proof of funds not found",
      explanation: "The transaction appears to be cash, but no proof of funds document was found in the packet.",
      suggestedAction: "Request proof of funds or mark this flag false positive if it is stored outside the packet.",
      confidence: 0.84,
      requiredDocument: "cash_proof_of_funds",
      status: "needs_follow_up",
    });
  }

  for (const reference of facts.referenced_documents) {
    if (!documentMatchesReference(documents, reference)) {
      addFlag({
        category: "missing_doc",
        severity: "high",
        title: `Referenced document not found: ${reference.label}`,
        explanation: "The packet references an attachment, exhibit, addendum, or notice that was not matched to an uploaded document.",
        suggestedAction: "Confirm whether the referenced item exists and upload it, or document why it is not applicable.",
        confidence: reference.confidence,
        sourceDocumentId: reference.sourceDocumentId,
        sourcePage: reference.sourcePage,
        status: "needs_follow_up",
      });
    }
  }

  if (facts.signatures_detected !== "likely_complete") {
    addFlag(signatureFlag("signature_issue", "Signatures need review", facts.signatures_detected));
  }

  if (facts.initials_detected !== "likely_complete") {
    addFlag(signatureFlag("signature_issue", "Initials need review", facts.initials_detected));
  }

  for (const issue of facts.date_issues ?? []) {
    addFlag({
      category: "date_issue",
      severity: "medium",
      title: "Signature or contract date issue",
      explanation: issue,
      suggestedAction: "Verify the date with broker/compliance before clearing this packet.",
      confidence: 0.7,
      status: "needs_follow_up",
    });
  }

  if (facts.hoa_or_condo && !hasDocument(documents, "hoa_condo_documents")) {
    addFlag({
      category: "missing_doc",
      severity: "medium",
      title: "HOA or condo documents may be missing",
      explanation: "Association terms were detected, but HOA/condo documents were not found in the uploaded packet.",
      suggestedAction: "Verify whether association documents are required for this file.",
      confidence: 0.76,
      requiredDocument: "hoa_condo_documents",
      status: "needs_follow_up",
    });
  }

  if (facts.septic_or_well && !hasDocument(documents, "septic_well_private_water_disclosure")) {
    addFlag({
      category: "missing_doc",
      severity: "medium",
      title: "Septic, well, or private water disclosure may be missing",
      explanation: "Private utility terms were detected, but no related disclosure or inspection document was found.",
      suggestedAction: "Verify whether septic, well, lagoon, rural water, or private water disclosures apply.",
      confidence: 0.74,
      requiredDocument: "septic_well_private_water_disclosure",
      status: "needs_follow_up",
    });
  }

  if (facts.personal_property_included && !hasDocument(documents, "personal_property_addendum")) {
    addFlag({
      category: "unclear_terms",
      severity: "low",
      title: "Personal property terms need review",
      explanation: "Personal property appears included, but a matching addendum was not found.",
      suggestedAction: "Confirm the included items are clearly described or add a personal property addendum if required.",
      confidence: 0.68,
      requiredDocument: "personal_property_addendum",
      status: "needs_follow_up",
    });
  }

  if (facts.home_warranty_terms && !hasDocument(documents, "home_warranty_addendum")) {
    addFlag({
      category: "unclear_terms",
      severity: "low",
      title: "Home warranty terms need review",
      explanation: `Home warranty terms were detected: ${facts.home_warranty_terms}`,
      suggestedAction: "Verify payer, cap, provider, and whether a warranty addendum is needed.",
      confidence: 0.68,
      requiredDocument: "home_warranty_addendum",
      status: "needs_follow_up",
    });
  }

  for (const conflict of facts.conflicting_terms ?? []) {
    addFlag({
      category: "conflicting_terms",
      severity: "high",
      title: "Conflicting transaction terms",
      explanation: conflict,
      suggestedAction: "Compare the source documents and identify the controlling term with human review.",
      confidence: 0.82,
      status: "needs_follow_up",
    });
  }

  const amendmentChanges = (facts.amendment_changes ?? []).map<AmendmentReview>((change) => {
    const fieldTitle = prettifyField(change.field);
    addFlag({
      category: "conflicting_terms",
      severity: "medium",
      title: `Amendment changes ${fieldTitle}`,
      explanation: `A later document changes ${fieldTitle} from ${String(change.originalValue)} to ${String(change.newValue)}.`,
      suggestedAction: "Treat the later term as controlling only after human review confirms the amendment/counteroffer sequence.",
      confidence: change.confidence,
      sourceDocumentId: change.controllingDocumentId,
      sourcePage: change.sourcePage,
      status: "needs_follow_up",
    });

    return {
      ...change,
      needsHumanReview: true,
    };
  });

  const deadlines = normalizeDeadlines(facts, input.asOf, addFlag);

  for (const document of documents) {
    if (document.documentType === "unknown_document" || document.confidence < 0.5) {
      addFlag({
        category: "unknown_doc",
        severity: "low",
        title: "Unknown document needs review",
        explanation: `${document.filename} could not be confidently classified.`,
        suggestedAction: "Open the document and assign the correct document type before final review.",
        confidence: Math.max(0.25, document.confidence),
        sourceDocumentId: document.id,
        sourcePage: document.pageStart,
        status: "needs_follow_up",
      });
    }
  }

  return {
    packetStatus: determinePacketStatus(flags),
    flags,
    deadlines,
    amendmentChanges,
  };
}

function hasDocument(documents: PacketDocument[], type: DocumentType) {
  return documents.some((document) => document.documentType === type && document.confidence >= 0.55);
}

function documentMatchesReference(documents: PacketDocument[], reference: ReferencedDocument) {
  const normalized = normalizeText(reference.label);
  const expectedType = referenceToDocumentType(normalized);

  if (expectedType && hasDocument(documents, expectedType)) {
    return true;
  }

  return documents.some((document) => {
    const filename = normalizeText(document.filename);
    const documentType = normalizeText(document.documentType);
    return filename.includes(normalized) || normalized.includes(documentType);
  });
}

function referenceToDocumentType(reference: string): DocumentType | null {
  if (reference.includes("inspection resolution") || reference.includes("repair addendum")) {
    return "inspection_resolution";
  }
  if (reference.includes("inspection notice")) {
    return "inspection_notice";
  }
  if (reference.includes("lead")) {
    return "lead_based_paint_disclosure";
  }
  if (reference.includes("hoa") || reference.includes("condo") || reference.includes("association")) {
    return "hoa_condo_documents";
  }
  if (reference.includes("personal property")) {
    return "personal_property_addendum";
  }
  if (reference.includes("warranty")) {
    return "home_warranty_addendum";
  }
  if (reference.includes("financing") || reference.includes("loan")) {
    return "financing_addendum";
  }
  return null;
}

function signatureFlag(category: FlagCategory, title: string, status: string): Omit<PacketFlag, "id" | "source" | "status"> & { status: PacketFlag["status"] } {
  const severity: FlagSeverity = status === "missing" ? "high" : "medium";

  return {
    category,
    severity,
    title,
    explanation: `The extraction pipeline marked this as ${status}. Do not treat this as complete without human verification.`,
    suggestedAction: "Review the source pages for complete signatures, initials, and execution dates.",
    confidence: status === "missing" ? 0.82 : 0.64,
    status: "needs_follow_up",
  };
}

function normalizeDeadlines(
  facts: RuleEngineInput["facts"],
  asOf: Date,
  addFlag: (flag: Omit<PacketFlag, "id" | "source" | "status"> & { status?: PacketFlag["status"] }) => void,
) {
  const extracted: ExtractedDeadline[] = [
    ...(facts.deadlines ?? []),
    deadlineFromFact("Earnest money due", facts.earnest_money_due_date),
    deadlineFromFact("Inspection deadline", facts.inspection_deadline),
    deadlineFromFact("Inspection resolution deadline", facts.inspection_resolution_deadline),
    deadlineFromFact("Title objection deadline", facts.title_objection_deadline),
  ].filter((deadline): deadline is NonNullable<typeof deadline> => Boolean(deadline));

  return extracted.map<DeadlineResult>((deadline) => {
    const riskStatus = classifyDeadline(deadline.date, asOf);

    if (riskStatus === "expired" || riskStatus === "ambiguous" || riskStatus === "due_soon") {
      addFlag({
        category: "deadline_risk",
        severity: riskStatus === "expired" ? "high" : "medium",
        title: `${deadline.name} is ${riskStatus === "ambiguous" ? "ambiguous" : riskStatus.replace("_", " ")}`,
        explanation:
          riskStatus === "ambiguous"
            ? "A deadline was referenced, but the date could not be extracted with confidence."
            : `Deadline date: ${deadline.date}. Verify current status before relying on this packet.`,
        suggestedAction: "Confirm the date against the signed documents and calendar any open obligations.",
        confidence: deadline.confidence,
        sourceDocumentId: deadline.sourceDocumentId,
        sourcePage: deadline.sourcePage,
        status: "needs_follow_up",
      });
    }

    return {
      ...deadline,
      riskStatus,
    };
  });
}

function deadlineFromFact(name: string, date?: string | null): ExtractedDeadline | null {
  if (date === undefined) {
    return null;
  }

  return {
    name,
    date,
    confidence: date ? 0.78 : 0.45,
  };
}

// Both the deadline and "today" are anchored to local noon so the day difference is robust
// to timezones/DST (the day boundary is 12h away from the comparison point either way).
export function classifyDeadline(date: string | null, asOf: Date): RiskStatus {
  const iso = toIsoDate(date);
  if (!iso) {
    return "ambiguous";
  }

  const deadlineDay = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(deadlineDay.getTime())) {
    return "ambiguous";
  }

  const today = new Date(`${isoToday(asOf)}T12:00:00`);
  const daysUntil = Math.round((deadlineDay.getTime() - today.getTime()) / deadlineDayMs);

  if (daysUntil < 0) {
    return "expired";
  }

  if (daysUntil <= 3) {
    return "due_soon";
  }

  return "open";
}

export function packetStatusFromFlags(flags: Pick<PacketFlag, "severity">[]): HealthCheckStatus {
  return determinePacketStatus(flags);
}

function determinePacketStatus(flags: Pick<PacketFlag, "severity">[]): HealthCheckStatus {
  if (flags.some((flag) => flag.severity === "high")) {
    return "high_risk";
  }

  if (flags.length > 0) {
    return "needs_review";
  }

  return "cleared";
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prettifyField(field: string) {
  return normalizeText(field).replace("purchase price", "purchase price");
}
