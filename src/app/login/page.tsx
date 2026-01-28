"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client"; // Client tarafı supabase

import { verifyOtpCode } from "@/lib/actions/auth"; // Az önce yazdığımız server action

import { useRouter } from "next/navigation";

export default function LoginPage() {

  const [email, setEmail] = useState("");

  const [code, setCode] = useState("");

  const [step, setStep] = useState<"email" | "code">("email");

  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");

  const router = useRouter();

  // 1. ADIM: Maili Gönder (Client Side çağırıyoruz ki state yönetebilelim)

  const handleSendCode = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    setMsg("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({

      email,

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

    const res = await verifyOtpCode(email, code);



    if (res?.error) {

      setMsg("Hatalı kod! Lütfen tekrar dene.");

      setLoading(false);

    }

    // Hata yoksa verifyOtpCode içinde redirect('/') çalışacak.

  };

  return (

    <div className="flex h-screen items-center justify-center bg-gray-50">

      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-xl shadow-lg border border-gray-100 text-center">



        <h2 className="text-2xl font-bold text-gray-900">

          {step === "email" ? "Giriş Yap" : "Kodu Girin"}

        </h2>

        {msg && <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">{msg}</p>}

        {step === "email" ? (

          <form onSubmit={handleSendCode} className="space-y-4">

            <div>

              <input

                type="email"

                required

                placeholder="ornek@kariyer.net"

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"

              />

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
