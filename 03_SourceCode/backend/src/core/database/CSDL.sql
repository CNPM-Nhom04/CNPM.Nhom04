--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!
--QUÉT KHỐI TỪNG PHẦN ĐỂ CHẠY CHỨ KHÔNG CÓ CHẠY 1 LƯỢT TOÀN BỘ!!!!!

--Chạy đầu tiên
DROP DATABASE IF EXISTS ctdt_management;
CREATE DATABASE ctdt_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE ctdt_management;
--Chạy đầu tiên

--Lần chạy thứ 2
SET NAMES utf8mb4;

CREATE TABLE organizational_units (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NULL,
  unit_code VARCHAR(50) NOT NULL,
  unit_name VARCHAR(255) NOT NULL,
  unit_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_organizational_units_code (unit_code),
  KEY idx_organizational_units_parent (parent_id),
  CONSTRAINT fk_organizational_units_parent FOREIGN KEY (parent_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_organizational_units_type CHECK (unit_type IN ('FACULTY','DEPARTMENT','CENTER','SCHOOL','OTHER')),
  CONSTRAINT chk_organizational_units_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Academic/administrative organizational units with optional hierarchy';

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizational_unit_id BIGINT UNSIGNED NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  account_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(6) NULL,
  last_login_at DATETIME(6) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  password_changed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_org_unit (organizational_unit_id),
  KEY idx_users_status (account_status),
  CONSTRAINT fk_users_org_unit FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_users_status CHECK (account_status IN ('ACTIVE','LOCKED','DISABLED','PENDING'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Application users; password_hash stores only a secure password hash';

CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  used_at DATETIME(6) NULL,
  requested_ip VARCHAR(45) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_password_reset_tokens_hash (token_hash),
  KEY idx_password_reset_tokens_user_expiry (user_id, expires_at),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  KEY idx_password_reset_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hashed reset-password tokens; never store raw reset tokens';

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(50) NOT NULL,
  role_name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_code (role_code),
  CONSTRAINT chk_roles_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='RBAC roles';

CREATE TABLE permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(100) NOT NULL,
  permission_name VARCHAR(200) NOT NULL,
  module_code VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  description VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_permissions_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Atomic application permissions';

CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Many-to-many assignment of users to roles';

CREATE TABLE role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Permissions granted to each role';

CREATE TABLE education_levels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level_code VARCHAR(30) NOT NULL,
  level_name VARCHAR(150) NOT NULL,
  min_total_credits DECIMAL(6,2) NULL,
  max_total_credits DECIMAL(6,2) NULL,
  min_elective_ratio DECIMAL(5,2) NULL,
  max_elective_ratio DECIMAL(5,2) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_education_levels_code (level_code),
  CONSTRAINT chk_education_levels_status CHECK (status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT chk_education_levels_credits CHECK (min_total_credits IS NULL OR max_total_credits IS NULL OR max_total_credits >= min_total_credits),
  CONSTRAINT chk_education_levels_ratio CHECK ((min_elective_ratio IS NULL OR (min_elective_ratio >= 0 AND min_elective_ratio <= 100)) AND (max_elective_ratio IS NULL OR (max_elective_ratio >= 0 AND max_elective_ratio <= 100)) AND (min_elective_ratio IS NULL OR max_elective_ratio IS NULL OR max_elective_ratio >= min_elective_ratio))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Education levels; holds BR-05/BR-06 thresholds (total credits, elective ratio) per level';

CREATE TABLE majors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizational_unit_id BIGINT UNSIGNED NOT NULL,
  major_code VARCHAR(50) NOT NULL,
  major_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_majors_code (major_code),
  KEY idx_majors_org_unit (organizational_unit_id),
  CONSTRAINT fk_majors_org_unit FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_majors_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Academic majors managed by organizational units';

CREATE TABLE study_tracks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_code VARCHAR(50) NOT NULL,
  track_name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_study_tracks_code (track_code),
  CONSTRAINT chk_study_tracks_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Configurable study tracks; never hard-code research/application as booleans';

CREATE TABLE courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owning_unit_id BIGINT UNSIGNED NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  retired_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_courses_course_code (course_code),
  KEY idx_courses_owning_unit (owning_unit_id),
  KEY idx_courses_status (status),
  CONSTRAINT fk_courses_owning_unit FOREIGN KEY (owning_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_courses_status CHECK (status IN ('ACTIVE','INACTIVE','RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stable course identity. Mutable academic attributes live in course_versions';

CREATE TABLE course_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  english_name VARCHAR(255) NULL,
  credits DECIMAL(5,2) NOT NULL,
  theory_hours SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  practice_hours SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  description TEXT NULL,
  search_text VARCHAR(600) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  active_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN course_id END) STORED,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_versions_course_version (course_id, version_no),
  KEY idx_course_versions_course_effective (course_id, effective_from),
  KEY idx_course_versions_status (status),
  CONSTRAINT fk_course_versions_course FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_course_versions_credits CHECK (credits > 0),
  CONSTRAINT chk_course_versions_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT chk_course_versions_status CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  UNIQUE KEY uk_course_versions_active (active_key),
  FULLTEXT KEY ft_course_versions_search (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Versioned course name, credits, hours and description; published curricula reference this table';

CREATE TABLE course_outline_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_version_id BIGINT UNSIGNED NOT NULL,
  outline_version_no INT UNSIGNED NOT NULL,
  objectives LONGTEXT NULL,
  content LONGTEXT NULL,
  teaching_methods LONGTEXT NULL,
  assessment_methods LONGTEXT NULL,
  references_text LONGTEXT NULL,
  file_url VARCHAR(1000) NULL,
  file_name VARCHAR(255) NULL,
  file_size_bytes INT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  published_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'PUBLISHED' THEN course_version_id END) STORED,
  effective_from DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_outline_versions (course_version_id, outline_version_no),
  KEY idx_course_outline_status (course_version_id, status),
  CONSTRAINT fk_course_outline_course_version FOREIGN KEY (course_version_id) REFERENCES course_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_outline_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_course_outline_status CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  UNIQUE KEY uk_course_outline_published (published_key),
  CONSTRAINT chk_course_outline_file_size CHECK (file_size_bytes IS NULL OR file_size_bytes <= 10485760)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Versioned detailed course outlines; optional and independent of course creation';

CREATE TABLE training_programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  major_id BIGINT UNSIGNED NOT NULL,
  education_level_id BIGINT UNSIGNED NOT NULL,
  managing_unit_id BIGINT UNSIGNED NOT NULL,
  program_code VARCHAR(50) NOT NULL,
  program_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_training_programs_code (program_code),
  KEY idx_training_programs_major (major_id),
  KEY idx_training_programs_level (education_level_id),
  KEY idx_training_programs_unit (managing_unit_id),
  CONSTRAINT fk_training_programs_major FOREIGN KEY (major_id) REFERENCES majors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_training_programs_level FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_training_programs_unit FOREIGN KEY (managing_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_training_programs_status CHECK (status IN ('ACTIVE','INACTIVE','RETIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stable high-level training program identity';

CREATE TABLE program_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_id BIGINT UNSIGNED NOT NULL,
  source_program_version_id BIGINT UNSIGNED NULL,
  version_code VARCHAR(50) NOT NULL,
  program_name_snapshot VARCHAR(255) NOT NULL,
  search_text VARCHAR(600) NULL,
  cohort_year SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  status_reason VARCHAR(1000) NULL,
  published_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'PUBLISHED' THEN program_id * 10000 + cohort_year END) STORED,
  effective_from DATE NULL,
  effective_to DATE NULL,
  submitted_at DATETIME(6) NULL,
  published_at DATETIME(6) NULL,
  archived_at DATETIME(6) NULL,
  retired_at DATETIME(6) NULL,
  locked_at DATETIME(6) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_program_versions_code (program_id, version_code),
  KEY idx_program_versions_program_cohort (program_id, cohort_year),
  KEY idx_program_versions_status (status),
  KEY idx_program_versions_cohort_status (cohort_year, status),
  CONSTRAINT fk_program_versions_program FOREIGN KEY (program_id) REFERENCES training_programs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_program_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_program_versions_cohort CHECK (cohort_year BETWEEN 1900 AND 2200),
  CONSTRAINT chk_program_versions_dates CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CONSTRAINT chk_program_versions_status CHECK ( status IN ('DRAFT','SUBMITTED','REVIEWING','RETURNED','PUBLISHED','ARCHIVED','RETIRED') ),
  UNIQUE KEY uk_program_versions_published (published_key),
  KEY idx_program_versions_source (source_program_version_id),
  CONSTRAINT fk_program_versions_source FOREIGN KEY (source_program_version_id) REFERENCES program_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_program_versions_lock CHECK (status NOT IN ('PUBLISHED','ARCHIVED') OR (locked_at IS NOT NULL AND published_at IS NOT NULL)),
  CONSTRAINT chk_program_versions_archived CHECK (status <> 'ARCHIVED' OR archived_at IS NOT NULL),
  CONSTRAINT chk_program_versions_retired CHECK (status <> 'RETIRED' OR (retired_at IS NOT NULL AND status_reason IS NOT NULL AND status_reason <> '')),
  CONSTRAINT chk_program_versions_submitted CHECK (status IN ('DRAFT','RETIRED') OR submitted_at IS NOT NULL),
  FULLTEXT KEY ft_program_versions_search (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable-on-publish versions of training programs, normally associated with admission cohorts';

CREATE TABLE program_version_tracks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_version_id BIGINT UNSIGNED NOT NULL,
  study_track_id BIGINT UNSIGNED NULL,
  track_code_snapshot VARCHAR(50) NOT NULL,
  track_name_snapshot VARCHAR(150) NOT NULL,
  required_total_credits DECIMAL(6,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_program_version_tracks_code (program_version_id, track_code_snapshot),
  KEY idx_program_version_tracks_track (study_track_id),
  KEY idx_program_version_tracks_version (program_version_id),
  CONSTRAINT fk_program_version_tracks_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_program_version_tracks_track FOREIGN KEY (study_track_id) REFERENCES study_tracks(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_program_version_tracks_credits CHECK (required_total_credits >= 0),
  CONSTRAINT chk_program_version_tracks_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Version-specific study tracks. study_track_id may be NULL for a general/default track';

CREATE TABLE curriculum_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_version_track_id BIGINT UNSIGNED NOT NULL,
  parent_group_id BIGINT UNSIGNED NULL,
  group_code VARCHAR(50) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  minimum_credits DECIMAL(6,2) NOT NULL DEFAULT 0,
  maximum_credits DECIMAL(6,2) NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_curriculum_groups_code (program_version_track_id, group_code),
  KEY idx_curriculum_groups_track_order (program_version_track_id, display_order),
  KEY idx_curriculum_groups_parent (parent_group_id),
  CONSTRAINT fk_curriculum_groups_track FOREIGN KEY (program_version_track_id) REFERENCES program_version_tracks(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_curriculum_groups_parent FOREIGN KEY (parent_group_id) REFERENCES curriculum_groups(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_curriculum_groups_min CHECK (minimum_credits >= 0),
  CONSTRAINT chk_curriculum_groups_max CHECK (maximum_credits IS NULL OR maximum_credits >= minimum_credits)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Curriculum knowledge groups. minimum_credits is credits a student must earn in the group';

CREATE TABLE curriculum_courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  curriculum_group_id BIGINT UNSIGNED NOT NULL,
  program_version_track_id BIGINT UNSIGNED NOT NULL,
  course_version_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  requirement_type VARCHAR(20) NOT NULL,
  suggested_semester TINYINT UNSIGNED NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  notes VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_curriculum_courses_group_course (curriculum_group_id, course_version_id),
  KEY idx_curriculum_courses_group_order (curriculum_group_id, display_order),
  KEY idx_curriculum_courses_course_version (course_version_id),
  CONSTRAINT fk_curriculum_courses_group FOREIGN KEY (curriculum_group_id) REFERENCES curriculum_groups(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_curriculum_courses_course_version FOREIGN KEY (course_version_id) REFERENCES course_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_curriculum_courses_requirement CHECK (requirement_type IN ('REQUIRED','ELECTIVE')),
  UNIQUE KEY uk_curriculum_courses_track_course (program_version_track_id, course_id),
  KEY idx_curriculum_courses_course (course_id),
  CONSTRAINT fk_curriculum_courses_track FOREIGN KEY (program_version_track_id) REFERENCES program_version_tracks(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_curriculum_courses_course FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_curriculum_courses_semester CHECK (suggested_semester IS NULL OR suggested_semester BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Course placement inside a curriculum; required/elective belongs here, not on courses';

CREATE TABLE curriculum_prerequisites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  curriculum_course_id BIGINT UNSIGNED NOT NULL,
  prerequisite_curriculum_course_id BIGINT UNSIGNED NOT NULL,
  minimum_grade VARCHAR(20) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_curriculum_prerequisites_pair (curriculum_course_id, prerequisite_curriculum_course_id),
  KEY idx_curriculum_prerequisites_target (prerequisite_curriculum_course_id),
  CONSTRAINT fk_curriculum_prerequisites_course FOREIGN KEY (curriculum_course_id) REFERENCES curriculum_courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_curriculum_prerequisites_required_course FOREIGN KEY (prerequisite_curriculum_course_id) REFERENCES curriculum_courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_curriculum_prerequisites_not_self CHECK (curriculum_course_id <> prerequisite_curriculum_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Prerequisite graph scoped to curriculum entries; cycle detection is handled in application validation';

CREATE TABLE program_learning_outcomes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_version_id BIGINT UNSIGNED NOT NULL,
  plo_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_program_learning_outcomes_code (program_version_id, plo_code),
  KEY idx_program_learning_outcomes_version (program_version_id, display_order),
  CONSTRAINT fk_program_learning_outcomes_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_program_learning_outcomes_status CHECK (status IN ('ACTIVE','INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Program Learning Outcomes scoped to a program version';

CREATE TABLE curriculum_course_plos (
  curriculum_course_id BIGINT UNSIGNED NOT NULL,
  plo_id BIGINT UNSIGNED NOT NULL,
  contribution_level VARCHAR(20) NULL,
  PRIMARY KEY (curriculum_course_id, plo_id),
  KEY idx_curriculum_course_plos_plo (plo_id),
  CONSTRAINT fk_curriculum_course_plos_course FOREIGN KEY (curriculum_course_id) REFERENCES curriculum_courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_curriculum_course_plos_plo FOREIGN KEY (plo_id) REFERENCES program_learning_outcomes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_curriculum_course_plos_level CHECK ( contribution_level IS NULL OR contribution_level IN ('INTRODUCE','REINFORCE','MASTER') )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Optional mapping from curriculum courses to program learning outcomes';

CREATE TABLE approval_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_version_id BIGINT UNSIGNED NOT NULL,
  request_no VARCHAR(50) NOT NULL,
  current_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requested_by BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  completed_at DATETIME(6) NULL,
  review_started_at DATETIME(6) NULL,
  reviewing_by BIGINT UNSIGNED NULL,
  next_reminder_at DATETIME(6) NULL,
  last_reminded_at DATETIME(6) NULL,
  reminder_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  pending_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN current_status = 'PENDING' THEN program_version_id END) STORED,
  latest_comment TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_approval_requests_no (request_no),
  KEY idx_approval_requests_pending (current_status, requested_at),
  KEY idx_approval_requests_version (program_version_id, requested_at),
  CONSTRAINT fk_approval_requests_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_approval_requests_requested_by FOREIGN KEY (requested_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_approval_requests_status CHECK (current_status IN ('PENDING','APPROVED','RETURNED','CANCELLED')),
  UNIQUE KEY uk_approval_requests_pending (pending_key),
  KEY idx_approval_requests_reminder (current_status, next_reminder_at),
  CONSTRAINT fk_approval_requests_reviewing_by FOREIGN KEY (reviewing_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_approval_requests_completed CHECK ((current_status = 'PENDING' AND completed_at IS NULL) OR (current_status <> 'PENDING' AND completed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One submission/review cycle for a program version';

CREATE TABLE approval_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  approval_request_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(30) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  comment_text TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_approval_actions_request_time (approval_request_id, created_at),
  KEY idx_approval_actions_actor_time (actor_id, created_at),
  CONSTRAINT fk_approval_actions_request FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_approval_actions_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_approval_actions_type CHECK (action_type IN ('SUBMIT','START_REVIEW','APPROVE','RETURN','CANCEL')),
  CONSTRAINT chk_approval_actions_to_status CHECK (to_status IN ('PENDING','APPROVED','RETURNED','CANCELLED')),
  CONSTRAINT chk_approval_actions_return_comment CHECK (action_type <> 'RETURN' OR (comment_text IS NOT NULL AND comment_text <> ''))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Append-only business history of approval decisions and review actions';

CREATE TABLE students (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  organizational_unit_id BIGINT UNSIGNED NULL,
  student_code VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  admission_year SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_students_code (student_code),
  UNIQUE KEY uk_students_user (user_id),
  KEY idx_students_admission_year (admission_year),
  KEY idx_students_status (status),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_students_admission_year CHECK (admission_year BETWEEN 1900 AND 2200),
  CONSTRAINT chk_students_status CHECK (status IN ('ACTIVE','SUSPENDED','GRADUATED','INACTIVE')),
  KEY idx_students_org_unit (organizational_unit_id),
  CONSTRAINT fk_students_org_unit FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student identity; current program is not duplicated here';

CREATE TABLE student_program_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  program_version_track_id BIGINT UNSIGNED NOT NULL,
  assignment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  active_key BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN assignment_status = 'ACTIVE' THEN student_id END) STORED,
  assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ended_at DATETIME(6) NULL,
  assigned_by BIGINT UNSIGNED NULL,
  reason VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  KEY idx_student_program_assignments_student_status (student_id, assignment_status, assigned_at),
  KEY idx_student_program_assignments_track (program_version_track_id, assignment_status),
  CONSTRAINT fk_student_program_assignments_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_program_assignments_track FOREIGN KEY (program_version_track_id) REFERENCES program_version_tracks(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_program_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_student_program_assignments_status CHECK (assignment_status IN ('ACTIVE','ENDED')),
  CONSTRAINT chk_student_program_assignments_dates CHECK ( (assignment_status = 'ACTIVE' AND ended_at IS NULL) OR (assignment_status = 'ENDED' AND ended_at IS NOT NULL) ),
  UNIQUE KEY uk_student_program_assignments_active (active_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historical assignment of a student to an exact program-version track';

CREATE TABLE academic_terms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_year VARCHAR(20) NOT NULL,
  semester VARCHAR(30) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (id),
  UNIQUE KEY uk_academic_terms_year_semester (academic_year, semester),
  CONSTRAINT chk_academic_terms_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_academic_terms_status CHECK (status IN ('ACTIVE','CLOSED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Academic year/semester dimension reused by registration periods and offerings';

CREATE TABLE registration_periods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_term_id BIGINT UNSIGNED NOT NULL,
  period_code VARCHAR(50) NOT NULL,
  period_name VARCHAR(255) NOT NULL,
  open_at DATETIME(6) NOT NULL,
  close_at DATETIME(6) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_registration_periods_code (period_code),
  KEY idx_registration_periods_term (academic_term_id),
  KEY idx_registration_periods_status_time (status, open_at, close_at),
  CONSTRAINT fk_registration_periods_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_registration_periods_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_registration_periods_time CHECK (close_at > open_at),
  CONSTRAINT chk_registration_periods_status CHECK (status IN ('SCHEDULED','OPEN','CLOSED','FINALIZED','CANCELLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Course registration windows with explicit workflow state and time bounds';

CREATE TABLE registration_period_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_period_id BIGINT UNSIGNED NOT NULL,
  education_level_id BIGINT UNSIGNED NULL,
  major_id BIGINT UNSIGNED NULL,
  cohort_year SMALLINT UNSIGNED NULL,
  program_version_id BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_registration_period_scopes_period (registration_period_id),
  KEY idx_registration_period_scopes_program_version (program_version_id),
  KEY idx_registration_period_scopes_major_level (major_id, education_level_id),
  CONSTRAINT fk_registration_period_scopes_period FOREIGN KEY (registration_period_id) REFERENCES registration_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_registration_period_scopes_level FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_registration_period_scopes_major FOREIGN KEY (major_id) REFERENCES majors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_registration_period_scopes_program_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_registration_period_scopes_not_empty CHECK ( education_level_id IS NOT NULL OR major_id IS NOT NULL OR cohort_year IS NOT NULL OR program_version_id IS NOT NULL ),
  CONSTRAINT chk_registration_period_scopes_cohort CHECK (cohort_year IS NULL OR cohort_year BETWEEN 1900 AND 2200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Structured applicability scopes for a registration period';

CREATE TABLE registration_period_rules (
  registration_period_id BIGINT UNSIGNED NOT NULL,
  minimum_credits DECIMAL(6,2) NULL,
  maximum_credits DECIMAL(6,2) NULL,
  allow_withdrawal TINYINT(1) NOT NULL DEFAULT 1,
  withdrawal_deadline DATETIME(6) NULL,
  PRIMARY KEY (registration_period_id),
  CONSTRAINT fk_registration_period_rules_period FOREIGN KEY (registration_period_id) REFERENCES registration_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_registration_period_rules_credits CHECK ( minimum_credits IS NULL OR maximum_credits IS NULL OR maximum_credits >= minimum_credits )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Structured registration rules that should not be stored in generic key-value settings';

CREATE TABLE course_offerings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_period_id BIGINT UNSIGNED NOT NULL,
  course_version_id BIGINT UNSIGNED NOT NULL,
  class_code VARCHAR(50) NOT NULL,
  capacity INT UNSIGNED NOT NULL,
  minimum_capacity INT UNSIGNED NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_offerings_period_class (registration_period_id, class_code),
  KEY idx_course_offerings_course_period (course_version_id, registration_period_id),
  KEY idx_course_offerings_status (status),
  CONSTRAINT fk_course_offerings_period FOREIGN KEY (registration_period_id) REFERENCES registration_periods(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_offerings_course_version FOREIGN KEY (course_version_id) REFERENCES course_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_offerings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_course_offerings_capacity CHECK (capacity > 0),
  CONSTRAINT chk_course_offerings_min_capacity CHECK (minimum_capacity IS NULL OR minimum_capacity <= capacity),
  CONSTRAINT chk_course_offerings_status CHECK (status IN ('PLANNED','OPEN','CLOSED','CONFIRMED','CANCELLED','COMPLETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Actual course classes offered during a registration period; distinct from courses';

CREATE TABLE course_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  course_offering_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED',
  registered_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  status_changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  registered_by BIGINT UNSIGNED NULL,
  note VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_course_registrations_student_offering (student_id, course_offering_id),
  KEY idx_course_registrations_student_status (student_id, status, registered_at),
  KEY idx_course_registrations_offering_status (course_offering_id, status),
  CONSTRAINT fk_course_registrations_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_registrations_offering FOREIGN KEY (course_offering_id) REFERENCES course_offerings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_course_registrations_registered_by FOREIGN KEY (registered_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_course_registrations_status CHECK (status IN ('REGISTERED','CANCELLED','WITHDRAWN','VOIDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One stateful registration row per student/offering; no physical delete';

CREATE TABLE student_course_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  course_version_id BIGINT UNSIGNED NOT NULL,
  course_offering_id BIGINT UNSIGNED NULL,
  result_status VARCHAR(20) NOT NULL DEFAULT 'PASSED',
  grade VARCHAR(20) NULL,
  passed_at DATETIME(6) NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_student_course_results_offering (student_id, course_offering_id),
  KEY idx_student_course_results_student_course (student_id, course_version_id, result_status),
  CONSTRAINT fk_student_course_results_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_course_results_course_version FOREIGN KEY (course_version_id) REFERENCES course_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_course_results_offering FOREIGN KEY (course_offering_id) REFERENCES course_offerings(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_student_course_results_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_student_course_results_status CHECK (result_status IN ('PASSED','FAILED','INCOMPLETE','EXEMPTED')),
  KEY idx_student_course_results_course (student_id, course_id, result_status),
  CONSTRAINT fk_student_course_results_course FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Minimal result source for prerequisite checks; detailed grading integration is TBD';

CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_id BIGINT UNSIGNED NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  related_entity_type VARCHAR(100) NULL,
  related_entity_id BIGINT UNSIGNED NULL,
  dedupe_key VARCHAR(150) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_notifications_receiver_unread (receiver_id, is_read, created_at),
  CONSTRAINT fk_notifications_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT fk_notifications_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_notifications_read_state CHECK ((is_read = 0 AND read_at IS NULL) OR (is_read = 1)),
  UNIQUE KEY uk_notifications_dedupe (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='In-system notifications; related entity is intentionally polymorphic';

CREATE TABLE system_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(150) NOT NULL,
  value_type VARCHAR(20) NOT NULL,
  setting_value TEXT NOT NULL,
  description VARCHAR(1000) NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_system_settings_key (setting_key),
  CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_system_settings_type CHECK (value_type IN ('STRING','INTEGER','DECIMAL','BOOLEAN','DURATION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Simple global settings only; structured business rules use dedicated tables';

CREATE TABLE api_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_code VARCHAR(100) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(6) NULL,
  secret_rotated_at DATETIME(6) NULL,
  allowed_ips VARCHAR(1000) NULL,
  rate_limit_per_minute SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_used_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_clients_code (client_code),
  CONSTRAINT fk_api_clients_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT chk_api_clients_status CHECK (status IN ('ACTIVE','DISABLED','REVOKED')),
  CONSTRAINT chk_api_clients_rate CHECK (rate_limit_per_minute > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Read-only integration clients; store only secret hashes';

CREATE TABLE api_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_code VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_api_scopes_code (scope_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Whitelisted read-only API scopes';

CREATE TABLE api_client_scopes (
  api_client_id BIGINT UNSIGNED NOT NULL,
  api_scope_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (api_client_id, api_scope_id),
  KEY idx_api_client_scopes_scope (api_scope_id),
  CONSTRAINT fk_api_client_scopes_client FOREIGN KEY (api_client_id) REFERENCES api_clients(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_api_client_scopes_scope FOREIGN KEY (api_scope_id) REFERENCES api_scopes(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scopes granted to integration clients';

CREATE TABLE api_access_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api_client_id BIGINT UNSIGNED NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  http_method VARCHAR(10) NOT NULL,
  response_status SMALLINT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NULL,
  requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_api_access_logs_client_time (api_client_id, requested_at),
  KEY idx_api_access_logs_requested_at (requested_at),
  CONSTRAINT fk_api_access_logs_client FOREIGN KEY (api_client_id) REFERENCES api_clients(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_api_access_logs_method CHECK (http_method IN ('GET','HEAD','OPTIONS'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Access log for read-only integration APIs';

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL,
  actor_username VARCHAR(100) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  scope_unit_id BIGINT UNSIGNED NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  reason VARCHAR(1000) NULL,
  ip_address VARCHAR(45) NULL,
  request_id VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_audit_logs_entity_time (entity_type, entity_id, created_at),
  KEY idx_audit_logs_actor_time (actor_id, created_at),
  KEY idx_audit_logs_action_time (action, created_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  KEY idx_audit_logs_scope_time (scope_unit_id, created_at),
  CONSTRAINT fk_audit_logs_scope_unit FOREIGN KEY (scope_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Append-only generic audit log; not a replacement for domain-specific history';

CREATE TABLE import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_type VARCHAR(50) NOT NULL,
  source_filename VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  invalid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  confirmed_at DATETIME(6) NULL,
  committed_at DATETIME(6) NULL,
  failure_reason VARCHAR(1000) NULL,
  file_sha256 CHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_import_batches_status_time (status, created_at),
  CONSTRAINT fk_import_batches_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_import_batches_status CHECK (status IN ('UPLOADED','PARSED','VALIDATED','CONFIRMED','COMMITTED','FAILED','CANCELLED')),
  KEY idx_import_batches_sha (file_sha256),
  KEY idx_import_batches_creator (created_by, created_at),
  CONSTRAINT chk_import_batches_type CHECK (import_type IN ('COURSE','STUDENT','STUDENT_RESULT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Import workflow header for Excel/Google Sheets staging';

CREATE TABLE import_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_batch_id BIGINT UNSIGNED NOT NULL,
  row_no INT UNSIGNED NOT NULL,
  raw_data JSON NOT NULL,
  normalized_data JSON NULL,
  row_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_import_rows_batch_row (import_batch_id, row_no),
  KEY idx_import_rows_status (import_batch_id, row_status),
  CONSTRAINT fk_import_rows_batch FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_import_rows_status CHECK (row_status IN ('PENDING','VALID','INVALID','IMPORTED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Staged import rows before production commit';

CREATE TABLE import_errors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_row_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(150) NULL,
  error_code VARCHAR(100) NOT NULL,
  error_message VARCHAR(1000) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_import_errors_row (import_row_id),
  CONSTRAINT fk_import_errors_row FOREIGN KEY (import_row_id) REFERENCES import_rows(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Validation errors for individual staged import rows';

CREATE TABLE organizational_unit_closure (
  ancestor_id BIGINT UNSIGNED NOT NULL,
  descendant_id BIGINT UNSIGNED NOT NULL,
  depth SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  KEY idx_org_unit_closure_descendant (descendant_id),
  CONSTRAINT fk_org_unit_closure_ancestor FOREIGN KEY (ancestor_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_org_unit_closure_descendant FOREIGN KEY (descendant_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Closure table of the organizational unit tree (maintained by trigger); used for ORG_UNIT scope including child units';

CREATE TABLE education_level_tracks (
  education_level_id BIGINT UNSIGNED NOT NULL,
  study_track_id BIGINT UNSIGNED NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (education_level_id, study_track_id),
  KEY idx_education_level_tracks_track (study_track_id),
  CONSTRAINT fk_education_level_tracks_level FOREIGN KEY (education_level_id) REFERENCES education_levels(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_education_level_tracks_track FOREIGN KEY (study_track_id) REFERENCES study_tracks(id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Valid and mandatory study tracks per education level (BR-09): every listed track must exist in a program version';

CREATE TABLE workflow_transitions (
  entity_type VARCHAR(40) NOT NULL,
  from_status VARCHAR(30) NOT NULL,
  to_status VARCHAR(30) NOT NULL,
  required_permission VARCHAR(100) NULL,
  requires_reason TINYINT(1) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  PRIMARY KEY (entity_type, from_status, to_status),
  CONSTRAINT chk_workflow_transitions_entity CHECK (entity_type IN ('PROGRAM_VERSION','APPROVAL_REQUEST'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Data-driven state machine; triggers reject any status change that is not listed here (SRS 3.8)';

CREATE TABLE notification_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  recipient_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME(6) NULL,
  last_error VARCHAR(1000) NULL,
  sent_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_notification_deliveries_queue (status, next_attempt_at),
  KEY idx_notification_deliveries_notification (notification_id),
  CONSTRAINT fk_notification_deliveries_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_notification_deliveries_channel CHECK (channel IN ('EMAIL')),
  CONSTRAINT chk_notification_deliveries_status CHECK (status IN ('PENDING','SENT','FAILED','CANCELLED')),
  CONSTRAINT chk_notification_deliveries_attempts CHECK (attempt_count <= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Email outbox (max 3 attempts, BR-23). Never stores secrets: password-reset links are sent directly, not via this table';

CREATE TABLE user_scopes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  scope_type VARCHAR(30) NOT NULL,
  organizational_unit_id BIGINT UNSIGNED NULL,
  major_id BIGINT UNSIGNED NULL,
  program_id BIGINT UNSIGNED NULL,
  target_id BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(organizational_unit_id, major_id, program_id, 0)) STORED,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_scopes_target (user_id, scope_type, target_id),
  KEY idx_user_scopes_org_unit (organizational_unit_id),
  KEY idx_user_scopes_major (major_id),
  KEY idx_user_scopes_program (program_id),
  CONSTRAINT fk_user_scopes_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_scopes_org_unit FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_scopes_major FOREIGN KEY (major_id) REFERENCES majors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_user_scopes_program FOREIGN KEY (program_id) REFERENCES training_programs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT chk_user_scopes_type CHECK (scope_type IN ('GLOBAL','ORG_UNIT','MAJOR','PROGRAM')),
  CONSTRAINT chk_user_scopes_target CHECK ((scope_type = 'GLOBAL' AND organizational_unit_id IS NULL AND major_id IS NULL AND program_id IS NULL) OR (scope_type = 'ORG_UNIT' AND organizational_unit_id IS NOT NULL AND major_id IS NULL AND program_id IS NULL) OR (scope_type = 'MAJOR' AND organizational_unit_id IS NULL AND major_id IS NOT NULL AND program_id IS NULL) OR (scope_type = 'PROGRAM' AND organizational_unit_id IS NULL AND major_id IS NULL AND program_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Data-access scopes layered on top of RBAC (GLOBAL/ORG_UNIT/MAJOR/PROGRAM); unique per user+target';
--Lần chạy thứ 2

--Lần chạy thứ 3
DELIMITER $$

DROP FUNCTION IF EXISTS fn_pv_editable$$
CREATE FUNCTION fn_pv_editable(p_pv_id BIGINT UNSIGNED) RETURNS TINYINT(1)
READS SQL DATA
BEGIN
  DECLARE v_status VARCHAR(30);
  SELECT status INTO v_status FROM program_versions WHERE id = p_pv_id;
  RETURN IF(v_status IN ('DRAFT','RETURNED'), 1, 0);
END$$

DROP FUNCTION IF EXISTS fn_track_editable$$
CREATE FUNCTION fn_track_editable(p_track_id BIGINT UNSIGNED) RETURNS TINYINT(1)
READS SQL DATA
BEGIN
  DECLARE v_status VARCHAR(30);
  SELECT pv.status INTO v_status FROM program_version_tracks t JOIN program_versions pv ON pv.id = t.program_version_id WHERE t.id = p_track_id;
  RETURN IF(v_status IN ('DRAFT','RETURNED'), 1, 0);
END$$

DROP TRIGGER IF EXISTS trg_org_units_ai$$
CREATE TRIGGER trg_org_units_ai AFTER INSERT ON organizational_units FOR EACH ROW
BEGIN
  INSERT INTO organizational_unit_closure (ancestor_id, descendant_id, depth) VALUES (NEW.id, NEW.id, 0);
  IF NEW.parent_id IS NOT NULL THEN
    INSERT INTO organizational_unit_closure (ancestor_id, descendant_id, depth)
    SELECT c.ancestor_id, NEW.id, c.depth + 1 FROM organizational_unit_closure c WHERE c.descendant_id = NEW.parent_id;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_org_units_bu$$
CREATE TRIGGER trg_org_units_bu BEFORE UPDATE ON organizational_units FOR EACH ROW
BEGIN
  IF NOT (NEW.parent_id <=> OLD.parent_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: changing parent_id is not supported; rebuild organizational_unit_closure instead';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_users_bd$$
CREATE TRIGGER trg_users_bd BEFORE DELETE ON users FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: users are soft-deleted (deleted_at); physical delete is not allowed';
END$$

DROP TRIGGER IF EXISTS trg_program_versions_bi$$
CREATE TRIGGER trg_program_versions_bi BEFORE INSERT ON program_versions FOR EACH ROW
BEGIN
  IF NEW.status <> 'DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_BAD_TRANSITION: a new program version must start as DRAFT';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_versions_bu$$
CREATE TRIGGER trg_program_versions_bu BEFORE UPDATE ON program_versions FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE entity_type = 'PROGRAM_VERSION' AND from_status = OLD.status AND to_status = NEW.status) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_BAD_TRANSITION: status transition is not allowed (see workflow_transitions)';
    END IF;
  END IF;
  IF OLD.locked_at IS NOT NULL AND (NEW.locked_at IS NULL OR NEW.program_id <> OLD.program_id OR NEW.cohort_year <> OLD.cohort_year OR NEW.version_code <> OLD.version_code OR NEW.program_name_snapshot <> OLD.program_name_snapshot) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: published program version identity is immutable';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_versions_bd$$
CREATE TRIGGER trg_program_versions_bd BEFORE DELETE ON program_versions FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: program versions are never physically deleted; use status RETIRED';
END$$

DROP TRIGGER IF EXISTS trg_approval_requests_bi$$
CREATE TRIGGER trg_approval_requests_bi BEFORE INSERT ON approval_requests FOR EACH ROW
BEGIN
  IF NEW.current_status <> 'PENDING' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_BAD_TRANSITION: a new approval request must start as PENDING';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_approval_requests_bu$$
CREATE TRIGGER trg_approval_requests_bu BEFORE UPDATE ON approval_requests FOR EACH ROW
BEGIN
  IF NEW.current_status <> OLD.current_status THEN
    IF NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE entity_type = 'APPROVAL_REQUEST' AND from_status = OLD.current_status AND to_status = NEW.current_status) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_BAD_TRANSITION: approval request status transition is not allowed';
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_approval_actions_bi$$
CREATE TRIGGER trg_approval_actions_bi BEFORE INSERT ON approval_actions FOR EACH ROW
BEGIN
  DECLARE v_requester BIGINT UNSIGNED;
  IF NEW.action_type = 'APPROVE' THEN
    SELECT requested_by INTO v_requester FROM approval_requests WHERE id = NEW.approval_request_id;
    IF v_requester = NEW.actor_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_SELF_APPROVE: the requester cannot approve their own submission (BR-13)';
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_approval_actions_bu$$
CREATE TRIGGER trg_approval_actions_bu BEFORE UPDATE ON approval_actions FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: approval_actions is append-only';
END$$

DROP TRIGGER IF EXISTS trg_approval_actions_bd$$
CREATE TRIGGER trg_approval_actions_bd BEFORE DELETE ON approval_actions FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: approval_actions is append-only';
END$$

DROP TRIGGER IF EXISTS trg_audit_logs_bu$$
CREATE TRIGGER trg_audit_logs_bu BEFORE UPDATE ON audit_logs FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: audit_logs is append-only';
END$$

DROP TRIGGER IF EXISTS trg_audit_logs_bd$$
CREATE TRIGGER trg_audit_logs_bd BEFORE DELETE ON audit_logs FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_ROW_IMMUTABLE: audit_logs is append-only';
END$$

DROP TRIGGER IF EXISTS trg_program_version_tracks_bi$$
CREATE TRIGGER trg_program_version_tracks_bi BEFORE INSERT ON program_version_tracks FOR EACH ROW
BEGIN
  IF fn_pv_editable(NEW.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_version_tracks_bu$$
CREATE TRIGGER trg_program_version_tracks_bu BEFORE UPDATE ON program_version_tracks FOR EACH ROW
BEGIN

  IF fn_pv_editable(OLD.program_version_id) = 0 OR fn_pv_editable(NEW.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_version_tracks_bd$$
CREATE TRIGGER trg_program_version_tracks_bd BEFORE DELETE ON program_version_tracks FOR EACH ROW
BEGIN
  IF fn_pv_editable(OLD.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_learning_outcomes_bi$$
CREATE TRIGGER trg_program_learning_outcomes_bi BEFORE INSERT ON program_learning_outcomes FOR EACH ROW
BEGIN
  IF fn_pv_editable(NEW.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_learning_outcomes_bu$$
CREATE TRIGGER trg_program_learning_outcomes_bu BEFORE UPDATE ON program_learning_outcomes FOR EACH ROW
BEGIN

  IF fn_pv_editable(OLD.program_version_id) = 0 OR fn_pv_editable(NEW.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_program_learning_outcomes_bd$$
CREATE TRIGGER trg_program_learning_outcomes_bd BEFORE DELETE ON program_learning_outcomes FOR EACH ROW
BEGIN
  IF fn_pv_editable(OLD.program_version_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_groups_bi$$
CREATE TRIGGER trg_curriculum_groups_bi BEFORE INSERT ON curriculum_groups FOR EACH ROW
BEGIN
  DECLARE v_ptrack BIGINT UNSIGNED;
  IF NEW.parent_group_id IS NOT NULL THEN
    SELECT program_version_track_id INTO v_ptrack FROM curriculum_groups WHERE id = NEW.parent_group_id;
    IF v_ptrack <> NEW.program_version_track_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: parent group belongs to a different track';
    END IF;
  END IF;
  IF fn_track_editable(NEW.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_groups_bu$$
CREATE TRIGGER trg_curriculum_groups_bu BEFORE UPDATE ON curriculum_groups FOR EACH ROW
BEGIN
  DECLARE v_ptrack BIGINT UNSIGNED;
  IF NEW.parent_group_id IS NOT NULL THEN
    SELECT program_version_track_id INTO v_ptrack FROM curriculum_groups WHERE id = NEW.parent_group_id;
    IF v_ptrack <> NEW.program_version_track_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: parent group belongs to a different track';
    END IF;
  END IF;

  IF fn_track_editable(OLD.program_version_track_id) = 0 OR fn_track_editable(NEW.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_groups_bd$$
CREATE TRIGGER trg_curriculum_groups_bd BEFORE DELETE ON curriculum_groups FOR EACH ROW
BEGIN
  IF fn_track_editable(OLD.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_courses_bi$$
CREATE TRIGGER trg_curriculum_courses_bi BEFORE INSERT ON curriculum_courses FOR EACH ROW
BEGIN
  DECLARE v_gtrack BIGINT UNSIGNED;
  DECLARE v_course BIGINT UNSIGNED;
  SELECT program_version_track_id INTO v_gtrack FROM curriculum_groups WHERE id = NEW.curriculum_group_id;
  SELECT course_id INTO v_course FROM course_versions WHERE id = NEW.course_version_id;
  IF v_gtrack IS NULL OR v_gtrack <> NEW.program_version_track_id OR v_course IS NULL OR v_course <> NEW.course_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: curriculum_courses.program_version_track_id/course_id do not match group/course_version';
  END IF;
  IF fn_track_editable(NEW.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_courses_bu$$
CREATE TRIGGER trg_curriculum_courses_bu BEFORE UPDATE ON curriculum_courses FOR EACH ROW
BEGIN
  DECLARE v_gtrack BIGINT UNSIGNED;
  DECLARE v_course BIGINT UNSIGNED;
  SELECT program_version_track_id INTO v_gtrack FROM curriculum_groups WHERE id = NEW.curriculum_group_id;
  SELECT course_id INTO v_course FROM course_versions WHERE id = NEW.course_version_id;
  IF v_gtrack IS NULL OR v_gtrack <> NEW.program_version_track_id OR v_course IS NULL OR v_course <> NEW.course_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: curriculum_courses.program_version_track_id/course_id do not match group/course_version';
  END IF;

  IF fn_track_editable(OLD.program_version_track_id) = 0 OR fn_track_editable(NEW.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_courses_bd$$
CREATE TRIGGER trg_curriculum_courses_bd BEFORE DELETE ON curriculum_courses FOR EACH ROW
BEGIN
  IF fn_track_editable(OLD.program_version_track_id) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_prerequisites_bi$$
CREATE TRIGGER trg_curriculum_prerequisites_bi BEFORE INSERT ON curriculum_prerequisites FOR EACH ROW
BEGIN
  DECLARE v_t1 BIGINT UNSIGNED;
  DECLARE v_t2 BIGINT UNSIGNED;
  SELECT program_version_track_id INTO v_t1 FROM curriculum_courses WHERE id = NEW.curriculum_course_id;
  SELECT program_version_track_id INTO v_t2 FROM curriculum_courses WHERE id = NEW.prerequisite_curriculum_course_id;
  IF v_t1 IS NULL OR v_t2 IS NULL OR v_t1 <> v_t2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: prerequisite courses must belong to the same track (BR-07)';
  END IF;
  IF fn_track_editable(v_t1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_prerequisites_bu$$
CREATE TRIGGER trg_curriculum_prerequisites_bu BEFORE UPDATE ON curriculum_prerequisites FOR EACH ROW
BEGIN
  DECLARE v_t1 BIGINT UNSIGNED;
  DECLARE v_t2 BIGINT UNSIGNED;
  SELECT program_version_track_id INTO v_t1 FROM curriculum_courses WHERE id = NEW.curriculum_course_id;
  SELECT program_version_track_id INTO v_t2 FROM curriculum_courses WHERE id = NEW.prerequisite_curriculum_course_id;
  IF v_t1 IS NULL OR v_t2 IS NULL OR v_t1 <> v_t2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: prerequisite courses must belong to the same track (BR-07)';
  END IF;
  IF fn_track_editable(v_t1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_prerequisites_bd$$
CREATE TRIGGER trg_curriculum_prerequisites_bd BEFORE DELETE ON curriculum_prerequisites FOR EACH ROW
BEGIN
  DECLARE v_t1 BIGINT UNSIGNED;
  SELECT program_version_track_id INTO v_t1 FROM curriculum_courses WHERE id = OLD.curriculum_course_id;
  IF fn_track_editable(v_t1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_course_plos_bi$$
CREATE TRIGGER trg_curriculum_course_plos_bi BEFORE INSERT ON curriculum_course_plos FOR EACH ROW
BEGIN
  DECLARE v_pv1 BIGINT UNSIGNED;
  DECLARE v_pv2 BIGINT UNSIGNED;
  SELECT t.program_version_id INTO v_pv1 FROM curriculum_courses cc JOIN program_version_tracks t ON t.id = cc.program_version_track_id WHERE cc.id = NEW.curriculum_course_id;
  SELECT program_version_id INTO v_pv2 FROM program_learning_outcomes WHERE id = NEW.plo_id;
  IF v_pv1 IS NULL OR v_pv2 IS NULL OR v_pv1 <> v_pv2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: PLO and course belong to different program versions';
  END IF;
  IF fn_pv_editable(v_pv1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_course_plos_bu$$
CREATE TRIGGER trg_curriculum_course_plos_bu BEFORE UPDATE ON curriculum_course_plos FOR EACH ROW
BEGIN
  DECLARE v_pv1 BIGINT UNSIGNED;
  DECLARE v_pv2 BIGINT UNSIGNED;
  SELECT t.program_version_id INTO v_pv1 FROM curriculum_courses cc JOIN program_version_tracks t ON t.id = cc.program_version_track_id WHERE cc.id = NEW.curriculum_course_id;
  SELECT program_version_id INTO v_pv2 FROM program_learning_outcomes WHERE id = NEW.plo_id;
  IF v_pv1 IS NULL OR v_pv2 IS NULL OR v_pv1 <> v_pv2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: PLO and course belong to different program versions';
  END IF;
  IF fn_pv_editable(v_pv1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_curriculum_course_plos_bd$$
CREATE TRIGGER trg_curriculum_course_plos_bd BEFORE DELETE ON curriculum_course_plos FOR EACH ROW
BEGIN
  DECLARE v_pv1 BIGINT UNSIGNED;
  SELECT t.program_version_id INTO v_pv1 FROM curriculum_courses cc JOIN program_version_tracks t ON t.id = cc.program_version_track_id WHERE cc.id = OLD.curriculum_course_id;
  IF fn_pv_editable(v_pv1) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_PV_LOCKED: program version is not editable (only DRAFT/RETURNED)';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_course_versions_bu$$
CREATE TRIGGER trg_course_versions_bu BEFORE UPDATE ON course_versions FOR EACH ROW
BEGIN
  IF NOT (NEW.course_id <=> OLD.course_id AND NEW.version_no <=> OLD.version_no AND NEW.course_name <=> OLD.course_name AND NEW.english_name <=> OLD.english_name AND NEW.credits <=> OLD.credits AND NEW.theory_hours <=> OLD.theory_hours AND NEW.practice_hours <=> OLD.practice_hours AND NEW.description <=> OLD.description) THEN
    IF EXISTS (SELECT 1 FROM curriculum_courses cc JOIN program_version_tracks t ON t.id = cc.program_version_track_id JOIN program_versions pv ON pv.id = t.program_version_id WHERE cc.course_version_id = OLD.id AND pv.status <> 'DRAFT') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_COURSE_VERSION_LOCKED: course version is referenced by a non-DRAFT program version; create a new version instead (BR-12)';
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_student_course_results_bi$$
CREATE TRIGGER trg_student_course_results_bi BEFORE INSERT ON student_course_results FOR EACH ROW
BEGIN
  DECLARE v_course BIGINT UNSIGNED;
  SELECT course_id INTO v_course FROM course_versions WHERE id = NEW.course_version_id;
  IF v_course IS NULL OR v_course <> NEW.course_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: course_id does not match course_version_id';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_student_course_results_bu$$
CREATE TRIGGER trg_student_course_results_bu BEFORE UPDATE ON student_course_results FOR EACH ROW
BEGIN
  DECLARE v_course BIGINT UNSIGNED;
  SELECT course_id INTO v_course FROM course_versions WHERE id = NEW.course_version_id;
  IF v_course IS NULL OR v_course <> NEW.course_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'E_STRUCT_MISMATCH: course_id does not match course_version_id';
  END IF;
END$$

DELIMITER ;
--Lần chạy thứ 3

--Lần chạy thứ 4
CREATE OR REPLACE VIEW vw_published_program_versions AS
SELECT pv.id AS program_version_id, p.id AS program_id, p.program_code, pv.version_code,
       pv.program_name_snapshot AS program_name, pv.cohort_year, el.level_code, el.level_name,
       m.major_code, m.major_name, ou.unit_code AS managing_unit_code, ou.unit_name AS managing_unit_name,
       p.managing_unit_id, pv.effective_from, pv.effective_to, pv.published_at
FROM program_versions pv
JOIN training_programs p ON p.id = pv.program_id
JOIN education_levels el ON el.id = p.education_level_id
JOIN majors m ON m.id = p.major_id
JOIN organizational_units ou ON ou.id = p.managing_unit_id
WHERE pv.status = 'PUBLISHED';

CREATE OR REPLACE VIEW vw_api_program_versions AS
SELECT pv.id AS program_version_id, p.program_code, pv.version_code, pv.program_name_snapshot AS program_name,
       pv.cohort_year, pv.status, el.level_code, m.major_code, pv.published_at, pv.archived_at
FROM program_versions pv
JOIN training_programs p ON p.id = pv.program_id
JOIN education_levels el ON el.id = p.education_level_id
JOIN majors m ON m.id = p.major_id
WHERE pv.status IN ('PUBLISHED','ARCHIVED');

CREATE OR REPLACE VIEW vw_program_curriculum AS
SELECT pv.id AS program_version_id, p.program_code, pv.version_code, pv.cohort_year, pv.status AS program_version_status,
       pvt.id AS program_version_track_id, pvt.track_code_snapshot AS track_code, pvt.track_name_snapshot AS track_name,
       cg.id AS curriculum_group_id, cg.parent_group_id, cg.group_code, cg.group_name, cg.minimum_credits, cg.maximum_credits,
       cc.id AS curriculum_course_id, cc.course_id, c.course_code, cv.id AS course_version_id, cv.version_no AS course_version_no,
       cv.course_name, cv.credits, cc.requirement_type, cc.suggested_semester, cc.display_order AS course_display_order
FROM program_versions pv
JOIN training_programs p ON p.id = pv.program_id
JOIN program_version_tracks pvt ON pvt.program_version_id = pv.id
JOIN curriculum_groups cg ON cg.program_version_track_id = pvt.id
JOIN curriculum_courses cc ON cc.curriculum_group_id = cg.id
JOIN course_versions cv ON cv.id = cc.course_version_id
JOIN courses c ON c.id = cc.course_id;

CREATE OR REPLACE VIEW vw_program_group_summary AS
SELECT cg.id AS curriculum_group_id, cg.program_version_track_id, cg.parent_group_id, cg.group_code,
       cg.minimum_credits, cg.maximum_credits, COUNT(cc.id) AS course_count,
       COALESCE(SUM(CASE WHEN cc.requirement_type = 'REQUIRED' THEN cv.credits END), 0) AS required_credits,
       COALESCE(SUM(CASE WHEN cc.requirement_type = 'ELECTIVE' THEN cv.credits END), 0) AS elective_offered_credits,
       COALESCE(SUM(cv.credits), 0) AS offered_credits,
       CASE WHEN cg.minimum_credits > COALESCE(SUM(CASE WHEN cc.requirement_type = 'REQUIRED' THEN cv.credits END), 0)
            THEN cg.minimum_credits - COALESCE(SUM(CASE WHEN cc.requirement_type = 'REQUIRED' THEN cv.credits END), 0)
            ELSE 0 END AS elective_needed_credits
FROM curriculum_groups cg
LEFT JOIN curriculum_courses cc ON cc.curriculum_group_id = cg.id
LEFT JOIN course_versions cv ON cv.id = cc.course_version_id
GROUP BY cg.id, cg.program_version_track_id, cg.parent_group_id, cg.group_code, cg.minimum_credits, cg.maximum_credits;

-- Trợ giúp tự kiểm tra BR-05/BR-06 (kết quả cuối cùng do use case quyết định)
CREATE OR REPLACE VIEW vw_program_credit_summary AS
SELECT pvt.id AS program_version_track_id, pvt.program_version_id, pvt.track_code_snapshot AS track_code,
       pvt.required_total_credits, el.id AS education_level_id, el.min_total_credits, el.max_total_credits,
       el.min_elective_ratio, el.max_elective_ratio,
       COALESCE(SUM(CASE WHEN gs.parent_group_id IS NULL THEN gs.minimum_credits END), 0) AS root_minimum_credits,
       COALESCE(SUM(CASE WHEN gs.course_count > 0 THEN gs.elective_needed_credits END), 0) AS elective_needed_credits,
       COALESCE(SUM(CASE WHEN gs.course_count > 0 AND (gs.required_credits > gs.minimum_credits OR gs.offered_credits < gs.minimum_credits) THEN 1 ELSE 0 END), 0) AS bad_group_count,
       CASE WHEN pvt.required_total_credits > 0
            THEN ROUND(100.0 * COALESCE(SUM(CASE WHEN gs.course_count > 0 THEN gs.elective_needed_credits END), 0) / pvt.required_total_credits, 2)
            ELSE NULL END AS elective_ratio_pct
FROM program_version_tracks pvt
JOIN program_versions pv ON pv.id = pvt.program_version_id
JOIN training_programs p ON p.id = pv.program_id
JOIN education_levels el ON el.id = p.education_level_id
LEFT JOIN vw_program_group_summary gs ON gs.program_version_track_id = pvt.id
GROUP BY pvt.id, pvt.program_version_id, pvt.track_code_snapshot, pvt.required_total_credits, el.id,
         el.min_total_credits, el.max_total_credits, el.min_elective_ratio, el.max_elective_ratio;

CREATE OR REPLACE VIEW vw_student_curriculum AS
SELECT s.id AS student_id, s.student_code, s.user_id, spa.id AS assignment_id, pvt.id AS program_version_track_id,
       pv.id AS program_version_id, p.program_code, pv.version_code, pv.cohort_year, pv.status AS program_version_status,
       pvt.track_code_snapshot AS track_code, cg.group_code, cg.group_name, cc.id AS curriculum_course_id,
       cc.course_id, c.course_code, cv.id AS course_version_id, cv.course_name, cv.credits, cc.requirement_type
FROM students s
JOIN student_program_assignments spa ON spa.student_id = s.id AND spa.assignment_status = 'ACTIVE'
JOIN program_version_tracks pvt ON pvt.id = spa.program_version_track_id
JOIN program_versions pv ON pv.id = pvt.program_version_id AND pv.status IN ('PUBLISHED','ARCHIVED')
JOIN training_programs p ON p.id = pv.program_id
JOIN curriculum_groups cg ON cg.program_version_track_id = pvt.id
JOIN curriculum_courses cc ON cc.curriculum_group_id = cg.id
JOIN course_versions cv ON cv.id = cc.course_version_id
JOIN courses c ON c.id = cc.course_id;

CREATE OR REPLACE VIEW vw_student_passed_courses AS
SELECT DISTINCT student_id, course_id FROM student_course_results WHERE result_status IN ('PASSED','EXEMPTED');

CREATE OR REPLACE VIEW vw_course_offering_capacity AS
SELECT co.id AS course_offering_id, co.class_code, co.capacity, co.minimum_capacity, co.status,
       COUNT(CASE WHEN cr.status = 'REGISTERED' THEN 1 END) AS current_enrollment,
       co.capacity - COUNT(CASE WHEN cr.status = 'REGISTERED' THEN 1 END) AS remaining_capacity
FROM course_offerings co
LEFT JOIN course_registrations cr ON cr.course_offering_id = co.id
GROUP BY co.id, co.class_code, co.capacity, co.minimum_capacity, co.status;

CREATE OR REPLACE VIEW vw_pending_program_approvals AS
SELECT ar.id AS approval_request_id, ar.request_no, ar.requested_at, ar.requested_by, ar.next_reminder_at, ar.reminder_count,
       pv.id AS program_version_id, pv.version_code, pv.cohort_year, p.id AS program_id, p.program_code, p.managing_unit_id,
       pv.program_name_snapshot AS program_name, pv.status AS program_version_status
FROM approval_requests ar
JOIN program_versions pv ON pv.id = ar.program_version_id
JOIN training_programs p ON p.id = pv.program_id
WHERE ar.current_status = 'PENDING';

-- BR-16: học phần đang nằm trong CTĐT hoạt động thì không được khóa
CREATE OR REPLACE VIEW vw_course_blocking_usage AS
SELECT DISTINCT cc.course_id, pv.id AS program_version_id, pv.version_code, pv.status
FROM curriculum_courses cc
JOIN program_version_tracks t ON t.id = cc.program_version_track_id
JOIN program_versions pv ON pv.id = t.program_version_id
WHERE pv.status IN ('DRAFT','SUBMITTED','REVIEWING','RETURNED','PUBLISHED');

-- BR-04: phạm vi dữ liệu (ORG_UNIT bao gồm đơn vị con nhờ closure table)
CREATE OR REPLACE VIEW vw_user_program_access AS
SELECT us.user_id, p.id AS program_id FROM user_scopes us JOIN training_programs p ON us.scope_type = 'GLOBAL'
UNION
SELECT us.user_id, p.id FROM user_scopes us
JOIN organizational_unit_closure c ON c.ancestor_id = us.organizational_unit_id
JOIN training_programs p ON p.managing_unit_id = c.descendant_id WHERE us.scope_type = 'ORG_UNIT'
UNION
SELECT us.user_id, p.id FROM user_scopes us JOIN training_programs p ON p.major_id = us.major_id WHERE us.scope_type = 'MAJOR'
UNION
SELECT us.user_id, us.program_id FROM user_scopes us WHERE us.scope_type = 'PROGRAM';

CREATE OR REPLACE VIEW vw_user_course_access AS
SELECT us.user_id, c.id AS course_id FROM user_scopes us JOIN courses c ON us.scope_type = 'GLOBAL'
UNION
SELECT us.user_id, c.id FROM user_scopes us
JOIN organizational_unit_closure oc ON oc.ancestor_id = us.organizational_unit_id
JOIN courses c ON c.owning_unit_id = oc.descendant_id WHERE us.scope_type = 'ORG_UNIT';

CREATE OR REPLACE VIEW vw_user_student_access AS
SELECT us.user_id, s.id AS student_id FROM user_scopes us JOIN students s ON us.scope_type = 'GLOBAL'
UNION
SELECT us.user_id, s.id FROM user_scopes us
JOIN organizational_unit_closure oc ON oc.ancestor_id = us.organizational_unit_id
JOIN students s ON s.organizational_unit_id = oc.descendant_id WHERE us.scope_type = 'ORG_UNIT';

--Lần chạy thứ 4

--Lần chạy thứ 5
INSERT INTO education_levels (id, level_code, level_name, min_total_credits, max_total_credits, min_elective_ratio, max_elective_ratio) VALUES
(1, 'BACHELOR', 'Đại học', 120, 150, 10, 40),
(2, 'MASTER', 'Thạc sĩ', 60, 60, 10, 40);

INSERT INTO study_tracks (id, track_code, track_name, description) VALUES
(1, 'GENERAL', 'Hướng chung', 'Dành cho chương trình không chia hướng'),
(2, 'RESEARCH', 'Hướng nghiên cứu', 'Định hướng nghiên cứu (Thạc sĩ)'),
(3, 'APPLICATION', 'Hướng ứng dụng', 'Định hướng ứng dụng (Thạc sĩ)');

INSERT INTO education_level_tracks (education_level_id, study_track_id, display_order) VALUES
(1, 1, 1),
(2, 2, 1),
(2, 3, 2);

INSERT INTO roles (id, role_code, role_name, description) VALUES
(1, 'ADMIN', 'Quản trị hệ thống', 'Quản lý người dùng, phạm vi, tham số, danh mục nền, API client, audit; không làm nghiệp vụ CTĐT'),
(2, 'TRAINING_OFFICER', 'Cán bộ đào tạo', 'Danh mục, đề cương, soạn/gửi duyệt CTĐT, học viên, đợt đăng ký'),
(3, 'APPROVER', 'Lãnh đạo (người duyệt)', 'Xét duyệt, lưu trữ, ngừng dùng CTĐT trong phạm vi'),
(4, 'STUDENT', 'Học viên', 'Xem dữ liệu của chính mình; đăng ký học phần');

INSERT INTO permissions (id, permission_code, module_code, permission_name) VALUES
(1, 'USER_MANAGE', 'IAM', 'Quản lý người dùng'),
(2, 'ROLE_SCOPE_MANAGE', 'IAM', 'Gán vai trò và phạm vi dữ liệu'),
(3, 'SETTINGS_MANAGE', 'IAM', 'Quản lý tham số hệ thống'),
(4, 'MASTERDATA_MANAGE', 'IAM', 'Quản lý bậc, hướng, đơn vị, ngành'),
(5, 'API_CLIENT_MANAGE', 'IAM', 'Quản lý API client'),
(6, 'AUDIT_READ_ALL', 'AUDIT', 'Xem toàn bộ audit log'),
(7, 'AUDIT_READ_SCOPE', 'AUDIT', 'Xem audit log trong phạm vi'),
(8, 'CATALOG_READ', 'CATALOG', 'Xem danh mục học phần và đề cương'),
(9, 'CATALOG_MANAGE', 'CATALOG', 'Tạo, sửa, khóa học phần'),
(10, 'OUTLINE_MANAGE', 'CATALOG', 'Quản lý đề cương'),
(11, 'IMPORT_MANAGE', 'CATALOG', 'Nhập dữ liệu từ Excel'),
(12, 'PROGRAM_READ', 'PROGRAM', 'Xem CTĐT trong phạm vi'),
(13, 'PROGRAM_EDIT', 'PROGRAM', 'Soạn, sửa, sao chép bản nháp CTĐT'),
(14, 'PROGRAM_SUBMIT', 'PROGRAM', 'Gửi duyệt và thu hồi'),
(15, 'PROGRAM_APPROVE', 'PROGRAM', 'Duyệt hoặc trả về CTĐT'),
(16, 'PROGRAM_ARCHIVE', 'PROGRAM', 'Lưu trữ hoặc ngừng dùng CTĐT'),
(17, 'PROGRAM_EXPORT', 'PROGRAM', 'Xuất Excel CTĐT'),
(18, 'PROGRAM_COMPARE', 'PROGRAM', 'So sánh hai CTĐT'),
(19, 'STUDENT_MANAGE', 'STUDENT', 'Quản lý học viên, gán CTĐT, nhập kết quả'),
(20, 'PROGRAM_READ_OWN', 'STUDENT', 'Xem CTĐT của mình'),
(21, 'OUTLINE_READ_OWN', 'STUDENT', 'Xem đề cương môn thuộc CTĐT của mình'),
(22, 'RESULT_READ_OWN', 'STUDENT', 'Xem kết quả học tập của mình'),
(23, 'REGISTRATION_MANAGE', 'REGISTRATION', 'Quản lý đợt đăng ký và lớp học phần'),
(24, 'COURSE_REGISTER', 'REGISTRATION', 'Đăng ký và hủy học phần');

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 8),
(1, 12),
(2, 8),
(2, 9),
(2, 10),
(2, 11),
(2, 12),
(2, 13),
(2, 14),
(2, 17),
(2, 18),
(2, 19),
(2, 23),
(3, 8),
(3, 12),
(3, 15),
(3, 16),
(3, 17),
(3, 18),
(3, 7),
(4, 20),
(4, 21),
(4, 22),
(4, 24);

INSERT INTO system_settings (id, setting_key, value_type, setting_value, description) VALUES
(1, 'account.lock_threshold', 'INTEGER', '5', 'Số lần nhập sai liên tiếp trước khi khóa tạm (BR-01)'),
(2, 'account.lock_minutes', 'INTEGER', '15', 'Thời gian khóa tạm, phút (BR-01)'),
(3, 'session.timeout_minutes', 'INTEGER', '30', 'Hết phiên sau số phút không thao tác (BR-02)'),
(4, 'account.reset_token_minutes', 'INTEGER', '30', 'Hiệu lực liên kết đặt lại mật khẩu, phút (BR-03)'),
(5, 'account.password_min_length', 'INTEGER', '10', 'Độ dài mật khẩu tối thiểu (FR-AUT-07)'),
(6, 'approval.reminder.first_after_workdays', 'INTEGER', '3', 'Nhắc lần đầu sau số ngày làm việc (BR-15)'),
(7, 'approval.reminder.repeat_every_workdays', 'INTEGER', '2', 'Nhắc lại sau mỗi số ngày làm việc (BR-15)'),
(8, 'approval.reminder.max_count', 'INTEGER', '3', 'Số lần nhắc tối đa (BR-15)'),
(9, 'import.max_file_mb', 'INTEGER', '5', 'Dung lượng tệp Excel tối đa, MB (BR-17)'),
(10, 'import.max_rows', 'INTEGER', '5000', 'Số dòng tối đa mỗi lần nhập (BR-17)'),
(11, 'outline.max_file_mb', 'INTEGER', '10', 'Dung lượng PDF đề cương tối đa, MB (FR-OUT-03)'),
(12, 'api.default_rate_limit_per_minute', 'INTEGER', '60', 'Giới hạn yêu cầu/phút mặc định cho API client (BR-18)'),
(13, 'audit.retention_days', 'INTEGER', '730', 'Số ngày lưu audit_logs (NFR-MNT-08)'),
(14, 'api_log.retention_days', 'INTEGER', '365', 'Số ngày lưu api_access_logs (NFR-MNT-08)'),
(15, 'reset_token.purge_days', 'INTEGER', '7', 'Dọn token đặt lại mật khẩu sau số ngày (NFR-MNT-08)');

INSERT INTO api_scopes (id, scope_code, description) VALUES
(1, 'programs:read', 'Đọc danh sách CTĐT và phiên bản'),
(2, 'curriculum:read', 'Đọc cấu trúc chi tiết CTĐT'),
(3, 'courses:read', 'Đọc danh mục học phần');

INSERT INTO workflow_transitions (entity_type, from_status, to_status, required_permission, requires_reason, description) VALUES
('PROGRAM_VERSION', 'DRAFT', 'SUBMITTED', 'PROGRAM_SUBMIT', 0, 'Gửi duyệt (sau tự kiểm tra)'),
('PROGRAM_VERSION', 'SUBMITTED', 'REVIEWING', 'PROGRAM_APPROVE', 0, 'Bắt đầu xem xét'),
('PROGRAM_VERSION', 'SUBMITTED', 'PUBLISHED', 'PROGRAM_APPROVE', 0, 'Duyệt trực tiếp'),
('PROGRAM_VERSION', 'REVIEWING', 'PUBLISHED', 'PROGRAM_APPROVE', 0, 'Duyệt'),
('PROGRAM_VERSION', 'SUBMITTED', 'RETURNED', 'PROGRAM_APPROVE', 1, 'Trả về kèm ý kiến'),
('PROGRAM_VERSION', 'REVIEWING', 'RETURNED', 'PROGRAM_APPROVE', 1, 'Trả về kèm ý kiến'),
('PROGRAM_VERSION', 'RETURNED', 'SUBMITTED', 'PROGRAM_SUBMIT', 0, 'Sửa và gửi lại'),
('PROGRAM_VERSION', 'SUBMITTED', 'DRAFT', 'PROGRAM_SUBMIT', 0, 'Thu hồi khi chưa xem xét'),
('PROGRAM_VERSION', 'PUBLISHED', 'ARCHIVED', 'PROGRAM_ARCHIVE', 0, 'Lưu trữ'),
('PROGRAM_VERSION', 'PUBLISHED', 'RETIRED', 'PROGRAM_ARCHIVE', 1, 'Ngừng dùng bản đang áp dụng'),
('PROGRAM_VERSION', 'ARCHIVED', 'RETIRED', 'PROGRAM_ARCHIVE', 1, 'Ngừng dùng bản đã lưu trữ'),
('PROGRAM_VERSION', 'DRAFT', 'RETIRED', 'PROGRAM_EDIT', 1, 'Hủy bản nháp'),
('PROGRAM_VERSION', 'RETURNED', 'RETIRED', 'PROGRAM_EDIT', 1, 'Hủy bản bị trả về'),
('APPROVAL_REQUEST', 'PENDING', 'APPROVED', 'PROGRAM_APPROVE', 0, 'Duyệt'),
('APPROVAL_REQUEST', 'PENDING', 'RETURNED', 'PROGRAM_APPROVE', 1, 'Trả về'),
('APPROVAL_REQUEST', 'PENDING', 'CANCELLED', 'PROGRAM_SUBMIT', 0, 'Thu hồi');


-- ============================================================================
-- S002__demo_data.sql  |  DỮ LIỆU MINH HỌA cho dev/staging/demo. KHÔNG nạp vào production.
-- Tên đơn vị, ngành, học phần, CTĐT chỉ mang tính minh họa, KHÔNG phải CTĐT chính thức của Trường ĐH An Giang.
-- Mật khẩu dev của mọi tài khoản demo: Demo@12345  (bcrypt cost 12)  -> bắt buộc đổi/xóa trước khi đưa lên môi trường thật.
-- Phụ thuộc: V001, V002 (trigger closure + máy trạng thái), V003, S001. Thời điểm tham chiếu: 03/10/2026 (UTC).
-- Cấu trúc CTĐT được chèn khi phiên bản còn DRAFT, sau đó chuyển trạng thái bằng UPDATE hợp lệ (qua workflow_transitions).
-- ============================================================================
SET NAMES utf8mb4;


-- ---- Đơn vị tổ chức (closure table do trigger trg_org_units_ai điền)

INSERT INTO organizational_units (id, parent_id, unit_code, unit_name, unit_type) VALUES
(1, NULL, 'FIT', 'Khoa Công nghệ Thông tin (minh họa)', 'FACULTY'),
(2, NULL, 'FBE', 'Khoa Kinh tế - Quản trị (minh họa)', 'FACULTY'),
(3, 1, 'FIT-IS', 'Bộ môn Hệ thống thông tin', 'DEPARTMENT');


-- ---- Người dùng

INSERT INTO users (id, organizational_unit_id, username, email, password_hash, full_name, account_status, password_changed_at) VALUES
(1, NULL, 'admin', 'admin@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Quản trị hệ thống', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(2, 1, 'officer.fit', 'officer.fit@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Cán bộ đào tạo Khoa CNTT', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(3, 1, 'approver.fit', 'approver.fit@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Lãnh đạo Khoa CNTT', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(4, 2, 'officer.fbe', 'officer.fbe@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Cán bộ đào tạo Khoa Kinh tế', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(5, 1, 'sv001', 'sv001@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Nguyễn Văn An', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(6, 1, 'sv002', 'sv002@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Trần Thị Bình', 'ACTIVE', '2026-09-01 02:00:00.000000'),
(7, 1, 'sv003', 'sv003@example.edu', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEejYBVB885pkaGX9OygENiiyWUS5QXMxy', 'Lê Văn Cường', 'ACTIVE', '2026-09-01 02:00:00.000000');

INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES
(1, 1, 1),
(2, 2, 1),
(3, 3, 1),
(4, 2, 1),
(5, 4, 1),
(6, 4, 1),
(7, 4, 1);

INSERT INTO user_scopes (id, user_id, scope_type, organizational_unit_id, major_id, program_id) VALUES
(1, 1, 'GLOBAL', NULL, NULL, NULL),
(2, 2, 'ORG_UNIT', 1, NULL, NULL),
(3, 3, 'ORG_UNIT', 1, NULL, NULL),
(4, 4, 'ORG_UNIT', 2, NULL, NULL);


-- ---- Ngành và chương trình đào tạo

INSERT INTO majors (id, organizational_unit_id, major_code, major_name) VALUES
(1, 1, 'IT', 'Công nghệ thông tin'),
(2, 2, 'BA', 'Quản trị kinh doanh');

INSERT INTO training_programs (id, major_id, education_level_id, managing_unit_id, program_code, program_name, description) VALUES
(1, 1, 2, 1, 'MIT', 'Thạc sĩ Công nghệ thông tin (minh họa)', 'Chương trình thạc sĩ, hai hướng nghiên cứu/ứng dụng'),
(2, 1, 1, 1, 'BIT', 'Cử nhân Công nghệ thông tin (minh họa)', 'Chương trình đại học'),
(3, 2, 1, 2, 'BBA', 'Cử nhân Quản trị kinh doanh (minh họa)', 'Chương trình đại học - chưa có phiên bản');


-- ---- Học phần (định danh) và phiên bản học phần

INSERT INTO courses (id, owning_unit_id, course_code, status) VALUES
(1, 1, 'PHI501', 'ACTIVE'),
(2, 1, 'RES501', 'ACTIVE'),
(3, 1, 'ENG501', 'ACTIVE'),
(4, 1, 'INF502', 'ACTIVE'),
(5, 1, 'INF503', 'ACTIVE'),
(6, 1, 'INF504', 'ACTIVE'),
(7, 1, 'INF505', 'ACTIVE'),
(8, 1, 'INF506', 'ACTIVE'),
(9, 1, 'INF507', 'ACTIVE'),
(10, 1, 'INF508', 'ACTIVE'),
(11, 1, 'INF509', 'ACTIVE'),
(12, 1, 'INF510', 'ACTIVE'),
(13, 1, 'INF511', 'ACTIVE'),
(14, 1, 'INF512', 'ACTIVE'),
(15, 1, 'INF513', 'ACTIVE'),
(16, 1, 'INF514', 'ACTIVE'),
(17, 1, 'INF601', 'ACTIVE'),
(18, 1, 'INF602', 'ACTIVE'),
(19, 1, 'INF603', 'ACTIVE'),
(20, 1, 'INF698', 'ACTIVE'),
(21, 1, 'INF699', 'ACTIVE');

INSERT INTO course_versions (id, course_id, version_no, course_name, english_name, credits, theory_hours, practice_hours, description, search_text, effective_from, effective_to, status, created_by) VALUES
(1, 1, 1, 'Triết học', 'Philosophy', 3, 45, 0, 'Học phần minh họa', 'phi501 triet hoc philosophy', '2024-01-01', NULL, 'ACTIVE', 2),
(2, 2, 1, 'Phương pháp nghiên cứu khoa học', 'Research Methods', 3, 30, 15, 'Học phần minh họa', 'res501 phuong phap nghien cuu khoa hoc research methods', '2024-01-01', NULL, 'ACTIVE', 2),
(3, 3, 1, 'Tiếng Anh học thuật', 'Academic English', 3, 30, 15, 'Học phần minh họa', 'eng501 tieng anh hoc thuat academic english', '2024-01-01', NULL, 'ACTIVE', 2),
(4, 4, 1, 'Cơ sở dữ liệu nâng cao', 'Advanced Database', 3, 30, 15, 'Học phần minh họa', 'inf502 co so du lieu nang cao advanced database', '2024-01-01', '2025-12-31', 'RETIRED', 2),
(5, 5, 1, 'Học máy', 'Machine Learning', 3, 30, 15, 'Học phần minh họa', 'inf503 hoc may machine learning', '2024-01-01', NULL, 'ACTIVE', 2),
(6, 6, 1, 'Hệ phân tán', 'Distributed Systems', 3, 30, 15, 'Học phần minh họa', 'inf504 he phan tan distributed systems', '2024-01-01', NULL, 'ACTIVE', 2),
(7, 7, 1, 'Kiến trúc phần mềm', 'Software Architecture', 3, 30, 15, 'Học phần minh họa', 'inf505 kien truc phan mem software architecture', '2024-01-01', NULL, 'ACTIVE', 2),
(8, 8, 1, 'An toàn dữ liệu', 'Data Security', 3, 30, 15, 'Học phần minh họa', 'inf506 an toan du lieu data security', '2024-01-01', NULL, 'ACTIVE', 2),
(9, 9, 1, 'Điện toán đám mây', 'Cloud Computing', 3, 30, 15, 'Học phần minh họa', 'inf507 dien toan dam may cloud computing', '2024-01-01', NULL, 'ACTIVE', 2),
(10, 10, 1, 'Khai phá dữ liệu', 'Data Mining', 3, 30, 15, 'Học phần minh họa', 'inf508 khai pha du lieu data mining', '2024-01-01', NULL, 'ACTIVE', 2),
(11, 11, 1, 'Xử lý ngôn ngữ tự nhiên', 'Natural Language Processing', 3, 30, 15, 'Học phần minh họa', 'inf509 xu ly ngon ngu tu nhien natural language processing', '2024-01-01', NULL, 'ACTIVE', 2),
(12, 12, 1, 'Thị giác máy tính', 'Computer Vision', 3, 30, 15, 'Học phần minh họa', 'inf510 thi giac may tinh computer vision', '2024-01-01', NULL, 'ACTIVE', 2),
(13, 13, 1, 'DevOps và CI/CD', 'DevOps and CI/CD', 3, 30, 15, 'Học phần minh họa', 'inf511 devops va ci/cd devops and ci/cd', '2024-01-01', NULL, 'ACTIVE', 2),
(14, 14, 1, 'IoT và hệ nhúng', 'IoT and Embedded Systems', 3, 30, 15, 'Học phần minh họa', 'inf512 iot va he nhung iot and embedded systems', '2024-01-01', NULL, 'ACTIVE', 2),
(15, 15, 1, 'Phân tích dữ liệu lớn', 'Big Data Analytics', 3, 30, 15, 'Học phần minh họa', 'inf513 phan tich du lieu lon big data analytics', '2024-01-01', NULL, 'ACTIVE', 2),
(16, 16, 1, 'Blockchain ứng dụng', 'Applied Blockchain', 3, 30, 15, 'Học phần minh họa', 'inf514 blockchain ung dung applied blockchain', '2024-01-01', NULL, 'ACTIVE', 2),
(17, 17, 1, 'Chuyên đề nghiên cứu 1', 'Research Seminar 1', 6, 0, 90, 'Học phần minh họa', 'inf601 chuyen de nghien cuu 1 research seminar 1', '2024-01-01', NULL, 'ACTIVE', 2),
(18, 18, 1, 'Chuyên đề nghiên cứu 2', 'Research Seminar 2', 6, 0, 90, 'Học phần minh họa', 'inf602 chuyen de nghien cuu 2 research seminar 2', '2024-01-01', NULL, 'ACTIVE', 2),
(19, 19, 1, 'Thực tập tốt nghiệp', 'Internship', 6, 0, 90, 'Học phần minh họa', 'inf603 thuc tap tot nghiep internship', '2024-01-01', NULL, 'ACTIVE', 2),
(20, 20, 1, 'Đề án tốt nghiệp', 'Capstone Project', 9, 0, 135, 'Học phần minh họa', 'inf698 de an tot nghiep capstone project', '2024-01-01', NULL, 'ACTIVE', 2),
(21, 21, 1, 'Luận văn thạc sĩ', 'Master Thesis', 15, 0, 225, 'Học phần minh họa', 'inf699 luan van thac si master thesis', '2024-01-01', NULL, 'ACTIVE', 2),
(22, 4, 2, 'Cơ sở dữ liệu nâng cao', 'Advanced Database', 4, 45, 15, 'Bản sửa đổi: 4 tín chỉ', 'inf502 co so du lieu nang cao advanced database', '2026-01-01', NULL, 'ACTIVE', 2);

INSERT INTO course_outline_versions (id, course_version_id, outline_version_no, objectives, content, teaching_methods, assessment_methods, references_text, file_url, file_name, file_size_bytes, status, effective_from, created_by) VALUES
(1, 4, 1, 'Nắm vững thiết kế CSDL nâng cao.', 'Giao dịch, chỉ mục, tối ưu truy vấn.', 'Giảng dạy + thực hành', 'Bài tập + thi cuối kỳ', 'Tài liệu giảng viên', NULL, NULL, NULL, 'PUBLISHED', '2024-01-01', 2),
(2, 5, 1, 'Hiểu nền tảng học máy.', 'Hồi quy, phân lớp, đánh giá mô hình.', 'Giảng dạy + đồ án', 'Đồ án + thi', 'Sách tham khảo', 'outlines/INF503-v1.pdf', 'INF503-v1.pdf', 482113, 'PUBLISHED', '2024-01-01', 2),
(3, 22, 1, 'Cập nhật nội dung 4 tín chỉ.', 'Bổ sung CSDL phân tán.', 'Giảng dạy + thực hành', 'Bài tập + thi', 'Tài liệu giảng viên', NULL, NULL, NULL, 'DRAFT', NULL, 2);


-- ---- Phiên bản CTĐT (chèn ở DRAFT)

INSERT INTO program_versions (id, program_id, source_program_version_id, version_code, program_name_snapshot, search_text, cohort_year, status, created_by, created_at) VALUES
(1, 1, NULL, 'MIT-2024-v1', 'Thạc sĩ Công nghệ thông tin - Khóa 2024', 'mit-2024-v1 thac si cong nghe thong tin - khoa 2024', 2024, 'DRAFT', 2, '2024-06-01 02:00:00.000000'),
(2, 1, NULL, 'MIT-2025-v1', 'Thạc sĩ Công nghệ thông tin - Khóa 2025', 'mit-2025-v1 thac si cong nghe thong tin - khoa 2025', 2025, 'DRAFT', 2, '2025-06-02 02:00:00.000000'),
(3, 1, 2, 'MIT-2026-v1', 'Thạc sĩ Công nghệ thông tin - Khóa 2026', 'mit-2026-v1 thac si cong nghe thong tin - khoa 2026', 2026, 'DRAFT', 2, '2026-09-14 02:00:00.000000'),
(4, 2, NULL, 'BIT-2026-v1', 'Cử nhân Công nghệ thông tin - Khóa 2026', 'bit-2026-v1 cu nhan cong nghe thong tin - khoa 2026', 2026, 'DRAFT', 2, '2026-09-20 02:00:00.000000');


-- ---- Cấu trúc CTĐT: hướng, nhóm, học phần, tiên quyết, chuẩn đầu ra

INSERT INTO program_version_tracks (id, program_version_id, study_track_id, track_code_snapshot, track_name_snapshot, required_total_credits, status) VALUES
(1, 1, 2, 'RESEARCH', 'Hướng nghiên cứu', 60, 'ACTIVE'),
(2, 1, 3, 'APPLICATION', 'Hướng ứng dụng', 60, 'ACTIVE'),
(3, 2, 2, 'RESEARCH', 'Hướng nghiên cứu', 60, 'ACTIVE'),
(4, 2, 3, 'APPLICATION', 'Hướng ứng dụng', 60, 'ACTIVE'),
(5, 3, 2, 'RESEARCH', 'Hướng nghiên cứu', 60, 'ACTIVE'),
(6, 3, 3, 'APPLICATION', 'Hướng ứng dụng', 60, 'ACTIVE'),
(7, 4, 1, 'GENERAL', 'Hướng chung', 120, 'ACTIVE');

INSERT INTO curriculum_groups (id, program_version_track_id, parent_group_id, group_code, group_name, minimum_credits, maximum_credits, display_order) VALUES
(1, 1, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(2, 1, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 24, NULL, 2),
(3, 1, NULL, 'C', 'Chuyên đề nghiên cứu', 12, NULL, 3),
(4, 1, NULL, 'D', 'Luận văn thạc sĩ', 15, NULL, 4),
(5, 2, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(6, 2, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 36, NULL, 2),
(7, 2, NULL, 'C', 'Thực tập', 6, NULL, 3),
(8, 2, NULL, 'D', 'Đề án tốt nghiệp', 9, NULL, 4),
(9, 3, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(10, 3, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 24, NULL, 2),
(11, 3, NULL, 'C', 'Chuyên đề nghiên cứu', 12, NULL, 3),
(12, 3, NULL, 'D', 'Luận văn thạc sĩ', 15, NULL, 4),
(13, 4, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(14, 4, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 36, NULL, 2),
(15, 4, NULL, 'C', 'Thực tập', 6, NULL, 3),
(16, 4, NULL, 'D', 'Đề án tốt nghiệp', 9, NULL, 4),
(17, 5, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(18, 5, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 24, NULL, 2),
(19, 5, NULL, 'C', 'Chuyên đề nghiên cứu', 12, NULL, 3),
(20, 5, NULL, 'D', 'Luận văn thạc sĩ', 15, NULL, 4),
(21, 6, NULL, 'A', 'Kiến thức chung', 9, NULL, 1),
(22, 6, NULL, 'B', 'Kiến thức cơ sở và chuyên ngành', 36, NULL, 2),
(23, 6, NULL, 'C', 'Thực tập', 6, NULL, 3),
(24, 6, NULL, 'D', 'Đề án tốt nghiệp', 9, NULL, 4),
(25, 7, NULL, 'A', 'Giáo dục đại cương', 30, NULL, 1),
(26, 7, NULL, 'B', 'Cơ sở ngành', 30, NULL, 2);

INSERT INTO curriculum_courses (id, curriculum_group_id, program_version_track_id, course_version_id, course_id, requirement_type, display_order) VALUES
(1, 1, 1, 1, 1, 'REQUIRED', 1),
(2, 1, 1, 2, 2, 'REQUIRED', 2),
(3, 1, 1, 3, 3, 'REQUIRED', 3),
(4, 2, 1, 4, 4, 'REQUIRED', 1),
(5, 2, 1, 5, 5, 'REQUIRED', 2),
(6, 2, 1, 6, 6, 'REQUIRED', 3),
(7, 2, 1, 7, 7, 'REQUIRED', 4),
(8, 2, 1, 8, 8, 'ELECTIVE', 5),
(9, 2, 1, 9, 9, 'ELECTIVE', 6),
(10, 2, 1, 10, 10, 'ELECTIVE', 7),
(11, 2, 1, 11, 11, 'ELECTIVE', 8),
(12, 2, 1, 12, 12, 'ELECTIVE', 9),
(13, 3, 1, 17, 17, 'REQUIRED', 1),
(14, 3, 1, 18, 18, 'REQUIRED', 2),
(15, 4, 1, 21, 21, 'REQUIRED', 1),
(16, 5, 2, 1, 1, 'REQUIRED', 1),
(17, 5, 2, 2, 2, 'REQUIRED', 2),
(18, 5, 2, 3, 3, 'REQUIRED', 3),
(19, 6, 2, 4, 4, 'REQUIRED', 1),
(20, 6, 2, 5, 5, 'REQUIRED', 2),
(21, 6, 2, 6, 6, 'REQUIRED', 3),
(22, 6, 2, 7, 7, 'REQUIRED', 4),
(23, 6, 2, 8, 8, 'REQUIRED', 5),
(24, 6, 2, 9, 9, 'ELECTIVE', 6),
(25, 6, 2, 10, 10, 'ELECTIVE', 7),
(26, 6, 2, 11, 11, 'ELECTIVE', 8),
(27, 6, 2, 12, 12, 'ELECTIVE', 9),
(28, 6, 2, 13, 13, 'ELECTIVE', 10),
(29, 6, 2, 14, 14, 'ELECTIVE', 11),
(30, 6, 2, 15, 15, 'ELECTIVE', 12),
(31, 6, 2, 16, 16, 'ELECTIVE', 13),
(32, 7, 2, 19, 19, 'REQUIRED', 1),
(33, 8, 2, 20, 20, 'REQUIRED', 1),
(34, 9, 3, 1, 1, 'REQUIRED', 1),
(35, 9, 3, 2, 2, 'REQUIRED', 2),
(36, 9, 3, 3, 3, 'REQUIRED', 3),
(37, 10, 3, 4, 4, 'REQUIRED', 1),
(38, 10, 3, 5, 5, 'REQUIRED', 2),
(39, 10, 3, 6, 6, 'REQUIRED', 3),
(40, 10, 3, 7, 7, 'REQUIRED', 4),
(41, 10, 3, 8, 8, 'ELECTIVE', 5),
(42, 10, 3, 9, 9, 'ELECTIVE', 6),
(43, 10, 3, 10, 10, 'ELECTIVE', 7),
(44, 10, 3, 11, 11, 'ELECTIVE', 8),
(45, 10, 3, 12, 12, 'ELECTIVE', 9),
(46, 11, 3, 17, 17, 'REQUIRED', 1),
(47, 11, 3, 18, 18, 'REQUIRED', 2),
(48, 12, 3, 21, 21, 'REQUIRED', 1),
(49, 13, 4, 1, 1, 'REQUIRED', 1),
(50, 13, 4, 2, 2, 'REQUIRED', 2),
(51, 13, 4, 3, 3, 'REQUIRED', 3),
(52, 14, 4, 4, 4, 'REQUIRED', 1),
(53, 14, 4, 5, 5, 'REQUIRED', 2),
(54, 14, 4, 6, 6, 'REQUIRED', 3),
(55, 14, 4, 7, 7, 'REQUIRED', 4),
(56, 14, 4, 8, 8, 'REQUIRED', 5),
(57, 14, 4, 9, 9, 'ELECTIVE', 6),
(58, 14, 4, 10, 10, 'ELECTIVE', 7),
(59, 14, 4, 11, 11, 'ELECTIVE', 8),
(60, 14, 4, 12, 12, 'ELECTIVE', 9),
(61, 14, 4, 13, 13, 'ELECTIVE', 10),
(62, 14, 4, 14, 14, 'ELECTIVE', 11),
(63, 14, 4, 15, 15, 'ELECTIVE', 12),
(64, 14, 4, 16, 16, 'ELECTIVE', 13),
(65, 15, 4, 19, 19, 'REQUIRED', 1),
(66, 16, 4, 20, 20, 'REQUIRED', 1),
(67, 17, 5, 1, 1, 'REQUIRED', 1),
(68, 17, 5, 2, 2, 'REQUIRED', 2),
(69, 17, 5, 3, 3, 'REQUIRED', 3),
(70, 18, 5, 22, 4, 'REQUIRED', 1),
(71, 18, 5, 5, 5, 'REQUIRED', 2),
(72, 18, 5, 6, 6, 'REQUIRED', 3),
(73, 18, 5, 7, 7, 'REQUIRED', 4),
(74, 18, 5, 8, 8, 'ELECTIVE', 5),
(75, 18, 5, 9, 9, 'ELECTIVE', 6),
(76, 18, 5, 10, 10, 'ELECTIVE', 7),
(77, 18, 5, 11, 11, 'ELECTIVE', 8),
(78, 18, 5, 12, 12, 'ELECTIVE', 9),
(79, 19, 5, 17, 17, 'REQUIRED', 1),
(80, 19, 5, 18, 18, 'REQUIRED', 2),
(81, 20, 5, 21, 21, 'REQUIRED', 1),
(82, 21, 6, 1, 1, 'REQUIRED', 1),
(83, 21, 6, 2, 2, 'REQUIRED', 2),
(84, 21, 6, 3, 3, 'REQUIRED', 3),
(85, 22, 6, 22, 4, 'REQUIRED', 1),
(86, 22, 6, 5, 5, 'REQUIRED', 2),
(87, 22, 6, 6, 6, 'REQUIRED', 3),
(88, 22, 6, 7, 7, 'REQUIRED', 4),
(89, 22, 6, 8, 8, 'REQUIRED', 5),
(90, 22, 6, 9, 9, 'ELECTIVE', 6),
(91, 22, 6, 10, 10, 'ELECTIVE', 7),
(92, 22, 6, 11, 11, 'ELECTIVE', 8),
(93, 22, 6, 12, 12, 'ELECTIVE', 9),
(94, 22, 6, 13, 13, 'ELECTIVE', 10),
(95, 22, 6, 14, 14, 'ELECTIVE', 11),
(96, 22, 6, 15, 15, 'ELECTIVE', 12),
(97, 22, 6, 16, 16, 'ELECTIVE', 13),
(98, 23, 6, 19, 19, 'REQUIRED', 1),
(99, 24, 6, 20, 20, 'REQUIRED', 1),
(100, 25, 7, 1, 1, 'REQUIRED', 1),
(101, 25, 7, 2, 2, 'REQUIRED', 2),
(102, 25, 7, 3, 3, 'REQUIRED', 3),
(103, 26, 7, 22, 4, 'REQUIRED', 1),
(104, 26, 7, 5, 5, 'REQUIRED', 2),
(105, 26, 7, 6, 6, 'REQUIRED', 3),
(106, 26, 7, 7, 7, 'ELECTIVE', 4);

INSERT INTO curriculum_prerequisites (id, curriculum_course_id, prerequisite_curriculum_course_id) VALUES
(1, 10, 5),
(2, 12, 5),
(3, 14, 13),
(4, 15, 14),
(5, 25, 20),
(6, 27, 20),
(7, 33, 32),
(8, 30, 19),
(9, 43, 38),
(10, 45, 38),
(11, 47, 46),
(12, 48, 47),
(13, 58, 53),
(14, 60, 53),
(15, 66, 65),
(16, 63, 52),
(17, 76, 71),
(18, 78, 71),
(19, 80, 79),
(20, 81, 80),
(21, 91, 86),
(22, 93, 86),
(23, 99, 98),
(24, 96, 85);

INSERT INTO program_learning_outcomes (id, program_version_id, plo_code, description, status, display_order) VALUES
(1, 1, 'PLO1', 'Vận dụng kiến thức nền tảng về cơ sở dữ liệu và hệ thống.', 'ACTIVE', 1),
(2, 1, 'PLO2', 'Áp dụng kỹ thuật học máy vào bài toán thực tế.', 'ACTIVE', 2),
(3, 1, 'PLO3', 'Thiết kế kiến trúc phần mềm đáp ứng yêu cầu chất lượng.', 'ACTIVE', 3),
(4, 1, 'PLO4', 'Thực hiện nghiên cứu hoặc dự án độc lập, trình bày kết quả.', 'ACTIVE', 4),
(5, 2, 'PLO1', 'Vận dụng kiến thức nền tảng về cơ sở dữ liệu và hệ thống.', 'ACTIVE', 1),
(6, 2, 'PLO2', 'Áp dụng kỹ thuật học máy vào bài toán thực tế.', 'ACTIVE', 2),
(7, 2, 'PLO3', 'Thiết kế kiến trúc phần mềm đáp ứng yêu cầu chất lượng.', 'ACTIVE', 3),
(8, 2, 'PLO4', 'Thực hiện nghiên cứu hoặc dự án độc lập, trình bày kết quả.', 'ACTIVE', 4),
(9, 3, 'PLO1', 'Vận dụng kiến thức nền tảng về cơ sở dữ liệu và hệ thống.', 'ACTIVE', 1),
(10, 3, 'PLO2', 'Áp dụng kỹ thuật học máy vào bài toán thực tế.', 'ACTIVE', 2),
(11, 3, 'PLO3', 'Thiết kế kiến trúc phần mềm đáp ứng yêu cầu chất lượng.', 'ACTIVE', 3),
(12, 3, 'PLO4', 'Thực hiện nghiên cứu hoặc dự án độc lập, trình bày kết quả.', 'ACTIVE', 4);

INSERT INTO curriculum_course_plos (curriculum_course_id, plo_id, contribution_level) VALUES
(4, 1, 'REINFORCE'),
(5, 2, 'REINFORCE'),
(7, 3, 'REINFORCE'),
(15, 4, 'MASTER'),
(19, 1, 'REINFORCE'),
(20, 2, 'REINFORCE'),
(22, 3, 'REINFORCE'),
(33, 4, 'MASTER'),
(37, 5, 'REINFORCE'),
(38, 6, 'REINFORCE'),
(40, 7, 'REINFORCE'),
(48, 8, 'MASTER'),
(52, 5, 'REINFORCE'),
(53, 6, 'REINFORCE'),
(55, 7, 'REINFORCE'),
(66, 8, 'MASTER'),
(70, 9, 'REINFORCE'),
(71, 10, 'REINFORCE'),
(73, 11, 'REINFORCE'),
(81, 12, 'MASTER'),
(85, 9, 'REINFORCE'),
(86, 10, 'REINFORCE'),
(88, 11, 'REINFORCE'),
(99, 12, 'MASTER');


-- ---- Học viên, phép gán CTĐT, kết quả

INSERT INTO students (id, user_id, organizational_unit_id, student_code, full_name, admission_year) VALUES
(1, 5, 1, 'SV001', 'Nguyễn Văn An', 2024),
(2, 6, 1, 'SV002', 'Trần Thị Bình', 2025),
(3, 7, 1, 'SV003', 'Lê Văn Cường', 2025);

INSERT INTO student_program_assignments (id, student_id, program_version_track_id, assignment_status, assigned_at, ended_at, assigned_by, reason) VALUES
(1, 1, 1, 'ACTIVE', '2024-09-05 02:00:00.000000', NULL, 2, 'Nhập học khóa 2024'),
(2, 2, 4, 'ACTIVE', '2025-09-05 02:00:00.000000', NULL, 2, 'Nhập học khóa 2025'),
(3, 3, 4, 'ENDED', '2025-09-05 02:00:00.000000', '2025-10-10 02:00:00.000000', 2, 'Gán ban đầu'),
(4, 3, 3, 'ACTIVE', '2025-10-10 02:00:00.000000', NULL, 2, 'Chuyển sang hướng nghiên cứu');

INSERT INTO student_course_results (id, student_id, course_id, course_version_id, result_status, grade, passed_at, recorded_by) VALUES
(1, 1, 1, 1, 'PASSED', '8.0', '2026-01-20 02:00:00.000000', 2),
(2, 1, 2, 2, 'PASSED', '8.5', '2026-01-20 02:00:00.000000', 2),
(3, 1, 3, 3, 'EXEMPTED', NULL, '2026-01-20 02:00:00.000000', 2),
(4, 1, 4, 4, 'PASSED', '7.5', '2026-01-20 02:00:00.000000', 2),
(5, 2, 2, 2, 'PASSED', '7.0', '2026-01-20 02:00:00.000000', 2),
(6, 2, 4, 4, 'FAILED', '3.5', NULL, 2),
(7, 2, 5, 5, 'PASSED', '8.0', '2026-01-20 02:00:00.000000', 2),
(8, 3, 1, 1, 'PASSED', '9.0', '2026-01-20 02:00:00.000000', 2),
(9, 3, 5, 5, 'PASSED', '7.5', '2026-01-20 02:00:00.000000', 2);


-- ---- Vòng đời xét duyệt: yêu cầu duyệt, hành động, chuyển trạng thái (khớp workflow_transitions)

INSERT INTO approval_requests (id, program_version_id, request_no, current_status, requested_by, requested_at) VALUES
(1, 1, 'APR-2024-001', 'PENDING', 2, '2024-06-20 02:00:00.000000');

UPDATE program_versions SET status = 'SUBMITTED', submitted_at = '2024-06-20 02:00:00.000000' WHERE id = 1;

UPDATE program_versions SET status = 'REVIEWING' WHERE id = 1;

UPDATE approval_requests SET review_started_at = '2024-06-21 02:00:00.000000', reviewing_by = 3 WHERE id = 1;

UPDATE program_versions SET status = 'RETURNED' WHERE id = 1;

UPDATE approval_requests SET current_status = 'RETURNED', completed_at = '2024-06-25 02:00:00.000000', latest_comment = 'Bổ sung chuẩn đầu ra cho nhóm học phần chuyên ngành.' WHERE id = 1;

INSERT INTO approval_requests (id, program_version_id, request_no, current_status, requested_by, requested_at) VALUES
(2, 1, 'APR-2024-002', 'PENDING', 2, '2024-07-05 02:00:00.000000');

UPDATE program_versions SET status = 'SUBMITTED', submitted_at = '2024-07-05 02:00:00.000000' WHERE id = 1;

UPDATE program_versions SET status = 'REVIEWING' WHERE id = 1;

UPDATE approval_requests SET review_started_at = '2024-07-06 02:00:00.000000', reviewing_by = 3 WHERE id = 2;

UPDATE program_versions SET status = 'PUBLISHED', published_at = '2024-07-10 02:00:00.000000', locked_at = '2024-07-10 02:00:00.000000', effective_from = '2024-09-01' WHERE id = 1;

UPDATE approval_requests SET current_status = 'APPROVED', completed_at = '2024-07-10 02:00:00.000000', latest_comment = 'Đạt yêu cầu.' WHERE id = 2;

UPDATE program_versions SET status = 'ARCHIVED', archived_at = '2026-08-01 02:00:00.000000' WHERE id = 1;

INSERT INTO approval_requests (id, program_version_id, request_no, current_status, requested_by, requested_at) VALUES
(3, 2, 'APR-2025-001', 'PENDING', 2, '2025-06-25 02:00:00.000000');

UPDATE program_versions SET status = 'SUBMITTED', submitted_at = '2025-06-25 02:00:00.000000' WHERE id = 2;

UPDATE program_versions SET status = 'REVIEWING' WHERE id = 2;

UPDATE approval_requests SET review_started_at = '2025-06-26 02:00:00.000000', reviewing_by = 3 WHERE id = 3;

UPDATE program_versions SET status = 'PUBLISHED', published_at = '2025-07-02 02:00:00.000000', locked_at = '2025-07-02 02:00:00.000000', effective_from = '2025-09-01' WHERE id = 2;

UPDATE approval_requests SET current_status = 'APPROVED', completed_at = '2025-07-02 02:00:00.000000', latest_comment = 'Đạt yêu cầu.' WHERE id = 3;

INSERT INTO approval_requests (id, program_version_id, request_no, current_status, requested_by, requested_at, next_reminder_at, last_reminded_at, reminder_count) VALUES
(4, 3, 'APR-2026-001', 'PENDING', 2, '2026-09-28 02:00:00.000000', '2026-10-05 02:00:00.000000', '2026-10-01 02:00:00.000000', 1);

UPDATE program_versions SET status = 'SUBMITTED', submitted_at = '2026-09-28 02:00:00.000000' WHERE id = 3;

INSERT INTO approval_actions (id, approval_request_id, actor_id, action_type, from_status, to_status, comment_text, created_at) VALUES
(1, 1, 2, 'SUBMIT', NULL, 'PENDING', NULL, '2024-06-20 02:00:00.000000'),
(2, 1, 3, 'START_REVIEW', 'PENDING', 'PENDING', NULL, '2024-06-21 02:00:00.000000'),
(3, 1, 3, 'RETURN', 'PENDING', 'RETURNED', 'Bổ sung chuẩn đầu ra cho nhóm học phần chuyên ngành.', '2024-06-25 02:00:00.000000'),
(4, 2, 2, 'SUBMIT', NULL, 'PENDING', NULL, '2024-07-05 02:00:00.000000'),
(5, 2, 3, 'START_REVIEW', 'PENDING', 'PENDING', NULL, '2024-07-06 02:00:00.000000'),
(6, 2, 3, 'APPROVE', 'PENDING', 'APPROVED', 'Đạt yêu cầu.', '2024-07-10 02:00:00.000000'),
(7, 3, 2, 'SUBMIT', NULL, 'PENDING', NULL, '2025-06-25 02:00:00.000000'),
(8, 3, 3, 'START_REVIEW', 'PENDING', 'PENDING', NULL, '2025-06-26 02:00:00.000000'),
(9, 3, 3, 'APPROVE', 'PENDING', 'APPROVED', 'Đạt yêu cầu.', '2025-07-02 02:00:00.000000'),
(10, 4, 2, 'SUBMIT', NULL, 'PENDING', NULL, '2026-09-28 02:00:00.000000');


-- ---- Đăng ký học phần (bản rút gọn, Could)

INSERT INTO academic_terms (id, academic_year, semester, start_date, end_date, status) VALUES
(1, '2026-2027', 'HK1', '2026-09-07', '2027-01-17', 'ACTIVE');

INSERT INTO registration_periods (id, academic_term_id, period_code, period_name, open_at, close_at, status, created_by) VALUES
(1, 1, 'REG-2026-HK1', 'Đăng ký học phần HK1 2026-2027', '2026-09-28 01:00:00.000000', '2026-10-18 10:00:00.000000', 'OPEN', 2);

INSERT INTO registration_period_scopes (id, registration_period_id, education_level_id, major_id, cohort_year, program_version_id) VALUES
(1, 1, NULL, NULL, NULL, 1),
(2, 1, NULL, NULL, NULL, 2);

INSERT INTO registration_period_rules (registration_period_id, minimum_credits, maximum_credits, allow_withdrawal, withdrawal_deadline) VALUES
(1, 6, 15, 1, '2026-10-12 10:00:00.000000');

INSERT INTO course_offerings (id, registration_period_id, course_version_id, class_code, capacity, minimum_capacity, status, created_by) VALUES
(1, 1, 6, 'INF504.01', 30, 8, 'OPEN', 2),
(2, 1, 8, 'INF506.01', 1, 1, 'OPEN', 2),
(3, 1, 7, 'INF505.01', 25, 8, 'OPEN', 2);

INSERT INTO course_registrations (id, student_id, course_offering_id, status, registered_at, status_changed_at, registered_by) VALUES
(1, 2, 1, 'REGISTERED', '2026-09-29 03:00:00.000000', '2026-09-29 03:00:00.000000', 6),
(2, 1, 1, 'REGISTERED', '2026-09-29 04:00:00.000000', '2026-09-29 04:00:00.000000', 5),
(3, 3, 2, 'REGISTERED', '2026-09-29 05:00:00.000000', '2026-09-29 05:00:00.000000', 7),
(4, 2, 3, 'CANCELLED', '2026-09-30 03:00:00.000000', '2026-09-30 06:00:00.000000', 6);


-- ---- Thông báo, hàng đợi email

INSERT INTO notifications (id, sender_id, receiver_id, notification_type, title, content, related_entity_type, related_entity_id, dedupe_key, is_read, read_at) VALUES
(1, 3, 2, 'APPROVAL_RETURNED', 'CTĐT MIT-2024-v1 bị trả về', 'Bổ sung chuẩn đầu ra cho nhóm học phần chuyên ngành.', 'approval_request', 1, 'APPROVAL_RETURNED:1', 1, '2024-06-26 02:00:00.000000'),
(2, 3, 2, 'APPROVAL_APPROVED', 'CTĐT MIT-2025-v1 đã được duyệt', 'Phiên bản đã khóa và gắn khóa tuyển sinh 2025.', 'approval_request', 3, 'APPROVAL_APPROVED:3', 1, '2025-07-02 03:00:00.000000'),
(3, NULL, 3, 'APPROVAL_REMINDER', 'Nhắc xử lý yêu cầu APR-2026-001', 'Yêu cầu đã chờ quá 3 ngày làm việc.', 'approval_request', 4, 'APPROVAL_REMINDER:4:1', 0, NULL),
(4, 2, 6, 'REGISTRATION_OPEN', 'Mở đợt đăng ký HK1 2026-2027', 'Đợt đăng ký mở đến 17:00 ngày 18/10/2026.', 'registration_period', 1, 'REGISTRATION_OPEN:1:6', 0, NULL);

INSERT INTO notification_deliveries (id, notification_id, channel, recipient_email, status, attempt_count, next_attempt_at, last_error, sent_at) VALUES
(1, 3, 'EMAIL', 'approver.fit@example.edu', 'SENT', 1, NULL, NULL, '2026-10-01 02:01:00.000000'),
(2, 4, 'EMAIL', 'sv002@example.edu', 'PENDING', 1, '2026-10-03 03:00:00.000000', 'SMTP timeout', NULL);


-- ---- API client chỉ đọc

INSERT INTO api_clients (id, client_code, client_name, secret_hash, status, rate_limit_per_minute, created_by, secret_rotated_at) VALUES
(1, 'GRADUATION_SYSTEM', 'Hệ thống xét tốt nghiệp (minh họa)', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEeKFNSsjBkZV5BJomEdmgPhv50sedKdZq', 'ACTIVE', 60, 1, '2026-09-01 02:00:00.000000'),
(2, 'LEARNING_PROGRESS', 'Hệ thống quản lý tiến độ học tập (minh họa)', '$2b$12$Qk3Z1u8mVb2XnC5dLw0pEeKFNSsjBkZV5BJomEdmgPhv50sedKdZq', 'ACTIVE', 60, 1, '2026-09-01 02:00:00.000000');

INSERT INTO api_client_scopes (api_client_id, api_scope_id) VALUES
(1, 1),
(1, 2),
(1, 3),
(2, 2),
(2, 3);

INSERT INTO api_access_logs (id, api_client_id, endpoint, http_method, response_status, ip_address, requested_at) VALUES
(1, 1, '/integration/v1/programs', 'GET', 200, '10.0.0.21', '2026-10-01 01:00:00.000000'),
(2, 1, '/integration/v1/program-versions/2/curriculum', 'GET', 200, '10.0.0.21', '2026-10-01 01:00:02.000000'),
(3, 2, '/integration/v1/courses', 'GET', 200, '10.0.0.22', '2026-10-02 01:00:00.000000'),
(4, 2, '/integration/v1/programs', 'GET', 403, '10.0.0.22', '2026-10-02 01:00:03.000000');


-- ---- Audit log (nhất quán với quyền: chỉ APPROVER mới có PUBLISH/APPROVE)

INSERT INTO audit_logs (id, actor_id, actor_username, action, entity_type, entity_id, scope_unit_id, old_value, new_value, ip_address, request_id, created_at) VALUES
(1, 1, 'admin', 'ROLE_ASSIGN', 'user', 3, 1, NULL, '{"role":"APPROVER"}', '10.0.0.5', 'demo-001', '2026-09-01 02:00:00.000000'),
(2, 2, 'officer.fit', 'CREATE', 'program_version', 2, 1, NULL, '{"version_code":"MIT-2025-v1"}', '10.0.0.5', 'demo-002', '2025-06-02 02:00:00.000000'),
(3, 2, 'officer.fit', 'SUBMIT', 'program_version', 2, 1, '{"status":"DRAFT"}', '{"status":"SUBMITTED"}', '10.0.0.5', 'demo-003', '2025-06-25 02:00:00.000000'),
(4, 3, 'approver.fit', 'APPROVE', 'program_version', 2, 1, '{"status":"REVIEWING"}', '{"status":"PUBLISHED"}', '10.0.0.5', 'demo-004', '2025-07-02 02:00:00.000000'),
(5, 3, 'approver.fit', 'ARCHIVE', 'program_version', 1, 1, '{"status":"PUBLISHED"}', '{"status":"ARCHIVED"}', '10.0.0.5', 'demo-005', '2026-08-01 02:00:00.000000'),
(6, 2, 'officer.fit', 'COPY', 'program_version', 3, 1, NULL, '{"source_program_version_id":2}', '10.0.0.5', 'demo-006', '2026-09-14 02:00:00.000000'),
(7, 2, 'officer.fit', 'SUBMIT', 'program_version', 3, 1, '{"status":"DRAFT"}', '{"status":"SUBMITTED"}', '10.0.0.5', 'demo-007', '2026-09-28 02:00:00.000000'),
(8, NULL, 'sv002', 'LOGIN_FAILED', 'user', 6, NULL, NULL, '{"failed_login_count":1}', '10.0.0.5', 'demo-008', '2026-10-02 03:00:00.000000');


-- ---- Nhập Excel (staging)

INSERT INTO import_batches (id, import_type, source_filename, status, total_rows, valid_rows, invalid_rows, created_by, confirmed_at, committed_at, file_sha256) VALUES
(1, 'COURSE', 'hoc_phan_bo_sung.xlsx', 'COMMITTED', 3, 3, 0, 2, '2026-09-10 02:00:00.000000', '2026-09-10 02:00:05.000000', '6b01c344dbe5827bec3e711f9debb1e0cf4bf98478461b140c813fb873f88591'),
(2, 'COURSE', 'hoc_phan_loi.xlsx', 'VALIDATED', 3, 2, 1, 2, NULL, NULL, 'c4b887415867511379218b2aeb2e7daf360eb7adb33f74608f348288aa9eb18a');

INSERT INTO import_rows (id, import_batch_id, row_no, raw_data, normalized_data, row_status) VALUES
(1, 1, 1, '{"course_code":"INF601"}', '{"course_code":"INF601","credits":6}', 'IMPORTED'),
(2, 1, 2, '{"course_code":"INF602"}', '{"course_code":"INF602","credits":6}', 'IMPORTED'),
(3, 1, 3, '{"course_code":"INF603"}', '{"course_code":"INF603","credits":6}', 'IMPORTED'),
(4, 2, 1, '{"course_code":"INF701"}', '{"course_code":"INF701","credits":3}', 'VALID'),
(5, 2, 2, '{"course_code":"INF702"}', '{"course_code":"INF702","credits":3}', 'VALID'),
(6, 2, 3, '{"course_code":"INF601"}', NULL, 'INVALID');

INSERT INTO import_errors (id, import_row_id, field_name, error_code, error_message) VALUES
(1, 6, 'course_code', 'DUPLICATE_CODE', 'Mã học phần INF601 đã tồn tại');