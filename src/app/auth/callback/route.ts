import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedDomains = ["kariyer.net", "techcareer.net", "coens.io"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // DİKKAT: Origin'i request'ten dinamik almıyoruz.
  // Railway üzerinde localhost hatasını önlemek için adresi sabitliyoruz.
  const productionUrl = "https://assembly-ferko-space-manager-production.up.railway.app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the authenticated user's email
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email;

      if (email) {
        const emailDomain = email.split("@")[1]?.toLowerCase();

        // Check if the email domain is in the allowed list
        if (emailDomain && allowedDomains.includes(emailDomain)) {
          // Allowed domain: Redirect to dashboard
          return NextResponse.redirect(`${productionUrl}/`);
        }
      }

      // Unauthorized domain: Sign out and redirect to login with error
      await supabase.auth.signOut();
      return NextResponse.redirect(`${productionUrl}/login?error=unauthorized_domain`);
    }
  }

  // Hata durumu: Login sayfasına hata koduyla yönlendir
  return NextResponse.redirect(`${productionUrl}/login?error=auth`);
}
