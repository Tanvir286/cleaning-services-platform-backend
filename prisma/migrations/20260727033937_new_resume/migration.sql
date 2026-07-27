-- CreateTable
CREATE TABLE "maid_resumes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "resume" TEXT,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "maid_resumes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "maid_resumes" ADD CONSTRAINT "maid_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
