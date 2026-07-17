import { redirect } from "next/navigation";

// Sign-up lives on the single toggle page now.
export default function SignUp() {
  redirect("/auth/sign-in");
}