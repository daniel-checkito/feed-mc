"use client";

import dynamic from "next/dynamic";

const McAngebotsfeed = dynamic(() => import("./McAngebotsfeed"), {
  ssr: false,
});

export default function Page() {
  return <McAngebotsfeed />;
}
