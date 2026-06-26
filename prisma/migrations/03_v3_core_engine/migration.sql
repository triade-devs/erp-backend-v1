-- ====================================================================
-- PARTE 1: A GRANDE FAXINA (O CASCADE destrói FKs, Índices e Triggers)
-- ====================================================================

DROP TABLE IF EXISTS "public"."warehouses" CASCADE;
DROP TABLE IF EXISTS "public"."field_catalog" CASCADE;
DROP TABLE IF EXISTS "public"."role_field_rules" CASCADE;
DROP TABLE IF EXISTS "public"."scope_dimensions" CASCADE;
DROP TABLE IF EXISTS "public"."role_scopes" CASCADE;
DROP TABLE IF EXISTS "public"."password_reset_requests" CASCADE;

-- ====================================================================
-- PARTE 2: MUTAÇÕES EM TABELAS EXISTENTES
-- ====================================================================

ALTER TYPE "public"."movement_type" ADD VALUE IF NOT EXISTS 'loss';

DROP TRIGGER IF EXISTS trg_product_warehouse_scope ON "public"."products";
DROP POLICY IF EXISTS products_select ON "public"."products";

ALTER TABLE "public"."products" 
  DROP COLUMN IF EXISTS "cost_price" CASCADE,
  DROP COLUMN IF EXISTS "supplier_id" CASCADE,
  DROP COLUMN IF EXISTS "warehouse_id" CASCADE,
  ADD COLUMN IF NOT EXISTS "min_stock" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "public"."roles" 
  DROP COLUMN IF EXISTS "hierarchy_level" CASCADE,
  DROP COLUMN IF EXISTS "parent_role_id" CASCADE;

ALTER TABLE "public"."product_classifications" 
  ALTER COLUMN "name" SET DATA TYPE VARCHAR(60);

ALTER TABLE "public"."companies" 
  DROP COLUMN IF EXISTS "plan" CASCADE,
  ADD COLUMN IF NOT EXISTS "plan_code" TEXT NOT NULL DEFAULT 'starter';

ALTER TABLE "public"."stock_movements" 
  DROP CONSTRAINT IF EXISTS "stock_movements_product_id_fkey";

-- ====================================================================
-- PARTE 3: CRIAÇÃO DO NOVO DOMÍNIO V3.0
-- ====================================================================

CREATE TABLE IF NOT EXISTS "public"."plans" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- [SALVA-VIDAS]: Injeta o plano Starter antes do Postgres cobrar a Foreign Key!
INSERT INTO "public"."plans" ("code", "name") VALUES ('starter', 'Plano Starter Base') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "public"."plan_modules" (
    "plan_code" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
    CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("plan_code","module_code")
);

CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "company_id" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("company_id")
);

CREATE TABLE IF NOT EXISTS "public"."support_access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "support_user_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."stock_layers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "quantity_remaining" DECIMAL(12,3) NOT NULL,
    "entry_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_layers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."movement_layer_consumption" (
    "movement_id" UUID NOT NULL,
    "layer_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "movement_layer_consumption_pkey" PRIMARY KEY ("movement_id","layer_id")
);

CREATE TABLE IF NOT EXISTS "public"."sale_price_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" UUID NOT NULL,
    CONSTRAINT "sale_price_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."stock_change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "ean" TEXT NOT NULL,
    "enrichment_data" JSONB NOT NULL DEFAULT '{}',
    "requested_by" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    CONSTRAINT "stock_change_requests_pkey" PRIMARY KEY ("id")
);

-- ====================================================================
-- PARTE 4: ÍNDICES
-- ====================================================================

CREATE INDEX IF NOT EXISTS "support_access_grants_company_id_idx" ON "public"."support_access_grants"("company_id");
CREATE INDEX IF NOT EXISTS "support_access_grants_support_user_id_idx" ON "public"."support_access_grants"("support_user_id");
CREATE INDEX IF NOT EXISTS "stock_layers_company_id_product_id_quantity_remaining_idx" ON "public"."stock_layers"("company_id", "product_id", "quantity_remaining");
CREATE INDEX IF NOT EXISTS "sale_price_history_product_id_valid_from_idx" ON "public"."sale_price_history"("product_id", "valid_from" DESC);
CREATE INDEX IF NOT EXISTS "stock_change_requests_company_id_status_idx" ON "public"."stock_change_requests"("company_id", "status");

-- ====================================================================
-- PARTE 5: FOREIGN KEYS BLINDADAS
-- ====================================================================

ALTER TABLE "public"."plan_modules" ADD CONSTRAINT "plan_modules_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."plan_modules" ADD CONSTRAINT "plan_modules_module_code_fkey" FOREIGN KEY ("module_code") REFERENCES "public"."modules"("code") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."companies" ADD CONSTRAINT "companies_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "public"."company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."support_access_grants" ADD CONSTRAINT "support_access_grants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."support_access_grants" ADD CONSTRAINT "support_access_grants_support_user_id_fkey" FOREIGN KEY ("support_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."support_access_grants" ADD CONSTRAINT "support_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."stock_layers" ADD CONSTRAINT "stock_layers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."stock_layers" ADD CONSTRAINT "stock_layers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."stock_layers" ADD CONSTRAINT "stock_layers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."movement_layer_consumption" ADD CONSTRAINT "movement_layer_consumption_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."movement_layer_consumption" ADD CONSTRAINT "movement_layer_consumption_layer_id_fkey" FOREIGN KEY ("layer_id") REFERENCES "public"."stock_layers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "public"."sale_price_history" ADD CONSTRAINT "sale_price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."sale_price_history" ADD CONSTRAINT "sale_price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "public"."stock_change_requests" ADD CONSTRAINT "stock_change_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."stock_change_requests" ADD CONSTRAINT "stock_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "public"."stock_change_requests" ADD CONSTRAINT "stock_change_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;