"use server";

import { createClient } from "@/lib/supabase/server";

export type MailSearchResult = {
    mail: string;
    name: string | null;
};

export async function searchMails(query: string): Promise<MailSearchResult[]> {
    if (!query || query.trim().length < 1) {
        return [];
    }

    const supabase = await createClient();
    const trimmedQuery = query.trim();

    const { data, error } = await supabase
        .from("mails")
        .select("mail, name")
        .or(`mail.ilike.%${trimmedQuery}%,name.ilike.%${trimmedQuery}%`)
        .order("mail", { ascending: true })
        .limit(10);

    if (error) {
        console.error("Error searching mails:", error);
        return [];
    }

    return (data ?? []).map((row) => ({
        mail: row.mail,
        name: row.name
    }));
}
