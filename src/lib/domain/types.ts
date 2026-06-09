export type PacketStatus =
  | "not_uploaded"
  | "processing"
  | "needs_review"
  | "cleared"
  | "error"
  | "high_risk";

export type HealthCheckStatus = "cleared" | "needs_review" | "high_risk" | "processing_error";

export type DocumentType =
  | "residential_sale_contract"
  | "counteroffer"
  | "amendment"
  | "inspection_notice"
  | "inspection_resolution"
  | "buyer_agency_agreement"
  | "listing_agreement"
  | "seller_disclosure"
  | "lead_based_paint_disclosure"
  | "earnest_money_receipt"
  | "financing_addendum"
  | "appraisal_addendum"
  | "fha_addendum"
  | "va_addendum"
  | "usda_addendum"
  | "conventional_financing_document"
  | "cash_proof_of_funds"
  | "hoa_condo_documents"
  | "septic_well_private_water_disclosure"
  | "personal_property_addendum"
  | "home_warranty_addendum"
  | "wire_fraud_notice"
  | "closing_instructions"
  | "title_document"
  | "unknown_document";

export type ReviewStatus = "open" | "resolved" | "false_positive" | "needs_follow_up";
export type ConfidenceStatus = "likely_complete" | "needs_review" | "missing" | "unknown";
export type FlagSeverity = "low" | "medium" | "high";

export type FlagCategory =
  | "missing_doc"
  | "signature_issue"
  | "date_issue"
  | "deadline_risk"
  | "conflicting_terms"
  | "unclear_terms"
  | "unknown_doc";

export type RiskStatus = "open" | "due_soon" | "expired" | "ambiguous" | "conflict";

export type PacketDocument = {
  id: string;
  filename: string;
  documentType: DocumentType;
  confidence: number;
  pageStart?: number | null;
  pageEnd?: number | null;
};

export type ReferencedDocument = {
  label: string;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  confidence: number;
};

export type ExtractedDeadline = {
  name: string;
  date: string | null;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  confidence: number;
};

export type AmendmentChange = {
  field: string;
  originalValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  controllingDocumentId: string;
  sourcePage?: number | null;
  confidence: number;
};

export type PacketFacts = {
  property_address: string | null;
  buyer_names: string[];
  seller_names: string[];
  listing_agent?: string | null;
  buyer_agent?: string | null;
  brokerage_names?: string[];
  purchase_price: number | null;
  earnest_money_amount?: number | null;
  earnest_money_due_date?: string | null;
  closing_date: string | null;
  possession_terms?: string | null;
  financing_type: string | null;
  loan_amount?: number | null;
  cash_or_financed: "cash" | "financed" | "unknown";
  appraisal_contingency?: boolean | null;
  inspection_deadline?: string | null;
  inspection_resolution_deadline?: string | null;
  title_objection_deadline?: string | null;
  home_warranty_terms?: string | null;
  seller_concessions?: string | number | null;
  personal_property_included?: string | null;
  property_year_built?: number | null;
  lead_based_paint_required?: boolean | null;
  hoa_or_condo?: boolean | null;
  septic_or_well?: boolean | null;
  amendments_present?: boolean | null;
  counteroffers_present?: boolean | null;
  referenced_documents: ReferencedDocument[];
  missing_referenced_documents?: ReferencedDocument[];
  signatures_detected: ConfidenceStatus;
  initials_detected: ConfidenceStatus;
  signature_issues?: string[];
  date_issues?: string[];
  conflicting_terms?: string[];
  special_agreements?: string[];
  risk_flags?: string[];
  deadlines?: ExtractedDeadline[];
  amendment_changes?: AmendmentChange[];
};

export type PacketFlag = {
  id: string;
  severity: FlagSeverity;
  category: FlagCategory;
  title: string;
  explanation: string;
  suggestedAction: string;
  status: ReviewStatus;
  confidence: number;
  source: "rule";
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  requiredDocument?: DocumentType;
};

export type DeadlineResult = ExtractedDeadline & {
  riskStatus: RiskStatus;
};

export type AmendmentReview = AmendmentChange & {
  needsHumanReview: boolean;
};

export type RuleEngineInput = {
  asOf: Date;
  documents: PacketDocument[];
  facts: PacketFacts;
};

export type RuleEngineResult = {
  packetStatus: HealthCheckStatus;
  flags: PacketFlag[];
  deadlines: DeadlineResult[];
  amendmentChanges: AmendmentReview[];
};

export type TransactionRecord = {
  id: string;
  organizationId: string;
  propertyAddress: string;
  buyerNames: string[];
  sellerNames: string[];
  agentTeam: string;
  closingDate: string | null;
  purchasePrice: number | null;
  financingType: string | null;
  status: PacketStatus;
  createdAt: string;
  updatedAt: string;
  notes: string[];
  extraction: {
    schemaVersion: string;
    rawTextSummary: string;
    documents: PacketDocument[];
    facts: PacketFacts;
  };
  health: RuleEngineResult;
};
