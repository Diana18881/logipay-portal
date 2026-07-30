import type { Metadata } from "next";
import { Portal } from "./portal";

export const metadata: Metadata = {
  title: "LOGIPAY — зарплатный портал",
  description: "Управление зарплатами, рейсами и командой логистической компании.",
};

export default function Home() {
  return <Portal />;
}
