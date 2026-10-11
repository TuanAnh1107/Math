export type PracticeQuestion = {
  id: string;
  topic: string;
  x: number;
  options: readonly number[];
  correctAnswer: number;
};

// Preserve the ten-question demo and its retry flow, with stable per-question IDs.
export const practiceQuestions: readonly PracticeQuestion[] = Array.from(
  { length: 10 },
  (_, index) => ({
    id: `practice-linear-${String(index + 1).padStart(2, "0")}`,
    topic: "Hàm số",
    x: index % 2 === 0 ? 2 : 4,
    options: index % 2 === 0 ? [5, 7, 8, 10] : [8, 11, 12, 14],
    correctAnswer: index % 2 === 0 ? 7 : 11,
  }),
);

export type PracticeResponse = {
  firstAnswer: number;
  latestAnswer: number;
  checks: number;
};
export type PracticeResponses = Record<string, PracticeResponse>;

export function recordPracticeResponse(
  responses: PracticeResponses,
  question: PracticeQuestion,
  selectedAnswer: number,
): PracticeResponses {
  if (!question.options.includes(selectedAnswer)) return responses;
  const previous = responses[question.id];
  return {
    ...responses,
    [question.id]: {
      firstAnswer: previous?.firstAnswer ?? selectedAnswer,
      latestAnswer: selectedAnswer,
      checks: (previous?.checks ?? 0) + 1,
    },
  };
}

export function summarizePractice(
  responses: PracticeResponses,
  questions: readonly PracticeQuestion[] = practiceQuestions,
) {
  const checked = questions.filter(question => responses[question.id]);
  const firstCorrect = checked.filter(
    question => responses[question.id].firstAnswer === question.correctAnswer,
  ).length;
  const corrected = checked.filter(
    question => responses[question.id].latestAnswer === question.correctAnswer,
  ).length;
  const mistakeIds = checked
    .filter(question => responses[question.id].firstAnswer !== question.correctAnswer)
    .map(question => question.id);
  let streak = 0;
  for (const question of checked) {
    streak = responses[question.id].firstAnswer === question.correctAnswer ? streak + 1 : 0;
  }
  return {
    total: questions.length,
    checked: checked.length,
    firstCorrect,
    corrected,
    accuracy: questions.length ? Math.round(firstCorrect / questions.length * 100) : 0,
    mistakeIds,
    // Local demo XP for questions actually corrected, not a server award.
    xp: corrected * 15,
    streak,
  };
}
