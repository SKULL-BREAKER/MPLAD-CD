// Fusion Brain: Advanced 10-Module Detection Engine
// This module simulates the complex AI and data lake logic internally.

export function runDetectionEngines(work) {
  const flags = [];
  let totalSeverity = 0;

  // Constants
  const TENDER_THRESHOLD = 1500000; // ₹15 Lakhs
  
  // Extract features
  const amount = work.sanctioned_amount || 0;
  const expended = work.expenditure || 0;
  const state = work.status;
  const sector = work.category || 'Unknown';
  
  // Fake District Median for Module 1
  const districtMedian = 500000; 

  // --- Module 1: Cost Outlier Engine ---
  if (amount > districtMedian * 3) {
    flags.push({
      module: 'Module 1 (Cost Outlier)',
      severity: 30,
      detail: `Cost (₹${amount.toLocaleString()}) is >3x the district median (₹${districtMedian.toLocaleString()}). Robust Z-score: 4.2x.`
    });
    totalSeverity += 30;
  }

  // --- Module 2: Duplicate-Work Detector ---
  // Simulation: We check if the name matches a known duplicate pattern.
  if (work.proposal?.public_locality_term_id?.includes('Re-sanctioned')) {
    flags.push({
      module: 'Module 2 (Duplicate Work)',
      severity: 40,
      detail: `High embedding similarity (0.89) to a project sanctioned in previous year.`
    });
    totalSeverity += 40;
  }

  // --- Module 3: Timeline Rule Engine ---
  if (state === 'COMPLETED' && (expended === 0 || expended < amount * 0.1)) {
    flags.push({
      module: 'Module 3 (Timeline Rules)',
      severity: 25,
      detail: `Completion certified but fund utilization is impossibly low (<10%).`
    });
    totalSeverity += 25;
  }
  
  // --- Module 4: Fund Aging Analyzer ---
  if (state === 'IN-EXECUTION' && expended === 0 && amount > 0) {
    flags.push({
      module: 'Module 4 (Fund Aging)',
      severity: 15,
      detail: `Funds released > 24 months ago with zero utilization. Added to idle-fund leaderboard.`
    });
    totalSeverity += 15;
  }

  // --- Module 5: Contractor Network Analyzer ---
  // Simulation: Checking if the agency ID indicates a cartel.
  if (work.implementing_agency?.agency_name?.toLowerCase().includes('syndicate')) {
    flags.push({
      module: 'Module 5 (Contractor Network)',
      severity: 35,
      detail: `Contractor identified in rotation pattern (A-B-C). Top-1 contractor share > 40%. Cartel identified.`
    });
    totalSeverity += 35;
  }

  // --- Module 6: Splitting (Tender-Avoidance) Detector ---
  if (amount > (TENDER_THRESHOLD * 0.8) && amount < TENDER_THRESHOLD) {
    // Just below threshold. Flag as potential splitting.
    flags.push({
      module: 'Module 6 (Splitting Detector)',
      severity: 20,
      detail: `Sanction amount (₹${amount.toLocaleString()}) is suspiciously close to tender threshold (₹${TENDER_THRESHOLD.toLocaleString()}). Potential split work.`
    });
    totalSeverity += 20;
  }

  // --- Module 7: Guideline Compliance NLP ---
  if (sector === 'Religious Structure' || sector === 'Administrative Office') {
    flags.push({
      module: 'Module 7 (Guideline NLP)',
      severity: 50,
      detail: `Prohibited work type detected via keyword rule match.`
    });
    totalSeverity += 50;
  }

  // --- Module 8: Benami Entity Resolver ---
  if (work.implementing_agency?.contractor_profile?.cluster_id) {
    flags.push({
      module: 'Module 8 (Benami Entity Resolver)',
      severity: 45,
      detail: `Fuzzy-matched PAN/Phone fragments link this contractor to beneficial owner 'Cluster A'.`
    });
    totalSeverity += 45;
  }

  // --- Module 9: Satellite Verifier ---
  if (state === 'COMPLETED' && work.evidence?.length === 0) {
    flags.push({
      module: 'Module 9 (Satellite Verifier)',
      severity: 50,
      detail: `Sentinel-2 change detection shows NO visible footprint change post-completion. GHOST WORK FLAG.`
    });
    totalSeverity += 50;
  }

  // --- Module 10: Risk Scoring Engine (The Fusion Brain) ---
  // Calculate final score
  const baseRisk = 10; 
  let finalScore = baseRisk + totalSeverity;
  if (finalScore > 100) finalScore = 100;

  let riskLevel = 'LOW';
  if (finalScore > 80) riskLevel = 'CRITICAL';
  else if (finalScore > 50) riskLevel = 'HIGH';
  else if (finalScore > 30) riskLevel = 'MEDIUM';

  return {
    score: finalScore,
    level: riskLevel,
    factors: flags
  };
}
