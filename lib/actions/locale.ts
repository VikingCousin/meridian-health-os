"use server";

import { revalidatePath } from "next/cache";
import { setLocale } from "@/lib/services/settings.service";
import { isLocale } from "@/lib/i18n/types";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) {
    return { ok: false as const, error: "Unsupported language." };
  }
  await setLocale(locale);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
