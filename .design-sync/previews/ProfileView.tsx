import { ProfileView } from "calorie-flow-design-system";
import { asyncNoop, noop, profile } from "./_fixtures";

export function Default() {
  return (
    <ProfileView
      profile={profile}
      onSave={noop}
      onRestartOnboarding={noop}
      onExport={async () => ({ meals: [], foods: [] } as never)}
      onImport={asyncNoop}
      user={{ id: "u1", email: "alex@example.com" }}
      syncState="synced"
      onSignOut={asyncNoop}
      theme="light"
      onThemeChange={noop}
      chatTextSize="comfortable"
      onChatTextSizeChange={noop}
      weightTracking="enabled"
    />
  );
}
