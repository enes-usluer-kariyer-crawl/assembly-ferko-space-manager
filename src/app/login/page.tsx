"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { verifyOtpCode } from "@/lib/actions/auth";

const allowedDomains = ["kariyer.net", "techcareer.net", "coens.io"];
const CODE_EXPIRY_SECONDS = 5 * 60; // 5 dakika

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(allowedDomains[0]);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  const fullEmail = `${username}@${selectedDomain}`;

  // Geri sayım timer'ı
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Süre formatı: 4:59 gibi
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

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
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) {
      setMsg("Hata: " + error.message);
    } else {
      setStep("code");
      setTimeLeft(CODE_EXPIRY_SECONDS);
      setMsg("Mail kutuna gelen 8 haneli kodu gir.");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await verifyOtpCode(fullEmail, code);

    if (res?.error) {
      setMsg("Hatalı kod! Lütfen tekrar dene.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 rounded-xl mb-4">
            <span className="text-xl font-bold text-white">F</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Assembly Ferko</h1>
          <p className="text-sm text-slate-500 mt-1">Space Management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-medium text-slate-900 text-center mb-6">
            {step === "email" ? "Giriş Yap" : "Kodu Girin"}
          </h2>

          {msg && (
            <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded mb-4 text-center">
              {msg}
            </p>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Kurumsal E-posta
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullanici.adi"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-white border border-slate-300 rounded-l-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                  <span className="inline-flex items-center px-3 border-y border-slate-300 bg-slate-50 text-slate-500 text-sm">
                    @
                  </span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="px-3 py-2.5 bg-white border border-slate-300 rounded-r-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent cursor-pointer"
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
                disabled={loading || !username}
                className="w-full py-2.5 px-4 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Gönderiliyor...
                  </span>
                ) : (
                  "Kod Gönder"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {/* Geri Sayım */}
              {timeLeft > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-slate-600">
                    Kod geçerlilik süresi:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatTime(timeLeft)}
                    </span>
                  </span>
                </div>
              )}

              {timeLeft === 0 && step === "code" && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                  Kodun süresi doldu. Lütfen yeni kod isteyin.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Doğrulama Kodu
                </label>
                <input
                  type="text"
                  required
                  placeholder="12345678"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={8}
                  disabled={timeLeft === 0}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-center text-2xl tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !code || timeLeft === 0}
                className="w-full py-2.5 px-4 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Doğrulanıyor...
                  </span>
                ) : (
                  "Giriş Yap"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setTimeLeft(0);
                }}
                className="w-full text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                {timeLeft === 0 ? "Yeni kod iste" : "Maili değiştir"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Yardıma mı ihtiyacınız var?{" "}
          <a href="#" className="text-slate-600 hover:text-slate-900">
            Destek
          </a>
        </p>
      </div>
    </div>
  );
}
