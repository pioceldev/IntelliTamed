-- ============================================================
-- IntelliTamed — Schéma de base de données
-- Généré depuis les modèles Django le 2026-08-14
-- Moteur : SQLite (dev) — compatible PostgreSQL/MySQL via DATABASE_URL
-- Commandes : python manage.py migrate  (génère ce schéma)
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE "accounts_profile" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "first_name" varchar(100) NOT NULL, "last_name" varchar(100) NOT NULL, "country" varchar(100) NOT NULL, "bio" text NOT NULL, "website" varchar(200) NOT NULL, "linkedin" varchar(200) NOT NULL, "profile_type" varchar(30) NOT NULL, "domain" varchar(100) NOT NULL, "skills" text NOT NULL CHECK ((JSON_VALID("skills") OR "skills" IS NULL)), "experience" varchar(20) NOT NULL, "goals" text NOT NULL CHECK ((JSON_VALID("goals") OR "goals" IS NULL)), "interests" text NOT NULL CHECK ((JSON_VALID("interests") OR "interests" IS NULL)), "ai_preferences" text NOT NULL CHECK ((JSON_VALID("ai_preferences") OR "ai_preferences" IS NULL)), "onboarding_completed" bool NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "user_id" bigint NOT NULL UNIQUE REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "accounts_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "first_name" varchar(150) NOT NULL, "last_name" varchar(150) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL, "email" varchar(254) NOT NULL UNIQUE, "role" varchar(20) NOT NULL, "created_at" datetime NOT NULL);

CREATE TABLE "accounts_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "accounts_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "action_plans_actionplan" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "description" text NOT NULL, "status" varchar(20) NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "project_id" bigint NULL REFERENCES "projects_project" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "action_plans_actionstep" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "description" text NOT NULL, "category" varchar(50) NOT NULL, "priority" varchar(10) NOT NULL, "status" varchar(10) NOT NULL, "deadline" date NULL, "order" integer unsigned NOT NULL CHECK ("order" >= 0), "phase" varchar(10) NOT NULL, "created_at" datetime NOT NULL, "plan_id" bigint NOT NULL REFERENCES "action_plans_actionplan" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "ai_airequest" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "request_type" varchar(20) NOT NULL, "model_used" varchar(100) NOT NULL, "status" varchar(10) NOT NULL, "usage_info" text NOT NULL CHECK ((JSON_VALID("usage_info") OR "usage_info" IS NULL)), "error" text NOT NULL, "created_at" datetime NOT NULL, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "ai_conversation" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "ai_message" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "role" varchar(10) NOT NULL, "content" text NOT NULL, "created_at" datetime NOT NULL, "conversation_id" bigint NOT NULL REFERENCES "ai_conversation" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);

CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);

CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED, "action_time" datetime NOT NULL);

CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);

CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);

CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);

CREATE TABLE "notifications_notification" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "content" text NOT NULL, "type" varchar(20) NOT NULL, "read" bool NOT NULL, "created_at" datetime NOT NULL, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "opportunities_opportunity" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "organization" varchar(200) NOT NULL, "description" text NOT NULL, "category" varchar(20) NOT NULL, "location" varchar(150) NOT NULL, "remote" bool NOT NULL, "deadline" date NULL, "link" varchar(200) NOT NULL, "status" varchar(10) NOT NULL, "created_at" datetime NOT NULL);

CREATE TABLE "opportunities_watchlist" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "created_at" datetime NOT NULL, "opportunity_id" bigint NOT NULL REFERENCES "opportunities_opportunity" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "projects_project" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(200) NOT NULL, "description" text NOT NULL, "problem" text NOT NULL, "solution" text NOT NULL, "target_audience" varchar(300) NOT NULL, "objectives" text NOT NULL CHECK ((JSON_VALID("objectives") OR "objectives" IS NULL)), "business_model" varchar(200) NOT NULL, "category" varchar(100) NOT NULL, "status" varchar(20) NOT NULL, "progress" smallint unsigned NOT NULL CHECK ("progress" >= 0), "due_date" date NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "owner_id" bigint NOT NULL REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "projects_projectanalysis" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "summary" text NOT NULL, "strengths" text NOT NULL CHECK ((JSON_VALID("strengths") OR "strengths" IS NULL)), "weaknesses" text NOT NULL CHECK ((JSON_VALID("weaknesses") OR "weaknesses" IS NULL)), "opportunities" text NOT NULL CHECK ((JSON_VALID("opportunities") OR "opportunities" IS NULL)), "risks" text NOT NULL CHECK ((JSON_VALID("risks") OR "risks" IS NULL)), "recommendations" text NOT NULL CHECK ((JSON_VALID("recommendations") OR "recommendations" IS NULL)), "next_steps" text NOT NULL CHECK ((JSON_VALID("next_steps") OR "next_steps" IS NULL)), "created_at" datetime NOT NULL, "project_id" bigint NOT NULL REFERENCES "projects_project" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE sqlite_sequence(name,seq);

CREATE TABLE "subscriptions_subscription" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "plan" varchar(20) NOT NULL, "status" varchar(20) NOT NULL, "start_date" date NOT NULL, "end_date" date NULL, "payment_info" text NOT NULL CHECK ((JSON_VALID("payment_info") OR "payment_info" IS NULL)), "created_at" datetime NOT NULL, "user_id" bigint NOT NULL UNIQUE REFERENCES "accounts_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE INDEX "accounts_user_groups_group_id_bd11a704" ON "accounts_user_groups" ("group_id");

CREATE INDEX "accounts_user_groups_user_id_52b62117" ON "accounts_user_groups" ("user_id");

CREATE UNIQUE INDEX "accounts_user_groups_user_id_group_id_59c0b32f_uniq" ON "accounts_user_groups" ("user_id", "group_id");

CREATE INDEX "accounts_user_user_permissions_permission_id_113bb443" ON "accounts_user_user_permissions" ("permission_id");

CREATE INDEX "accounts_user_user_permissions_user_id_e4f0a161" ON "accounts_user_user_permissions" ("user_id");

CREATE UNIQUE INDEX "accounts_user_user_permissions_user_id_permission_id_2ab516c2_uniq" ON "accounts_user_user_permissions" ("user_id", "permission_id");

CREATE INDEX "action_plans_actionplan_project_id_b9132dcc" ON "action_plans_actionplan" ("project_id");

CREATE INDEX "action_plans_actionplan_user_id_f51cf452" ON "action_plans_actionplan" ("user_id");

CREATE INDEX "action_plans_actionstep_plan_id_3b5d2277" ON "action_plans_actionstep" ("plan_id");

CREATE INDEX "ai_aireques_user_id_3c2ad7_idx" ON "ai_airequest" ("user_id", "request_type", "status");

CREATE INDEX "ai_airequest_user_id_e07aa572" ON "ai_airequest" ("user_id");

CREATE INDEX "ai_conversation_user_id_416bb629" ON "ai_conversation" ("user_id");

CREATE INDEX "ai_message_conversation_id_0ad97782" ON "ai_message" ("conversation_id");

CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions" ("group_id");

CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions" ("group_id", "permission_id");

CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions" ("permission_id");

CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");

CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");

CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");

CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");

CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");

CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session" ("expire_date");

CREATE INDEX "notifications_notification_user_id_b5e8c0ff" ON "notifications_notification" ("user_id");

CREATE INDEX "opportuniti_categor_eb29b5_idx" ON "opportunities_opportunity" ("category", "status");

CREATE INDEX "opportunities_watchlist_opportunity_id_12800371" ON "opportunities_watchlist" ("opportunity_id");

CREATE INDEX "opportunities_watchlist_user_id_6a4aacc7" ON "opportunities_watchlist" ("user_id");

CREATE UNIQUE INDEX "opportunities_watchlist_user_id_opportunity_id_bf2fe795_uniq" ON "opportunities_watchlist" ("user_id", "opportunity_id");

CREATE INDEX "projects_pr_owner_i_4798b7_idx" ON "projects_project" ("owner_id", "status");

CREATE INDEX "projects_project_owner_id_b940de39" ON "projects_project" ("owner_id");

CREATE INDEX "projects_projectanalysis_project_id_e1526642" ON "projects_projectanalysis" ("project_id");

