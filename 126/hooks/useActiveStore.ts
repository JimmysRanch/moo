import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getActiveStoreId, setActiveStoreId } from "@/lib/activeStore";

interface Membership {
  store_id: string;
  role: string;
}

export function useActiveStore() {
  const [storeId, setStoreId] = useState<string | null>(getActiveStoreId());
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mounted = { current: true };
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (mounted.current) {
          setStoreId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("store_memberships")
        .select("store_id, role")
        .eq("user_id", userId)
        .limit(50);

      const memberships = (data ?? []) as Membership[];
      const selectedId = getActiveStoreId();
      const selectedMembership = memberships.find((m) => m.store_id === selectedId);
      const active = selectedMembership ?? memberships[0] ?? null;

      if (mounted.current) {
        setStoreId(active?.store_id ?? null);
        setRole(active?.role ?? null);
        if (active?.store_id) setActiveStoreId(active.store_id);
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted.current = false;
    };
  }, []);

  return { storeId, role, loading };
}
