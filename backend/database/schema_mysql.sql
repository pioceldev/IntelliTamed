-- ============================================================
-- IntelliTamed — Schéma MySQL (phpMyAdmin)
-- Généré depuis les modèles Django (dialecte MySQL 8)
-- Import : phpMyAdmin → Importer → sélectionner ce fichier
-- ============================================================

SET NAMES utf8mb4;
SET default_storage_engine = InnoDB;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS intellitamed CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE intellitamed;

CREATE TABLE `accounts_profile` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `first_name` varchar(100) NOT NULL, `last_name` varchar(100) NOT NULL, `country` varchar(100) NOT NULL, `bio` longtext NOT NULL, `website` varchar(200) NOT NULL, `linkedin` varchar(200) NOT NULL, `profile_type` varchar(30) NOT NULL, `domain` varchar(100) NOT NULL, `skills` json NOT NULL, `experience` varchar(20) NOT NULL, `goals` json NOT NULL, `interests` json NOT NULL, `ai_preferences` json NOT NULL, `onboarding_completed` bool NOT NULL, `created_at` datetime(6) NOT NULL, `updated_at` datetime(6) NOT NULL, `user_id` bigint NOT NULL UNIQUE) ENGINE=InnoDB;
CREATE TABLE `accounts_user` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `password` varchar(128) NOT NULL, `last_login` datetime(6) NULL, `is_superuser` bool NOT NULL, `first_name` varchar(150) NOT NULL, `last_name` varchar(150) NOT NULL, `is_staff` bool NOT NULL, `is_active` bool NOT NULL, `date_joined` datetime(6) NOT NULL, `email` varchar(254) NOT NULL UNIQUE, `role` varchar(20) NOT NULL, `created_at` datetime(6) NOT NULL) ENGINE=InnoDB;
CREATE TABLE `accounts_user_groups` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `user_id` bigint NOT NULL, `group_id` integer NOT NULL) ENGINE=InnoDB;
CREATE TABLE `accounts_user_user_permissions` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `user_id` bigint NOT NULL, `permission_id` integer NOT NULL) ENGINE=InnoDB;
CREATE TABLE `action_plans_actionplan` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `title` varchar(200) NOT NULL, `description` longtext NOT NULL, `status` varchar(20) NOT NULL, `created_at` datetime(6) NOT NULL, `updated_at` datetime(6) NOT NULL, `project_id` bigint NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `action_plans_actionstep` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `title` varchar(200) NOT NULL, `description` longtext NOT NULL, `category` varchar(50) NOT NULL, `priority` varchar(10) NOT NULL, `status` varchar(10) NOT NULL, `deadline` date NULL, `order` integer UNSIGNED NOT NULL CHECK (`order` >= 0), `phase` varchar(10) NOT NULL, `created_at` datetime(6) NOT NULL, `plan_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `django_admin_log` (`id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY, `action_time` datetime(6) NOT NULL, `object_id` longtext NULL, `object_repr` varchar(200) NOT NULL, `action_flag` smallint UNSIGNED NOT NULL CHECK (`action_flag` >= 0), `change_message` longtext NOT NULL, `content_type_id` integer NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `ai_airequest` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `request_type` varchar(20) NOT NULL, `model_used` varchar(100) NOT NULL, `status` varchar(10) NOT NULL, `usage_info` json NOT NULL, `error` longtext NOT NULL, `created_at` datetime(6) NOT NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `ai_conversation` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `title` varchar(200) NOT NULL, `created_at` datetime(6) NOT NULL, `updated_at` datetime(6) NOT NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `ai_message` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `role` varchar(10) NOT NULL, `content` longtext NOT NULL, `created_at` datetime(6) NOT NULL, `conversation_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `auth_group` (`id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY, `name` varchar(150) NOT NULL UNIQUE) ENGINE=InnoDB;
CREATE TABLE `auth_group_permissions` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `group_id` integer NOT NULL, `permission_id` integer NOT NULL) ENGINE=InnoDB;
CREATE TABLE `auth_permission` (`id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY, `name` varchar(255) NOT NULL, `content_type_id` integer NOT NULL, `codename` varchar(100) NOT NULL) ENGINE=InnoDB;
CREATE TABLE `django_content_type` (`id` integer AUTO_INCREMENT NOT NULL PRIMARY KEY, `app_label` varchar(100) NOT NULL, `model` varchar(100) NOT NULL) ENGINE=InnoDB;
CREATE TABLE `notifications_notification` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `title` varchar(200) NOT NULL, `content` longtext NOT NULL, `type` varchar(20) NOT NULL, `read` bool NOT NULL, `created_at` datetime(6) NOT NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `opportunities_opportunity` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `title` varchar(200) NOT NULL, `organization` varchar(200) NOT NULL, `description` longtext NOT NULL, `category` varchar(20) NOT NULL, `location` varchar(150) NOT NULL, `remote` bool NOT NULL, `deadline` date NULL, `link` varchar(200) NOT NULL, `status` varchar(10) NOT NULL, `created_at` datetime(6) NOT NULL) ENGINE=InnoDB;
CREATE TABLE `opportunities_watchlist` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `created_at` datetime(6) NOT NULL, `opportunity_id` bigint NOT NULL, `user_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `projects_project` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `name` varchar(200) NOT NULL, `description` longtext NOT NULL, `problem` longtext NOT NULL, `solution` longtext NOT NULL, `target_audience` varchar(300) NOT NULL, `objectives` json NOT NULL, `business_model` varchar(200) NOT NULL, `category` varchar(100) NOT NULL, `status` varchar(20) NOT NULL, `progress` smallint UNSIGNED NOT NULL CHECK (`progress` >= 0), `due_date` date NULL, `created_at` datetime(6) NOT NULL, `updated_at` datetime(6) NOT NULL, `owner_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `projects_projectanalysis` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `summary` longtext NOT NULL, `strengths` json NOT NULL, `weaknesses` json NOT NULL, `opportunities` json NOT NULL, `risks` json NOT NULL, `recommendations` json NOT NULL, `next_steps` json NOT NULL, `created_at` datetime(6) NOT NULL, `project_id` bigint NOT NULL) ENGINE=InnoDB;
CREATE TABLE `django_session` (`session_key` varchar(40) NOT NULL PRIMARY KEY, `session_data` longtext NOT NULL, `expire_date` datetime(6) NOT NULL) ENGINE=InnoDB;
CREATE TABLE `subscriptions_subscription` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `plan` varchar(20) NOT NULL, `status` varchar(20) NOT NULL, `start_date` date NOT NULL, `end_date` date NULL, `payment_info` json NOT NULL, `created_at` datetime(6) NOT NULL, `user_id` bigint NOT NULL UNIQUE) ENGINE=InnoDB;
ALTER TABLE `accounts_profile` ADD CONSTRAINT `accounts_profile_user_id_49a85d32_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `accounts_user_groups` ADD CONSTRAINT `accounts_user_groups_user_id_group_id_59c0b32f_uniq` UNIQUE (`user_id`, `group_id`);
ALTER TABLE `accounts_user_groups` ADD CONSTRAINT `accounts_user_groups_user_id_52b62117_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `accounts_user_groups` ADD CONSTRAINT `accounts_user_groups_group_id_bd11a704_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);
ALTER TABLE `accounts_user_user_permissions` ADD CONSTRAINT `accounts_user_user_permi_user_id_permission_id_2ab516c2_uniq` UNIQUE (`user_id`, `permission_id`);
ALTER TABLE `accounts_user_user_permissions` ADD CONSTRAINT `accounts_user_user_p_user_id_e4f0a161_fk_accounts_` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `accounts_user_user_permissions` ADD CONSTRAINT `accounts_user_user_p_permission_id_113bb443_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`);
ALTER TABLE `action_plans_actionplan` ADD CONSTRAINT `action_plans_actionp_project_id_b9132dcc_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`);
ALTER TABLE `action_plans_actionplan` ADD CONSTRAINT `action_plans_actionplan_user_id_f51cf452_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `action_plans_actionstep` ADD CONSTRAINT `action_plans_actions_plan_id_3b5d2277_fk_action_pl` FOREIGN KEY (`plan_id`) REFERENCES `action_plans_actionplan` (`id`);
ALTER TABLE `django_admin_log` ADD CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`);
ALTER TABLE `django_admin_log` ADD CONSTRAINT `django_admin_log_user_id_c564eba6_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `ai_airequest` ADD CONSTRAINT `ai_airequest_user_id_e07aa572_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
CREATE INDEX `ai_aireques_user_id_3c2ad7_idx` ON `ai_airequest` (`user_id`, `request_type`, `status`);
ALTER TABLE `ai_conversation` ADD CONSTRAINT `ai_conversation_user_id_416bb629_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `ai_message` ADD CONSTRAINT `ai_message_conversation_id_0ad97782_fk_ai_conversation_id` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation` (`id`);
ALTER TABLE `auth_group_permissions` ADD CONSTRAINT `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` UNIQUE (`group_id`, `permission_id`);
ALTER TABLE `auth_group_permissions` ADD CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);
ALTER TABLE `auth_group_permissions` ADD CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`);
ALTER TABLE `auth_permission` ADD CONSTRAINT `auth_permission_content_type_id_codename_01ab375a_uniq` UNIQUE (`content_type_id`, `codename`);
ALTER TABLE `auth_permission` ADD CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`);
ALTER TABLE `django_content_type` ADD CONSTRAINT `django_content_type_app_label_model_76bd3d3b_uniq` UNIQUE (`app_label`, `model`);
ALTER TABLE `notifications_notification` ADD CONSTRAINT `notifications_notification_user_id_b5e8c0ff_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
CREATE INDEX `opportuniti_categor_eb29b5_idx` ON `opportunities_opportunity` (`category`, `status`);
ALTER TABLE `opportunities_watchlist` ADD CONSTRAINT `opportunities_watchlist_user_id_opportunity_id_bf2fe795_uniq` UNIQUE (`user_id`, `opportunity_id`);
ALTER TABLE `opportunities_watchlist` ADD CONSTRAINT `opportunities_watchl_opportunity_id_12800371_fk_opportuni` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities_opportunity` (`id`);
ALTER TABLE `opportunities_watchlist` ADD CONSTRAINT `opportunities_watchlist_user_id_6a4aacc7_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);
ALTER TABLE `projects_project` ADD CONSTRAINT `projects_project_owner_id_b940de39_fk_accounts_user_id` FOREIGN KEY (`owner_id`) REFERENCES `accounts_user` (`id`);
CREATE INDEX `projects_pr_owner_i_4798b7_idx` ON `projects_project` (`owner_id`, `status`);
ALTER TABLE `projects_projectanalysis` ADD CONSTRAINT `projects_projectanal_project_id_e1526642_fk_projects_` FOREIGN KEY (`project_id`) REFERENCES `projects_project` (`id`);
CREATE INDEX `django_session_expire_date_a5c62663` ON `django_session` (`expire_date`);
ALTER TABLE `subscriptions_subscription` ADD CONSTRAINT `subscriptions_subscription_user_id_a353e93d_fk_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `accounts_user` (`id`);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Table interne Django : marque les migrations comme appliquées
-- (évite que `python manage.py migrate` tente de recréer les tables)
-- ============================================================

CREATE TABLE `django_migrations` (`id` bigint AUTO_INCREMENT NOT NULL PRIMARY KEY, `app` varchar(255) NOT NULL, `name` varchar(255) NOT NULL, `applied` datetime(6) NOT NULL) ENGINE=InnoDB;

INSERT INTO `django_migrations` (`app`, `name`, `applied`) VALUES
    ('contenttypes', '0001_initial', NOW()),
    ('contenttypes', '0002_remove_content_type_name', NOW()),
    ('auth', '0001_initial', NOW()),
    ('auth', '0002_alter_permission_name_max_length', NOW()),
    ('auth', '0003_alter_user_email_max_length', NOW()),
    ('auth', '0004_alter_user_username_opts', NOW()),
    ('auth', '0005_alter_user_last_login_null', NOW()),
    ('auth', '0006_require_contenttypes_0002', NOW()),
    ('auth', '0007_alter_validators_add_error_messages', NOW()),
    ('auth', '0008_alter_user_username_max_length', NOW()),
    ('auth', '0009_alter_user_last_name_max_length', NOW()),
    ('auth', '0010_alter_group_name_max_length', NOW()),
    ('auth', '0011_update_proxy_permissions', NOW()),
    ('auth', '0012_alter_user_first_name_max_length', NOW()),
    ('admin', '0001_initial', NOW()),
    ('admin', '0002_logentry_remove_auto_add', NOW()),
    ('admin', '0003_logentry_add_action_flag_choices', NOW()),
    ('sessions', '0001_initial', NOW()),
    ('accounts', '0001_initial', NOW()),
    ('accounts', '0002_alter_user_managers', NOW()),
    ('projects', '0001_initial', NOW()),
    ('ai', '0001_initial', NOW()),
    ('action_plans', '0001_initial', NOW()),
    ('action_plans', '0002_actionstep_phase', NOW()),
    ('opportunities', '0001_initial', NOW()),
    ('notifications', '0001_initial', NOW()),
    ('subscriptions', '0001_initial', NOW());

-- ============================================================
-- Fin du schéma — IntelliTamed
-- ============================================================
