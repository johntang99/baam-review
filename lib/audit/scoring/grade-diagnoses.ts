import type { Grade } from "./types";

const GRADE_DIAGNOSES: Record<Grade, string> = {
  A: "Winning your local market. Reviews are a competitive moat.",
  B: "Strong — but losing ground to top competitors month over month.",
  C: "Visible — but customers are choosing competitors with stronger reviews.",
  D: "Bleeding customers to better-reviewed competitors every week.",
  F: "Effectively invisible. Search and AI are skipping you entirely.",
};

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function diagnosisForGrade(grade: Grade): string {
  return GRADE_DIAGNOSES[grade];
}
