-- CreateTable
CREATE TABLE "access_version" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_version_pkey" PRIMARY KEY ("id")
);
