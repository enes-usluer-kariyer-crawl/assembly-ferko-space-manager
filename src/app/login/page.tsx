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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #e0f4ff 0%, #a7d8f0 25%, #89c4e8 50%, #c5b8e8 75%, #f0e6f5 100%)",
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-700 tracking-wide">
            Assembly Ferko <span className="text-gray-400 font-normal">Space</span>
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/10 p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {step === "email" ? "Hoş Geldiniz!" : "Doğrulama Kodu"}
            </h1>
            <p className="text-sm text-gray-500">
              {step === "email"
                ? "Devam etmek için giriş yapın"
                : "Mail adresinize gönderilen kodu girin"}
            </p>
          </div>

          {/* Message */}
          {msg && (
            <p
              className={`text-sm p-3 rounded-xl mb-4 text-center ${
                msg.includes("Hata") || msg.includes("Hatalı") || msg.includes("doldu")
                  ? "text-red-600 bg-red-50"
                  : "text-blue-600 bg-blue-50"
              }`}
            >
              {msg}
            </p>
          )}

          {step === "email" ? (
            /* Email Step */
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kurumsal E-posta
                </label>
                <div className="flex rounded-xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden bg-white">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kullanici.adi"
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-400 text-sm"
                  />
                  <span className="inline-flex items-center px-2 text-gray-400 text-sm">
                    @
                  </span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="px-3 py-3 bg-transparent border-0 text-gray-600 focus:outline-none focus:ring-0 cursor-pointer text-sm"
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
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-blue-500/25"
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
            /* Verification Code Step */
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {/* Countdown Timer */}
              {timeLeft > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm bg-gray-50 py-2 px-4 rounded-xl">
                  <svg
                    className="w-4 h-4 text-gray-500"
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
                  <span className="text-gray-600">
                    Kod geçerlilik süresi:{" "}
                    <span className="font-semibold text-gray-900">
                      {formatTime(timeLeft)}
                    </span>
                  </span>
                </div>
              )}

              {timeLeft === 0 && step === "code" && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl text-center">
                  Kodun süresi doldu. Lütfen yeni kod isteyin.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-center text-2xl tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !code || timeLeft === 0}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-blue-500/25"
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
                  setMsg("");
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-900 transition-colors py-2"
              >
                {timeLeft === 0 ? "Yeni kod iste" : "Maili değiştir"}
              </button>
            </form>
          )}
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-gray-500/80 mt-6">
          Assembly Ferko Space Management
        </p>
      </div>
    </div>
  );
}
