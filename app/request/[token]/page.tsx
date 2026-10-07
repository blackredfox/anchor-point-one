import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestThread } from "@/components/RequestThread";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Your Service Request",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){
  const{token}=await params;if(!/^[a-f0-9]{48}$/.test(token))notFound();
  return <main className="thread-page"><header className="thread-header"><Link className="brand" href="/"><strong>Anchor Point One</strong><span>Private Request Chat</span></Link><Link href="/">Back to website</Link></header><RequestThread token={token}/></main>
}
