import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      // Başarılı giriş: Dashboard'a (Root) yönlendir
      return NextResponse.redirect(`${productionUrl}/`);
    }
  }

  // Hata durumu: Login sayfasına hata koduyla yönlendir
  return NextResponse.redirect(`${productionUrl}/login?error=auth`);
}
