import type { AuditGoogleData } from "@/lib/audit/google/types";
import type { VerticalKey } from "@/lib/audit/google/types";
import {
  canonicalizeService,
  getIndustrySourceWeights,
  getServiceBoostForVertical,
  getServiceSpecificity,
  isGenericServiceValue,
  normalizeServiceText,
} from "@/lib/audit/service-taxonomy";
import { isBroadServiceTerm } from "@/lib/audit/broad-service-terms";
import {
  hasManufacturerSignalText,
  inferDetailedManufacturerService,
} from "@/lib/audit/manufacturer-detail-rules";
import {
  hasVisionSignalText,
  inferDetailedVisionService,
} from "@/lib/audit/vision-detail-rules";
import {
  hasRetailSignalText,
  inferDetailedRetailService,
} from "@/lib/audit/retail-detail-rules";
import { inferWindowTreatmentService } from "@/lib/audit/window-treatment-detail-rules";
import {
  generateServiceCandidates,
  pickTopComprehensiveService,
} from "@/lib/audit/service-candidate-generator";

export interface ServiceReconciliationResult {
  gs_service: string;
  bs_service: string;
  cs_recommended_service: string;
  cs_confidence: number;
  cs_reason_codes: string[];
}

const GOOGLE_TYPE_TO_SERVICE: Array<{ types: readonly string[]; service: string }> = [
  { types: ["acupuncture", "traditional_chinese_medicine"], service: "acupuncture" },
  { types: ["dentist", "dental_clinic"], service: "dentist" },
  { types: ["pediatric_dentist"], service: "pediatric dentist" },
  { types: ["orthodontist"], service: "orthodontist" },
  { types: ["optometrist"], service: "optometry clinic" },
  { types: ["optician"], service: "optician" },
  { types: ["sunglasses_store"], service: "eyewear store" },
  { types: ["ophthalmologist"], service: "ophthalmology clinic" },
  { types: ["hvac_contractor"], service: "hvac contractor" },
  { types: ["air_conditioning_contractor"], service: "hvac contractor" },
  { types: ["heating_contractor"], service: "hvac contractor" },
  { types: ["lawyer", "attorney"], service: "lawyer" },
  { types: ["immigration_lawyer"], service: "immigration lawyer" },
  { types: ["real_estate_agency"], service: "real estate agent" },
  { types: ["insurance_agency"], service: "insurance agent" },
  { types: ["restaurant"], service: "restaurant" },
  { types: ["cafe", "coffee_shop"], service: "coffee shop" },
  { types: ["hotel", "lodging"], service: "hotel" },
  { types: ["general_contractor"], service: "contractor" },
  { types: ["kitchen_remodeler"], service: "kitchen remodeler" },
  { types: ["cabinet_maker"], service: "cabinet maker" },
  { types: ["manufacturer"], service: "manufacturer" },
  { types: ["auto_repair", "car_repair"], service: "auto repair" },
  { types: ["beauty_salon"], service: "beauty salon" },
  { types: ["spa"], service: "day spa" },
];

const DEFAULT_SERVICE_BY_VERTICAL: Record<VerticalKey, string> = {
  tcm_clinic: "acupuncture",
  dental: "dentist",
  legal_immigration: "immigration lawyer",
  restaurant: "restaurant",
  real_estate: "real estate agent",
  hotel: "hotel",
  auto: "auto repair",
  contractor: "contractor",
  salon_spa: "day spa",
  cafe: "coffee shop",
  apparel: "clothing store",
  health_food: "health food store",
  insurance: "insurance agent",
  general_smb: "local business",
};

const TEXT_SIGNAL_PATTERNS: Array<{
  pattern: RegExp;
  service: string;
  verticals?: readonly VerticalKey[];
}> = [
  {
    pattern: /\b(dermatolog(y|ist)|skin specialist|skin clinic)\b/i,
    service: "dermatology clinic",
  },
  {
    pattern: /\b(jewelers?|jewellery|jewelry|diamonds?|watch(es)?)\b/i,
    service: "jewelry store",
  },
  {
    pattern:
      /\b(phone|cell phone|iphone|android|mobile)\b.*\b(repair|fix|screen)\b|\b(repair|fix)\b.*\b(phone|cell phone|iphone|android|mobile)\b/i,
    service: "phone repair service",
  },
  {
    pattern:
      /\b(computer|laptop|pc|macbook)\b.*\b(repair|fix)\b|\b(repair|fix)\b.*\b(computer|laptop|pc|macbook)\b/i,
    service: "computer repair service",
  },
  {
    pattern: /\b(laundromat|laundry|dry clean(ing)?|dry cleaner)\b/i,
    service: "laundry service",
  },
  {
    pattern:
      /\b(house cleaning|home cleaning|commercial cleaning|office cleaning|janitorial|maid service|deep cleaning|cleaning (service|services|company|crew|chief))\b/i,
    service: "cleaning service",
  },
  {
    pattern: /\b(photo(graphy)?|portrait studio|photo studio|videography|self-portrait)\b/i,
    service: "photography studio",
  },
  {
    pattern: /\b(print(ing)?|print shop|commercial printer|copy shop|copy center|offset print)\b/i,
    service: "print shop",
  },
  {
    pattern: /\b(piano(s)?|grand piano|upright piano|piano dealer|piano showroom|piano shop)\b/i,
    service: "piano store",
  },
  {
    pattern: /\b(tailor(ing)?|alterations?|seamstress)\b/i,
    service: "tailor shop",
  },
  {
    pattern: /\b(arcade|claw machine|anime claw)\b/i,
    service: "arcade",
  },
  {
    pattern:
      /\b(ups store|mailboxes?|shipping (center|store|service)|mailing (service|center)|postal (service|office)|courier (service|company)|pack(?:ing)? and ship|fedex|usps|dhl)\b/i,
    service: "shipping and mailing service",
  },
  {
    pattern: /\b(zoo)\b/i,
    service: "zoo",
  },
  {
    pattern: /\b(national park|state park|city park|public park|recreation park|park district|playground)\b/i,
    service: "park",
  },
  {
    pattern: /\b(church|cathedral|basilica)\b/i,
    service: "church",
  },
  {
    pattern: /\b(buddhist temple|monastery)\b/i,
    service: "buddhist temple",
  },
  {
    pattern: /\b(hindu temple)\b/i,
    service: "hindu temple",
  },
  {
    pattern: /\b(historical landmark|historic landmark|observation deck|tourist attraction|monument)\b/i,
    service: "historical landmark",
  },
  {
    pattern: /\b(petco|pet store)\b/i,
    service: "pet store",
  },
  {
    pattern: /\b(animal rescue|pet rescue)\b/i,
    service: "pet care",
  },
  {
    pattern: /\b(pet adoption|pet adoption center|animal adoption)\b/i,
    service: "pet care",
  },
  {
    pattern:
      /\b(digital marketing|marketing agency|seo (agency|services?|consult(ant|ing))|web design (agency|studio|services?)|branding agency|advertising agency)\b/i,
    service: "marketing consultant",
  },
  {
    pattern: /\b(travel agency|tour operator|travel advisor|flight booking|vacation packages?)\b/i,
    service: "travel agency",
  },
  {
    pattern: /\b(bridal|wedding gown|wedding dress)\b/i,
    service: "bridal boutique",
  },
  {
    pattern: /\b(acupuncture|traditional chinese medicine|tcm)\b/i,
    service: "acupuncture",
  },
  {
    pattern:
      /\b(immigration (law|lawyer|attorney|services?)|immigration lawyer|visa (lawyer|attorney|consultant|services?)|asylum (lawyer|attorney|services?))\b/i,
    service: "immigration lawyer",
  },
  {
    pattern: /\b(orthodontic|orthodontist|invisalign|braces)\b/i,
    service: "orthodontist",
  },
  {
    pattern: /\b(pediatric dentist|kids dentist)\b/i,
    service: "pediatric dentist",
  },
  {
    pattern: /\b(ophthalmolog(y|ist)|retina specialist|cataract|lasik)\b/i,
    service: "ophthalmology clinic",
  },
  {
    pattern: /\b(optometr(y|ist)|eye exams?|vision care|vision center)\b/i,
    service: "optometry clinic",
  },
  {
    pattern: /\b(optician|contact lenses?)\b/i,
    service: "optician",
  },
  {
    pattern: /\b(eyewear|eyeglasses?|glasses|spectacles|sunglasses)\b/i,
    service: "eyewear store",
  },
  {
    pattern:
      /\b(business coach|business coaching|executive coach|growth coach|business consultant|business consulting)\b/i,
    service: "business coach",
  },
  {
    pattern: /\b(management consultant|management consulting|strategy consultant)\b/i,
    service: "management consultant",
  },
  {
    pattern: /\b(marketing consultant|marketing consulting|marketing advisor)\b/i,
    service: "marketing consultant",
  },
  {
    pattern:
      /\b(mortgage broker|home loan|mortgage lender|loan agency|lending company|loan company|loan service)\b/i,
    service: "loan agency",
  },
  {
    pattern: /\b(financial advisor|financial planner|wealth advisor|wealth management)\b/i,
    service: "financial planner",
  },
  {
    pattern:
      /\b(tutor|tutoring|training school|learning center|learning centre|education center|education centre)\b/i,
    service: "tutoring service",
  },
  {
    pattern: /\b(test prep|prep school|sat prep|esl|after school)\b/i,
    service: "tutoring service",
  },
  {
    pattern:
      /\b(driving school|auto school|driver training|driving lessons?|driving academy)\b/i,
    service: "driving school",
  },
  {
    pattern: /\b(translation|translator|interpretation|localization services?)\b/i,
    service: "translation service",
  },
  {
    pattern: /\b(property management|property manager)\b/i,
    service: "property management service",
  },
  {
    pattern: /\b(tailor(ing)?|alterations?|seamstress)\b/i,
    service: "tailor shop",
  },
  {
    pattern: /\b(plumb(er|ing)|sewer|drain cleaning)\b/i,
    service: "plumbing service",
    verticals: ["contractor", "general_smb"],
  },
  {
    pattern: /\b(car dealership|car dealer|auto sales|used car|new car)\b/i,
    service: "car dealer",
    verticals: ["auto"],
  },
  {
    pattern:
      /\b(personal injury|car accident|accident lawyer|injury lawyer|slip and fall)\b/i,
    service: "personal injury lawyer",
    verticals: ["legal_immigration"],
  },
  {
    pattern: /\b(vocational school|trade school|skills training|career training)\b/i,
    service: "vocational training center",
  },
  {
    pattern: /\b(language school|esl school|english school|language academy)\b/i,
    service: "language school",
  },
  {
    pattern:
      /\b(hvac|air conditioning|a\/c|heating\s*(and|&)\s*cooling|cooling\s*(and|&)\s*heating|furnace|heat pump|duct(work)?|ventilation)\b/i,
    service: "hvac contractor",
    verticals: ["contractor"],
  },
  {
    pattern: /\b(kitchen remodel|renovation|kitchen & bath|kitchen and bath)\b/i,
    service: "kitchen remodeler",
  },
  {
    pattern: /\b(day spa|spa|wellness spa)\b/i,
    service: "day spa",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(massage|reflexology)\b/i,
    service: "massage therapist",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(nail salon|manicure|pedicure)\b/i,
    service: "nail salon",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(hair salon|hairstylist|haircut)\b/i,
    service: "hair salon",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(barber)\b/i,
    service: "barber shop",
    verticals: ["salon_spa"],
  },
  {
    pattern: /\b(cafe|coffee)\b/i,
    service: "coffee shop",
    verticals: ["cafe"],
  },
  {
    pattern: /\b(real estate|realtor)\b/i,
    service: "real estate agent",
    verticals: ["real_estate"],
  },
  {
    pattern: /\b(insurance (agency|agent|broker|company|office|services?)|independent insurance)\b/i,
    service: "insurance agent",
    verticals: ["insurance"],
  },
  {
    pattern: /\b(hotel|inn|lodging)\b/i,
    service: "hotel",
    verticals: ["hotel"],
  },
  {
    pattern: /\b(oriental|persian)\s*(rugs?|carpets?)\b/i,
    service: "oriental rug store",
  },
  {
    pattern:
      /\b(area\s*rugs?|rugs?|carpets?)\s*(store|shop|gallery|showroom|boutique)\b/i,
    service: "oriental rug store",
  },
  {
    pattern: /\b(rug|carpet)\s*clean(ing|er|ers)?\b/i,
    service: "carpet cleaning service",
  },
  {
    pattern: /\b(rug|carpet)\s*repair(s|ing)?\b/i,
    service: "carpet repair service",
  },
];

function normalizeService(input: string | null | undefined) {
  return normalizeServiceText(input);
}

function specificityScore(service: string) {
  return getServiceSpecificity(service);
}

function isGenericService(service: string) {
  return isGenericServiceValue(service);
}

function deriveGsService(google: AuditGoogleData) {
  const types = google.vertical.google_categories ?? [];
  for (const type of types) {
    const mapped = GOOGLE_TYPE_TO_SERVICE.find((entry) => entry.types.includes(type));
    if (mapped) return mapped.service;
  }

  const display = normalizeService(google.vertical.primary_category_display ?? "");
  if (display) return display;

  const primaryType = normalizeService(google.vertical.primary_category ?? "").replace(/_/g, " ");
  if (primaryType) return primaryType;

  return DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical] ?? "local business";
}

export function reconcileServiceDecision({
  google,
  bsService,
  gbpDescription,
  websiteSignalText,
}: {
  google: AuditGoogleData;
  bsService: string;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
}): ServiceReconciliationResult {
  const gsServiceRaw = deriveGsService(google);
  const gsService = canonicalizeService(gsServiceRaw);
  const seedBsService =
    canonicalizeService(bsService) ||
    canonicalizeService(DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical]);
  const comprehensiveTop = pickTopComprehensiveService({
    google,
    gbpDescription,
    websiteSignalText,
    seedService: seedBsService,
  });
  const bsServiceNormalized =
    comprehensiveTop?.service ||
    seedBsService ||
    canonicalizeService(DEFAULT_SERVICE_BY_VERTICAL[google.vertical.inferred_vertical]);
  const generatedCandidates = generateServiceCandidates({
    google,
    gbpDescription,
    websiteSignalText,
    seedService: seedBsService,
  });
  const topGeneratedCandidate = generatedCandidates[0];
  const topGeneratedService = canonicalizeService(topGeneratedCandidate?.service);
  const secondGeneratedService = canonicalizeService(generatedCandidates[1]?.service);
  const strongTopLockActive = isStrongTopCandidate(
    topGeneratedCandidate,
    google.vertical.inferred_vertical,
  );
  const strongTopAllowlist = new Set<string>();
  if (strongTopLockActive && topGeneratedService) {
    strongTopAllowlist.add(topGeneratedService);
    if (
      secondGeneratedService &&
      isStrongTopSecondaryCandidate(generatedCandidates[1], google.vertical.inferred_vertical)
    ) {
      strongTopAllowlist.add(secondGeneratedService);
    }
  }

  const gsScore = specificityScore(gsService);
  const bsScore = specificityScore(bsServiceNormalized);

  const reasonCodes: string[] = [];
  if (comprehensiveTop && comprehensiveTop.service !== seedBsService) {
    reasonCodes.push("prefer_comprehensive_candidate");
  }
  let recommended = bsServiceNormalized;
  let confidence = Math.max(0.74, comprehensiveTop?.confidence ?? 0.74);
  reasonCodes.push("prefer_bs_primary_signal");

  if (gsService === bsServiceNormalized) {
    reasonCodes.push("gs_bs_match");
    confidence = Math.max(confidence, 0.9);
  } else if (isGenericService(gsService) && !isGenericService(bsServiceNormalized)) {
    reasonCodes.push("prefer_bs_non_generic");
    confidence = Math.max(confidence, 0.82);
  } else if (bsScore > gsScore) {
    reasonCodes.push("prefer_bs_more_specific");
    confidence = Math.max(confidence, bsScore - gsScore >= 2 ? 0.88 : 0.8);
  } else {
    reasonCodes.push("gs_used_as_weak_hint");
  }

  const gbpDescriptionSignal = inferServiceFromTextSignals(
    gbpDescription,
    google.vertical.inferred_vertical,
  );
  const websiteSignal = inferServiceFromTextSignals(
    websiteSignalText,
    google.vertical.inferred_vertical,
  );
  const businessNameSignal = inferServiceFromTextSignals(
    google.business.name,
    google.vertical.inferred_vertical,
  );
  const signalServices = [businessNameSignal, gbpDescriptionSignal, websiteSignal];
  const canOverrideTo = (
    targetService: string,
    weightedSources?: Set<string>,
  ) =>
    hasMultiSourceOverrideEvidence({
      targetService,
      signalServices,
      generatedCandidates,
      weightedSources,
    });
  if (businessNameSignal) {
    reasonCodes.push("business_name_signal");
  }
  if (gbpDescriptionSignal) {
    reasonCodes.push("gbp_description_signal");
  }
  if (websiteSignal) {
    reasonCodes.push("website_signal");
  }

  const externalCandidate = pickExternalCandidate([
    businessNameSignal,
    gbpDescriptionSignal,
    websiteSignal,
  ]);
  if (externalCandidate) {
    const candidateScore = specificityScore(externalCandidate.service);
    if (externalCandidate.count >= 2) {
      if (canOverrideTo(externalCandidate.service)) {
        reasonCodes.push("prefer_external_consensus");
        recommended = externalCandidate.service;
        confidence = Math.max(confidence, 0.87);
      } else {
        reasonCodes.push("external_consensus_insufficient_evidence");
      }
    } else if (externalCandidate.service === gsService && gsService !== bsServiceNormalized) {
      if (
        isBroadService(recommended, google.vertical.inferred_vertical) &&
        !isBroadService(gsService, google.vertical.inferred_vertical) &&
        candidateScore >= 3 &&
        canOverrideTo(gsService)
      ) {
        reasonCodes.push("external_supports_specific_gs");
        recommended = gsService;
        confidence = Math.max(confidence, 0.81);
      } else {
        reasonCodes.push("external_signal_observed");
      }
    } else if (externalCandidate.service === bsServiceNormalized && gsService !== bsServiceNormalized) {
      reasonCodes.push("external_supports_bs");
      recommended = bsServiceNormalized;
      confidence = Math.max(confidence, 0.81);
    } else if (
      candidateScore >= 3 &&
      confidence <= 0.82 &&
      canOverrideTo(externalCandidate.service)
    ) {
      reasonCodes.push("prefer_external_specific_signal");
      recommended = externalCandidate.service;
      confidence = Math.max(confidence, 0.76);
    } else {
      reasonCodes.push("external_signal_observed");
    }
  }

  const detailedIndustryCandidate = inferDetailedIndustryCandidate({
    google,
    gbpDescription,
    websiteSignalText,
    gsService,
    bsService: bsServiceNormalized,
  });
  if (
    detailedIndustryCandidate &&
    shouldPreferDetailedIndustry(detailedIndustryCandidate, recommended) &&
    canOverrideTo(detailedIndustryCandidate)
  ) {
    reasonCodes.push("prefer_detailed_industry");
    recommended = detailedIndustryCandidate;
    confidence = Math.max(confidence, 0.89);
  } else if (
    detailedIndustryCandidate &&
    shouldPreferDetailedIndustry(detailedIndustryCandidate, recommended)
  ) {
    reasonCodes.push("detailed_industry_insufficient_evidence");
  }

  const weightedCandidate = pickWeightedCandidate({
    vertical: google.vertical.inferred_vertical,
    gsService,
    bsService: bsServiceNormalized,
    gbpService: gbpDescriptionSignal,
    websiteService: websiteSignal,
    nameService: businessNameSignal,
    detailService: detailedIndustryCandidate,
    generatedCandidates,
  });
  if (
    weightedCandidate &&
    shouldPreferWeightedCandidate(weightedCandidate, recommended, confidence) &&
    canOverrideTo(weightedCandidate.service, weightedCandidate.sources)
  ) {
    reasonCodes.push("prefer_weighted_service_model");
    recommended = weightedCandidate.service;
    confidence = Math.max(confidence, weightedCandidate.confidence);
  } else if (
    weightedCandidate &&
    shouldPreferWeightedCandidate(weightedCandidate, recommended, confidence)
  ) {
    reasonCodes.push("weighted_override_insufficient_evidence");
  }

  const guardrailedRecommendation = applyVerticalGuardrail({
    vertical: google.vertical.inferred_vertical,
    recommended,
    gsService,
    bsService: bsServiceNormalized,
    businessName: google.business.name,
    textBlob: normalizeEvidenceText(
      [
        google.business.name,
        google.business.description ?? "",
        gbpDescription ?? "",
        websiteSignalText ?? "",
      ].join(" "),
    ),
  });
  if (guardrailedRecommendation !== recommended) {
    if (canOverrideTo(guardrailedRecommendation)) {
      reasonCodes.push("vertical_guardrail_applied");
      recommended = guardrailedRecommendation;
      confidence = Math.max(confidence, 0.87);
    } else {
      reasonCodes.push("guardrail_override_insufficient_evidence");
    }
  }

  if (comprehensiveTop && canonicalizeService(recommended) === comprehensiveTop.service) {
    if (comprehensiveTop.confidence > confidence) {
      reasonCodes.push("comprehensive_confidence_support");
      confidence = Math.max(confidence, comprehensiveTop.confidence);
    }
  }

  // Global policy: block broad output whenever we can recover a specific candidate.
  if (isBroadService(recommended, google.vertical.inferred_vertical)) {
    const specificGenerated = generatedCandidates.find(
      (candidate) =>
        !isBroadService(candidate.service, google.vertical.inferred_vertical) &&
        isServiceCompatibleWithVertical(
          candidate.service,
          google.vertical.inferred_vertical,
        ) &&
        candidate.specificity >= 3 &&
        candidate.confidence >= 0.68,
    );
    if (specificGenerated) {
      reasonCodes.push("broad_service_blocked_specific_promoted");
      recommended = canonicalizeService(specificGenerated.service);
      confidence = Math.max(confidence, specificGenerated.confidence);
    } else {
      reasonCodes.push("broad_service_needs_user_selection");
      confidence = Math.min(confidence, 0.61);
    }
  }

  if (strongTopLockActive && topGeneratedService) {
    const finalService = canonicalizeService(recommended);
    const hasStrongOverrideEvidence = hasHighConfidenceOverrideEvidence({
      targetService: finalService,
      signalServices,
      generatedCandidates,
    });
    if (
      finalService &&
      !strongTopAllowlist.has(finalService) &&
      !hasStrongOverrideEvidence
    ) {
      reasonCodes.push("strong_top_candidate_lock_applied");
      recommended = topGeneratedService;
      confidence = Math.max(confidence, topGeneratedCandidate?.confidence ?? 0.84);
    }
  }

  if (!reasonCodes.length) {
    reasonCodes.push("default_resolution");
  }

  return {
    gs_service: gsService || "local business",
    bs_service: bsServiceNormalized || "local business",
    cs_recommended_service: recommended || "local business",
    cs_confidence: Number(confidence.toFixed(2)),
    cs_reason_codes: reasonCodes,
  };
}

function inferDetailedIndustryCandidate({
  google,
  gbpDescription,
  websiteSignalText,
  gsService,
  bsService,
}: {
  google: AuditGoogleData;
  gbpDescription?: string | null;
  websiteSignalText?: string | null;
  gsService: string;
  bsService: string;
}) {
  const categoriesText = (google.vertical.google_categories ?? [])
    .map((category) => category.replace(/_/g, " "))
    .join(" ");
  const websiteKeywordSignal = extractWebsiteKeywordSignal(google.business.website);
  const textBlob = normalizeEvidenceText(
    [
      google.business.name,
      google.business.description ?? "",
      google.vertical.primary_category_display ?? "",
      google.vertical.primary_category ?? "",
      categoriesText,
      gbpDescription ?? "",
      websiteSignalText ?? "",
      websiteKeywordSignal,
      gsService,
      bsService,
    ].join(" "),
  );

  const visionCandidate = inferDetailedVisionService({
    text: textBlob,
    hasVisionSignal: hasVisionSignalText(textBlob),
  });
  if (visionCandidate) {
    return canonicalizeService(visionCandidate);
  }

  const windowTreatmentCandidate = inferWindowTreatmentService({
    text: textBlob,
    vertical: google.vertical.inferred_vertical,
  });
  if (windowTreatmentCandidate) {
    return canonicalizeService(windowTreatmentCandidate);
  }

  const hasManufacturerType =
    google.vertical.primary_category === "manufacturer" ||
    (google.vertical.google_categories ?? []).includes("manufacturer");
  const manufacturerCandidate = inferDetailedManufacturerService({
    text: textBlob,
    hasManufacturerSignal: hasManufacturerSignalText(textBlob, hasManufacturerType),
  });
  if (manufacturerCandidate) {
    return canonicalizeService(manufacturerCandidate);
  }

  const retailCandidate = inferDetailedRetailService({
    text: textBlob,
    hasRetailSignal: hasRetailSignalText(textBlob),
  });
  if (retailCandidate) {
    return canonicalizeService(retailCandidate);
  }

  const hasCabinetSignal =
    /\b(kitchen cabinets?|cabinets?|cabinetry|millwork|joinery)\b/.test(textBlob);
  if (hasCabinetSignal && /(contractor|builder)/.test(textBlob)) {
    return canonicalizeService("cabinet maker");
  }
  return "";
}

function shouldPreferDetailedIndustry(candidate: string, current: string) {
  const next = normalizeService(candidate);
  const now = normalizeService(current);
  if (!next || next === now) return false;
  if (
    [
      "manufacturer",
      "contractor",
      "cabinet maker",
      "health",
      "medical clinic",
      "eye doctor",
    ].includes(now)
  ) {
    return true;
  }
  return specificityScore(next) > specificityScore(now);
}

function inferServiceFromTextSignals(
  text: string | null | undefined,
  vertical: VerticalKey,
) {
  const normalized = normalizeEvidenceText(text);
  if (!normalized || normalized.length < 12) return "";
  const visionCandidate = inferDetailedVisionService({
    text: normalized,
    hasVisionSignal: hasVisionSignalText(normalized),
  });
  if (visionCandidate) return canonicalizeService(visionCandidate);
  const windowTreatmentCandidate = inferWindowTreatmentService({
    text: normalized,
    vertical,
  });
  if (windowTreatmentCandidate) return canonicalizeService(windowTreatmentCandidate);
  const retailCandidate = inferDetailedRetailService({
    text: normalized,
    hasRetailSignal: hasRetailSignalText(normalized),
  });
  if (retailCandidate) return canonicalizeService(retailCandidate);
  for (const pattern of TEXT_SIGNAL_PATTERNS) {
    if (pattern.verticals && !pattern.verticals.includes(vertical)) continue;
    if (pattern.pattern.test(normalized)) return canonicalizeService(pattern.service);
  }
  const manufacturerCandidate = inferDetailedManufacturerService({
    text: normalized,
    hasManufacturerSignal: hasManufacturerSignalText(normalized),
  });
  if (manufacturerCandidate) return canonicalizeService(manufacturerCandidate);
  if (hasManufacturerSignalText(normalized)) return canonicalizeService("manufacturer");
  return "";
}

function pickExternalCandidate(services: string[]) {
  const normalized = services
    .map((service) => canonicalizeService(service))
    .filter(Boolean);
  if (normalized.length === 0) return null;

  const counts = new Map<string, number>();
  for (const service of normalized) {
    counts.set(service, (counts.get(service) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([service, count]) => ({ service, count, score: specificityScore(service) }))
    .sort((a, b) => b.count - a.count || b.score - a.score || b.service.length - a.service.length)[0];
}

function isStrongTopCandidate(
  candidate:
    | {
        service: string;
        confidence: number;
        specificity: number;
      }
    | undefined,
  vertical: VerticalKey,
) {
  if (!candidate) return false;
  const canonical = canonicalizeService(candidate.service);
  if (!canonical) return false;
  if (isBroadService(canonical, vertical)) return false;
  if (!isServiceCompatibleWithVertical(canonical, vertical)) return false;
  return candidate.specificity >= 4 && candidate.confidence >= 0.82;
}

function isStrongTopSecondaryCandidate(
  candidate:
    | {
        service: string;
        confidence: number;
        specificity: number;
      }
    | undefined,
  vertical: VerticalKey,
) {
  if (!candidate) return false;
  const canonical = canonicalizeService(candidate.service);
  if (!canonical) return false;
  if (isBroadService(canonical, vertical)) return false;
  if (!isServiceCompatibleWithVertical(canonical, vertical)) return false;
  return candidate.specificity >= 3 && candidate.confidence >= 0.74;
}

function countMatchingSignalServices(targetService: string, signalServices: string[]) {
  const canonicalTarget = canonicalizeService(targetService);
  if (!canonicalTarget) return 0;
  return signalServices.reduce((count, signalService) => {
    return canonicalizeService(signalService) === canonicalTarget ? count + 1 : count;
  }, 0);
}

function getGeneratedSupportSourceCount(
  targetService: string,
  generatedCandidates: Array<{
    service: string;
    sources: string[];
  }>,
) {
  const canonicalTarget = canonicalizeService(targetService);
  if (!canonicalTarget) return 0;
  const matched = generatedCandidates.find(
    (candidate) => canonicalizeService(candidate.service) === canonicalTarget,
  );
  if (!matched) return 0;
  return new Set((matched.sources || []).filter(Boolean)).size;
}

function hasMultiSourceOverrideEvidence({
  targetService,
  signalServices,
  generatedCandidates,
  weightedSources,
}: {
  targetService: string;
  signalServices: string[];
  generatedCandidates: Array<{
    service: string;
    sources: string[];
  }>;
  weightedSources?: Set<string>;
}) {
  const canonicalTarget = canonicalizeService(targetService);
  if (!canonicalTarget) return false;
  const signalMatches = countMatchingSignalServices(canonicalTarget, signalServices);
  const generatedSourceCount = getGeneratedSupportSourceCount(
    canonicalTarget,
    generatedCandidates,
  );
  const weightedSourceCount = (weightedSources?.size ?? 0) || 0;

  if (signalMatches >= 2) return true;
  if (signalMatches >= 1 && generatedSourceCount >= 2) return true;
  if (signalMatches >= 1 && weightedSourceCount >= 2) return true;
  if (generatedSourceCount >= 3) return true;
  if (weightedSourceCount >= 3) return true;
  return false;
}

function hasHighConfidenceOverrideEvidence({
  targetService,
  signalServices,
  generatedCandidates,
}: {
  targetService: string;
  signalServices: string[];
  generatedCandidates: Array<{
    service: string;
    sources: string[];
  }>;
}) {
  const canonicalTarget = canonicalizeService(targetService);
  if (!canonicalTarget) return false;
  const signalMatches = countMatchingSignalServices(canonicalTarget, signalServices);
  const generatedSourceCount = getGeneratedSupportSourceCount(
    canonicalTarget,
    generatedCandidates,
  );
  return signalMatches >= 2 && (generatedSourceCount >= 2 || signalMatches >= 3);
}

function pickWeightedCandidate({
  vertical,
  gsService,
  bsService,
  gbpService,
  websiteService,
  nameService,
  detailService,
  generatedCandidates,
}: {
  vertical: VerticalKey;
  gsService: string;
  bsService: string;
  gbpService: string;
  websiteService: string;
  nameService: string;
  detailService: string;
  generatedCandidates: Array<{
    service: string;
    score: number;
    confidence: number;
    sources: string[];
    specificity: number;
  }>;
}) {
  const weights = getIndustrySourceWeights(vertical);
  const candidateMap = new Map<
    string,
    { score: number; sources: Set<string>; specificity: number; votes: number }
  >();

  const add = (service: string, weight: number, source: string) => {
    const normalized = canonicalizeService(service);
    if (!normalized) return;
    const current = candidateMap.get(normalized) ?? {
      score: 0,
      sources: new Set<string>(),
      specificity: specificityScore(normalized),
      votes: 0,
    };
    current.score += weight;
    current.votes += 1;
    current.sources.add(source);
    candidateMap.set(normalized, current);
  };

  // Keep Google signal weak; use as a tie-break hint only.
  add(gsService, weights.google * 0.15, "google");
  add(bsService, weights.baam, "baam");
  add(nameService, weights.gbp * 1.1, "name_signal");
  add(gbpService, weights.gbp, "gbp");
  add(websiteService, weights.website, "website");
  add(detailService, weights.detailRule, "detail_rule");
  for (const candidate of generatedCandidates.slice(0, 3)) {
    const baseDampening =
      candidate === generatedCandidates[0]
        ? 1
        : candidate === generatedCandidates[1]
          ? 0.72
          : 0.56;
    const specificityDampening =
      isGenericService(candidate.service) || candidate.specificity <= 2 ? 0.25 : 1;
    add(
      candidate.service,
      weights.detailRule * baseDampening * specificityDampening,
      "generated_candidate",
    );
  }

  if (candidateMap.size === 0) return null;

  const ranked = Array.from(candidateMap.entries())
    .map(([service, value]) => {
      const boost = getServiceBoostForVertical(vertical, service);
      const specificity = specificityScore(service);
      const score = value.score + specificity * 0.06 + boost;
      const confidence = computeWeightedConfidence(score, value.votes, specificity);
      return {
        service,
        score,
        confidence,
        votes: value.votes,
        specificity,
        sources: value.sources,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (b.specificity !== a.specificity) return b.specificity - a.specificity;
      return b.service.length - a.service.length;
    });

  return ranked[0];
}

function shouldPreferWeightedCandidate(
  candidate: {
    service: string;
    score: number;
    votes: number;
    specificity: number;
    confidence: number;
    sources: Set<string>;
  },
  currentRecommendation: string,
  currentConfidence: number,
) {
  const current = canonicalizeService(currentRecommendation);
  const next = canonicalizeService(candidate.service);
  if (!next || current === next) return false;

  const currentSpecificity = specificityScore(current);
  const hasMultiSourceSupport = candidate.sources.size >= 2;
  if (isGenericService(current) && candidate.specificity >= currentSpecificity) return true;
  if (candidate.specificity > currentSpecificity && candidate.score >= 1.12) return true;
  if (
    hasMultiSourceSupport &&
    candidate.specificity >= currentSpecificity &&
    candidate.confidence > currentConfidence + 0.03
  ) {
    return true;
  }
  return candidate.confidence >= 0.9 && candidate.score >= 1.18;
}

function applyVerticalGuardrail({
  vertical,
  recommended,
  gsService,
  bsService,
  businessName,
  textBlob,
}: {
  vertical: VerticalKey;
  recommended: string;
  gsService: string;
  bsService: string;
  businessName: string;
  textBlob: string;
}) {
  const next = canonicalizeService(recommended);
  const gs = canonicalizeService(gsService);
  const bs = canonicalizeService(bsService);

  if (vertical === "legal_immigration") {
    if (!isLegalService(next)) {
      if (isLegalService(bs) && !isBroadService(bs, vertical)) return bs;
      if (isLegalService(gs) && !isBroadService(gs, vertical)) return gs;
      if (/\b(law|lawyer|attorney|legal|immigration)\b/i.test(textBlob)) {
        if (/\b(personal injury|car accident|injury lawyer)\b/i.test(textBlob)) {
          return canonicalizeService("personal injury lawyer");
        }
        return canonicalizeService("immigration lawyer");
      }
      return canonicalizeService("immigration lawyer");
    }
  }

  if (vertical === "auto") {
    if (isManufacturerLike(next) && /\b(dealer(ship)?|auto sales|used car|new car|mercedes|audi|bmw|lexus)\b/i.test(textBlob)) {
      return canonicalizeService("car dealer");
    }
  }

  if (vertical === "contractor") {
    const hasHvacSignal =
      /\b(hvac|air conditioning|heating\s*(and|&)\s*cooling|cooling\s*(and|&)\s*heating|furnace|heat pump|duct(work)?|ventilation)\b/i.test(
        textBlob,
      );
    const hasPlumbingSignal = /\b(plumb(er|ing)|sewer|drain)\b/i.test(textBlob);
    const hasPlumbingNameSignal = /\bplumb(er|ing)\b/i.test(businessName);
    const hasHvacNameSignal = /\bhvac|heating|cooling\b/i.test(businessName);
    const hasWindowTreatmentSignal =
      /\b(curtains?|blinds?|shutters?|drapery|window treatments?|window coverings?)\b/i.test(
        textBlob,
      );
    const hasShippingBusinessSignal =
      /\b(ups store|mailboxes?|shipping (center|store|service)|mailing (service|center)|postal (service|office)|courier (service|company)|pack(?:ing)? and ship|fedex|usps|dhl)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasRugRetailSignal =
      /\b(oriental|persian)\s*(rugs?|carpets?)\b|\b(area\s*rugs?|rugs?|carpets?)\s*(store|shop|gallery|showroom|boutique)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasJewelrySignal = /\b(jewelers?|jewellery|jewelry|diamond|watch)\b/i.test(textBlob);
    const hasCleaningSignal =
      /\b(house cleaning|home cleaning|commercial cleaning|office cleaning|janitorial|maid service|deep cleaning|cleaning (service|services|company|crew|chief))\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasPianoSignal =
      /\b(piano(s)?|grand piano|upright piano|piano dealer|piano showroom|piano shop)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasPrintSignal =
      /\b(print(ing)?|print shop|commercial printer|copy shop|copy center|offset print)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasDigitalNameSignal = /\bdigital\b/i.test(businessName);
    const hasManufacturerSignal = /\b(manufacturer|manufacturing|factory|industrial|wholesale)\b/i.test(
      `${businessName} ${textBlob}`,
    );
    const hasPhoneRepairSignal =
      /\b(phone|cell phone|iphone|android|mobile|computer|laptop|pc)\b.*\b(repair|fix|screen)\b|\b(repair|fix)\b.*\b(phone|cell phone|iphone|android|mobile|computer|laptop|pc)\b/i.test(
        textBlob,
      );

    if (hasHvacSignal && next === "window treatment store") {
      return canonicalizeService("hvac contractor");
    }
    if (hasPlumbingSignal && !hasHvacSignal && next === "hvac contractor") {
      return canonicalizeService("plumbing service");
    }
    if (
      (hasPlumbingNameSignal || /\bplumb(er|ing)\b/i.test(textBlob)) &&
      !hasHvacNameSignal &&
      next === "hvac contractor"
    ) {
      return canonicalizeService("plumbing service");
    }
    if (hasPlumbingSignal && isBroadService(next, vertical)) {
      return canonicalizeService("plumbing service");
    }
    if (hasWindowTreatmentSignal && next === "sign manufacturer") {
      return canonicalizeService("window treatment store");
    }
    if (hasCleaningSignal) {
      return canonicalizeService("cleaning service");
    }
    if (hasPianoSignal) {
      return canonicalizeService("piano store");
    }
    if (hasPrintSignal) {
      return canonicalizeService("print shop");
    }
    if (
      hasDigitalNameSignal &&
      !hasPhoneRepairSignal &&
      !hasManufacturerSignal &&
      !hasHvacSignal &&
      !hasPlumbingSignal &&
      !hasWindowTreatmentSignal
    ) {
      return canonicalizeService("marketing consultant");
    }
    if (hasJewelrySignal) {
      return canonicalizeService("jewelry store");
    }
    if (hasShippingBusinessSignal && !hasRugRetailSignal) {
      return canonicalizeService("shipping and mailing service");
    }
    if (hasPhoneRepairSignal) {
      if (/\b(computer|laptop|pc)\b/i.test(textBlob)) {
        return canonicalizeService("computer repair service");
      }
      return canonicalizeService("phone repair service");
    }
  }

  if (vertical === "general_smb") {
    const hasPhoneRepairSignal =
      /\b(phone|cell phone|iphone|android|mobile)\b.*\b(repair|fix|screen)\b|\b(repair|fix)\b.*\b(phone|cell phone|iphone|android|mobile)\b/i.test(
        textBlob,
      );
    const hasComputerRepairSignal =
      /\b(computer|laptop|pc|macbook)\b.*\b(repair|fix)\b|\b(repair|fix)\b.*\b(computer|laptop|pc|macbook)\b/i.test(
        textBlob,
      );
    const hasPetStoreSignal = /\b(pet store|petco|aquarium|aquatic)\b/i.test(
      `${businessName} ${textBlob}`,
    );
    const hasPetCareSignal =
      /\b(pet care|veterinary|veterinarian|vet clinic|animal hospital|animal clinic|pet hospital|pet doctor)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasCleaningSignal =
      /\b(house cleaning|home cleaning|commercial cleaning|office cleaning|janitorial|maid service|deep cleaning|cleaning (service|services|company|crew|chief))\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasPianoSignal =
      /\b(piano(s)?|grand piano|upright piano|piano dealer|piano showroom|piano shop)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasPrintSignal =
      /\b(print(ing)?|print shop|commercial printer|copy shop|copy center|offset print)\b/i.test(
        `${businessName} ${textBlob}`,
      );
    const hasDigitalNameSignal = /\bdigital\b/i.test(businessName);
    const hasManufacturerSignal = /\b(manufacturer|manufacturing|factory|industrial|wholesale)\b/i.test(
      `${businessName} ${textBlob}`,
    );
    const hasShippingNameSignal =
      /\b(dhl|fedex|ups|usps|shipping|mailing|courier|express service point)\b/i.test(
        businessName,
      );
    const hasStrongShippingTextSignal =
      /\b(ups store|fedex office|dhl express|shipping service|mailing service|courier service|parcel shipping|postal service)\b/i.test(
        textBlob,
      );

    if (/\b(church|cathedral|basilica)\b/i.test(businessName)) {
      return canonicalizeService("church");
    }
    if (/\b(buddhist temple|monastery)\b/i.test(businessName)) {
      return canonicalizeService("buddhist temple");
    }
    if (/\b(hindu temple)\b/i.test(businessName)) {
      return canonicalizeService("hindu temple");
    }
    if (/\b(animal rescue|pet rescue|pet adoption)\b/i.test(businessName)) {
      return canonicalizeService("pet care");
    }
    if (hasCleaningSignal) {
      return canonicalizeService("cleaning service");
    }
    if (hasPianoSignal) {
      return canonicalizeService("piano store");
    }
    if (hasPrintSignal) {
      return canonicalizeService("print shop");
    }
    if (
      /\b(digital marketing|marketing agency|seo (agency|services?|consult(ant|ing))|web design (agency|studio|services?)|branding agency|advertising agency)\b/i.test(
        businessName,
      )
    ) {
      return canonicalizeService("marketing consultant");
    }
    if (
      hasDigitalNameSignal &&
      !hasPhoneRepairSignal &&
      !hasComputerRepairSignal &&
      !hasManufacturerSignal &&
      !hasPrintSignal
    ) {
      return canonicalizeService("marketing consultant");
    }
    if (/\bzoo\b/i.test(businessName)) {
      if (/\b(pet store|pet shop|aquarium)\b/i.test(businessName)) {
        return canonicalizeService("pet store");
      }
      return canonicalizeService("zoo");
    }
    if (/\b(dermatolog(y|ist)|skin specialist|skin clinic)\b/i.test(textBlob)) {
      return canonicalizeService("dermatology clinic");
    }
    if (/\bproperty management\b/i.test(textBlob)) {
      return canonicalizeService("property management service");
    }
    if (/\b(translation|translator|interpretation)\b/i.test(textBlob)) {
      return canonicalizeService("translation service");
    }
    if (/\b(driving school|auto school|driving lessons?|driver training)\b/i.test(textBlob)) {
      return canonicalizeService("driving school");
    }
    if (hasPhoneRepairSignal) {
      return canonicalizeService("phone repair service");
    }
    if (hasComputerRepairSignal) {
      return canonicalizeService("computer repair service");
    }
    if (/\b(arcade|claw machine|anime claw)\b/i.test(textBlob)) {
      return canonicalizeService("arcade");
    }
    if (
      hasShippingNameSignal ||
      (hasStrongShippingTextSignal &&
        !hasPetStoreSignal &&
        !hasPetCareSignal &&
        !hasPhoneRepairSignal &&
        !hasComputerRepairSignal)
    ) {
      return canonicalizeService("shipping and mailing service");
    }
    if (/\b(church|cathedral|basilica)\b/i.test(textBlob)) return canonicalizeService("church");
    if (/\b(buddhist temple|monastery)\b/i.test(textBlob)) {
      return canonicalizeService("buddhist temple");
    }
    if (/\b(hindu temple)\b/i.test(textBlob)) return canonicalizeService("hindu temple");
    if (/\b(animal rescue|pet rescue|pet adoption)\b/i.test(textBlob)) {
      return canonicalizeService("pet care");
    }
    if (/\b(laundromat|laundry|dry clean(ing)?|dry cleaner)\b/i.test(textBlob)) {
      return canonicalizeService("laundry service");
    }
    if (hasCleaningSignal) {
      return canonicalizeService("cleaning service");
    }
    if (hasPianoSignal) {
      return canonicalizeService("piano store");
    }
    if (hasPrintSignal) {
      return canonicalizeService("print shop");
    }
    if (
      /\b(digital marketing|marketing agency|seo (agency|services?|consult(ant|ing))|web design (agency|studio|services?)|branding agency|advertising agency)\b/i.test(
        textBlob,
      )
    ) {
      return canonicalizeService("marketing consultant");
    }
    if (/\b(photo(graphy)?|portrait studio|photo studio|videography|self-portrait)\b/i.test(textBlob)) {
      return canonicalizeService("photography studio");
    }
    if (/\b(jewelers?|jewellery|jewelry|diamond|watch)\b/i.test(textBlob)) {
      return canonicalizeService("jewelry store");
    }
    if (/\b(petco|pet store)\b/i.test(textBlob) || hasPetStoreSignal) return canonicalizeService("pet store");
    if (/\b(animal rescue|pet rescue|pet adoption)\b/i.test(textBlob)) return canonicalizeService("pet care");
    if (hasPetCareSignal) return canonicalizeService("veterinary care");
    if (/\b(zoo)\b/i.test(textBlob) && !/\b(pet store|pet shop|aquarium|aquatic)\b/i.test(textBlob)) {
      return canonicalizeService("zoo");
    }
    if (
      /\b(park)\b/i.test(textBlob) &&
      /\b(national|state|city|public|recreation|playground|nyc parks|meadows)\b/i.test(textBlob)
    ) {
      return canonicalizeService("park");
    }
    if (/\b(historical landmark|historic landmark|observation deck|tourist attraction|monument)\b/i.test(textBlob)) {
      return canonicalizeService("historical landmark");
    }
    if (/\b(tailor(ing)?|alterations?|seamstress)\b/i.test(textBlob)) {
      return canonicalizeService("tailor shop");
    }
    if (/\b(travel agency|tour operator|travel advisor|flight booking|vacation packages?)\b/i.test(textBlob)) {
      return canonicalizeService("travel agency");
    }
    if (
      /\b(plumb(er|ing)|sewer|drain)\b/i.test(textBlob) &&
      (next === "plumber" || isBroadService(next, vertical))
    ) {
      return canonicalizeService("plumbing service");
    }
  }

  return next;
}

function isLegalService(input: string) {
  if (!input) return false;
  return /\b(law|lawyer|attorney|legal|immigration)\b/i.test(input);
}

function isManufacturerLike(input: string) {
  if (!input) return false;
  return /\bmanufacturer|manufacturing|factory\b/i.test(input);
}

function isServiceCompatibleWithVertical(service: string, vertical: VerticalKey) {
  const normalized = canonicalizeService(service);
  if (!normalized) return false;
  if (vertical === "legal_immigration") {
    return isLegalService(normalized);
  }
  if (vertical === "auto") {
    return /\b(auto|car|dealer|repair|body|tire|automotive)\b/i.test(normalized);
  }
  if (vertical === "contractor") {
    if (/\b(law|lawyer|attorney|immigration|finance|mortgage|bank)\b/i.test(normalized)) {
      return false;
    }
  }
  return true;
}

function computeWeightedConfidence(score: number, votes: number, specificity: number) {
  let confidence = 0.72 + Math.min(0.16, score * 0.1);
  if (votes >= 2) confidence += 0.04;
  if (votes >= 3) confidence += 0.03;
  confidence += Math.min(0.05, specificity * 0.01);
  return Number(Math.min(0.95, confidence).toFixed(2));
}

function isBroadService(service: string, vertical?: string) {
  const canonical = canonicalizeService(service);
  if (!canonical) return true;
  if (isBroadServiceTerm(canonical, { vertical })) return true;
  return specificityScore(canonical) <= 2;
}

function normalizeEvidenceText(input: string | null | undefined) {
  return normalizeService(input).replace(/[_/]+/g, " ").replace(/-/g, " ");
}

function extractWebsiteKeywordSignal(inputUrl: string | null | undefined) {
  const raw = (inputUrl ?? "").trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname
      .replace(/^www\./i, "")
      .split(".")
      .slice(0, -1)
      .join(" ");
    const path = parsed.pathname.replace(/[\/._-]+/g, " ");
    const query = decodeURIComponent(parsed.search.replace(/^[?]/, "")).replace(
      /[=&._-]+/g,
      " ",
    );
    return normalizeEvidenceText([host, path, query].join(" "));
  } catch {
    return normalizeEvidenceText(raw.replace(/[\/._-]+/g, " "));
  }
}
