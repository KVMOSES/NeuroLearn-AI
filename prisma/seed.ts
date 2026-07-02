/**
 * NeuroLearn AI — Production Seed
 *
 * Seeds ONLY system configuration (achievement definitions).
 * Does NOT create any demo users, courses, lessons, flashcards, quizzes,
 * classrooms, conversations, or fake progress data.
 *
 * The application starts as a clean production application.
 * All content is generated dynamically from real user activity.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding NeuroLearn AI system configuration...");

  // ---------- Achievement definitions (system config, not user data) ----------
  const achievements = [
    { slug: "first-lesson", name: "First Steps", description: "Complete your first lesson", icon: "Footprints", tier: "bronze", xpReward: 50, threshold: 1, category: "lessons_completed" },
    { slug: "five-lessons", name: "Getting Warmed Up", description: "Complete 5 lessons", icon: "Flame", tier: "bronze", xpReward: 100, threshold: 5, category: "lessons_completed" },
    { slug: "quiz-master", name: "Quiz Master", description: "Pass 3 quizzes", icon: "Brain", tier: "silver", xpReward: 150, threshold: 3, category: "quizzes_passed" },
    { slug: "perfectionist", name: "Perfectionist", description: "Score 100% on 2 quizzes", icon: "Target", tier: "gold", xpReward: 250, threshold: 2, category: "perfect_quizzes" },
    { slug: "flashcard-pro", name: "Flashcard Pro", description: "Review 20 flashcards", icon: "Layers", tier: "silver", xpReward: 120, threshold: 20, category: "flashcards_reviewed" },
    { slug: "streak-7", name: "Week Warrior", description: "Maintain a 7-day streak", icon: "CalendarDays", tier: "silver", xpReward: 200, threshold: 7, category: "current_streak" },
    { slug: "streak-30", name: "Unstoppable", description: "Maintain a 30-day streak", icon: "Zap", tier: "gold", xpReward: 500, threshold: 30, category: "current_streak" },
    { slug: "level-5", name: "Rising Star", description: "Reach level 5", icon: "TrendingUp", tier: "silver", xpReward: 150, threshold: 5, category: "level" },
    { slug: "level-10", name: "Scholar", description: "Reach level 10", icon: "GraduationCap", tier: "gold", xpReward: 400, threshold: 10, category: "level" },
    { slug: "doc-explorer", name: "Doc Explorer", description: "Upload 3 documents", icon: "FileText", tier: "bronze", xpReward: 60, threshold: 3, category: "documents_uploaded" },
    { slug: "first-diagnostic", name: "Self-Aware", description: "Complete your first diagnostic", icon: "Brain", tier: "bronze", xpReward: 75, threshold: 1, category: "diagnostics_completed" },
    { slug: "topic-master", name: "Topic Master", description: "Achieve 80% mastery on 5 topics", icon: "Award", tier: "gold", xpReward: 300, threshold: 5, category: "topics_mastered" },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      create: a,
      update: a,
    });
  }

  console.log(`Seeded ${achievements.length} achievement definitions.`);
  console.log("Done. The application starts clean — no demo users or content.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
