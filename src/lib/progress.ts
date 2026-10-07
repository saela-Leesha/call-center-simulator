export type ProgressLevel = "Nesting" | "Emerging" | "Proficient" | "Advanced" | "Floor Ready";

export function progressLevel(input: {
  completed: number;
  assigned: number;
  averageRating: number;
  passingScore?: number;
}): { level: ProgressLevel; percent: number } {
  const passing = input.passingScore ?? 75;
  const completion = input.assigned > 0 ? input.completed / input.assigned : 0;
  const ratingFactor = Math.max(0, Math.min(1, (input.averageRating - 50) / 45));
  const blended = completion * 0.55 + ratingFactor * 0.45;
  const percent = Math.round(Math.max(0, Math.min(100, blended * 100)));

  if (input.completed === 0) return { level: "Nesting", percent };
  if (input.completed >= 6 && input.averageRating >= 90 && completion >= 0.9) {
    return { level: "Floor Ready", percent };
  }
  if (input.completed >= 4 && input.averageRating >= passing + 10) {
    return { level: "Advanced", percent };
  }
  if (input.averageRating >= passing && input.completed >= 2) {
    return { level: "Proficient", percent };
  }
  return { level: "Emerging", percent };
}

export function starsToScore(stars: number) {
  return Math.round((Math.max(1, Math.min(5, stars)) / 5) * 100);
}

export function scoreToStars(score: number) {
  return Math.max(1, Math.round((Math.max(0, Math.min(100, score)) / 100) * 5));
}

export function starLabel(stars: number) {
  return ["Needs work", "Below standard", "Meets standard", "Exceeds standard", "Exceptional"][
    Math.max(1, Math.min(5, stars)) - 1
  ];
}
