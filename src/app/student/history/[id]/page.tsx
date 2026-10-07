"use client";

import { useParams } from "next/navigation";
import { CallDetailView } from "@/components/CallDetailView";

export default function StudentCallDetailPage() {
  const params = useParams<{ id: string }>();
  return <CallDetailView callId={params.id} />;
}
