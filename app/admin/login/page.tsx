import { redirect } from "next/navigation";
import { getAdminUser } from "@/app/admin-auth";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { safeAdminReturnTo } from "@/lib/admin-auth-crypto";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const returnTo = safeAdminReturnTo((await searchParams).return_to);
  if (await getAdminUser()) redirect(returnTo);
  return (
    <main className="admin-login-page">
      <AdminLoginForm returnTo={returnTo} />
    </main>
  );
}
