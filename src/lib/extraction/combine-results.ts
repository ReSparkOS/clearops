import type {
  AmendmentChange,
  ConfidenceStatus,
  ExtractedDeadline,
  PacketDocument,
  PacketFacts,
  ReferencedDocument,
} from "@/lib/domain/types";
import { runMissouriResidentialRules } from "@/lib/rules/missouri";
import { packetExtractionSchema, type ExtractionPipelineResult } from "./pipeline";

export function combinePipelineResults(
  results: ExtractionPipelineResult[],
  asOf = new Date(),
): ExtractionPipelineResult | null {
  if (results.length === 0) {
    return null;
  }

  const successfulResults = results.filter((result) => result.mode !== "failed");
  if (successfulResults.length === 0) {
    return results.at(-1) ?? null;
  }

  const documents: PacketDocument[] = [];
  const facts: PacketFacts[] = [];

  successfulResults.forEach((result, resultIndex) => {
    const idMap = new Map<string, string>();

    result.extraction.documents.forEach((document) => {
      const scopedId = `file-${resultIndex + 1}-${document.id}`;
      idMap.set(document.id, scopedId);
      documents.push({ ...document, id: scopedId });
    });

    facts.push(remapDocumentReferences(result.extraction.facts, idMap));
  });

  const extraction = packetExtractionSchema.parse({
    schemaVersion: successfulResults[0]?.extraction.schemaVersion ?? "1.0",
    rawTextSummary: successfulResults
      .map((result) => `${result.extraction.documents[0]?.filename ?? "Uploaded PDF"}: ${result.extraction.rawTextSummary}`)
      .join("\n"),
    documents,
    facts: mergePacketFacts(facts),
  });
  const health = runMissouriResidentialRules({
    asOf,
    documents: extraction.documents,
    facts: extraction.facts,
  });

  return {
    mode: successfulResults[0].mode,
    extraction,
    health,
    rawResponse: successfulResults.map((result) => result.rawResponse),
    extractedText: successfulResults.map((result) => result.extractedText).filter(Boolean).join("\n\n"),
  };
}

function mergePacketFacts(facts: PacketFacts[]): PacketFacts {
  return packetFactsSchemaParse({
    property_address: firstString(facts.map((fact) => fact.property_address)),
    buyer_names: uniqueStrings(facts.flatMap((fact) => fact.buyer_names)),
    seller_names: uniqueStrings(facts.flatMap((fact) => fact.seller_names)),
    listing_agent: firstString(facts.map((fact) => fact.listing_agent)),
    buyer_agent: firstString(facts.map((fact) => fact.buyer_agent)),
    brokerage_names: uniqueStrings(facts.flatMap((fact) => fact.brokerage_names ?? [])),
    purchase_price: firstNumber(facts.map((fact) => fact.purchase_price)),
    earnest_money_amount: firstNumber(facts.map((fact) => fact.earnest_money_amount)),
    earnest_money_due_date: firstString(facts.map((fact) => fact.earnest_money_due_date)),
    closing_date: firstString(facts.map((fact) => fact.closing_date)),
    possession_terms: firstString(facts.map((fact) => fact.possession_terms)),
    financing_type: firstString(facts.map((fact) => fact.financing_type)),
    loan_amount: firstNumber(facts.map((fact) => fact.loan_amount)),
    cash_or_financed: firstCashOrFinanced(facts),
    appraisal_contingency: combineBoolean(facts.map((fact) => fact.appraisal_contingency)),
    inspection_deadline: firstString(facts.map((fact) => fact.inspection_deadline)),
    inspection_resolution_deadline: firstString(facts.map((fact) => fact.inspection_resolution_deadline)),
    title_objection_deadline: firstString(facts.map((fact) => fact.title_objection_deadline)),
    home_warranty_terms: firstString(facts.map((fact) => fact.home_warranty_terms)),
    seller_concessions: firstTerm(facts.map((fact) => fact.seller_concessions)),
    personal_property_included: firstString(facts.map((fact) => fact.personal_property_included)),
    property_year_built: firstNumber(facts.map((fact) => fact.property_year_built)),
    lead_based_paint_required: combineBoolean(facts.map((fact) => fact.lead_based_paint_required)),
    hoa_or_condo: combineBoolean(facts.map((fact) => fact.hoa_or_condo)),
    septic_or_well: combineBoolean(facts.map((fact) => fact.septic_or_well)),
    amendments_present: combineBoolean(facts.map((fact) => fact.amendments_present)),
    counteroffers_present: combineBoolean(facts.map((fact) => fact.counteroffers_present)),
    referenced_documents: uniqueByReference(facts.flatMap((fact) => fact.referenced_documents)),
    missing_referenced_documents: uniqueByReference(facts.flatMap((fact) => fact.missing_referenced_documents ?? [])),
    signatures_detected: worstConfidenceStatus(facts.map((fact) => fact.signatures_detected)),
    initials_detected: worstConfidenceStatus(facts.map((fact) => fact.initials_detected)),
    signature_issues: uniqueStrings(facts.flatMap((fact) => fact.signature_issues ?? [])),
    date_issues: uniqueStrings(facts.flatMap((fact) => fact.date_issues ?? [])),
    conflicting_terms: uniqueStrings(facts.flatMap((fact) => fact.conflicting_terms ?? [])),
    special_agreements: uniqueStrings(facts.flatMap((fact) => fact.special_agreements ?? [])),
    risk_flags: uniqueStrings(facts.flatMap((fact) => fact.risk_flags ?? [])),
    deadlines: uniqueByDeadline(facts.flatMap((fact) => fact.deadlines ?? [])),
    amendment_changes: uniqueByAmendment(facts.flatMap((fact) => fact.amendment_changes ?? [])),
  });
}

function packetFactsSchemaParse(input: PacketFacts) {
  return packetExtractionSchema.shape.facts.parse(input);
}

function remapDocumentReferences(facts: PacketFacts, idMap: Map<string, string>): PacketFacts {
  const remapId = (id: string | null | undefined) => (id ? idMap.get(id) ?? id : id);

  return {
    ...facts,
    referenced_documents: facts.referenced_documents.map((reference) => ({
      ...reference,
      sourceDocumentId: remapId(reference.sourceDocumentId),
    })),
    missing_referenced_documents: facts.missing_referenced_documents?.map((reference) => ({
      ...reference,
      sourceDocumentId: remapId(reference.sourceDocumentId),
    })),
    deadlines: facts.deadlines?.map((deadline) => ({
      ...deadline,
      sourceDocumentId: remapId(deadline.sourceDocumentId),
    })),
    amendment_changes: facts.amendment_changes?.map((change) => ({
      ...change,
      controllingDocumentId: remapId(change.controllingDocumentId) ?? change.controllingDocumentId,
    })),
  };
}

function firstString(values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

function firstNumber(values: Array<number | null | undefined>) {
  return values.find((value) => typeof value === "number") ?? null;
}

function firstTerm(values: Array<string | number | null | undefined>) {
  return values.find((value) => value !== null && typeof value !== "undefined" && value !== "") ?? null;
}

function firstCashOrFinanced(facts: PacketFacts[]) {
  return facts.find((fact) => fact.cash_or_financed !== "unknown")?.cash_or_financed ?? "unknown";
}

function combineBoolean(values: Array<boolean | null | undefined>) {
  if (values.some((value) => value === true)) {
    return true;
  }
  if (values.some((value) => value === false)) {
    return false;
  }
  return null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function uniqueByReference(values: ReferencedDocument[]) {
  return uniqueBy(values, (value) => `${value.label}:${value.sourceDocumentId ?? ""}:${value.sourcePage ?? ""}`);
}

function uniqueByDeadline(values: ExtractedDeadline[]) {
  return uniqueBy(values, (value) => `${value.name}:${value.date ?? ""}:${value.sourceDocumentId ?? ""}:${value.sourcePage ?? ""}`);
}

function uniqueByAmendment(values: AmendmentChange[]) {
  return uniqueBy(values, (value) => `${value.field}:${value.controllingDocumentId}:${value.sourcePage ?? ""}`);
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function worstConfidenceStatus(values: ConfidenceStatus[]): ConfidenceStatus {
  const rank: Record<ConfidenceStatus, number> = {
    missing: 4,
    needs_review: 3,
    unknown: 2,
    likely_complete: 1,
  };

  return values.reduce<ConfidenceStatus>(
    (worst, value) => (rank[value] > rank[worst] ? value : worst),
    "likely_complete",
  );
}
