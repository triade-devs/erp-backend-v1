-- CreateEnum
CREATE TYPE "CompanySetupStatus" AS ENUM ('PENDING_SEED', 'PENDING_FISCAL', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "setup_status" "CompanySetupStatus" NOT NULL DEFAULT 'PENDING_SEED';

