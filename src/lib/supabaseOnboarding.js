import { onboardingStatuses } from "@/lib/emailVerificationGate";

const getOrgName = (email) => `Pending tenant - ${email || "new user"}`;

export async function markEmailVerifiedForOnboarding(client, authUser) {
  if (!client || !authUser?.id) return null;

  const verifiedAt = authUser.email_confirmed_at || authUser.confirmed_at || new Date().toISOString();

  const { data: orgRows, error: orgError } = await client
    .from("organization")
    .select("*")
    .eq("record->>owner_user_id", authUser.id)
    .limit(1);

  if (orgError && orgError.code !== "42P01") throw orgError;

  let organization = orgRows?.[0] || null;
  if (organization) {
    const record = organization.record || {};
    const nextStatus = record.onboarding_status === onboardingStatuses.EMAIL
      ? onboardingStatuses.COMPANY
      : record.onboarding_status || onboardingStatuses.COMPANY;

    const { data, error } = await client
      .from("organization")
      .update({
        tenant_id: organization.tenant_id || organization.id,
        organization_id: organization.organization_id || organization.id,
        record: {
          ...record,
          tenant_id: organization.tenant_id || organization.id,
          organization_id: organization.organization_id || organization.id,
          email_verified: true,
          email_verified_at: verifiedAt,
          onboarding_status: nextStatus
        }
      })
      .eq("id", organization.id)
      .select("*")
      .single();

    if (error) throw error;
    organization = data;
  } else {
    const pendingRecord = {
      tenant_name: getOrgName(authUser.email),
      organization_name: getOrgName(authUser.email),
      owner_user_id: authUser.id,
      created_by_user_id: authUser.id,
      owner_email: authUser.email,
      created_by_email: authUser.email,
      admin_emails: [authUser.email],
      authorized_user_ids: [authUser.id],
      selected_plan: authUser.user_metadata?.selected_plan,
      email_verified: true,
      email_verified_at: verifiedAt,
      status: "pending_company_profile",
      onboarding_status: onboardingStatuses.COMPANY
    };

    const { data, error } = await client
      .from("organization")
      .insert({ record: pendingRecord })
      .select("*")
      .single();

    if (error) throw error;

    const { data: updated, error: updateError } = await client
      .from("organization")
      .update({
        tenant_id: data.id,
        organization_id: data.id,
        record: {
          ...pendingRecord,
          tenant_id: data.id,
          organization_id: data.id
        }
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (updateError) throw updateError;
    organization = updated;
  }

  const tenantId = organization.id;
  const userRecord = {
    auth_user_id: authUser.id,
    email: authUser.email,
    full_name: authUser.user_metadata?.full_name || authUser.email,
    role: "admin",
    assigned_roles: ["TENANT_ADMIN"],
    status: "active",
    email_verified: true,
    email_verified_at: verifiedAt,
    tenant_id: tenantId,
    organization_id: tenantId,
    organization_name: organization.record?.organization_name || organization.record?.tenant_name
  };

  const { data: users, error: userReadError } = await client
    .from("user")
    .select("*")
    .eq("record->>auth_user_id", authUser.id)
    .limit(1);

  if (userReadError && userReadError.code !== "42P01") throw userReadError;

  if (users?.[0]) {
    const { error } = await client
      .from("user")
      .update({
        tenant_id: tenantId,
        organization_id: tenantId,
        record: { ...(users[0].record || {}), ...userRecord }
      })
      .eq("id", users[0].id);
    if (error) throw error;
  } else {
    const { error } = await client
      .from("user")
      .insert({
        tenant_id: tenantId,
        organization_id: tenantId,
        record: userRecord
      });
    if (error) throw error;
  }

  return organization;
}
