import { redirect } from "next/navigation";

export default function CustomerSettingsRedirect() {
  redirect("/profile");
}

