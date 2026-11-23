
import { createClient } from "../lib/supabase/server";
import CalendarClient from "./calendar-client";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("사용자 정보 확인 오류:", error.message);
  }

  return <CalendarClient initialUser={user} />;
}
