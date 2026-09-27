-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "demoMode" BOOLEAN NOT NULL DEFAULT true,
    "externalAiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSettings" ("demoMode", "externalAiEnabled", "id", "updatedAt") SELECT "demoMode", "externalAiEnabled", "id", "updatedAt" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
