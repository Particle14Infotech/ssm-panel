import { redirect } from "next/navigation";

export default function TransactionsRedirect() {
  redirect("/wallet?tab=transactions");
}
