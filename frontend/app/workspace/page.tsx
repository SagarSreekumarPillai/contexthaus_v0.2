"use client";

import RequireAuth from "@/components/RequireAuth";
import WorkspaceApp from "@/components/WorkspaceApp";

export default function WorkspacePage() {
  return (
    <RequireAuth>
      <WorkspaceApp />
    </RequireAuth>
  );
}
