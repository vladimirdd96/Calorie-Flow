import { AuthGateway } from "calorie-flow-design-system";
import { asyncNoop, noop } from "./_fixtures";

const handlers = {
  onSignIn: asyncNoop,
  onSignUp: async () => ({ needsEmailConfirmation: false }),
  onSignInWithProvider: asyncNoop,
  onRequestPasswordReset: asyncNoop,
  onUpdatePassword: asyncNoop,
};

export function SignIn() {
  return <AuthGateway configured={true} passwordRecovery={false} {...handlers} />;
}

export function PasswordRecovery() {
  return <AuthGateway configured={true} passwordRecovery={true} {...handlers} />;
}
