import type { Metadata } from "next";
import { Portal } from "./portal";
import { requirePortalUser } from "../lib/auth";

export const metadata: Metadata = {
  title: "LOGIPAY — зарплатный портал",
  description: "Управление зарплатами, рейсами и командой логистической компании.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePortalUser();
  return <Portal currentUser={user} />;
}
