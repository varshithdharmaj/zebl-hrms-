-- AlterEnum: add reports entity for recruitment report filter presets
ALTER TYPE "SavedFilterEntity" ADD VALUE IF NOT EXISTS 'reports';
