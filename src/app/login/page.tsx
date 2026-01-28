"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client"; // Client tarafı supabase

import { verifyOtpCode } from "@/lib/actions/auth"; // Az önce yazdığımız server action

import { useRouter } from "next/navigation";

const allowedDomains = ["kariyer.net", "techcareer.net", "coens.io"];

export default function LoginPage() {

  const [username, setUsername] = useState("");

  const [selectedDomain, setSelectedDomain] = useState(allowedDomains[0]);

  const [code, setCode] = useState("");

  const [step, setStep] = useState<"email" | "code">("email");

  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");

  const router = useRouter();

  // Tam email adresini oluştur
  const fullEmail = `${username}@${selectedDomain}`;

  // 1. ADIM: Maili Gönder (Client Side çağırıyoruz ki state yönetebilelim)

  const handleSendCode = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!username.trim()) {
      setMsg("Lütfen kullanıcı adınızı girin.");
      return;
    }

    setLoading(true);

    setMsg("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({

      email: fullEmail,

      options: {

        // Link yerine sadece kod gitmesini istiyoruz ama Supabase ikisini de gönderir.

        // Biz kullanıcının kodu girmesini bekleyeceğiz.

        shouldCreateUser: true,

      },

    });

    setLoading(false);

    if (error) {

      setMsg("Hata: " + error.message);

    } else {

      setStep("code"); // Ekranı değiştir

      setMsg("Mail kutuna gelen 6 haneli kodu gir.");

    }

  };

  // 2. ADIM: Kodu Doğrula

  const handleVerifyCode = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);



    // Server action'ı çağır

    const res = await verifyOtpCode(fullEmail, code);



    if (res?.error) {

      setMsg("Hatalı kod! Lütfen tekrar dene.");

      setLoading(false);

    }

    // Hata yoksa verifyOtpCode içinde redirect('/') çalışacak.

  };

  return (

    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">

      <div className="w-full max-w-md space-y-6 p-6 sm:p-8 bg-white rounded-xl shadow-lg border border-gray-100 text-center">

        <div className="space-y-2">

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">

            Assembly Ferko Space Management

          </h1>

          <h2 className="text-lg sm:text-xl font-semibold text-gray-700">

            {step === "email" ? "Giriş Yap" : "Kodu Girin"}

          </h2>

        </div>

        {msg && <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">{msg}</p>}

        {step === "email" ? (

          <form onSubmit={handleSendCode} className="space-y-4">

            <div className="flex flex-col sm:flex-row gap-2">

              <input

                type="text"

                required

                placeholder="kullanici.adi"

                value={username}

                onChange={(e) => setUsername(e.target.value)}

                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"

              />

              <div className="flex items-center gap-2">

                <span className="text-gray-500 font-medium">@</span>

                <select

                  value={selectedDomain}

                  onChange={(e) => setSelectedDomain(e.target.value)}

                  className="flex-1 sm:flex-none px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white cursor-pointer"

                >

                  {allowedDomains.map((domain) => (

                    <option key={domain} value={domain}>

                      {domain}

                    </option>

                  ))}

                </select>

              </div>

            </div>

            <button

              type="submit"

              disabled={loading}

              className="w-full bg-[#5E5CE6] hover:bg-[#4b4acb] text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"

            >

              {loading ? "Gönderiliyor..." : "Kod Gönder"}

            </button>

          </form>

        ) : (

          <form onSubmit={handleVerifyCode} className="space-y-4">

            <div>

              <input

                type="text"

                required

                placeholder="123456"

                value={code}

                onChange={(e) => setCode(e.target.value)}

                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"

              />

            </div>

            <button

              type="submit"

              disabled={loading}

              className="w-full bg-[#5E5CE6] hover:bg-[#4b4acb] text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"

            >

              {loading ? "Doğrulanıyor..." : "Giriş Yap"}

            </button>

            <button

              type="button"

              onClick={() => setStep("email")}

              className="text-sm text-gray-500 hover:underline"

            >

              Maili değiştir

            </button>

          </form>

        )}

      </div>

    </div>

  );

}
