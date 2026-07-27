/*
  Warnings:

  - You are about to drop the `maid_resumes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "maid_resumes" DROP CONSTRAINT "maid_resumes_user_id_fkey";

-- DropTable
DROP TABLE "maid_resumes";
