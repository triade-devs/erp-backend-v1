## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `full_name` | `text` |  |
| `avatar_url` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `products`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `sku` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  |
| `unit` | `text` |  |
| `cost_price` | `numeric` |  |
| `sale_price` | `numeric` |  |
| `stock` | `numeric` |  |
| `min_stock` | `numeric` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `company_id` | `uuid` |  |
| `warehouse_id` | `uuid` |  Nullable |
| `ncm` | `text` |  |
| `barcode` | `text` |  Nullable |
| `location` | `text` |  Nullable |
| `classification_id` | `uuid` |  Nullable |
| `supplier_id` | `uuid` |  |

## Table `stock_movements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `product_id` | `uuid` |  |
| `movement_type` | `movement_type` |  |
| `quantity` | `numeric` |  |
| `unit_cost` | `numeric` |  Nullable |
| `reason` | `text` |  Nullable |
| `performed_by` | `uuid` |  |
| `created_at` | `timestamptz` |  |
| `company_id` | `uuid` |  |

## Table `companies`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `slug` | `text` |  Unique |
| `document` | `text` |  Nullable |
| `plan` | `text` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `platform_admins`

PR #E DEPRECATED: substituída por platform_role_assignments. Mantida 1 release para rollback; drop em follow-up. is_platform_admin não lê mais daqui.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `granted_by` | `uuid` |  Nullable |
| `granted_at` | `timestamptz` |  |

## Table `modules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `icon` | `text` |  Nullable |
| `is_system` | `bool` |  |
| `is_active` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `module_code` | `text` |  |
| `resource` | `text` |  |
| `action` | `text` |  |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `company_modules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `company_id` | `uuid` | Primary |
| `module_code` | `text` | Primary |
| `enabled_at` | `timestamptz` |  |
| `enabled_by` | `uuid` |  Nullable |

## Table `roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `is_system` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `template_code` | `text` |  Nullable |
| `template_synced_at` | `timestamptz` |  Nullable |
| `parent_role_id` | `uuid` |  Nullable |
| `hierarchy_level` | `int4` |  |

## Table `role_permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `role_id` | `uuid` | Primary |
| `permission_code` | `text` | Primary |
| `granted_at` | `timestamptz` |  |
| `is_active` | `bool` |  |

## Table `memberships`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `company_id` | `uuid` |  |
| `legacy_is_owner` | `bool` |  |
| `status` | `membership_status` |  |
| `invited_by` | `uuid` |  Nullable |
| `invited_at` | `timestamptz` |  Nullable |
| `joined_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `membership_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `membership_id` | `uuid` | Primary |
| `role_id` | `uuid` | Primary |
| `assigned_by` | `uuid` |  Nullable |
| `assigned_at` | `timestamptz` |  |

## Table `audit_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  Nullable |
| `actor_user_id` | `uuid` |  Nullable |
| `actor_email` | `text` |  Nullable |
| `action` | `text` |  |
| `resource_type` | `text` |  Nullable |
| `resource_id` | `text` |  Nullable |
| `permission` | `text` |  Nullable |
| `status` | `text` |  |
| `ip` | `inet` |  Nullable |
| `user_agent` | `text` |  Nullable |
| `metadata` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `kb_categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `parent_id` | `uuid` |  Nullable |
| `slug` | `text` |  |
| `title` | `text` |  |
| `audience` | `text` |  |
| `position` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `kb_videos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `composition` | `text` |  |
| `title` | `text` |  |
| `description` | `text` |  Nullable |
| `status` | `text` |  |
| `storage_path` | `text` |  Nullable |
| `duration_s` | `numeric` |  Nullable |
| `thumbnail_path` | `text` |  Nullable |
| `input_props` | `jsonb` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `kb_articles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `category_id` | `uuid` |  Nullable |
| `slug` | `text` |  |
| `title` | `text` |  |
| `summary` | `text` |  Nullable |
| `content_json` | `jsonb` |  |
| `content_md` | `text` |  |
| `status` | `text` |  |
| `audience` | `text` |  |
| `related_module` | `text` |  Nullable |
| `related_table` | `text` |  Nullable |
| `video_id` | `uuid` |  Nullable |
| `search_vector` | `tsvector` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `published_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `kb_article_revisions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `article_id` | `uuid` |  |
| `content_json` | `jsonb` |  |
| `content_md` | `text` |  |
| `edited_by` | `uuid` |  Nullable |
| `edited_at` | `timestamptz` |  |

## Table `kb_article_chunks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `article_id` | `uuid` |  |
| `company_id` | `uuid` |  |
| `chunk_index` | `int4` |  |
| `content` | `text` |  |
| `embedding` | `vector` |  |
| `created_at` | `timestamptz` |  |

## Table `company_invitations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `email` | `citext` |  |
| `token_hash` | `bytea` |  |
| `short_code` | `text` |  |
| `role_ids` | `_uuid` |  |
| `invited_by` | `uuid` |  |
| `status` | `text` |  |
| `expires_at` | `timestamptz` |  |
| `accepted_at` | `timestamptz` |  Nullable |
| `accepted_by` | `uuid` |  Nullable |
| `revoked_at` | `timestamptz` |  Nullable |
| `revoked_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `password_reset_requests`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `email` | `citext` |  |
| `token_hash` | `bytea` |  Nullable |
| `short_code` | `text` |  Nullable |
| `status` | `text` |  |
| `source` | `text` |  |
| `requested_at` | `timestamptz` |  |
| `approved_by` | `uuid` |  Nullable |
| `approved_at` | `timestamptz` |  Nullable |
| `consumed_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `revoked_at` | `timestamptz` |  Nullable |
| `revoked_by` | `uuid` |  Nullable |
| `metadata` | `jsonb` |  |

## Table `migration_backfill_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `membership_id` | `uuid` |  |
| `invitation_id` | `uuid` |  |
| `email` | `text` |  |
| `company_id` | `uuid` |  |
| `short_code` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `short_code_attempts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `ip` | `inet` |  Nullable |
| `identifier` | `text` |  |
| `attempts` | `int4` |  |
| `locked_until` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_patients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `full_name` | `text` |  |
| `document` | `text` |  Nullable |
| `birth_date` | `date` |  Nullable |
| `sex` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `emergency_contact_name` | `text` |  Nullable |
| `emergency_contact_phone` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `is_archived` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `archived_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_patient_assignments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `membership_id` | `uuid` |  |
| `relationship` | `medical_assignment_relationship` |  |
| `is_primary` | `bool` |  |
| `assigned_by` | `uuid` |  Nullable |
| `assigned_at` | `timestamptz` |  |
| `ended_at` | `timestamptz` |  Nullable |
| `notes` | `text` |  Nullable |

## Table `medical_consultations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `consultation_at` | `timestamptz` |  |
| `chief_complaint` | `text` |  Nullable |
| `clinical_evolution` | `text` |  Nullable |
| `diagnosis_text` | `text` |  Nullable |
| `conduct` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_anamnesis_templates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `name` | `text` |  |
| `specialty` | `text` |  Nullable |
| `schema_json` | `jsonb` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_anamneses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `consultation_id` | `uuid` |  Nullable |
| `template_id` | `uuid` |  Nullable |
| `answers_json` | `jsonb` |  |
| `summary` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_prescriptions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `consultation_id` | `uuid` |  Nullable |
| `issued_at` | `timestamptz` |  |
| `general_instructions` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `updated_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_prescription_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `prescription_id` | `uuid` |  |
| `company_id` | `uuid` |  |
| `medication` | `text` |  |
| `dosage` | `text` |  Nullable |
| `route` | `text` |  Nullable |
| `frequency` | `text` |  Nullable |
| `duration` | `text` |  Nullable |
| `quantity` | `text` |  Nullable |
| `instructions` | `text` |  Nullable |
| `position` | `int4` |  |

## Table `medical_consent_templates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `title` | `text` |  |
| `version` | `int4` |  |
| `body` | `text` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `medical_patient_consents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `template_id` | `uuid` |  Nullable |
| `template_title` | `text` |  |
| `template_version` | `int4` |  |
| `accepted_body` | `text` |  |
| `accepted_by` | `uuid` |  Nullable |
| `accepted_at` | `timestamptz` |  |
| `notes` | `text` |  Nullable |

## Table `medical_attachment_metadata`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `patient_id` | `uuid` |  |
| `consultation_id` | `uuid` |  Nullable |
| `file_name` | `text` |  |
| `file_type` | `text` |  Nullable |
| `file_size_bytes` | `int8` |  Nullable |
| `storage_path` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `role_templates`

PR #D1: catálogo global de templates (perfis-padrão). Instâncias por tenant em public.roles via template_code.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `is_system` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `parent_template_code` | `text` |  Nullable |

## Table `template_permissions`

PR #D1: permissões que compõem cada template. Fonte para apply_template_to_company.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `template_code` | `text` | Primary |
| `permission_code` | `text` | Primary |
| `added_at` | `timestamptz` |  |

## Table `platform_roles`

PR #E: catálogo global de platform roles. Permissions é array de codes; '*' ou 'platform:*' = full bypass.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `permissions` | `_text` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `platform_role_assignments`

PR #E: atribuição N×N user→platform_role. Substitui platform_admins. Drop da tabela antiga em follow-up.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `role_code` | `text` | Primary |
| `granted_by` | `uuid` |  Nullable |
| `granted_at` | `timestamptz` |  |

## Table `field_catalog`

PR #H: catálogo de colunas mascaráveis. (table_name, column_name) PK. Apenas platform admin escreve.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `table_name` | `text` | Primary |
| `column_name` | `text` | Primary |
| `label` | `text` |  |
| `description` | `text` |  Nullable |
| `module_code` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `role_field_rules`

PR #H: atribuição de modo (hidden/readonly/editable) por role × coluna. Sem row = editable.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `role_id` | `uuid` | Primary |
| `table_name` | `text` | Primary |
| `column_name` | `text` | Primary |
| `mode` | `text` |  |
| `granted_at` | `timestamptz` |  |

## Table `scope_dimensions`

Catálogo global de dimensões de escopo (warehouse, cost_center, etc.). Fonte única de verdade.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `resolver_fn` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `role_scopes`

Atribuições de scope a roles. Role sem linhas em role_scopes(dim=X) = acesso irrestrito a X. Múltiplas dimensões = interseção.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `role_id` | `uuid` | Primary |
| `dimension_code` | `text` | Primary |
| `scope_value` | `text` | Primary |
| `granted_at` | `timestamptz` |  |

## Table `warehouses`

Depósitos/warehouses. PR #G: primeira dimensão concreta de role scoping. Role sem warehouse_id em role_scopes = acesso irrestrito.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `name` | `text` |  |
| `location` | `text` |  Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `suppliers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `name` | `text` |  |
| `document` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `country` | `text` |  Nullable |
| `state` | `text` |  Nullable |
| `city` | `text` |  Nullable |
| `cep` | `text` |  Nullable |

## Table `product_classifications`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `name` | `text` |  |
| `level` | `text` |  |
| `parent_id` | `uuid` |  Nullable |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `spaces`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `location` | `text` |  Nullable |
| `capacity` | `int4` |  Nullable |
| `default_price` | `numeric` |  |
| `booking_mode` | `space_booking_mode` |  |
| `is_active` | `bool` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `space_rentals`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_id` | `uuid` |  |
| `space_id` | `uuid` |  |
| `renter_user_id` | `uuid` |  |
| `booking_kind` | `rental_kind` |  |
| `starts_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |
| `period` | `tstzrange` |  Nullable |
| `price` | `numeric` |  |
| `status` | `rental_status` |  |
| `notes` | `text` |  Nullable |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `request_batch_id` | `uuid` |  Nullable |

