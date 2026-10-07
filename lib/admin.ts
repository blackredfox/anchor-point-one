import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getBindings } from "@/lib/database";

export async function getAdminIdentity() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const approved = (getBindings().ADMIN_EMAILS ?? "")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return approved.includes(user.email.toLowerCase())
    ? { email: user.email, displayName: user.displayName }
    : null;
}
