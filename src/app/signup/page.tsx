"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signup } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ALLOWED_DOMAINS_REGEX = /^[\w-.]+@(kariyer\.net|techcareer\.net|coens\.io)$/i;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Kayıt olunuyor..." : "Kayıt Ol"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signup, undefined);
  const [emailError, setEmailError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    const email = formData.get("email") as string;

    if (!ALLOWED_DOMAINS_REGEX.test(email)) {
      setEmailError("Sadece kurumsal e-posta adresleri (kariyer.net, techcareer.net, coens.io) ile kayıt olabilirsiniz.");
      return;
    }

    setEmailError(null);
    formAction(formData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Hesap Oluştur
          </CardTitle>
          <CardDescription className="text-center">
            Yeni bir hesap oluşturmak için bilgilerinizi girin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Ad Soyad</Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="Ad Soyad"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@sirket.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            {(state?.error || emailError) && (
              <div className="text-sm text-red-500 font-medium">
                {emailError || state?.error}
              </div>
            )}
            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Zaten hesabınız var mı?
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-2"
            asChild
          >
            <Link href="/login">Giriş Yap</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}