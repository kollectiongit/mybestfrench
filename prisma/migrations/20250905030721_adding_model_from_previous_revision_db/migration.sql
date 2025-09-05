-- CreateEnum
CREATE TYPE "public"."question_type" AS ENUM ('QCM', 'LIBRE', 'DICTEE');

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exercices_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "profile_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "generated_question_id" UUID,
    "question_type" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "user_answer" TEXT,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "correct_answer" TEXT,
    "choices" TEXT[],

    CONSTRAINT "training_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exercise_levels" (
    "exercise_id" UUID NOT NULL,
    "level_id" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,

    CONSTRAINT "exercise_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(200) NOT NULL,
    "rules_text" TEXT NOT NULL,
    "examples_text" TEXT NOT NULL,
    "supports_multiple_choices" BOOLEAN DEFAULT true,
    "supports_text_choice" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "question" TEXT,
    "question_example" TEXT,
    "expected_answer" TEXT,
    "answer_example" TEXT,
    "answer_choices_example" TEXT[],
    "supports_single_choice" BOOLEAN,
    "subcategory_id" INTEGER,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."filter_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "profile_id" UUID,
    "selected_category_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "selected_subcategory_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "question_type" "public"."question_type",
    "show_rules_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."generated_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "profile_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "model_name" VARCHAR(100),
    "llm_latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "instruction" TEXT,
    "encouragement_message" TEXT,
    "choices" TEXT[],
    "correct_answer" TEXT,
    "rules_explanation" TEXT,
    "success_message" TEXT,
    "error_message" TEXT,
    "is_used" BOOLEAN DEFAULT false,
    "status" TEXT DEFAULT 'TO_SOLVE',

    CONSTRAINT "generated_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."levels" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profile_levels" (
    "profile_id" UUID NOT NULL,
    "level_id" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,

    CONSTRAINT "profile_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "avatar_url" TEXT,
    "age" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subcategories" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subcategories_levels" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subcategory_id" INTEGER,
    "level_id" INTEGER,

    CONSTRAINT "subcategories_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug");

-- CreateIndex
CREATE INDEX "idx_training_attempts_user_created" ON "public"."exercices_attempts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_training_attempts_exercise" ON "public"."exercices_attempts"("exercise_id");

-- CreateIndex
CREATE INDEX "idx_training_attempts_profile_created" ON "public"."exercices_attempts"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_filter_preferences_user_profile" ON "public"."filter_preferences"("user_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_code_key" ON "public"."levels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_slug_key" ON "public"."subcategories"("slug");

-- AddForeignKey
ALTER TABLE "public"."exercices_attempts" ADD CONSTRAINT "exercices_attempts_generated_question_id_fkey" FOREIGN KEY ("generated_question_id") REFERENCES "public"."generated_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercices_attempts" ADD CONSTRAINT "training_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercices_attempts" ADD CONSTRAINT "training_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercices_attempts" ADD CONSTRAINT "training_attempts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercise_levels" ADD CONSTRAINT "exercise_levels_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercise_levels" ADD CONSTRAINT "exercise_levels_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."exercises" ADD CONSTRAINT "exercises_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."filter_preferences" ADD CONSTRAINT "filter_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."generated_questions" ADD CONSTRAINT "generated_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."generated_questions" ADD CONSTRAINT "generated_questions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."generated_questions" ADD CONSTRAINT "generated_questions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profile_levels" ADD CONSTRAINT "profile_levels_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profile_levels" ADD CONSTRAINT "profile_levels_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subcategories_levels" ADD CONSTRAINT "subcategories_levels_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."subcategories_levels" ADD CONSTRAINT "subcategories_levels_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
