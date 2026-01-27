"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginWithMagicLink } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DOMAIN_OPTIONS = [
  { value: "@kariyer.net", label: "@kariyer.net" },
  { value: "@techcareer.net", label: "@techcareer.net" },
  { value: "@coens.io", label: "@coens.io" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Gönderiliyor..." : "Giriş Linki Gönder"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(loginWithMagicLink, undefined);
  const [selectedDomain, setSelectedDomain] = useState<string>("@kariyer.net");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    const username = formData.get("username") as string;
    const domain = selectedDomain;
    const email = username + domain;

    if (!username.trim()) {
      setEmailError("Kullanıcı adı gereklidir.");
      return;
    }

    setEmailError(null);

    const newFormData = new FormData();
    newFormData.set("email", email);

    formAction(newFormData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Hoş Geldiniz
          </CardTitle>
          <CardDescription className="text-center">
            E-posta adresinizi girin, size giriş linki gönderelim
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state?.success ? (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium mb-2">
                Giriş linki e-posta adresinize gönderildi.
              </div>
              <div className="text-sm text-muted-foreground">
                Lütfen kutunuzu kontrol edin.
              </div>
            </div>
          ) : (
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Email</Label>
                <div className="flex gap-1">
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="ad.soyad"
                    className="flex-1"
                    required
                  />
                  <Select
                    value={selectedDomain}
                    onValueChange={setSelectedDomain}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Domain seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOMAIN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
