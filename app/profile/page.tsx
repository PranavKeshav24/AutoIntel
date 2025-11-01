"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getUserInfo, updateUserInfo } from "@/lib/api";

export default function ProfilePage() {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [postgres, setPostgres] = React.useState("");
  const [sqlite, setSqlite] = React.useState("");
  const [mysql, setMysql] = React.useState("");
  const [info, setInfo] = React.useState<any>(null);
  const [msg, setMsg] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await getUserInfo();
        setInfo(res);
        try {
          const parsed = typeof res === "string" ? JSON.parse(res as any) : res;
          setName(parsed?.data.name || "");
          setPhone(parsed?.data.phone_number || "");
          setPostgres(parsed?.data.postgres_db_url || "");
          setSqlite(parsed?.data.sqlite_db_url || "");
          setMysql(parsed?.data.mysql_db_url || "");
        } catch {}
      } catch {}
    })();
  }, []);

  const onSave = async () => {
    setLoading(true);
    setMsg("");
    try {
      await updateUserInfo({
        name,
        phone_number: phone,
        postgres_db_url: postgres,
        sqlite_db_url: sqlite,
        mysql_db_url: mysql,
      });
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
        <Input
          placeholder={`${name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder={`${phone}`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          placeholder={`${postgres}`}
          value={postgres}
          onChange={(e) => setPostgres(e.target.value)}
        />
        <Input
          placeholder={`${sqlite}`}
          value={sqlite}
          onChange={(e) => setSqlite(e.target.value)}
        />
        <Input
          placeholder={`${mysql}`}
          value={mysql}
          onChange={(e) => setMysql(e.target.value)}
        />
        <Button onClick={onSave} disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </Card>
    </div>
  );
}
