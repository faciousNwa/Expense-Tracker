import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odzhbaopxoktkliguyxq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MxYHgr7c16EMXXgiKlVG9A_hCgitHeK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
