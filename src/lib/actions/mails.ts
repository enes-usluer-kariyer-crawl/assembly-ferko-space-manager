"use server";

import { createClient } from "@/lib/supabase/server";

export async function searchMails(query: string): Promise<string[]> {
    if (!query || query.trim().length < 1) {
        return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("mails")
        .select("mail")
        .ilike("mail", `%${query.trim()}%`)
        .order("mail", { ascending: true })
        .limit(10);

    if (error) {
        console.error("Error searching mails:", error);
        return [];
    }

    return (data ?? []).map((row) => row.mail);
}
