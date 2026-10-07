import { ensureDatabase } from "@/lib/database";
import { choiceField, emailField, jsonError, textField } from "@/lib/validation";
export const dynamic = "force-dynamic";
const types = ["rv","home","other"] as const;

export async function GET() {
  const db = await ensureDatabase();
  const data = await db.prepare("SELECT id,customer_name,service_type,rating,body,owner_response,owner_responded_at,created_at FROM reviews ORDER BY created_at DESC LIMIT 50").all();
  return Response.json({ reviews:data.results.map((r) => ({ id:r.id,customerName:r.customer_name,serviceType:r.service_type,rating:r.rating,body:r.body,ownerResponse:r.owner_response,ownerRespondedAt:r.owner_responded_at,createdAt:r.created_at })) });
}

export async function POST(request: Request) {
  let value: Record<string, unknown>; try { value = await request.json() as Record<string, unknown>; } catch { return jsonError("Enter your review."); }
  if (typeof value.company === "string" && value.company.trim()) return Response.json({ok:true},{status:201});
  const name=textField(value.name,"Name",2,80), email=emailField(value.email), service=choiceField(value.serviceType,types,"service type"), body=textField(value.body,"Review",10,1200);
  const rating=typeof value.rating==="number"&&Number.isInteger(value.rating)&&value.rating>=1&&value.rating<=5?value.rating:null;
  const invalid=[name,email,service,body].find((item)=>!item.ok); if(invalid&&!invalid.ok)return jsonError(invalid.message); if(!rating)return jsonError("Choose a rating from 1 to 5 stars.");
  if(!name.ok||!email.ok||!service.ok||!body.ok)return jsonError("Review the form.");
  const db=await ensureDatabase(); await db.prepare("INSERT INTO reviews (id,customer_name,email,service_type,rating,body,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),name.data,email.data,service.data,rating,body.data,Date.now()).run();
  return Response.json({ok:true},{status:201});
}
